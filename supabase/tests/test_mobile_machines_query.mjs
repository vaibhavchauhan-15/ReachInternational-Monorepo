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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dhbbgfzbyatzvqafnsqp.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseAdminKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseAdminKey || !supabaseAnonKey) {
  console.error("❌ Missing required Supabase keys in environment");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseAdminKey);

async function createAuthenticatedClient(email) {
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyErr) throw verifyErr;

  return anonClient;
}

async function runMobileMachinesQuery(client) {
  return await client
    .from("machines")
    .select(`
      id,
      machine_id,
      model,
      serial_number,
      year_of_mfg,
      manufacturer,
      status,
      health_status,
      hour_meter,
      client_id,
      current_supervisor_id,
      supervisor_ids,
      current_operator_id,
      operator_ids,
      created_at,
      updated_at,
      client:clients!machines_client_id_fkey(
        id,
        code,
        company_name,
        contact_person,
        phone,
        address,
        city,
        district,
        state,
        pincode,
        gstin,
        pan_number,
        is_billing_address_different,
        billing_address,
        billing_city,
        billing_district,
        billing_state,
        billing_pincode,
        status
      ),
      current_supervisor:users!machines_current_supervisor_id_fkey(id, full_name, phone, email, shift_time, role),
      current_operator:users!machines_current_operator_id_fkey(id, full_name, phone, email, shift_time, role)
    `)
    .order("created_at", { ascending: false });
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: MOBILE MACHINES QUERY PARITY");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name, info = "") {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${info}`);
      failed++;
    }
  }

  try {
    // 1. Fetch target test users
    const { data: adminUsers } = await adminClient.from("users").select("email").in("role", ["admin", "super_admin"]).limit(1);
    const { data: supervisorUsers } = await adminClient.from("users").select("email").eq("role", "supervisor").limit(1);
    const { data: operatorUsers } = await adminClient.from("users").select("email").eq("role", "operator").limit(1);

    const adminEmail = adminUsers?.[0]?.email;
    const supervisorEmail = supervisorUsers?.[0]?.email;
    const operatorEmail = operatorUsers?.[0]?.email;

    assert(Boolean(adminEmail), "Found admin user for authentication testing", adminEmail);
    assert(Boolean(supervisorEmail), "Found supervisor user for authentication testing", supervisorEmail);
    assert(Boolean(operatorEmail), "Found operator user for authentication testing", operatorEmail);

    // 2. Test Admin query
    console.log("\n▶ TEST 1: Admin user querying machines");
    const adminAuthClient = await createAuthenticatedClient(adminEmail);
    const { data: adminData, error: adminErr } = await runMobileMachinesQuery(adminAuthClient);
    assert(!adminErr, "Admin machines query executed without error", adminErr?.message);
    assert(Array.isArray(adminData) && adminData.length >= 19, `Admin received all machines (count: ${adminData?.length})`);

    // 3. Test Supervisor query
    console.log("\n▶ TEST 2: Supervisor user querying machines");
    const supervisorAuthClient = await createAuthenticatedClient(supervisorEmail);
    const { data: supData, error: supErr } = await runMobileMachinesQuery(supervisorAuthClient);
    assert(!supErr, "Supervisor machines query executed without error", supErr?.message);
    assert(Array.isArray(supData) && supData.length >= 19, `Supervisor received all machines (count: ${supData?.length})`);

    // 4. Test Operator query
    console.log("\n▶ TEST 3: Operator user querying machines");
    const operatorAuthClient = await createAuthenticatedClient(operatorEmail);
    const { data: opData, error: opErr } = await runMobileMachinesQuery(operatorAuthClient);
    assert(!opErr, "Operator machines query executed without error", opErr?.message);
    assert(Array.isArray(opData) && opData.length >= 19, `Operator received all machines (count: ${opData?.length})`);

    // 5. Test Data integrity on fetched machines
    console.log("\n▶ TEST 4: Verifying machine fields & hydration integrity");
    const sample = adminData[0];
    assert(Boolean(sample.id), "Machine has valid UUID id");
    assert(Boolean(sample.machine_id), "Machine has valid machine_id code", sample.machine_id);
    assert(Boolean(sample.model), "Machine has model", sample.model);
    assert(sample.hour_meter !== undefined, "Machine has hour_meter", sample.hour_meter);
    assert(Boolean(sample.status), "Machine has rental status", sample.status);
    assert(Boolean(sample.health_status), "Machine has health status", sample.health_status);
    assert(!("customer_name" in sample), "Deprecated customer_name column correctly omitted from machines row");

    console.log("\n=================================================================");
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Unhandled error during test execution:", err);
    process.exit(1);
  }
}

runTestSuite();
