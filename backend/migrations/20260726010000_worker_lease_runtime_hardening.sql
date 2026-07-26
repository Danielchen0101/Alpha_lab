-- Additive repair for deployments that installed the original worker-lease
-- RPCs before the backing table and fencing generation were checked in.
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
