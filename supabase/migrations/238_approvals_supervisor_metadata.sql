-- ==============================================================================
-- Migration: 238_approvals_supervisor_metadata.sql
-- Description:
--   Extends the canonical public.approval_list RPC from Migration 236/237 to resolve
--   and return supervisor_name and supervisor_id for approval requests (especially
--   operator onboarding, KYC, and profile change requests) via:
--     1. Direct users.supervisor_id lookup joined to public.users
--     2. Stored payload metadata (r.payload->>'supervisor_id', supervisor_name)
--     3. user_supervisors junction table fallback
--   Preserves all Migration 236 security hardening (null-role guards, safe casts).
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approval_list(
  p_status text DEFAULT 'pending'::text,
  p_type_key text DEFAULT NULL::text,
  p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_caller_id UUID;
  v_limit INT;
  v_pending_total INT := 0;
  v_items JSONB := '[]'::jsonb;
  v_next_cursor JSONB := NULL;
  v_has_more BOOLEAN := false;
  v_last_created_at TIMESTAMPTZ;
  v_last_id UUID;
BEGIN
  -- Security check: Require authenticated user (or service_role/postgres for system/tests)
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    IF current_user_role() IN ('service_role', 'postgres') 
       OR current_setting('role', true) IN ('service_role', 'postgres') 
       OR current_user = 'postgres' THEN
      SELECT id INTO v_caller_id FROM public.users WHERE role IN ('super_admin', 'admin') AND status = 'active' ORDER BY created_at LIMIT 1;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_caller_id;
  IF v_role IS NULL THEN
    v_role := public.current_user_role();
  END IF;

  -- RBAC guard: deny by default. An unresolvable (NULL) role is never authorised.
  IF v_role IS NULL
     OR (
       v_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_types t WHERE v_role = ANY(t.approver_roles)
       )
     ) THEN
    RAISE EXCEPTION 'Forbidden: Your role (%) is not authorized to access the approvals queue.', COALESCE(v_role, 'unknown')
      USING ERRCODE = '42501';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);

  -- Single round-trip: compute pending_total for the current type filter
  SELECT count(*)
  INTO v_pending_total
  FROM public.approval_requests r
  WHERE r.status = 'pending'
    AND r.parent_id IS NULL
    AND (p_type_key IS NULL OR p_type_key = 'all' OR r.type_key = p_type_key);

  -- Fetch up to v_limit + 1 rows to detect has_more
  WITH filtered AS (
    SELECT
      r.id,
      r.type_key,
      t.label AS type_label,
      r.subject_type,
      r.subject_id,
      r.subject_label,
      r.requested_by,
      COALESCE(u.full_name, r.payload->>'full_name', 'System') AS requester_name,
      r.status,
      r.summary,
      t.priority,
      r.created_at,
      r.expires_at,
      r.version,
      r.payload,
      COALESCE(u.role, r.payload->>'role') AS role,
      u.employee_id,
      COALESCE(u.email, r.payload->>'email') AS email,
      COALESCE(u.phone, r.payload->>'phone') AS phone,
      COALESCE(u.machine_category, r.payload->>'machine_category') AS machine_category,
      -- Supervisor resolution: users.supervisor_id, payload, or user_supervisors junction table
      COALESCE(
        sup.full_name,
        r.payload->>'supervisor_name',
        r.payload->>'supervisorName',
        (
          SELECT s2.full_name FROM public.users s2
          WHERE s2.id = COALESCE(
            public.approval_uuid_or_null(r.payload->>'supervisor_id'),
            public.approval_uuid_or_null(r.payload->>'supervisorId'),
            (SELECT us.supervisor_id FROM public.user_supervisors us WHERE us.user_id = u.id ORDER BY us.created_at DESC LIMIT 1)
          )
        )
      ) AS supervisor_name,
      COALESCE(
        sup.id,
        u.supervisor_id,
        public.approval_uuid_or_null(r.payload->>'supervisor_id'),
        public.approval_uuid_or_null(r.payload->>'supervisorId')
      ) AS supervisor_id,
      -- User documents attached to this item
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ud.id,
            'document_type_code', ud.document_type_code,
            'label', CASE
              WHEN ud.document_type_code = 'aadhaar' THEN 'Aadhaar Card'
              WHEN ud.document_type_code = 'driving_license' THEN 'Driving License'
              WHEN ud.document_type_code = 'bank_document' THEN 'Bank Details'
              ELSE upper(replace(ud.document_type_code, '_', ' '))
            END,
            'storage_path', ud.storage_path,
            'thumb_path', ud.thumb_path,
            'verification_status', ud.verification_status,
            'file_size_bytes', ud.file_size_bytes,
            'mime_type', ud.mime_type
          ) ORDER BY ud.created_at ASC
        )
        FROM public.user_documents ud
        WHERE ud.user_id = COALESCE(
          public.approval_uuid_or_null(r.payload->>'user_id'),
          CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
          r.requested_by
        )
      ), '[]'::jsonb) AS documents,
      -- Bound request IDs for grouped registration requests
      (
        ARRAY[r.id] || COALESCE((
          SELECT array_agg(child.id)
          FROM public.approval_requests child
          WHERE child.parent_id = r.id
        ), '{}'::uuid[])
      ) AS bound_request_ids
    FROM public.approval_requests r
    JOIN public.approval_types t ON t.key = r.type_key
    LEFT JOIN public.users u ON u.id = COALESCE(
      public.approval_uuid_or_null(r.payload->>'user_id'),
      CASE WHEN r.subject_type = 'user' THEN r.subject_id ELSE NULL END,
      r.requested_by
    )
    LEFT JOIN public.users sup ON sup.id = COALESCE(
      u.supervisor_id,
      public.approval_uuid_or_null(r.payload->>'supervisor_id'),
      public.approval_uuid_or_null(r.payload->>'supervisorId')
    )
    WHERE r.parent_id IS NULL
      AND (p_status = 'all' OR r.status = p_status::public.approval_status)
      AND (p_type_key IS NULL OR p_type_key = 'all' OR r.type_key = p_type_key)
      AND (
        p_cursor_created_at IS NULL
        OR (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT (v_limit + 1)
  ),
  enumerated AS (
    SELECT f.*, ROW_NUMBER() OVER () as rn
    FROM filtered f
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'type_key', e.type_key,
        'type_label', e.type_label,
        'subject_type', e.subject_type,
        'subject_id', e.subject_id,
        'subject_label', e.subject_label,
        'requested_by', e.requested_by,
        'requester_name', e.requester_name,
        'status', e.status,
        'summary', e.summary,
        'priority', e.priority,
        'created_at', e.created_at,
        'expires_at', e.expires_at,
        'version', e.version,
        'payload', e.payload,
        'role', e.role,
        'employee_id', e.employee_id,
        'email', e.email,
        'phone', e.phone,
        'machine_category', e.machine_category,
        'supervisor_name', e.supervisor_name,
        'supervisor_id', e.supervisor_id,
        'documents', e.documents,
        'bound_request_ids', to_jsonb(e.bound_request_ids)
      ) ORDER BY e.rn
    ) FILTER (WHERE e.rn <= v_limit), '[]'::jsonb),
    COALESCE(bool_or(e.rn > v_limit), false),
    (
      SELECT jsonb_build_object('created_at', e_last.created_at, 'id', e_last.id)
      FROM enumerated e_last
      WHERE e_last.rn = v_limit
    )
  INTO v_items, v_has_more, v_next_cursor
  FROM enumerated e;

  IF NOT v_has_more THEN
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor,
    'has_more', v_has_more,
    'pending_total', v_pending_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approval_list(text, text, timestamp with time zone, uuid, integer) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
