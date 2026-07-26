-- Additive repair for deployments that already have
-- public.user_pipeline_auto_configs but predate the atomic JSONB merge RPC.
-- Keep this definition aligned with backend/supabase_schema.sql.
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

  -- Managed positions are independently updated by fills and the position
  -- guard; merge individual symbols instead of replacing the whole map.
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
    -- Deep-merge one level for every object-valued workspace section. This
    -- covers general, trading, risk, research, charts, notifications,
    -- security and legacy appearance while keeping future sections safe.
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

-- Side-effect-free PostgREST contract probe used by backend readiness. Keeping
-- it as a separate RPC avoids touching a user's updated_at timestamp merely to
-- prove that the mutating function is available in the schema cache.
CREATE OR REPLACE FUNCTION public.probe_pipeline_config_atomic_merge()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN to_regprocedure(
      'public.merge_user_pipeline_auto_config(uuid,jsonb,text[])'
    ) IS NOT NULL
      AND has_function_privilege(
        'service_role',
        'public.merge_user_pipeline_auto_config(uuid,jsonb,text[])',
        'EXECUTE'
      )
    THEN '20260726060000_v2'
    ELSE 'missing'
  END;
$$;

REVOKE ALL ON FUNCTION public.probe_pipeline_config_atomic_merge()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.probe_pipeline_config_atomic_merge()
  TO service_role;

-- Make both RPCs visible to PostgREST immediately after the migration.
NOTIFY pgrst, 'reload schema';
