-- ==============================================================================
-- Migration 053: Centralized Audit Schema Enhancement & Optimized Indexes
-- ==============================================================================
-- Purpose:
--   Transform audit_logs into an industry-grade centralized audit system.
--   Adds structured categorization, severity levels, before/after state capture,
--   denormalized display fields (for zero-JOIN reads), and cursor-pagination indexes.
--
-- Principles:
--   • Append-only — NO UPDATE or DELETE policies
--   • Denormalized actor/entity names — historical accuracy immune to renames
--   • Cursor pagination via (created_at DESC, id DESC) composite index
--   • Category + severity for fast filtered queries
-- ==============================================================================

-- 1. Add new structured columns
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;

-- 2. Add severity check constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_severity_check'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_severity_check
      CHECK (severity IS NULL OR severity IN ('info', 'warning', 'critical'));
  END IF;
END $$;

-- 3. Optimized composite indexes for cursor pagination and filtered queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_cursor
  ON public.audit_logs (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_category_created
  ON public.audit_logs (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created
  ON public.audit_logs (severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role_created
  ON public.audit_logs (actor_role, created_at DESC);

-- 4. Backfill category from existing action prefixes
UPDATE public.audit_logs SET category = 
  CASE
    WHEN action LIKE 'auth.%' THEN 'auth'
    WHEN action LIKE 'user.%' OR action LIKE 'employee.%' THEN 'employee'
    WHEN action LIKE 'machine.%' THEN 'machine'
    WHEN action LIKE 'assignment.%' OR action LIKE 'operator.%' THEN 'assignment'
    WHEN action LIKE 'rental.%' THEN 'rental'
    WHEN action LIKE 'client.%' THEN 'client'
    WHEN action LIKE 'operations.%' OR action LIKE 'shift.%' THEN 'operations'
    WHEN action LIKE 'security.%' THEN 'security'
    WHEN action LIKE 'notification.%' OR action LIKE 'manual.%' OR action LIKE 'reminders.%' THEN 'system'
    WHEN action LIKE 'import.%' OR action LIKE 'alert_run.%' OR action LIKE 'settings.%' THEN 'system'
    WHEN action LIKE 'service.%' THEN 'operations'
    ELSE 'system'
  END
WHERE category IS NULL;

-- 5. Backfill severity from action keywords
UPDATE public.audit_logs SET severity =
  CASE
    WHEN action LIKE '%deleted%' OR action LIKE '%rejected%' OR action LIKE '%deactivated%' THEN 'warning'
    WHEN action LIKE '%security%' OR action LIKE '%unauthorized%' THEN 'critical'
    ELSE 'info'
  END
WHERE severity IS NULL OR severity = 'info';

-- 6. Backfill actor_name from users table for historical records
UPDATE public.audit_logs al
SET actor_name = u.full_name,
    actor_role = u.role
FROM public.users u
WHERE al.user_id = u.id
  AND al.actor_name IS NULL;

-- 7. Expand RLS for hierarchical role-based SELECT
-- Drop existing admin-only policy and create hierarchical policy
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_hierarchical" ON public.audit_logs;

CREATE POLICY "audit_logs_select_hierarchical" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    CASE public.current_user_role()
      -- Super Admin & Admin: see everything
      WHEN 'super_admin' THEN true
      WHEN 'admin' THEN true
      -- Manager & Service Manager: all except security events targeting higher roles
      WHEN 'manager' THEN (category IS DISTINCT FROM 'security' OR severity IS DISTINCT FROM 'critical')
      WHEN 'service_manager' THEN (category IS DISTINCT FROM 'security' OR severity IS DISTINCT FROM 'critical')
      -- Supervisor: assignment, machine, operator, operations logs
      WHEN 'supervisor' THEN category IN ('assignment', 'machine', 'operations', 'auth')
      -- All others: own audit trail only
      ELSE user_id = auth.uid()
    END
  );

-- Keep insert policy untouched (already exists from migration 016)
-- Tamper-proof guarantee: NO UPDATE or DELETE policies exist for public.audit_logs.

COMMENT ON TABLE public.audit_logs IS 'Immutable, append-only centralized audit trail. Columns: category (auth/employee/machine/assignment/rental/client/operations/security/system), severity (info/warning/critical), before_state/after_state (JSONB diffs), actor_name/actor_role/entity_name (denormalized for zero-JOIN reads). Cursor-paginated via (created_at DESC, id DESC).';
