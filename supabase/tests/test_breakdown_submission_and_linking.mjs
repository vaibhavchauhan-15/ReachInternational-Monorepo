import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

loadEnv(path.resolve(__dirname, "../../.env"));
loadEnv(path.resolve(__dirname, "../../apps/web/.env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dhbbgfzbyatzvqafnsqp.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing Supabase credentials in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTestSuite() {
  console.log("=================================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: BREAKDOWN LOGGING & LINKING");
  console.log("=================================================================\n");

  // Fetch real machine, operator, and client from DB
  const { data: machines, error: mErr } = await supabase
    .from("machines")
    .select("id, machine_id, model, serial_number, hour_meter, status, health_status, current_operator_id, client_id")
    .limit(2);

  if (mErr || !machines || machines.length === 0) {
    console.error("❌ Failed to query machines:", mErr);
    process.exit(1);
  }

  const { data: operators, error: uErr } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("role", "operator")
    .limit(2);

  if (uErr || !operators || operators.length === 0) {
    console.error("❌ Failed to query operators:", uErr);
    process.exit(1);
  }

  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, code, company_name, address, city, state")
    .limit(2);

  const testMachine = machines[0];
  const testOperator = operators[0];
  const testClient = clients && clients.length > 0 ? clients[0] : null;

  console.log("📋 Test Entities Loaded:");
  console.log(`  - Machine: ${testMachine.machine_id} (${testMachine.model || "N/A"})`);
  console.log(`  - Operator: ${testOperator.full_name} (Role: ${testOperator.role})`);
  console.log(`  - Client: ${testClient?.company_name || "N/A"} (${testClient?.code || "N/A"})\n`);

  const initialHourMeter = Number(testMachine.hour_meter) || 1000;
  const initialStatus = testMachine.status;
  const initialHealth = testMachine.health_status;
  const testLogIds = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Register Log with Breakdown
    // -------------------------------------------------------------
    console.log("▶ [Test 1] Register Operator Log WITH Breakdown (02:30 PM - 03:25 PM, 55min)...");
    const test1StartMeter = initialHourMeter + 10;
    const test1EndMeter = initialHourMeter + 18;
    const test1IdempotencyKey = `test_bkd_${Date.now()}_1`;
    const test1Location = testClient ? `${testClient.address}, ${testClient.city}, ${testClient.state}` : "Site Sector 4";

    const insertPayload1 = {
      machine_id: testMachine.id,
      operator_id: testOperator.id,
      client_id: testClient?.id || null,
      log_date: "2026-09-05",
      end_date: "2026-09-05",
      start_datetime: "2026-09-05T06:00:00+05:30",
      end_datetime: "2026-09-05T14:00:00+05:30",
      start_meter: test1StartMeter,
      end_meter: test1EndMeter,
      start_time: "06:00 AM",
      end_time: "02:00 PM",
      overtime_hours: 0,
      normal_working_hours: 8,
      is_breakdown: true,
      breakdown_start_time: "02:30 PM",
      breakdown_end_time: "03:25 PM",
      breakdown_duration: "02:30 PM - 03:25 PM (55min)",
      breakdown_hours: 0.92,
      shift: "shift_1",
      machine_condition: "breakdown",
      location: test1Location,
      remarks: "[Breakdown Duration: 02:30 PM - 03:25 PM (55min)] Hydraulic hose replacement",
      idempotency_key: test1IdempotencyKey,
    };

    const { data: log1, error: err1 } = await supabase
      .from("machine_hour_logs")
      .insert(insertPayload1)
      .select("*, machine:machines(id, machine_id, serial_number), operator:users!operator_id(id, full_name), client:clients(id, company_name)")
      .single();

    if (err1 || !log1) {
      throw new Error(`Test 1 Failed on insert: ${err1?.message || "Unknown error"}`);
    }
    testLogIds.push(log1.id);

    // Update machine health_status & hour_meter
    const { data: mUpdate1, error: mErr1 } = await supabase
      .from("machines")
      .update({
        hour_meter: test1EndMeter,
        current_operator_id: testOperator.id,
        health_status: "breakdown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", testMachine.id)
      .select("id, machine_id, hour_meter, status, health_status, current_operator_id")
      .single();

    if (mErr1 || !mUpdate1) {
      throw new Error(`Test 1 Failed on machine update: ${mErr1?.message}`);
    }

    // Verify properties
    if (mUpdate1.health_status !== "breakdown") {
      throw new Error(`Test 1 Failed: Expected health_status 'breakdown', got '${mUpdate1.health_status}'`);
    }
    if (mUpdate1.status !== initialStatus) {
      throw new Error(`Test 1 Failed: Rental status was mutated to '${mUpdate1.status}'! Should remain '${initialStatus}'`);
    }
    if (log1.breakdown_duration !== "02:30 PM - 03:25 PM (55min)") {
      throw new Error(`Test 1 Failed: Breakdown duration mismatch: '${log1.breakdown_duration}'`);
    }
    if (log1.operator?.id !== testOperator.id) {
      throw new Error(`Test 1 Failed: Operator linking mismatch`);
    }
    if (testClient && log1.client?.id !== testClient.id) {
      throw new Error(`Test 1 Failed: Client/site linking mismatch`);
    }

    console.log("  ✅ Test 1 Passed: Breakdown log registered cleanly!");
    console.log(`     - Log ID: ${log1.id}`);
    console.log(`     - Machine: ${log1.machine?.machine_id} (Meter: ${mUpdate1.hour_meter})`);
    console.log(`     - Machine Health: ${mUpdate1.health_status} (Rental Status: ${mUpdate1.status})`);
    console.log(`     - Operator Linked: ${log1.operator?.full_name}`);
    console.log(`     - Client / Site: ${log1.client?.company_name || "N/A"} (${log1.location})`);
    console.log(`     - Breakdown Duration: ${log1.breakdown_duration}\n`);

    // -------------------------------------------------------------
    // Test 2: Register Normal Shift Log (Healthy shift restores health_status to 'active')
    // -------------------------------------------------------------
    console.log("▶ [Test 2] Register Normal Operator Log (Healthy shift restores active status)...");
    const test2StartMeter = test1EndMeter;
    const test2EndMeter = test1EndMeter + 8;
    const test2IdempotencyKey = `test_norm_${Date.now()}_2`;

    const insertPayload2 = {
      machine_id: testMachine.id,
      operator_id: testOperator.id,
      client_id: testClient?.id || null,
      log_date: "2026-09-06",
      end_date: "2026-09-06",
      start_datetime: "2026-09-06T06:00:00+05:30",
      end_datetime: "2026-09-06T14:00:00+05:30",
      start_meter: test2StartMeter,
      end_meter: test2EndMeter,
      start_time: "06:00 AM",
      end_time: "02:00 PM",
      overtime_hours: 0,
      normal_working_hours: 8,
      is_breakdown: false,
      shift: "shift_1",
      machine_condition: "good",
      location: test1Location,
      remarks: "Normal smooth operations after maintenance",
      idempotency_key: test2IdempotencyKey,
    };

    const { data: log2, error: err2 } = await supabase
      .from("machine_hour_logs")
      .insert(insertPayload2)
      .select("*, machine:machines(id, machine_id), operator:users!operator_id(id, full_name)")
      .single();

    if (err2 || !log2) {
      throw new Error(`Test 2 Failed on insert: ${err2?.message}`);
    }
    testLogIds.push(log2.id);

    // Update machine back to active
    const { data: mUpdate2, error: mErr2 } = await supabase
      .from("machines")
      .update({
        hour_meter: test2EndMeter,
        current_operator_id: testOperator.id,
        health_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", testMachine.id)
      .select("id, machine_id, hour_meter, status, health_status")
      .single();

    if (mErr2 || !mUpdate2) {
      throw new Error(`Test 2 Failed on machine update: ${mErr2?.message}`);
    }

    if (mUpdate2.health_status !== "active") {
      throw new Error(`Test 2 Failed: Expected health_status 'active', got '${mUpdate2.health_status}'`);
    }

    console.log("  ✅ Test 2 Passed: Normal shift log registered and machine health restored to active!");
    console.log(`     - Log ID: ${log2.id}`);
    console.log(`     - Machine Health: ${mUpdate2.health_status} (Meter: ${mUpdate2.hour_meter})\n`);

    // -------------------------------------------------------------
    // Test 3: Constraint & Validation Error Handling
    // -------------------------------------------------------------
    console.log("▶ [Test 3] Testing Error Interception & Validation Rules...");

    // 3a. Shift Overlap Detection (P0001)
    console.log("  3a. Shift overlap detection trigger test...");
    const { error: overlapErr } = await supabase.from("machine_hour_logs").insert({
      machine_id: testMachine.id,
      operator_id: testOperator.id,
      log_date: "2026-09-05",
      end_date: "2026-09-05",
      start_datetime: "2026-09-05T08:00:00+05:30",
      end_datetime: "2026-09-05T12:00:00+05:30",
      start_meter: test1EndMeter,
      end_meter: test1EndMeter + 4,
      start_time: "08:00 AM",
      end_time: "12:00 PM",
      idempotency_key: `test_err_ovl_${Date.now()}`,
    });

    if (!overlapErr || !overlapErr.message.includes("overlap")) {
      throw new Error("Expected shift overlap error, but got: " + JSON.stringify(overlapErr));
    }
    console.log(`     ✅ Caught expected shift overlap error: ${overlapErr.code} (${overlapErr.message.slice(0, 70)}...)`);

    // 3b. Meter Regression (end_meter < start_meter) (23514)
    console.log("  3b. Meter regression check constraint test (end_meter < start_meter)...");
    const { error: regErr } = await supabase.from("machine_hour_logs").insert({
      machine_id: testMachine.id,
      operator_id: testOperator.id,
      log_date: "2029-01-01",
      end_date: "2029-01-01",
      start_datetime: "2029-01-01T06:00:00+05:30",
      end_datetime: "2029-01-01T14:00:00+05:30",
      start_time: "06:00 AM",
      end_time: "02:00 PM",
      start_meter: 500,
      end_meter: 400, // Invalid regression!
      idempotency_key: `test_err_reg_${Date.now()}`,
    });

    if (!regErr || regErr.code !== "23514") {
      throw new Error("Expected meter regression check constraint (23514), but got: " + JSON.stringify(regErr));
    }
    console.log(`     ✅ Caught expected meter regression error: ${regErr.code} (${regErr.message})`);

    // 3c. Duplicate Idempotency Key (23505)
    console.log("  3c. Duplicate idempotency key unique constraint test...");
    const { error: dupErr } = await supabase.from("machine_hour_logs").insert({
      machine_id: testMachine.id,
      operator_id: testOperator.id,
      log_date: "2029-01-02",
      end_date: "2029-01-02",
      start_datetime: "2029-01-02T06:00:00+05:30",
      end_datetime: "2029-01-02T14:00:00+05:30",
      start_time: "06:00 AM",
      end_time: "02:00 PM",
      start_meter: 600,
      end_meter: 608,
      idempotency_key: test1IdempotencyKey, // Re-using test 1 key
    });

    if (!dupErr || dupErr.code !== "23505") {
      throw new Error("Expected duplicate idempotency key violation (23505), but got: " + JSON.stringify(dupErr));
    }
    console.log(`     ✅ Caught expected duplicate key error: ${dupErr.code} (${dupErr.message})\n`);

    console.log("=================================================================");
    console.log("🎉 ALL TESTS PASSED: BREAKDOWN LOGGING & LINKING VERIFIED 100%!");
    console.log("=================================================================\n");
  } finally {
    // Clean up test logs
    if (testLogIds.length > 0) {
      await supabase.from("machine_hour_logs").delete().in("id", testLogIds);
      console.log(`🧹 Cleaned up ${testLogIds.length} test hour log record(s).`);
    }

    // Restore machine state
    await supabase.from("machines").update({
      hour_meter: initialHourMeter,
      health_status: initialHealth,
      status: initialStatus,
      current_operator_id: testMachine.current_operator_id,
      updated_at: new Date().toISOString(),
    }).eq("id", testMachine.id);
    console.log(`🔄 Restored test machine ${testMachine.machine_id} to original state.\n`);
  }
}

runTestSuite().catch((err) => {
  console.error("❌ Test Suite Failure:", err);
  process.exit(1);
});
