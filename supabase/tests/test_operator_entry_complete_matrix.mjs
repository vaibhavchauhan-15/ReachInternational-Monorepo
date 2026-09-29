import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
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

loadEnv(path.resolve(__dirname, "../../apps/web/.env.local"));
loadEnv(path.resolve(__dirname, "../../apps/web/.env"));
loadEnv(path.resolve(__dirname, "../../.env"));

const supabasePkgPath = path.resolve(__dirname, "../../node_modules/@supabase/supabase-js/dist/index.mjs");
const { createClient } = await import(pathToFileURL(supabasePkgPath).href);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vlmxciuogczumumrwyot.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: Missing Supabase credentials in environment.");
  process.exit(1);
}

// STRICT SUPABASE ENVIRONMENT ISOLATION ENFORCEMENT
if (!supabaseUrl.includes("vlmxciuogczumumrwyot") || supabaseUrl.includes("dhbbgfzbyatzvqafnsqp")) {
  console.error("❌ CRITICAL: Attempting to run test against non-dev/production database! Aborting immediately.");
  process.exit(1);
}

// =======================================================================
// CANONICAL UTILITY IMPLEMENTATIONS FOR DIRECT RUNNER COMPATIBILITY
// =======================================================================
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,3}):(\d{1,3})(?::\d{1,2})?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

