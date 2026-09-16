-- Migration 069: Operations GIN Trigram & Client Location Indexes
-- Purpose: Optimize search and site filtering on machine_hour_logs, converting sequential scans into index scans.

-- 1. Ensure pg_trgm extension is active
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- 2. GIN Trigram Index on location for fast text search and site location matching
CREATE INDEX IF NOT EXISTS idx_mhl_location_trgm 
ON public.machine_hour_logs 
USING gin (location gin_trgm_ops);

-- 3. GIN Trigram Index on remarks for general search filtering
CREATE INDEX IF NOT EXISTS idx_mhl_remarks_trgm 
ON public.machine_hour_logs 
USING gin (remarks gin_trgm_ops);

-- 4. B-tree index on (client_id, location) to accelerate client distinct site queries
CREATE INDEX IF NOT EXISTS idx_mhl_client_location 
ON public.machine_hour_logs (client_id, location) 
WHERE location IS NOT NULL AND location <> '';
