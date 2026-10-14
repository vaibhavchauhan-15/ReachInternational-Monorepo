-- ==============================================================================
-- Migration 166: User Profile Edit Permissions, Non-Editable Fields Security & Document Approval Workflow
-- Feedback Resolution for /profile/edit:
-- 1. Personal Information self-service: full_name, phone, email, street, city, district, state, state_id
-- 2. Strictly protect company-controlled fields from self-mutation:
--    - role (System role - Super Admin / Admin)
--    - status (Account status - Authorized Admin)
--    - monthly_salary, daily_rate, ot_hourly_rate (Salary & OT rate - Authorized payroll/management)
--    - shift_start_time, shift_end_time (Shift timings - Operations management)
--    - supervisor_id (Site supervisor - Operations management)
--    - total_pl_quota, pl_used_as_on_date (PL quotas - HR / leave management)
--    - created_at, doj (Member since - System-generated)
--    - complete_profile (Profile completion status - System-calculated)
-- 3. Enforce approval requirement on Banking details and Identity details:
--    - bank_account_number, bank_ifsc_code require change request with supporting document
--    - aadhaar_number, license_number require change request with supporting document
-- 4. Keep existing approved documents active until replacement is approved.
-- ==============================================================================

-- 1. Update prevent_self_role_status_mutation() on public.users
CREATE OR REPLACE FUNCTION public.prevent_self_role_status_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Only enforce for non-service-role connections (i.e., authenticated users via RLS/JWT)
  IF current_setting('request.jwt.claim.sub', true) IS NOT NULL 
     AND NEW.id = (current_setting('request.jwt.claim.sub', true))::uuid THEN

    -- Retrieve caller's effective role
    v_caller_role := public.current_user_role();

    -- Allow super_admin full self-mutation capabilities
    IF v_caller_role = 'super_admin' THEN
      RETURN NEW;
    END IF;

    -- Block self-mutation of System role (Super Admin / Admin only)
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: System role cannot be modified through Edit Profile. Controlled by Super Admin / Admin.';
    END IF;

    -- Block self-mutation of Account status (Authorized Admin only)
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Account status cannot be modified through Edit Profile. Controlled by Authorized Admin.';
    END IF;

    -- Block self-mutation of Compensation: Salary, daily rate, OT rate (Authorized payroll/management only)
    IF (OLD.monthly_salary IS DISTINCT FROM NEW.monthly_salary) 
       OR (OLD.daily_rate IS DISTINCT FROM NEW.daily_rate) 
       OR (OLD.ot_hourly_rate IS DISTINCT FROM NEW.ot_hourly_rate) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Salary, daily rate, and OT rate cannot be modified through Edit Profile. Controlled by authorized payroll and management.';
    END IF;

    -- Block self-mutation of Shift assignment and timings (Operations management only)
    IF (OLD.shift_start_time IS DISTINCT FROM NEW.shift_start_time) 
       OR (OLD.shift_end_time IS DISTINCT FROM NEW.shift_end_time) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Shift assignment and shift timings cannot be modified through Edit Profile. Controlled by operations management.';
    END IF;

    -- Block self-mutation of Site supervisor (Operations management only)
    IF OLD.supervisor_id IS DISTINCT FROM NEW.supervisor_id THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Site supervisor cannot be modified through Edit Profile. Controlled by operations management.';
    END IF;

    -- Block self-mutation of Annual PL quota and balance (HR / leave management only)
    IF (OLD.total_pl_quota IS DISTINCT FROM NEW.total_pl_quota) 
       OR (OLD.pl_used_as_on_date IS DISTINCT FROM NEW.pl_used_as_on_date) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Annual PL quota and available balance cannot be modified through Edit Profile. Controlled by HR.';
    END IF;

    -- Block self-mutation of Member since / DOJ (System-generated)
    IF (OLD.created_at IS DISTINCT FROM NEW.created_at) 
       OR (OLD.doj IS DISTINCT FROM NEW.doj) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Member since is system-generated and cannot be modified.';
    END IF;

    -- Block self-mutation of Profile completion status (System-calculated)
    IF OLD.complete_profile IS DISTINCT FROM NEW.complete_profile THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Profile completion status is system-calculated and cannot be modified through Edit Profile.';
    END IF;

    -- Direct mutation of Banking details requires approval workflow
    IF (OLD.bank_account_number IS DISTINCT FROM NEW.bank_account_number) 
       OR (OLD.bank_ifsc_code IS DISTINCT FROM NEW.bank_ifsc_code) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Direct modification of banking details is restricted. Please submit a profile change request with supporting documents.';
    END IF;

    -- Direct mutation of Identity details requires approval workflow
    IF (OLD.aadhaar_number IS DISTINCT FROM NEW.aadhaar_number) 
       OR (OLD.license_number IS DISTINCT FROM NEW.license_number) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Direct modification of identity details is restricted. Please submit a profile change request for approval.';
    END IF;

    -- Note: Personal information self-service is permitted:
    -- full_name, phone, email, street, city, district, state, state_id
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Ensure RLS policies on public.user_documents keep existing approved documents active
-- and restrict direct update/deletion to authorized administrators/managers
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 1. Users can read own documents
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_documents' AND policyname = 'Users can read own documents') THEN
    ALTER POLICY "Users can read own documents" ON public.user_documents
      USING (
        user_id = (SELECT auth.uid()) OR
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
      );
  ELSE
    CREATE POLICY "Users can read own documents"
      ON public.user_documents
      FOR SELECT
      TO authenticated
      USING (
        user_id = (SELECT auth.uid()) OR
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
      );
  END IF;

  -- 2. Users can insert own documents
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_documents' AND policyname = 'Users can insert own documents') THEN
    ALTER POLICY "Users can insert own documents" ON public.user_documents
      WITH CHECK (
        user_id = (SELECT auth.uid()) AND
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  ELSE
    CREATE POLICY "Users can insert own documents"
      ON public.user_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (SELECT auth.uid()) AND
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  END IF;

  -- 3. Users can update own documents
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_documents' AND policyname = 'Users can update own documents') THEN
    ALTER POLICY "Users can update own documents" ON public.user_documents
      USING (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      )
      WITH CHECK (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  ELSE
    CREATE POLICY "Users can update own documents"
      ON public.user_documents
      FOR UPDATE
      TO authenticated
      USING (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      )
      WITH CHECK (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  END IF;

  -- 4. Users can delete own documents
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_documents' AND policyname = 'Users can delete own documents') THEN
    ALTER POLICY "Users can delete own documents" ON public.user_documents
      USING (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  ELSE
    CREATE POLICY "Users can delete own documents"
      ON public.user_documents
      FOR DELETE
      TO authenticated
      USING (
        (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
      );
  END IF;
END $$;

