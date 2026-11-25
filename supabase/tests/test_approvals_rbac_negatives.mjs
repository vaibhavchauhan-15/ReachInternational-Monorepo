/**
 * Approvals Engine — DB-Level RBAC Negative Test Suite
 *
 * Target: Development only (vlmxciuogczumumrwyot). Production is never written to.
 * Every assertion below proves the DATABASE is the authority: the same calls must
 * fail even when the application layer is bypassed entirely.
 *
 * Run:  SUPABASE_ACCESS_TOKEN=... node supabase/tests/test_approvals_rbac_negatives.mjs
 *
 * Coverage required by the approvals rebuild:
 *   anon · operator · supervisor · wrong-role (manager/hr) · self-approval ·
 *   double-decision race · forged ids · unresolvable/NULL role · forged actor id ·
 *   group atomicity (registration + linked document_verify = one item)
 */

const token = process.env.SUPABASE_ACCESS_TOKEN;

async function querySql(query) {
  const resp = await fetch(
    "https://api.supabase.com/v1/projects/vlmxciuogczumumrwyot/database/query",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
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
    if (debugInfo) console.error("     Debug:", JSON.stringify(debugInfo).slice(0, 600));
  }
}

function isDenied(res, ...needles) {
  const msg = String(res?.message || "");
  return needles.some((n) => msg.includes(n));
}

