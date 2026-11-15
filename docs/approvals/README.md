# Universal Approval Engine Documentation

> **ReachInternational Monorepo**  
> Unified Operational Queue, Multi-Role Dual-Control Engine, and Auditable Review Architecture  
> Next.js 16.2 App Router (Web) & Expo SDK 58 (Native Mobile)

---

## 1. Architecture Overview

The **Universal Approval Engine** replaces all scattered, ad-hoc verification and approval flows across the monorepo with **ONE single, transactional, auditable state machine**.

```
Domain Tables (users, user_documents, machines, ...)  ← Holds ONLY current approved truth
              ▲
              │ Applied only inside single Postgres transaction
              │
    ┌─────────┴───────────────┐
    │  approval_types         │  ← Config: roles, expiry TTL, cooling-off, dual-control
    │  approval_requests      │  ← Core ledger: 1 row per request across all flows
    │  approval_decisions     │  ← Approver votes: records multi-party / dual control
    │  approval_events        │  ← Append-only audit history (immutable trigger)
    │  approval_outbox        │  ← Post-commit decoupled side effects (push, email, cleanups)
    └─────────────────────────┘
```

### Core Invariants
1. **Pending changes never touch live data**: Proposed changes stay in `approval_requests.payload`. Users continue operating with current domain values until explicit approval.
2. **Single Transactional State Changes**: Every status transition occurs in PostgreSQL `SECURITY DEFINER` RPCs (`approval_submit`, `approval_decide`, `approval_cancel`). Clients never execute raw `UPDATE` on status columns.
3. **Optimistic Version Locking**: Every decision passes `p_expected_version`. If a concurrent approver acts simultaneously, the second actor receives a clean `P0003 Version conflict` preventing race conditions.
4. **Decoupled Post-Commit Side Effects**: Push notifications, WebPush dispatch, file promotions, and external API sync are enqueued into `approval_outbox` within the transaction and processed asynchronously by the Outbox Worker.
5. **Zero Visual & Behavioral Drift**: 100% theme parity using Vercel Geist design tokens (`#171717` ink, `#fafafa` canvas, `#ffffff` canvasElevated, `#ebebeb` hairline border, Reach sky blue `#0284c7`).

---

## 2. How to Add a New Approval Type in 5 Steps

Adding a brand new approval flow requires **zero changes to the core engine tables or RPC state machine**. Follow these five steps:

```
Step 1: DB Config Row  ──►  Step 2: Validation Schema  ──►  Step 3: Postgres Apply Handler
                                                                     │
Step 5: UI Detail Renderers (Web + Mobile)  ◄──  Step 4: Permissions Matrix Entry
```

### Step 1: Insert Config Row in `approval_types`

Create a new migration in `supabase/migrations/` inserting the flow definition:

```sql
INSERT INTO public.approval_types (
  key,
  label,
  approver_roles,
  required_approvals,
  allow_self_approve,
  ttl,
  cooling_off,
  priority,
  active
) VALUES (
  'machine_repair_order',                     -- Unique type_key
  'Machine Repair Authorization',            -- Human-readable label
  ARRAY['super_admin', 'admin', 'manager'],  -- Authorized decider roles
  1,                                          -- 1 = single approver; 2 = dual-control
  false,                                      -- Prevent self-approval
  interval '48 hours',                        -- Expiry TTL
  null,                                       -- Cooling off period (if deletion)
  10,                                         -- Priority weighting (higher = top of queue)
  true                                        -- Active flag
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  approver_roles = EXCLUDED.approver_roles,
  required_approvals = EXCLUDED.required_approvals,
  ttl = EXCLUDED.ttl;
```

---

### Step 2: Define Payload Schema in `@reachinternational/validation`

In `packages/validation/src/approvals.ts`, define and export the Zod schema for the flow's `payload`:

```ts
export const MachineRepairPayloadSchema = z.object({
  machine_id: z.string().uuid("Invalid machine ID"),
  estimated_cost_inr: z.number().positive("Estimated cost must be positive"),
  fault_description: z.string().trim().min(10, "Description must be at least 10 characters"),
  parts_required: z.array(z.string()).default([]),
});

export type MachineRepairPayload = z.infer<typeof MachineRepairPayloadSchema>;
```

