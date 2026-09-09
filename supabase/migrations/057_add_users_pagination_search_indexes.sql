-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Indexes for partial text matching (ilike)
CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx ON users USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_phone_trgm_idx ON users USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_city_trgm_idx ON users USING GIN (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_district_trgm_idx ON users USING GIN (district gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_state_trgm_idx ON users USING GIN (state gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_aadhaar_number_trgm_idx ON users USING GIN (aadhaar_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_license_number_trgm_idx ON users USING GIN (license_number gin_trgm_ops);

-- B-Tree Indexes for sorting and exact filtering
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS users_state_exact_idx ON users (state);
