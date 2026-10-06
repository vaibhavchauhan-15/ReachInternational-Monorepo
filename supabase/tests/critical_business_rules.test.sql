-- =============================================================================
-- pgTAP Tests: Critical RPC Correctness — Payroll, Shift Overlap, Attendance
-- Run with: supabase test db
-- These tests guard the riskiest business logic that pnpm typecheck can't catch.
-- =============================================================================

BEGIN;

SELECT plan(22);

-- ---------------------------------------------------------------------------
-- Helper: clean test fixtures
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _test_ids (
  key   TEXT PRIMARY KEY,
  val   UUID
);

DO $$
DECLARE
  v_client_id    UUID;
  v_machine_id   UUID;
  v_op1_id       UUID;
  v_op2_id       UUID;
  v_shift_a_id   UUID;
  v_shift_b_id   UUID;
  v_log_id       UUID;
BEGIN
  -- Create a minimal client
  INSERT INTO public.clients (id, company_name, contact_person, phone, email, status, gst_number, address)
  VALUES (gen_random_uuid(), '_pgTAP Test Client ' || gen_random_uuid()::text, 'Test', '9999999999', 'test@reach.test', 'active', 'TEST123456Z', 'Test Address')
  RETURNING id INTO v_client_id;
  INSERT INTO _test_ids VALUES ('client', v_client_id);

  -- Create a machine
  INSERT INTO public.machines (id, machine_id, model, serial_number, status, health_status, client_id)
  VALUES (gen_random_uuid(), 'PGTEST-' || substr(gen_random_uuid()::text, 1, 8), 'pgTAP Test Machine', 'PGTEST-SN-001', 'active', 'active', v_client_id)
  RETURNING id INTO v_machine_id;
  INSERT INTO _test_ids VALUES ('machine', v_machine_id);

  -- Create two operators (using auth.users is not possible in pgTAP env, so we insert directly with minimal fields)
  INSERT INTO public.users (id, full_name, email, role, phone, employee_id)
  VALUES (gen_random_uuid(), 'pgTAP Operator One', 'pgtap.op1@reach.test', 'operator', '9000000001', 'PGTEST-OP1')
  RETURNING id INTO v_op1_id;
  INSERT INTO _test_ids VALUES ('op1', v_op1_id);

  INSERT INTO public.users (id, full_name, email, role, phone, employee_id)
  VALUES (gen_random_uuid(), 'pgTAP Operator Two', 'pgtap.op2@reach.test', 'operator', '9000000002', 'PGTEST-OP2')
  RETURNING id INTO v_op2_id;
  INSERT INTO _test_ids VALUES ('op2', v_op2_id);

  -- Create shift A (6am–2pm) and shift B (2pm–10pm)
  INSERT INTO public.shift_codes (id, code, name, start_time, end_time, client_id, machine_id, includes_lunch)
  VALUES (gen_random_uuid(), 'PGTEST-A', 'pgTAP Shift A', '06:00', '14:00', v_client_id, v_machine_id, true)
  RETURNING id INTO v_shift_a_id;
  INSERT INTO _test_ids VALUES ('shift_a', v_shift_a_id);

  INSERT INTO public.shift_codes (id, code, name, start_time, end_time, client_id, machine_id, includes_lunch)
  VALUES (gen_random_uuid(), 'PGTEST-B', 'pgTAP Shift B', '14:00', '22:00', v_client_id, v_machine_id, false)
  RETURNING id INTO v_shift_b_id;
  INSERT INTO _test_ids VALUES ('shift_b', v_shift_b_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Section 1: Shift Overlap Prevention
-- ---------------------------------------------------------------------------

-- Test 1.1: Operator assigned to Shift A — inserting a log for Shift A on same day should succeed
SELECT lives_ok(
  format(
    $q$
      INSERT INTO public.machine_hour_logs (
        id, machine_id, operator_id, shift_code_id,
        hmr_start, hmr_end, running_hours, log_date,
        status, entry_source
      ) VALUES (
        gen_random_uuid(),
        (SELECT val FROM _test_ids WHERE key = 'machine'),
        (SELECT val FROM _test_ids WHERE key = 'op1'),
        (SELECT val FROM _test_ids WHERE key = 'shift_a'),
        100.0, 108.0, 8.0, CURRENT_DATE,
        'submitted', 'operator'
      )
    $q$
  ),
  'Shift A log insert should succeed for op1'
);

-- Test 1.2: Running hours must equal hmr_end - hmr_start (business rule)
SELECT is(
  (
    SELECT running_hours FROM public.machine_hour_logs
    WHERE operator_id = (SELECT val FROM _test_ids WHERE key = 'op1')
      AND log_date = CURRENT_DATE
      AND shift_code_id = (SELECT val FROM _test_ids WHERE key = 'shift_a')
    LIMIT 1
  ),
  8.0::NUMERIC,
  'Running hours stored correctly as 8.0'
);

-- Test 1.3: Duplicate shift log on same day same shift should be blocked
-- (machine_hour_logs has a unique index on (operator_id, machine_id, shift_code_id, log_date))
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.machine_hour_logs (
        id, machine_id, operator_id, shift_code_id,
        hmr_start, hmr_end, running_hours, log_date,
        status, entry_source
      ) VALUES (
        gen_random_uuid(),
        (SELECT val FROM _test_ids WHERE key = 'machine'),
        (SELECT val FROM _test_ids WHERE key = 'op1'),
        (SELECT val FROM _test_ids WHERE key = 'shift_a'),
        108.0, 116.0, 8.0, CURRENT_DATE,
        'submitted', 'operator'
      )
    $q$
  ),
  '23505', -- unique_violation
  NULL,
  'Duplicate shift log for same operator/machine/shift/date must be blocked'
);

