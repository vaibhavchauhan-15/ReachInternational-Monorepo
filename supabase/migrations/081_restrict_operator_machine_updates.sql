-- ==============================================================================
-- Migration 081: Restrict Operator Machine Updates
-- Security Fix: REV-H03 (CWE-284) — Prevent operators from modifying static machine specs,
-- financial hourly rates, client assignments, or personnel assignments.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Restrictions applying to both supervisor and operator
  IF (public.current_user_role() IN ('supervisor', 'operator')) THEN
    -- Check machine_id
    IF (OLD.machine_id IS DISTINCT FROM NEW.machine_id) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine ID.'
        USING ERRCODE = '42501';
    END IF;

    -- Check model
    IF (OLD.model IS DISTINCT FROM NEW.model) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Model.'
        USING ERRCODE = '42501';
    END IF;

    -- Check serial_number
    IF (OLD.serial_number IS DISTINCT FROM NEW.serial_number) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Serial Number.'
        USING ERRCODE = '42501';
    END IF;

    -- Check year_of_mfg
    IF (OLD.year_of_mfg IS DISTINCT FROM NEW.year_of_mfg) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Year of Manufacture.'
        USING ERRCODE = '42501';
    END IF;

    -- Check manufacturer
    IF (OLD.manufacturer IS DISTINCT FROM NEW.manufacturer) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Manufacturer.'
        USING ERRCODE = '42501';
    END IF;

    -- Check client assignment
    IF (OLD.client_id IS DISTINCT FROM NEW.client_id) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Client Assignment.'
        USING ERRCODE = '42501';
    END IF;

    -- Check supervisor assignments
    IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id OR OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change or unassign Machine Supervisors.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Additional strict restrictions applying to operator
  IF (public.current_user_role() = 'operator') THEN
    -- Check operator assignment alterations
    IF (OLD.operator_ids IS DISTINCT FROM NEW.operator_ids OR OLD.current_operator_id IS DISTINCT FROM NEW.current_operator_id) THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.'
        USING ERRCODE = '42501';
    END IF;

    -- Check financial hourly rate alterations
    IF (OLD.hourly_rate IS DISTINCT FROM NEW.hourly_rate) THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Hourly Rate.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached and active
DROP TRIGGER IF EXISTS trg_enforce_supervisor_machine_update_restrictions ON public.machines;
CREATE TRIGGER trg_enforce_supervisor_machine_update_restrictions
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supervisor_machine_update_restrictions();
