-- ============================================================================
-- Migration 059: Optimized User Aggregates RPC
-- ============================================================================
-- Consolidates 4 separate COUNT queries into a single function call.
-- Returns total users, active users, engineer count, and distinct states
-- in one database roundtrip using FILTER aggregates.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_aggregates()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_users', COUNT(*),
    'active_users', COUNT(*) FILTER (WHERE status = 'active'),
    'engineer_count', COUNT(*) FILTER (WHERE role IN ('engineer', 'service_engineer')),
    'states', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', sub.state_key,
            'label', sub.state_label
          )
          ORDER BY sub.state_label
        ),
        '[]'::json
      )
      FROM (
        SELECT DISTINCT ON (COALESCE(state_id::text, lower(trim(state))))
          COALESCE(state_id::text, lower(trim(state))) AS state_key,
          trim(state) AS state_label
        FROM users
        WHERE state IS NOT NULL AND trim(state) <> ''
        ORDER BY COALESCE(state_id::text, lower(trim(state))), trim(state)
      ) sub
    )
  )
  FROM users;
$$;

-- Grant execute permission to authenticated users (needed for Supabase RPC calls)
GRANT EXECUTE ON FUNCTION public.get_user_aggregates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_aggregates() TO service_role;
