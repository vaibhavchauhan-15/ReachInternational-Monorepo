# Phase 1 Design Specification: Unified Approval & Verification Engine

**Document:** `docs/approvals/01-design.md`  
**Date:** 2026-11-15  
**Target Environment:** Supabase Dev Project `vlmxciuogczumumrwyot` (Reach International Dev)  
**Deliverable:** Complete Architectural Specification, Database DDL, State Machine, Type Catalogue, Permission Matrix, RPC Signatures, and UI Map.

---

## 3.1 State Machine (Enforced at the Database Level)

The approval engine state machine enforces strict, immutable lifecycle transitions directly within PostgreSQL.

```
                  ┌────────────────────────┐
                  │        PENDING         │
                  └───┬───────┬───────┬────┘
                      │       │       │
          ┌───────────┘       │       └───────────┐
          │ (approve)         │ (reject)          │ (cancel / timeout)
          ▼                   ▼                   ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │   APPROVED   │    │   REJECTED   │    │ CANCELLED /  │
   │  (terminal)  │    │  (terminal)  │    │   EXPIRED    │
   └──────────────┘    └──────────────┘    └──────────────┘
```

### Transition Invariants
1. **Pending-Only Mutation:** Only requests currently in the `'pending'` state can transition.
2. **Terminal Immutability:** The states `'approved'`, `'rejected'`, `'cancelled'`, and `'expired'` are **strictly terminal and 100% immutable**. Once reached, a row can never change status again.
3. **Resubmission via Supersedes:** Modifying or resubmitting a rejected or cancelled request does **NOT** mutate the old row. Instead, a **NEW** request row is created with `supersedes_id` pointing to the previous request's `id`. This guarantees an unbroken, tamper-proof historical audit trail.
4. **Cancellation Authority:** A request can only be cancelled by the original requester (`requested_by = auth.uid()`) while still in `'pending'` state.
5. **System Expiry:** The automated expiry cron job transitions pending requests past their `expires_at` timestamp directly to `'expired'`.

---

## 3.2 Database Schema Specification

All tables adhere to ReachInternational monorepo conventions: `UUID` primary keys (`gen_random_uuid()`), `TIMESTAMPTZ` with `DEFAULT now()`, foreign keys to `public.users(id)`, and strict RLS.

```sql
-- 1. Status Enum
CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired'
);

-- 2. Configuration: Approval Types
CREATE TABLE public.approval_types (
  key                 TEXT PRIMARY KEY,              -- 'profile_change', 'registration', 'document_verify', etc.
  label               TEXT NOT NULL,                 -- 'Profile Detail Update'
  category            TEXT NOT NULL DEFAULT 'user',  -- 'user', 'document', 'operations', 'security'
  approver_roles      TEXT[] NOT NULL,               -- ARRAY['super_admin', 'admin', 'hr']
  required_approvals  SMALLINT NOT NULL DEFAULT 1,   -- 1 = single approver; 2 = dual-control
  allow_self_approve  BOOLEAN NOT NULL DEFAULT false,-- Disallows approver approving their own request
  ttl                 INTERVAL,                      -- e.g. '3 days'::interval; NULL = never expires
  cooling_off         INTERVAL,                      -- e.g. '14 days'::interval for account deletion grace period
  priority            SMALLINT NOT NULL DEFAULT 0,   -- Higher = shown first in inbox (e.g. 10 for deletions)
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Core: Polymorphic Approval Requests
CREATE TABLE public.approval_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key            TEXT NOT NULL REFERENCES public.approval_types(key) ON DELETE RESTRICT,
  subject_type        TEXT NOT NULL,                 -- 'user', 'document', 'shift_log'
  subject_id          UUID,                          -- Target domain row ID (NULL for new user registration)
  subject_label       TEXT,                          -- Denormalized name for zero-join list rendering (e.g. 'Rahul Sharma')
  requested_by        UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status              public.approval_status NOT NULL DEFAULT 'pending',
  summary             TEXT NOT NULL,                 -- Short human-readable title (e.g. 'Update phone to +91 9876543210')
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb, -- Validated proposed delta; file paths only, zero blobs
  decision_note       TEXT,                          -- Final approval note or rejection reason
  decided_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  supersedes_id       UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  idempotency_key     TEXT,
  version             INT NOT NULL DEFAULT 1,        -- Optimistic concurrency lock
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Decisions (Multi-approver & Dual-control Support)
CREATE TABLE public.approval_decisions (
  request_id          UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approver_role       TEXT NOT NULL,
  decision            TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, approver_id)              -- Strictly one decision per approver
);

-- 5. Append-Only Event Stream (Immutable Audit Trail)
CREATE TABLE public.approval_events (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id          UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id            UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL = system job
  actor_role          TEXT,
  action              TEXT NOT NULL,                 -- 'submitted', 'decided', 'approved', 'rejected', 'cancelled', 'expired', 'viewed'
  from_status         public.approval_status,
  to_status           public.approval_status,
  note                TEXT,
  meta                JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Transactional Outbox (Post-Commit Side Effects)
CREATE TABLE public.approval_outbox (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic               TEXT NOT NULL,                 -- 'approval.submitted', 'approval.decided', 'file.cleanup', 'deletion.execute'
  request_id          UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  payload             JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ
);
```

