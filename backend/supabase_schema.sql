-- Alpha_lab Supabase Schema
-- ============================================================
-- THIS FILE MUST BE RUN MANUALLY IN SUPABASE SQL EDITOR
-- Go to: https://supabase.com/dashboard → your project → SQL Editor → New Query
-- Paste this entire file and click "Run"
-- ============================================================

-- User API configs (one row per user per config type)
CREATE TABLE IF NOT EXISTS user_api_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL CHECK (config_type IN ('ai_provider', 'alpaca', 'finnhub', 'discord', 'kalshi')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, config_type)
);

-- RLS: browser clients may only read their own rows. All writes pass through
-- the authenticated backend service role, where MFA and validation are enforced.
ALTER TABLE user_api_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own configs" ON user_api_configs;
CREATE POLICY "Users can view own configs" ON user_api_configs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own configs" ON user_api_configs;
DROP POLICY IF EXISTS "Users can update own configs" ON user_api_configs;
REVOKE ALL ON TABLE user_api_configs FROM anon, authenticated;
GRANT SELECT ON TABLE user_api_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_api_configs TO service_role;

-- Pipeline Auto Configs (one row per user)
CREATE TABLE IF NOT EXISTS user_pipeline_auto_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  config_type TEXT NOT NULL DEFAULT 'pipeline_auto',
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT FALSE,
  interval_minutes INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'hybrid',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_decision TEXT,
  last_summary JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_pipeline_auto_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pipeline auto config" ON user_pipeline_auto_configs;
CREATE POLICY "Users can view own pipeline auto config" ON user_pipeline_auto_configs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own pipeline auto config" ON user_pipeline_auto_configs;
DROP POLICY IF EXISTS "Users can update own pipeline auto config" ON user_pipeline_auto_configs;
REVOKE ALL ON TABLE user_pipeline_auto_configs FROM anon, authenticated;
GRANT SELECT ON TABLE user_pipeline_auto_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_pipeline_auto_configs TO service_role;

