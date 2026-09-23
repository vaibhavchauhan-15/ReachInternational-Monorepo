-- ==============================================================================
-- Migration 100: User Table Optimization, Supervisors Junction Table & Schema Restructuring
--
-- 1. Creates public.user_supervisors junction table for scalable M:N supervisor relations.
-- 2. Backfills all supervisor assignments from supervisor_ids and supervisor_id.
-- 3. Drops redundant supervisor_ids UUID[] column and trg_sync_user_supervisor_array trigger.
-- 4. Preserves supervisor_id UUID as canonical primary supervisor foreign key on users.
-- 5. Standardizes address handling on street column.
-- 6. Adds monthly_salary NUMERIC(10, 2) column with operator mandatory constraint.
-- 7. Drops obsolete shift_time text column in favor of shift_start_time & shift_end_time.
-- 8. Converts complete_profile from TEXT ('yes'/'no') to BOOLEAN (default false).
-- 9. Enhances public.user_documents with file_name and status.
-- 10. Prunes 10 overlapping/wasteful indexes (trigrams on Aadhaar/License/State/District/Role, duplicate unique constraints).
-- 11. Updates handle_new_user() and complete_user_onboarding_atomic() stored procedures.
-- 12. Updates users_select_supervisor_scoped RLS policy with optimized subqueries.
-- ==============================================================================

-- ============================================================
-- 1. JUNCTION TABLE: user_supervisors
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_supervisors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  supervisor_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, supervisor_id)
);

COMMENT ON TABLE public.user_supervisors IS
  'Junction table mapping operators/users to their assigned supervisors. Supports 1:N and M:N relationships.';

-- Indexes on foreign keys for 10-100x faster JOINs and CASCADE operations
CREATE INDEX IF NOT EXISTS idx_user_supervisors_user_id ON public.user_supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_supervisors_supervisor_id ON public.user_supervisors(supervisor_id);

-- RLS on user_supervisors
ALTER TABLE public.user_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_supervisors_select" ON public.user_supervisors;
CREATE POLICY "user_supervisors_select"
  ON public.user_supervisors
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR supervisor_id = (SELECT auth.uid())
    OR ((SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr'))
  );

DROP POLICY IF EXISTS "user_supervisors_manage" ON public.user_supervisors;
CREATE POLICY "user_supervisors_manage"
  ON public.user_supervisors
  FOR ALL
  TO authenticated
  USING (
    ((SELECT public.current_user_role()) IN ('super_admin', 'admin', 'hr'))
  )
  WITH CHECK (
    ((SELECT public.current_user_role()) IN ('super_admin', 'admin', 'hr'))
  );

-- ============================================================
-- 2. BACKFILL user_supervisors FROM EXISTING ASSIGNMENTS
-- ============================================================

-- Backfill from supervisor_ids array if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'supervisor_ids'
  ) THEN
    INSERT INTO public.user_supervisors (user_id, supervisor_id)
    SELECT u.id, unnest(u.supervisor_ids)
    FROM public.users u
    WHERE u.supervisor_ids IS NOT NULL AND cardinality(u.supervisor_ids) > 0
    ON CONFLICT (user_id, supervisor_id) DO NOTHING;
  END IF;
END $$;

-- Backfill from single supervisor_id column
INSERT INTO public.user_supervisors (user_id, supervisor_id)
SELECT u.id, u.supervisor_id
FROM public.users u
WHERE u.supervisor_id IS NOT NULL
ON CONFLICT (user_id, supervisor_id) DO NOTHING;

-- ============================================================
-- 3. DROP SYNC TRIGGER & REMOVE supervisor_ids COLUMN
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_user_supervisor_array ON public.users;
DROP FUNCTION IF EXISTS public.sync_user_supervisor_array();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'supervisor_ids'
  ) THEN
    ALTER TABLE public.users DROP COLUMN supervisor_ids CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. ADD monthly_salary COLUMN & BACKFILL FOR OPERATORS
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN public.users.monthly_salary IS
  'Monthly base compensation in INR (₹). Mandatory for active operators.';

-- Backfill existing operators with daily_rate * 26 (standard working days in a month)
UPDATE public.users
SET monthly_salary = ROUND(daily_rate * 26, 2)
WHERE role = 'operator'
  AND (monthly_salary IS NULL OR monthly_salary = 0)
  AND daily_rate > 0;

-- Set default 0 for operators with 0 daily_rate so constraint holds
UPDATE public.users
SET monthly_salary = 0
WHERE role = 'operator' AND monthly_salary IS NULL;

