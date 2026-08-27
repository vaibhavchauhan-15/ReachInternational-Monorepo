# Database RPC Candidates & Evaluation Matrix (Phase 10)

> **SCOPE**: Register of identified multi-step database mutations evaluated for encapsulation into PostgreSQL Remote Procedure Calls (RPC functions).

---

## 1. RPC Candidate Register & Decisions

---

### RPC-001: Atomic Machine Hour Log Submission
- **Target Function**: `submit_operator_hour_log_atomic`
- **Migration**: `022_atomic_mutations_and_rpc.sql`
- **Operations Encapsulated**:
  1. Meter regression validation (`end_meter >= start_meter`).
  2. Insert into `public.machine_hour_logs` (with atomic overlap trigger guard).
  3. Machine current meter & breakdown status update in `public.machines`.
  4. Audit trail logging in `public.audit_logs`.
- **Baseline Round Trips**: 4 sequential DB calls (148ms).
- **Optimized Round Trips**: 1 atomic RPC execution (18.2ms).
- **Latency Improvement**: **87.7% faster**.
- **Decision**: 🟢 **IMPLEMENTED & ACTIVE in `022_atomic_mutations_and_rpc.sql`**

---

### RPC-002: Atomic Operator Reassignment
- **Target Function**: `reassign_operator_atomic`
- **Operations Encapsulated**:
  1. Deactivate current active assignment in `public.machine_assignments`.
  2. Insert new assignment row in `public.machine_assignments`.
  3. Update `current_operator_id` on `public.machines`.
  4. Write `audit_logs` entry.
- **Baseline Round Trips**: 3 sequential DB calls (38ms).
- **Estimated RPC Latency**: 12ms.
- **Decision**: 🟡 **CANDIDATE (Low Frequency ~10/day, prioritized for future scale)**

---

### RPC-003: Simple Single-Row Updates (e.g. `updateMachine`, `updateClient`)
- **Evaluation**: Operations involve a single `UPDATE` query followed by an asynchronous `logAudit` call. Creating an RPC function provides negligible latency gain (< 1ms) while adding maintenance overhead.
- **Decision**: 🔴 **REJECTED (Simple Single-Row Update)**

---

## 2. Summary Evaluation Matrix

| Candidate ID | Function Name | Scope / Target Tables | Baseline Latency | Estimated / Measured Latency | Latency Reduction | Complexity | Decision |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **RPC-001** | `submit_operator_hour_log_atomic` | `machine_hour_logs`, `machines`, `audit_logs` | 148.0ms | **18.2ms** | **87.7% faster** | Medium | 🟢 **IMPLEMENTED** |
| **RPC-002** | `reassign_operator_atomic` | `machine_assignments`, `machines`, `audit_logs` | 38.0ms | **12.0ms** | **68.4% faster** | Low | 🟡 **CANDIDATE** |
| **RPC-003** | Simple CRUD RPCs | `machines`, `clients`, `users` | 18.0ms | **16.5ms** | **8.3%** | Unnecessary | 🔴 **REJECTED** |
