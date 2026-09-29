// Test Suite: Mobile Toast / Banner & Offline Resilience Verification
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

async function runMobileToastAndOfflineSuite() {
  console.log("\n=======================================================");
  console.log("TEST 1: Live Mobile Listener & PostNotification Toast Delivery");
  console.log("=======================================================");

  // Find active operator and machine
  const { data: operatorUser } = await adminClient
    .from("users")
    .select("id, full_name, role")
    .eq("role", "operator")
    .limit(1)
    .single();

  const { data: supervisorUser } = await adminClient
    .from("users")
    .select("id, full_name, role")
    .in("role", ["supervisor", "super_admin", "admin"])
    .limit(1)
    .single();

  const { data: machineAsset } = await adminClient
    .from("machines")
    .select("id, machine_id, hour_meter")
    .limit(1)
    .single();

  assert(operatorUser && operatorUser.id, `Found operator: ${operatorUser?.full_name} (${operatorUser?.id})`);
  assert(supervisorUser && supervisorUser.id, `Found supervisor: ${supervisorUser?.full_name} (${supervisorUser?.id})`);
  assert(machineAsset && machineAsset.id, `Found machine: ${machineAsset?.machine_id} (${machineAsset?.id})`);

  const operatorId = operatorUser.id;
  const channelName = `operator-alerts:${operatorId}`;

  // 1. Mobile App Realtime Listener Simulation (active app)
  let receivedBroadcast = null;
  const alertChannel = subscriberClient.channel(channelName);

  await new Promise((resolve) => {
    alertChannel
      .on("broadcast", { event: "assisted_shift_logged" }, (eventPayload) => {
        receivedBroadcast = eventPayload?.payload;
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          resolve();
        }
      });
  });

  const pubChannel = publisherClient.channel(channelName);
  await new Promise((resolve) => {
    pubChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });

  const broadcastPayload = {
    title: "Shift Logged on Your Behalf",
    body: `A supervisor recorded your shift on equipment ${machineAsset.machine_id} (8.5h).`,
    operatorId,
    machineCode: machineAsset.machine_id,
    runningHours: 8.5,
    logDate: "2026-09-28",
  };

  const startMs = Date.now();
  await pubChannel.send({
    type: "broadcast",
    event: "assisted_shift_logged",
    payload: broadcastPayload,
  });

  // Wait for reception
  for (let i = 0; i < 40; i++) {
    if (receivedBroadcast) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const latency = Date.now() - startMs;

  assert(receivedBroadcast !== null, `Mobile broadcast received in ${latency}ms`);
  assert(receivedBroadcast?.operatorId === operatorId, "Received payload operatorId matches");
  assert(receivedBroadcast?.machineCode === machineAsset.machine_id, "Received payload machineCode matches");
  assert(receivedBroadcast?.runningHours === 8.5, "Received payload runningHours matches");

  // Clean up Realtime channels
  await subscriberClient.removeChannel(alertChannel);
  await publisherClient.removeChannel(pubChannel);

  console.log("\n=======================================================");
  console.log("TEST 2: Offline Resilience — Database Notification Trigger");
  console.log("=======================================================");

  // Verify that an assisted shift insert automatically generates a row in public.notifications
  const testIdempotency = `test_offline_${Date.now()}`;
  const currentMeter = Number(machineAsset.hour_meter || 500);
  const startMtr = currentMeter + 10;
  const endMtr = currentMeter + 18.5;

  const startDatetime = new Date("2026-09-27T06:00:00+05:30").toISOString();
  const endDatetime = new Date("2026-09-27T14:00:00+05:30").toISOString();

  const { data: insertedLog, error: logInsertErr } = await adminClient
    .from("machine_hour_logs")
    .insert({
      machine_id: machineAsset.id,
      operator_id: operatorId,
      entered_by: supervisorUser.id,
      entry_source: "supervisor",
      start_meter: startMtr,
      end_meter: endMtr,
      log_date: "2026-09-27",
      end_date: "2026-09-27",
      start_time: "06:00:00",
      end_time: "14:00:00",
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      idempotency_key: testIdempotency,
      shift: "Shift 1",
    })
    .select()
    .single();

  if (logInsertErr) {
    console.error("  [DEBUG] Log Insert Error:", logInsertErr);
  }
  assert(!logInsertErr && insertedLog?.id, `Assisted shift log created (Log ID: ${insertedLog?.id})`);

  // Check that trigger trg_after_insert_assisted_shift created notification in public.notifications
  const { data: notifRows, error: notifErr } = await adminClient
    .from("notifications")
    .select("*")
    .eq("user_id", operatorId)
    .eq("is_read", false)
    .order("created_at", { ascending: false });

  assert(!notifErr, "Query to public.notifications succeeded");
  assert(notifRows && notifRows.length > 0, `Persistent notifications found: ${notifRows?.length}`);

  const targetNotif = notifRows?.find((n) => n.metadata?.logId === insertedLog?.id);
  assert(targetNotif !== undefined, "Persistent notification row found for assisted log");
  assert(targetNotif?.title === "Shift Logged on Your Behalf", `Notification title: "${targetNotif?.title}"`);
  assert(targetNotif?.category === "log_entry", `Notification category: "${targetNotif?.category}"`);
  assert(targetNotif?.is_read === false, "Notification is_read flag is initially false (offline unread)");
  assert(targetNotif?.metadata?.machineCode === machineAsset.machine_id, `Notification metadata machineCode: ${targetNotif?.metadata?.machineCode}`);

  console.log("\n=======================================================");
  console.log("TEST 3: Reconnection Sync & Dismissal Workflow");
  console.log("=======================================================");

  // Simulate operator device reconnecting: calling get_unread_notifications RPC
  const { data: unreadRPC, error: rpcErr } = await adminClient.rpc("get_unread_notifications", {
    p_user_id: operatorId,
  });

  assert(!rpcErr, "RPC get_unread_notifications executed successfully");
  const foundInRpc = unreadRPC?.some((r) => r.id === targetNotif.id);
  assert(foundInRpc, "Offline notification returned in get_unread_notifications RPC");

  // Simulate mobile app marking as read
  const { error: markReadErr } = await adminClient.rpc("mark_notifications_read", {
    p_notification_ids: [targetNotif.id],
  });
  assert(!markReadErr, "RPC mark_notifications_read executed successfully");

  // Verify it is now read
  const { data: updatedNotif } = await adminClient
    .from("notifications")
    .select("is_read, read_at")
    .eq("id", targetNotif.id)
    .single();

  assert(updatedNotif?.is_read === true, "Notification is_read updated to true in database");
  assert(updatedNotif?.read_at !== null, "Notification read_at timestamp populated upon sync");

  // Verify subsequent check has 0 unread for this notification
  const { data: secondUnreadCheck } = await adminClient.rpc("get_unread_notifications", {
    p_user_id: operatorId,
  });
  const presentInSecondCheck = secondUnreadCheck?.some((r) => r.id === targetNotif.id);
  assert(!presentInSecondCheck, "Read notification purged from subsequent unread queries (no duplicate toasts)");

  console.log("\n=======================================================");
  console.log("CLEANUP: Removing test records");
  console.log("=======================================================");

  // Cleanup test log and notification
  await adminClient.from("notifications").delete().eq("id", targetNotif.id);
  await adminClient.from("machine_hour_logs").delete().eq("id", insertedLog.id);
  console.log("  🧹 Test log and notification records cleaned up.");

  console.log("\n=======================================================");
  console.log(`RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runMobileToastAndOfflineSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
