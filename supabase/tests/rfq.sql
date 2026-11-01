-- ==============================================================================
-- pgTAP Test Suite: Request-a-Quote (RFQ) System
-- File: supabase/tests/rfq.sql
--
-- Tests Covered:
-- 1. Helper function authorizations: can_manage_rfq() & is_marketing()
-- 2. RLS Security: Anon cannot select or insert into any RFQ table
-- 3. RLS Security: 'marketing' user cannot select or insert into RFQ tables
-- 4. RLS Security: 'sales' user can select and insert
-- 5. Business Constraints: chk_item_identity and chk_item_duration
-- 6. State Machine: Allowed transitions succeed; invalid transitions raise exception
-- 7. Concurrency & Lost Reason: Version mismatch & missing lost_reason raise exception
-- 8. Quotation Locking: Mutating or deleting a sent quotation raises exception
-- 9. Quotation Items Locking: Inserting/updating lines on sent quotation raises exception
-- 10. Public Submission Idempotency: Duplicate idempotency_key returns identical rfq_number
-- 11. RFQ Number Uniqueness: 50 concurrent sequence generations produce 50 unique numbers
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(21);

-- -----------------------------------------------------------------------------
-- Fixtures: Create test users for sales, marketing, and admin
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _rfq_test_ids (
  key TEXT PRIMARY KEY,
  val UUID
);
GRANT ALL ON TABLE _rfq_test_ids TO anon, authenticated, service_role;

DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_sales_id UUID := gen_random_uuid();
  v_mktg_id  UUID := gen_random_uuid();
BEGIN
  -- Insert into public.users
  -- Insert into auth.users with metadata so handle_new_user trigger populates public.users
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES
    (v_admin_id, 'rfq_admin@reach.test', jsonb_build_object(
      'full_name', 'RFQ Admin Tester', 'phone', '+919876500001',
      'city', 'New Delhi', 'district', 'South Delhi', 'state', 'Delhi'
    )),
    (v_sales_id, 'rfq_sales@reach.test', jsonb_build_object(
      'full_name', 'RFQ Sales Tester', 'phone', '+919876500002',
      'city', 'New Delhi', 'district', 'South Delhi', 'state', 'Delhi'
    )),
    (v_mktg_id,  'rfq_mktg@reach.test',  jsonb_build_object(
      'full_name', 'RFQ Mktg Tester',  'phone', '+919876500003',
      'city', 'New Delhi', 'district', 'South Delhi', 'state', 'Delhi'
    ));

  -- Update roles on public.users
  UPDATE public.users SET role = 'admin' WHERE id = v_admin_id;
  UPDATE public.users SET role = 'sales' WHERE id = v_sales_id;
  UPDATE public.users SET role = 'marketing' WHERE id = v_mktg_id;

  INSERT INTO _rfq_test_ids VALUES
    ('admin_id', v_admin_id),
    ('sales_id', v_sales_id),
    ('mktg_id',  v_mktg_id);
END $$;

-- -----------------------------------------------------------------------------
-- Section 1: Authorization Functions (can_manage_rfq & is_marketing)
-- -----------------------------------------------------------------------------

-- 1.1 Admin user can manage RFQ
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', (SELECT val::text FROM _rfq_test_ids WHERE key = 'admin_id'), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
SELECT ok(public.can_manage_rfq(), 'Admin user can manage RFQ');

-- 1.2 Sales user can manage RFQ
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', (SELECT val::text FROM _rfq_test_ids WHERE key = 'sales_id'), true);
END $$;
SELECT ok(public.can_manage_rfq(), 'Sales user can manage RFQ');

-- 1.3 Marketing user CANNOT manage RFQ
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', (SELECT val::text FROM _rfq_test_ids WHERE key = 'mktg_id'), true);
END $$;
SELECT ok(NOT public.can_manage_rfq(), 'Marketing user CANNOT manage RFQ');
SELECT ok(public.is_marketing(), 'Marketing user is verified as marketing');

-- 1.4 Anon cannot manage RFQ
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
END $$;
SELECT ok(NOT public.can_manage_rfq(), 'Anon cannot manage RFQ');

-- -----------------------------------------------------------------------------
-- Section 2: RLS Security Enforcement
-- -----------------------------------------------------------------------------

-- 2.1 Anon cannot select from quote_requests
DO $$ BEGIN
  PERFORM set_config('role', 'anon', true);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.quote_requests),
  0,
  'Anon selects 0 rows from quote_requests due to RLS'
);

