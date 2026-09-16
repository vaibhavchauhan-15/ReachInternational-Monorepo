-- ==============================================================================
-- Migration 075: Operations PostgreSQL Database Optimization
-- Purpose: Optimize PostgreSQL query execution plans based on empirical
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE) benchmarks across major access patterns:
-- 1. machine_id + date (UI list, export, history continuity)
-- 2. client_id + date (UI list, export, recent client)
-- 3. operator_id + date (UI list, export, operator history)
-- 4. operator_machine_assignments (active roster, machine & operator history)
-- 5. machines (created_at default directory sorting)
-- 6. audit_logs (entity_id log detail audit inspection)
-- ==============================================================================

-- 1. Replace 2-column indexes with 4-column composite indexes on machine_hour_logs
-- Drops redundant prefixes and creates index aligned with (log_date DESC, created_at DESC, id DESC)
DROP INDEX IF EXISTS public.idx_machine_hour_logs_machine_date;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_client_date;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_operator_date;

CREATE INDEX IF NOT EXISTS idx_mhl_machine_date_created 
ON public.machine_hour_logs (machine_id, log_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_mhl_client_date_created 
ON public.machine_hour_logs (client_id, log_date DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_mhl_operator_date_created 
ON public.machine_hour_logs (operator_id, log_date DESC, created_at DESC, id DESC);

-- 2. Operator Machine Assignments: Eliminate sequential scans and quicksorts
CREATE INDEX IF NOT EXISTS idx_oma_active_assigned 
ON public.operator_machine_assignments (assigned_at DESC) 
WHERE (is_active = true AND ended_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_oma_machine_assigned_at 
ON public.operator_machine_assignments (machine_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_oma_operator_assigned_at 
ON public.operator_machine_assignments (operator_id, assigned_at DESC);

-- 3. Machines Directory: Index created_at DESC, id DESC to eliminate quicksort on default directory listing
CREATE INDEX IF NOT EXISTS idx_machines_created_at_desc 
ON public.machines (created_at DESC, id DESC);

-- 4. Audit Logs: Accelerate log detail audit trail from 71.6ms to < 0.1ms
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_created 
ON public.audit_logs (entity_id, created_at DESC);

-- 5. Refresh query planner statistics
ANALYZE public.machine_hour_logs;
ANALYZE public.operator_machine_assignments;
ANALYZE public.machines;
ANALYZE public.audit_logs;
