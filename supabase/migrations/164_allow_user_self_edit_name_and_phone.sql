-- ==============================================================================
-- Migration 164: Allow User Self-Editing of Full Name and Mobile Phone Number
-- Feedback Resolution for /profile/edit:
-- 1. Allow authenticated users to edit their own full_name and phone.
-- 2. Maintain strict RBAC blocking self-mutation of role, status, email,
--    aadhaar_number, license_number, bank_account_number, bank_ifsc_code,
--    and monthly_salary for non-super_admin/admin/manager callers.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_role_status_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Only enforce for non-service-role connections (i.e., authenticated users via RLS/JWT)
  IF current_setting('request.jwt.claim.sub', true) IS NOT NULL 
     AND NEW.id = (current_setting('request.jwt.claim.sub', true))::uuid THEN

    -- Block self-mutation of role
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Users cannot change their own role. Contact an administrator.';
    END IF;

    -- Block self-mutation of status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Users cannot change their own status. Contact an administrator.';
    END IF;

    -- Block self-mutation of email (prevents impersonation via email swap)
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Users cannot change their own email address. Contact an administrator.';
    END IF;

    -- Retrieve caller's effective role
    v_caller_role := public.current_user_role();

    -- Restrict KYC, Banking, and Compensation mutation to super_admin, admin, manager
    -- Note: full_name and phone are permitted for employee self-service updates
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      IF OLD.aadhaar_number IS DISTINCT FROM NEW.aadhaar_number THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and managers can change Aadhaar card number.';
      END IF;

      IF OLD.license_number IS DISTINCT FROM NEW.license_number THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and managers can change driving licence number.';
      END IF;

      IF OLD.bank_account_number IS DISTINCT FROM NEW.bank_account_number THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and managers can change bank account number.';
      END IF;

      IF OLD.bank_ifsc_code IS DISTINCT FROM NEW.bank_ifsc_code THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and managers can change bank IFSC code.';
      END IF;

      IF OLD.monthly_salary IS DISTINCT FROM NEW.monthly_salary THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Only administrators and managers can modify monthly compensation.';
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
