-- ==============================================================================
-- Migration 104: Fix Machine Operator & Supervisor Assignment Auto-Sync
-- 1. Updates public.sync_machine_personnel_arrays trigger function on public.machines:
--    - When operator_ids or supervisor_ids arrays are updated, they are authoritative.
--    - Prevents old current_operator_id or current_supervisor_id from prepending back.
--    - Automatically sets current_operator_id to operator_ids[1] (or NULL when empty).
--    - Automatically sets current_supervisor_id to supervisor_ids[1] (or NULL when empty).
-- 2. Adds public.sync_machine_operator_assignments_on_update trigger on public.machines:
--    - Deactivates assignments in public.operator_machine_assignments for operators
--      removed from machines.operator_ids.
-- 3. Cleans up any existing orphaned active assignments in public.operator_machine_assignments.
-- ==============================================================================

-- 1. Update sync_machine_personnel_arrays trigger function
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

  -- Remove duplicate and null UUIDs from arrays preserving order
  SELECT COALESCE(array_agg(elem), '{}')
  INTO NEW.supervisor_ids
  FROM (
    SELECT DISTINCT ON (elem) elem, ord
    FROM unnest(NEW.supervisor_ids) WITH ORDINALITY AS t(elem, ord)
    WHERE elem IS NOT NULL
    ORDER BY elem, ord
  ) s;

  SELECT COALESCE(array_agg(elem), '{}')
  INTO NEW.operator_ids
  FROM (
    SELECT DISTINCT ON (elem) elem, ord
    FROM unnest(NEW.operator_ids) WITH ORDINALITY AS t(elem, ord)
    WHERE elem IS NOT NULL
    ORDER BY elem, ord
  ) s;

  -- Handle single IDs:
  -- Only when arrays are completely empty and a single ID was passed on INSERT
  -- or single ID explicitly changed without updating array on UPDATE
  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.supervisor_ids) = 0 AND NEW.current_supervisor_id IS NOT NULL THEN
      NEW.supervisor_ids := ARRAY[NEW.current_supervisor_id];
    END IF;
    IF cardinality(NEW.operator_ids) = 0 AND NEW.current_operator_id IS NOT NULL THEN
      NEW.operator_ids := ARRAY[NEW.current_operator_id];
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If array was NOT updated, but single ID was updated, reflect it in the array
    IF NEW.supervisor_ids = OLD.supervisor_ids AND NEW.current_supervisor_id IS DISTINCT FROM OLD.current_supervisor_id THEN
      IF NEW.current_supervisor_id IS NOT NULL THEN
        NEW.supervisor_ids := ARRAY[NEW.current_supervisor_id];
      ELSE
        NEW.supervisor_ids := '{}';
      END IF;
    END IF;

    IF NEW.operator_ids = OLD.operator_ids AND NEW.current_operator_id IS DISTINCT FROM OLD.current_operator_id THEN
      IF NEW.current_operator_id IS NOT NULL THEN
        NEW.operator_ids := ARRAY[NEW.current_operator_id];
      ELSE
        NEW.operator_ids := '{}';
      END IF;
    END IF;
  END IF;

  -- Authoritatively synchronize current single-lookup columns to match the array
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

-- 2. Trigger on machines to synchronize operator_machine_assignments on operator removal
CREATE OR REPLACE FUNCTION public.sync_machine_operator_assignments_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Prevent recursive loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- When operator_ids changes on the machine, deactivate any active assignments for removed operators
  IF NEW.operator_ids IS DISTINCT FROM OLD.operator_ids THEN
    IF cardinality(NEW.operator_ids) = 0 THEN
      -- All operators removed from this machine
      UPDATE public.operator_machine_assignments
      SET is_active = false,
          ended_at = NOW(),
          end_reason = 'removed',
          updated_at = NOW()
      WHERE machine_id = NEW.id
        AND is_active = true;
    ELSE
      -- Deactivate assignments for operators no longer in NEW.operator_ids
      UPDATE public.operator_machine_assignments
      SET is_active = false,
          ended_at = NOW(),
          end_reason = 'removed',
          updated_at = NOW()
      WHERE machine_id = NEW.id
        AND is_active = true
        AND NOT (operator_id = ANY(NEW.operator_ids));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_machine_operator_assignments_on_update ON public.machines;
CREATE TRIGGER trg_sync_machine_operator_assignments_on_update
  AFTER UPDATE OF operator_ids ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_machine_operator_assignments_on_update();

-- 3. One-time backfill/clean up of existing orphaned active assignments
UPDATE public.operator_machine_assignments oma
SET is_active = false,
    ended_at = NOW(),
    end_reason = 'removed',
    updated_at = NOW()
FROM public.machines m
WHERE oma.machine_id = m.id
  AND oma.is_active = true
  AND NOT (oma.operator_id = ANY(m.operator_ids));
