import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/web/.env.local'),
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...vals] = trimmed.split('=');
          if (key && vals.length > 0) {
            const k = key.trim();
            const v = vals.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      });
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

if (SUPABASE_URL.includes('dhbbgfzbyatzvqafnsqp') || SUPABASE_SECRET_KEY.includes('dhbbgfzbyatzvqafnsqp')) {
  console.error('FATAL ERROR: Target database is PRODUCTION! Testing on production is STRICTLY FORBIDDEN.');
  process.exit(1);
}

console.log('================================================================');
console.log('  RFQ SYSTEM — AUTOMATED VERIFICATION & TEST SUITE             ');
console.log('================================================================');
console.log('Target Dev DB:', SUPABASE_URL);

const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const anonClient = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('\n--- 1. File & Schema Asset Verification ---');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261101061529_rfq.sql');
  const seedPath = path.resolve(process.cwd(), 'supabase/seed.rfq.sql');
  const testSqlPath = path.resolve(process.cwd(), 'supabase/tests/rfq.sql');

  assert(fs.existsSync(migrationPath), 'Migration supabase/migrations/20261101061529_rfq.sql exists');
  assert(fs.existsSync(seedPath), 'Seed supabase/seed.rfq.sql exists');
  assert(fs.existsSync(testSqlPath), 'pgTAP test suite supabase/tests/rfq.sql exists');

  console.log('\n--- 2. Public States & Lookups Verification ---');
  const { data: states, error: statesErr } = await adminClient
    .from('states')
    .select('id, name, code, gst_state_code')
    .order('id');

  assert(!statesErr && states?.length === 36, `States table has exactly 36 Indian states & UTs (found ${states?.length})`);
  const allHaveCodes = states?.every((s) => s.code && s.gst_state_code);
  assert(allHaveCodes, 'All 36 states have non-null code and gst_state_code');

  console.log('\n--- 3. Business Profile Singleton Verification ---');
  const { data: bp, error: bpErr } = await adminClient
    .from('business_profile')
    .select('*')
    .single();

  assert(!bpErr && bp?.id === true, 'business_profile exists with id = true');
  assert(bp?.legal_name?.includes('Reach International'), `business_profile legal_name is valid: "${bp?.legal_name}"`);
  assert(bp?.state_code === 'DL', `business_profile default state_code is DL (Delhi)`);
  assert(Number(bp?.default_gst_rate) === 18, `business_profile default_gst_rate is 18.00%`);
  assert(bp?.rfq_notify_emails?.length > 0, `business_profile has notify emails configured (${bp?.rfq_notify_emails?.join(', ')})`);

  console.log('\n--- 4. Anonymous RLS Perimeter Gate (Zero Trust) ---');
  if (anonClient) {
    // 4.1 Anon can read states
    const { data: anonStates, error: anonStatesErr } = await anonClient
      .from('states')
      .select('code, name')
      .limit(5);
    assert(!anonStatesErr && anonStates?.length > 0, 'Anon CAN read public states table');

    // 4.2 Anon CANNOT read quote_requests
    const { data: anonQr } = await anonClient.from('quote_requests').select('*');
    assert(!anonQr || anonQr.length === 0, 'Anon selects 0 rows from quote_requests');

    // 4.3 Anon CANNOT insert into quote_requests
    const { error: anonInsertErr } = await anonClient.from('quote_requests').insert({
      id: '00000000-0000-0000-0000-000000000001',
      contact_id: '00000000-0000-0000-0000-000000000002',
      project_city: 'Delhi',
      project_state_code: 'DL',
    });
    assert(anonInsertErr !== null, 'Anon direct insert into quote_requests is blocked by RLS');

    // 4.4 Anon CANNOT read quotations
    const { data: anonQuotes } = await anonClient.from('quotations').select('*');
    assert(!anonQuotes || anonQuotes.length === 0, 'Anon selects 0 rows from quotations');

    // 4.5 Anon CANNOT read companies or contacts
    const { data: anonCos } = await anonClient.from('companies').select('*');
    assert(!anonCos || anonCos.length === 0, 'Anon selects 0 rows from companies');

    const { data: anonCons } = await anonClient.from('contacts').select('*');
    assert(!anonCons || anonCons.length === 0, 'Anon selects 0 rows from contacts');
  } else {
    console.log('  ⚠ Skipping anonClient network tests (ANON key not provided in env)');
  }

  console.log('\n--- 5. Storage Buckets & Privacy Verification ---');
  const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
  assert(!bucketErr, 'Storage buckets queried successfully');

  const attBucket = buckets?.find((b) => b.id === 'rfq-attachments');
  assert(attBucket !== undefined, 'Storage bucket "rfq-attachments" exists');
  assert(attBucket?.public === false, 'Storage bucket "rfq-attachments" is strictly PRIVATE');

  const quoteBucket = buckets?.find((b) => b.id === 'rfq-quotations');
  assert(quoteBucket !== undefined, 'Storage bucket "rfq-quotations" exists');
  assert(quoteBucket?.public === false, 'Storage bucket "rfq-quotations" is strictly PRIVATE');

  console.log('\n--- 6. Status Machine & Allowed Transitions ---');
  const { data: transitions, error: transErr } = await adminClient
    .from('rfq_status_transitions')
    .select('from_status, to_status');
  assert(!transErr && transitions?.length === 21, `rfq_status_transitions has all 21 valid transitions (found ${transitions?.length})`);

  console.log('\n--- 7. Atomic Public Submission RPC (submit_rfq) & Idempotency ---');
  const testId = crypto.randomUUID();
  const testKey = crypto.randomUUID();
  const testEmail = `rfq_test_${Date.now()}@reach.test`;
  const testCompanyName = `Automated RFQ Test Infra ${Date.now()}`;

  const submissionPayload = {
    id: testId,
    idempotency_key: testKey,
    source: 'website',
    company: {
      name: testCompanyName,
      gstin: '07AAACA9999Z1Z9',
      city: 'New Delhi',
      state_code: 'DL',
    },
    contact: {
      full_name: 'Automation Tester',
      email: testEmail,
      phone: '+919876543299',
    },
    project: {
      city: 'Gurugram',
      state_code: 'HR',
      required_from: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      site_address: 'Sector 48, Cyber City',
    },
    items: [
      {
        requirement_type: 'purchase',
        custom_description: 'Automated Test Crane 25T',
        quantity: 1,
        sort_order: 0,
      },
    ],
    attachments: [],
  };

  // First submit
  const { data: submitRes1, error: submitErr1 } = await adminClient.rpc('submit_rfq', {
    p: submissionPayload,
  });

  assert(!submitErr1 && submitRes1?.rfq_number, `submit_rfq() succeeded with number: ${submitRes1?.rfq_number}`);
  assert(submitRes1?.duplicate === false, 'First submission returned duplicate = false');

  // Second submit with identical idempotency key
  const { data: submitRes2, error: submitErr2 } = await adminClient.rpc('submit_rfq', {
    p: submissionPayload,
  });

  assert(!submitErr2, 'Second submission succeeded without error');
  assert(submitRes2?.rfq_number === submitRes1?.rfq_number, 'Second submission returned identical rfq_number');
  assert(submitRes2?.duplicate === true, 'Second submission returned duplicate = true');

  // Verify created RFQ record
  const { data: createdRfq } = await adminClient
    .from('quote_requests')
    .select('*, quote_request_items(*), rfq_events(*)')
    .eq('id', testId)
    .single();

  assert(createdRfq?.rfq_number === submitRes1?.rfq_number, 'Created quote_request record matches generated rfq_number');
  assert(createdRfq?.quote_request_items?.length === 1, 'Created quote_request has 1 line item');
  assert(createdRfq?.rfq_events?.some((e) => e.type === 'created'), 'Created quote_request has "created" timeline event');

  // Verify email_outbox rows
  const { data: outboxRows } = await adminClient
    .from('email_outbox')
    .select('*')
    .eq('request_id', testId);

  assert(outboxRows?.some((o) => o.template === 'client_confirmation'), 'email_outbox has client_confirmation email enqueued');

  // Clean up test RFQ
  await adminClient.from('email_outbox').delete().eq('request_id', testId);
  await adminClient.from('quote_requests').delete().eq('id', testId);
  await adminClient.from('contacts').delete().eq('email', testEmail);
  await adminClient.from('companies').delete().eq('name', testCompanyName);

  console.log('\n--- 8. Derived Views & Functions Verification ---');
  const { data: listRows, error: listErr } = await adminClient
    .from('rfq_list')
    .select('*')
    .limit(5);

  assert(!listErr, 'rfq_list view queried successfully');

  const fromDate = new Date(Date.now() - 30 * 86400000).toISOString();
  const toDate = new Date().toISOString();
  const { data: dash, error: dashErr } = await adminClient.rpc('rfq_dashboard', {
    p_from: fromDate,
    p_to: toDate,
  });

  assert(!dashErr && dash?.total !== undefined, `rfq_dashboard() executed successfully: total=${dash?.total}, new=${dash?.new}`);

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED       `);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`\x1b[31mFAIL: ${failed} assertion(s) failed.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mSUCCESS: All ${passed} assertions passed cleanly.\x1b[0m\n`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