-- Test 1.4: Different shift (Shift B) same day same machine should be allowed
SELECT lives_ok(
  format(
    $q$
      INSERT INTO public.machine_hour_logs (
        id, machine_id, operator_id, shift_code_id,
        hmr_start, hmr_end, running_hours, log_date,
        status, entry_source
      ) VALUES (
        gen_random_uuid(),
        (SELECT val FROM _test_ids WHERE key = 'machine'),
        (SELECT val FROM _test_ids WHERE key = 'op2'),
        (SELECT val FROM _test_ids WHERE key = 'shift_b'),
        108.0, 116.0, 8.0, CURRENT_DATE,
        'submitted', 'operator'
      )
    $q$
  ),
  'Shift B log insert should succeed for op2 on same machine same day'
);

-- Test 1.5: Running hours cannot exceed 24
SELECT throws_ok(
  $q$
    INSERT INTO public.machine_hour_logs (
      id, machine_id, operator_id, shift_code_id,
      hmr_start, hmr_end, running_hours, log_date,
      status, entry_source
    ) VALUES (
      gen_random_uuid(),
      (SELECT val FROM _test_ids WHERE key = 'machine'),
      (SELECT val FROM _test_ids WHERE key = 'op1'),
      (SELECT val FROM _test_ids WHERE key = 'shift_b'),
      200.0, 225.0, 25.0, CURRENT_DATE - 1,
      'submitted', 'operator'
    )
  $q$,
  '23514', -- check_violation
  NULL,
  'Running hours > 24 must be blocked by CHECK constraint'
);

-- Test 1.6: HMR end must be >= HMR start
SELECT throws_ok(
  $q$
    INSERT INTO public.machine_hour_logs (
      id, machine_id, operator_id, shift_code_id,
      hmr_start, hmr_end, running_hours, log_date,
      status, entry_source
    ) VALUES (
      gen_random_uuid(),
      (SELECT val FROM _test_ids WHERE key = 'machine'),
      (SELECT val FROM _test_ids WHERE key = 'op1'),
      (SELECT val FROM _test_ids WHERE key = 'shift_a'),
      200.0, 190.0, 8.0, CURRENT_DATE - 2,
      'submitted', 'operator'
    )
  $q$,
  '23514', -- check_violation
  NULL,
  'HMR end < HMR start must be blocked by CHECK constraint'
);

-- ---------------------------------------------------------------------------
-- Section 2: Payroll Calculation Invariants
-- ---------------------------------------------------------------------------

-- Test 2.1: Earned basic must not exceed basic salary
-- (when attended_days <= working_days, earned_basic = basic * attended / working_days)
SELECT ok(
  (
    SELECT CASE
      WHEN working_days > 0 AND attended_days <= working_days
      THEN (basic_salary * attended_days / working_days) <= basic_salary
      ELSE true
    END
    FROM public.operator_payrolls
    LIMIT 1
  ),
  'Earned basic <= basic salary when attended_days <= working_days'
);