### 3.2.1 High-Performance Partial Indexes
```sql
-- 1. Prevent duplicate active requests for the same entity and type
CREATE UNIQUE INDEX approval_one_open_per_subject
  ON public.approval_requests (type_key, subject_type, subject_id)
  WHERE status = 'pending' AND subject_id IS NOT NULL;

-- 2. Idempotent submission index
CREATE UNIQUE INDEX approval_idem
  ON public.approval_requests (requested_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Hot-path: Keyset-paginated Approver Queue
CREATE INDEX approval_queue
  ON public.approval_requests (type_key, created_at DESC, id DESC)
  WHERE status = 'pending';

-- 4. Hot-path: Global Pending Queue (across all types)
CREATE INDEX approval_queue_all_pending
  ON public.approval_requests (created_at DESC, id DESC)
  WHERE status = 'pending';

-- 5. Requester's personal history
CREATE INDEX approval_by_requester
  ON public.approval_requests (requested_by, created_at DESC, id DESC);

-- 6. Target user query (e.g. user detail page looking up active request)
CREATE INDEX approval_by_target_user
  ON public.approval_requests (subject_id, status)
  WHERE status = 'pending';

-- 7. SLA Expiry Scanner
CREATE INDEX approval_expiry
  ON public.approval_requests (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

-- 8. Append-only event history index
CREATE INDEX approval_events_req 
  ON public.approval_events (request_id, id ASC);

-- 9. Outbox pending queue index
CREATE INDEX approval_outbox_pending 
  ON public.approval_outbox (id ASC) 
  WHERE processed_at IS NULL;
```

### 3.2.2 Tamper-Proof Trigger on Append-Only Events
```sql
CREATE OR REPLACE FUNCTION public.trg_block_approval_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'approval_events is an immutable append-only ledger. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_approval_events_immutable
  BEFORE UPDATE OR DELETE ON public.approval_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_approval_events_mutation();
```

---

## 3.3 RPC Specifications (`SECURITY DEFINER`)

All state transitions and domain writes occur strictly inside `SECURITY DEFINER` stored procedures with `SET search_path = public, pg_temp` to guarantee zero search-path hijacking.

### 3.3.1 `approval_submit`
```sql
CREATE OR REPLACE FUNCTION public.approval_submit(
  p_type_key TEXT,
  p_subject_type TEXT,
  p_subject_id UUID,
  p_payload JSONB,
  p_idempotency_key TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_subject_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```
**Responsibilities:**
1. Validates `auth.uid()`.
2. Verifies `approval_types.active = true` for `p_type_key`.
3. If `p_idempotency_key` is provided, checks `approval_requests` for existing row and returns `{ success: true, request_id: id, idempotent: true }`.
4. Enforces the one-open-request-per-subject constraint: if an open pending request already exists for this `(type_key, subject_type, subject_id)`, returns structured error `"A pending request of this type is already awaiting review."`
5. Computes `expires_at = now() + ttl` if `approval_types.ttl` is set.
6. Automatically derives `summary` and `subject_label` if omitted (e.g. looking up target user name).
7. Inserts row into `approval_requests`.
8. Records `'submitted'` in `approval_events`.
9. Enqueues `'approval.submitted'` in `approval_outbox` for approver push notifications.
10. Returns `{ success: true, request_id: id, status: 'pending' }`.

### 3.3.2 `approval_decide`
```sql
CREATE OR REPLACE FUNCTION public.approval_decide(
  p_request_id UUID,
  p_decision TEXT, -- 'approve' | 'reject'
  p_note TEXT DEFAULT NULL,
  p_expected_version INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```
