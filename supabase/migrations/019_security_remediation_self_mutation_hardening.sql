-- ==============================================================================
-- Migration 019: Security Remediation — Self-Mutation Prevention Hardening
-- Fix: F-02 (CWE-284) — Extend prevent_self_role_status_mutation() to also
-- block self-mutation of the `email` column, preventing users from changing
-- their own email address to impersonate another account.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_role_status_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for non-service-role connections (i.e., authenticated users via RLS)
  -- Service role (admin client) bypasses RLS and triggers remain needed for admin operations
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_prevent_self_role_status_mutation ON public.users;
CREATE TRIGGER trg_prevent_self_role_status_mutation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_status_mutation();
