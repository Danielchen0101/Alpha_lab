-- Reduce scheduler write amplification on tiny, frequently updated state
-- tables and collapse backend readiness into one side-effect-free query.
CREATE OR REPLACE FUNCTION public.merge_user_pipeline_auto_config(
  p_user_id UUID,
  p_patch JSONB,
  p_remove_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current JSONB;
  v_merged JSONB;
  v_next_run_at TIMESTAMPTZ;
  v_preference_key TEXT;
  v_preference_value JSONB;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(COALESCE(p_patch, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'invalid pipeline config patch' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_pipeline_auto_configs (user_id, config)
  VALUES (p_user_id, '{}'::JSONB)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT config
  INTO v_current
  FROM public.user_pipeline_auto_configs
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_merged := (COALESCE(v_current, '{}'::JSONB) - COALESCE(p_remove_keys, ARRAY[]::TEXT[]))
    || COALESCE(p_patch, '{}'::JSONB);

  IF COALESCE(p_patch, '{}'::JSONB) ? 'managed_positions' THEN
    v_merged := jsonb_set(
      v_merged,
      '{managed_positions}',
      COALESCE(v_current->'managed_positions', '{}'::JSONB)
        || COALESCE(p_patch->'managed_positions', '{}'::JSONB),
      TRUE
    );
  END IF;
  IF COALESCE(p_patch, '{}'::JSONB) ? 'user_preferences'
    AND jsonb_typeof(p_patch->'user_preferences') = 'object'
  THEN
    v_merged := jsonb_set(
      v_merged,
      '{user_preferences}',
      COALESCE(v_current->'user_preferences', '{}'::JSONB)
        || COALESCE(p_patch->'user_preferences', '{}'::JSONB),
      TRUE
    );
    FOR v_preference_key, v_preference_value IN
      SELECT key, value
      FROM jsonb_each(p_patch->'user_preferences')
    LOOP
      IF jsonb_typeof(v_preference_value) = 'object' THEN
        v_merged := jsonb_set(
          v_merged,
          ARRAY['user_preferences', v_preference_key],
          CASE
            WHEN jsonb_typeof(
              v_current->'user_preferences'->v_preference_key
            ) = 'object'
            THEN v_current->'user_preferences'->v_preference_key
            ELSE '{}'::JSONB
          END || v_preference_value,
          TRUE
        );
      END IF;
    END LOOP;
  END IF;

  IF v_merged IS NOT DISTINCT FROM v_current THEN
    RETURN v_current;
  END IF;

  BEGIN
    v_next_run_at := NULLIF(v_merged->>'next_run_at', '')::TIMESTAMPTZ;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_next_run_at := NULL;
  END;

  UPDATE public.user_pipeline_auto_configs
  SET
    config = v_merged,
    enabled = COALESCE((v_merged->>'enabled')::BOOLEAN, FALSE),
    interval_minutes = GREATEST(0, COALESCE((v_merged->>'interval_minutes')::INTEGER, 0)),
    mode = COALESCE(NULLIF(v_merged->>'mode', ''), 'hybrid'),
    last_run_at = NULLIF(v_merged->>'last_run_at', '')::TIMESTAMPTZ,
    next_run_at = v_next_run_at,
    last_decision = NULLIF(v_merged->>'last_decision', ''),
    last_summary = COALESCE(v_merged->'last_summary', '{}'::JSONB),
    last_error = NULLIF(v_merged->>'last_error', ''),
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_merged;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_user_pipeline_auto_config(UUID, JSONB, TEXT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_user_pipeline_auto_config(UUID, JSONB, TEXT[])
  TO service_role;

CREATE OR REPLACE FUNCTION public.probe_runtime_dependencies()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'contract', '20260802010716_v1',
    'baseTables',
      to_regclass('public.user_pipeline_auto_configs') IS NOT NULL
      AND to_regclass('public.user_api_configs') IS NOT NULL
      AND to_regclass('public.app_worker_leases') IS NOT NULL,
    'pipelineConfigMergeRpc',
      to_regprocedure(
        'public.merge_user_pipeline_auto_config(uuid,jsonb,text[])'
      ) IS NOT NULL
      AND has_function_privilege(
        'service_role',
        'public.merge_user_pipeline_auto_config(uuid,jsonb,text[])',
        'EXECUTE'
      ),
    'workerLeaseRpc',
      to_regprocedure(
        'public.renew_app_worker_lease(text,text,bigint,integer,jsonb)'
      ) IS NOT NULL
      AND has_function_privilege(
        'service_role',
        'public.renew_app_worker_lease(text,text,bigint,integer,jsonb)',
        'EXECUTE'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.probe_runtime_dependencies()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.probe_runtime_dependencies()
  TO service_role;

CREATE INDEX IF NOT EXISTS user_operation_artifacts_scheduler_lookup_idx
  ON public.user_operation_artifacts (
    artifact_type,
    artifact_key,
    updated_at DESC
  );

NOTIFY pgrst, 'reload schema';
