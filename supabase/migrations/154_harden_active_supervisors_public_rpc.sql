-- ==============================================================================
-- Migration 154: Harden get_active_supervisors_public() RPC Function
-- Ensures case-insensitivity on role ('supervisor') and status ('active', 'approved'),
-- guaranteeing active supervisors are always returned to unauthenticated registration selectors.
-- ==============================================================================

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
  WHERE LOWER(role) = 'supervisor' 
    AND LOWER(status) IN ('active', 'approved')
  ORDER BY full_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_supervisors_public() TO anon, authenticated;
COMMENT ON FUNCTION public.get_active_supervisors_public() IS 'Returns non-sensitive list of active supervisors (id and full_name only) for signup and user assignment selectors.';
