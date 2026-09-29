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
  "https://vlmxciuogczumumrwyot.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error("❌ SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY missing from environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function runTestSuite() {
  console.log("=================================================================");
  console.log("🚀 TESTING CLIENT SHIFT CODES & OVERTIME ENGINE (RPC 112)");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extra = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extra}`);
      failed++;
    }
  }

  try {
    // 1. Verify client_shift_codes table
    const { data: shifts, error: shiftsErr } = await supabase
      .from("client_shift_codes")
      .select("*")
      .limit(10);

    assert(!shiftsErr && shifts && shifts.length > 0, "client_shift_codes table exists and contains seeded shifts", shiftsErr?.message);

    // 2. Fetch a valid active operator and client
    const { data: clients } = await supabase
      .from("clients")
      .select("id, company_name")
      .limit(1);
    const testClient = clients?.[0];
    assert(!!testClient, `Found test client: ${testClient?.company_name} (${testClient?.id})`);

    const { data: operators } = await supabase
      .from("users")
      .select("id, full_name, role")
      .eq("role", "operator")
      .limit(1);
    const testOperator = operators?.[0];
    assert(!!testOperator, `Found test operator: ${testOperator?.full_name} (${testOperator?.id})`);

    // Create an isolated temporary test machine
    const { data: tempMachine, error: tmErr } = await supabase
      .from("machines")
      .insert({
        machine_id: `M-TEST-${Date.now().toString().slice(-4)}`,
        machine_name: "JCB Test Excavator",
        serial_number: `SN-${Date.now().toString().slice(-6)}`,
        model: "JCB Test Model",
        client_id: testClient.id,
        status: "available",
        health_status: "active",
        hour_meter: 100,
      })
      .select()
      .single();
    assert(!!tempMachine && !tmErr, `Created isolated test machine: ${tempMachine?.machine_id} (${tempMachine?.id})`, tmErr?.message);
    const testMachine = tempMachine;

    const testDate = "2026-09-20";
    console.log(`\nUsing isolated test operational date: ${testDate}`);

    // Clean up any test records on this date
    await supabase
      .from("machine_hour_logs")
      .delete()
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate);

    // TEST 1: Submit Shift A (1st Shift on date) -> Normal: 8h, OT: 0h
    console.log("\n--- TEST 1: First Shift Submission (Shift A, 06:00 - 14:00) ---");
    const mtr1Start = (testMachine.hour_meter || 100);
    const mtr1End = mtr1Start + 8;

    const { data: rpc1, error: rpc1Err } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testClient.id,
      p_shift_code: "A",
      p_log_date: testDate,
      p_end_date: testDate,
      p_start_datetime: `${testDate}T06:00:00+05:30`,
      p_end_datetime: `${testDate}T14:00:00+05:30`,
      p_start_meter: mtr1Start,
      p_end_meter: mtr1End,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_is_breakdown: false,
      p_idempotency_key: `test_shift_a_${Date.now()}`,
    });

    assert(!rpc1Err && rpc1?.success, "RPC accepted Shift A submission", rpc1Err?.message);

    const { data: log1 } = await supabase
      .from("machine_hour_logs")
      .select("id, shift_code, normal_working_hours, overtime_hours, running_hours, shift")
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate)
      .eq("shift_code", "A")
      .single();

    assert(log1?.shift_code === "A", "Log 1 has shift_code 'A'");
    assert(Number(log1?.normal_working_hours) === 8, `Log 1 normal hours is 8h (actual: ${log1?.normal_working_hours})`);
    assert(Number(log1?.overtime_hours) === 0, `Log 1 overtime hours is 0h (actual: ${log1?.overtime_hours})`);

    // TEST 2: Submit Shift B (2nd Shift on same date by same operator) -> Normal: 0h, OT: 8h (100% OT!)
    console.log("\n--- TEST 2: Second Shift Submission (Shift B, 14:00 - 22:00, 100% OT) ---");
    const mtr2Start = mtr1End;
    const mtr2End = mtr2Start + 8;

    const { data: rpc2, error: rpc2Err } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testClient.id,
      p_shift_code: "B",
      p_log_date: testDate,
      p_end_date: testDate,
      p_start_datetime: `${testDate}T14:00:00+05:30`,
      p_end_datetime: `${testDate}T22:00:00+05:30`,
      p_start_meter: mtr2Start,
      p_end_meter: mtr2End,
      p_start_time: "02:00 PM",
      p_end_time: "10:00 PM",
      p_is_breakdown: false,
      p_idempotency_key: `test_shift_b_${Date.now()}`,
    });

    assert(!rpc2Err && rpc2?.success, "RPC accepted Shift B submission", rpc2Err?.message);

    const { data: log2 } = await supabase
      .from("machine_hour_logs")
      .select("id, shift_code, normal_working_hours, overtime_hours, running_hours, shift")
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate)
      .eq("shift_code", "B")
      .single();

    assert(log2?.shift_code === "B", "Log 2 has shift_code 'B'");
    assert(Number(log2?.normal_working_hours) === 0, `Log 2 normal hours is 0h (actual: ${log2?.normal_working_hours})`);
    assert(Number(log2?.overtime_hours) === 8, `Log 2 overtime hours is 8h (100% OT on 2nd shift!) (actual: ${log2?.overtime_hours})`);

    // TEST 3: Duplicate Shift Prevention (submitting Shift A again on the same operational date)
    console.log("\n--- TEST 3: Duplicate Shift Prevention ---");
    const { data: rpcDup, error: rpcDupErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testClient.id,
      p_shift_code: "A",
      p_log_date: testDate,
      p_end_date: testDate,
      p_start_datetime: `${testDate}T06:00:00+05:30`,
      p_end_datetime: `${testDate}T14:00:00+05:30`,
      p_start_meter: mtr1Start,
      p_end_meter: mtr1End,
      p_start_time: "06:00 AM",
      p_end_time: "02:00 PM",
      p_is_breakdown: false,
      p_idempotency_key: `test_shift_dup_${Date.now()}`,
    });

    assert(
      !!rpcDupErr && rpcDupErr.message.includes("already"),
      "Duplicate Shift A on same operational date was correctly rejected",
      `error: ${rpcDupErr?.message}`
    );

    // TEST 4: Built-in Overtime Test (Client B 12-hour shift: 8h normal + 4h built-in OT)
    console.log("\n--- TEST 4: Built-in Overtime (12h Shift = 8h Normal + 4h OT) ---");
    // Create temporary 12h shift template
    const testDate2 = "2026-09-21";
    await supabase
      .from("machine_hour_logs")
      .delete()
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate2);

    const { data: customShift } = await supabase
      .from("client_shift_codes")
      .upsert({
        client_id: testClient.id,
        code: "X",
        name: "12h Test Shift",
        start_time: "06:00:00",
        end_time: "18:00:00",
        scheduled_minutes: 720,
        normal_minutes: 480,
        is_active: true,
      })
      .select()
      .single();

    const { data: rpc12, error: rpc12Err } = await supabase.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: testMachine.id,
      p_operator_id: testOperator.id,
      p_client_id: testClient.id,
      p_shift_code: "X",
      p_log_date: testDate2,
      p_end_date: testDate2,
      p_start_datetime: `${testDate2}T06:00:00+05:30`,
      p_end_datetime: `${testDate2}T18:00:00+05:30`,
      p_start_meter: 500,
      p_end_meter: 512,
      p_start_time: "06:00 AM",
      p_end_time: "06:00 PM",
      p_is_breakdown: false,
      p_idempotency_key: `test_shift_12h_${Date.now()}`,
    });

    assert(!rpc12Err && rpc12?.success, "RPC accepted 12h Shift X submission", rpc12Err?.message);

    const { data: log12 } = await supabase
      .from("machine_hour_logs")
      .select("id, shift_code, normal_working_hours, overtime_hours, running_hours")
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate2)
      .eq("shift_code", "X")
      .single();

    assert(Number(log12?.normal_working_hours) === 8, `12h shift normal hours is 8h (actual: ${log12?.normal_working_hours})`);
    assert(Number(log12?.overtime_hours) === 4, `12h shift built-in overtime is 4h (actual: ${log12?.overtime_hours})`);

    // Clean up test records
    await supabase.from("machine_hour_logs").delete().eq("operator_id", testOperator.id).in("log_date", [testDate, testDate2]);
    if (customShift?.id) {
      await supabase.from("client_shift_codes").delete().eq("id", customShift.id);
    }
    if (tempMachine?.id) {
      await supabase.from("machines").delete().eq("id", tempMachine.id);
    }
    console.log("\nCleaned up all temporary test records.");

  } catch (err) {
    console.error("Unhandled test suite exception:", err);
    failed++;
  }

  console.log("\n=================================================================");
  console.log(`🏁 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
