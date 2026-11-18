-- Rollback Migration 205: User Detail Supervisor Machines and Operators RPC Optimization
DROP FUNCTION IF EXISTS public.get_user_summary_kpis(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_supervisor_operators(UUID);
DROP FUNCTION IF EXISTS public.get_user_assigned_machines(UUID, TEXT);