Add tests in `packages/validation/src/approvals.test.ts` verifying valid submissions and rejected invalid formats.

---

### Step 3: Implement Database Apply Handler

In PostgreSQL, create the `approval_apply_<key>` function executed inside `approval_decide` when the request transitions to `approved`:

```sql
CREATE OR REPLACE FUNCTION public.approval_apply_machine_repair(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req RECORD;
  v_machine_id UUID;
  v_cost NUMERIC;
BEGIN
  SELECT id, payload, decided_by INTO v_req
  FROM public.approval_requests
  WHERE id = p_request_id;

  v_machine_id := (v_req.payload->>'machine_id')::UUID;
  v_cost := (v_req.payload->>'estimated_cost_inr')::NUMERIC;

  -- 1. Apply mutation to live domain table
  UPDATE public.machines
  SET
    status = 'under_repair',
    updated_at = now()
  WHERE id = v_machine_id;

  -- 2. Emit side effect into outbox
  INSERT INTO public.approval_outbox (topic, request_id, payload)
  VALUES (
    'approval.decided',
    p_request_id,
    jsonb_build_object(
      'type_key', 'machine_repair_order',
      'decision', 'approve',
      'machine_id', v_machine_id,
      'approved_by', v_req.decided_by
    )
  );
END;
$$;
```

Hook the handler into the dispatch router in `approval_decide`:
```sql
ELSIF v_req.type_key = 'machine_repair_order' THEN
  PERFORM public.approval_apply_machine_repair(p_request_id);
```

---

### Step 4: Register Roles in `@reachinternational/permissions`

In `packages/permissions/src/approvals.ts`, add the flow to `APPROVAL_TYPE_ROLES`:

```ts
export const APPROVAL_TYPE_ROLES: Record<string, { submit: UserRole[]; view: UserRole[]; decide: UserRole[] }> = {
  // ... existing flows
  machine_repair_order: {
    submit: ["super_admin", "admin", "manager", "supervisor"],
    view: ["super_admin", "admin", "manager", "supervisor"],
    decide: ["super_admin", "admin", "manager"],
  },
};
```

Run tests to verify the matrix:
```powershell
pnpm --filter @reachinternational/permissions test
```

---

### Step 5: Add UI Detail Renderers (Web & Native Mobile)

#### Web Detail Renderer (`apps/web/app/(app)/approvals/components/ApprovalDetailPanel.tsx`)
Add a case inside the detail renderer for `type_key === 'machine_repair_order'`:

```tsx
{request.type_key === "machine_repair_order" && (
  <div className="space-y-3">
    <div className="text-xs font-semibold text-[var(--color-body)] uppercase tracking-wider">
      Repair Authorization Details
    </div>
    <div className="rounded-lg border border-[var(--color-hairline)] p-3 bg-[var(--color-canvas)] space-y-2">
      <div className="text-sm font-medium">Cost: ₹{payload.estimated_cost_inr?.toLocaleString()}</div>
      <p className="text-xs text-[var(--color-mute)]">{payload.fault_description}</p>
    </div>
  </div>
)}
```

#### Native Mobile Detail Renderer (`apps/mobile/components/approvals/ApprovalDetailBottomSheet.tsx`)
Add matching native renderer using Geist tokens:

```tsx
{request.type_key === "machine_repair_order" && (
  <View style={styles.detailRow}>
    <Text variant="label">Estimated Cost</Text>
    <Text variant="heading" style={{ color: colors.primary }}>
      ₹{Number(payload.estimated_cost_inr).toLocaleString()}
    </Text>
    <Text variant="caption" style={{ color: colors.mute, marginTop: 4 }}>
      {payload.fault_description}
    </Text>
  </View>
)}
```

---

## 3. Rollout & Rollback Protocol

The engine uses a **flow-by-flow incremental migration path** to eliminate deployment risk:

```
[Phase A: Pilot Flow]  ──►  [Phase B: Read-Only Dual Path]  ──►  [Phase C: Cutover & Cleanup]
```

### Rollout Lifecycle per Flow:
1. **Pilot Flow (Document Initial Verification)**:
   - Migration script `184_unified_approval_engine.sql` executed against Dev DB.
   - Run idempotent backfill script: `node supabase/scripts/backfill_document_verification.mjs`.
   - Web `UserDetailClient.tsx` and Mobile `UserDetailView.tsx` delegate review actions to `decideApprovalAction` / `decideApproval`.
   - Run verification test battery: `node scripts/run-all-tests.mjs`.

