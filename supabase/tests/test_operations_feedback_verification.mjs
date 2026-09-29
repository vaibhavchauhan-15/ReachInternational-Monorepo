import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const rootEnv = parseEnv(path.resolve(__dirname, "../../.env"));
const webEnv = parseEnv(path.resolve(__dirname, "../../apps/web/.env.local"));

const supabaseUrl = webEnv.NEXT_PUBLIC_SUPABASE_URL || rootEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  webEnv.SUPABASE_SERVICE_ROLE_KEY ||
  rootEnv.SUPABASE_SERVICE_ROLE_KEY ||
  webEnv.SUPABASE_SECRET_KEY ||
  rootEnv.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Ensure targeting Dev DB
if (!supabaseUrl.includes("vlmxciuogczumumrwyot")) {
  console.error("Safety guard: Refusing to test on non-dev database:", supabaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTests() {
  console.log("=== Testing Migration 134 & Role Guard Verification ===");

  // 1. Fetch user IDs for distinct roles: super_admin, admin, manager, supervisor, hr, operator
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["super_admin", "admin", "manager", "supervisor", "hr", "operator"]);

  if (userError || !users || users.length === 0) {
    console.error("Failed to load users for testing:", userError);
    process.exit(1);
  }

  const roleMap = new Map();
  for (const u of users) {
    if (!roleMap.has(u.role)) {
      roleMap.set(u.role, u);
    }
  }

  console.log("Found test users:");
  for (const [role, u] of roleMap.entries()) {
    console.log(`- ${role}: ${u.full_name} (${u.id})`);
  }

  const operatorUser = roleMap.get("operator");
  const supervisorUser = roleMap.get("supervisor");
  const managerUser = roleMap.get("manager");
  const adminUser = roleMap.get("admin");
  const superAdminUser = roleMap.get("super_admin");

  if (!operatorUser) {
    console.error("No operator user found for testing");
    process.exit(1);
  }

  // 2. Test can_manage_operator_shift_log authorization function
  console.log("\n--- Testing can_manage_operator_shift_log RPC ---");
  const rolesToTest = [
    { role: "super_admin", user: superAdminUser, expected: true },
    { role: "admin", user: adminUser, expected: true },
    { role: "manager", user: managerUser, expected: true },
    { role: "supervisor", user: supervisorUser, expected: false },
    { role: "hr", user: roleMap.get("hr"), expected: false },
    { role: "operator", user: operatorUser, expected: false },
  ];

  for (const item of rolesToTest) {
    if (!item.user) continue;
    const { data: canManage, error: rpcErr } = await supabase.rpc("can_manage_operator_shift_log", {
      p_actor_id: item.user.id,
      p_operator_id: operatorUser.id,
    });

    if (rpcErr) {
      console.error(`Error checking can_manage_operator_shift_log for ${item.role}:`, rpcErr);
      process.exit(1);
    }

    const passed = canManage === item.expected;
    console.log(
      `Role: ${item.role.padEnd(12)} -> can_manage: ${String(canManage).padEnd(5)} | Expected: ${String(item.expected).padEnd(5)} [${passed ? "PASS" : "FAIL"}]`
    );
    if (!passed) {
      console.error(`FAILED: Role ${item.role} had can_manage=${canManage}, expected ${item.expected}`);
      process.exit(1);
    }
  }

  // 3. Test submit_operator_hour_log_atomic rejection when actor is a supervisor
  if (supervisorUser) {
    console.log("\n--- Testing supervisor assisted entry rejection in submit_operator_hour_log_atomic ---");
    // Get a test machine
    const { data: machine } = await supabase.from("machines").select("id, machine_id").limit(1).single();
    if (machine) {
      const { data: res, error: supErr } = await supabase.rpc("submit_operator_hour_log_atomic", {
        p_machine_id: machine.id,
        p_operator_id: operatorUser.id,
        p_entered_by: supervisorUser.id,
        p_start_meter: 100,
        p_end_meter: 108,
      });

      if (supErr) {
        console.log(`Supervisor rejected as expected: Code ${supErr.code} - ${supErr.message} [PASS]`);
      } else {
        console.error("FAIL: Supervisor was unexpectedly allowed to submit assisted log:", res);
        process.exit(1);
      }
    }
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
