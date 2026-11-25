-- Migration 232: Native Machines — operator assigned-machine contract + scope hardening
--
-- Purpose (native /machines module only, safe for web too):
--   1. Provide a single, role-checked SECURITY DEFINER read contract for the operator
--      "assigned machine" view so the native app never issues an ad-hoc fleet query.
--      The function returns ONLY the slim operator-visible projection:
--      identity/specs, health, HMR, rental status, worksite and site supervisor.
--      No commercial rental rates, no audit data, no personnel arrays, no PII columns.
--   2. Enforce the role inside the database (raise 42501) so the contract cannot be
--      called by HR, supervisor, manager-tier or any legacy role through PostgREST.
--   3. Ensure the operator lookup is index-backed.
--
-- Companion (shared with web) hardening lives in 231_machines_rbac_and_query_hardening.sql:
--   RLS on public.machines, check_user_can_access_machine(), supervisor/operator update
--   triggers and get_machines_directory_summary() role gates.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Operator assigned-machine read contract
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_operator_assigned_machines(
  p_machine_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  machine_id text,
  machine_name text,
  model text,
  serial_number text,
  manufacturer text,
  year_of_mfg integer,
  health_status text,
  status text,
  hour_meter numeric,
  client_id uuid,
  client_name text,
  client_code text,
  worksite_name text,
  worksite_city text,
  worksite_state text,
  site_supervisor_id uuid,
  site_supervisor_name text,
  shift_codes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication is required to read assigned machinery.'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = v_uid;

  IF v_role IS DISTINCT FROM 'operator' THEN
    RAISE EXCEPTION 'Unauthorized: the assigned-machine view is restricted to operators.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH allowed AS (
    -- Effective-dated shift assignments (authoritative)
    SELECT oma.machine_id, oma.shift_code
    FROM public.operator_machine_assignments oma
    WHERE oma.operator_id = v_uid
      AND oma.is_active = true
      AND oma.valid_from <= v_today
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_today)
    UNION ALL
    -- Legacy direct assignment columns (only when no dated assignment exists)
    SELECT m2.id, NULL::text
    FROM public.machines m2
    WHERE (m2.current_operator_id = v_uid OR v_uid = ANY(m2.operator_ids))
      AND NOT EXISTS (
        SELECT 1
        FROM public.operator_machine_assignments oma2
        WHERE oma2.machine_id = m2.id
          AND oma2.operator_id = v_uid
          AND oma2.is_active = true
          AND oma2.valid_from <= v_today
          AND (oma2.valid_to IS NULL OR oma2.valid_to >= v_today)
      )
  ),
  targets AS (
    SELECT
      a.machine_id,
      string_agg(DISTINCT a.shift_code, ', ' ORDER BY a.shift_code) AS shift_codes
    FROM allowed a
    WHERE (p_machine_id IS NULL OR a.machine_id = p_machine_id)
    GROUP BY a.machine_id
  )
  SELECT
    m.id,
    m.machine_id,
    m.machine_name,
    m.model,
    m.serial_number,
    m.manufacturer,
    m.year_of_mfg,
    m.health_status,
    m.status,
    m.hour_meter,
    m.client_id,
    c.company_name::text AS client_name,
    c.code::text AS client_code,
    COALESCE(NULLIF(s.site_name, ''), NULLIF(c.company_name::text, '')) AS worksite_name,
    COALESCE(NULLIF(s.city, ''), c.city::text) AS worksite_city,
    COALESCE(st.name, c.state::text) AS worksite_state,
    sup.id AS site_supervisor_id,
    sup.full_name::text AS site_supervisor_name,
    t.shift_codes
  FROM targets t
  JOIN public.machines m ON m.id = t.machine_id
  LEFT JOIN public.clients c ON c.id = m.client_id
  LEFT JOIN public.client_sites s ON s.id = m.site_id
  LEFT JOIN public.states st ON st.id = s.state_id
  LEFT JOIN public.users sup ON sup.id = m.current_supervisor_id
  ORDER BY m.machine_id;
END;
$$;

COMMENT ON FUNCTION public.get_operator_assigned_machines(uuid) IS
  'Operator-only assigned-machine view (slim projection: specs, health, HMR, rental status, worksite, site supervisor). Raises 42501 for every non-operator role.';

REVOKE ALL ON FUNCTION public.get_operator_assigned_machines(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_operator_assigned_machines(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index hygiene
--    The operator lookup is already served by the existing
--    idx_oma_operator_date_range (operator_id, valid_from, valid_to) and
--    idx_oma_machine_operator_active (machine_id, operator_id) WHERE is_active.
--    No additional index is created here (avoids write amplification on the
--    hottest assignment table).
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_oma_operator_active_machine;

COMMIT;
