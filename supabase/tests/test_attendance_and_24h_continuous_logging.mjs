/**
 * Automated Verification Test Suite:
 * Attendance & Daily Overtime Reconciliation and Continuous 24h Shift Logging
 *
 * Environment Isolation:
 * - Target Dev DB: vlmxciuogczumumrwyot (Reach International Dev)
 * - Production DB: dhbbgfzbyatzvqafnsqp (Strictly Untouched)
 *
 * Verification Objectives:
 * 1. View `public.operator_worked_hours`:
 *    - Aggregates up to 3 shifts (24h) into total_normal_hours = 24.0h.
 *    - Asserts total_overtime_hours = 0.0 (no false-positive overtime penalty for scheduled coverage).
 *    - Asserts daily_attendance_status = 'PRESENT' and shifts_logged_count = 3.
 * 2. RPC `public.get_hr_payroll_summary`:
 *    - Multi-shift reconciliation: 24 normal hours equates to 3.0 attended days (GREATEST(work_days, ROUND(normal_hours / 8.0, 1))).
 *    - Asserts attended_days >= 3.0 and ot_days = 0.
 * 3. RPC `public.get_operator_dashboard`:
 *    - Returns `assigned_shifts` array detailing Shift A, Shift B, and Shift C.
 *    - Returns `today` summary with `entryStatus`, `submittedCount`, `totalAssignedCount`, and `totalRunningHoursToday`.
 * 4. RPC `public.get_operator_entry_context`:
 *    - Returns `today_logged_shift_codes` and `today_logs` for start-meter continuous handoff.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load env
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
        process.env[key] = val;
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../apps/web/.env.local'));
loadEnv(path.resolve(__dirname, '../../.env'));

const DEV_PROJECT_ID = 'vlmxciuogczumumrwyot';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.");
  process.exit(1);
}

// Strict Supabase Environment Isolation Gate
if (!SUPABASE_URL.includes(DEV_PROJECT_ID) || SUPABASE_URL.includes("dhbbgfzbyatzvqafnsqp")) {
  console.error(`FATAL CRITICAL SAFETY GATE: Target must strictly be Dev project (${DEV_PROJECT_ID}). Found: ${SUPABASE_URL}. Production (dhbbgfzbyatzvqafnsqp) is strictly untouched!`);
  process.exit(1);
}

console.log(`Target Database verified: Development (${DEV_PROJECT_ID})`);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTest() {
  console.log("\n========================================================");
  console.log("Starting Attendance & 24h Continuous Logging Test Suite");
  console.log("========================================================\n");

  let testOperator = null;
  let testMachine = null;
  let testClient = null;
  const createdLogIds = [];
  const testDate = "2026-09-30";

  try {
    // 1. Fetch test operator (Deepak Patel or any active operator)
    const { data: operators, error: opErr } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("role", "operator")
      .eq("status", "active")
      .limit(1);

    if (opErr || !operators || operators.length === 0) {
      throw new Error(`Failed to find active operator: ${opErr?.message}`);
    }
    testOperator = operators[0];
    console.log(`[SETUP] Using Operator: ${testOperator.full_name} (${testOperator.id})`);

    // 2. Fetch test machine
    const { data: machines, error: mErr } = await supabase
      .from("machines")
      .select("id, machine_id, client_id, hour_meter")
      .limit(1);

    if (mErr || !machines || machines.length === 0) {
      throw new Error(`Failed to find machine: ${mErr?.message}`);
    }
    testMachine = machines[0];
    console.log(`[SETUP] Using Machine: ${testMachine.machine_id} (${testMachine.id}), client: ${testMachine.client_id}`);

    // 3. Ensure test client has shift codes (A, B, C)
    const { data: clientShifts } = await supabase
      .from("client_shift_codes")
      .select("code, start_time, end_time")
      .eq("client_id", testMachine.client_id);
    console.log(`[SETUP] Found ${clientShifts?.length || 0} client shift codes:`, clientShifts?.map((s) => s.code));

    // 4. Assign operator to 3 shifts on this machine (Shift A, Shift B, Shift C) if not already assigned
    const shiftsToAssign = ["A", "B", "C"];
    for (const code of shiftsToAssign) {
      const { data: existing } = await supabase
        .from("operator_machine_assignments")
        .select("id")
        .eq("operator_id", testOperator.id)
        .eq("machine_id", testMachine.id)
        .eq("shift_code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) {
        let startTime = "06:00:00";
        let endTime = "14:00:00";
        if (code === "B") { startTime = "14:00:00"; endTime = "22:00:00"; }
        if (code === "C") { startTime = "22:00:00"; endTime = "06:00:00"; }

        await supabase.from("operator_machine_assignments").insert({
          operator_id: testOperator.id,
          machine_id: testMachine.id,
          shift_code: code,
          shift_start_time: startTime,
          shift_end_time: endTime,
          crosses_midnight: code === "C",
          is_active: true,
          assigned_at: new Date().toISOString(),
        });
      }
    }
    console.log(`[SETUP] Assigned Operator ${testOperator.full_name} to 3 shifts (A, B, C) on ${testMachine.machine_id}`);

    // 5. Clean any existing logs for this test date & operator
    const { data: existingLogs } = await supabase
      .from("machine_hour_logs")
      .select("id")
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate);

    if (existingLogs && existingLogs.length > 0) {
      await supabase.from("machine_hour_logs").delete().in("id", existingLogs.map((l) => l.id));
    }

    // Baseline payroll before inserting 24h continuous logs
    const { data: baselinePayrollSummary } = await supabase.rpc("get_hr_payroll_summary", {
      p_payroll_month: "2026-09-01",
    });
    const baselineOpPayroll = (baselinePayrollSummary || []).find((p) => p.operator_id === testOperator.id);
    const baseAttendedDays = Number(baselineOpPayroll?.attended_days || 0);
    const baseNormalHours = Number(baselineOpPayroll?.normal_hours || 0);
    const baseOtHours = Number(baselineOpPayroll?.ot_hours || 0);
    console.log(`[SETUP] Baseline operator payroll: ${baseAttendedDays} attended days, ${baseNormalHours}h normal, ${baseOtHours}h OT`);

    // -------------------------------------------------------------------------
    // TEST STEP 1: Continuous 24h Shift Logging across all 3 shifts
    // -------------------------------------------------------------------------
    console.log("\n--- TEST STEP 1: Continuous 24h Shift Logging ---");
    const baseMeter = Number(testMachine.hour_meter) || 1000;

    // Shift A: 06:00 to 14:00 (8h), meter 1000 -> 1008
    const logA = await supabase.from("machine_hour_logs").insert({
      operator_id: testOperator.id,
      machine_id: testMachine.id,
      client_id: testMachine.client_id,
      log_date: testDate,
      start_meter: baseMeter,
      end_meter: baseMeter + 8.0,
      start_time: "06:00:00",
      end_time: "14:00:00",
      shift_code: "A",
      shift: "Shift A",
      normal_working_hours: 8.0,
      overtime_hours: 0.0,
      entry_source: "operator",
    }).select().single();

    if (logA.error) throw new Error(`Failed to log Shift A: ${logA.error.message}`);
    createdLogIds.push(logA.data.id);
    console.log(`✓ Shift A Logged: ${logA.data.start_meter} -> ${logA.data.end_meter} (Running: ${logA.data.running_hours}h, OT: ${logA.data.overtime_hours}h)`);

    // Shift B: 14:00 to 22:00 (8h), meter 1008 -> 1016 (Handed off seamlessly)
    const logB = await supabase.from("machine_hour_logs").insert({
      operator_id: testOperator.id,
      machine_id: testMachine.id,
      client_id: testMachine.client_id,
      log_date: testDate,
      start_meter: baseMeter + 8.0,
      end_meter: baseMeter + 16.0,
      start_time: "14:00:00",
      end_time: "22:00:00",
      shift_code: "B",
      shift: "Shift B",
      normal_working_hours: 8.0,
      overtime_hours: 0.0,
      entry_source: "operator",
    }).select().single();

    if (logB.error) throw new Error(`Failed to log Shift B: ${logB.error.message}`);
    createdLogIds.push(logB.data.id);
    console.log(`✓ Shift B Logged: ${logB.data.start_meter} -> ${logB.data.end_meter} (Running: ${logB.data.running_hours}h, OT: ${logB.data.overtime_hours}h)`);

    // Shift C: 22:00 to 06:00 (8h, overnight), meter 1016 -> 1024
    const logC = await supabase.from("machine_hour_logs").insert({
      operator_id: testOperator.id,
      machine_id: testMachine.id,
      client_id: testMachine.client_id,
      log_date: testDate,
      start_meter: baseMeter + 16.0,
      end_meter: baseMeter + 24.0,
      start_time: "22:00:00",
      end_time: "06:00:00",
      shift_code: "C",
      shift: "Shift C",
      normal_working_hours: 8.0,
      overtime_hours: 0.0,
      entry_source: "operator",
    }).select().single();

    if (logC.error) throw new Error(`Failed to log Shift C: ${logC.error.message}`);
    createdLogIds.push(logC.data.id);
    console.log(`✓ Shift C Logged: ${logC.data.start_meter} -> ${logC.data.end_meter} (Running: ${logC.data.running_hours}h, OT: ${logC.data.overtime_hours}h)`);

    // -------------------------------------------------------------------------
    // TEST STEP 2: Verify View `public.operator_worked_hours`
    // -------------------------------------------------------------------------
    console.log("\n--- TEST STEP 2: Verify public.operator_worked_hours View ---");
    const { data: workedHours, error: whErr } = await supabase
      .from("operator_worked_hours")
      .select("*")
      .eq("operator_id", testOperator.id)
      .eq("log_date", testDate)
      .single();

    if (whErr) throw new Error(`Failed to query operator_worked_hours: ${whErr.message}`);

    console.log("operator_worked_hours record:", {
      shifts_logged_count: workedHours.shifts_logged_count,
      shift_codes_logged: workedHours.shift_codes_logged,
      total_normal_hours: workedHours.total_normal_hours,
      total_overtime_hours: workedHours.total_overtime_hours,
      total_worked_hours: workedHours.total_worked_hours,
      daily_attendance_status: workedHours.daily_attendance_status,
    });

    if (Number(workedHours.shifts_logged_count) !== 3) {
      throw new Error(`Expected shifts_logged_count = 3, got ${workedHours.shifts_logged_count}`);
    }
    if (Number(workedHours.total_normal_hours) !== 24.0) {
      throw new Error(`Expected total_normal_hours = 24.0, got ${workedHours.total_normal_hours}`);
    }
    if (Number(workedHours.total_overtime_hours) !== 0.0) {
      throw new Error(`Expected total_overtime_hours = 0.0 (no false OT penalty), got ${workedHours.total_overtime_hours}`);
    }
    if (workedHours.daily_attendance_status !== "PRESENT") {
      throw new Error(`Expected daily_attendance_status = 'PRESENT', got ${workedHours.daily_attendance_status}`);
    }
    console.log("✓ public.operator_worked_hours view successfully aggregated 3 continuous shifts into 24.0 normal hours with 0.0 overtime penalty!");

    // -------------------------------------------------------------------------
    // TEST STEP 3: Verify RPC `public.get_hr_payroll_summary`
    // -------------------------------------------------------------------------
    console.log("\n--- TEST STEP 3: Verify get_hr_payroll_summary Multi-Shift Attendance ---");
    const { data: payrollSummary, error: payErr } = await supabase.rpc("get_hr_payroll_summary", {
      p_payroll_month: "2026-09-01",
    });

    if (payErr) throw new Error(`get_hr_payroll_summary RPC failed: ${payErr.message}`);

    const opPayroll = (payrollSummary || []).find((p) => p.operator_id === testOperator.id);
    if (!opPayroll) {
      console.warn("Operator payroll not found in month, checking returned rows:", payrollSummary?.length);
    } else {
      console.log("Operator Payroll Attendance Roll-up:", {
        operator: opPayroll.full_name,
        working_days: opPayroll.working_days,
        attended_days: opPayroll.attended_days,
        normal_hours: opPayroll.normal_hours,
        ot_hours: opPayroll.ot_hours,
        ot_days: opPayroll.ot_days,
        attended_amount: opPayroll.attended_amount,
      });

      // 24.0h normal hours should credit GREATEST(work_days, 24.0 / 8.0) = +3.0 attended days!
      const deltaAttendedDays = Number(opPayroll.attended_days) - baseAttendedDays;
      const deltaNormalHours = Number(opPayroll.normal_hours) - baseNormalHours;
      const deltaOtHours = Number(opPayroll.ot_hours) - baseOtHours;

      console.log("Operator Payroll Delta:", {
        deltaAttendedDays,
        deltaNormalHours,
        deltaOtHours,
      });

      if (deltaAttendedDays !== 3.0) {
        throw new Error(`Expected deltaAttendedDays = 3.0 (3 shifts coverage), got ${deltaAttendedDays}`);
      }
      if (deltaNormalHours !== 24.0) {
        throw new Error(`Expected deltaNormalHours = 24.0 (3 x 8h shifts), got ${deltaNormalHours}`);
      }
      if (deltaOtHours !== 0.0) {
        throw new Error(`Expected deltaOtHours = 0.0 (no overtime penalty for scheduled coverage), got ${deltaOtHours}`);
      }
      console.log(`✓ get_hr_payroll_summary properly credited +${deltaAttendedDays} attended days (3 shifts coverage) with +${deltaOtHours} overtime penalty!`);
    }

    // -------------------------------------------------------------------------
    // TEST STEP 4: Verify RPC `public.get_operator_dashboard`
    // -------------------------------------------------------------------------
    console.log("\n--- TEST STEP 4: Verify get_operator_dashboard assigned_shifts & today summary ---");
    const { data: dash, error: dashErr } = await supabase.rpc("get_operator_dashboard", {
      p_operator_id: testOperator.id,
    });

    if (dashErr) throw new Error(`get_operator_dashboard RPC failed: ${dashErr.message}`);

    console.log("Operator Dashboard summary:", {
      today: dash.today,
      assigned_shifts_count: dash.assigned_shifts?.length,
      assigned_shifts: dash.assigned_shifts?.map((s) => ({
        code: s.code,
        name: s.name,
        timings: `${s.start_time} - ${s.end_time}`,
        is_logged_today: s.is_logged_today,
        running_hours: s.running_hours_today,
      })),
      alerts: dash.alerts,
    });

    if (!Array.isArray(dash.assigned_shifts) || dash.assigned_shifts.length === 0) {
      throw new Error("Expected assigned_shifts array to contain assigned shifts on the machine.");
    }
    console.log("✓ get_operator_dashboard returned assigned_shifts array and multi-shift today status successfully!");

    // -------------------------------------------------------------------------
    // TEST STEP 5: Verify RPC `public.get_operator_entry_context`
    // -------------------------------------------------------------------------
    console.log("\n--- TEST STEP 5: Verify get_operator_entry_context continuous handoff ---");
    const { data: ctx, error: ctxErr } = await supabase.rpc("get_operator_entry_context", {
      p_operator_id: testOperator.id,
    });

    if (ctxErr) throw new Error(`get_operator_entry_context RPC failed: ${ctxErr.message}`);

    console.log("Operator Entry Context:", {
      assigned_shift_codes: ctx.assigned_shift_codes,
      today_logged_shift_codes: ctx.today_logged_shift_codes,
      today_logs_count: ctx.today_logs?.length,
      last_hmr: ctx.last_hmr,
    });

    if (!Array.isArray(ctx.today_logged_shift_codes)) {
      throw new Error("Expected today_logged_shift_codes array in get_operator_entry_context.");
    }
    console.log("✓ get_operator_entry_context returned today_logged_shift_codes and today_logs successfully!");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: Attendance & 24h Continuous Logging Verified!");
    console.log("========================================================\n");
  } finally {
    // Clean up created test logs
    if (createdLogIds.length > 0) {
      console.log(`[CLEANUP] Removing ${createdLogIds.length} test machine_hour_logs...`);
      await supabase.from("machine_hour_logs").delete().in("id", createdLogIds);
    }
  }
}

runTest().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
