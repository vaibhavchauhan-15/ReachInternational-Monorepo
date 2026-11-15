-- ==============================================================================
-- Migration 198: Add machine_category to public.users & enforce operator constraint
-- ==============================================================================

-- 1. Add machine_category column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS machine_category TEXT;

COMMENT ON COLUMN public.users.machine_category IS
  'Designated machine category operated by this operator (Stacker, Reach Truck, Order Picker, Electric Pallet Truck, Forklift, Scissor Lift, Boom Lift). Strictly NULL for non-operator roles.';

-- 2. Trigger function ensuring machine_category is strictly NULL for non-operators
CREATE OR REPLACE FUNCTION public.enforce_operator_machine_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> 'operator' THEN
    NEW.machine_category := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_machine_category_role ON public.users;
CREATE TRIGGER trg_users_machine_category_role
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_operator_machine_category();

-- 3. Update handle_new_user() trigger function to capture and persist machine_category for operators
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_city TEXT;
  v_district TEXT;
  v_state TEXT;
  v_state_id SMALLINT := NULL;
  v_street TEXT;
  v_aadhaar TEXT;
  v_license TEXT;
  v_bank_account_number TEXT;
  v_bank_ifsc_code TEXT;
  v_shift_start_time TIME := NULL;
  v_shift_end_time TIME := NULL;
  v_supervisor_id UUID := NULL;
  v_machine_category TEXT := NULL;
  v_complete_profile BOOLEAN := false;
  v_parts TEXT[];
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  v_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '');

  -- Canonical non-admin signup roles: 'manager', 'supervisor', 'hr', 'operator'
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  IF v_role IS NULL OR v_role NOT IN ('manager', 'supervisor', 'hr', 'operator') THEN
    v_role := 'operator';
  END IF;

  -- Operator Machine Category (Strictly NULL for other roles)
  IF v_role = 'operator' THEN
    v_machine_category := NULLIF(NEW.raw_user_meta_data->>'machine_category', '');
  ELSE
    v_machine_category := NULL;
  END IF;

  v_city := COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), '');
  v_district := COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), '');
  v_state := COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), '');

  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'state_id', '') IS NOT NULL THEN
      v_state_id := (NEW.raw_user_meta_data->>'state_id')::SMALLINT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_state_id := NULL;
  END;

  -- Read street with backward-compatible address fallback
  v_street := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'street', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', '')
  );

  v_aadhaar := NULLIF(NEW.raw_user_meta_data->>'aadhaar_number', '');
  v_license := NULLIF(NEW.raw_user_meta_data->>'license_number', '');
  v_bank_account_number := NULLIF(NEW.raw_user_meta_data->>'bank_account_number', '');
  v_bank_ifsc_code := NULLIF(NEW.raw_user_meta_data->>'bank_ifsc_code', '');

  -- Parse supervisor_id
  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'supervisor_id', '') IS NOT NULL THEN
      v_supervisor_id := (NEW.raw_user_meta_data->>'supervisor_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_supervisor_id := NULL;
  END;

  -- Parse shift_start_time & shift_end_time
  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'shift_start_time', '') IS NOT NULL THEN
      v_shift_start_time := (NEW.raw_user_meta_data->>'shift_start_time')::TIME;
    END IF;
    IF NULLIF(NEW.raw_user_meta_data->>'shift_end_time', '') IS NOT NULL THEN
      v_shift_end_time := (NEW.raw_user_meta_data->>'shift_end_time')::TIME;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_shift_start_time := NULL;
    v_shift_end_time := NULL;
  END;

  -- Fallback from legacy shift_time string
  IF (v_shift_start_time IS NULL OR v_shift_end_time IS NULL) AND NULLIF(NEW.raw_user_meta_data->>'shift_time', '') IS NOT NULL THEN
    BEGIN
      v_parts := regexp_split_to_array(NEW.raw_user_meta_data->>'shift_time', '\s*[-–—]\s*');
      IF array_length(v_parts, 1) = 2 THEN
        IF v_shift_start_time IS NULL THEN v_shift_start_time := v_parts[1]::TIME; END IF;
        IF v_shift_end_time IS NULL THEN v_shift_end_time := v_parts[2]::TIME; END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Evaluate profile completeness boolean
  IF btrim(v_full_name) <> ''
     AND v_full_name <> NEW.email
     AND btrim(v_phone) <> ''
     AND btrim(v_city) <> ''
     AND btrim(v_district) <> ''
     AND btrim(v_state) <> ''
     AND v_street IS NOT NULL AND btrim(v_street) <> ''
     AND v_shift_start_time IS NOT NULL
     AND v_shift_end_time IS NOT NULL
     AND v_aadhaar IS NOT NULL AND btrim(v_aadhaar) <> ''
     AND (v_role <> 'operator' OR (v_machine_category IS NOT NULL AND btrim(v_machine_category) <> '')) THEN
    v_complete_profile := true;
  ELSE
    v_complete_profile := false;
  END IF;

  INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    city,
    district,
    state,
    state_id,
    street,
    aadhaar_number,
    license_number,
    bank_account_number,
    bank_ifsc_code,
    shift_start_time,
    shift_end_time,
    supervisor_id,
    machine_category,
    complete_profile
  )
  VALUES (
    NEW.id,
    v_full_name,
    COALESCE(NEW.email, ''),
    v_phone,
    v_role,
    'pending',
    v_city,
    v_district,
    v_state,
    v_state_id,
    v_street,
    v_aadhaar,
    v_license,
    v_bank_account_number,
    v_bank_ifsc_code,
    v_shift_start_time,
    v_shift_end_time,
    v_supervisor_id,
    v_machine_category,
    v_complete_profile
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_id = EXCLUDED.state_id,
    street = EXCLUDED.street,
    aadhaar_number = EXCLUDED.aadhaar_number,
    license_number = EXCLUDED.license_number,
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, users.bank_account_number),
    bank_ifsc_code = COALESCE(EXCLUDED.bank_ifsc_code, users.bank_ifsc_code),
    shift_start_time = EXCLUDED.shift_start_time,
    shift_end_time = EXCLUDED.shift_end_time,
    supervisor_id = EXCLUDED.supervisor_id,
    machine_category = EXCLUDED.machine_category,
    complete_profile = EXCLUDED.complete_profile;

  -- Record initial supervisor in junction table
  IF v_supervisor_id IS NOT NULL THEN
    INSERT INTO public.user_supervisors (user_id, supervisor_id)
    VALUES (NEW.id, v_supervisor_id)
    ON CONFLICT (user_id, supervisor_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Update approve_profile_change_request_atomic to support machine_category
CREATE OR REPLACE FUNCTION public.approve_profile_change_request_atomic(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_request RECORD;
  v_req_data JSONB;
  v_target_user_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can review profile change requests.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  SELECT * INTO v_request
  FROM public.profile_change_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile change request not found.');
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Request is no longer pending (current status: %s).', v_request.status));
  END IF;

  IF v_caller_role = 'super_admin' THEN
    -- Super admin can approve all
  ELSIF v_caller_role = 'admin' THEN
    IF v_request.requester_role IN ('super_admin', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admins can approve profile changes for Admin accounts.');
    END IF;
  ELSIF v_caller_role IN ('manager', 'hr') THEN
    IF v_request.requester_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied. You do not have authorization to approve profile changes for this role.');
    END IF;
  END IF;

  v_target_user_id := v_request.user_id;
  v_req_data := v_request.requested_data;

  UPDATE public.profile_change_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  UPDATE public.users
  SET
    full_name = COALESCE(v_req_data->>'full_name', full_name),
    phone = CASE WHEN v_req_data ? 'phone' THEN NULLIF(v_req_data->>'phone', '') ELSE phone END,
    street = CASE WHEN v_req_data ? 'street' THEN NULLIF(v_req_data->>'street', '')
                  WHEN v_req_data ? 'address' THEN NULLIF(v_req_data->>'address', '')
                  ELSE street END,
    city = COALESCE(v_req_data->>'city', city),
    district = COALESCE(v_req_data->>'district', district),
    state = COALESCE(v_req_data->>'state', state),
    state_id = CASE WHEN (v_req_data ? 'state_id') AND (v_req_data->>'state_id') IS NOT NULL AND (v_req_data->>'state_id') <> ''
                    THEN (v_req_data->>'state_id')::INT ELSE state_id END,
    aadhaar_number = CASE WHEN v_req_data ? 'aadhaar_number' THEN NULLIF(v_req_data->>'aadhaar_number', '') ELSE aadhaar_number END,
    license_number = CASE WHEN v_req_data ? 'license_number' THEN NULLIF(v_req_data->>'license_number', '') ELSE license_number END,
    bank_account_number = CASE WHEN v_req_data ? 'bank_account_number' THEN NULLIF(v_req_data->>'bank_account_number', '') ELSE bank_account_number END,
    bank_ifsc_code = CASE WHEN v_req_data ? 'bank_ifsc_code' THEN NULLIF(v_req_data->>'bank_ifsc_code', '') ELSE bank_ifsc_code END,
    shift_start_time = CASE WHEN v_req_data ? 'shift_start_time' THEN (v_req_data->>'shift_start_time')::TIME ELSE shift_start_time END,
    shift_end_time = CASE WHEN v_req_data ? 'shift_end_time' THEN (v_req_data->>'shift_end_time')::TIME ELSE shift_end_time END,
    machine_category = CASE
      WHEN role = 'operator' AND (v_req_data ? 'machine_category') THEN NULLIF(v_req_data->>'machine_category', '')
      WHEN role <> 'operator' THEN NULL
      ELSE machine_category
    END,
    updated_at = NOW()
  WHERE id = v_target_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    metadata,
    created_at
  ) VALUES (
    v_caller_id,
    'profile.approved',
    'profile_change_request',
    p_request_id::text,
    to_jsonb(format('Profile change request for user %s approved by %s', v_target_user_id, v_caller_name)),
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_target_user_id,
      'reviewed_by_id', v_caller_id,
      'reviewed_by_name', v_caller_name,
      'reviewed_by_role', v_caller_role,
      'requested_data', v_req_data
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile changes have been approved and applied.',
    'request_id', p_request_id,
    'user_id', v_target_user_id
  );
END;
$function$;
