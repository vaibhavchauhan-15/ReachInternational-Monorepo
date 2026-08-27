# Database Index Optimization Matrix & Decisions (Phase 7)

> **SCOPE**: Final evaluation of all candidate indexes against proven query workloads, cardinality metrics, write overhead, and table growth profiles.

---

## 1. Index Candidate Decisions

---

### IDX-001: Machine Running Hour Logs by Machine & Date
- **Table**: `public.machine_hour_logs`
- **Columns**: `(machine_id, log_date DESC, created_at DESC)`
- **Target Query**: `/machines/[id]` running hour history and machine-specific log filters.
- **Existing Coverage**: `idx_machine_hour_logs_machine_date` on `(machine_id, log_date DESC)` already exists in `004_create_machine_hour_logs_table.sql`.
- **Decision**: 🟢 **KEEP (Already Active in Schema)**

---

### IDX-002: Operator Hour Logs by Operator & Date
- **Table**: `public.machine_hour_logs`
- **Columns**: `(operator_id, log_date DESC, created_at DESC)`
- **Target Query**: `/operations?tab=history` operator personal log stream.
- **Existing Coverage**: `idx_machine_hour_logs_operator_date` on `(operator_id, log_date DESC)` already exists in `004_create_machine_hour_logs_table.sql`.
- **Decision**: 🟢 **KEEP (Already Active in Schema)**

---

### IDX-003: Operator Assigned Machine Lookup
- **Table**: `public.machines`
- **Target Query**: `WHERE current_operator_id = $1` (accelerates operator daily log entry `/operations?tab=entry`)
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machines_operator_active
  ON public.machines (current_operator_id)
  WHERE current_operator_id IS NOT NULL;
  ```
- **Benefit**: Partial index covers 100% of operator machine assignments with zero index footprint for unassigned fleet.
- **Decision**: 🟢 **APPROVED & MIGRATED in `020_performance_indexes.sql`**

---

### IDX-004: Machine Fleet Status & Health Compound Filter
- **Table**: `public.machines`
- **Target Query**: `WHERE status = $1 AND health_status = $2`
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machines_status_health
  ON public.machines (status, health_status);
  ```
- **Benefit**: Eliminates multi-index BitmapAnd overhead on fleet dashboard queries.
- **Decision**: 🟢 **APPROVED & MIGRATED in `020_performance_indexes.sql`**

---

### IDX-005: Entity-Specific Audit Trail
- **Table**: `public.audit_logs`
- **Target Query**: `WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON public.audit_logs (entity_type, entity_id, created_at DESC);
  ```
- **Benefit**: Eliminates sequential scan on append-only audit log table when inspecting machine or user history in modals.
- **Decision**: 🟢 **APPROVED & MIGRATED in `020_performance_indexes.sql`**

---

### IDX-006: Supervisor Hour Log History Stream
- **Table**: `public.machine_hour_logs`
- **Target Query**: `WHERE supervisor_id = $1 ORDER BY log_date DESC`
- **Proposed Index**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_supervisor_date
  ON public.machine_hour_logs (supervisor_id, log_date DESC);
  ```
- **Benefit**: Accelerates supervisor operations hub log stream queries ordered chronologically.
- **Decision**: 🟢 **APPROVED & MIGRATED in `020_performance_indexes.sql`**

---

### IDX-007: Redundant Single-Column Boolean Indexes
- **Table**: Various (`is_active`, `is_breakdown`)
- **Evaluation**: Boolean columns have very low cardinality (2 distinct values); a standalone B-Tree index is ignored by PostgreSQL's query planner in favor of sequential scan unless implemented as a partial index.
- **Decision**: 🔴 **REJECTED (Low Cardinality / Redundant)**

---

## 2. Final Index Strategy & Optimization Matrix

| Candidate ID | Target Table | Index Name | Indexed Columns | Index Type | Partial Predicate | Write Overhead | Expected Benefit | Decision |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: | :--- | :---: |
| **IDX-001** | `machine_hour_logs` | `idx_machine_hour_logs_machine_date` | `machine_id, log_date DESC` | B-Tree | None | Low | High (Instant fleet log history) | 🟢 **KEEP** |
| **IDX-002** | `machine_hour_logs` | `idx_machine_hour_logs_operator_date` | `operator_id, log_date DESC` | B-Tree | None | Low | High (Instant operator log history) | 🟢 **KEEP** |
| **IDX-003** | `machines` | `idx_machines_operator_active` | `current_operator_id` | B-Tree | `WHERE current_operator_id IS NOT NULL` | Negligible | High (Instant operator assignment) | 🟢 **APPROVED** |
| **IDX-004** | `machines` | `idx_machines_status_health` | `status, health_status` | B-Tree | None | Low | Medium (Fleet filter tab speed) | 🟢 **APPROVED** |
| **IDX-005** | `audit_logs` | `idx_audit_logs_entity_created` | `entity_type, entity_id, created_at DESC` | B-Tree | None | Low | High (Fast entity audit inspection) | 🟢 **APPROVED** |
| **IDX-006** | `machine_hour_logs` | `idx_machine_hour_logs_supervisor_date` | `supervisor_id, log_date DESC` | B-Tree | None | Low | High (Supervisor log stream speed) | 🟢 **APPROVED** |
| **IDX-007** | Various | Standalone Boolean Indexes | `is_active`, `is_breakdown` | B-Tree | None | Medium | Low (Ignored by planner) | 🔴 **REJECTED** |
