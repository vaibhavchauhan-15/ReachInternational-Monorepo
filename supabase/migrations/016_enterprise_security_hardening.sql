-- ==============================================================================
-- Migration 016: Enterprise Security Hardening & Vulnerability Remediation
-- Fixes:
-- • FINDING-01 (CWE-269 / CWE-284): Self-Registration Privilege Escalation Guard
-- • FINDING-02 (CWE-284 / CWE-639): Restrict public.machines UPDATE RLS to Authorized Roles
-- • FINDING-03 (CWE-778): Re-create Append-Only public.audit_logs Table with RLS
-- ==============================================================================

-- ==============================================================================
-- 1. FINDING-01: Fix handle_new_user() Trigger Function (Self-Registration Guard)
-- Guarantees that ALL public self-signups receive safe role ('operator') and 'pending' status.
-- Untrusted client-supplied 'role' or 'status' in raw_user_meta_data are strictly ignored.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    city,
    district,
    state
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), ''),
    'operator', -- Enforce non-privileged default role
    'pending',  -- Strictly require administrator approval before activation
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    updated_at = NOW();
    -- Note: role and status are intentionally NOT updated from EXCLUDED to prevent trigger re-escalation.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 2. FINDING-02: Restrict public.machines UPDATE RLS Policy
-- Operators are removed from direct table update permissions. Machine mutations
-- are restricted strictly to management and supervisor roles with matching WITH CHECK.
-- ==============================================================================

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager', 'supervisor'
    )
  )
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager', 'supervisor'
    )
  );

-- ==============================================================================
-- 3. FINDING-03: Create Immutable Append-Only public.audit_logs Table
-- Provides tamper-proof audit trail for security events, mutations, and compliance.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'admin'));

-- Authenticated users and server actions can insert audit log records
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Tamper-proof guarantee: NO UPDATE or DELETE policies exist for public.audit_logs.