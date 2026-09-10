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

async function runSpareHealthStatusTests() {
  console.log("=================================================================");
  console.log("🚀 STARTING AUTOMATED TEST SUITE: 'SPARE' MACHINE HEALTH STATUS");
  console.log("=================================================================\n");

  let testMachineId = null;
  const testSerial = `TEST-SPARE-${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: Insert machine with health_status = 'spare'
    // -------------------------------------------------------------
    console.log("▶ TEST 1: Insert machine with health_status = 'spare'");
    const { data: newMachine, error: insertError } = await supabase
      .from("machines")
      .insert({
        model: "Dingli JCPT1612DC Test",
        serial_number: testSerial,
        manufacturer: "Dingli",
        year_of_mfg: 2024,
        hour_meter: 150,
        status: "rented",
        health_status: "spare",
      })
      .select("id, machine_id, serial_number, status, health_status")
      .single();

    if (insertError) {
      throw new Error(`Test 1 Failed to insert spare machine: ${insertError.message}`);
    }

    testMachineId = newMachine.id;
    console.log(`  ✓ Inserted machine: ID=${newMachine.machine_id}, health_status=${newMachine.health_status}, status=${newMachine.status}`);
    if (newMachine.health_status !== "spare") {
      throw new Error(`Test 1 Failed: Expected health_status 'spare', got '${newMachine.health_status}'`);
    }

    // -------------------------------------------------------------
    // TEST 2: Filter machines by health_status = 'spare'
    // -------------------------------------------------------------
    console.log("\n▶ TEST 2: Query machines filtered by health_status = 'spare'");
    const { data: spareMachines, error: filterError } = await supabase
      .from("machines")
      .select("id, machine_id, health_status")
      .eq("health_status", "spare");

    if (filterError) {
      throw new Error(`Test 2 Failed: Query error: ${filterError.message}`);
    }

    const found = spareMachines.some((m) => m.id === testMachineId);
    if (!found) {
      throw new Error(`Test 2 Failed: Test machine ${testMachineId} not found in spare machines list`);
    }
    console.log(`  ✓ Successfully queried ${spareMachines.length} spare machine(s), including test machine.`);

    // -------------------------------------------------------------
    // TEST 3: Update machine to health_status = 'active' and back to 'spare'
    // -------------------------------------------------------------
    console.log("\n▶ TEST 3: Transition machine health_status: 'spare' -> 'active' -> 'spare'");
    const { data: toActive, error: toActiveError } = await supabase
      .from("machines")
      .update({ health_status: "active" })
      .eq("id", testMachineId)
      .select("health_status")
      .single();

    if (toActiveError || toActive.health_status !== "active") {
      throw new Error(`Test 3a Failed: ${toActiveError?.message || "Status not active"}`);
    }
    console.log(`  ✓ Transitioned to 'active'`);

    const { data: backToSpare, error: backToSpareError } = await supabase
      .from("machines")
      .update({ health_status: "spare" })
      .eq("id", testMachineId)
      .select("health_status")
      .single();

    if (backToSpareError || backToSpare.health_status !== "spare") {
      throw new Error(`Test 3b Failed: ${backToSpareError?.message || "Status not spare"}`);
    }
    console.log(`  ✓ Transitioned back to 'spare'`);

    // -------------------------------------------------------------
    // TEST 4: Verify check constraint rejects invalid health_status
    // -------------------------------------------------------------
    console.log("\n▶ TEST 4: Verify check constraint rejects invalid health_status");
    const { error: invalidError } = await supabase
      .from("machines")
      .update({ health_status: "invalid_nonexistent_status" })
      .eq("id", testMachineId);

    if (!invalidError) {
      throw new Error("Test 4 Failed: Expected database constraint violation, but update succeeded!");
    }

    console.log(`  ✓ Successfully rejected invalid health status: ${invalidError.message} (code: ${invalidError.code})`);
    if (invalidError.code !== "23514") {
      console.warn(`  ⚠ Note: Unexpected error code ${invalidError.code}, expected 23514 (check_violation).`);
    }

    console.log("\n=================================================================");
    console.log("✅ ALL 4 TESTS PASSED SUCCESSFULLY WITH ZERO ERRORS!");
    console.log("=================================================================\n");
  } finally {
    // Clean up
    if (testMachineId) {
      console.log(`Cleaning up test machine ${testMachineId}...`);
      await supabase.from("machines").delete().eq("id", testMachineId);
      console.log(`Cleaned up.`);
    }
  }
}

runSpareHealthStatusTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
