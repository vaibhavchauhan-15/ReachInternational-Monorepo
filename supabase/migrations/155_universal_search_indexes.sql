-- ============================================================================
-- Migration 155: Universal Search Enhancement
-- Adds missing trigram indexes for optimized cross-column ILIKE search.
-- Existing per-column GIN trigram indexes are already in place for most columns.
-- This migration fills gaps: users.employee_id, users.aadhaar_number, users.state.
-- Also adds a prefix index for fast 1-2 char queries on users.full_name.
-- ============================================================================

-- Ensure pg_trgm extension is available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── USERS: Missing trigram indexes ──────────────────────────────────────────

-- employee_id is searched via ILIKE in applyOptimizedUserSearch but had no GIN index
CREATE INDEX IF NOT EXISTS idx_users_employee_id_trgm
  ON public.users USING gin (employee_id gin_trgm_ops);

-- aadhaar_number is searched for digit patterns
CREATE INDEX IF NOT EXISTS idx_users_aadhaar_trgm
  ON public.users USING gin (aadhaar_number gin_trgm_ops);

-- state field is searched in multi-token search
CREATE INDEX IF NOT EXISTS idx_users_state_trgm
  ON public.users USING gin (state gin_trgm_ops);

-- district field is searched in multi-token search
CREATE INDEX IF NOT EXISTS idx_users_district_trgm
  ON public.users USING gin (district gin_trgm_ops);

-- Fast B-tree prefix index for 1-2 character queries (instant prefix scan)
CREATE INDEX IF NOT EXISTS idx_users_name_prefix
  ON public.users (lower(full_name) text_pattern_ops);

-- ── HELPER FUNCTION: Escape LIKE wildcards in user input ─────────────────────

CREATE OR REPLACE FUNCTION public.like_escape(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$
  SELECT replace(replace(replace(t, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
$$;

COMMENT ON FUNCTION public.like_escape IS
  'Escapes LIKE/ILIKE metacharacters (%, _, \) in user-supplied text to prevent wildcard injection.';
