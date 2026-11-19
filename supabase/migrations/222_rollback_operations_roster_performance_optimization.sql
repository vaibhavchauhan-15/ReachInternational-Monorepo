-- Rollback Migration 222: Operations Roster Performance Optimization
DROP FUNCTION IF EXISTS public.save_machine_roster_atomic(UUID, JSONB, UUID[], BOOLEAN, UUID);
