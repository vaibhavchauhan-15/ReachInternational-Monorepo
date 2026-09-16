-- ==============================================================================
-- Migration 080: Harden get_active_supervisors_public() RPC Function
-- Security Fix: REV-H02 (CWE-200) — Prune supervisor email PII from unauthenticated RPC.
-- Modifies the public RPC used by registration selectors to return only non-sensitive
-- identifiers (id, full_name), preventing unauthenticated harvesting of employee emails.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_active_supervisors_public();

CREATE OR REPLACE FUNCTION public.get_active_supervisors_public()
RETURNS TABLE (
  id UUID,
  full_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, full_name
  FROM public.users
  WHERE role = 'supervisor' AND status = 'active'
  ORDER BY full_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_supervisors_public() TO anon, authenticated;
COMMENT ON FUNCTION public.get_active_supervisors_public() IS 'Returns non-sensitive list of active supervisors (id and full_name only) for signup and user assignment selectors.';