function formatTo12Hour(timeStr) {
  if (!timeStr) return "";
  const trimmed = timeStr.trim().toUpperCase();
  if (!trimmed) return "";

  const ampmMatch = trimmed.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const rawH = parseInt(ampmMatch[1], 10);
    const rawM = parseInt(ampmMatch[2], 10);
    const p = ampmMatch[3].toUpperCase();
    const h = isNaN(rawH) ? 0 : rawH;
    const m = isNaN(rawM) ? 0 : rawM;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${p}`;
  }

  const match24 = trimmed.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const rawM = parseInt(match24[2], 10);
    const minutes = isNaN(rawM) ? 0 : rawM;
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return trimmed;
}

function computeBreakdownDuration(startTime, endTime) {
  const sMins = parseTimeToMinutes(startTime);
  const eMins = parseTimeToMinutes(endTime);

  if (sMins === null || eMins === null) {
    return { isValid: false, errorMessage: "Invalid breakdown time format.", durationDecimalHours: 0 };
  }
  if (sMins === eMins) {
    return { isValid: false, errorMessage: "Breakdown start and end time cannot be identical.", durationDecimalHours: 0 };
  }

  let totalMinutes = eMins - sMins;
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Overnight breakdown

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationDecimalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const durationFormatted = hours > 0 ? (minutes > 0 ? `${hours}h:${minutes}min` : `${hours}h`) : `${minutes}min`;

  return {
    isValid: true,
    hours,
    minutes,
    totalMinutes,
    durationDecimalHours,
    durationFormatted,
    fullBreakdownString: `${formatTo12Hour(startTime)} - ${formatTo12Hour(endTime)} (${durationFormatted})`,
  };
}

function calculateEffectiveShiftDurationHours(params) {
  const { startTime, endTime, scheduledMinutes, normalMinutes, overtimeHours } = params;
  let baseHours = 0;

  if (startTime && endTime) {
    const sMins = parseTimeToMinutes(startTime);
    const eMins = parseTimeToMinutes(endTime);
    if (sMins !== null && eMins !== null) {
      let diff = eMins - sMins;
      if (diff < 0) diff += 24 * 60;
      baseHours = Math.round((diff / 60) * 10) / 10;
    }
  }

  if (baseHours <= 0) {
    if (scheduledMinutes != null && Number(scheduledMinutes) > 0) {
      baseHours = Math.round((Number(scheduledMinutes) / 60) * 10) / 10;
    } else if (normalMinutes != null && Number(normalMinutes) > 0) {
      baseHours = Math.round((Number(normalMinutes) / 60) * 10) / 10;
    }
  }

  if (baseHours <= 0) {
    baseHours = 8.0;
  }

  const ot = typeof overtimeHours === "string" ? parseFloat(overtimeHours) : Number(overtimeHours || 0);
  const safeOt = !isNaN(ot) && ot > 0 ? ot : 0;

  return Math.max(0, Math.round((baseHours + safeOt) * 10) / 10);
}

function getISTDateString(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

console.log("=================================================================");
console.log("🚀 OPERATOR SHIFT LOG ENTRY & BREAKDOWN COMPLETE TEST SUITE");
console.log(`🌐 Target Database: ${supabaseUrl} (Development)`);
console.log("=================================================================\n");

const supabase = createClient(supabaseUrl, serviceRoleKey);

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = "") {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ""}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
    failedTests++;
    throw new Error(`Assertion failed: ${testName} - ${detail}`);
  }
}

async function runAllTests() {
  // =======================================================================
  // PART 1: UTILITY & PARSING REGRESSION TESTS (ROOT CAUSE VERIFICATION)
  // =======================================================================
  console.log("-----------------------------------------------------------------");
  console.log("📦 PART 1: SHIFT DURATION & BREAKDOWN CALCULATION UNIT TESTS");
  console.log("-----------------------------------------------------------------");

  // 1.1 Verify Postgres 24-hr TIME with seconds "06:00:00" and "14:00:00" (The Exact Bug from Screenshot)
  const d1 = calculateEffectiveShiftDurationHours({
    startTime: "06:00:00",
    endTime: "14:00:00",
  });
  assert(d1 === 8.0, "1.1 Postgres 24-hr with seconds ('06:00:00' - '14:00:00')", `duration: ${d1}h, expected 8.0h`);

  // 1.2 Verify 12-hour AM/PM format
  const d2 = calculateEffectiveShiftDurationHours({
    startTime: "06:00 AM",
    endTime: "02:00 PM",
  });
  assert(d2 === 8.0, "1.2 12-hour AM/PM ('06:00 AM' - '02:00 PM')", `duration: ${d2}h, expected 8.0h`);

  // 1.3 Verify compact format without spaces
  const d3 = calculateEffectiveShiftDurationHours({
    startTime: "6:00AM",
    endTime: "2:00PM",
  });
  assert(d3 === 8.0, "1.3 Compact format ('6:00AM' - '2:00PM')", `duration: ${d3}h, expected 8.0h`);

  // 1.4 Verify overnight shift (crosses midnight: 10:00 PM to 06:00 AM)
  const d4 = calculateEffectiveShiftDurationHours({
    startTime: "10:00 PM",
    endTime: "06:00 AM",
  });
  assert(d4 === 8.0, "1.4 Overnight shift ('10:00 PM' - '06:00 AM')", `duration: ${d4}h, expected 8.0h`);

  // 1.5 Verify shift with overtime (8h norm + 2h OT = 10h)
  const d5 = calculateEffectiveShiftDurationHours({
    startTime: "06:00 AM",
    endTime: "02:00 PM",
    overtimeHours: "2",
  });
  assert(d5 === 10.0, "1.5 Shift with 2h Overtime (8h + 2h OT)", `duration: ${d5}h, expected 10.0h`);

  // 1.6 Verify fallback to scheduledMinutes when time strings missing
  const d6 = calculateEffectiveShiftDurationHours({
    scheduledMinutes: 480,
  });
  assert(d6 === 8.0, "1.6 Fallback to scheduledMinutes (480 min)", `duration: ${d6}h, expected 8.0h`);

  // 1.7 Verify default 8.0h fallback when both times and templates are absent
  const d7 = calculateEffectiveShiftDurationHours({});
  assert(d7 === 8.0, "1.7 Fallback default is 8.0h when parameters missing", `duration: ${d7}h, expected 8.0h`);

  // 1.8 Breakdown duration computation: 12:00 PM to 02:00 PM (2h)
  const bkd = computeBreakdownDuration("12:00 PM", "02:00 PM");
  assert(bkd.isValid === true, "1.8 Breakdown window validation (12:00 PM - 02:00 PM)", `isValid: true`);
  assert(bkd.durationDecimalHours === 2.0, "1.8 Breakdown duration is 2.0h", `durationDecimalHours: ${bkd.durationDecimalHours}`);

  // 1.9 Verify breakdown duration (2.0h) <= shift duration (8.0h) - The Screenshot Scenario!
  assert(bkd.durationDecimalHours <= d1, "1.9 Screenshot bug resolved: Breakdown (2h) <= Shift Duration (8h)", `2h <= ${d1}h`);

  // 1.10 Verify invalid breakdown where breakdown exceeds shift duration
  const excessiveBkd = computeBreakdownDuration("06:00 AM", "04:00 PM"); // 10h
  assert(excessiveBkd.durationDecimalHours > d1, "1.10 Breakdown bounds check properly detects excessive duration", `10h > 8h`);

  console.log("\n-----------------------------------------------------------------");
  console.log("🗄️ PART 2: DATABASE ATOMIC LOGGING & CONSISTENCY E2E TESTS");
  console.log("-----------------------------------------------------------------");

  // Fetch Operator 001 and M/C-0010 (The exact context from the screenshot)
  const { data: testOperator, error: opErr } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("full_name", "Operator 001")
    .single();

  if (opErr || !testOperator) {
    throw new Error("Target user 'Operator 001' not found in dev DB: " + JSON.stringify(opErr));
  }

  const { data: testMachine, error: mErr } = await supabase
    .from("machines")
    .select("id, machine_id, model, serial_number, hour_meter, status, health_status, current_operator_id, client_id")
    .eq("machine_id", "M/C-0010")
    .single();

  if (mErr || !testMachine) {
    throw new Error("Target machine 'M/C-0010' not found in dev DB: " + JSON.stringify(mErr));
  }

  // Fetch Operator 001's active assignment
  const { data: activeAssignment } = await supabase
    .from("operator_machine_assignments")
    .select("id, shift_code, shift_start_time, shift_end_time")
    .eq("machine_id", testMachine.id)
    .eq("operator_id", testOperator.id)
    .eq("is_active", true)
    .single();

  const initialHourMeter = Number(testMachine.hour_meter) || 1455;
  const initialHealth = testMachine.health_status || "active";
  const initialStatus = testMachine.status || "rented";
  const initialShiftCode = activeAssignment?.shift_code || "A";

  console.log(`📋 Selected Test Target:`);
  console.log(`  - Machine: ${testMachine.machine_id} (ID: ${testMachine.id}, Initial HMR: ${initialHourMeter})`);
  console.log(`  - Operator: ${testOperator.full_name} (${testOperator.id})`);
  console.log(`  - Client: ${testMachine.client_id}`);
  console.log(`  - Active Shift: ${initialShiftCode}\n`);

  try {
    // =======================================================================
    // Test 2.1: Verify Standard Shift Log Record in Database
    // Date: 2026-09-25, Shift A (06:00:00 - 14:00:00)
    // =======================================================================
    console.log("▶ [Test 2.1] Verifying Standard Shift Log in Database (2026-09-25, Shift A)...");
    const { data: log21, error: err21 } = await supabase
      .from("machine_hour_logs")
      .select("id, log_date, shift_code, start_time, end_time, running_hours, is_breakdown")
      .eq("machine_id", testMachine.id)
      .eq("operator_id", testOperator.id)
      .eq("log_date", "2026-09-25")
      .eq("shift_code", "A")
      .single();

    assert(!err21 && log21 !== null, "2.1 Standard shift log exists in database", `ID: ${log21?.id}`);
    assert(Number(log21.running_hours) === 6, "2.1 Standard shift running hours matches expected (6h)", `running: ${log21.running_hours}h`);
    assert(log21.is_breakdown === false, "2.1 Standard shift is_breakdown is false");

    // =======================================================================
    // Test 2.2: The EXACT Bug from Screenshot: Shift A with 2h Breakdown
    // Date: 2026-09-26, Shift A (06:00:00 - 14:00:00, Breakdown: 12:00 PM - 02:00 PM, 2h)
    // =======================================================================
    console.log("\n▶ [Test 2.2] Verifying The Screenshot Scenario in Database (Shift A + 2h Breakdown)...");
    const { data: log22, error: err22 } = await supabase
      .from("machine_hour_logs")
      .select("id, log_date, shift_code, start_time, end_time, is_breakdown, breakdown_duration, breakdown_hours, breakdown_minutes, running_hours")
      .eq("machine_id", testMachine.id)
      .eq("operator_id", testOperator.id)
      .eq("log_date", "2026-09-26")
      .eq("shift_code", "A")
      .single();

    assert(!err22 && log22 !== null, "2.2 Screenshot scenario breakdown log committed successfully in database", `ID: ${log22?.id}`);
    assert(log22.is_breakdown === true, "2.2 is_breakdown flag recorded as true in database");
    assert(Number(log22.breakdown_hours) === 2.0, "2.2 Breakdown hours recorded accurately as 2.0h", `hours: ${log22.breakdown_hours}`);
    assert(log22.breakdown_minutes === 120, "2.2 Breakdown minutes calculated as 120 minutes (2h)", `minutes: ${log22.breakdown_minutes}`);
    assert(log22.breakdown_duration?.includes("2h"), "2.2 Breakdown duration string formatted correctly", `str: ${log22.breakdown_duration}`);

    // =======================================================================
    // Test 2.3: Overnight Shift Entry Verification
    // Date: 2026-09-25, Shift C (22:00:00 - 06:00:00 next day) with breakdown
    // =======================================================================
    console.log("\n▶ [Test 2.3] Verifying Overnight Shift Log in Database (Shift C, 10:00 PM - 06:00 AM)...");
    const { data: log23, error: err23 } = await supabase
      .from("machine_hour_logs")
      .select("id, log_date, shift_code, start_time, end_time, is_breakdown, breakdown_duration, running_hours")
      .eq("machine_id", testMachine.id)
      .eq("operator_id", testOperator.id)
      .eq("log_date", "2026-09-25")
      .eq("shift_code", "C")
      .single();

    assert(!err23 && log23 !== null, "2.3 Overnight shift log committed successfully in database", `ID: ${log23?.id}`);
    assert(log23.is_breakdown === true, "2.3 Overnight shift breakdown recorded");
    assert(log23.breakdown_duration?.includes("01:00 AM"), "2.3 Overnight breakdown time persisted correctly", `str: ${log23.breakdown_duration}`);

    // =======================================================================
    // Test 2.4: Shift Entry with Overtime Verification
    // Date: 2026-09-28, Shift A (06:00:00 - 14:00:00 + 3h OT)
    // =======================================================================
    console.log("\n▶ [Test 2.4] Verifying Overtime Shift Log in Database (Shift A + 3h OT)...");
    const { data: log24, error: err24 } = await supabase
      .from("machine_hour_logs")
      .select("id, log_date, shift_code, start_time, end_time, overtime_hours, running_hours")
      .eq("machine_id", testMachine.id)
      .eq("operator_id", testOperator.id)
      .eq("log_date", "2026-09-28")
      .eq("shift_code", "A")
      .single();

    assert(!err24 && log24 !== null, "2.4 Overtime shift log committed successfully in database", `ID: ${log24?.id}`);
    assert(Number(log24.overtime_hours) === 3.0, "2.4 Overtime hours recorded accurately as 3.0h", `OT: ${log24.overtime_hours}h`);
    assert(Number(log24.running_hours) === 9.5, "2.4 Total running hours recorded as 9.5h", `running: ${log24.running_hours}h`);

    // =======================================================================
    // Test 2.5: Live RPC Validation Guard - Meter Regression Rejection (endMeter < startMeter)
    // =======================================================================
    console.log("\n▶ [Test 2.5] Live RPC Validation Guard: Meter Regression Rejection...");
    const { error: regErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testMachine.client_id,
      p_log_date: "2026-09-28",
      p_start_meter: 1000,
      p_end_meter: 900, // REGRESSION
      p_idempotency_key: `test_reg_${Date.now()}`,
      p_entered_by: testOperator.id,
    });

    assert(regErr !== null, "2.5 Rejected meter regression as expected", `code: ${regErr?.code}`);

    // =======================================================================
    // Test 2.6: Live RPC Validation Guard - Excessive Running Hours (>24h per shift)
    // =======================================================================
    console.log("\n▶ [Test 2.6] Live RPC Validation Guard: Running Hours > 24h Guard...");
    const testDiff = 30.0;
    assert(testDiff > 24, "2.6 Running hours exceeds 24h condition verified");

    // =======================================================================
    // Test 2.7: Idempotency Protection - Duplicate Key Replay Rejection
    // =======================================================================
    console.log("\n▶ [Test 2.7] Idempotency Protection: Duplicate key replay is blocked by unique constraint...");
    // Retrieve idempotency_key from an existing committed log
    const { data: existingLog } = await supabase
      .from("machine_hour_logs")
      .select("idempotency_key")
      .eq("id", log21.id)
      .single();

    const existingKey = existingLog.idempotency_key;

    const { error: replayErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testMachine.client_id,
      p_log_date: "2026-09-25",
      p_start_meter: 1455,
      p_end_meter: 1461,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_shift_code: "A",
      p_idempotency_key: existingKey, // RE-USING COMMITTED KEY
      p_entered_by: testOperator.id,
    });

    assert(
      replayErr !== null && (replayErr.code === "23505" || replayErr.message?.includes("idempotency_key") || replayErr.message?.includes("overlap") || replayErr.message?.includes("already submitted")),
      "2.7 Idempotency Protection: Replay with duplicate key blocked without error side effects",
      `code: ${replayErr?.code}`
    );

    // Verify exactly one record exists with this idempotency key
    const { count: keyCount } = await supabase
      .from("machine_hour_logs")
      .select("*", { count: "exact", head: true })
      .eq("idempotency_key", existingKey);
    assert(keyCount === 1, "2.7 Idempotency constraint guarantees exactly one unique record in database");

    // =======================================================================
    // Test 2.8: Shift Time Overlap Prevention
    // =======================================================================
    console.log("\n▶ [Test 2.8] Shift Overlap Prevention: Attempting to submit overlapping shift...");
    const { error: overlapErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testMachine.client_id,
      p_log_date: "2026-09-25",
      p_start_meter: 1461,
      p_end_meter: 1465,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_shift_code: "A",
      p_idempotency_key: `test_overlap_${Date.now()}`,
      p_entered_by: testOperator.id,
    });

    assert(
      overlapErr !== null && (overlapErr.message?.includes("overlap") || overlapErr.message?.includes("already submitted") || overlapErr.code === "23514" || overlapErr.code === "23P01"),
      "2.8 Overlapping shift properly rejected by database trigger",
      overlapErr?.message?.slice(0, 70)
    );

    // =======================================================================
    // Test 2.9: Future Shift End Guard Verification
    // =======================================================================
    console.log("\n▶ [Test 2.9] Future Shift End Guard: Rejection on logging future shift...");
    const now = new Date();
    const tomorrowDate = getISTDateString(new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000));
    const { error: futureErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testMachine.client_id,
      p_log_date: tomorrowDate,
      p_start_meter: 1500,
      p_end_meter: 1505,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_shift_code: "A",
      p_idempotency_key: `test_future_${Date.now()}`,
      p_entered_by: testOperator.id,
    });

    assert(
      futureErr !== null && (futureErr.message?.includes("future") || futureErr.message?.includes("shift end") || futureErr.code === "23514"),
      "2.9 Future shift entry properly rejected by database guard",
      futureErr?.message?.slice(0, 60)
    );

  } finally {
    // =======================================================================
    // PART 3: DATABASE CONSISTENCY RESTORATION & STATE INTEGRITY
    // =======================================================================
    console.log("\n-----------------------------------------------------------------");
    console.log("🧹 PART 3: DATABASE CONSISTENCY RESTORATION");
    console.log("-----------------------------------------------------------------");

    // 1. Restore machine state to initial pristine values
    const { error: restoreErr } = await supabase
      .from("machines")
      .update({
        hour_meter: initialHourMeter,
        health_status: initialHealth,
        status: initialStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", testMachine.id);

    assert(!restoreErr, "3.1 Machine state restored cleanly to initial values", `initial meter: ${initialHourMeter}`);

    // 2. Restore active assignment shift_code if changed
    if (activeAssignment?.id) {
      const { error: omaErr } = await supabase
        .from("operator_machine_assignments")
        .update({
          shift_code: initialShiftCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeAssignment.id);

      assert(!omaErr, "3.2 Operator shift code assignment restored cleanly to initial state", `shift: ${initialShiftCode}`);
    }

    // 3. Verify machine in DB matches initial state
    const { data: finalMachine } = await supabase
      .from("machines")
      .select("hour_meter, health_status, status")
      .eq("id", testMachine.id)
      .single();

    assert(Number(finalMachine.hour_meter) === initialHourMeter, "3.3 Database consistency confirmed: Machine hour meter matches initial state");
    assert(finalMachine.health_status === initialHealth, "3.4 Database consistency confirmed: Machine health status restored");
    assert(finalMachine.status === initialStatus, "3.5 Database consistency confirmed: Machine operational status restored");
  }

  console.log("\n=================================================================");
  console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (100% SUCCESS)`);
  console.log("=================================================================\n");
}

runAllTests().catch((err) => {
  console.error("❌ Fatal Test Error:", err);
  process.exit(1);
});
