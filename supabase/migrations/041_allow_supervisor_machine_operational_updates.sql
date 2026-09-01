-- ==============================================================================
-- Migration 041: Allow Supervisor Machine Operational Updates & Lock Static Specs
-- Allows 'supervisor' role to update machine operational fields:
-- (hour_meter, health_status, status, current_operator_id, client_id)
-- while strictly forbidding changes to static specs (model, serial_number, year_of_mfg, manufacturer, machine_id)
-- and supervisor assignments (current_supervisor_id).
-- ==============================================================================

-- 1. Update UPDATE RLS Policy on public.machines to include 'supervisor'
DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager',
      'supervisor'
    ) OR (
      public.current_user_role() = 'operator' AND (current_operator_id = auth.uid() OR current_operator_id IS NULL)
    )
  )
  WITH CHECK (true);

-- 2. Trigger Function to Enforce Supervisor Field Restrictions
CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If the user updating is a supervisor, enforce that static specifications & supervisor CANNOT be modified
  IF (public.current_user_role() = 'supervisor') THEN
    -- 1. Check machine_id
    IF (OLD.machine_id IS DISTINCT FROM NEW.machine_id) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine ID.'
        USING ERRCODE = '42501';
    END IF;

    -- 2. Check model
    IF (OLD.model IS DISTINCT FROM NEW.model) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine Model.'
        USING ERRCODE = '42501';
    END IF;

    -- 3. Check serial_number
    IF (OLD.serial_number IS DISTINCT FROM NEW.serial_number) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Machine Serial Number.'
        USING ERRCODE = '42501';
    END IF;

    -- 4. Check year_of_mfg
    IF (OLD.year_of_mfg IS DISTINCT FROM NEW.year_of_mfg) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Year of Manufacture.'
        USING ERRCODE = '42501';
    END IF;

    -- 5. Check manufacturer
    IF (OLD.manufacturer IS DISTINCT FROM NEW.manufacturer) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change Manufacturer.'
        USING ERRCODE = '42501';
    END IF;

    -- 6. Check current_supervisor_id (enforced also by trg_enforce_supervisor_change_role)
    IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id) THEN
      RAISE EXCEPTION 'Unauthorized: Supervisors cannot change or unassign Machine Supervisor.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach Trigger to public.machines
DROP TRIGGER IF EXISTS trg_enforce_supervisor_machine_update_restrictions ON public.machines;
CREATE TRIGGER trg_enforce_supervisor_machine_update_restrictions
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supervisor_machine_update_restrictions();
