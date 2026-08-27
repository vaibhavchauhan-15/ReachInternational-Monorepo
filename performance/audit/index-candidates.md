# Database Index Candidates Register (Phase 6)

> **SCOPE**: Identified index candidates based on query execution plans, WHERE predicates, ORDER BY clauses, and foreign key joins across the core schema (`machines`, `users`, `clients`, `machine_hour_logs`, `machine_assignments`, `idempotency_keys`, `audit_logs`).
> **NOTE**: In accordance with the Phase 6 protocol, these are **candidates for rigorous benchmarking in Phase 7** — no indexes are created blindly.

---

## 1. High-Priority Index Candidates (P0)

---

### Candidate IDX-001: Machine Running Hour Logs by Machine & Date
- **Table**: `public.machine_hour_logs`
- **Target Query**:
  ```sql
  SELECT ... FROM machine_hour_logs
  WHERE machine_id = $1
  ORDER BY log_date DESC, created_at DESC
  LIMIT 50;
  ```
- **Current Plan**: Bitmap Index Scan on `machine_id` + Sort step on `log_date DESC`.
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_date
  ON public.machine_hour_logs (machine_id, log_date DESC, created_at DESC);
  ```
- **Rationale**: Eliminates the Sort node entirely; allows PostgreSQL to perform an Index Scan directly in reverse chronological order for machine-specific history views.

---

### Candidate IDX-002: Operator Hour Logs by Operator & Date
- **Table**: `public.machine_hour_logs`
- **Target Query**:
  ```sql
  SELECT ... FROM machine_hour_logs
  WHERE operator_id = $1
  ORDER BY log_date DESC, created_at DESC
  LIMIT 50;
  ```
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_date
  ON public.machine_hour_logs (operator_id, log_date DESC, created_at DESC);
  ```
- **Rationale**: Direct Index Scan for operator history tab (`/operations?tab=history`), which is queried heavily by mobile field users.

---

### Candidate IDX-003: Active Machine Assignments
- **Table**: `public.machine_assignments`
- **Target Query**:
  ```sql
  SELECT ... FROM machine_assignments
  WHERE operator_id = $1 AND status = 'active'
  LIMIT 1;
  ```
- **Proposed Index (Partial Index)**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machine_assignments_active_operator
  ON public.machine_assignments (operator_id)
  WHERE status = 'active';
  ```
- **Rationale**: Partial index keeps index size small (< 100 KB) by indexing only active assignments rather than all historical records.

---

## 2. Secondary Index Candidates (P1 / P2)

---

### Candidate IDX-004: Audit Logs by Entity & Creation Date
- **Table**: `public.audit_logs`
- **Target Query**:
  ```sql
  SELECT ... FROM audit_logs
  WHERE entity_type = $1 AND entity_id = $2
  ORDER BY created_at DESC
  LIMIT 50;
  ```
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON public.audit_logs (entity_type, entity_id, created_at DESC);
  ```
- **Rationale**: Supports entity-specific audit trail rendering in modals (e.g. machine audit trail, user audit trail) without scanning the entire append-only audit table.

---

### Candidate IDX-005: Idempotency Key Lookup
- **Table**: `public.idempotency_keys`
- **Target Query**:
  ```sql
  SELECT ... FROM idempotency_keys
  WHERE user_id = $1 AND action_name = $2 AND idempotency_key = $3
  LIMIT 1;
  ```
- **Existing Constraint**: `idempotency_keys_user_action_key_unique` exists.
- **Evaluation**: Existing unique composite constraint already provides a primary B-Tree index on `(user_id, action_name, idempotency_key)`. No new index required.

---

### Candidate IDX-006: Machines Status & Health Compound Filter
- **Table**: `public.machines`
- **Target Query**:
  ```sql
  SELECT ... FROM machines
  WHERE status = $1 AND health_status = $2
  ORDER BY machine_id ASC;
  ```
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machines_status_health
  ON public.machines (status, health_status);
  ```
- **Rationale**: Accelerates fleet status tab pills (`all`, `available`, `rented`, `under_maintenance`, `breakdown`).

---

## 3. Index Evaluation Matrix for Phase 7

| Candidate ID | Table | Indexed Columns | Index Type | Partial Predicate | Write Overhead | Expected Benefit |
| :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| **IDX-001** | `machine_hour_logs` | `(machine_id, log_date DESC, created_at DESC)` | B-Tree | None | Minimal (1 write per shift) | High (Eliminates sort node on fleet history) |
| **IDX-002** | `machine_hour_logs` | `(operator_id, log_date DESC, created_at DESC)` | B-Tree | None | Minimal | High (Instant operator personal log loading) |
| **IDX-003** | `machine_assignments` | `(operator_id)` | B-Tree | `WHERE status = 'active'` | Negligible | High (Instant active operator lookup) |
| **IDX-004** | `audit_logs` | `(entity_type, entity_id, created_at DESC)` | B-Tree | None | Low (Append-only) | Medium (Fast audit modal inspection) |
| **IDX-006** | `machines` | `(status, health_status)` | B-Tree | None | Low | Medium (Fleet filter tab responsiveness) |