-- Enforce check constraint: active operators must have monthly_salary specified
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_operator_monthly_salary_check;
ALTER TABLE public.users ADD CONSTRAINT users_operator_monthly_salary_check
  CHECK (role <> 'operator' OR status = 'pending' OR (monthly_salary IS NOT NULL AND monthly_salary >= 0));

-- ============================================================
-- 5. POPULATE SHIFT TIME COLUMNS & DROP shift_time TEXT
-- ============================================================

-- Backfill shift_start_time and shift_end_time from shift_time if null
DO $$
DECLARE
  r RECORD;
  v_parts TEXT[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'shift_time'
  ) THEN
    FOR r IN SELECT id, shift_time FROM public.users WHERE shift_time IS NOT NULL AND (shift_start_time IS NULL OR shift_end_time IS NULL) LOOP
      BEGIN
        v_parts := regexp_split_to_array(r.shift_time, '\s*[-–—]\s*');
        IF array_length(v_parts, 1) = 2 THEN
          UPDATE public.users
          SET
            shift_start_time = COALESCE(shift_start_time, v_parts[1]::TIME),
            shift_end_time = COALESCE(shift_end_time, v_parts[2]::TIME)
          WHERE id = r.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;

    ALTER TABLE public.users DROP COLUMN shift_time CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. CONVERT complete_profile FROM TEXT TO BOOLEAN
-- ============================================================

DO $$
BEGIN
  -- Check if complete_profile is currently text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'complete_profile' AND data_type = 'text'
  ) THEN
    DROP INDEX IF EXISTS public.idx_users_incomplete_profile;
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_complete_profile_check;
    ALTER TABLE public.users ALTER COLUMN complete_profile DROP DEFAULT;
    ALTER TABLE public.users ALTER COLUMN complete_profile TYPE boolean USING (complete_profile = 'yes');
    ALTER TABLE public.users ALTER COLUMN complete_profile SET DEFAULT false;
    ALTER TABLE public.users ALTER COLUMN complete_profile SET NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 7. ENHANCE user_documents TABLE
-- ============================================================

ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS file_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'verified';

ALTER TABLE public.user_documents DROP CONSTRAINT IF EXISTS user_documents_status_check;
ALTER TABLE public.user_documents ADD CONSTRAINT user_documents_status_check
  CHECK (status IN ('pending', 'verified', 'rejected'));

-- ============================================================
-- 8. PRUNE REDUNDANT & OVERLAPPING INDEXES ON users
-- ============================================================

-- Drop redundant constraints that duplicate canonical functional unique indexes
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_unique;

-- Canonical unique indexes with trimming/lowercase normalization
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON public.users USING btree (lower(btrim(email)));

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON public.users USING btree (btrim(phone))
  WHERE (phone IS NOT NULL AND btrim(phone) <> '');

-- Drop redundant/overlapping B-tree indexes
DROP INDEX IF EXISTS public.idx_users_status;
DROP INDEX IF EXISTS public.users_state_exact_idx;
DROP INDEX IF EXISTS public.idx_users_supervisor_ids;
DROP INDEX IF EXISTS public.idx_users_role_supervisor_id;

-- Drop wasteful GIN trigram indexes
DROP INDEX IF EXISTS public.users_aadhaar_number_trgm_idx;
DROP INDEX IF EXISTS public.users_license_number_trgm_idx;
DROP INDEX IF EXISTS public.users_role_trgm_idx;
DROP INDEX IF EXISTS public.users_state_trgm_idx;
DROP INDEX IF EXISTS public.users_district_trgm_idx;

-- Clean partial index on complete_profile = false
DROP INDEX IF EXISTS public.idx_users_incomplete_profile;
CREATE INDEX IF NOT EXISTS idx_users_incomplete_profile
  ON public.users USING btree (complete_profile)
  WHERE (complete_profile = false);

-- Clean partial indexes on Aadhaar & Licence (exact B-tree lookups)
DROP INDEX IF EXISTS public.idx_users_aadhaar_number;
CREATE INDEX IF NOT EXISTS idx_users_aadhaar_number
  ON public.users USING btree (aadhaar_number)
  WHERE (aadhaar_number IS NOT NULL);

DROP INDEX IF EXISTS public.idx_users_license_number;
CREATE INDEX IF NOT EXISTS idx_users_license_number
  ON public.users USING btree (license_number)
  WHERE (license_number IS NOT NULL);

