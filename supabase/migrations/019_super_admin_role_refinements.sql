-- Migration: 019_super_admin_role_refinements.sql
-- Description: Comprehensive Super Admin Global Scope Authorization, Complete Permission Mapping, and Immutable Audit Log Enforcement

-- ============================================
-- 1. SEED ALL GRANULAR SYSTEM PERMISSIONS
-- ============================================
INSERT INTO public.permissions (code, module, description) VALUES
  -- Operator & Fuel Logs
  ('operator.view', 'operator', 'View machine operator assignments and meter logs'),
  ('operator.assign', 'operator', 'Assign operators to machinery'),
  ('operator.log_approve', 'operator', 'Approve or edit daily hour meter and fuel logs'),

  -- Notifications Configuration
  ('notification.view', 'notification', 'View system notification logs and channel status'),
  ('notification.configure', 'notification', 'Configure notification channels (Email, SMS, WhatsApp)'),
  ('notification.send', 'notification', 'Dispatch manual platform notifications'),

  -- Branch Administration
  ('branch.delete', 'branch', 'Deactivate or remove branch location')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. MAP ALL SYSTEM PERMISSIONS TO SUPER ADMIN
-- ============================================
-- Clear previous super_admin permissions mapping to guarantee 100% full authorization
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'super_admin');

-- Assign EVERY system permission in public.permissions to super_admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. ENSURE SUPER ADMIN GLOBAL RLS ACCESS
-- ============================================
CREATE OR REPLACE FUNCTION public.auth_user_has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  u_role TEXT;
  u_id UUID;
BEGIN
  u_id := auth.uid();
  IF u_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO u_role FROM public.users WHERE id = u_id;
  
  -- Super admin & Admin access all branches globally
  IF u_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Target branch IS NULL means globally available resource
  IF target_branch_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check direct branch assignment or user_branches junction
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = u_id AND branch_id = target_branch_id
    UNION
    SELECT 1 FROM public.user_branches WHERE user_id = u_id AND branch_id = target_branch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. IMMUTABLE AUDIT LOG ENFORCEMENT
-- ============================================
-- Ensure audit_logs RLS prevents any UPDATE or DELETE operations
DO $$ 
BEGIN
  -- Drop any legacy update/delete policies if present
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_update'
  ) THEN
    DROP POLICY "audit_logs_update" ON public.audit_logs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_delete'
  ) THEN
    DROP POLICY "audit_logs_delete" ON public.audit_logs;
  END IF;
END $$;

-- Trigger to prevent any physical UPDATE or DELETE on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();