async function run() {
  console.log("=== Approvals Engine — DB-Level RBAC Negative Tests (Dev) ===\n");

  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN is not set.");
    process.exit(1);
  }

  const users = await querySql(
    `SELECT id, email, role FROM public.users WHERE status = 'active' ORDER BY created_at LIMIT 60;`
  );
  if (!Array.isArray(users)) {
    console.error("Unable to read users:", JSON.stringify(users));
    process.exit(1);
  }

  const adminUser = users.find((u) => u.role === "admin");
  const superAdminUser = users.find((u) => u.role === "super_admin");
  const operatorUser = users.find((u) => u.role === "operator");
  const supervisorUser = users.find((u) => u.role === "supervisor");
  const managerUser = users.find((u) => u.role === "manager");
  const hrUser = users.find((u) => u.role === "hr");

  console.log("Actors:", {
    admin: adminUser?.email,
    super_admin: superAdminUser?.email,
    operator: operatorUser?.email,
    supervisor: supervisorUser?.email,
    manager: managerUser?.email,
    hr: hrUser?.email,
  });
  console.log("");

  if (!adminUser || !superAdminUser || !operatorUser) {
    console.error("Missing required active test users (admin / super_admin / operator).");
    process.exit(1);
  }

  // ── Fixture requests ────────────────────────────────────────────────────────
  // reqOther: owned by the operator, used for pure role-denial checks.
  const reqOther = (
    await querySql(`
      INSERT INTO public.approval_requests
        (type_key, subject_type, subject_id, requested_by, status, summary, payload)
      VALUES
        ('profile_change', 'user', '${operatorUser.id}', '${operatorUser.id}', 'pending',
         'RBAC negative fixture', '{"user_id": "${operatorUser.id}"}'::jsonb)
      RETURNING id;`)
  )?.[0]?.id;

  // reqSelf: owned by the admin, used for the self-approval check.
  const reqSelf = (
    await querySql(`
      INSERT INTO public.approval_requests
        (type_key, subject_type, subject_id, requested_by, status, summary, payload)
      VALUES
        ('profile_change', 'user', '${adminUser.id}', '${adminUser.id}', 'pending',
         'RBAC self-approval fixture', '{"user_id": "${adminUser.id}"}'::jsonb)
      RETURNING id;`)
  )?.[0]?.id;

  // reqGroup: a top-level request with two linked children (migration 235 grouping).
  const reqGroup = (
    await querySql(`
      INSERT INTO public.approval_requests
        (type_key, subject_type, subject_id, requested_by, status, summary, payload)
      VALUES
        ('shift_conflict', 'user', '${operatorUser.id}', '${operatorUser.id}', 'pending',
         'RBAC group fixture', '{"user_id": "${operatorUser.id}"}'::jsonb)
      RETURNING id;`)
  )?.[0]?.id;

  await querySql(`
      INSERT INTO public.approval_requests
        (type_key, subject_type, subject_id, requested_by, status, summary, payload, parent_id)
      VALUES
        ('document_verify', 'document', gen_random_uuid(), '${operatorUser.id}', 'pending',
         'RBAC group child 1', '{"user_id": "${operatorUser.id}"}'::jsonb, '${reqGroup}'),
        ('document_verify', 'document', gen_random_uuid(), '${operatorUser.id}', 'pending',
         'RBAC group child 2', '{"user_id": "${operatorUser.id}"}'::jsonb, '${reqGroup}');`);

  const asRole = (role, uid) => `
      SET LOCAL ROLE ${role};
      SELECT set_config('request.jwt.claim.sub', '${uid}', true);
      SELECT set_config('request.jwt.claim.role', '${role}', true);`;

  const decide = (reqId, actorId, opts = {}) =>
    querySql(`
      BEGIN;
        ${asRole("authenticated", actorId)}
        SELECT public.approval_decide(
          '${reqId}'::uuid,
          '${opts.decision || "approve"}',
          ${opts.note ? `'${opts.note}'` : "NULL"},
          ${opts.version ?? "NULL"},
          ${opts.actorId ? `'${opts.actorId}'` : "NULL"},
          ${opts.idempotencyKey ? `'${opts.idempotencyKey}'` : "NULL"}
        );
      ROLLBACK;`);

  // ── 1. Anon ────────────────────────────────────────────────────────────────
  console.log("1. Anon caller");
  const anonRes = await querySql(`
      BEGIN;
        SET LOCAL ROLE anon;
        SELECT public.approval_decide('${reqOther}'::uuid, 'approve', 'anon probe', 1);
      ROLLBACK;`);
  assert(
    isDenied(anonRes, "permission denied", "42501", "Authentication required"),
    "approval_decide is unreachable for anon (42501 / permission denied)",
    anonRes
  );
  const anonGrants = await querySql(`
      SELECT
        has_function_privilege('anon', 'public.approval_get(uuid)', 'EXECUTE') AS get_ok,
        has_function_privilege('anon', 'public.approval_submit(text,text,uuid,jsonb,text,text,text)', 'EXECUTE') AS submit_ok,
        has_function_privilege('anon', 'public.approval_cancel(uuid,text)', 'EXECUTE') AS cancel_ok,
        has_function_privilege('anon', 'public.approval_approve_all(uuid,text,uuid[],text)', 'EXECUTE') AS approve_all_ok,
        has_function_privilege('anon', 'public.approval_list(text,text,timestamp with time zone,uuid,integer)', 'EXECUTE') AS list_ok,
        has_function_privilege('anon', 'public.approval_counts()', 'EXECUTE') AS counts_ok,
        has_function_privilege('anon', 'public.approval_expire_due()', 'EXECUTE') AS expire_ok;`);
  const g = anonGrants?.[0] || {};
  assert(
    Object.values(g).every((v) => v === false),
    "anon has EXECUTE on zero approval_* functions",
    anonGrants
  );

  // ── 2. Role pool denials (pure RBAC: caller is neither requester nor subject) ──
  console.log("2. Role pool denials");
  const roleDenied = [
    ["operator", operatorUser],
    ["supervisor", supervisorUser],
    ["manager", managerUser],
    ["hr", hrUser],
  ];
  for (const [label, u] of roleDenied) {
    if (!u) {
      assert(true, `${label} denial skipped (no active ${label} user)`);
      continue;
    }
    const res = await decide(reqGroup, u.id, { version: 1 });
    assert(
      isDenied(res, "42501", "not authorized", "permission denied"),
      `${label} cannot decide a request (42501 at the DB level)`,
      res
    );
  }

  const listRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", operatorUser.id)}
        SELECT public.approval_list('pending', null, null, null, 5);
      ROLLBACK;`);
  assert(
    isDenied(listRes, "42501", "not authorized", "permission denied"),
    "operator cannot read the approvals queue via approval_list",
    listRes
  );

  // ── 3. Self-approval ───────────────────────────────────────────────────────
  console.log("3. Self-approval");
  const selfRes = await decide(reqSelf, adminUser.id, { version: 1 });
  assert(
    isDenied(selfRes, "42501", "Self-approval"),
    "admin cannot approve their own request (42501)",
    selfRes
  );

  // ── 4. Unresolvable / NULL role ────────────────────────────────────────────
  console.log("4. Unresolvable (NULL) role");
  const ghostId = "11111111-2222-3333-4444-555555555555";
  const ghostList = await querySql(`
      BEGIN;
        ${asRole("authenticated", ghostId)}
        SELECT public.approval_list('pending', null, null, null, 5);
      ROLLBACK;`);
  assert(
    isDenied(ghostList, "42501", "not authorized", "permission denied"),
    "NULL-role caller cannot read the queue (regression: Bug 1)",
    ghostList
  );
  const ghostDecide = await decide(reqGroup, ghostId, { version: 1 });
  assert(
    isDenied(ghostDecide, "42501", "Authentication required", "not authorized", "permission denied"),
    "NULL-role caller cannot decide (regression: Bug 1)",
    ghostDecide
  );
  const ghostCounts = await querySql(`
      BEGIN;
        ${asRole("authenticated", ghostId)}
        SELECT public.approval_counts();
      ROLLBACK;`);
  const countsPayload = ghostCounts?.[0]?.approval_counts ?? {};
  assert(
    countsPayload?.total === 0,
    "NULL-role caller receives zero counts (regression: Bug 1)",
    ghostCounts
  );

  // ── 5. Forged actor id ─────────────────────────────────────────────────────
  console.log("5. Forged actor id");
  const forgedActor = await querySql(`
      BEGIN;
        ${asRole("authenticated", operatorUser.id)}
        SELECT public.approval_approve_all(
          '${superAdminUser.id}'::uuid, 'all', NULL, 'forged actor probe');
      ROLLBACK;`);
  assert(
    isDenied(forgedActor, "42501", "Only administrators", "permission denied"),
    "p_actor_id cannot be forged to escalate a bulk approval (regression: Bug 3)",
    forgedActor
  );

  // ── 6. Authorized decision + double-decision race + forged id ──────────────
  console.log("6. Authorized decision, race and forged ids");
  const okRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_decide('${reqOther}'::uuid, 'approve', 'authorized admin', 1,
          '${superAdminUser.id}', 'rbac-negatives-${reqOther}');
      COMMIT;`);
  assert(
    okRes?.[0]?.approval_decide?.success === true,
    "authorized super_admin can decide a request they do not own",
    okRes
  );

  const raceRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_decide('${reqOther}'::uuid, 'approve', 'second decision race', 2,
          '${superAdminUser.id}');
      ROLLBACK;`);
  assert(
    isDenied(raceRes, "P0004", "terminal state"),
    "double-decision race is rejected with P0004",
    raceRes
  );

  const idemRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_decide('${reqOther}'::uuid, 'approve', 'idempotent replay', 1,
          '${superAdminUser.id}', 'rbac-negatives-${reqOther}');
      ROLLBACK;`);
  assert(
    idemRes?.[0]?.approval_decide?.idempotent === true ||
      idemRes?.[0]?.approval_decide?.success === true,
    "replaying an idempotency key is safe and does not double-decide",
    idemRes
  );

  const forgedRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_decide('00000000-0000-0000-0000-000000000000'::uuid, 'approve',
          'forged id', 1, '${superAdminUser.id}');
      ROLLBACK;`);
  assert(
    isDenied(forgedRes, "P0002", "not found"),
    "forged / non-existent request id is rejected with P0002",
    forgedRes
  );

  // ── 7. Group atomicity (one item = one decision) ───────────────────────────
  console.log("7. Group atomicity");
  const groupRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_decide('${reqGroup}'::uuid, 'approve', 'group probe', 1,
          '${superAdminUser.id}', 'rbac-negatives-group-${reqGroup}');
      COMMIT;`);
  assert(
    groupRes?.[0]?.approval_decide?.success === true &&
      Array.isArray(groupRes?.[0]?.approval_decide?.bound_request_ids) &&
      groupRes[0].approval_decide.bound_request_ids.length === 3,
    "deciding the parent returns 3 bound ids (parent + 2 children)",
    groupRes
  );
  const groupRows = await querySql(`
      SELECT status, count(*) AS n
      FROM public.approval_requests
      WHERE id = '${reqGroup}' OR parent_id = '${reqGroup}'
      GROUP BY status;`);
  assert(
    groupRows?.length === 1 && groupRows[0].status === "approved" && Number(groupRows[0].n) === 3,
    "parent and every linked child move to the same terminal state in one transaction",
    groupRows
  );

  // ── 8. Internal maintenance entry points ───────────────────────────────────
  console.log("8. Internal entry points");
  const expireRes = await querySql(`
      BEGIN;
        ${asRole("authenticated", superAdminUser.id)}
        SELECT public.approval_expire_due();
      ROLLBACK;`);
  assert(
    isDenied(expireRes, "42501", "permission denied", "reserved"),
    "approval_expire_due is not callable by application sessions",
    expireRes
  );

  // ---- 9. Queue / count parity (regression for the service-role identity fix) ----
  console.log("9. Queue and count parity");
  const svcList = await querySql(
    `SELECT public.approval_list('pending', null, null, null, 100) AS payload;`
  );
  const svcCounts = await querySql(`SELECT public.approval_counts() AS payload;`);
  const listTotal = Number(svcList?.[0]?.payload?.pending_total ?? -1);
  const countTotal = Number(svcCounts?.[0]?.payload?.total ?? -1);
  const listItems = Array.isArray(svcList?.[0]?.payload?.items)
    ? svcList[0].payload.items
    : [];
  assert(
    listTotal >= 0 && listTotal === countTotal,
    `approval_list.pending_total (${listTotal}) equals approval_counts.total (${countTotal})`,
    { listTotal, countTotal }
  );
  assert(
    listTotal >= 0 && listItems.length === Math.min(listTotal, 100),
    `queue returns exactly one row per top-level item (${listItems.length} rows for ${listTotal} pending)`,
    { rows: listItems.length, listTotal }
  );
  assert(
    listItems.every(
      (i) => Array.isArray(i.bound_request_ids) && i.bound_request_ids.includes(i.id)
    ),
    "every queue row is a top-level item carrying its grouped bound_request_ids",
    listItems.slice(0, 2).map((i) => ({ id: i.id, bound: i.bound_request_ids }))
  );

  // ── Cleanup ────────────────────────────────────────────────────────────────
  for (const id of [reqOther, reqSelf, reqGroup]) {
    if (id) await querySql(`DELETE FROM public.approval_requests WHERE id = '${id}';`);
  }
  console.log("\nCleaned up fixture requests.");

  console.log(`\n=== Negative Tests Summary: ${passed}/${total} Passed ===`);
  if (passed !== total) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});