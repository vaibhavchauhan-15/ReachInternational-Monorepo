import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vlmxciuogczumumrwyot.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log("=== Testing Operator Default Shift Resolution on Dev DB (vlmxciuogczumumrwyot) ===\n");
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✔ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`✖ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Test Operator 004 (has assignment with shift_code = 'C')
  const op004Id = "0195c48f-93e7-4e31-9d19-17a421fa80c6";
  const { data: ctx004, error: err004 } = await supabase.rpc("get_operator_entry_context", {
    p_operator_id: op004Id,
  });

  assert(!err004, "RPC get_operator_entry_context executed cleanly for Operator 004");
  assert(ctx004?.assigned_shift_code === "C", `Operator 004 assigned_shift_code is 'C' (got: ${ctx004?.assigned_shift_code})`);
  assert(ctx004?.operator?.shift_code === "C", `Operator 004 operator.shift_code is 'C' (got: ${ctx004?.operator?.shift_code})`);
  assert(Array.isArray(ctx004?.shift_codes) && ctx004.shift_codes.length > 0, `Operator 004 received shift_codes list (count: ${ctx004?.shift_codes?.length})`);

  // 2. Test Operator 015 (has assignment with shift_code = null, shift_start = 06:00:00, client has shifts A/B/C)
  const op015Id = "0cb5fd17-9321-40cd-9a6e-791f4b2d87a0";
  const { data: ctx015, error: err015 } = await supabase.rpc("get_operator_entry_context", {
    p_operator_id: op015Id,
  });

  assert(!err015, "RPC get_operator_entry_context executed cleanly for Operator 015");
  assert(ctx015?.assigned_shift_code === "A", `Operator 015 assigned_shift_code resolved to 'A' from client_shift_codes (got: ${ctx015?.assigned_shift_code})`);
  assert(ctx015?.operator?.shift_code === "A", `Operator 015 operator.shift_code resolved to 'A' (got: ${ctx015?.operator?.shift_code})`);

  // 3. Test Operator 079 (unassigned, profile shift 12:00:00 - 18:00:00)
  const op079Id = "056a1d10-da4e-4044-a278-4b3cc9fc94c0";
  const { data: ctx079, error: err079 } = await supabase.rpc("get_operator_entry_context", {
    p_operator_id: op079Id,
  });

  assert(!err079, "RPC get_operator_entry_context executed cleanly for Operator 079");
  assert(ctx079?.assigned_shift_code === "S2", `Operator 079 assigned_shift_code resolved to 'S2' for afternoon shift (got: ${ctx079?.assigned_shift_code})`);
  assert(ctx079?.operator?.shift_code === "S2", `Operator 079 operator.shift_code resolved to 'S2' (got: ${ctx079?.operator?.shift_code})`);
  assert(Array.isArray(ctx079?.shift_codes) && ctx079.shift_codes.length === 3, `Operator 079 received fallback S1/S2/S3 shift templates (count: ${ctx079?.shift_codes?.length})`);

  // 4. Test Operator with night profile shift (e.g. 18:00:00 or 00:00:00)
  const op011Id = "11ac3323-e12e-44e3-b942-58dafb6e85ec"; // Shift 18:00 - 23:59
  const { data: ctx011, error: err011 } = await supabase.rpc("get_operator_entry_context", {
    p_operator_id: op011Id,
  });

  assert(!err011, "RPC get_operator_entry_context executed cleanly for Operator 011");
  assert(ctx011?.assigned_shift_code === "S3", `Operator 011 assigned_shift_code resolved to 'S3' for evening/night shift (got: ${ctx011?.assigned_shift_code})`);

  console.log(`\n=== Summary: ${passed}/${total} tests passed ===`);
  if (passed === total) {
    console.log("✔ ALL OPERATOR SHIFT RESOLUTION TESTS PASSED!");
  } else {
    console.error("✖ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
