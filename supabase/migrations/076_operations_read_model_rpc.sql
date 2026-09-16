-- Migration 076: Operations Read Model & Keyset Cursor RPC
-- Provides public.get_operation_logs for high-performance server-side read model queries
-- Returns: { "rows": [...], "nextCursor": "...", "total": 100 }
-- Eliminates unnecessary relational objects and enables sub-millisecond keyset cursor pagination.

CREATE OR REPLACE FUNCTION public.get_operation_logs(
  "view" text DEFAULT 'machine',
  machine_id uuid DEFAULT NULL,
  client_id uuid DEFAULT NULL,
  operator_id uuid DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  search text DEFAULT NULL,
  cursor text DEFAULT NULL,
  "limit" integer DEFAULT 20,
  site text DEFAULT NULL,
  shift text DEFAULT NULL,
  breakdown_only boolean DEFAULT FALSE,
  page integer DEFAULT NULL,
  -- Optional p_* aliases for universal named-argument compatibility
  p_view text DEFAULT NULL,
  p_machine_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_site text DEFAULT NULL,
  p_shift text DEFAULT NULL,
  p_breakdown_only boolean DEFAULT NULL,
  p_page integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_effective_view text;
  v_effective_machine_id uuid;
  v_effective_client_id uuid;
  v_effective_operator_id uuid;
  v_effective_start_date date;
  v_effective_end_date date;
  v_effective_search text;
  v_effective_cursor text;
  v_effective_limit integer;
  v_effective_site text;
  v_effective_shift text;
  v_effective_breakdown boolean;
  v_effective_page integer;

  v_b64 text;
  v_cursor_json jsonb;
  v_cursor_date date;
  v_cursor_created timestamptz;
  v_cursor_id uuid;
  v_offset integer := 0;

  v_total bigint := 0;
  v_next_cursor text := NULL;
  v_rows jsonb := '[]'::jsonb;
  v_rec_count integer := 0;

  v_last_log_date date;
  v_last_created_at timestamptz;
  v_last_id uuid;
BEGIN
  -- 1. Harmonize parameter aliases
  v_effective_view := lower(trim(COALESCE(p_view, "view", 'machine')));
  v_effective_machine_id := COALESCE(p_machine_id, machine_id);
  v_effective_client_id := COALESCE(p_client_id, client_id);
  v_effective_operator_id := COALESCE(p_operator_id, operator_id);
  v_effective_start_date := COALESCE(p_start_date, start_date);
  v_effective_end_date := COALESCE(p_end_date, end_date);
  v_effective_search := NULLIF(trim(COALESCE(p_search, search)), '');
  v_effective_cursor := NULLIF(trim(COALESCE(p_cursor, cursor)), '');
  v_effective_limit := GREATEST(1, LEAST(100, COALESCE(p_limit, "limit", 20)));
  v_effective_site := NULLIF(trim(COALESCE(p_site, site)), '');
  v_effective_shift := NULLIF(trim(COALESCE(p_shift, shift)), '');
  v_effective_breakdown := COALESCE(p_breakdown_only, breakdown_only, FALSE);
  v_effective_page := COALESCE(p_page, page);

  -- 2. Decode cursor if provided (Supports clean Base64URL JSON, Raw JSON, or Pipe-delimited)
  IF v_effective_cursor IS NOT NULL THEN
    BEGIN
      IF v_effective_cursor LIKE '{%' THEN
        v_cursor_json := v_effective_cursor::jsonb;
        v_cursor_date := (v_cursor_json->>'d')::date;
        v_cursor_created := (v_cursor_json->>'c')::timestamptz;
        v_cursor_id := (v_cursor_json->>'id')::uuid;
      ELSIF v_effective_cursor NOT LIKE '%|%' THEN
        BEGIN
          v_b64 := replace(replace(replace(replace(v_effective_cursor, E'\n', ''), E'\r', ''), '-', '+'), '_', '/');
          WHILE length(v_b64) % 4 <> 0 LOOP
            v_b64 := v_b64 || '=';
          END LOOP;
          v_cursor_json := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
          v_cursor_date := (v_cursor_json->>'d')::date;
          v_cursor_created := (v_cursor_json->>'c')::timestamptz;
          v_cursor_id := (v_cursor_json->>'id')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_cursor_date := NULL;
        END;
      ELSE
        v_cursor_date := split_part(v_effective_cursor, '|', 1)::date;
        v_cursor_created := split_part(v_effective_cursor, '|', 2)::timestamptz;
        v_cursor_id := split_part(v_effective_cursor, '|', 3)::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_cursor_date := NULL;
      v_cursor_created := NULL;
      v_cursor_id := NULL;
    END;
  END IF;

  -- 3. Calculate offset if offset-based page is requested without cursor
  IF v_cursor_date IS NULL AND v_effective_page IS NOT NULL AND v_effective_page > 1 THEN
    v_offset := (v_effective_page - 1) * v_effective_limit;
  ELSE
    v_offset := 0;
  END IF;

  -- 4. Calculate total matching count (skip joins when search is NULL for maximum performance)
  IF v_effective_search IS NULL THEN
    SELECT COUNT(*)
    INTO v_total
    FROM public.machine_hour_logs mhl
    WHERE (v_effective_machine_id IS NULL OR mhl.machine_id = v_effective_machine_id)
      AND (v_effective_client_id IS NULL OR mhl.client_id = v_effective_client_id)
      AND (v_effective_operator_id IS NULL OR mhl.operator_id = v_effective_operator_id)
      AND (v_effective_start_date IS NULL OR mhl.log_date >= v_effective_start_date)
      AND (v_effective_end_date IS NULL OR mhl.log_date <= v_effective_end_date)
      AND (v_effective_site IS NULL OR v_effective_site = 'all' OR mhl.location ILIKE '%' || v_effective_site || '%')
      AND (v_effective_shift IS NULL OR v_effective_shift = 'all' OR mhl.shift = v_effective_shift)
      AND (NOT v_effective_breakdown OR mhl.is_breakdown = TRUE);
  ELSE
    SELECT COUNT(*)
    INTO v_total
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    LEFT JOIN public.clients c ON c.id = mhl.client_id
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    WHERE (v_effective_machine_id IS NULL OR mhl.machine_id = v_effective_machine_id)
      AND (v_effective_client_id IS NULL OR mhl.client_id = v_effective_client_id)
      AND (v_effective_operator_id IS NULL OR mhl.operator_id = v_effective_operator_id)
      AND (v_effective_start_date IS NULL OR mhl.log_date >= v_effective_start_date)
      AND (v_effective_end_date IS NULL OR mhl.log_date <= v_effective_end_date)
      AND (v_effective_site IS NULL OR v_effective_site = 'all' OR mhl.location ILIKE '%' || v_effective_site || '%')
      AND (v_effective_shift IS NULL OR v_effective_shift = 'all' OR mhl.shift = v_effective_shift)
      AND (NOT v_effective_breakdown OR mhl.is_breakdown = TRUE)
      AND (
        mhl.location ILIKE '%' || v_effective_search || '%' OR
        mhl.remarks ILIKE '%' || v_effective_search || '%' OR
        u.full_name ILIKE '%' || v_effective_search || '%' OR
        c.company_name ILIKE '%' || v_effective_search || '%' OR
        m.machine_id ILIKE '%' || v_effective_search || '%' OR
        m.model ILIKE '%' || v_effective_search || '%' OR
        m.serial_number ILIKE '%' || v_effective_search || '%'
      );
  END IF;

  -- 5. Query matching rows with limit + 1
  WITH paged_ids AS (
    SELECT mhl.id
    FROM public.machine_hour_logs mhl
    WHERE (v_effective_machine_id IS NULL OR mhl.machine_id = v_effective_machine_id)
      AND (v_effective_client_id IS NULL OR mhl.client_id = v_effective_client_id)
      AND (v_effective_operator_id IS NULL OR mhl.operator_id = v_effective_operator_id)
      AND (v_effective_start_date IS NULL OR mhl.log_date >= v_effective_start_date)
      AND (v_effective_end_date IS NULL OR mhl.log_date <= v_effective_end_date)
      AND (v_effective_site IS NULL OR v_effective_site = 'all' OR mhl.location ILIKE '%' || v_effective_site || '%')
      AND (v_effective_shift IS NULL OR v_effective_shift = 'all' OR mhl.shift = v_effective_shift)
      AND (NOT v_effective_breakdown OR mhl.is_breakdown = TRUE)
      AND (
        v_cursor_date IS NULL OR
        (mhl.log_date, mhl.created_at, mhl.id) < (v_cursor_date, v_cursor_created, v_cursor_id)
      )
      AND (
        v_effective_search IS NULL OR
        mhl.location ILIKE '%' || v_effective_search || '%' OR
        mhl.remarks ILIKE '%' || v_effective_search || '%' OR
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = mhl.operator_id AND u.full_name ILIKE '%' || v_effective_search || '%') OR
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = mhl.client_id AND c.company_name ILIKE '%' || v_effective_search || '%') OR
        EXISTS (SELECT 1 FROM public.machines m WHERE m.id = mhl.machine_id AND (m.machine_id ILIKE '%' || v_effective_search || '%' OR m.model ILIKE '%' || v_effective_search || '%' OR m.serial_number ILIKE '%' || v_effective_search || '%'))
      )
    ORDER BY mhl.log_date DESC, mhl.created_at DESC, mhl.id DESC
    LIMIT (v_effective_limit + 1)
    OFFSET v_offset
  ),
  hydrated_results AS (
    SELECT
      mhl.id,
      mhl.machine_id,
      mhl.client_id,
      mhl.operator_id,
      mhl.log_date,
      mhl.start_time,
      mhl.end_time,
      mhl.start_meter,
      mhl.end_meter,
      mhl.running_hours,
      mhl.normal_working_hours,
      mhl.overtime_hours,
      mhl.is_breakdown,
      mhl.shift,
      mhl.location,
      mhl.remarks,
      mhl.conflict_flag,
      mhl.conflict_reason,
      mhl.conflict_status,
      mhl.created_at,
      COALESCE(m.machine_id, '') AS machine_code,
      COALESCE(m.model, '') AS machine_model,
      COALESCE(m.serial_number, '') AS machine_serial,
      COALESCE(c.company_name, '') AS client_name,
      COALESCE(u.full_name, '') AS operator_name,
      COALESCE(u.phone, '') AS operator_phone,
      ROW_NUMBER() OVER () AS page_row_num
    FROM paged_ids p
    JOIN public.machine_hour_logs mhl ON mhl.id = p.id
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    LEFT JOIN public.clients c ON c.id = mhl.client_id
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    ORDER BY mhl.log_date DESC, mhl.created_at DESC, mhl.id DESC
  )
  SELECT
    (SELECT COUNT(*) FROM hydrated_results),
    (SELECT log_date FROM hydrated_results WHERE page_row_num = v_effective_limit),
    (SELECT created_at FROM hydrated_results WHERE page_row_num = v_effective_limit),
    (SELECT id FROM hydrated_results WHERE page_row_num = v_effective_limit),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'machine_id', h.machine_id,
            'client_id', h.client_id,
            'operator_id', h.operator_id,
            'log_date', h.log_date,
            'start_time', h.start_time,
            'end_time', h.end_time,
            'start_meter', h.start_meter,
            'end_meter', h.end_meter,
            'running_hours', h.running_hours,
            'normal_working_hours', h.normal_working_hours,
            'overtime_hours', h.overtime_hours,
            'is_breakdown', h.is_breakdown,
            'shift', h.shift,
            'location', h.location,
            'remarks', h.remarks,
            'conflict_flag', h.conflict_flag,
            'conflict_reason', h.conflict_reason,
            'conflict_status', h.conflict_status,
            'created_at', h.created_at,
            'machine_code', h.machine_code,
            'machine_model', h.machine_model,
            'machine_serial', h.machine_serial,
            'client_name', h.client_name,
            'operator_name', h.operator_name,
            'operator_phone', h.operator_phone,
            'machine', jsonb_build_object(
              'id', h.machine_id,
              'machine_code', h.machine_code,
              'model', h.machine_model,
              'serial_number', h.machine_serial
            ),
            'client', jsonb_build_object(
              'id', h.client_id,
              'company_name', h.client_name,
              'client_name', h.client_name
            ),
            'operator', jsonb_build_object(
              'id', h.operator_id,
              'full_name', h.operator_name,
              'phone', h.operator_phone
            )
          )
          ORDER BY h.page_row_num
        )
        FROM hydrated_results h
        WHERE h.page_row_num <= v_effective_limit
      ),
      '[]'::jsonb
    )
  INTO
    v_rec_count,
    v_last_log_date,
    v_last_created_at,
    v_last_id,
    v_rows;

  -- 6. Compute nextCursor if more rows exist (Single-line Base64URL string without newlines)
  IF v_rec_count > v_effective_limit AND v_last_id IS NOT NULL THEN
    v_next_cursor := rtrim(replace(replace(replace(replace(encode(convert_to(jsonb_build_object(
      'd', v_last_log_date,
      'c', to_char(v_last_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'id', v_last_id
    )::text, 'UTF8'), 'base64'), E'\n', ''), E'\r', ''), '+', '-'), '/', '_'), '=');
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'nextCursor', v_next_cursor,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operation_logs TO authenticated, anon, service_role;
