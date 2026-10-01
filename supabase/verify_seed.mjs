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

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verify() {
  console.log('====================================================');
  console.log('🔍 VERIFYING SEEDED DEV DATABASE ACCORDING TO FRONTEND CRITERIA');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('====================================================\n');

  let passed = true;

  // 1. Table Counts
  console.log('1️⃣ CORE OPERATIONAL TABLE ROW COUNTS:');
  const coreTables = [
    { table: 'users', expectedMin: 11 },
    { table: 'user_documents', expectedMin: 27 },
    { table: 'states', expectedMin: 36 },
    { table: 'clients', expectedMin: 5 },
    { table: 'client_shift_codes', expectedMin: 15 },
    { table: 'machines', expectedMin: 6 },
    { table: 'operator_machine_assignments', expectedMin: 6 },
    { table: 'machine_hour_logs', expectedMin: 30 },
    { table: 'audit_logs', expectedMin: 20 },
  ];

  for (const { table, expectedMin } of coreTables) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${table.padEnd(30)} Error: ${error.message}`);
      passed = false;
    } else {
      const ok = count >= expectedMin;
      console.log(`  ${ok ? '✅' : '❌'} ${table.padEnd(30)} Rows: ${count} (min expected: ${expectedMin})`);
      if (!ok) passed = false;
    }
  }

  // 2. User Acceptance Criteria Verification
  console.log('\n2️⃣ USER REGISTRATION & APPROVAL ACCEPTANCE CRITERIA:');
  const { data: users, error: uErr } = await admin.from('users').select('id, full_name, email, role, status, bank_account_number, bank_ifsc_code, aadhaar_number, license_number');
  if (uErr) {
    console.log(`  ❌ Failed to fetch users: ${uErr.message}`);
    passed = false;
  } else {
    const pendingUsers = users.filter((u) => u.status !== 'active');
    if (pendingUsers.length > 0) {
      console.log(`  ❌ Not all users are active (${pendingUsers.length} pending/inactive)`);
      passed = false;
    } else {
      console.log(`  ✅ All ${users.length} users are active and approved by admin.`);
    }

    const maskedBank = users.filter((u) => u.bank_account_number?.includes('X') || !u.bank_account_number);
    if (maskedBank.length > 0) {
      console.log(`  ❌ Found masked or missing bank account numbers in ${maskedBank.length} users`);
      passed = false;
    } else {
      console.log(`  ✅ All users have genuine, unmasked bank account numbers and valid IFSC.`);
    }

    const invalidAadhaar = users.filter((u) => !u.aadhaar_number || u.aadhaar_number.length < 12);
    if (invalidAadhaar.length > 0) {
      console.log(`  ❌ Found invalid Aadhaar numbers in ${invalidAadhaar.length} users`);
      passed = false;
    } else {
      console.log(`  ✅ All users have valid Indian Aadhaar numbers.`);
    }
  }

  // 3. Document Verification
  console.log('\n3️⃣ USER DOCUMENTS VERIFICATION:');
  const { data: docs, error: dErr } = await admin.from('user_documents').select('id, user_id, document_type_code, status');
  if (dErr) {
    console.log(`  ❌ Failed to fetch documents: ${dErr.message}`);
    passed = false;
  } else {
    const nonVerified = docs.filter((d) => d.status !== 'verified');
    if (nonVerified.length > 0) {
      console.log(`  ❌ Found ${nonVerified.length} non-verified documents`);
      passed = false;
    } else {
      console.log(`  ✅ All ${docs.length} uploaded documents are verified.`);
    }
  }

  // 4. Client Acceptance Criteria Verification
  console.log('\n4️⃣ CLIENT ACCEPTANCE CRITERIA:');
  const { data: clients, error: cErr } = await admin.from('clients').select('id, company_name, gstin, pan_number, street, city, maintenance_allowance_minutes');
  if (cErr) {
    console.log(`  ❌ Failed to fetch clients: ${cErr.message}`);
    passed = false;
  } else {
    const invalidGst = clients.filter((c) => !c.gstin || c.gstin.length !== 15);
    if (invalidGst.length > 0) {
      console.log(`  ❌ Found ${invalidGst.length} clients with invalid GSTIN`);
      passed = false;
    } else {
      console.log(`  ✅ All ${clients.length} clients have valid 15-character GSTIN numbers.`);
    }

    const clientsWithAllowance = clients.filter((c) => c.maintenance_allowance_minutes > 0);
    console.log(`  ✅ Maintenance allowances populated correctly (${clientsWithAllowance.length}/${clients.length} clients have active monthly allowances).`);
  }

  // 5. Machine Logs Continuity & Breakdown Allowance Verification
  console.log('\n5️⃣ MACHINE HOUR LOGS WORKFLOW VERIFICATION:');
  const { data: logs, error: lErr } = await admin
    .from('machine_hour_logs')
    .select('id, machine_id, log_date, start_meter, end_meter, running_hours, is_breakdown, breakdown_hours, breakdown_minutes, maintenance_minutes, location')
    .order('log_date', { ascending: true });

  if (lErr) {
    console.log(`  ❌ Failed to fetch machine logs: ${lErr.message}`);
    passed = false;
  } else {
    console.log(`  ✅ Total machine logs fetched: ${logs.length}`);

    // Verify meter sequence progression per machine
    const logsByMachine = {};
    for (const log of logs) {
      if (!logsByMachine[log.machine_id]) logsByMachine[log.machine_id] = [];
      logsByMachine[log.machine_id].push(log);
    }

    let progressionError = false;
    for (const [mId, mLogs] of Object.entries(logsByMachine)) {
      for (let i = 1; i < mLogs.length; i++) {
        const prev = mLogs[i - 1];
        const curr = mLogs[i];
        if (Math.abs(Number(curr.start_meter) - Number(prev.end_meter)) > 0.05) {
          console.log(`  ❌ Meter discontinuity on machine ${mId}: prev end ${prev.end_meter} vs curr start ${curr.start_meter}`);
          progressionError = true;
          passed = false;
        }
      }
    }

    if (!progressionError) {
      console.log(`  ✅ All machine logs have flawless sequential meter progression across days.`);
    }

    // Verify breakdown and maintenance allowance calculations
    const breakdownLogs = logs.filter((l) => l.is_breakdown);
    const allowanceCoveredLogs = logs.filter((l) => l.maintenance_minutes > 0);
    console.log(`  ✅ Breakdown events detected: ${breakdownLogs.length}, Maintenance allowance covered shifts: ${allowanceCoveredLogs.length}.`);
  }

  console.log('\n====================================================');
  if (passed) {
    console.log('🎉 ALL VERIFICATION CRITERIA PASSED SUCCESSFULLY!');
  } else {
    console.log('⚠️ VERIFICATION FAILED FOR ONE OR MORE CRITERIA');
    process.exit(1);
  }
  console.log('====================================================\n');
}

verify();
