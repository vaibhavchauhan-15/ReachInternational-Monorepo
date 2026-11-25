-- ==============================================================================
-- Rollback for Migration 214: User Detail Supervisor Machines and Operators RPC Optimization
-- Target Database: Reach International Production (dhbbgfzbyatzvqafnsqp)
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.get_user_summary_kpis(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_supervisor_operators(UUID);
DROP FUNCTION IF EXISTS public.get_user_assigned_machines(UUID, TEXT);

COMMIT;

NOTIFY pgrst, 'reload schema';