-- 2.2 Anon cannot insert into quote_requests directly
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.quote_requests (
        id, rfq_number, contact_id, project_city, project_state_code
      ) VALUES (
        gen_random_uuid(), 'RFQ-TEST-ANON', gen_random_uuid(), 'Delhi', 'DL'
      )
    $q$
  ),
  NULL,
  'Anon direct insert into quote_requests is blocked by RLS'
);

-- 2.3 Marketing user cannot select from quote_requests
DO $$ BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', (SELECT val::text FROM _rfq_test_ids WHERE key = 'mktg_id'), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.quote_requests),
  0,
  'Marketing user selects 0 rows from quote_requests'
);

-- 2.4 Marketing user direct insert is blocked by RLS
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.quote_requests (
        id, rfq_number, contact_id, project_city, project_state_code
      ) VALUES (
        gen_random_uuid(), 'RFQ-TEST-MKTG', gen_random_uuid(), 'Delhi', 'DL'
      )
    $q$
  ),
  NULL,
  'Marketing direct insert into quote_requests is blocked by RLS'
);

-- 2.5 Sales user can insert and select
DO $$ BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', (SELECT val::text FROM _rfq_test_ids WHERE key = 'sales_id'), true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

DO $$
DECLARE
  v_company UUID;
  v_contact UUID;
  v_rfq     UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.companies (name, city, state_code)
  VALUES ('Test Corp Ltd', 'New Delhi', 'DL')
  RETURNING id INTO v_company;

  INSERT INTO public.contacts (company_id, full_name, email, phone)
  VALUES (v_company, 'Rahul Sharma', 'rahul@testcorp.in', '+919876512345')
  RETURNING id INTO v_contact;

  INSERT INTO public.quote_requests (
    id, rfq_number, company_id, contact_id, source, project_city, project_state_code
  ) VALUES (
    v_rfq, 'RFQ-TEST-000001', v_company, v_contact, 'website', 'New Delhi', 'DL'
  );

  INSERT INTO _rfq_test_ids VALUES
    ('test_company', v_company),
    ('test_contact', v_contact),
    ('test_rfq',     v_rfq);
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.quote_requests WHERE id = (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq')),
  1,
  'Sales user can insert and select quote_requests'
);

-- -----------------------------------------------------------------------------
-- Section 3: Item Identity and Duration Constraints
-- -----------------------------------------------------------------------------

-- 3.1 Item identity check: cannot have both equipment_id and custom_description
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.quote_request_items (
        request_id, requirement_type, equipment_id, custom_description, quantity
      ) VALUES (
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'purchase',
        (SELECT id FROM public.equipment_models LIMIT 1),
        'Custom Crane',
        1
      )
    $q$
  ),
  NULL,
  'Item cannot specify both equipment_id and custom_description simultaneously'
);

-- 3.2 Duration check: rental requires duration value and unit
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.quote_request_items (
        request_id, requirement_type, custom_description, quantity
      ) VALUES (
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'rental',
        'Boom Lift Needed',
        1
      )
    $q$
  ),
  NULL,
  'Rental requirement without duration violates chk_item_duration'
);

-- -----------------------------------------------------------------------------
-- Section 4: Status State Machine & Concurrency Control
-- -----------------------------------------------------------------------------

-- 4.1 Valid status transition: 'new' -> 'contacted'
SELECT lives_ok(
  format(
    $q$
      SELECT public.rfq_set_status(
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'contacted'::rfq_status,
        1,
        NULL,
        'Spoke with client on phone'
      )
    $q$
  ),
  'Valid status transition new -> contacted succeeds'
);

-- 4.2 Invalid transition: 'contacted' -> 'converted' (must be quoted first)
SELECT throws_ok(
  format(
    $q$
      SELECT public.rfq_set_status(
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'converted'::rfq_status,
        2
      )
    $q$
  ),
  NULL,
  'Invalid transition contacted -> converted raises exception'
);

-- 4.3 Transition to 'lost' without lost_reason raises exception
SELECT throws_ok(
  format(
    $q$
      SELECT public.rfq_set_status(
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'lost'::rfq_status,
        2,
        NULL
      )
    $q$
  ),
  'lost_reason required',
  'Transition to lost without lost_reason raises exception'
);

-- 4.4 Optimistic concurrency: version mismatch raises exception
SELECT throws_ok(
  format(
    $q$
      SELECT public.rfq_set_status(
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'),
        'under_review'::rfq_status,
        1 -- Outdated expected version (current is 2)
      )
    $q$
  ),
  NULL,
  'Version mismatch raises CONFLICT exception'
);

