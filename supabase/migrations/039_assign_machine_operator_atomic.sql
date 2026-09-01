-- ==============================================================================
-- Migration 039: Atomic RPC function for Assigning Machine Operator
-- Assigns an operator to a machine, automatically unassigns them from any other machine,
-- and records structured audit log in one atomic transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.assign_machine_operator_atomic(
  p_machine_id UUID,
  p_operator_id UUID DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous_operator_id UUID;
  v_machine_code TEXT;
  v_operator_name TEXT := NULL;
  v_assigned_by_user_id UUID;
  v_audit_meta JSONB;
BEGIN
  -- 1. Validate Target Machine Exists
  SELECT machine_id, current_operator_id
  INTO v_machine_code, v_previous_operator_id
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target machine not found.');
  END IF;

  -- 2. Validate Operator Exists & Is Active (if operator_id is provided)
  IF p_operator_id IS NOT NULL THEN
    SELECT full_name
    INTO v_operator_name
    FROM public.users
    WHERE id = p_operator_id AND role = 'operator' AND status = 'active';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Selected operator is not active or does not exist.');
    END IF;

    -- 3. Clear this operator from any other machine they are currently assigned to (1:1 mapping)
    UPDATE public.machines
    SET
      current_operator_id = NULL,
      updated_at = NOW()
    WHERE current_operator_id = p_operator_id
      AND id <> p_machine_id;
  END IF;

  -- 4. Update Target Machine with new operator
  UPDATE public.machines
  SET
    current_operator_id = p_operator_id,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 5. Record Audit Log Entry Atomically
  v_assigned_by_user_id := COALESCE(p_assigned_by, auth.uid());
  v_audit_meta := jsonb_build_object(
    'machineId', p_machine_id,
    'machineCode', v_machine_code,
    'operatorId', p_operator_id,
    'operatorName', v_operator_name,
    'previousOperatorId', v_previous_operator_id
  );

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    details,
    created_at
  )
  VALUES (
    v_assigned_by_user_id,
    'machine.operator_assigned',
    'machine',
    p_machine_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'machineId', p_machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator_name
  );
END;
$$;
