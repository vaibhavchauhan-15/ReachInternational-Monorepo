# Operational Data Growth Projections & Lifecycle Strategy (Phase 11)

> **SCOPE**: Data growth modeling, index overhead forecasting, partitioning evaluation, and archival retention guidelines for high-velocity operational tables across ReachInternational.

---

## 1. Table Growth Forecast Matrix

| Table Name | Entity Type | Daily Record Ingestion | 1-Year Projected Rows | 3-Year Projected Rows | 5-Year Projected Rows | 1-Year Storage (Data + Indexes) | Partitioning Recommendation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`machine_hour_logs`** | Operational Shift Logs | ~300 logs/day (150 machines × 2 shifts) | ~110,000 rows | ~330,000 rows | ~550,000 rows | ~120 MB | **Evaluate Range Partitioning at > 500k rows** |
| **`audit_logs`** | Security & Mutation Trail | ~500 events/day | ~182,500 rows | ~547,500 rows | ~912,500 rows | ~180 MB | **Evaluate Yearly Range Partitioning at > 1M rows** |
| **`machine_assignments`** | Operator Assignments | ~20 events/day | ~7,300 rows | ~21,900 rows | ~36,500 rows | ~8 MB | **No Partitioning Needed (Single Table)** |
| **`notifications`** | User Alerts & Activity | ~200 events/day | ~73,000 rows | ~219,000 rows | ~365,000 rows | ~45 MB | **TTL Purge after 90 days for read notifications** |
| **`idempotency_keys`** | Transaction Locks | ~1,000 keys/day | Auto-purged | Auto-purged | Auto-purged | < 5 MB | **TTL Cleanup Trigger (`expires_at < NOW()`)** |

---

## 2. Table Partitioning Evaluation

### `machine_hour_logs`
- **Current Volume**: < 10,000 rows.
- **Threshold for Partitioning**: When `machine_hour_logs` exceeds **500,000 rows** (~4-5 years of fleet operation at current scale).
- **Partitioning Strategy**: PostgreSQL Declarative Range Partitioning by `log_date` (Quarterly or Monthly partitions):
  ```sql
  -- Example future migration pattern when threshold reached:
  CREATE TABLE public.machine_hour_logs_2026_q1 PARTITION OF public.machine_hour_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
  ```
- **Current Recommendation**: Standard B-Tree composite indexes (`idx_machine_hour_logs_machine_date`, `idx_machine_hour_logs_operator_date`) provide sub-20ms queries up to 500k rows without partitioning overhead.

---

## 3. Data Retention & Archival Policies

1. **Active Shift Logs (`machine_hour_logs`)**:
   - Maintain 3 years of logs in primary online table for instant supervisor reporting and fleet analytics.
   - Archive older logs (> 3 years) to cold storage or read-only analytical tables.
2. **Security Audit Logs (`audit_logs`)**:
   - Append-only compliance records retained for 7 years.
   - Admin query tool strictly enforces mandatory date bounds (`log_date >= $1 AND log_date <= $2`) and pagination (`LIMIT 50`).
3. **Idempotency Locks (`idempotency_keys`)**:
   - TTL of 24 hours. Expired records auto-cleaned via `idx_idempotency_keys_expires_at`.
4. **Notifications (`notifications`)**:
   - Soft purge read notifications older than 90 days (`read_at IS NOT NULL AND created_at < NOW() - INTERVAL '90 days'`).
