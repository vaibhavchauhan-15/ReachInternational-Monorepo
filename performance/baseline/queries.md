# Query Performance Statistics Baseline — Phase 0

> **Extension**: `pg_stat_statements` on Supabase PostgreSQL 17  
> **Recorded Date**: 2026-08-27

---

## 1. Top Executed & Most Expensive Queries

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 15;
```

### Profile Summary

| Rank | Query Summary / Purpose | Calls | Total Time (ms) | Mean Time (ms) | Rows Processed |
|---:|---|---:|---:|---:|---:|
| 1 | Extension metadata introspection (`pg_available_extensions`) | 258 | 136,140.1 ms | 527.67 ms | 20,124 |
| 2 | Timezone directory scan (`pg_timezone_names`) | 108 | 95,082.4 ms | 880.39 ms | 129,168 |
| 3 | Schema procedure introspection (`pg_proc` CTEs) | 199 | 63,791.7 ms | 320.56 ms | 22,701 |
| 4 | Table metadata & columns introspection (`pg_attribute` + `pg_class`) | 121 | 21,072.7 ms | 174.15 ms | 121 |
| 5 | Table base info & constraints introspection | 373 | 14,368.6 ms | 38.52 ms | 373 |
| 6 | Table and column schema privileges aggregation | 198 | 13,709.8 ms | 69.24 ms | 14,004 |
| 7 | Relation ACL privilege inspection (`aclexplode`) | 122 | 8,981.9 ms | 73.62 ms | 3,719 |
| 8 | Domain base type recursive resolution | 109 | 6,207.9 ms | 56.95 ms | 1,186 |
| 9 | WAL backup lsn check (`pg_backup_start`) | 26 | 5,974.7 ms | 229.79 ms | 26 |
| 10 | Primary key & foreign key relationship resolution | 109 | 5,633.9 ms | 51.68 ms | 6,452 |
| 11 | Foreign key constraints query (`pg_constraint`) | 238 | 2,702.5 ms | 11.35 ms | 18,501 |

---

## 2. Key Findings & Query Target Priorities

1. **System Catalog Overhead vs Application Queries**:
   - The majority of long-running catalog execution times stem from Supabase Studio UI / introspection polling.
   - Application queries on operational tables (`machines`, `machine_hour_logs`, `users`, `clients`) execute quickly under initial dataset sizes (< 10ms) due to existing primary key and btree indexes.
2. **Targets for Application Query Optimization (Phase 5 & Phase 7)**:
   - Eliminate wildcard `SELECT *` across all DAL query methods (`lib/queries/*`).
   - Guarantee that all joins (`public.machines` to `public.users` on `current_supervisor_id` and `current_operator_id`) utilize foreign key indexes.
   - Ensure range queries filtering by `log_date DESC` on `machine_hour_logs` utilize composite indexes (`idx_machine_hour_logs_machine_date` and `idx_machine_hour_logs_operator_date`).
