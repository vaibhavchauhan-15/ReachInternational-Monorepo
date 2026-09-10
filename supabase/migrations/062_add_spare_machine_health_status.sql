-- ==============================================================================
-- Migration 062: Add 'spare' to machines_health_status_check constraint
-- Represents a machine that is rented, fully operational, but currently idle at the client site.
-- ==============================================================================

-- 1. Drop the existing health status check constraint
ALTER TABLE public.machines
  DROP CONSTRAINT IF EXISTS machines_health_status_check;

-- 2. Re-create the check constraint with 'spare' added to ('active', 'under_maintenance', 'breakdown', 'spare')
ALTER TABLE public.machines
  ADD CONSTRAINT machines_health_status_check
  CHECK (health_status IN ('active', 'under_maintenance', 'breakdown', 'spare'));

-- 3. Comment explaining the health status values
COMMENT ON COLUMN public.machines.health_status IS 
  'Machine physical and operational condition: active (healthy and in operation), under_maintenance (routine service or repairs), breakdown (unplanned stoppage), spare (rented, fully operational, but currently idle on client site standby).';
