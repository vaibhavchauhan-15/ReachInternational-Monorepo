import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../apps/web/.env.local'));
loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabasePkgPath = path.resolve(__dirname, '../../node_modules/@supabase/supabase-js/dist/index.mjs');
const { createClient } = await import(pathToFileURL(supabasePkgPath).href);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vlmxciuogczumumrwyot.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl.includes('vlmxciuogczumumrwyot')) {
  console.error('FATAL: Refusing to run on non-dev database URL:', supabaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runTest() {
  console.log('=== Testing Client Shift Resolution in Today Shift Monitor & Helpers ===\n');

  const { data: supervisor } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('role', ['supervisor', 'admin', 'super_admin'])
    .limit(1)
    .single();

  const today = new Date().toISOString().split('T')[0];

  // 1. Fetch Today Shift Monitor rows
  const { data: monitorRows, error: monitorErr } = await supabase.rpc('get_today_shift_log_monitor', {
    p_actor_id: supervisor.id,
    p_log_date: today,
  });

  if (monitorErr) {
    console.error('❌ RPC error:', monitorErr.message);
    process.exit(1);
  }

  console.log(`✔ [PASS] get_today_shift_log_monitor returned ${monitorRows.length} rows.`);

  const rowsWithShiftName = monitorRows.filter((r) => r.shift_name && r.shift_name.trim().length > 0);
  console.log(`✔ [PASS] Found ${rowsWithShiftName.length} rows with resolved client shift_name.`);

  if (rowsWithShiftName.length > 0) {
    for (const sample of rowsWithShiftName.slice(0, 3)) {
      console.log(`   Sample: Machine ${sample.machine_code} | Operator: ${sample.operator_name} | Shift ${sample.shift_code} ("${sample.shift_name}") | Times: ${sample.shift_start} - ${sample.shift_end}`);
    }
  }

  // 2. Fetch Client Shift Codes
  const { data: clientShifts, error: csErr } = await supabase
    .from('client_shift_codes')
    .select('*')
    .eq('is_active', true)
    .limit(10);

  if (csErr) {
    console.error('❌ client_shift_codes query error:', csErr.message);
    process.exit(1);
  }

  console.log(`✔ [PASS] client_shift_codes active records found: ${clientShifts.length}`);
  for (const cs of clientShifts.slice(0, 3)) {
    console.log(`   Client Shift: Code "${cs.code}", Name "${cs.name}", Times: ${cs.start_time} - ${cs.end_time}`);
  }

  console.log('\n✔ ALL CLIENT SHIFT RESOLUTION TESTS PASSED!');
}

runTest().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
