# Alerting Policies & Severity Tiers (Phase 19)

> **PHILOSOPHY**: Actionable alerts only. Zero alert fatigue. Alert on sustained rates rather than isolated instantaneous blips.

---

## 1. Alert Severity Definitions

| Severity | Definition | Response SLA | Notification Channels |
| :--- | :--- | :---: | :--- |
| **🔴 P0 (Critical)** | Core outage, database down, shift submissions failing, data corruption risk | **Immediate (< 15m)** | PagerDuty / SMS / On-Call Engineer |
| **🟠 P1 (High)** | Severe p95 latency degradation, connection pool near exhaustion (> 80%), report queue stuck | **< 1 hour** | Slack `#ops-alerts` / Email |
| **🟡 P2 (Warning)** | Cache degradation (< 70% hit rate), elevated 4xx errors, slow background sync | **< 24 hours** | Daily Operations Digest |

---

## 2. Actionable Alert Matrix

| Alert Name | Condition / Expression | Sustained Window | Severity | Triggered Action |
| :--- | :--- | :---: | :---: | :--- |
| **`High5xxRate`** | `5xx_error_rate > 1%` | > 3 minutes | 🔴 P0 | Check logs, investigate DB, execute rollback if post-release |
| **`ShiftSubmissionFailure`** | `operator_log_failures > 3` | > 2 minutes | 🔴 P0 | Immediate investigation of `submit_operator_hour_log_atomic` |
| **`DatabaseConnectionNearCap`** | `db_active_connections > 80% max` | > 5 minutes | 🟠 P1 | Check slow queries, pg_stat_activity, scale pool |
| **`LatencyDegradationP95`** | `http_request_p95 > 250ms` | > 10 minutes | 🟠 P1 | Identify route bottlenecks, inspect DB lock contention |
| **`ReadinessCheckFailed`** | `GET /api/health?check=ready != 200` | > 1 minute | 🔴 P0 | Alert on-call; verify Supabase cloud status |
| **`CacheHitRatioLow`** | `cache_hit_ratio < 70%` | > 30 minutes | 🟡 P2 | Audit tag invalidation frequency and key churn |
