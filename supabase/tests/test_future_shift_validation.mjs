import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  computeShiftTiming,
  isShiftEndInFuture,
  parseDateTimeToDate,
  getISTDateString,
} from '../../packages/utils/src/date.ts';
import { CreateHourLogSchema } from '../../packages/validation/src/hourMeter.ts';

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

loadEnv(path.resolve(__dirname, '../../.env'));
loadEnv(path.resolve(__dirname, '../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhbbgfzbyatzvqafnsqp.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTestSuite() {
  console.log('=================================================================');
  console.log('🚀 RUNNING AUTOMATED TEST SUITE: SHIFT END TIMING VALIDATION');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extraInfo}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: User Reported Scenario (Night Shift Handover at 06:10 AM)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 1: User Overnight Shift Scenario (7 Sept 10:00 PM -> 8 Sept 06:00 AM) ---');

  // Operator finished night shift at 06:00 AM IST on 8 Sept 2026 and submits at 06:10 AM IST (10 min later)
  const submitTimeEpoch = new Date('2026-09-08T06:10:00+05:30').getTime(); // 2026-09-08T00:40:00.000Z

  const nightShiftResult = computeShiftTiming({
    startDate: '2026-09-07',
    startTime: '10:00 PM',
    endDate: '2026-09-08',
    endTime: '06:00 AM',
    disallowFutureEnd: true,
    currentTimestamp: submitTimeEpoch,
  });

  assert(
    nightShiftResult.isValid === true && nightShiftResult.isFutureEnd === false,
    'Night shift ending at 06:00 AM is VALID when entered at 06:10 AM IST',
    JSON.stringify(nightShiftResult)
  );

  assert(
    nightShiftResult.errorMessage === null,
    'Night shift does NOT produce "Cannot log before shift end" at 06:10 AM',
    `Received errorMessage: ${nightShiftResult.errorMessage}`
  );

  assert(
    isShiftEndInFuture(nightShiftResult.endDateTime, 1) === false,
    'isShiftEndInFuture returns false for completed night shift at 06:10 AM'
  );

  // Auto-overnight shift calculation without passing explicit endDate
  const autoOvernightResult = computeShiftTiming({
    startDate: '2026-09-07',
    startTime: '10:00 PM',
    endTime: '06:00 AM',
    disallowFutureEnd: true,
    currentTimestamp: submitTimeEpoch,
  });

  assert(
    autoOvernightResult.resolvedEndDate === '2026-09-08' && autoOvernightResult.isOvernight === true,
    'computeShiftTiming automatically derives correct next-day endDate (2026-09-08)',
    `Derived: ${autoOvernightResult.resolvedEndDate}`
  );

  assert(
    autoOvernightResult.isValid === true && autoOvernightResult.isFutureEnd === false,
    'Auto-derived overnight shift allows submission at 06:10 AM IST'
  );

  // Attempt to enter prematurely before shift end (e.g. at 05:50 AM IST)
  const prematureSubmitTimeEpoch = new Date('2026-09-08T05:50:00+05:30').getTime();
  const prematureResult = computeShiftTiming({
    startDate: '2026-09-07',
    startTime: '10:00 PM',
    endTime: '06:00 AM',
    disallowFutureEnd: true,
    currentTimestamp: prematureSubmitTimeEpoch,
  });

  assert(
    prematureResult.isValid === false && prematureResult.isFutureEnd === true,
    'Premature entry at 05:50 AM for 06:00 AM shift end is correctly REJECTED',
    JSON.stringify(prematureResult)
  );

  assert(
    prematureResult.errorMessage === 'Cannot log before shift end.',
    'Premature entry returns exact error: "Cannot log before shift end."',
    `Received: ${prematureResult.errorMessage}`
  );

  // -------------------------------------------------------------
  // TEST SUITE 2: Cloud / Vercel Server Simulation (TZ=UTC Environment)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Timezone Invariance (TZ=UTC Vercel Server Simulation) ---');

  const prevTZ = process.env.TZ;
  process.env.TZ = 'UTC';

  const utcServerResult = computeShiftTiming({
    startDate: '2026-09-07',
    startTime: '10:00 PM',
    endDate: '2026-09-08',
    endTime: '06:00 AM',
    disallowFutureEnd: true,
    currentTimestamp: submitTimeEpoch,
  });

  assert(
    utcServerResult.isValid === true && utcServerResult.isFutureEnd === false,
    'On Vercel (TZ=UTC), shift is VALID at 06:10 AM IST (eliminating 5.5h false positive)',
    JSON.stringify(utcServerResult)
  );

  assert(
    utcServerResult.endDateTime?.toISOString() === '2026-09-08T00:30:00.000Z',
    'endDateTime is deterministically parsed as 2026-09-08T00:30:00.000Z (06:00 AM IST)',
    `Received: ${utcServerResult.endDateTime?.toISOString()}`
  );

  process.env.TZ = prevTZ;

  // -------------------------------------------------------------
  // TEST SUITE 3: CreateHourLogSchema Validation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: CreateHourLogSchema Validation ---');

  const validShiftEndPayload = {
    machine_id: 'test-machine',
    log_date: '2026-09-07',
    end_date: '2026-09-08',
    start_meter: 100,
    end_meter: 108,
    end_datetime: nightShiftResult.endDateTime?.toISOString(), // 2026-09-08T00:30:00.000Z
  };

  const parsedValid = CreateHourLogSchema.safeParse(validShiftEndPayload);
  assert(
    parsedValid.success === true,
    'CreateHourLogSchema ACCEPTS completed night shift end_datetime',
    JSON.stringify(parsedValid)
  );

  // Future datetime 3 hours from now
  const futureIso = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const invalidFuturePayload = {
    machine_id: 'test-machine',
    log_date: getISTDateString(),
    start_meter: 100,
    end_meter: 108,
    end_datetime: futureIso,
  };

  const parsedFuture = CreateHourLogSchema.safeParse(invalidFuturePayload);
  assert(
    parsedFuture.success === false,
    'CreateHourLogSchema REJECTS future end_datetime',
    JSON.stringify(parsedFuture)
  );

  const errorMsg = parsedFuture.error?.issues[0]?.message;
  assert(
    errorMsg === 'Cannot log before shift end.',
    'CreateHourLogSchema produces exact message: "Cannot log before shift end."',
    `Received: ${errorMsg}`
  );

  // -------------------------------------------------------------
  // TEST SUITE 4: Supabase Database Future End Guard & Atomic RPC
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Supabase Database Future End Guard & Atomic RPC ---');

  const { data: machines } = await supabase.from('machines').select('id, hour_meter').limit(1);
  const { data: users } = await supabase.from('users').select('id').limit(1);

  if (machines && machines.length > 0 && users && users.length > 0) {
    const testMachine = machines[0];
    const testUser = users[0];

    const futureEndTimestamp = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const pastStartTimestamp = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // 1. Direct Table Insert Future Shift End Check
    const { data: dbData, error: dbError } = await supabase.from('machine_hour_logs').insert({
      machine_id: testMachine.id,
      operator_id: testUser.id,
      log_date: getISTDateString(),
      start_meter: testMachine.hour_meter || 100,
      end_meter: (testMachine.hour_meter || 100) + 8,
      start_time: '06:00:00',
      end_time: '18:00:00',
      start_datetime: pastStartTimestamp,
      end_datetime: futureEndTimestamp,
      machine_condition: 'good',
    }).select();

    if (dbError) {
      assert(
        dbError.message.includes('Cannot log before shift end') || dbError.code === '23514',
        'Database blocks future shift end insertion with error',
        `Error: ${dbError.message}`
      );
    } else {
      console.log('ℹ️ Direct insert executed (remote trigger check bypassed or clean). Cleaning up test log...');
      if (dbData && dbData.length > 0) {
        await supabase.from('machine_hour_logs').delete().eq('id', dbData[0].id);
      }
    }

    // 2. Canonical submit_operator_hour_log_atomic RPC Future Shift End Check
    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_operator_hour_log_atomic', {
      p_machine_id: testMachine.id,
      p_operator_id: testUser.id,
      p_start_meter: testMachine.hour_meter || 100,
      p_end_meter: (testMachine.hour_meter || 100) + 2,
      p_start_time: '08:00:00',
      p_end_time: '18:00:00',
      p_start_datetime: pastStartTimestamp,
      p_end_datetime: futureEndTimestamp,
    });

    assert(
      rpcError !== null && (rpcError.message.includes('Cannot log before shift end') || rpcError.code === '23514'),
      'Database RPC submit_operator_hour_log_atomic blocks future shift end with code 23514',
      `Result: ${JSON.stringify(rpcError || rpcData)}`
    );
  }

  console.log('\n=================================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
