-- ============================================
-- ServiceSentry — Performance Optimization Migration 003
-- 1. Composite indexes for dashboard / engineer / notification hot paths
-- 2. Drop redundant indexes superseded by composites
-- 3. Optimized current_user_role() (STABLE, cached per query)
-- 4. Due-window filtering strategy (see Part H — generated column not possible)
-- ============================================

-- ============================================
-- PART A: MACHINES — composite + covering indexes
-- ============================================

-- Engineer dashboard: assigned machines filtered by due date + status
CREATE INDEX IF NOT EXISTS idx_machines_engineer_due_status
  ON public.machines (engineer_id, next_service_due_date, status)
  WHERE engineer_id IS NOT NULL;

-- Admin dashboard: due buckets (today/tomorrow/overdue) on active machines
CREATE INDEX IF NOT EXISTS idx_machines_due_status
  ON public.machines (next_service_due_date, status)
  WHERE status = 'active';

-- Search acceleration for machine_code ilike (case-insensitive prefix)
CREATE INDEX IF NOT EXISTS idx_machines_code_lower
  ON public.machines (lower(machine_code) text_pattern_ops);

-- City filter dropdown (distinct active cities)
CREATE INDEX IF NOT EXISTS idx_machines_city_status
  ON public.machines (city, status)
  WHERE status = 'active';

-- ============================================
-- PART B: SERVICE RECORDS — composite indexes
-- ============================================

-- Engineer "completed today" + monthly chart (engineer-scoped)
CREATE INDEX IF NOT EXISTS idx_service_records_engineer_date
  ON public.service_records (engineer_id, service_date DESC);

-- Machine detail service history
CREATE INDEX IF NOT EXISTS idx_service_records_machine_date
  ON public.service_records (machine_id, service_date DESC);

-- ============================================
-- PART C: NOTIFICATIONS — composite indexes
-- ============================================

-- Notification stats + status filters (recipient-scoped)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_alert_date
  ON public.notifications (recipient_id, alert_date, status);

-- "Today's sent/failed" counts (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_notifications_status_date
  ON public.notifications (status, alert_date);

-- In-app notification feed for a single user
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_inapp
  ON public.notifications (recipient_id, created_at DESC)
  WHERE channel = 'in_app';

-- ============================================
-- PART D: AUDIT LOGS — recent activity join
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_user
  ON public.audit_logs (created_at DESC, user_id);

-- ============================================
-- PART E: USERS — role/status filter
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users (role, status);

-- ============================================
-- PART F: DROP REDUNDANT INDEXES
-- (superseded by the composites above — verify with pg_stat_user_indexes first)
-- ============================================

DROP INDEX IF EXISTS idx_machines_next_service_status;
DROP INDEX IF EXISTS idx_machines_status;
DROP INDEX IF EXISTS idx_service_records_machine_id;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_notifications_alert_date;

-- ============================================
-- PART G: OPTIMIZED current_user_role()
-- STABLE + SECURITY DEFINER → Postgres caches the result per query,
-- eliminating the per-row re-query that currently happens in every RLS policy.
-- ============================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.users WHERE id = auth.uid()), 'anonymous');
$$;

-- ============================================
-- PART H: DUE-WINDOW FILTERING (no generated column)
-- NOTE: A generated column for days_until_due is NOT possible here.
-- Postgres generated columns require IMMUTABLE expressions, but
-- (next_service_due_date - CURRENT_DATE) depends on the current date,
-- which is STABLE, not IMMUTABLE — hence error 42P17.
--
-- The existing idx_machines_due_status index on
-- (next_service_due_date, status) WHERE status = 'active' already
-- supports efficient due-window scans via date arithmetic on
-- next_service_due_date, e.g.:
--   WHERE next_service_due_date <= CURRENT_DATE + 7
--   AND   next_service_due_date >= CURRENT_DATE
-- ============================================

-- ============================================
-- End of Migration 003
-- ============================================