# Production Capacity & Latency Budgets (Phase 18)

> **SCOPE**: Performance and latency service-level objectives (SLOs) derived from baseline measurements, fleet size projections (150 active machines × 2 shifts/day), and infrastructure capacity.

---

## 1. Latency & Throughput Targets

| Transaction / Workflow | p50 Budget | p95 Budget | p99 Budget | Max Error Rate (5xx) | Required Throughput |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Operator Shift Submission (`submit_operator_hour_log_atomic`)** | **< 25ms** | **< 50ms** | **< 120ms** | **0.00%** | ≥ 100 tx/sec |
| **Operator Context Load (`/operations?tab=entry`)** | **< 35ms** | **< 60ms** | **< 150ms** | **0.00%** | ≥ 150 req/sec |
| **Supervisor Logs Hub (`/operations?tab=logs`)** | **< 45ms** | **< 85ms** | **< 180ms** | **< 0.01%** | ≥ 100 req/sec |
| **Machine Details (`/machines/[id]`)** | **< 30ms** | **< 55ms** | **< 120ms** | **0.00%** | ≥ 120 req/sec |
| **Users Directory (`/users`)** | **< 25ms** | **< 45ms** | **< 90ms** | **0.00%** | ≥ 200 req/sec |
| **Operations Report Generation (10,000 rows)** | **< 250ms** | **< 450ms** | **< 800ms** | **< 0.05%** | ≥ 10 jobs/sec |

---

## 2. Saturation & Resource Ceilings

- **Database CPU Utilization**: Under peak normal concurrency (100 VUs), DB CPU must remain **< 45%**.
- **PostgreSQL Connection Pool**: Active connection pool must not exceed **80% of max pool capacity** (zero connection exhaustion timeouts).
- **Application Node.js Heap Memory**: Heap memory during 4-hour soak tests must remain stable (**< 250 MB**, delta < 5 MB/hour).
- **Concurrency Safety**: 0 lost updates, 0 duplicate shift logs, and 0 meter regressions during simultaneous submissions.