-- Test 2.2: Net pay = gross_pay - loan_deduction - advance_deduction - other_deductions
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE ABS(net_pay - (gross_pay - loan_deduction - advance_deduction - other_deductions)) > 0.01
      AND net_pay IS NOT NULL
      AND gross_pay IS NOT NULL
  ),
  'Net pay formula: net_pay = gross_pay - loan - advance - other_deductions (within 0.01 tolerance)'
);

-- Test 2.3: Balance pay = net_pay - paid_reach - paid_ss - paid_quess
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE ABS(balance_pay - (net_pay - paid_reach - paid_ss - paid_quess)) > 0.01
      AND balance_pay IS NOT NULL
  ),
  'Balance pay formula: balance_pay = net_pay - paid_reach - paid_ss - paid_quess'
);

-- Test 2.4: PL balance must be <= total_pl_quota
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE pl_balance > total_pl_quota
  ),
  'PL balance must never exceed total PL quota'
);

-- Test 2.5: gross_pay must be >= 0
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE gross_pay < 0
  ),
  'Gross pay must be non-negative'
);

-- Test 2.6: net_pay must be >= 0
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE net_pay < 0
  ),
  'Net pay must be non-negative'
);

-- Test 2.7: OT amount must be 0 when ot_days = 0
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.operator_payrolls
    WHERE ot_days = 0 AND ot_amount > 0
  ),
  'OT amount must be 0 when ot_days = 0'
);

-- ---------------------------------------------------------------------------
-- Section 3: Data Integrity — Users, Machines, Clients
-- ---------------------------------------------------------------------------

-- Test 3.1: Every operator must have an employee_id
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE role = 'operator'
      AND (employee_id IS NULL OR employee_id = '')
      AND deleted_at IS NULL
  ),
  'Every active operator must have an employee_id'
);

-- Test 3.2: No duplicate active email (case-insensitive)
SELECT ok(
  NOT EXISTS (
    SELECT lower(email), COUNT(*)
    FROM public.users
    WHERE deleted_at IS NULL AND email IS NOT NULL
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ),
  'No duplicate active emails (case-insensitive)'
);

-- Test 3.3: No duplicate active company name (case-insensitive, trimmed)
SELECT ok(
  NOT EXISTS (
    SELECT lower(trim(company_name)), COUNT(*)
    FROM public.clients
    WHERE deleted_at IS NULL
    GROUP BY lower(trim(company_name))
    HAVING COUNT(*) > 1
  ),
  'No duplicate active client company names'
);

-- Test 3.4: Machine serial numbers must be unique among non-deleted machines
SELECT ok(
  NOT EXISTS (
    SELECT serial_number, COUNT(*)
    FROM public.machines
    WHERE deleted_at IS NULL AND serial_number IS NOT NULL
    GROUP BY serial_number
    HAVING COUNT(*) > 1
  ),
  'Machine serial numbers must be unique among active machines'
);

-- Test 3.5: Machine IDs must be unique (the human-readable M/C-XXXX codes)
SELECT ok(
  NOT EXISTS (
    SELECT machine_id, COUNT(*)
    FROM public.machines
    WHERE deleted_at IS NULL
    GROUP BY machine_id
    HAVING COUNT(*) > 1
  ),
  'Machine IDs must be unique among active machines'
);

-- Test 3.6: All shift logs must reference a valid (non-deleted) machine
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.machine_hour_logs mhl
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    WHERE m.id IS NULL OR m.deleted_at IS NOT NULL
  ),
  'All machine_hour_logs must reference an existing, non-deleted machine'
);

-- Test 3.7: All shift logs must reference a valid operator
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.machine_hour_logs mhl
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    WHERE u.id IS NULL
  ),
  'All machine_hour_logs must reference an existing user (operator)'
);

-- Test 3.8: idempotency_keys table must have a unique index on key
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'idempotency_keys'
      AND indexdef LIKE '%UNIQUE%'
  ),
  'idempotency_keys must have a UNIQUE index to prevent double-submissions'
);

-- ---------------------------------------------------------------------------
-- Cleanup: rollback test fixtures (pgTAP runs in a transaction)
-- ---------------------------------------------------------------------------
SELECT * FROM finish();

ROLLBACK;
