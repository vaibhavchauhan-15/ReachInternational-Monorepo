-- ==============================================================================
-- Migration 083: Revoke PUBLIC Execution on Schema Public Functions
-- Security Fix: REV3-H01 — Prevent 'anon' role from inheriting EXECUTE privileges
-- via the PostgreSQL pseudo-role 'PUBLIC' on all SECURITY DEFINER RPCs.
-- ==============================================================================

-- 1. Revoke default EXECUTE from PUBLIC on all existing functions in schema public
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 2. Grant EXECUTE to 'authenticated' role for regular application RPCs
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- 3. Explicitly re-grant EXECUTE to 'anon' ONLY for public signup selectors
GRANT EXECUTE ON FUNCTION public.get_active_supervisors_public() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_working_locations_public() TO anon;

-- 4. Revoke EXECUTE from authenticated on internal trigger functions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT routine_name
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
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated;', r.routine_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