**Atomic Execution In One Postgres Transaction:**
1. **Lock Row:** `SELECT * FROM approval_requests WHERE id = p_request_id FOR UPDATE;`
2. **State & Version Guard:**
   - Asserts `status = 'pending'` (returns `"Request is no longer pending (current: ...)"`).
   - If `p_expected_version` is passed, asserts `version = p_expected_version` (prevents optimistic concurrency race conditions).
3. **Role Check:** Verifies caller's role (`public.current_user_role()`) is in `approval_types.approver_roles`.
4. **Self-Approval Guard:**
   - If `approval_types.allow_self_approve = false`: asserts `auth.uid() != requested_by` and `auth.uid() != subject_id`.
5. **Vote Duplicate Check:** Asserts caller has not already voted on this request.
6. **Insert Decision:** Inserts into `approval_decisions (request_id, approver_id, approver_role, decision, note)`.
7. **Branch on Decision:**
   - **If 'reject':**
     - Sets `status = 'rejected'`, `decided_by = auth.uid()`, `decided_at = now()`, `decision_note = p_note`, `version = version + 1`.
     - Records event in `approval_events ('rejected')`.
     - Enqueues `'approval.decided'` in `approval_outbox` (topic payload includes `decision: 'rejected'`, `note: p_note`).
     - Invokes reject cleanup handler if registered (e.g. cleaning up staging file pointers).
   - **If 'approve':**
     - Counts total approved votes from `approval_decisions`.
     - If `approved_votes >= required_approvals`:
       - **Executes Domain Apply Handler** (dispatched via static whitelist mapping).
       - Sets `status = 'approved'`, `decided_by = auth.uid()`, `decided_at = now()`, `decision_note = p_note`, `version = version + 1`.
       - Records event in `approval_events ('approved')`.
       - Writes immutable audit log into `public.audit_logs`.
       - Enqueues `'approval.decided'` and any domain side-effect topics in `approval_outbox`.
8. Returns `{ success: true, status: new_status, version: new_version }`.

### 3.3.3 `approval_cancel`
```sql
CREATE OR REPLACE FUNCTION public.approval_cancel(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```
- Only callable by original requester (`requested_by = auth.uid()`) while `status = 'pending'`.
- Locks row, updates `status = 'cancelled'`, logs `'cancelled'` in `approval_events`, enqueues outbox cleanup.

### 3.3.4 `approval_expire_due`
```sql
CREATE OR REPLACE FUNCTION public.approval_expire_due()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```
- Scans `approval_requests WHERE status = 'pending' AND expires_at <= now()`.
- Transitions expired rows to `'expired'`, records `'expired'` in `approval_events`, and enqueues outbox notifications. Returns the count of expired items.

### 3.3.5 `approval_list` (Keyset-Paginated Approver Queue)
```sql
CREATE OR REPLACE FUNCTION public.approval_list(
  p_status public.approval_status DEFAULT 'pending',
  p_type_key TEXT DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  type_key TEXT,
  type_label TEXT,
  subject_type TEXT,
  subject_id UUID,
  subject_label TEXT,
  requested_by UUID,
  requester_name TEXT,
  status public.approval_status,
  summary TEXT,
  priority SMALLINT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  version INT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp;
```
- Uses keyset pagination (`(created_at, id) < (p_cursor_created_at, p_cursor_id)`).
- Filtered automatically by the caller's allowed roles (`WHERE current_user_role() = ANY(approver_roles)`).
- Returns **only lean columns** necessary for list presentation. Does **not** deserialize `payload` or join heavy tables.

### 3.3.6 `approval_counts`
```sql
CREATE OR REPLACE FUNCTION public.approval_counts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp;
```
- Computes pending item counts grouped by `type_key` for the caller's authorized roles:
  ```json
  {
    "total": 5,
    "by_type": {
      "profile_change": 2,
      "document_replace": 1,
      "registration": 2
    }
  }
  ```

---

## 3.4 Apply Handlers Whitelist (Postgres Domain Logic)

Handlers are pure PL/pgSQL functions that execute **only inside the approved transaction** of `approval_decide`. They perform minimal domain writes to approved truth tables.

