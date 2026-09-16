-- ==============================================================================
-- Migration 077: User Directory Summary RPC & Status Index Optimization
-- 1. Adds composite B-tree index on public.users (status, created_at DESC)
-- 2. Adds high-performance scalar KPI aggregator RPC get_users_directory_summary()
--    returning { total, active, engineers, new_registrations, states }
--    in a single database roundtrip, with optional supervisor scoping.
-- ==============================================================================

-- 1. Composite B-tree index for status and created_at
CREATE INDEX IF NOT EXISTS idx_users_status_created_at
  ON public.users USING btree (status, created_at DESC);

-- 2. High-Performance Scalar User Directory Summary RPC
CREATE OR REPLACE FUNCTION public.get_users_directory_summary(
  p_supervisor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'active', COUNT(*) FILTER (WHERE status = 'active')::bigint,
    'engineers', COUNT(*) FILTER (WHERE role IN ('engineer', 'service_engineer'))::bigint,
    'new_registrations', COUNT(*) FILTER (WHERE status = 'pending')::bigint,
    'states', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sub.state_key,
            'label', sub.state_label
          )
          ORDER BY sub.state_label ASC
        )
        FROM (
          SELECT DISTINCT ON (COALESCE(state_id::text, lower(trim(state))))
            COALESCE(state_id::text, lower(trim(state))) AS state_key,
            trim(state) AS state_label
          FROM public.users
          WHERE state IS NOT NULL AND trim(state) <> ''
            AND (
              p_supervisor_id IS NULL
              OR (
                (supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
                AND role IN ('operator', 'service_engineer', 'engineer', 'mechanic')
              )
            )
          ORDER BY COALESCE(state_id::text, lower(trim(state))), trim(state)
        ) sub
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.users
  WHERE (
    p_supervisor_id IS NULL
    OR (
      (supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
      AND role IN ('operator', 'service_engineer', 'engineer', 'mechanic')
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_directory_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_directory_summary(uuid) TO authenticated, service_role;
