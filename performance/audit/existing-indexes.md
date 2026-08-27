# Existing Database Indexes Inventory (Phase 7)

> **SCOPE**: Comprehensive inventory of all active indexes across public tables in the ReachInternational Supabase schema.

---

## 1. Index Inventory by Core Table

### `public.users`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `users_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `users_email_unique_idx` | `lower(btrim(email))` | B-Tree | Yes | Case-insensitive unique email authentication |
| `users_phone_unique_idx` | `btrim(phone)` | B-Tree | Yes | Unique phone number identification |
| `idx_users_role` | `role` | B-Tree | No | Role-based operational user filtering (`operators`, `supervisors`) |
| `idx_users_status` | `status` | B-Tree | No | Pending registration & active user filtering |
| `idx_users_address` | `state, district, city` | B-Tree | No | Location-based staff filtering |

---

### `public.machines`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `machines_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `machines_machine_id_key` | `machine_id` | B-Tree | Yes | Unique business identifier lookup |
| `idx_machines_status` | `status` | B-Tree | No | Fleet inventory status filtering (`available`, `rented`, `under_maintenance`) |
| `idx_machines_health_status` | `health_status` | B-Tree | No | Machine condition health filtering (`active`, `breakdown`) |
| `idx_machines_current_supervisor` | `current_supervisor_id` | B-Tree | No | Machine fleet assignment to supervisors |
| `idx_machines_current_operator` | `current_operator_id` | B-Tree | No | Machine assignment lookup for daily operator entry |

---

### `public.machine_hour_logs`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `machine_hour_logs_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `idx_machine_hour_logs_machine_id` | `machine_id` | B-Tree | No | Machine log lookup |
| `idx_machine_hour_logs_operator_id` | `operator_id` | B-Tree | No | Operator log lookup |
| `idx_machine_hour_logs_supervisor_id` | `supervisor_id` | B-Tree | No | Supervisor log lookup |
| `idx_machine_hour_logs_client_id` | `client_id` | B-Tree | No | Client billing & hour reconciliation |
| `idx_machine_hour_logs_machine_date` | `machine_id, log_date DESC` | B-Tree | No | Chronological machine hour meter history |
| `idx_machine_hour_logs_operator_date` | `operator_id, log_date DESC` | B-Tree | No | Chronological operator personal shift history |
| `idx_machine_hour_logs_meters` | `machine_id, start_meter, end_meter` | B-Tree | No | Hour meter regression and range verification |

---

### `public.clients`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `clients_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `idx_clients_code` | `code` | B-Tree | No | Client code lookup |
| `idx_clients_client_name` | `client_name` | B-Tree | No | Client name ordering |
| `idx_clients_status` | `status` | B-Tree | No | Active client filter |
| `idx_clients_deleted_at` | `deleted_at` | B-Tree | No | Soft-delete filter (`deleted_at IS NULL`) |

---

### `public.idempotency_keys`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `idempotency_keys_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `idempotency_keys_user_action_key_unique` | `user_id, action_name, idempotency_key` | B-Tree | Yes | Replay attack and duplicate submission prevention |
| `idx_idempotency_keys_expires_at` | `expires_at` | B-Tree | No | TTL expiration cleanup |
| `idx_idempotency_keys_hash` | `request_hash` | B-Tree | No | Exact payload collision verification |

---

### `public.audit_logs`
| Index Name | Indexed Column(s) | Type | Unique | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `audit_logs_pkey` | `id` | B-Tree | Yes | Primary Key lookup |
| `idx_audit_logs_user_id` | `user_id` | B-Tree | No | Actor audit history |
| `idx_audit_logs_action` | `action` | B-Tree | No | Security action filtering |
| `idx_audit_logs_created_at` | `created_at DESC` | B-Tree | No | Chronological audit stream |
| `idx_audit_logs_entity` | `entity_type, entity_id` | B-Tree | No | Entity-specific audit log trail |

---

## 2. Redundancy & Overlap Analysis

1. **`users (email)`**: Both `idx_users_email` and `users_email_unique_idx` existed in early drafts. `users_email_unique_idx` on `lower(btrim(email))` is the authoritative functional index.
2. **`idempotency_keys`**: The composite unique constraint `(user_id, action_name, idempotency_key)` fully covers all key lookup queries.
3. **`machine_hour_logs`**: Composite indexes `(machine_id, log_date DESC)` and `(operator_id, log_date DESC)` cover single-column `machine_id` and `operator_id` lookups via leftmost prefixing.
