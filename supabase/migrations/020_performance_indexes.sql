-- ==============================================================================
-- MIGRATION: 020_performance_indexes.sql
-- PURPOSE: High-Performance Composite & Partial Indexes for Operational Queries
-- ==============================================================================

-- 1. Active Machine Assignments (Partial B-Tree Indexes)
-- Accelerates current operator and machine assignment lookup queries while keeping index footprint small (< 100 KB).
CREATE INDEX IF NOT EXISTS idx_machine_assignments_active_operator
ON public.machine_assignments (operator_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_machine_assignments_active_machine
ON public.machine_assignments (machine_id)
WHERE status = 'active';

-- 2. Machine Fleet Status Compound Index
-- Accelerates combined status and health_status filter queries on /machines.
CREATE INDEX IF NOT EXISTS idx_machines_status_health
ON public.machines (status, health_status);

-- 3. Entity-Specific Audit Trail Index
-- Accelerates modal inspection of entity history in chronological order.
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
ON public.audit_logs (entity_type, entity_id, created_at DESC);

-- 4. Unread Notifications Partial Index
-- Accelerates real-time unread alert badge counts and notification drawer streams.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
ON public.notifications (recipient_id, created_at DESC)
WHERE read_at IS NULL;
