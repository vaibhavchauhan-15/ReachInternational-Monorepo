-- ==============================================================================
-- Migration 043: Support Multiple Supervisors & Operators per Machine (24h Shifts)
-- Adds supervisor_ids UUID[] and operator_ids UUID[] columns to public.machines,
-- backfills from current_supervisor_id and current_operator_id, creates GIN indexes,
-- and configures sync triggers and RLS policies for multi-shift operations.
-- ==============================================================================

-- 1. Add array columns to public.machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS supervisor_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operator_ids UUID[] DEFAULT '{}';

-- 2. Backfill supervisor_ids and operator_ids from current single-assignment columns
UPDATE public.machines
SET supervisor_ids = ARRAY[current_supervisor_id]
WHERE current_supervisor_id IS NOT NULL
  AND (supervisor_ids IS NULL OR cardinality(supervisor_ids) = 0);

UPDATE public.machines
SET operator_ids = ARRAY[current_operator_id]
WHERE current_operator_id IS NOT NULL
  AND (operator_ids IS NULL OR cardinality(operator_ids) = 0);

-- 3. Create high-performance GIN indexes for array containment lookups
CREATE INDEX IF NOT EXISTS idx_machines_supervisor_ids ON public.machines USING GIN (supervisor_ids);
CREATE INDEX IF NOT EXISTS idx_machines_operator_ids ON public.machines USING GIN (operator_ids);

-- 4. Trigger function to auto-sync primary assignee IDs with first elements of arrays
CREATE OR REPLACE FUNCTION public.sync_machine_personnel_arrays()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Normalize null arrays to empty arrays
  IF NEW.supervisor_ids IS NULL THEN
    NEW.supervisor_ids := '{}';
  END IF;

  IF NEW.operator_ids IS NULL THEN
    NEW.operator_ids := '{}';
  END IF;

  -- Remove duplicate and null UUIDs from arrays
  SELECT ARRAY(SELECT DISTINCT elem FROM unnest(NEW.supervisor_ids) AS elem WHERE elem IS NOT NULL)
  INTO NEW.supervisor_ids;

  SELECT ARRAY(SELECT DISTINCT elem FROM unnest(NEW.operator_ids) AS elem WHERE elem IS NOT NULL)
  INTO NEW.operator_ids;

  -- If single IDs were explicitly passed without arrays, add them into arrays
  IF NEW.current_supervisor_id IS NOT NULL AND NOT (NEW.current_supervisor_id = ANY(NEW.supervisor_ids)) THEN
    NEW.supervisor_ids := array_prepend(NEW.current_supervisor_id, NEW.supervisor_ids);
  END IF;

  IF NEW.current_operator_id IS NOT NULL AND NOT (NEW.current_operator_id = ANY(NEW.operator_ids)) THEN
    NEW.operator_ids := array_prepend(NEW.current_operator_id, NEW.operator_ids);
  END IF;

  -- Synchronize current single-lookup columns to primary (first) array element for backward compatibility
  IF cardinality(NEW.supervisor_ids) > 0 THEN
    NEW.current_supervisor_id := NEW.supervisor_ids[1];
  ELSE
    NEW.current_supervisor_id := NULL;
  END IF;

  IF cardinality(NEW.operator_ids) > 0 THEN
    NEW.current_operator_id := NEW.operator_ids[1];
  ELSE
    NEW.current_operator_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_machine_personnel_arrays ON public.machines;
CREATE TRIGGER trg_sync_machine_personnel_arrays
  BEFORE INSERT OR UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_machine_personnel_arrays();

-- 5. Update enforce_supervisor_machine_update_restrictions() trigger function
CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If user role is supervisor, prevent altering static machine specs & supervisor assignments
  IF (public.current_user_role() = 'supervisor') THEN
    -- Check machine_id
    IF (OLD.machine_id IS DISTINCT FROM NEW.machine_id) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine ID.'
        USING ERRCODE = '42501';
    END IF;

    -- Check model
    IF (OLD.model IS DISTINCT FROM NEW.model) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine Model.'
        USING ERRCODE = '42501';
    END IF;

    -- Check serial_number
    IF (OLD.serial_number IS DISTINCT FROM NEW.serial_number) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine Serial Number.'
        USING ERRCODE = '42501';
    END IF;

    -- Check year_of_mfg
    IF (OLD.year_of_mfg IS DISTINCT FROM NEW.year_of_mfg) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Year of Manufacture.'
        USING ERRCODE = '42501';
    END IF;

    -- Check manufacturer
    IF (OLD.manufacturer IS DISTINCT FROM NEW.manufacturer) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Manufacturer.'
        USING ERRCODE = '42501';
    END IF;

    -- Check supervisor assignments
    IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id OR OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change or unassign Machine Supervisors.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Update UPDATE RLS policy on public.machines
DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager',
      'supervisor'
    ) OR (
      public.current_user_role() = 'operator' AND (
        auth.uid() = ANY(operator_ids) OR current_operator_id = auth.uid() OR current_operator_id IS NULL OR operator_ids = '{}'
      )
    )
  )
  WITH CHECK (true);