```sql
-- Handler Dispatcher
CREATE OR REPLACE FUNCTION public.approval_dispatch_apply_handler(
  p_request public.approval_requests
)
RETURNS VOID AS $$
BEGIN
  CASE p_request.type_key
    WHEN 'profile_change' THEN
      PERFORM public.approval_apply_profile_change(p_request);
    WHEN 'registration' THEN
      PERFORM public.approval_apply_registration(p_request);
    WHEN 'document_verify' THEN
      PERFORM public.approval_apply_document_verify(p_request);
    WHEN 'document_replace' THEN
      PERFORM public.approval_apply_document_replace(p_request);
    WHEN 'account_deletion' THEN
      PERFORM public.approval_apply_account_deletion(p_request);
    ELSE
      RAISE EXCEPTION 'No apply handler registered for approval type: %', p_request.type_key;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### 3.4.1 Handler Specifications for Each Flow

#### 1. Pilot Flow: `approval_apply_profile_change`
- **Domain Action:** Updates approved columns in `public.users` from `p_request.payload`.
- **Payload Schema:** `{ field: string, new_value: string | number, old_value?: string | number }` or a dict of updated fields.
- **Side Effect:** Inserts `user.profile_change_approved` into `public.audit_logs`.

#### 2. User Registration: `approval_apply_registration`
- **Domain Action:**
  - `UPDATE public.users SET status = 'active', updated_at = now() WHERE id = p_request.subject_id;`
  - `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = p_request.subject_id;`
- **Outbox Side Effect:** Enqueues push notification and welcome email to the newly activated user.

#### 3. User Document Verification: `approval_apply_document_verify`
- **Domain Action:**
  - `UPDATE public.user_documents SET verification_status = 'verified', verified_by = p_request.decided_by, verified_at = now() WHERE id = p_request.subject_id;`
- **Side Effect:** Enqueues push notification to user confirming their document is verified.

#### 4. Document Replacement: `approval_apply_document_replace`
- **Domain Action:**
  - Swaps `storage_path` and `thumb_path` pointers in `public.user_documents` to the promoted canonical paths in `user_files`.
  - Sets `verification_status = 'verified'`.
- **Outbox Side Effect:** Enqueues topic `'file.cleanup'` in `approval_outbox` to purge the old superseded file from `user_files` post-commit.
- **Rejection / Expiry Cleanup:** If rejected or expired, enqueues `'file.cleanup'` to delete the unapproved file from `doc_staging`.

#### 5. Account Deletion: `approval_apply_account_deletion`
- **Domain Action:**
  - Does **NOT** instantly hard-delete.
  - Sets `public.users.status = 'inactive'` immediately (blocking logins).
  - Updates `approval_requests.expires_at = now() + approval_types.cooling_off` (14-day cooling-off window).
- **Outbox Side Effect:** Enqueues `'deletion.execute'` scheduled after cooling-off period. The user can cancel deletion until that deadline.

---

## 3.5 Security, RLS & Sensitive Data Protection

### 3.5.1 Row Level Security (RLS) Policies
```sql
ALTER TABLE public.approval_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_outbox ENABLE ROW LEVEL SECURITY;

-- 1. approval_types: readable by all authenticated users
CREATE POLICY "approval_types_select"
  ON public.approval_types FOR SELECT TO authenticated
  USING (active = true);

-- 2. approval_requests: requesters read own, approvers read by allowed role
CREATE POLICY "approval_requests_select"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (
    requested_by = (SELECT auth.uid()) OR
    subject_id = (SELECT auth.uid()) OR
    (SELECT public.current_user_role()) IN ('super_admin', 'admin') OR
    EXISTS (
      SELECT 1 FROM public.approval_types t
      WHERE t.key = approval_requests.type_key
        AND (SELECT public.current_user_role()) = ANY(t.approver_roles)
    )
  );

-- 3. approval_decisions: visible to requesters and approvers
CREATE POLICY "approval_decisions_select"
  ON public.approval_decisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = approval_decisions.request_id
        AND (
          r.requested_by = (SELECT auth.uid()) OR
          (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
        )
    )
  );

-- 4. approval_events: visible to request viewers
CREATE POLICY "approval_events_select"
  ON public.approval_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = approval_events.request_id
        AND (
          r.requested_by = (SELECT auth.uid()) OR
          (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
        )
    )
  );

