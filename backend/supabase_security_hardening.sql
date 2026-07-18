-- AlphaLab browser-write lockdown (idempotent)
-- Apply after the base schemas. Browser roles retain owner-scoped SELECT only;
-- all mutations are authored by the backend service role after validation/MFA.

DO $hardening$
DECLARE
  table_name TEXT;
  policy_row RECORD;
  protected_tables TEXT[] := ARRAY[
    'user_api_configs',
    'user_auto_scan_configs',
    'user_auto_scan_runs',
    'user_pipeline_auto_configs',
    'user_pipeline_auto_runs',
    'user_operations_safety_state',
    'user_operations_audit_events',
    'user_notification_delivery_events',
    'user_order_lifecycle_events',
    'user_readiness_status',
    'user_operation_artifacts'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    -- Remove legacy browser write policies and any accidentally permissive read
    -- policy, then recreate one unambiguous owner-only SELECT policy.
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_row.policyname,
        table_name
      );
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)',
      'Authenticated users can read own rows',
      table_name
    );

    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO authenticated',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
      table_name
    );
  END LOOP;
END
$hardening$;

-- Pin the resolution path for existing trigger functions.  This prevents a
-- caller-controlled schema from shadowing objects referenced by the function
-- body and keeps Supabase's security advisor clean.
DO $function_hardening$
DECLARE
  function_name TEXT;
  trigger_functions TEXT[] := ARRAY[
    'set_updated_at',
    'update_pipeline_auto_updated_at'
  ];
BEGIN
  FOREACH function_name IN ARRAY trigger_functions LOOP
    IF to_regprocedure(format('public.%I()', function_name)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'ALTER FUNCTION public.%I() SET search_path = pg_catalog, public',
      function_name
    );
  END LOOP;
END
$function_hardening$;

-- Cover the ownership foreign key and the dominant per-user history query.
CREATE INDEX IF NOT EXISTS user_pipeline_auto_runs_user_created_idx
  ON public.user_pipeline_auto_runs (user_id, created_at DESC);
