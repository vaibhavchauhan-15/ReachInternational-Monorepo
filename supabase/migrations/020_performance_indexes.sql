-- ==============================================================================
-- MIGRATION: 020_performance_indexes.sql
-- PURPOSE: High-Performance Composite & Partial Indexes for Operational Queries
-- ==============================================================================

-- 1. Machine Fleet Status & Health Compound Index
-- Accelerates combined status and health_status filter queries on /machines.
CREATE INDEX IF NOT EXISTS idx_machines_status_health
ON public.machines (status, health_status);

-- 2. Operator Assigned Machine Lookup Index
-- Accelerates finding active machine assigned to an operator on daily log entry (/operations?tab=entry).
CREATE INDEX IF NOT EXISTS idx_machines_operator_active
ON public.machines (current_operator_id)
WHERE current_operator_id IS NOT NULL;

-- 3. Supervisor Hour Log History Index
-- Accelerates supervisor operations hub log stream queries ordered chronologically.
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_supervisor_date
ON public.machine_hour_logs (supervisor_id, log_date DESC);

-- 4. Entity-Specific Audit Trail Index
-- Accelerates modal inspection of entity history in chronological order.
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
ON public.audit_logs (entity_type, entity_id, created_at DESC);

