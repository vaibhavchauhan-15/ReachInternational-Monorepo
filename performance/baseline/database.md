# Database Performance Baseline — Phase 0

> **Database Host**: Supabase PostgreSQL 17.6 (`db.dhbbgfzbyatzvqafnsqp.supabase.co`)  
> **Region**: `ap-south-1` (Mumbai, India)  
> **Total DB Size**: `14 MB`  
> **Recorded Date**: 2026-08-27

---

## 1. Table Statistics & Live Row Counts (Step 0.7)

### Live Tuples Estimate (`pg_stat_user_tables`)

```sql
SELECT
  schemaname,
  relname,
  n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

| Schema | Table Name | Live Tuples (`n_live_tup`) | Exact Count (`COUNT(*)`) |
|---|---|---:|---:|
| `public` | `users` | 27 | 27 |
| `public` | `machine_hour_logs` | 25 | 25 |
| `public` | `idempotency_keys` | 2 | 2 |
| `public` | `machines` | 1 | 1 |
| `public` | `clients` | 1 | 1 |
| `public` | `audit_logs` | 0 | 0 |

---

## 2. Existing PostgreSQL Indexes Catalog (Step 0.8)

Queried from `pg_indexes` where `schemaname = 'public'`:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Table: `public.users` (8 Indexes)

1. `users_pkey`: `CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)`
2. `users_email_key`: `CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)`
3. `idx_users_email`: `CREATE INDEX idx_users_email ON public.users USING btree (email)`
4. `idx_users_email_unique`: `CREATE UNIQUE INDEX idx_users_email_unique ON public.users USING btree (email)`
5. `users_email_unique_idx`: `CREATE UNIQUE INDEX users_email_unique_idx ON public.users USING btree (lower(btrim(email)))`
6. `users_phone_unique_idx`: `CREATE UNIQUE INDEX users_phone_unique_idx ON public.users USING btree (btrim(phone)) WHERE ((phone IS NOT NULL) AND (btrim(phone) <> ''::text))`
7. `idx_users_role`: `CREATE INDEX idx_users_role ON public.users USING btree (role)`
8. `idx_users_status`: `CREATE INDEX idx_users_status ON public.users USING btree (status)`
9. `idx_users_role_status`: `CREATE INDEX idx_users_role_status ON public.users USING btree (role, status)`
10. `idx_users_address`: `CREATE INDEX idx_users_address ON public.users USING btree (state, district, city)`

### Table: `public.machines` (7 Indexes)

1. `machines_pkey`: `CREATE UNIQUE INDEX machines_pkey ON public.machines USING btree (id)`
2. `machines_machine_id_key`: `CREATE UNIQUE INDEX machines_machine_id_key ON public.machines USING btree (machine_id)`
3. `idx_machines_machine_id`: `CREATE INDEX idx_machines_machine_id ON public.machines USING btree (machine_id)`
4. `idx_machines_serial_number`: `CREATE INDEX idx_machines_serial_number ON public.machines USING btree (serial_number)`
5. `idx_machines_manufacturer`: `CREATE INDEX idx_machines_manufacturer ON public.machines USING btree (manufacturer)`
6. `idx_machines_status`: `CREATE INDEX idx_machines_status ON public.machines USING btree (status)`
7. `idx_machines_health_status`: `CREATE INDEX idx_machines_health_status ON public.machines USING btree (health_status)`
8. `idx_machines_current_operator`: `CREATE INDEX idx_machines_current_operator ON public.machines USING btree (current_operator_id)`
9. `idx_machines_current_supervisor`: `CREATE INDEX idx_machines_current_supervisor ON public.machines USING btree (current_supervisor_id)`

### Table: `public.machine_hour_logs` (8 Indexes)

1. `machine_hour_logs_pkey`: `CREATE UNIQUE INDEX machine_hour_logs_pkey ON public.machine_hour_logs USING btree (id)`
2. `machine_hour_logs_idempotency_key_key`: `CREATE UNIQUE INDEX machine_hour_logs_idempotency_key_key ON public.machine_hour_logs USING btree (idempotency_key)`
3. `idx_machine_hour_logs_machine_id`: `CREATE INDEX idx_machine_hour_logs_machine_id ON public.machine_hour_logs USING btree (machine_id)`
4. `idx_machine_hour_logs_machine_date`: `CREATE INDEX idx_machine_hour_logs_machine_date ON public.machine_hour_logs USING btree (machine_id, log_date DESC)`
5. `idx_machine_hour_logs_operator_id`: `CREATE INDEX idx_machine_hour_logs_operator_id ON public.machine_hour_logs USING btree (operator_id)`
6. `idx_machine_hour_logs_operator_date`: `CREATE INDEX idx_machine_hour_logs_operator_date ON public.machine_hour_logs USING btree (operator_id, log_date DESC)`
7. `idx_machine_hour_logs_supervisor_id`: `CREATE INDEX idx_machine_hour_logs_supervisor_id ON public.machine_hour_logs USING btree (supervisor_id)`
8. `idx_machine_hour_logs_client_id`: `CREATE INDEX idx_machine_hour_logs_client_id ON public.machine_hour_logs USING btree (client_id)`
9. `idx_machine_hour_logs_meters`: `CREATE INDEX idx_machine_hour_logs_meters ON public.machine_hour_logs USING btree (machine_id, start_meter, end_meter)`

### Table: `public.clients` (6 Indexes)

1. `clients_pkey`: `CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id)`
2. `clients_code_key`: `CREATE UNIQUE INDEX clients_code_key ON public.clients USING btree (code)`
3. `idx_clients_code`: `CREATE INDEX idx_clients_code ON public.clients USING btree (code)`
4. `idx_clients_client_name`: `CREATE INDEX idx_clients_client_name ON public.clients USING btree (client_name)`
5. `idx_clients_status`: `CREATE INDEX idx_clients_status ON public.clients USING btree (status)`
6. `idx_clients_deleted_at`: `CREATE INDEX idx_clients_deleted_at ON public.clients USING btree (deleted_at)`

### Table: `public.idempotency_keys` (4 Indexes)

1. `idempotency_keys_pkey`: `CREATE UNIQUE INDEX idempotency_keys_pkey ON public.idempotency_keys USING btree (idempotency_key)`
2. `idx_idempotency_keys_hash`: `CREATE INDEX idx_idempotency_keys_hash ON public.idempotency_keys USING btree (request_hash)`
3. `idx_idempotency_keys_user_action`: `CREATE INDEX idx_idempotency_keys_user_action ON public.idempotency_keys USING btree (user_id, action_name)`
4. `idx_idempotency_keys_expires_at`: `CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys USING btree (expires_at)`

### Table: `public.audit_logs` (5 Indexes)

1. `audit_logs_pkey`: `CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)`
2. `idx_audit_logs_user_id`: `CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id)`
3. `idx_audit_logs_action`: `CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action)`
4. `idx_audit_logs_entity`: `CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id)`
5. `idx_audit_logs_created_at`: `CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC)`

---

## 3. PostgreSQL Database Timeouts & Safeguards (Step 0.13)

```sql
SELECT 
  current_setting('statement_timeout') AS statement_timeout,
  current_setting('lock_timeout') AS lock_timeout,
  current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout;
```

| Setting | Recorded Value | Purpose |
|---|---|---|
| `statement_timeout` | `10s` (10,000 ms) | Prevents runaway, unbounded queries from consuming DB connections |
| `lock_timeout` | `5s` (5,000 ms) | Prevents deadlocks during high-concurrency DDL or row lock acquisitions |
| `idle_in_transaction_session_timeout` | `10s` (10,000 ms) | Automatically terminates dangling or stalled client transactions |

---

## 4. Index Redundancy Notes for Phase 7

- On `public.users`: Notice multiple duplicate email indexes (`users_email_key`, `idx_users_email`, `idx_users_email_unique`, `users_email_unique_idx`). In Phase 7 (Indexing Strategy), these can be consolidated to save write overhead and index maintenance CPU.
- On `public.machines`: Notice both `machines_machine_id_key` and `idx_machines_machine_id` indexing `machine_id`.
