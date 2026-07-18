-- AlphaLab durable operations store
-- Review in a Supabase branch/local database before applying in production.
-- This file intentionally has no SECURITY DEFINER functions or permissive anon grants.

CREATE TABLE IF NOT EXISTS public.user_operations_safety_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pause_new_entries BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_pending_entry_orders BOOLEAN NOT NULL DEFAULT FALSE,
  keep_protective_exits BOOLEAN NOT NULL DEFAULT TRUE CHECK (keep_protective_exits IS TRUE),
  reason TEXT NOT NULL DEFAULT '',
  paused_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  last_idempotency_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_operations_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'user',
  source TEXT NOT NULL DEFAULT 'api',
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS user_operations_audit_user_created_idx
  ON public.user_operations_audit_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_notification_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS user_notification_delivery_user_created_idx
  ON public.user_notification_delivery_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_order_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  broker_event_id TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS user_order_lifecycle_user_created_idx
  ON public.user_order_lifecycle_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_order_lifecycle_user_order_idx
  ON public.user_order_lifecycle_events (user_id, order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_readiness_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (completion_percent >= 0 AND completion_percent <= 100),
  blocking_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  last_idempotency_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_operation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  last_idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, artifact_type, artifact_key)
);

CREATE INDEX IF NOT EXISTS user_operation_artifacts_user_type_updated_idx
  ON public.user_operation_artifacts (user_id, artifact_type, updated_at DESC);

ALTER TABLE public.user_operations_safety_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_operations_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_order_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_readiness_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_operation_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own operations safety" ON public.user_operations_safety_state;
CREATE POLICY "Users can view own operations safety"
  ON public.user_operations_safety_state FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert own operations safety" ON public.user_operations_safety_state;
DROP POLICY IF EXISTS "Users can update own operations safety" ON public.user_operations_safety_state;

DROP POLICY IF EXISTS "Users can view own operations audit" ON public.user_operations_audit_events;
CREATE POLICY "Users can view own operations audit"
  ON public.user_operations_audit_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can append own operations audit" ON public.user_operations_audit_events;

DROP POLICY IF EXISTS "Users can view own notification history" ON public.user_notification_delivery_events;
CREATE POLICY "Users can view own notification history"
  ON public.user_notification_delivery_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can append own notification history" ON public.user_notification_delivery_events;

DROP POLICY IF EXISTS "Users can view own order lifecycle" ON public.user_order_lifecycle_events;
CREATE POLICY "Users can view own order lifecycle"
  ON public.user_order_lifecycle_events FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can append own order lifecycle" ON public.user_order_lifecycle_events;

DROP POLICY IF EXISTS "Users can view own readiness" ON public.user_readiness_status;
CREATE POLICY "Users can view own readiness"
  ON public.user_readiness_status FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert own readiness" ON public.user_readiness_status;
DROP POLICY IF EXISTS "Users can update own readiness" ON public.user_readiness_status;

DROP POLICY IF EXISTS "Users can view own operation artifacts" ON public.user_operation_artifacts;
CREATE POLICY "Users can view own operation artifacts"
  ON public.user_operation_artifacts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert own operation artifacts" ON public.user_operation_artifacts;
DROP POLICY IF EXISTS "Users can update own operation artifacts" ON public.user_operation_artifacts;
DROP POLICY IF EXISTS "Users can delete own operation artifacts" ON public.user_operation_artifacts;

-- Supabase projects created after April 2026 may not expose SQL-created tables
-- automatically, so Data API grants are explicit. RLS still owns row access.
-- Audit, notification, and order lifecycle rows are server-authored evidence:
-- authenticated clients may read their own rows but may never forge writes.
REVOKE ALL ON TABLE public.user_operations_safety_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_operations_audit_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_notification_delivery_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_order_lifecycle_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_readiness_status FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_operation_artifacts FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_operations_safety_state TO authenticated;
GRANT SELECT ON TABLE public.user_operations_audit_events TO authenticated;
GRANT SELECT ON TABLE public.user_notification_delivery_events TO authenticated;
GRANT SELECT ON TABLE public.user_order_lifecycle_events TO authenticated;
GRANT SELECT ON TABLE public.user_readiness_status TO authenticated;
GRANT SELECT ON TABLE public.user_operation_artifacts TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_operations_safety_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_operations_audit_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_notification_delivery_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_order_lifecycle_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_readiness_status TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_operation_artifacts TO service_role;
