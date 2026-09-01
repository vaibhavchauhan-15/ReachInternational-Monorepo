-- ==============================================================================
-- MIGRATION 035: Normalize User States and Reference states(id) via state_id
-- 1. Ensure public.states table exists with primary key and B-tree index
-- 2. Add state_id SMALLINT REFERENCES public.states(id) ON DELETE SET NULL to public.users
-- 3. Normalize all misspelled, cased, and variant state entries in public.users
-- 4. Update handle_new_user() trigger function to resolve state_id automatically
-- ==============================================================================

-- 1. Ensure public.states table exists with exact schema and index
CREATE TABLE IF NOT EXISTS public.states (
  id smallint NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone ('utc'::text, now()),
  CONSTRAINT states_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_states_name ON public.states USING btree (name) TABLESPACE pg_default;

-- Clean up state 38 name if it had (State) suffix
UPDATE public.states
SET name = 'Dadra and Nagar Haveli and Daman and Diu'
WHERE id = 38 AND name LIKE '%(State)%';

-- 2. Add state_id column and index to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state_id SMALLINT REFERENCES public.states(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_state_id ON public.users(state_id);

-- 3. Data Normalization for existing records in public.users

-- 3a. Direct exact/case-insensitive match with public.states
UPDATE public.users u
SET state_id = s.id,
    state = s.name
FROM public.states s
WHERE lower(btrim(u.state)) = lower(btrim(s.name));

-- 3b. Normalize Gujarat variants ('GUJARAT', 'Gujarat', 'Gujrat', 'GUJRAT', 'Gujarati')
UPDATE public.users
SET state_id = 24,
    state = 'Gujarat'
WHERE lower(btrim(state)) IN ('gujarat', 'gujrat', 'gujrati', 'gujarati')
   OR (state_id = 24 AND state <> 'Gujarat');

-- 3c. Normalize Uttar Pradesh variants ('Up', 'UP', 'Uttar Pradesh', 'Uttar pradesh', 'Utter Pradesh', 'Uttar pardesh')
UPDATE public.users
SET state_id = 9,
    state = 'Uttar Pradesh'
WHERE lower(btrim(state)) IN ('up', 'uttar pradesh', 'utter pradesh', 'uttar pardesh')
   OR (state_id = 9 AND state <> 'Uttar Pradesh');

-- 3d. Normalize Assam variants ('Assam', 'Aasam', 'assam')
UPDATE public.users
SET state_id = 18,
    state = 'Assam'
WHERE lower(btrim(state)) IN ('assam', 'aasam')
   OR (state_id = 18 AND state <> 'Assam');

-- 3e. Normalize Bihar variants ('Bihar', 'bihar')
UPDATE public.users
SET state_id = 10,
    state = 'Bihar'
WHERE lower(btrim(state)) IN ('bihar')
   OR (state_id = 10 AND state <> 'Bihar');

-- 3f. Normalize Maharashtra variants ('Maharashtra', 'maharashtra')
UPDATE public.users
SET state_id = 27,
    state = 'Maharashtra'
WHERE lower(btrim(state)) IN ('maharashtra')
   OR (state_id = 27 AND state <> 'Maharashtra');

-- 3g. Normalize Madhya Pradesh variants ('Madhya Pradesh', 'Madhady pradesh', 'madhya pradesh', 'mp')
UPDATE public.users
SET state_id = 23,
    state = 'Madhya Pradesh'
WHERE lower(btrim(state)) IN ('madhya pradesh', 'madhady pradesh', 'mp')
   OR (state_id = 23 AND state <> 'Madhya Pradesh');

-- 3h. Normalize West Bengal variants ('West Bengal', 'west bengal')
UPDATE public.users
SET state_id = 19,
    state = 'West Bengal'
WHERE lower(btrim(state)) IN ('west bengal')
   OR (state_id = 19 AND state <> 'West Bengal');

-- 3i. Normalize Delhi variants ('Delhi', 'delhi', 'New Delhi')
UPDATE public.users
SET state_id = 7,
    state = 'Delhi'
WHERE lower(btrim(state)) IN ('delhi', 'new delhi')
   OR (state_id = 7 AND state <> 'Delhi');

-- 3j. Normalize Rajasthan variants ('Rajasthan', 'rajasthan')
UPDATE public.users
SET state_id = 8,
    state = 'Rajasthan'
WHERE lower(btrim(state)) IN ('rajasthan')
   OR (state_id = 8 AND state <> 'Rajasthan');

-- 3k. Normalize Dadra and Nagar Haveli variants
UPDATE public.users
SET state_id = 38,
    state = 'Dadra and Nagar Haveli and Daman and Diu'
WHERE lower(btrim(state)) LIKE '%dad%' OR lower(btrim(state)) LIKE '%haveli%'
   OR state_id = 38;

-- 4. Update handle_new_user() trigger function to automatically resolve state_id and normalized state
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
  v_raw_state TEXT;
  v_state_id SMALLINT := NULL;
  v_normalized_state TEXT := '';
BEGIN
  -- Extract requested role from raw_user_meta_data
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  
  -- Validate against canonical allowed self-registration roles
  IF v_role IS NULL OR v_role NOT IN (
    'manager',
    'service_manager',
    'service_engineer',
    'engineer',
    'supervisor',
    'store_manager',
    'operator',
    'mechanic',
    'hr_manager'
  ) THEN
    IF v_role IN ('admin', 'super_admin') AND (NEW.raw_user_meta_data->>'status') = 'active' THEN
      NULL;
    ELSE
      v_role := 'operator';
    END IF;
  END IF;

  v_status := COALESCE(NULLIF(NEW.raw_user_meta_data->>'status', ''), 'pending');

  -- Resolve state_id and normalized state
  IF NEW.raw_user_meta_data->>'state_id' IS NOT NULL AND (NEW.raw_user_meta_data->>'state_id') ~ '^[0-9]+$' THEN
    v_state_id := (NEW.raw_user_meta_data->>'state_id')::SMALLINT;
    SELECT name INTO v_normalized_state FROM public.states WHERE id = v_state_id;
  END IF;

  IF v_normalized_state IS NULL OR v_normalized_state = '' THEN
    v_raw_state := COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), '');
    IF v_raw_state <> '' THEN
      -- Exact match
      SELECT id, name INTO v_state_id, v_normalized_state
      FROM public.states
      WHERE lower(btrim(name)) = lower(btrim(v_raw_state))
      LIMIT 1;

      -- Fuzzy/Alias fallback if exact match not found
      IF v_state_id IS NULL THEN
        IF lower(btrim(v_raw_state)) IN ('gujarat', 'gujrat', 'gujrati', 'gujarati') THEN
          v_state_id := 24;
          v_normalized_state := 'Gujarat';
        ELSIF lower(btrim(v_raw_state)) IN ('up', 'uttar pradesh', 'utter pradesh', 'uttar pardesh') THEN
          v_state_id := 9;
          v_normalized_state := 'Uttar Pradesh';
        ELSIF lower(btrim(v_raw_state)) IN ('assam', 'aasam') THEN
          v_state_id := 18;
          v_normalized_state := 'Assam';
        ELSIF lower(btrim(v_raw_state)) IN ('madhya pradesh', 'madhady pradesh', 'mp') THEN
          v_state_id := 23;
          v_normalized_state := 'Madhya Pradesh';
        ELSIF lower(btrim(v_raw_state)) LIKE '%dad%' OR lower(btrim(v_raw_state)) LIKE '%haveli%' THEN
          v_state_id := 38;
          v_normalized_state := 'Dadra and Nagar Haveli and Daman and Diu';
        ELSE
          v_normalized_state := v_raw_state;
        END IF;
      END IF;
    END IF;
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
    aadhaar_number,
    license_number
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), ''),
    v_role,
    v_status,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), ''),
    COALESCE(v_normalized_state, ''),
    v_state_id,
    NULLIF(NEW.raw_user_meta_data->>'aadhaar_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'license_number', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = CASE 
      WHEN public.users.status = 'pending' THEN EXCLUDED.role 
      ELSE public.users.role 
    END,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    state_id = EXCLUDED.state_id,
    aadhaar_number = COALESCE(EXCLUDED.aadhaar_number, public.users.aadhaar_number),
    license_number = COALESCE(EXCLUDED.license_number, public.users.license_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
