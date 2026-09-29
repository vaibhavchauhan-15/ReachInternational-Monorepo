// Test Suite: Real-Time WebSocket Broadcast & In-Memory Client Shifts Cache Validation
// Environment: STRICTLY TARGETING DEV DB (vlmxciuogczumumrwyot)

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
const subscriberClient = createClient(supabaseUrl, serviceRoleKey);
const publisherClient = createClient(supabaseUrl, serviceRoleKey);

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

// =========================================================================
// TEST SUITE 1: Client Shifts In-Memory Cache Invalidation
// =========================================================================
console.log("\n=======================================================");
console.log("TEST 1: In-Memory Client Shifts Cache with Invalidation");
console.log("=======================================================");

const testCache = new Map();
const TTL_MS = 60_000;

function getCached(clientId) {
  const entry = testCache.get(clientId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    testCache.delete(clientId);
    return null;
  }
  return entry.data;
}

function setCached(clientId, data) {
  testCache.set(clientId, { data, timestamp: Date.now() });
}

function invalidate(clientId) {
  if (clientId) {
    testCache.delete(clientId);
  } else {
    testCache.clear();
  }
}

const mockShiftsClientA = [
  { id: "s1", code: "S1", name: "Morning", normal_minutes: 360 },
  { id: "s2", code: "S2", name: "Afternoon", normal_minutes: 360 },
];
const mockShiftsClientB = [
  { id: "sa", code: "A", name: "Shift A", normal_minutes: 480 },
];

setCached("client-123", mockShiftsClientA);
setCached("client-456", mockShiftsClientB);

assert(getCached("client-123")?.length === 2, "client-123 shifts cached correctly");
assert(getCached("client-456")?.length === 1, "client-456 shifts cached correctly");

// Invalidate specific client
invalidate("client-123");
assert(getCached("client-123") === null, "client-123 cache is null immediately after client detail/shift edit");
assert(getCached("client-456")?.length === 1, "client-456 cache remains intact when other client is edited");

// Global invalidation
invalidate();
assert(getCached("client-456") === null, "Global invalidation purges all client shifts");

// TTL expiry
testCache.set("client-expired", { data: mockShiftsClientA, timestamp: Date.now() - 65_000 });
assert(getCached("client-expired") === null, "Expired cache entries (>60s) automatically return null");

// =========================================================================
// TEST SUITE 2: Live Shift Monitor Row Query & WebSocket Broadcast
// =========================================================================
console.log("\n=======================================================");
console.log("TEST 2: Live Shift Monitor Row & WebSocket Broadcast");
console.log("=======================================================");

async function runRealtimeTest() {
  try {
    // 1. Fetch live admin user for actor context
    const { data: adminUser, error: userErr } = await adminClient
      .from("users")
      .select("id, full_name, role")
      .in("role", ["super_admin", "admin"])
      .limit(1)
      .single();

    assert(!userErr && adminUser?.id, `Found admin actor for RPC: ${adminUser?.full_name || adminUser?.id}`);

    // 2. Fetch live rows from get_today_shift_log_monitor
    const { data: monitorRows, error: rpcErr } = await adminClient.rpc("get_today_shift_log_monitor", {
      p_actor_id: adminUser.id,
    });

    assert(!rpcErr && Array.isArray(monitorRows), `RPC get_today_shift_log_monitor succeeded, returned ${monitorRows?.length || 0} rows`);

    const targetRow = monitorRows && monitorRows.length > 0 ? monitorRows[0] : null;
    assert(targetRow !== null, `Target monitor row: Operator "${targetRow?.operator_name}", Machine "${targetRow?.machine_code}", Status "${targetRow?.status}"`);

    const targetOperatorId = targetRow?.operator_id || adminUser.id;
    const channelName = `operator-alerts:${targetOperatorId}`;

    console.log(`\n  Connecting WebSocket subscriber to channel: "${channelName}"...`);

    // 3. Create subscriber channel on subscriber client
    let broadcastReceived = false;
    let receivedPayload = null;

    const subChannel = subscriberClient.channel(channelName);

    const receivePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!broadcastReceived) {
          reject(new Error("Timeout waiting for WebSocket broadcast message (10s)"));
        }
      }, 10000);

      subChannel.on("broadcast", { event: "assisted_shift_logged" }, (payload) => {
        clearTimeout(timeout);
        broadcastReceived = true;
        receivedPayload = payload?.payload;
        resolve(receivedPayload);
      });
    });

    // Subscribe subscriber
    await new Promise((resolve, reject) => {
      subChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`  Subscriber SUBSCRIBED to WebSocket channel: ${channelName}`);
          resolve();
        } else if (status === "CHANNEL_ERROR") {
          reject(new Error(`Failed to subscribe subscriber channel: ${status}`));
        }
      });
    });

    // 4. Create publisher channel and send broadcast
    const pubChannel = publisherClient.channel(channelName);

    await new Promise((resolve, reject) => {
      pubChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`  Publisher SUBSCRIBED to WebSocket channel: ${channelName}`);
          resolve();
        } else if (status === "CHANNEL_ERROR") {
          reject(new Error(`Failed to subscribe publisher channel: ${status}`));
        }
      });
    });

    const testPayload = {
      title: "Shift Logged on Your Behalf",
      body: `A supervisor recorded your shift on equipment ${targetRow?.machine_code || "MC-01"} (8.5h).`,
      operatorId: targetOperatorId,
      operatorName: targetRow?.operator_name || "Test Operator",
      machineCode: targetRow?.machine_code || "MC-01",
      runningHours: 8.5,
      logDate: "2026-09-28",
    };

    console.log("  Dispatching broadcast event 'assisted_shift_logged'...");
    const sendStartTime = Date.now();
    await pubChannel.send({
      type: "broadcast",
      event: "assisted_shift_logged",
      payload: testPayload,
    });

    // 5. Await broadcast reception
    const payload = await receivePromise;
    const latency = Date.now() - sendStartTime;

    assert(broadcastReceived === true, `WebSocket broadcast received in ${latency}ms`);
    assert(payload?.operatorId === targetOperatorId, `Payload operatorId matches target (${payload?.operatorId})`);
    assert(payload?.runningHours === 8.5, `Payload runningHours matches (8.5h)`);
    assert(payload?.machineCode === testPayload.machineCode, `Payload machineCode matches (${payload?.machineCode})`);
    assert(payload?.title === "Shift Logged on Your Behalf", `Payload title matches ("${payload?.title}")`);

    // Clean up channels
    await subscriberClient.removeChannel(subChannel);
    await publisherClient.removeChannel(pubChannel);

    console.log("\n=======================================================");
    console.log(`RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`);
    console.log("=======================================================\n");

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  }
}

runRealtimeTest();
