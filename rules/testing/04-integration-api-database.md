# Integration, API & Database Testing Standards

> **VERIFICATION STANDARDS FOR SERVER ACTIONS, DAL, REST APIS, POSTGRESQL, RPCS, AND RLS POLICIES**  
> *Data integrity and security boundaries are enforced server-side and database-side. Integration tests ensure all layers operate harmoniously without data leakage or broken transactions.*

---

## 1. Purpose

The purpose of ReachInternational's Integration, API & Database Testing standards is to guarantee that **all data mutations, queries, permissions, and database constraints operate correctly end-to-end**. This prevents unauthorized data access (BOLA/IDOR), data corruption, and transaction rollbacks in production.

---

## 2. Applicable Applications & Packages

- `apps/web`: Server Actions (`app/actions/*`), DAL (`lib/dal.ts`), Queries (`lib/queries/*`), API Routes (`app/api/*`)
- `apps/mobile`: Supabase client data access and offline mutation queue synchronization
- `supabase`: PostgreSQL 35 migrations, RLS policies, RPC functions, triggers, and seed data

---

## 3. Testing Targets

### A. Server Action Mutations
Every Server Action mutation in `apps/web/app/actions/` MUST be tested against four verification stages:
1. **Authentication Gate**: Unauthenticated requests are rejected immediately.
2. **Authorization & Role Scoping**: Active role is verified against `@reachinternational/permissions`; supervisory and operator scoping rules are strictly enforced.
3. **Payload Validation**: Input payload is parsed via the authoritative Zod schema in `@reachinternational/validation`. Invalid payloads fail with user-safe error messages.
4. **Cache & Audit Side Effects**: Upon successful mutation, audit logs are written via `logAuditEvent()`, and relevant Next.js cache tags are invalidated via `revalidateTag()`.

### B. REST API Endpoints (`app/api/*`)
All API route handlers must be tested against 5 canonical response scenarios:
```text
• Scenario 1: Valid Request     → HTTP 200 OK + Valid JSON DTO Payload
• Scenario 2: Invalid Payload   → HTTP 400 Bad Request + Zod Validation Error Issues
• Scenario 3: Unauthenticated   → HTTP 401 Unauthorized (Redirect or Error)
• Scenario 4: Unauthorized Role → HTTP 403 Forbidden (Insufficient RBAC permissions)
• Scenario 5: Missing Resource  → HTTP 404 Not Found (Record does not exist)
```

### C. Database Schemas, RPCs & Row Level Security (RLS)
- **RLS Policy Enforcement**: Verify that each of the 6 roles can ONLY access permitted rows:
  * `super_admin` / `admin`: Full administrative access.
  * `manager`: Operational management within assigned branch/client scopes.
  * `supervisor`: Scoped to assigned client sites, machines, and supervised operators.
  * `operator`: Strictly limited to own shift logs, own assigned machine, and personal profile.
  * `hr`: Scoped to employee records, attendance, and payroll; no machine operational tampering.
- **RPC Invariants**: Custom PostgreSQL functions (e.g. shift overlap checkers, salary aggregators) must be tested with edge timestamps, cross-midnight shifts, and null parameters.
- **Constraints & Foreign Keys**: Confirm cascading actions (`ON DELETE CASCADE` or `RESTRICT`), uniqueness constraints (machine serial numbers, GSTIN), and check constraints.

---

## 4. Required Testing Approach & Environment Isolation

### MANDATORY SUPABASE ENVIRONMENT ISOLATION
- **Development Project (TARGET)**: `vlmxciuogczumumrwyot` (`Reach International Dev`)
- **Production Project (PROTECTED)**: `dhbbgfzbyatzvqafnsqp` (`Reach International Production`) — **STRICTLY UNTOUCHED DURING DEVELOPMENT**
- All integration tests, migration validations, and test scripts MUST strictly connect to the Development project.

```text
[ ARRANGE TEST USER SESSION ]
  ├── Obtain Supabase test auth token for specific role (e.g., operator or supervisor)
  └── Set development database connection context (vlmxciuogczumumrwyot)

[ EXECUTE OPERATION / QUERY ]
  ├── Invoke Server Action or execute PostgREST query
  └── Attempt unauthorized cross-tenant or out-of-scope record access (Negative Test)

[ ASSERT BOUNDARY INTEGRITY ]
  ├── Confirm RLS blocks out-of-scope reads (returns 0 rows or 42501 permission error)
  ├── Confirm authorized operations succeed with sanitized user-facing messages
  └── Confirm database transaction committed without orphaned foreign keys
```

---

## 5. Recommended Tools

- **Supabase Node.js Scripts**: Automated integration test runners using `@supabase/supabase-js`
- **PostgreSQL Test Scripts**: SQL-based validation scripts executed via `psql` or Supabase CLI
- **Seed Verification**: `node supabase/verify_seed.mjs`

---

## 6. Actual Project Commands

```bash
# 1. Database seed and foreign key integrity audit
node supabase/verify_seed.mjs

# 2. Supervisor assisted shift entry integration test
node supabase/tests/test_supervisor_assisted_shift_entry.mjs

# 3. Client shifts and overtime logic test
node supabase/tests/test_client_shifts_and_ot.mjs

# 4. Operations security RLS regression suite
node supabase/tests/test_operations_security_rls_regression.mjs

# 5. Continuous 24h logging and attendance integration test
node supabase/tests/test_attendance_and_24h_continuous_logging.mjs

# 6. Web API security & CORS verification
node apps/web/scripts/test-cors-security.mjs
```

---

## 7. Success Criteria

1. **Zero Data Leaks**: PostgREST queries by lower-privileged roles never return unauthorized tenant rows.
2. **Seed Integrity**: `verify_seed.mjs` verifies all tables, foreign keys, and relations without broken links.
3. **Graceful Error Sanitization**: Database error codes (e.g., `23505` duplicate key, `42501` RLS violation) are converted to safe, user-friendly messages via `sanitizeDatabaseError()`.

---

## 8. Failure Handling

- If an RLS policy fails: check whether the policy uses `auth.uid()` or checks user roles via `public.profiles`. Verify that security definer functions do not accidentally leak table access.
- If a foreign key fails during seed verification: ensure migrations run sequentially and migration timestamps match dependency order.

---

## 9. Evidence & Reporting

The test report must provide:
- Database environment targeted (MUST state `vlmxciuogczumumrwyot`).
- RLS policy test outcomes per role tested.
- Seed verification status and foreign key integrity status.
