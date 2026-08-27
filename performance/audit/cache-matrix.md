# Caching Architecture & Data Freshness Matrix (Phase 9)

> **SCOPE**: Rigorous classification of all application data entities, freshness requirements, caching tiers, TTL configurations, and invalidation tag boundaries across ReachInternational.

---

## 1. Caching Tiers & Freshness Hierarchy

ReachInternational enforces a **4-tier caching architecture**:

```text
┌────────────────────────────────────────────────────────┐
│  Tier A: Static & Reference Data (TTL: 1hr – 24hrs)    │
│  - Categories, branches, departments, manufacturers   │
│  - Tag: CACHE_TIERS.CLASS_A_STATIC / CLASS_A_REFERENCE │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier B: Semi-Dynamic Directories (TTL: 1min – 5mins)  │
│  - Machine Fleet Directory, Client CRM Directory,      │
│    User Staff Directory, Dropdown Options              │
│  - Tag: CACHE_TIERS.CLASS_B_FLEET / CLASS_B_DIRECTORY  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier C: Operational Streams (TTL: 15s – 60s)          │
│  - Running Hour Log Streams, Supervisor Metrics,       │
│    Dashboard KPI Summaries                             │
│  - Tag: CACHE_TIERS.CLASS_C_OPERATIONAL                │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier D: Real-Time / Zero-Cache (TTL: 0s / FRESH)      │
│  - Current Assigned Machine, Authoritative HMR Meter,  │
│    RBAC Security Decisions, Audit Logs, Idempotency    │
│  - Tag: CACHE_TIERS.CLASS_D_FRESH (Direct DB Query)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Data Freshness Matrix

| Data Entity | User-Specific? | Update Frequency | Staleness Risk | Cache Tier | Cache TTL | Storage Mechanism | Invalidation Tag |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Machine Fleet Directory** | No | Low (Fleet updates) | Low | Tier B | 60 seconds | `unstable_cache` | `TAGS.machines` |
| **Machine Metadata & Specs** | No | Rare | Low | Tier B | 300 seconds | `unstable_cache` | `TAGS.machineDetail(id)` |
| **Machine Dropdown Options** | No | Low | Low | Tier B | 60 seconds | `unstable_cache` | `TAGS.machines` |
| **Client CRM Directory** | No | Low (New client creation) | Low | Tier B | 120 seconds | `unstable_cache` | `TAGS.clients` |
| **Client Dropdown Options** | No | Low | Low | Tier B | 120 seconds | `unstable_cache` | `TAGS.clients` |
| **User Staff Directory** | Admin/HR | Low (Staff changes) | Medium | Tier B | 15 seconds | `unstable_cache` | `TAGS.users` |
| **User Profile Row** | Yes (User ID) | Infrequent | Medium | Tier B | 60 seconds | React `cache()` + `unstable_cache` | `TAGS.users` |
| **Active Operator Assignment** | Yes (Operator) | Medium (Daily assignments) | **Very High** | **Tier D** | **0 seconds (Fresh)** | Direct Query via DAL | `TAGS.assignments` |
| **Authoritative Machine HMR** | No | High (Daily shift logs) | **Critical** | **Tier D** | **0 seconds (Fresh)** | Direct Query via DAL | `TAGS.machines` |
| **Supervisor Hour Logs Hub** | Role (Supervisor) | High (Shift entries) | Medium | Tier C | 15 seconds | Parallel DAL | `TAGS.hourLogs` |
| **Operator Personal Logs** | Yes (Operator ID) | High | Low | Tier C | 15 seconds | Parallel DAL | `TAGS.operatorHourLogs(id)` |
| **Dashboard KPI Metrics** | Role-Scoped | Medium | Low | Tier B | 60 seconds | `unstable_cache` | `TAGS.dashboardKpis` |
| **Audit Logs Stream** | Admin | High (Append-only) | High | **Tier D** | **0 seconds (Fresh)** | Direct Query via DAL | Non-cached |
| **Idempotency Locks** | Yes (User + Key) | High | **Critical** | **Tier D** | **0 seconds (Fresh)** | Direct Key Lock | Non-cached |

---

## 3. Strict Caching Boundaries & Anti-Patterns Avoided

1. **Zero Caching of Mutations**: Mutation Server Actions (`submitOperatorHourLogAction`, `createMachine`, `createUser`) are NEVER wrapped in caching layers.
2. **Zero Caching of Security Boundaries**: Authorization decisions (`requireRole`, `requirePermission`, RLS policies) evaluate on the live authenticated session, never from a stale cache.
3. **Never Use Stale HMR for Submissions**: The shift submission logic in `submitOperatorHourLogAction` validates the new hour meter against the live database row, preventing regression even if the UI showed a recently cached meter.
4. **Per-Request Deduplication**: `getCurrentUser()` and `verifySession()` use React 19's `cache()` to ensure that within a single Server Component tree render, authentication and user profile queries run exactly **once**.
