# Cache Invalidation & Mutation Dependency Map (Phase 9)

> **SCOPE**: Comprehensive mapping of every application mutation Server Action to the exact Next.js cache tags it invalidates, preventing global cache clearing and minimizing database re-fetch cascades.

---

## 1. Mutation Invalidation Mapping

```text
┌────────────────────────────────────────────────────────┐
│                   Server Action Mutation               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Targeted Tag Invalidation                │
│                 revalidateTag(tag)                     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            Specific Stale Cache Eviction Only          │
│  (Unrelated directories & dashboards remain cached)   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Server Action Invalidation Matrix

| Mutation Action | File | Primary Database Effect | Invalidation Scope / Tags | Revalidated Paths |
| :--- | :--- | :--- | :--- | :--- |
| **`createMachine`** | `actions/machines.ts` | Inserts row in `machines` | `TAGS.machines`, `TAGS.machinesMeta`, `TAGS.dashboard` | `/machines`, `/operations` |
| **`updateMachine`** | `actions/machines.ts` | Updates row in `machines` | `TAGS.machines`, `TAGS.machineDetail(id)`, `TAGS.dashboard` | `/machines`, `/machines/[id]` |
| **`deleteMachine`** | `actions/machines.ts` | Deletes row in `machines` | `TAGS.machines`, `TAGS.machinesMeta`, `TAGS.dashboard` | `/machines` |
| **`reassignMachineSupervisor`** | `actions/machines.ts` | Updates `current_supervisor_id` | `TAGS.machines`, `TAGS.machineDetail(id)`, `TAGS.assignments` | `/machines`, `/operations` |
| **`submitOperatorHourLogAction`**| `actions/operators.ts`| Inserts row in `machine_hour_logs`, updates machine `hour_meter` | `TAGS.hourLogs`, `TAGS.machineHourLogs(machineId)`, `TAGS.operatorHourLogs(userId)`, `TAGS.machines`, `TAGS.dashboard` | `/operations` |
| **`updateOperatorHourLogAction`**| `actions/operators.ts`| Updates row in `machine_hour_logs` | `TAGS.hourLogs`, `TAGS.machineHourLogs(machineId)`, `TAGS.operatorHourLogs(userId)` | `/operations` |
| **`assignOperatorToMachineAction`**| `actions/operators.ts`| Inserts in `machine_assignments`, updates machine `current_operator_id` | `TAGS.assignments`, `TAGS.operatorAssignment(operatorId)`, `TAGS.machines` | `/operations` |
| **`unassignOperatorFromMachineAction`**| `actions/operators.ts`| Updates `machine_assignments` to inactive, clears machine operator | `TAGS.assignments`, `TAGS.operatorAssignment(operatorId)`, `TAGS.machines` | `/operations` |
| **`createUser`** | `actions/users.ts` | Creates row in `auth.users` & `public.users` | `TAGS.users` | `/users` |
| **`approveUser`** | `actions/users.ts` | Updates status to `active` | `TAGS.users` | `/users` |
| **`rejectUser`** | `actions/users.ts` | Updates status to `inactive` | `TAGS.users` | `/users` |
| **`toggleUserStatus`** | `actions/users.ts` | Toggles status `active` / `inactive` | `TAGS.users` | `/users` |
| **`updateUserRole`** | `actions/users.ts` | Updates user `role` | `TAGS.users` | `/users` |
| **`createClientAction`** | `actions/clients.ts` | Inserts row in `clients` | `TAGS.clients` | `/clients` |
| **`updateClientAction`** | `actions/clients.ts` | Updates row in `clients` | `TAGS.clients`, `TAGS.clientDetail(id)` | `/clients` |
| **`softDeleteClientAction`** | `actions/clients.ts` | Sets `deleted_at = NOW()` | `TAGS.clients`, `TAGS.clientDetail(id)` | `/clients` |
| **`createTask`** | `actions/tasks.ts` | Inserts row in `tasks` & `notifications` | `TAGS.dashboard`, `TAGS.userNotifications(assigneeId)` | `/tasks`, `/my-work` |

---

## 3. Anti-Patterns Eliminated

1. **No Global Revalidation**: Mutations never call global blanket revalidations that evict unrelated caches (e.g. creating a machine does not invalidate `clients` or `users`).
2. **Post-Commit Invalidation**: Cache tags are invalidated **only after** database mutations successfully commit without error. If a database insert fails, the cache remains undisturbed.
