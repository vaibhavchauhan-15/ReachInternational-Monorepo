-- ==============================================================================
-- Migration 072: Complete Client Search Trigram Indexes (Phase C8)
-- 1. Adds GIN trigram indexes on clients (district, state) for 100% index coverage
--    across all 8 client search dimensions:
--    (company_name, code, gstin, pan_number, contact_person, city, district, state)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- GIN Trigram index on district for fast sub-string location filtering
CREATE INDEX IF NOT EXISTS idx_clients_district_trgm 
  ON public.clients USING gin (district gin_trgm_ops);

-- GIN Trigram index on state for fast sub-string state filtering
CREATE INDEX IF NOT EXISTS idx_clients_state_trgm 
  ON public.clients USING gin (state gin_trgm_ops);
