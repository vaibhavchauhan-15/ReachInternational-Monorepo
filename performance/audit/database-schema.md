# Database Schema & Migration Audit (Phase 1)

> **SCOPE**: Audit of all 19 PostgreSQL migrations in `supabase/migrations/` and active schema on Supabase PostgreSQL 17 (`dhbbgfzbyatzvqafnsqp`).

---

## 1. The Six Core Operational Tables

ReachInternational consolidates all active core fleet and user management into 6 central PostgreSQL tables:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  public.users   │◄──────┤ public.machines │◄──────┤machine_hour_logs│
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         ▼                         │
         │                ┌─────────────────┐                │
         └───────────────►│ public.clients  │◄───────────────┘
                          └─────────────────┘
                                   ▲
                          ┌────────┴────────┐
                          │idempotency_keys │
                          │   audit_logs    │
                          └─────────────────┘
```

---

## 2. Table-by-Table Schema Specification

### 2.1 `public.users` (System User Directory & Profiles)
- **Primary Key**: `id` (UUID, references `auth.users.id ON DELETE CASCADE`)
- **Columns**: `id`, `full_name`, `phone`, `role`, `status`, `city`, `district`, `state`, `email`, `created_at`, `updated_at`
- **Constraints**:
  - `users_email_not_empty`: `btrim(email) <> ''`
  - `users_city_not_empty`: `btrim(city) <> ''`
  - `users_district_not_empty`: `btrim(district) <> ''`
  - `users_state_not_empty`: `btrim(state) <> ''`
  - `users_status_check`: `status IN ('active', 'inactive', 'pending', 'rejected')`
  - `users_role_check`: `role IN ('super_admin', 'admin', 'service_manager', 'supervisor', 'operator', 'mechanic', 'service_engineer', 'hr_manager', 'inventory_manager', 'finance_manager', 'sales_manager', 'client')`
- **Triggers**:
  - `handle_new_user()` (on `auth.users` insert): Automatically provisions `public.users` with default role `operator` and status `pending`.
  - `prevent_self_role_status_mutation()` (Migration 019): Blocks authenticated users from altering their own `role`, `status`, or `email`.
- **RLS Policies**:
  - `users_select_authorized`: All authenticated users can read active profiles.
  - `users_admin_manage`: Admins and Super Admins can update any user row.

### 2.2 `public.machines` (Fleet Registry)
- **Primary Key**: `id` (UUID DEFAULT gen_random_uuid())
- **Columns**: `id`, `machine_id` (e.g. `RI-MC-0001`), `serial_number`, `machine_name`, `model`, `manufacturer`, `year_of_mfg`, `hour_meter`, `status`, `health_status`, `current_operator_id` (FK to `users`), `current_supervisor_id` (FK to `users`), `notes`, `created_at`, `updated_at`
- **Constraints**:
  - `machines_machine_id_key`: UNIQUE (`machine_id`)
  - `chk_machines_hour_meter_positive`: `hour_meter >= 0`
  - `machines_status_check`: `status IN ('available', 'rented', 'maintenance', 'breakdown', 'retired')`
- **RLS Policies**:
  - Read: Authenticated users can view machines.
  - Write: Management and assigned supervisors can update machine details.

### 2.3 `public.machine_hour_logs` (Daily Meter & Running Hours Logs)
- **Primary Key**: `id` (UUID DEFAULT gen_random_uuid())
- **Columns**: `id`, `machine_id` (FK to `machines`), `operator_id` (FK to `users`), `supervisor_id` (FK to `users`), `client_id` (FK to `clients`), `log_date`, `shift_start_time`, `shift_end_time`, `start_meter`, `end_meter`, `operating_hours`, `breakdown_hours`, `breakdown_reason`, `site_location`, `remarks`, `idempotency_key`, `created_at`, `updated_at`
- **Constraints**:
  - `chk_machine_hour_logs_meter_range`: `end_meter >= start_meter`
  - `chk_machine_hour_logs_start_meter_positive`: `start_meter >= 0`
  - `chk_machine_hour_logs_end_meter_positive`: `end_meter >= 0`
  - `machine_hour_logs_idempotency_key_key`: UNIQUE (`idempotency_key`)
- **Indexes**:
  - `idx_machine_hour_logs_machine_date`: `(machine_id, log_date DESC)`
  - `idx_machine_hour_logs_operator_date`: `(operator_id, log_date DESC)`
  - `idx_machine_hour_logs_meters`: `(machine_id, start_meter, end_meter)`
- **RLS Policies**:
  - Insert: Operators can insert their own daily logs (`operator_id = auth.uid()`).
  - Read: Operators read their own logs; Supervisors/Admins read all fleet logs.

### 2.4 `public.clients` (Client Organization Directory)
- **Primary Key**: `id` (UUID DEFAULT gen_random_uuid())
- **Columns**: `id`, `code` (e.g. `CLI-0001`), `client_name`, `address`, `city`, `district`, `state`, `contact_person`, `contact_phone`, `contact_email`, `status`, `deleted_at`, `created_at`, `updated_at`
- **Constraints**:
  - `clients_code_key`: UNIQUE (`code`)
  - `clients_address_not_empty`, `clients_city_not_empty`, `clients_state_not_empty`
- **RLS Policies**:
  - Management roles can create, read, and update client records.

### 2.5 `public.idempotency_keys` (Replay Protection Engine)
- **Primary Key**: `idempotency_key` (TEXT)
- **Columns**: `idempotency_key`, `user_id` (FK to `users`), `action_name`, `request_hash`, `response_payload`, `status` (`processing`, `completed`, `failed`), `created_at`, `expires_at`
- **Indexes**: `idx_idempotency_keys_hash`, `idx_idempotency_keys_user_action`, `idx_idempotency_keys_expires_at`
- **RLS Policies**:
  - Strict user-isolation: Users can only query/lock keys matching `auth.uid()`.

### 2.6 `public.audit_logs` (Append-Only Security Audit Trail)
- **Primary Key**: `id` (UUID DEFAULT gen_random_uuid())
- **Columns**: `id`, `user_id` (FK to `users`), `action`, `entity_type`, `entity_id`, `metadata` (JSONB), `created_at`
- **Indexes**: `idx_audit_logs_user_id`, `idx_audit_logs_action`, `idx_audit_logs_entity`, `idx_audit_logs_created_at DESC`
- **Security Invariant**: Strictly append-only. `UPDATE` and `DELETE` RLS policies are completely omitted.

---

## 3. Schema Redundancy & Migration Findings

1. **Redundant Indexes on `public.users.email` (🟡 P2)**:
   - `users_email_key`
   - `idx_users_email_unique`
   - `idx_users_email`
   - `users_email_unique_idx`
   - *Impact*: 4 separate B-tree indexes maintain the email column, creating write amplification on user profile updates.
2. **Redundant Indexes on `public.clients.code` (🟡 P2)**:
   - `clients_code_key` and `idx_clients_code`.
