# Telemetry & Performance Metrics Specification (Phase 19)

> **METHODOLOGIES**: RED (Rate, Errors, Duration) for API/Route services; USE (Utilization, Saturation, Errors) for Infrastructure.

---

## 1. Application-Level RED Metrics

| Metric Identifier | Description | Unit | Dimensions / Labels | Target SLO |
| :--- | :--- | :---: | :--- | :---: |
| `http_requests_total` | Total HTTP / Server Action invocations | Count | `route`, `method`, `statusCode` | N/A |
| `http_request_duration_ms` | Request execution time (p50, p95, p99) | Milliseconds | `route`, `action` | p95 < 60ms |
| `http_errors_total` | Total 4xx and 5xx responses | Count | `route`, `statusCode`, `errorType` | 5xx < 0.01% |
| `operator_submission_duration_ms`| Duration of atomic shift submission RPC | Milliseconds | `action`, `shift` | p95 < 50ms |
| `reports_generation_duration_ms` | Duration of operations report exports | Milliseconds | `format`, `rangeDays` | p95 < 450ms |

---

## 2. Infrastructure-Level USE Metrics

| Resource | Utilization Metric | Saturation Metric | Error Metric |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | `db_cpu_utilization_pct` (< 45%) | `db_active_connections` (< 80% pool) | `db_connection_timeouts_total` (0) |
| **Node.js Serverless Runtime**| `node_memory_heap_used_bytes` | `event_loop_lag_ms` (< 20ms) | `unhandled_rejections_total` (0) |
| **Edge Cache / Next Cache** | `cache_hit_ratio_pct` (> 90%) | `cache_eviction_rate_total` | `cache_read_errors_total` (0) |

---

## 3. Core Web Vitals (Real User Monitoring)

| Web Vital | Definition | Good Threshold | Poor Threshold | Optimization Guard |
| :--- | :--- | :---: | :---: | :--- |
| **LCP** | Largest Contentful Paint | **≤ 1.2s** | > 2.5s | Server-rendered initial HTML, optimized branding SVG |
| **INP** | Interaction to Next Paint | **≤ 100ms** | > 200ms | Lightweight client components, no main-thread blocking |
| **CLS** | Cumulative Layout Shift | **0.00** | > 0.10 | Skeletons matching exact rendered geometry |

---

## 4. Cardinality Controls
- ❌ **Prohibited metric dimensions**: `userId`, `machineId`, `requestId`, `email`, `serialNumber`, raw search strings.
- ✅ **Permitted dimensions**: `route`, `action`, `statusCode`, `level`, `environment`, `release`.
