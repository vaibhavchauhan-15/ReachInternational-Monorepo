// End-to-End Test Suite: Assisted Shift Entry & Today Shift Monitor DB Verification
// Environment: STRICTLY TARGETING DEV DB (vlmxciuogczumumrwyot)

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

const supabasePkgPath = path.resolve(__dirname, "../../node_modules/@supabase/supabase-js/dist/index.mjs");
const { createClient } = await import(pathToFileURL(supabasePkgPath).href);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vlmxciuogczumumrwyot.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl.includes("vlmxciuogczumumrwyot")) {
  console.error("FATAL: Target URL is NOT the development database (vlmxciuogczumumrwyot)! Aborting.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    totalFailed++;
  }
}

async function runTest() {
  console.log("=========================================================================");
  console.log("TEST: Assisted Shift Entry & Today Shift Monitor Database Verification");
  console.log("Dev Database Target: vlmxciuogczumumrwyot");
  console.log("=========================================================================\n");

  try {
    // 1. Fetch supervisor actor
    const { data: supervisor, error: supErr } = await adminClient
      .from("users")
      .select("id, full_name, role")
      .in("role", ["supervisor", "admin", "super_admin"])
      .limit(1)
      .single();

    assert(!supErr && supervisor?.id, `Found supervisor actor: ${supervisor?.full_name} (${supervisor?.role})`);

    // Clean up any lingering test logs from previous runs
    await adminClient
      .from("machine_hour_logs")
      .delete()
      .like("remarks", "%Automated verification assisted entry test%");

    const today = new Date().toISOString().split("T")[0];

    // 2. Query initial monitor rows
    console.log("\n1. Querying initial Today Shift Monitor rows...");
    const { data: initialMonitorRows, error: initMonErr } = await adminClient.rpc("get_today_shift_log_monitor", {
      p_actor_id: supervisor.id,
      p_log_date: today,
    });

    assert(!initMonErr && Array.isArray(initialMonitorRows), `get_today_shift_log_monitor returned ${initialMonitorRows?.length} rows`);

    const initialTotal = initialMonitorRows.length;
    const initialEntered = initialMonitorRows.filter((r) => r.status === "entered").length;
    const initialPending = initialMonitorRows.filter((r) => r.status === "pending").length;

    console.log(`  Initial KPIs: Total=${initialTotal}, Entered=${initialEntered}, Pending=${initialPending}`);
    assert(initialTotal === initialEntered + initialPending, `Initial KPI reconciliation holds: Total = Entered + Pending`);

    // 1b. Check existing logs today
    const { data: existingLogs } = await adminClient
      .from("machine_hour_logs")
      .select("machine_id, log_date, start_datetime, end_datetime, operator_id")
      .eq("log_date", today);

    const loggedMachineIds = new Set((existingLogs || []).map((l) => l.machine_id));
    console.log(`Machines with logs today: ${loggedMachineIds.size}`, Array.from(loggedMachineIds));

    // Pick a pending row whose machine does NOT yet have a log today
    const pendingTarget = initialMonitorRows.find(
      (r) => r.status === "pending" && r.operator_id && r.machine_id && !loggedMachineIds.has(r.machine_id)
    );

    assert(pendingTarget !== undefined, `Found clean pending target without conflicting log: Machine "${pendingTarget?.machine_code}", Operator "${pendingTarget?.operator_name}", Shift "${pendingTarget?.shift_code}"`);

    const targetMachineId = pendingTarget.machine_id;
    const targetOperatorId = pendingTarget.operator_id;
    const targetShiftCode = pendingTarget.shift_code || "A";
    const currentMeter = Number(pendingTarget.current_meter || 1000);
    const startMeter = currentMeter;
    const endMeter = currentMeter + 7.5;
    const runningHours = 7.5;

    const startISO = new Date(`${today}T06:00:00+05:30`).toISOString();
    const endISO = new Date(`${today}T14:00:00+05:30`).toISOString();

    console.log(`\n2. Submitting assisted shift log via submit_operator_hour_log_atomic RPC...`);
    console.log(`   Machine: ${pendingTarget.machine_code}, Operator: ${pendingTarget.operator_name}`);
    console.log(`   Start Meter: ${startMeter}, End Meter: ${endMeter}, Running Hours: ${runningHours}`);
    console.log(`   Start ISO: ${startISO}, End ISO: ${endISO}`);

    const { data: logResult, error: submitErr } = await adminClient.rpc("submit_operator_hour_log_atomic", {
      p_machine_id: targetMachineId,
      p_operator_id: targetOperatorId,
      p_client_id: pendingTarget.client_id,
      p_log_date: today,
      p_end_date: today,
      p_start_datetime: startISO,
      p_end_datetime: endISO,
      p_start_meter: startMeter,
      p_end_meter: endMeter,
      p_start_time: "06:00:00",
      p_end_time: "14:00:00",
      p_overtime_hours: 0,
      p_normal_working_hours: runningHours,
      p_is_breakdown: false,
      p_breakdown_start_time: null,
      p_breakdown_end_time: null,
      p_breakdown_duration: null,
      p_breakdown_hours: 0,
      p_shift: `Shift ${targetShiftCode}`,
      p_shift_code: targetShiftCode,
      p_machine_condition: "good",
      p_location: null,
      p_remarks: "Automated verification assisted entry test",
      p_idempotency_key: `e2e-test-${Date.now()}`,
      p_entered_by: supervisor.id,
    });

    assert(!submitErr, `RPC submit_operator_hour_log_atomic succeeded without error: ${submitErr ? JSON.stringify(submitErr) : "OK"}`);
    assert(logResult?.success === true, `RPC returned success: ${logResult?.message || "OK"}`);
    const createdLogId = logResult?.logId || logResult?.log_id;
    console.log(`   Created Log ID: ${createdLogId}`);

    // 3. Verify machine hour_meter was updated atomically
    const { data: updatedMachine, error: mErr } = await adminClient
      .from("machines")
      .select("id, hour_meter")
      .eq("id", targetMachineId)
      .single();

    assert(!mErr && Number(updatedMachine.hour_meter) === endMeter, `Machine hour_meter updated atomically to ${endMeter} (was ${currentMeter})`);

    // 4. Query get_today_shift_log_monitor post-entry
    console.log("\n3. Querying get_today_shift_log_monitor post-entry...");
    const { data: postMonitorRows, error: postErr } = await adminClient.rpc("get_today_shift_log_monitor", {
      p_actor_id: supervisor.id,
      p_log_date: today,
    });

    assert(!postErr && Array.isArray(postMonitorRows), `post-entry get_today_shift_log_monitor returned ${postMonitorRows?.length} rows`);

    const updatedRow = postMonitorRows.find((r) => r.machine_id === targetMachineId && r.operator_id === targetOperatorId);
    assert(updatedRow !== undefined, `Found row for machine ${pendingTarget.machine_code} and operator ${pendingTarget.operator_name}`);

    if (updatedRow) {
      assert(updatedRow.status === "entered", `Row transitioned to status 'entered' (was 'pending')`);
      assert(Number(updatedRow.start_meter) === startMeter, `start_meter matches (${updatedRow.start_meter} == ${startMeter})`);
      assert(Number(updatedRow.end_meter) === endMeter, `end_meter matches (${updatedRow.end_meter} == ${endMeter})`);
      assert(Number(updatedRow.running_hours) === runningHours, `running_hours matches (${updatedRow.running_hours} == ${runningHours})`);
      assert(updatedRow.entered_by_name === supervisor.full_name, `entered_by_name matches supervisor: "${updatedRow.entered_by_name}"`);
      assert(
        updatedRow.entry_source === supervisor.role || updatedRow.entry_source === "supervisor",
        `entry_source is '${updatedRow.entry_source}'`
      );
      assert(updatedRow.log_id === createdLogId, `log_id links directly to created record (${updatedRow.log_id})`);
    }

    // 5. Verify KPI counters update dynamically
    console.log("\n4. Verifying KPI Dynamic Counter Changes...");
    const postTotal = postMonitorRows.length;
    const postEntered = postMonitorRows.filter((r) => r.status === "entered").length;
    const postPending = postMonitorRows.filter((r) => r.status === "pending").length;

    assert(postEntered === initialEntered + 1, `Entered counter incremented dynamically: ${initialEntered} -> ${postEntered}`);
    assert(postPending === initialPending - 1, `Pending counter decremented dynamically: ${initialPending} -> ${postPending}`);
    assert(postTotal === postEntered + postPending, `Total counter reconciles: Total (${postTotal}) = Entered (${postEntered}) + Pending (${postPending})`);

    // 6. Clean up: restore machine hour meter and delete test log
    console.log("\n5. Cleaning up test record & restoring machine hour meter...");
    if (createdLogId) {
      await adminClient.from("machine_hour_logs").delete().eq("id", createdLogId);
      console.log(`   Deleted test log ID ${createdLogId}`);
    }
    await adminClient.from("machines").update({ hour_meter: currentMeter }).eq("id", targetMachineId);
    const { data: revertedMachine } = await adminClient.from("machines").select("hour_meter").eq("id", targetMachineId).single();
    assert(Number(revertedMachine.hour_meter) === currentMeter, `Machine hour meter restored cleanly to ${currentMeter}`);

    // Verify row reverted to pending after deletion
    const { data: finalMonitorRows } = await adminClient.rpc("get_today_shift_log_monitor", {
      p_actor_id: supervisor.id,
      p_log_date: today,
    });
    const finalRow = finalMonitorRows?.find((r) => r.machine_id === targetMachineId && r.operator_id === targetOperatorId);
    assert(finalRow?.status === "pending", `Row cleanly reverted back to 'pending' upon cleanup`);

    console.log("\n=========================================================================");
    console.log(`FINAL RESULT: ${totalPassed} Passed, ${totalFailed} Failed`);
    console.log("=========================================================================\n");

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Test execution fatal error:", err);
    process.exit(1);
  }
}

runTest();
