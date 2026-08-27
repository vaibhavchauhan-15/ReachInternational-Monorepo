# Observability Dashboards Architecture (Phase 19)

> **STRUCTURE**: 5 specialized dashboards providing immediate situational awareness across application, database, frontend, business, and security layers.

---

## 1. Dashboard #1: Application & Runtime Health
- **Panels**:
  1. Requests / Throughput Rate (req/sec by route)
  2. Latency Percentiles (p50, p95, p99 across Server Actions)
  3. HTTP Status Distribution (2xx, 3xx, 4xx, 5xx)
  4. Node.js Heap Allocation & Memory Delta
  5. Active Request Concurrency

## 2. Dashboard #2: PostgreSQL Database & Storage
- **Panels**:
  1. PostgreSQL CPU Utilization & Active Worker Threads
  2. Connection Pool Utilization (Active / Idle / Waiting)
  3. Top Slow Queries (> 100ms) with execution frequency
  4. Table & Index Disk Sizes (`machine_hour_logs`, `audit_logs`, `idempotency_keys`)
  5. Transaction Rollback & Deadlock Rate

## 3. Dashboard #3: Real User Monitoring & Frontend Web Vitals
- **Panels**:
  1. Largest Contentful Paint (LCP) distribution by device category (Desktop / Mobile)
  2. Interaction to Next Paint (INP) across form submits and filter clicks
  3. Cumulative Layout Shift (CLS) trends
  4. Client-side JavaScript Uncaught Exceptions & Error Digest IDs
  5. Hydration & Chunk Load Error Rates

## 4. Dashboard #4: Fleet Operations & Business KPIs
- **Panels**:
  1. Hourly Operator Running Log Submissions (vs Expected Daily Baseline)
  2. Active Machine Fleet Utilization & Health Breakdown (Active / Breakdown / Maintenance)
  3. Daily Operations Reports Generated & Export Duration
  4. Idempotency Key De-duplication Hit Count
  5. Machine Hour Meter (HMR) Delta Ingested per Shift

## 5. Dashboard #5: Security & Access Control
- **Panels**:
  1. 401 Unauthorized & 403 Forbidden Access Attempts by Role
  2. Rate Limit (429) Trigger Rate
  3. Self-Role Mutation Rejections (`trg_prevent_self_role_status_mutation`)
  4. Shift Overlap Rejections (`check_machine_hour_log_shift_overlap`)
  5. Administrative Privileged Actions Ingest Rate