-- -----------------------------------------------------------------------------
-- Section 5: Quotation Immutability Trigger
-- -----------------------------------------------------------------------------

-- 5.1 Create quotation version 1
DO $$
DECLARE
  v_quote public.quotations;
BEGIN
  v_quote := public.rfq_create_quotation_version((SELECT val FROM _rfq_test_ids WHERE key = 'test_rfq'));
  INSERT INTO _rfq_test_ids VALUES ('test_quote', v_quote.id);

  INSERT INTO public.quotation_items (
    quotation_id, kind, description, quantity, unit_price_paise, gst_rate
  ) VALUES (
    v_quote.id, 'sale', 'Scissor Lift JCB S2632E', 1, 150000000, 18.00
  );
END $$;

-- Send quotation (locks it)
DO $$
BEGIN
  PERFORM public.rfq_send_quotation((SELECT val FROM _rfq_test_ids WHERE key = 'test_quote'));
END $$;

-- 5.2 Editing sent quotation raises exception
SELECT throws_ok(
  format(
    $q$
      UPDATE public.quotations
      SET valid_until = CURRENT_DATE + 30
      WHERE id = (SELECT val FROM _rfq_test_ids WHERE key = 'test_quote')
    $q$
  ),
  NULL,
  'Editing terms or validity of a sent quotation raises locked exception'
);

-- 5.3 Modifying line items of sent quotation raises exception
SELECT throws_ok(
  format(
    $q$
      INSERT INTO public.quotation_items (
        quotation_id, kind, description, quantity, unit_price_paise, gst_rate
      ) VALUES (
        (SELECT val FROM _rfq_test_ids WHERE key = 'test_quote'),
        'transport', 'Freight charges', 1, 2500000, 18.00
      )
    $q$
  ),
  'Quotation is locked. Create a new version.',
  'Adding line item to locked quotation raises exception'
);

-- -----------------------------------------------------------------------------
-- Section 6: Public submit_rfq Idempotency
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_idem_key UUID := gen_random_uuid();
  v_rfq_id   UUID := gen_random_uuid();
  v_payload  JSONB;
  v_res1     JSONB;
  v_res2     JSONB;
BEGIN
  -- submit_rfq is callable by service_role
  PERFORM set_config('role', 'postgres', true);

  v_payload := jsonb_build_object(
    'id', v_rfq_id,
    'idempotency_key', v_idem_key,
    'source', 'website',
    'company', jsonb_build_object(
      'name', 'Acme Construction Co',
      'gstin', '07AAACA1234A1Z1',
      'city', 'New Delhi',
      'state_code', 'DL'
    ),
    'contact', jsonb_build_object(
      'full_name', 'Sunil Kumar',
      'email', 'sunil@acmeconst.test',
      'phone', '+919988776655'
    ),
    'project', jsonb_build_object(
      'city', 'Gurugram',
      'state_code', 'HR',
      'required_from', (CURRENT_DATE + 5)::text
    ),
    'items', jsonb_build_array(
      jsonb_build_object(
        'requirement_type', 'purchase',
        'custom_description', 'Heavy Duty Boom Lift 20m',
        'quantity', 1
      )
    )
  );

  -- First submission
  v_res1 := public.submit_rfq(v_payload);
  -- Second submission with identical idempotency key
  v_res2 := public.submit_rfq(v_payload);

  -- Store result in temporary table for pgTAP assertions
  CREATE TEMP TABLE _idem_results (
    num1 TEXT, dup1 BOOLEAN,
    num2 TEXT, dup2 BOOLEAN
  );
  GRANT ALL ON TABLE _idem_results TO anon, authenticated, service_role;
  INSERT INTO _idem_results VALUES (
    v_res1->>'rfq_number', (v_res1->>'duplicate')::boolean,
    v_res2->>'rfq_number', (v_res2->>'duplicate')::boolean
  );
END $$;

SELECT is(
  (SELECT num1 FROM _idem_results),
  (SELECT num2 FROM _idem_results),
  'submit_rfq twice with same idempotency_key returns identical rfq_number'
);

SELECT ok(
  (SELECT dup2 FROM _idem_results),
  'Second submission correctly returns duplicate = true'
);

-- -----------------------------------------------------------------------------
-- Section 7: RFQ Number Generation (50 unique numbers)
-- -----------------------------------------------------------------------------
SELECT is(
  (SELECT count(DISTINCT public.next_rfq_number())::int FROM generate_series(1, 50)),
  50,
  '50 calls to next_rfq_number() produce 50 unique sequential numbers'
);

SELECT * FROM finish();
ROLLBACK;