-- Atomic field-level merge used by scheduler heartbeats, run summaries and
-- position protection. It prevents a background worker from replacing a
-- user's newer strategy/preferences with an older whole-document snapshot.
CREATE OR REPLACE FUNCTION public.merge_user_pipeline_auto_config(
  p_user_id UUID,
  p_patch JSONB,
  p_remove_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current JSONB;
  v_merged JSONB;
  v_next_run_at TIMESTAMPTZ;
  v_preference_key TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
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
  IF COALESCE(p_patch, '{}'::JSONB) ? 'user_preferences' THEN
    v_merged := jsonb_set(
      v_merged,
      '{user_preferences}',
      COALESCE(v_current->'user_preferences', '{}'::JSONB)
        || COALESCE(p_patch->'user_preferences', '{}'::JSONB),
      TRUE
    );
    FOREACH v_preference_key IN ARRAY ARRAY[
      'appearance', 'notifications', 'risk', 'security', 'trading'
    ]
    LOOP
      IF COALESCE(p_patch->'user_preferences', '{}'::JSONB) ? v_preference_key THEN
        v_merged := jsonb_set(
          v_merged,
          ARRAY['user_preferences', v_preference_key],
          COALESCE(v_current->'user_preferences'->v_preference_key, '{}'::JSONB)
            || COALESCE(p_patch->'user_preferences'->v_preference_key, '{}'::JSONB),
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

-- Pipeline Auto Run History
CREATE TABLE IF NOT EXISTS user_pipeline_auto_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT DEFAULT 'auto_market_session',
  status TEXT,
  reason TEXT,
  market_open BOOLEAN,
  market_status TEXT,
  market_status_source TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_seconds NUMERIC,
  interval_minutes INTEGER,
  mode TEXT,
  summary JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_pipeline_auto_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pipeline auto runs" ON user_pipeline_auto_runs;
CREATE POLICY "Users can view own pipeline auto runs" ON user_pipeline_auto_runs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own pipeline auto runs" ON user_pipeline_auto_runs;
REVOKE ALL ON TABLE user_pipeline_auto_runs FROM anon, authenticated;
GRANT SELECT ON TABLE user_pipeline_auto_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_pipeline_auto_runs TO service_role;

-- Cross-host worker leases. This table is intentionally backend-only: it is
-- in the exposed public schema for PostgREST RPC compatibility, but RLS is
-- enabled and browser roles receive neither policies nor table privileges.
CREATE SEQUENCE IF NOT EXISTS public.app_worker_lease_fencing_seq AS BIGINT;

CREATE TABLE IF NOT EXISTS public.app_worker_leases (
  lease_name TEXT PRIMARY KEY
    CHECK (length(trim(lease_name)) BETWEEN 1 AND 200),
  owner_id TEXT NOT NULL
    CHECK (length(trim(owner_id)) BETWEEN 1 AND 300),
  fencing_token BIGINT NOT NULL
    DEFAULT nextval('public.app_worker_lease_fencing_seq'::regclass),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(metadata) = 'object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lease_expires_at > heartbeat_at)
);

-- Make the full schema safe to re-run against the pre-fencing lease table.
ALTER TABLE public.app_worker_leases
  ADD COLUMN IF NOT EXISTS fencing_token BIGINT;
ALTER TABLE public.app_worker_leases
  ALTER COLUMN fencing_token
  SET DEFAULT nextval('public.app_worker_lease_fencing_seq'::regclass);
UPDATE public.app_worker_leases
SET fencing_token = nextval('public.app_worker_lease_fencing_seq'::regclass)
WHERE fencing_token IS NULL;
ALTER TABLE public.app_worker_leases
  ALTER COLUMN fencing_token SET NOT NULL;
ALTER SEQUENCE public.app_worker_lease_fencing_seq
  OWNED BY public.app_worker_leases.fencing_token;

SELECT setval(
  'public.app_worker_lease_fencing_seq'::regclass,
  GREATEST(
    (SELECT COALESCE(MAX(fencing_token), 0) FROM public.app_worker_leases),
    (SELECT last_value FROM public.app_worker_lease_fencing_seq)
  ),
  TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS app_worker_leases_fencing_token_idx
  ON public.app_worker_leases (fencing_token);
CREATE INDEX IF NOT EXISTS app_worker_leases_expiry_idx
  ON public.app_worker_leases (lease_expires_at);

ALTER TABLE public.app_worker_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_worker_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_worker_leases
  TO service_role;
REVOKE ALL ON SEQUENCE public.app_worker_lease_fencing_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.app_worker_lease_fencing_seq
  TO service_role;

-- The fenced claim returns a generation token. Renewals cannot revive an
-- expired generation, and takeover after expiry always receives a newer token.
CREATE OR REPLACE FUNCTION public.claim_app_worker_lease_fenced(
  p_lease_name TEXT,
  p_owner_id TEXT,
  p_ttl_seconds INTEGER DEFAULT 20,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_owner_id TEXT;
  v_fencing_token BIGINT;
  v_lease_expires_at TIMESTAMPTZ;
BEGIN
  IF nullif(trim(p_lease_name), '') IS NULL
     OR length(trim(p_lease_name)) > 200
     OR nullif(trim(p_owner_id), '') IS NULL
     OR length(trim(p_owner_id)) > 300 THEN
    RAISE EXCEPTION 'invalid worker lease identity' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'worker lease metadata must be an object'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.app_worker_leases (
    lease_name,
    owner_id,
    fencing_token,
    acquired_at,
    heartbeat_at,
    lease_expires_at,
    metadata,
    version,
    updated_at
  )
  VALUES (
    trim(p_lease_name),
    trim(p_owner_id),
    nextval('public.app_worker_lease_fencing_seq'::regclass),
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp() + make_interval(
      secs => greatest(5, least(COALESCE(p_ttl_seconds, 20), 300))
    ),
    COALESCE(p_metadata, '{}'::JSONB),
    1,
    statement_timestamp()
  )
  ON CONFLICT (lease_name) DO UPDATE
  SET
    owner_id = EXCLUDED.owner_id,
    fencing_token = CASE
      WHEN app_worker_leases.owner_id = EXCLUDED.owner_id
       AND app_worker_leases.lease_expires_at > statement_timestamp()
        THEN app_worker_leases.fencing_token
      ELSE EXCLUDED.fencing_token
    END,
    acquired_at = CASE
      WHEN app_worker_leases.owner_id = EXCLUDED.owner_id
       AND app_worker_leases.lease_expires_at > statement_timestamp()
        THEN app_worker_leases.acquired_at
      ELSE statement_timestamp()
    END,
    heartbeat_at = statement_timestamp(),
    lease_expires_at = EXCLUDED.lease_expires_at,
    metadata = EXCLUDED.metadata,
    version = app_worker_leases.version + 1,
    updated_at = statement_timestamp()
  WHERE app_worker_leases.owner_id = EXCLUDED.owner_id
     OR app_worker_leases.lease_expires_at <= statement_timestamp()
  RETURNING owner_id, fencing_token, lease_expires_at
  INTO v_owner_id, v_fencing_token, v_lease_expires_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'acquired', FALSE,
      'fencingToken', NULL,
      'leaseExpiresAt', NULL
    );
  END IF;
  RETURN jsonb_build_object(
    'acquired', v_owner_id = trim(p_owner_id),
    'fencingToken', v_fencing_token,
    'leaseExpiresAt', v_lease_expires_at
  );
END;
$$;

-- Compatibility RPC for existing scheduler code during a rolling upgrade.
CREATE OR REPLACE FUNCTION public.claim_app_worker_lease(
  p_lease_name TEXT,
  p_owner_id TEXT,
  p_ttl_seconds INTEGER DEFAULT 20,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (
      public.claim_app_worker_lease_fenced(
        p_lease_name,
        p_owner_id,
        p_ttl_seconds,
        p_metadata
      )->>'acquired'
    )::BOOLEAN,
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.renew_app_worker_lease(
  p_lease_name TEXT,
  p_owner_id TEXT,
  p_fencing_token BIGINT,
  p_ttl_seconds INTEGER DEFAULT 20,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_lease_expires_at TIMESTAMPTZ;
BEGIN
  IF nullif(trim(p_lease_name), '') IS NULL
     OR nullif(trim(p_owner_id), '') IS NULL
     OR COALESCE(p_fencing_token, 0) <= 0 THEN
    RAISE EXCEPTION 'invalid fenced worker lease identity'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'worker lease metadata must be an object'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.app_worker_leases
  SET
    heartbeat_at = statement_timestamp(),
    lease_expires_at = statement_timestamp() + make_interval(
      secs => greatest(5, least(COALESCE(p_ttl_seconds, 20), 300))
    ),
    metadata = COALESCE(p_metadata, '{}'::JSONB),
    version = version + 1,
    updated_at = statement_timestamp()
  WHERE lease_name = trim(p_lease_name)
    AND owner_id = trim(p_owner_id)
    AND fencing_token = p_fencing_token
    AND lease_expires_at > statement_timestamp()
  RETURNING lease_expires_at INTO v_lease_expires_at;

  RETURN jsonb_build_object(
    'renewed', FOUND,
    'fencingToken', CASE WHEN FOUND THEN p_fencing_token ELSE NULL END,
    'leaseExpiresAt', v_lease_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_app_worker_lease(
  p_lease_name TEXT,
  p_owner_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_released_name TEXT;
BEGIN
  IF nullif(trim(p_lease_name), '') IS NULL
     OR nullif(trim(p_owner_id), '') IS NULL THEN
    RAISE EXCEPTION 'lease name and owner are required'
      USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.app_worker_leases
  WHERE lease_name = trim(p_lease_name)
    AND owner_id = trim(p_owner_id)
  RETURNING lease_name INTO v_released_name;

  RETURN v_released_name IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_app_worker_lease_fenced(
  p_lease_name TEXT,
  p_owner_id TEXT,
  p_fencing_token BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_released_name TEXT;
BEGIN
  IF nullif(trim(p_lease_name), '') IS NULL
     OR nullif(trim(p_owner_id), '') IS NULL
     OR COALESCE(p_fencing_token, 0) <= 0 THEN
    RAISE EXCEPTION 'invalid fenced worker lease identity'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.app_worker_leases
  WHERE lease_name = trim(p_lease_name)
    AND owner_id = trim(p_owner_id)
    AND fencing_token = p_fencing_token
  RETURNING lease_name INTO v_released_name;

  RETURN v_released_name IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_app_worker_lease_fenced(
  TEXT, TEXT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_app_worker_lease(
  TEXT, TEXT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_app_worker_lease(
  TEXT, TEXT, BIGINT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_app_worker_lease(
  TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_app_worker_lease_fenced(
  TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_app_worker_lease_fenced(
  TEXT, TEXT, INTEGER, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_app_worker_lease(
  TEXT, TEXT, INTEGER, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_app_worker_lease(
  TEXT, TEXT, BIGINT, INTEGER, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_app_worker_lease(
  TEXT, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_app_worker_lease_fenced(
  TEXT, TEXT, BIGINT
) TO service_role;
