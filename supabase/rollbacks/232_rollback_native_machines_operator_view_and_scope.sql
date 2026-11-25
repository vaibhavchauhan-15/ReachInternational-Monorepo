-- Rollback for 232_native_machines_operator_view_and_scope.sql

BEGIN;

DROP FUNCTION IF EXISTS public.get_operator_assigned_machines(uuid);
DROP INDEX IF EXISTS public.idx_oma_operator_active_machine;

COMMIT;