-- Revoke direct mutation rights: ALL table writes occur strictly through RPCs
REVOKE INSERT, UPDATE, DELETE ON public.approval_types FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_requests FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_decisions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.approval_outbox FROM authenticated, anon;
```

### 3.5.2 Sensitive Data Protection & Field Reveal Audit
- **Masking in Lists & Summaries:** Sensitive fields in `payload` (Aadhaar numbers `XXXXXXXX6959`, Bank Accounts `••••4321`) are masked at rest or masked in `summary`.
- **Detail View Reveal Event:** When an authorized reviewer opens the detail view and toggles reveal on statutory numbers:
  - Invokes `approval_log_reveal(p_request_id, p_field)`
  - Records an `'viewed'` action in `approval_events` and `public.audit_logs` (`aadhaar.reveal` / `bank_account.reveal`) compliant with DPDP Act 2023.

---

## 3.6 Permission Matrix (Type × Role)

Canonical permission matrix mapping each approval type against the 6 canonical monorepo roles:

| Approval Type (`key`) | Action | `super_admin` | `admin` | `manager` | `supervisor` | `hr` | `operator` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **`profile_change`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | ✓<br>✓<br>✓* | ✓<br>✓<br>— | ✓<br>✓<br>✓* | ✓<br>Own<br>— |
| **`registration`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | —<br>✓<br>✓* | —<br>—<br>— | ✓<br>✓<br>✓* | —<br>—<br>— |
| **`document_verify`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | —<br>—<br>— | —<br>—<br>— | ✓<br>✓<br>✓ | Own<br>Own<br>— |
| **`document_replace`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | —<br>—<br>— | —<br>—<br>— | ✓<br>✓<br>✓ | Own<br>Own<br>— |
| **`account_deletion`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | ✓<br>✓<br>— | ✓<br>Own<br>— | ✓<br>✓<br>— | ✓<br>Own<br>— |
| **`shift_conflict`** | **Submit**<br>**View**<br>**Decide** | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | ✓<br>✓<br>✓ | —<br>—<br>— | ✓<br>Own<br>— |

*\*Note on Hierarchy:* Manager and HR can only decide requests for roles equal to or beneath them (Supervisor, Operator); they cannot approve changes for Admins or Super Admins.

---

## 3.7 UI Map: Universal Inbox & Type-Specific Detail Renderers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        UNIVERSAL APPROVALS INBOX                       │
│    Web Route: /approvals  │  Native Screen: app/(app)/approvals.tsx   │
├────────────────────────────────────────────────────────────────────────┤
│  [ All (5) ]  [ Profile (2) ]  [ Registrations (2) ]  [ Documents (1) ]│
├────────────────────────────────────────────────────────────────────────┤
│  🔍 Search requests...                     [ Sort: Newest ▼ ] [Filter] │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 👤 Rahul Sharma (Operator)                  ⏳ Pending (2h ago)   │  │
│  │    Type: Profile Update                      Expires in 70h      │  │
│  │    Summary: Update phone number and residential address          │  │
│  │    [ View Details ]                             [ Quick Approve] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 📄 Vikram Patel (Operator)                  ⏳ Pending (5h ago)   │  │
│  │    Type: Document Replacement                Expires in 67h      │  │
│  │    Summary: Replacement Driving Licence scan uploaded            │  │
│  │    [ View Details ]                             [ Quick Approve] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │ (Click "View Details")
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    POLYMORPHIC DETAIL RENDERER MODAL                   │
│                                                                        │
│   Dynamic Slot renders the registered renderer for `request.type_key`: │
│                                                                        │
│   • <ProfileChangeDetailRenderer request={req} />                      │
│     Renders Key-Value Diff (Old Value vs New Value in emerald/rose)    │
│                                                                        │
│   • <DocumentReplaceDetailRenderer request={req} />                    │
│     Renders side-by-side current image vs newly uploaded staging image │
│                                                                        │
│   • <RegistrationDetailRenderer request={req} />                       │
│     Renders applicant profile card with statutory documents checklist  │
│                                                                        │
│   • <AccountDeletionDetailRenderer request={req} />                    │
│     Renders deletion justification, cooling-off warning, audit impact  │
│                                                                        │
│   [ Reject (Opens Reason Dialog) ]                 [ Approve Request ] │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.7.1 Web 3-Tier Viewport Adaptations
- **Desktop (≥1024px):** High-density table with sticky header, avatar column, status pill, SLA indicator, and dual action buttons.
- **Tablet (641–1023px):** 2-column bento card grid with expandable metadata drawers.
- **Mobile Web (≤640px):** Single-column stacked cards with minimum 44px touch targets.

### 3.7.2 Native Mobile Adaptations (`apps/mobile`)
- **Touch Target Ergonomics:** Action buttons strictly implement `minHeight: 44` / `hitSlopToMin48`.
- **Modals & Sheets:** Detail views render inside native gesture-driven `@expo/ui` or `@rn-primitives` Bottom Sheets.
- **Tactile Haptics:** Soft confirmation haptics (`Haptics.selectionAsync()`) on decision triggers.
- **Offline Resilience:** Actions offline queue via `OfflineQueueManager` with optimistic local state updates.
