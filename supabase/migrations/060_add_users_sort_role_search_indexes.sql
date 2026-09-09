-- Migration 060: Add users sort and role search indexes
-- Ensures full_name sorting (name_asc / name_desc) uses B-Tree index
-- Ensures role substring search in getUserList() uses pg_trgm GIN index

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- B-Tree Index for full_name sorting (name_asc / name_desc) and secondary tiebreaker
CREATE INDEX IF NOT EXISTS users_full_name_sort_idx ON users (full_name);

-- GIN Index for role substring search in PostgREST .or() ilike queries
CREATE INDEX IF NOT EXISTS users_role_trgm_idx ON users USING GIN (role gin_trgm_ops);
