-- Migration 014: Set Statement Timeouts & DoS Protection Guards
-- Description: Configures PostgreSQL database session statement timeouts (10s) and statement guards against slow/unindexed queries.

-- 1. Set default statement timeout to 10 seconds (10,000ms) for postgres database
ALTER DATABASE postgres SET statement_timeout = '10000ms';

-- 2. Configure default lock timeout to 5 seconds to prevent transaction deadlock lockup
ALTER DATABASE postgres SET lock_timeout = '5000ms';

-- 3. Configure default idle in transaction session timeout to 10 seconds to reclaim hanging connections
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '10000ms';

-- 4. Create database health function to verify session timeout guards
CREATE OR REPLACE FUNCTION public.check_dos_protection_settings()
RETURNS TABLE (
  setting_name text,
  setting_value text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT name::text AS setting_name, setting::text AS setting_value
  FROM pg_settings
  WHERE name IN ('statement_timeout', 'lock_timeout', 'idle_in_transaction_session_timeout');
$$;