-- Clean index on supervisor_id
DROP INDEX IF EXISTS public.idx_users_supervisor_id;
CREATE INDEX IF NOT EXISTS idx_users_supervisor_id
  ON public.users USING btree (supervisor_id)
  WHERE (supervisor_id IS NOT NULL);

-- ============================================================
-- 9. UPDATE handle_new_user() TRIGGER FUNCTION
-- ============================================================

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

-- ============================================================
-- 10. UPDATE complete_user_onboarding_atomic() RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_user_onboarding_atomic(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_shift_time TEXT,
  p_address TEXT,
  p_city TEXT,
  p_district TEXT,
  p_state TEXT,
  p_state_id INTEGER DEFAULT NULL::INTEGER,
  p_aadhaar_number TEXT DEFAULT NULL::TEXT,
  p_license_number TEXT DEFAULT NULL::TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_clean_aadhaar TEXT;
  v_clean_phone TEXT;
  v_clean_name TEXT;
  v_street TEXT;
  v_shift_start_time TIME := NULL;
  v_shift_end_time TIME := NULL;
  v_parts TEXT[];
  v_updated_user RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Only self or administrators can complete onboarding for a user
  IF v_caller_id <> p_user_id AND public.current_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized to complete onboarding for this user.' USING ERRCODE = '42501';
  END IF;

  v_clean_name := btrim(COALESCE(p_full_name, ''));
  v_clean_phone := btrim(COALESCE(p_phone, ''));
  v_clean_aadhaar := regexp_replace(COALESCE(p_aadhaar_number, ''), '\D', '', 'g');
  v_street := NULLIF(btrim(p_address), '');

  IF length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Full name is required (minimum 2 characters).' USING ERRCODE = '23514';
  END IF;

  IF length(v_clean_phone) < 10 THEN
    RAISE EXCEPTION 'Valid 10-digit mobile phone number is required.' USING ERRCODE = '23514';
  END IF;

  IF btrim(COALESCE(p_city, '')) = '' OR btrim(COALESCE(p_district, '')) = '' OR btrim(COALESCE(p_state, '')) = '' THEN
    RAISE EXCEPTION 'Work location (City, District, State) is required.' USING ERRCODE = '23514';
  END IF;

  IF length(v_clean_aadhaar) <> 12 THEN
    RAISE EXCEPTION 'Valid 12-digit Aadhaar number is required.' USING ERRCODE = '23514';
  END IF;

  -- Parse shift times from p_shift_time
  IF p_shift_time IS NOT NULL AND btrim(p_shift_time) <> '' THEN
    BEGIN
      v_parts := regexp_split_to_array(p_shift_time, '\s*[-–—]\s*');
      IF array_length(v_parts, 1) = 2 THEN
        v_shift_start_time := v_parts[1]::TIME;
        v_shift_end_time := v_parts[2]::TIME;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  UPDATE public.users
  SET
    full_name = v_clean_name,
    phone = v_clean_phone,
    role = COALESCE(NULLIF(btrim(p_role), ''), public.users.role),
    street = v_street,
    city = btrim(p_city),
    district = btrim(p_district),
    state = btrim(p_state),
    state_id = p_state_id::SMALLINT,
    aadhaar_number = v_clean_aadhaar,
    license_number = NULLIF(btrim(p_license_number), ''),
    shift_start_time = COALESCE(v_shift_start_time, public.users.shift_start_time),
    shift_end_time = COALESCE(v_shift_end_time, public.users.shift_end_time),
    complete_profile = true,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Structured audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    details,
    created_at
  ) VALUES (
    v_caller_id,
    'user.onboarding_completed',
    'users',
    p_user_id,
    jsonb_build_object(
      'complete_profile', true,
      'role', v_updated_user.role,
      'state', v_updated_user.state,
      'street', v_updated_user.street
    ),
    jsonb_build_object(
      'message', 'User completed required profile details on onboarding screen',
      'complete_profile', true
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_updated_user.id,
    'complete_profile', v_updated_user.complete_profile,
    'role', v_updated_user.role
  );
END;
$$;

-- ============================================================
-- 11. UPDATE users_select_supervisor_scoped RLS POLICY
-- ============================================================

DROP POLICY IF EXISTS "users_select_supervisor_scoped" ON public.users;
CREATE POLICY "users_select_supervisor_scoped"
  ON public.users
  FOR SELECT
  TO public
  USING (
    ((SELECT public.current_user_role()) = 'supervisor')
    AND (role = 'operator')
    AND (
      (supervisor_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.user_supervisors us
        WHERE us.user_id = users.id
          AND us.supervisor_id = (SELECT auth.uid())
      )
    )
  );
