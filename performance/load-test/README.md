# ReachInternational Load Testing Suite (Phase 18)

## 1. Overview
This directory contains production-grade load testing scenarios, concurrency benchmarks, and capacity modeling for ReachInternational (reachinternation.com).

## 2. Realistic Workload Distribution
| Persona | Share | Real-World Activities | Concurrency Weight |
| :--- | :---: | :--- | :---: |
| **Operator** | 70% | Auth → Current Machine → Live HMR Check → Shift Hour Log Submission (`submit_operator_hour_log_atomic`) | High write frequency (shift transitions) |
| **Supervisor** | 20% | Operations Hub (`/operations?tab=logs`) → Machine Filters → Real-Time Log Auditing | High read frequency (paginated streams) |
| **Admin / Manager** | 8% | Machine Fleet (`/machines`), Users Directory (`/users`), CRM Clients (`/clients`) | Moderate read/write CRUD & search |
| **Reporting / Export** | 2% | Filtered Range Report Generation (`getOperationsReportData`), Excel `.xlsx` compile | High memory / CPU burst |

## 3. Workload Concurrency Steps
- **Smoke Baseline**: 1 Virtual User (VU), 5 min.
- **Low Concurrency**: 10 VUs, 10 min.
- **Normal Operating Concurrency**: 25 VUs, 30 min.
- **Peak Fleet Shift Transition**: 50–100 VUs, 30 min.
- **Stress & Saturation Limit**: 250 VUs, 15 min.
- **Soak Testing**: 50 VUs sustained for 4 hours (Zero memory leak threshold).

## 4. Execution Commands
```bash
# Execute k6 mixed workload scenario (if k6 installed):
k6 run performance/load-test/scenarios/mixed-fleet-workload.js

# Execute native Node.js concurrency harness:
node performance/load-test/scripts/run-load-benchmark.mjs
```