2. **Rollback Strategy**:
   - Every migration has a dedicated rollback script (e.g. `supabase/migrations/184_rollback_unified_approval_engine.sql`).
   - If an unexpected error occurs during rollout, execute the rollback script to restore previous database functions and schema.
   - The pilot backfill script supports `--revert` to remove migrated records without affecting domain data:
     ```powershell
     node supabase/scripts/backfill_document_verification.mjs --revert
     ```

3. **Subsequent Flows (Sequential Cutover)**:
   - Flow 2: Profile sensitive change requests
   - Flow 3: Account deletion requests
   - Flow 4: User registration approvals
   - Flow 5: Shift log conflicts

4. **Final Deprecation**:
   - Keep legacy tables read-only until the new flow is verified in production.
   - Drop legacy columns and tables in a final migration only after 100% verification.

---

## 4. Production Observability & Monitoring Metrics

The engine provides monitoring across 6 key indicators:

| Metric | Target / SLA | Alert Threshold | Source / Query |
|---|---|---|---|
| **Pending Queue Depth** | < 50 items | > 200 items | `SELECT count(*) FROM approval_requests WHERE status = 'pending'` |
| **Decision Latency (p95)** | < 300 ms | > 1,000 ms | Next.js OpenTelemetry & Server Action timing |
| **SLA / Expiry Breaches** | 0 requests | > 5 expired / day | `SELECT count(*) FROM approval_requests WHERE status = 'expired'` |
| **Concurrency Version Conflicts** | < 0.5% | > 2.0% | Error logs filtering for `P0003` / `isVersionConflict: true` |
| **Outbox Processing Backlog** | < 10 items | > 50 unprocessed | `SELECT count(*) FROM approval_outbox WHERE processed_at IS NULL` |
| **Failed Notifications / Dead Letters** | 0 items | > 0 items (`retry_count >= 5`) | `SELECT count(*) FROM approval_outbox WHERE retry_count >= 5` |

---

## 5. File & Module Directory Reference

```
monorepo/
├── docs/approvals/
│   ├── README.md                              ← YOU ARE HERE (Architecture & Guide)
│   ├── 00-discovery-report.md                 ← Phase 0 monorepo audit report
│   └── 01-design.md                           ← Phase 1 comprehensive design specification
├── packages/
│   ├── types/src/approvals.ts                 ← Universal TypeScript models & enums
│   ├── validation/src/approvals.ts            ← Zod input & payload schemas
│   ├── permissions/src/approvals.ts           ← RBAC matrix & authorization rules
│   └── utils/src/approvals-client.ts          ← Cross-platform RPC & HTTP transport client
├── apps/web/
│   ├── app/(app)/approvals/
│   │   ├── page.tsx                           ← Server Component with pre-fetched queue
│   │   ├── ApprovalsClientShell.tsx           ← 3-tier responsive client shell & shortcuts
│   │   └── components/                        ← Detail panel, badges, rows, modals
│   ├── lib/dal/approvals.ts                   ← Data Access Layer (zero SELECT *)
│   ├── app/actions/approvals.ts               ← Server actions with audit logging
│   └── app/api/approvals/outbox/route.ts      ← Asynchronous QStash / Cron worker
├── apps/mobile/
│   ├── app/(app)/approvals.tsx                ← Native screen with segmented tabs
│   ├── components/approvals/                  ← MobileApprovalCard, BottomSheet, RejectModal
│   ├── lib/hooks/useApprovalsData.ts          ← TanStack Query hooks & optimistic rollback
│   └── test/test-unified-approval-engine.mjs  ← Native mobile automated test suite
├── supabase/
│   ├── migrations/184_unified_approval_engine.sql ← Engine schema, indexes, RPCs & triggers
│   ├── scripts/backfill_document_verification.mjs ← Idempotent, reversible pilot backfill
│   └── tests/benchmark_approval_engine_100k.mjs   ← 100k requests performance & index benchmark
└── tests/approvals/
    └── test-approval-engine-exhaustive.mjs    ← Monorepo-wide Section 6 test runner
```
