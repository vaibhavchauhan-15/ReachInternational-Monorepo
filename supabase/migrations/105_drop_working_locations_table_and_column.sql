-- ==============================================================================
-- Migration 105: Drop working_locations Table, Column and Obsolete RPC
--
-- 1. Drops working_location_id column from public.users table.
-- 2. Drops public.working_locations table and associated indexes/policies.
-- 3. Drops public.get_active_working_locations_public() function.
--
-- Rationale: Reach International operations dynamically assign personnel across
-- multiple offices, sites, yards, and workshops which change frequently.
-- Users are instead anchored by their canonical residential/postal address
-- (street, city, district, state, state_id), eliminating static table lookups.
-- ==============================================================================

-- 1. Drop foreign key and column from public.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'working_location_id'
  ) THEN
    ALTER TABLE public.users DROP COLUMN working_location_id CASCADE;
  END IF;
END $$;

-- 2. Drop index if it still exists
DROP INDEX IF EXISTS public.idx_users_working_location_id;

-- 3. Drop function if it still exists
DROP FUNCTION IF EXISTS public.get_active_working_locations_public() CASCADE;

-- 4. Drop working_locations table and all policies/triggers
DROP TABLE IF EXISTS public.working_locations CASCADE;
