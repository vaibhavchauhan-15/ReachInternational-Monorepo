-- Migration 115: Add Bank Details and Bank Document Types to User Registration
-- Enables capturing bank account number, IFSC code, and supporting documents (passbook/cheque/statement)
-- Updates salary check constraint so operator self-registration does not enforce salary (managed by Admin & HR)

-- 1. Register bank document types in user_document_types table
INSERT INTO public.user_document_types (code, label, visibility, allowed_mime_types, max_size_bytes)
VALUES 
  ('bank_document', 'Bank Document (Passbook / Cheque / Statement)', 'private', 
   ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], 
   2097152),
  ('bank_passbook', 'Bank Passbook / Cheque', 'private', 
   ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], 
   2097152)
ON CONFLICT (code) DO NOTHING;

-- 2. Relax users_operator_monthly_salary_check constraint
-- Operator salary is entered and edited exclusively by Admin and HR; self-registration users have NULL salary
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_operator_monthly_salary_check;
ALTER TABLE public.users ADD CONSTRAINT users_operator_monthly_salary_check
  CHECK (monthly_salary IS NULL OR monthly_salary >= 0);

-- 3. Ensure bank columns exist on public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'bank_account_number'
  ) THEN
    ALTER TABLE public.users ADD COLUMN bank_account_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'bank_ifsc_code'
  ) THEN
    ALTER TABLE public.users ADD COLUMN bank_ifsc_code text;
  END IF;
END $$;

-- 4. Create partial index on bank_account_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_bank_account_number 
  ON public.users (bank_account_number) 
  WHERE (bank_account_number IS NOT NULL AND bank_account_number <> '');

-- 5. Update handle_new_user() trigger function to extract and record bank details
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
     AND v_aadhaar IS NOT NULL AND btrim(v_aadhaar) <> '' THEN
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
    complete_profile = EXCLUDED.complete_profile;

  -- Record initial supervisor in junction table
  IF v_supervisor_id IS NOT NULL THEN
    INSERT INTO public.user_supervisors (user_id, supervisor_id)
    VALUES (NEW.id, v_supervisor_id)
    ON CONFLICT (user_id, supervisor_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
