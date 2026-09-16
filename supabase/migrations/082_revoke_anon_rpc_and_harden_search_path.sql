-- ==============================================================================
-- Migration 082: Revoke Anon Execution on SECURITY DEFINER RPCs & Harden search_path
-- Security Fixes:
-- 1. REV3-H01 (CWE-284 / CWE-250): Revoke unauthenticated 'anon' execution on all
--    sensitive SECURITY DEFINER functions and triggers in schema public.
-- 2. REV3-H02 (CWE-426): Set search_path = public, pg_temp on functions with mutable search path.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Revoke EXECUTE on all functions in schema public from 'anon'
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Ensure future functions in public schema do not automatically grant EXECUTE to 'anon'
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- ------------------------------------------------------------------------------
-- 2. Explicitly re-grant EXECUTE to 'anon' ONLY on authorized public signup selectors
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_active_supervisors_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_working_locations_public() TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Revoke direct EXECUTE on internal TRIGGER functions from 'authenticated' as well
-- (Triggers are executed by the PostgreSQL engine, never directly via PostgREST RPC)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Revoke execute on known trigger / internal functions from PUBLIC and authenticated
  FOR r IN (
    SELECT routine_name, specific_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'handle_new_user',
        'prevent_self_role_status_mutation',
        'enforce_supervisor_machine_update_restrictions',
        'enforce_machine_supervisor_change_role',
        'enforce_user_email',
        'sync_machine_personnel_arrays',
        'sync_user_email_from_auth',
        'sync_user_supervisor_array',
        'update_updated_at',
        'update_tasks_updated_at',
        'trg_fn_master_location_sync',
        'prevent_audit_log_modification',
        'auto_calculate_machine_hour_log_overtime',
        'enforce_max_operators_per_machine',
        'sync_operator_shift_ranges',
        'sync_machine_assigned_operators',
        'check_machine_hour_log_shift_overlap'
      )
  ) LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC, anon, authenticated;', r.routine_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Harden search_path = public, pg_temp on all mutable functions
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  FOR func_rec IN
    SELECT p.proname AS func_name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND p.proname IN (
        'shift_to_ranges',
        'enforce_max_operators_per_machine',
        'sync_operator_shift_ranges',
        'sync_machine_assigned_operators',
        'check_machine_hour_log_shift_overlap',
        'submit_operator_hour_log_atomic',
        'update_updated_at',
        'auth_user_get_branch_ids',
        'auth_user_has_branch_access',
        'prevent_audit_log_modification',
        'update_tasks_updated_at',
        'parse_time_to_minutes',
        'calculate_overtime_hours',
        'generate_machine_id',
        'generate_client_code',
        'auto_calculate_machine_hour_log_overtime',
        'check_dos_protection_settings',
        'prevent_self_role_status_mutation',
        'trg_fn_master_location_sync',
        'run_machine_log_overlap_test_suite',
        'assign_machine_operator_atomic',
        'assign_operator_machine_atomic',
        'end_operator_machine_assignment_atomic',
        'complete_user_onboarding_atomic',
        'resolve_hour_log_conflict_atomic',
        'get_dashboard_payload',
        'get_dashboard_kpis',
        'get_dashboard_charts',
        'get_dashboard_due_lists',
        'get_operation_logs',
        'get_operations_summary',
        'get_recent_activity_slim',
        'get_user_aggregates',
        'get_notification_stats',
        'verify_operations_rls_policies'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp;', func_rec.func_name, func_rec.func_args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set search_path on %(%): %', func_rec.func_name, func_rec.func_args, SQLERRM;
    END;
  END LOOP;
END $$;
