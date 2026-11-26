/**
 * In-App Notifications — DB-Level RBAC Negative Test Suite
 *
 * Target: Development only (vlmxciuogczumumrwyot). Production is never written to.
 * Proves that the DATABASE is the authority:
 *   1. Anon caller denied on mutating & list RPCs
 *   2. User A cannot read User B's notifications
 *   3. User A cannot mark User B's notifications as read
 *   4. Forged IDs ignored (marking nonexistent or unowned notification returns 0 updated)
 *   5. Oversized arrays (>100) rejected with 22023
 *   6. Direct UPDATE/DELETE on public.notifications denied to authenticated users
 *   7. Keyset pagination stability under descending order (created_at DESC, id DESC)
 *   8. Unread-count parity with the filtered list
 *
 * Run: node supabase/tests/test_notifications_rbac_negatives.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

function loadEnv() {
  const envPath = path.resolve(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

const env = loadEnv();
const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
const devProjectRef = 'vlmxciuogczumumrwyot';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN not set.');
  process.exit(1);
}

async function querySql(query) {
  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${devProjectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DB Query HTTP ${resp.status}: ${err}`);
  }
  return await resp.json();
}

let passed = 0;
let total = 0;

function assert(condition, message, debugInfo) {
  total++;
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✘ [FAIL] ${message}`);
    if (debugInfo) console.error('     Debug:', JSON.stringify(debugInfo).slice(0, 600));
  }
}

async function run() {
  console.log('=== In-App Notifications — DB-Level RBAC Negative Tests (Dev) ===\n');

  // Grab two test users from DB
  const users = await querySql(`
    SELECT id, email, role, full_name 
    FROM public.users 
    WHERE status = 'active' 
    ORDER BY created_at ASC 
    LIMIT 2;
  `);

  if (!users || users.length < 2) {
    console.error('Need at least 2 active users for negative testing.');
    process.exit(1);
  }

  const userA = users[0];
  const userB = users[1];
  console.log(`User A: ${userA.full_name} (${userA.id})`);
  console.log(`User B: ${userB.full_name} (${userB.id})\n`);

  // 1. Anon caller denied on notification_list
  const anonList = await querySql(`
    SET LOCAL ROLE anon;
    SELECT public.notification_list();
  `).catch((err) => err);
  assert(
    anonList instanceof Error && (anonList.message.includes('42501') || anonList.message.includes('permission denied')),
    '1. Anon caller denied EXECUTE on notification_list with 42501',
    anonList
  );

  // 2. Anon caller denied on notification_unread_count
  const anonCount = await querySql(`
    SET LOCAL ROLE anon;
    SELECT public.notification_unread_count();
  `).catch((err) => err);
  assert(
    anonCount instanceof Error && (anonCount.message.includes('42501') || anonCount.message.includes('permission denied')),
    '2. Anon caller denied EXECUTE on notification_unread_count with 42501',
    anonCount
  );

  // 3. Anon caller denied on notification_mark_read
  const anonMark = await querySql(`
    SET LOCAL ROLE anon;
    SELECT public.notification_mark_read(ARRAY['00000000-0000-0000-0000-000000000000'::uuid]);
  `).catch((err) => err);
  assert(
    anonMark instanceof Error && (anonMark.message.includes('42501') || anonMark.message.includes('permission denied')),
    '3. Anon caller denied EXECUTE on notification_mark_read with 42501',
    anonMark
  );

  // 4. User A cannot read User B's notifications
  // Seed a distinct notification for User B
  const seedB = await querySql(`
    INSERT INTO public.notifications (user_id, title, message, category, priority, deep_link, dedupe_key)
    VALUES (
      '${userB.id}',
      'Private For User B',
      'Confidential details for user B only',
      'assignment',
      'normal',
      '/operations',
      'test_neg:b_only:${Date.now()}'
    )
    RETURNING id;
  `);
  const notifBId = seedB[0].id;

  // Query as User A using Supabase JWT auth simulation (request.jwt.claim.sub = userA.id)
  const listAsUserA = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_list() as res;
  `);
  const itemsUserA = listAsUserA[0]?.res?.items || [];
  const foundUserBNotif = itemsUserA.some((item) => item.id === notifBId);
  assert(
    !foundUserBNotif,
    "4. User A cannot see User B's notification in notification_list()",
    { notifBId, itemsCount: itemsUserA.length }
  );

  // 5. User A cannot mark User B's notification as read (forged / cross-user ownership)
  const markAsUserA = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_mark_read(ARRAY['${notifBId}'::uuid]) as updated_count;
  `);
  const updatedCount = markAsUserA[0]?.updated_count;
  assert(
    updatedCount === 0,
    "5. User A cannot mark User B's notification as read (returns 0 updated)",
    markAsUserA
  );

  // Verify User B's notification is still unread
  const checkB = await querySql(`
    SELECT is_read, read_at FROM public.notifications WHERE id = '${notifBId}';
  `);
  assert(
    checkB[0]?.is_read === false && checkB[0]?.read_at === null,
    "   User B's notification strictly remains unread in database",
    checkB[0]
  );

  // 6. Oversized array rejected (>100 items)
  const largeArray = Array.from({ length: 101 }, () => `'00000000-0000-0000-0000-000000000000'::uuid`).join(',');
  const oversizedMark = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_mark_read(ARRAY[${largeArray}]);
  `).catch((err) => err);
  assert(
    oversizedMark instanceof Error && oversizedMark.message.includes('22023'),
    '6. Oversized array (>100 IDs) rejected with ERRCODE 22023',
    oversizedMark
  );

  // 7. Direct UPDATE on public.notifications denied to authenticated users
  const directUpdate = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    UPDATE public.notifications SET title = 'Hacked Title' WHERE id = '${notifBId}';
  `).catch((err) => err);
  assert(
    directUpdate instanceof Error && (directUpdate.message.includes('42501') || directUpdate.message.includes('permission denied')),
    '7. Direct UPDATE on public.notifications denied to authenticated users (42501)',
    directUpdate
  );

  // 8. Direct DELETE on public.notifications denied to authenticated users
  const directDelete = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    DELETE FROM public.notifications WHERE id = '${notifBId}';
  `).catch((err) => err);
  assert(
    directDelete instanceof Error && (directDelete.message.includes('42501') || directDelete.message.includes('permission denied')),
    '8. Direct DELETE on public.notifications denied to authenticated users (42501)',
    directDelete
  );

  // 9. Keyset pagination stability under multiple rows
  // Seed 5 unread notifications for User A
  const seedIds = [];
  for (let i = 0; i < 5; i++) {
    const s = await querySql(`
      INSERT INTO public.notifications (user_id, title, message, category, priority, deep_link, dedupe_key)
      VALUES (
        '${userA.id}',
        'Keyset Test ${i}',
        'Test message ${i}',
        'shift_reminder',
        'normal',
        '/operations',
        'test_neg:keyset:${userA.id}:${i}:${Date.now()}'
      )
      RETURNING id;
    `);
    seedIds.push(s[0].id);
  }

  // Fetch Page 1 (limit 2)
  const page1 = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_list(NULL, NULL, 2, 'all') as res;
  `);
  const p1Res = page1[0]?.res;
  assert(
    p1Res?.items?.length === 2 && p1Res?.has_more === true && p1Res?.next_cursor?.id !== undefined,
    '9. Keyset pagination Page 1 returns exactly limit items, has_more=true, and valid next_cursor',
    p1Res
  );

  // Fetch Page 2 using next_cursor
  const cursorCreatedAt = p1Res.next_cursor.created_at;
  const cursorId = p1Res.next_cursor.id;
  const page2 = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_list('${cursorCreatedAt}'::timestamptz, '${cursorId}'::uuid, 2, 'all') as res;
  `);
  const p2Res = page2[0]?.res;
  const page1Ids = new Set(p1Res.items.map((i) => i.id));
  const hasPageOverlap = p2Res.items.some((i) => page1Ids.has(i.id));
  assert(
    p2Res?.items?.length > 0 && !hasPageOverlap,
    '10. Keyset pagination Page 2 advances strictly with zero duplicate overlapping rows',
    { page1Ids: Array.from(page1Ids), page2Ids: p2Res?.items?.map((i) => i.id) }
  );

  // 11. Unread-count parity with the list
  const unreadCountRes = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_unread_count() as count;
  `);
  const unreadListRes = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_list(NULL, NULL, 50, 'unread') as res;
  `);
  const countVal = unreadCountRes[0]?.count;
  const listUnreadCount = unreadListRes[0]?.res?.unread_count;
  assert(
    countVal === listUnreadCount && typeof countVal === 'number',
    `11. Unread count (${countVal}) exactly matches notification_list unread_count (${listUnreadCount})`,
    { countVal, listUnreadCount }
  );

  // 12. User A successfully marks their own notification as read
  const markOwn = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_mark_read(ARRAY['${seedIds[0]}'::uuid]) as updated_count;
  `);
  assert(
    markOwn[0]?.updated_count === 1,
    '12. User A successfully marks own notification as read (1 updated)',
    markOwn
  );

  // 13. Idempotent re-marking returns 0
  const markOwnAgain = await querySql(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userA.id}';
    SELECT public.notification_mark_read(ARRAY['${seedIds[0]}'::uuid]) as updated_count;
  `);
  assert(
    markOwnAgain[0]?.updated_count === 0,
    '13. Idempotent re-marking of already-read notification returns 0 updated',
    markOwnAgain
  );

  // Cleanup test rows
  await querySql(`
    DELETE FROM public.notifications WHERE dedupe_key LIKE 'test_neg:%';
  `);

  console.log(`\n================================================================`);
  console.log(`  NOTIFICATIONS RBAC NEGATIVE TESTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
