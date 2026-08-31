-- ==============================================================================
-- MIGRATION 030: Relational Indian Locations Hierarchy (states, districts, cities, towns, villages)
-- Official Government IDs: Unique, Stable Integer & Smallint Keys
-- ==============================================================================

-- 1. States / UTs Table
CREATE TABLE IF NOT EXISTS public.states (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Districts Table
CREATE TABLE IF NOT EXISTS public.districts (
  id SMALLINT PRIMARY KEY,
  state_id SMALLINT NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Cities Table (Municipal Corporations, City Municipal Councils, Major Cities)
CREATE TABLE IF NOT EXISTS public.cities (
  id INTEGER PRIMARY KEY,
  district_id SMALLINT NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Towns Table (Municipal Councils, Nagar Panchayats, Census Towns, Tehsils/Talukas)
CREATE TABLE IF NOT EXISTS public.towns (
  id INTEGER PRIMARY KEY,
  district_id SMALLINT NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Villages Table (Census Revenue Villages)
CREATE TABLE IF NOT EXISTS public.villages (
  id INTEGER PRIMARY KEY,
  district_id SMALLINT NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- INDEXES & PERFORMANCE OPTIMIZATION
-- ==============================================================================

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_districts_state_id ON public.districts (state_id);
CREATE INDEX IF NOT EXISTS idx_cities_district_id ON public.cities (district_id);
CREATE INDEX IF NOT EXISTS idx_towns_district_id ON public.towns (district_id);
CREATE INDEX IF NOT EXISTS idx_villages_district_id ON public.villages (district_id);

-- Lookup and Ordering Indexes
CREATE INDEX IF NOT EXISTS idx_states_name ON public.states (name);
CREATE INDEX IF NOT EXISTS idx_districts_name ON public.districts (name);
CREATE INDEX IF NOT EXISTS idx_cities_name ON public.cities (name);
CREATE INDEX IF NOT EXISTS idx_towns_name ON public.towns (name);
CREATE INDEX IF NOT EXISTS idx_villages_name ON public.villages (name);

-- Trigram Fuzzy Search Indexes (Requires pg_trgm)
CREATE INDEX IF NOT EXISTS idx_districts_name_trgm ON public.districts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cities_name_trgm ON public.cities USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_towns_name_trgm ON public.towns USING gin (name gin_trgm_ops);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.towns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;

-- Public Select Policies
DROP POLICY IF EXISTS "states_select_policy" ON public.states;
CREATE POLICY "states_select_policy" ON public.states FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "districts_select_policy" ON public.districts;
CREATE POLICY "districts_select_policy" ON public.districts FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "cities_select_policy" ON public.cities;
CREATE POLICY "cities_select_policy" ON public.cities FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "towns_select_policy" ON public.towns;
CREATE POLICY "towns_select_policy" ON public.towns FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "villages_select_policy" ON public.villages;
CREATE POLICY "villages_select_policy" ON public.villages FOR SELECT TO authenticated, anon USING (true);

-- Admin Mutation Policies
DROP POLICY IF EXISTS "states_admin_policy" ON public.states;
CREATE POLICY "states_admin_policy" ON public.states
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));

DROP POLICY IF EXISTS "districts_admin_policy" ON public.districts;
CREATE POLICY "districts_admin_policy" ON public.districts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));

DROP POLICY IF EXISTS "cities_admin_policy" ON public.cities;
CREATE POLICY "cities_admin_policy" ON public.cities
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));

DROP POLICY IF EXISTS "towns_admin_policy" ON public.towns;
CREATE POLICY "towns_admin_policy" ON public.towns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));

DROP POLICY IF EXISTS "villages_admin_policy" ON public.villages;
CREATE POLICY "villages_admin_policy" ON public.villages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')));
