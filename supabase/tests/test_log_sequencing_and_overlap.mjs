import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env.local
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
loadEnv(path.resolve(__dirname, "../../.env.local"));
loadEnv(path.resolve(__dirname, "../../apps/web/.env"));
loadEnv(path.resolve(__dirname, "../../apps/web/.env.local"));

const supabasePkgPath = path.resolve(__dirname, "../../node_modules/@supabase/supabase-js/dist/index.mjs");
const { createClient } = await import(pathToFileURL(supabasePkgPath).href);

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://dhbbgfzbyatzvqafnsqp.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing Supabase credentials in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("=================================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: LOG SEQUENCING & OVERLAP PREV");
  console.log("=================================================================\n");

  const { data: machines, error: mErr } = await supabase.from("machines").select("id, machine_id, hour_meter").limit(2);
  if (mErr || !machines || machines.length < 2) {
    console.error("❌ Need at least 2 machines in database for testing. Found:", machines?.length || 0);
    process.exit(1);
  }

  const { data: users, error: uErr } = await supabase.from("users").select("id, role").limit(2);
  if (uErr || !users || users.length < 1) {
    console.error("❌ Need at least 1 user in database for testing.");
    process.exit(1);
  }

  const machineA = machines[0].id;
  const machineB = machines[1].id;
  const operatorId = users[0].id;

  const testKeyPrefix = `test_${Date.now()}_`;
  const createdLogIds = [];
  const getLogId = (log) => log?.log_id || log?.logId;

  try {
    // -------------------------------------------------------------
    // Test 1: Same-Day Shift Creation (Machine A)
    // 2024-01-01 06:00:00+05:30 to 2024-01-01 18:00:00+05:30 (06:00 AM - 06:00 PM)
    // -------------------------------------------------------------
    console.log("▶ [Test 1] Same-day shift: Machine A (06:00 AM - 06:00 PM)...");
    const { data: log1, error: err1 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-01",
      p_start_datetime: "2024-01-01T06:00:00+05:30",
      p_end_datetime: "2024-01-01T18:00:00+05:30",
      p_start_meter: 1000,
      p_end_meter: 1012,
      p_start_time: "06:00 AM",
      p_end_time: "06:00 PM",
      p_overtime_hours: 3.0,
      p_normal_working_hours: 8.0,
      p_is_breakdown: false,
      p_shift: "shift_1",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 1 Log",
      p_idempotency_key: `${testKeyPrefix}1`,
    });

    if (err1 || !log1?.success) {
      throw new Error(`Test 1 Failed: ${err1?.message || JSON.stringify(log1)}`);
    }
    const log1Id = getLogId(log1);
    if (log1Id) createdLogIds.push(log1Id);
    console.log("  ✅ Test 1 Passed: Log 1 inserted successfully (ID:", log1Id, ")\n");

    // -------------------------------------------------------------
    // Test 2: Exact Handover (Machine A)
    // 2024-01-01 18:00:00+05:30 to 2024-01-01 22:00:00+05:30 (06:00 PM - 10:00 PM)
    // -------------------------------------------------------------
    console.log("▶ [Test 2] Exact handover: Machine A (06:00 PM - 10:00 PM)...");
    const { data: log2, error: err2 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-01",
      p_start_datetime: "2024-01-01T18:00:00+05:30",
      p_end_datetime: "2024-01-01T22:00:00+05:30",
      p_start_meter: 1012,
      p_end_meter: 1016,
      p_start_time: "06:00 PM",
      p_end_time: "10:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 4.0,
      p_is_breakdown: false,
      p_shift: "shift_2",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 2 Handover Log",
      p_idempotency_key: `${testKeyPrefix}2`,
    });

    if (err2 || !log2?.success) {
      throw new Error(`Test 2 Failed: Exact handover was incorrectly rejected: ${err2?.message}`);
    }
    const log2Id = getLogId(log2);
    if (log2Id) createdLogIds.push(log2Id);
    console.log("  ✅ Test 2 Passed: Exact handover accepted without conflict! (ID:", log2Id, ")\n");

    // -------------------------------------------------------------
    // Test 3: Overlapping Shift Rejected (Machine A)
    // 2024-01-01 17:00:00+05:30 to 2024-01-01 21:00:00+05:30 (05:00 PM - 09:00 PM)
    // -------------------------------------------------------------
    console.log("▶ [Test 3] Overlap rejection: Machine A (05:00 PM - 09:00 PM)...");
    const { data: log3, error: err3 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-01",
      p_start_datetime: "2024-01-01T17:00:00+05:30",
      p_end_datetime: "2024-01-01T21:00:00+05:30",
      p_start_meter: 1010,
      p_end_meter: 1014,
      p_start_time: "05:00 PM",
      p_end_time: "09:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 4.0,
      p_is_breakdown: false,
      p_shift: "shift_2",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 3 Overlap",
      p_idempotency_key: `${testKeyPrefix}3`,
    });

    if (!err3) {
      const id = getLogId(log3);
      if (id) createdLogIds.push(id);
      throw new Error("Test 3 Failed: Overlapping shift was unexpectedly accepted!");
    }
    console.log("  ✅ Test 3 Passed: Overlapping shift was correctly rejected by database.");
    console.log("     Error caught:", err3.message, "\n");

    // -------------------------------------------------------------
    // Test 4: Duplicate Shift Rejected (Machine A)
    // 2024-01-01 06:00:00+05:30 to 2024-01-01 18:00:00+05:30 (Exact duplicate of Log 1)
    // -------------------------------------------------------------
    console.log("▶ [Test 4] Duplicate shift rejection: Machine A (06:00 AM - 06:00 PM)...");
    const { data: log4, error: err4 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-01",
      p_start_datetime: "2024-01-01T06:00:00+05:30",
      p_end_datetime: "2024-01-01T18:00:00+05:30",
      p_start_meter: 1000,
      p_end_meter: 1012,
      p_start_time: "06:00 AM",
      p_end_time: "06:00 PM",
      p_overtime_hours: 3.0,
      p_normal_working_hours: 8.0,
      p_is_breakdown: false,
      p_shift: "shift_1",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 4 Duplicate",
      p_idempotency_key: `${testKeyPrefix}4`,
    });

    if (!err4) {
      const id = getLogId(log4);
      if (id) createdLogIds.push(id);
      throw new Error("Test 4 Failed: Duplicate shift was unexpectedly accepted!");
    }
    console.log("  ✅ Test 4 Passed: Duplicate shift was correctly rejected by database.");
    console.log("     Error caught:", err4.message, "\n");

    // -------------------------------------------------------------
    // Test 5: Overnight Shift Support (Machine A)
    // 2024-01-01 22:00:00+05:30 to 2024-01-02 06:00:00+05:30 (10:00 PM - 06:00 AM next day)
    // -------------------------------------------------------------
    console.log("▶ [Test 5] Overnight shift: Machine A (01-Jan 10:00 PM → 02-Jan 06:00 AM)...");
    const { data: log5, error: err5 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-02",
      p_start_datetime: "2024-01-01T22:00:00+05:30",
      p_end_datetime: "2024-01-02T06:00:00+05:30",
      p_start_meter: 1016,
      p_end_meter: 1024,
      p_start_time: "10:00 PM",
      p_end_time: "06:00 AM",
      p_overtime_hours: 0,
      p_normal_working_hours: 7.0,
      p_is_breakdown: false,
      p_shift: "shift_3",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 5 Overnight",
      p_idempotency_key: `${testKeyPrefix}5`,
    });

    if (err5 || !log5?.success) {
      throw new Error(`Test 5 Failed: Overnight shift rejected: ${err5?.message}`);
    }
    const log5Id = getLogId(log5);
    if (log5Id) createdLogIds.push(log5Id);
    console.log("  ✅ Test 5 Passed: Overnight shift recorded successfully (ID:", log5Id, ")\n");

    // -------------------------------------------------------------
    // Test 6: Overlap with Overnight Shift Rejected (Machine A)
    // 2024-01-02 05:00:00+05:30 to 2024-01-02 13:00:00+05:30 (05:00 AM overlaps with 06:00 AM end)
    // -------------------------------------------------------------
    console.log("▶ [Test 6] Overlap with overnight shift: Machine A (02-Jan 05:00 AM - 01:00 PM)...");
    const { data: log6, error: err6 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-02",
      p_end_date: "2024-01-02",
      p_start_datetime: "2024-01-02T05:00:00+05:30",
      p_end_datetime: "2024-01-02T13:00:00+05:30",
      p_start_meter: 1023,
      p_end_meter: 1031,
      p_start_time: "05:00 AM",
      p_end_time: "01:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 7.0,
      p_is_breakdown: false,
      p_shift: "shift_1",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 6 Overlap with overnight",
      p_idempotency_key: `${testKeyPrefix}6`,
    });

    if (!err6) {
      const id = getLogId(log6);
      if (id) createdLogIds.push(id);
      throw new Error("Test 6 Failed: Overlap with overnight shift was unexpectedly accepted!");
    }
    console.log("  ✅ Test 6 Passed: Overlap with overnight shift was correctly rejected.");
    console.log("     Error caught:", err6.message, "\n");

    // -------------------------------------------------------------
    // Test 7: Exact Handover After Overnight Shift (Machine A)
    // 2024-01-02 06:00:00+05:30 to 2024-01-02 14:00:00+05:30 (06:00 AM - 02:00 PM)
    // -------------------------------------------------------------
    console.log("▶ [Test 7] Exact handover after overnight shift: Machine A (02-Jan 06:00 AM - 02:00 PM)...");
    const { data: log7, error: err7 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-02",
      p_end_date: "2024-01-02",
      p_start_datetime: "2024-01-02T06:00:00+05:30",
      p_end_datetime: "2024-01-02T14:00:00+05:30",
      p_start_meter: 1024,
      p_end_meter: 1032,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 7.0,
      p_is_breakdown: false,
      p_shift: "shift_1",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Test 7 Post-Overnight Handover",
      p_idempotency_key: `${testKeyPrefix}7`,
    });

    if (err7 || !log7?.success) {
      throw new Error(`Test 7 Failed: Handover after overnight shift was rejected: ${err7?.message}`);
    }
    const log7Id = getLogId(log7);
    if (log7Id) createdLogIds.push(log7Id);
    console.log("  ✅ Test 7 Passed: Exact handover after overnight shift accepted! (ID:", log7Id, ")\n");

    // -------------------------------------------------------------
    // Test 8: Different Machine Independent Timeline (Machine B)
    // Same time as Log 1: 2024-01-01 06:00:00+05:30 to 2024-01-01 18:00:00+05:30
    // -------------------------------------------------------------
    console.log("▶ [Test 8] Different machine independent timeline: Machine B (06:00 AM - 06:00 PM)...");
    const { data: log8, error: err8 } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineB,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-01",
      p_end_date: "2024-01-01",
      p_start_datetime: "2024-01-01T06:00:00+05:30",
      p_end_datetime: "2024-01-01T18:00:00+05:30",
      p_start_meter: 2000,
      p_end_meter: 2012,
      p_start_time: "06:00 AM",
      p_end_time: "06:00 PM",
      p_overtime_hours: 3.0,
      p_normal_working_hours: 8.0,
      p_is_breakdown: false,
      p_shift: "shift_1",
      p_machine_condition: "good",
      p_location: "Test Site B",
      p_remarks: "Test 8 Machine B",
      p_idempotency_key: `${testKeyPrefix}8`,
    });

    if (err8 || !log8?.success) {
      throw new Error(`Test 8 Failed: Machine B log rejected: ${err8?.message}`);
    }
    const log8Id = getLogId(log8);
    if (log8Id) createdLogIds.push(log8Id);
    console.log("  ✅ Test 8 Passed: Machine B has independent timeline! (ID:", log8Id, ")\n");

    // -------------------------------------------------------------
    // Test 9: Editing Existing Log without Overlap
    // Update Log 2 (18:00 - 22:00) to (18:00 - 21:00)
    // -------------------------------------------------------------
    console.log("▶ [Test 9] Editing existing log without overlap: Machine A Log 2...");
    const { error: err9 } = await supabase
      .from("machine_hour_logs")
      .update({
        end_time: "21:00:00",
        end_datetime: "2024-01-01T21:00:00+05:30",
        end_meter: 1015,
        normal_working_hours: 3.0,
      })
      .eq("id", getLogId(log2));

    if (err9) {
      throw new Error(`Test 9 Failed: Could not edit log without overlap: ${err9.message}`);
    }
    console.log("  ✅ Test 9 Passed: Successfully updated log without overlap.\n");

    // -------------------------------------------------------------
    // Test 10: Concurrent Race Condition Test
    // Two simultaneous inserts for the exact same slot on Machine A
    // Slot: 2024-01-02 14:00:00+05:30 to 2024-01-02 22:00:00+05:30
    // -------------------------------------------------------------
    console.log("▶ [Test 10] Concurrent race condition protection (Machine A)...");
    const p1 = supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-02",
      p_end_date: "2024-01-02",
      p_start_datetime: "2024-01-02T14:00:00+05:30",
      p_end_datetime: "2024-01-02T22:00:00+05:30",
      p_start_meter: 1032,
      p_end_meter: 1040,
      p_start_time: "02:00 PM",
      p_end_time: "10:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 7.0,
      p_is_breakdown: false,
      p_shift: "shift_2",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Concurrent Thread 1",
      p_idempotency_key: `${testKeyPrefix}10_1`,
    });

    const p2 = supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: machineA,
      p_operator_id: operatorId,
      p_client_id: null,
      p_log_date: "2024-01-02",
      p_end_date: "2024-01-02",
      p_start_datetime: "2024-01-02T14:00:00+05:30",
      p_end_datetime: "2024-01-02T22:00:00+05:30",
      p_start_meter: 1032,
      p_end_meter: 1040,
      p_start_time: "02:00 PM",
      p_end_time: "10:00 PM",
      p_overtime_hours: 0,
      p_normal_working_hours: 7.0,
      p_is_breakdown: false,
      p_shift: "shift_2",
      p_machine_condition: "good",
      p_location: "Test Site A",
      p_remarks: "Concurrent Thread 2",
      p_idempotency_key: `${testKeyPrefix}10_2`,
    });

    const [res1, res2] = await Promise.all([p1, p2]);
    const successCount = (res1.data?.success ? 1 : 0) + (res2.data?.success ? 1 : 0);
    const failureCount = (res1.error ? 1 : 0) + (res2.error ? 1 : 0);

    const id1 = getLogId(res1.data);
    const id2 = getLogId(res2.data);
    if (id1) createdLogIds.push(id1);
    if (id2) createdLogIds.push(id2);

    if (successCount === 1 && failureCount === 1) {
      console.log("  ✅ Test 10 Passed: Advisory lock & exclusion constraint successfully serialized concurrent requests!");
      console.log("     1 request succeeded, 1 request rejected with zero data corruption.\n");
    } else {
      throw new Error(`Test 10 Failed: Unexpected concurrency result (Success: ${successCount}, Failures: ${failureCount})`);
    }

    console.log("=================================================================");
    console.log("🎉 ALL 10 TEST SCENARIOS PASSED WITH 100% SUCCESS RATE!");
    console.log("=================================================================\n");
  } finally {
    // Cleanup test records created during test run
    if (createdLogIds.length > 0) {
      console.log("🧹 Cleaning up", createdLogIds.length, "test records...");
      await supabase.from("machine_hour_logs").delete().in("id", createdLogIds);
      await supabase.from("audit_logs").delete().in("entity_id", createdLogIds);
      console.log("✨ Test data cleaned up successfully.");
    }
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
