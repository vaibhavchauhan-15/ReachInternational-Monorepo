# Database / Supabase Agent Rules — `supabase/`

> **Inherits from**: Root `AGENTS.md` (global engineering rules)
>
> These rules EXTEND the global rules. When a module rule conflicts with a global rule, the **STRICTER** rule wins.
>
> **⚠️ THIS MODULE HAS THE STRICTEST RULES IN THE ENTIRE MONOREPO.**
> Database changes are irreversible in production. Every operation must be deliberate and verified.

---

## Environment Isolation & Production Access Policy (CRITICAL)

| Environment | Project ID | Status |
|---|---|---|
| **Development** | `vlmxciuogczumumrwyot` | ✅ Default target for dev work, migrations, testing & mutations |
| **Production** | `dhbbgfzbyatzvqafnsqp` | 👁️ READ-ONLY ANYTIME &nbsp;\|&nbsp; ✍️ WRITES REQUIRE EXPLICIT USER INSTRUCTION |
| **Organization** | `ljzofzlvjtfiqoffaaua` | — |

### ABSOLUTE RULES FOR AI AGENTS:

1. **Read-Only Operations Allowed Anytime on Production (`dhbbgfzbyatzvqafnsqp`)**:
   - AI agents are ALWAYS permitted to execute READ-ONLY operations against the Production database at any time.
   - Permitted anytime: `SELECT` queries, inspecting table schemas, columns, types, defaults, constraints, foreign keys, reviewing RPC functions, inspecting triggers, querying logs, checking table contents, verifying migration history, and diagnosing live issues via Supabase CLI or Supabase MCP (`execute_sql` with `SELECT`, `list_tables`, `query_logs`, `list_migrations`, `get_edge_function`, etc.).
   - No explicit user confirmation is needed for read-only inspection.
2. **Production Writes Require Explicit User Instruction**:
   - AI agents can ONLY execute WRITE / MUTATION operations (e.g., `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`, applying migrations via `apply_migration` or CLI, modifying schemas, deploying edge functions, altering RPCs, triggers, or RLS policies, or seeding/backfilling data) in the Production DB (`dhbbgfzbyatzvqafnsqp`) via Supabase CLI or MCP **WHEN THE USER EXPLICITLY INSTRUCTS TO MAKE CHANGES OR MODIFY SOMETHING IN THE PRODUCTION DB**.
   - In the absence of an explicit prompt/command from the user to modify the production database, write operations to Production are STRICTLY FORBIDDEN.
3. **Development is Default for Writes & Testing**:
   - ALL feature development migrations, schema prototyping, seed scripts, RPC mutation tests, and automated integration suites MUST default to the Development project (`vlmxciuogczumumrwyot`).
4. **Automatic Dev DB Migration Push (WITHOUT ASKING)**:
   - Whenever ANY migration file is created or modified in `supabase/migrations/`, every AI agent MUST automatically push and apply it to the Development database (`vlmxciuogczumumrwyot`) immediately **WITHOUT ASKING THE USER**.
   - The Development database schema, tables, triggers, and RPCs must always reflect the repository's latest migrations.
5. **Pause and Verify `project_id`**:
   - Before executing any Supabase MCP tool call (`execute_sql`, `apply_migration`, `deploy_edge_function`) or CLI command, verify the target `project_id`.
   - Default to `"vlmxciuogczumumrwyot"` for development writes and tests.
   - Target `"dhbbgfzbyatzvqafnsqp"` for read-only inspection anytime, or for write operations ONLY when explicitly instructed by the user.

---

## Directory Structure

```text
supabase/
├── migrations/             # Sequential SQL migration files (154+)
│   ├── 001_create_users_table.sql
│   └── 153_update_rpcs_for_site_id.sql
├── scripts/                # Helper SQL/JS scripts
├── tests/                  # Integration & RLS test suites (28+)
│   └── qa/                 # Quality assurance scripts
├── admin.mjs               # Admin utility
├── exec_migration.mjs      # Migration execution helper
├── seed.mjs                # Base seeding
├── seed_dummy_data.mjs     # Dummy data seeding
├── seed_frontend_workflow.mjs  # Frontend workflow seeding
├── verify_seed.mjs         # Seed verification
└── data/                   # Regional reference data
```

---

## Database-Specific Rules

### 1. Pre-Change Analysis (MANDATORY)

Before ANY database change, inspect:

- [ ] Existing table schema and columns
- [ ] Foreign key relationships
- [ ] Existing indexes
- [ ] CHECK constraints and NOT NULL constraints
- [ ] RLS policies on the affected table(s)
- [ ] Existing triggers on the affected table(s)
- [ ] Related RPC/function definitions
- [ ] Existing migration history (to avoid conflicts or duplicates)
- [ ] Existing views or materialized views
- [ ] `AI/DATABASE.md` for documented schema

### 2. Migration Rules

- **Every** schema change requires a migration file.
- Migration filenames follow the pattern: `NNN_description.sql` (sequential numbering).
- Migrations MUST be:
  - **Idempotent** where possible (use `IF NOT EXISTS`, `IF EXISTS`).
  - **Non-destructive** by default. Destructive operations (`DROP`, `ALTER ... DROP COLUMN`) require explicit user approval.
  - **Sequential** — never reorder or renumber existing migrations.
  - **Atomic** — wrap multi-statement migrations in `BEGIN...COMMIT`.
- **Never** duplicate a migration that already exists.
- **Never** modify an already-applied migration — create a new corrective migration instead.
- Test migrations on the Development project before any production consideration.

### 3. RPC / Function Rules

- PostgreSQL RPCs are the **authoritative layer** for business-critical operations (operator log submission, shift calculations, HMR/breakdown/overtime tracking, payroll computations).
- RPCs MUST:
  - Validate all inputs within the function body.
  - Use explicit parameter types (not `json` / `jsonb` blobs unless justified).
  - Return typed results.
  - Handle edge cases (null inputs, duplicate submissions, boundary values).
  - Use `SECURITY DEFINER` only when necessary, with `SET search_path = public`.
  - Be wrapped in transactions for multi-step operations.
- **Never** create a new RPC without checking if an existing one can be extended.
- **Never** put business logic that belongs in an RPC into a server action instead.

### 4. RLS (Row Level Security) Rules

- RLS MUST be **enabled** on every table that stores user-accessible data.
- **Never** disable RLS to make a feature work.
- RLS policies must be:
  - Scoped to the authenticated user's role and permissions.
  - Tested with the RLS test suite in `supabase/tests/`.
  - Documented in `AI/DATABASE.md`.
- Policy naming convention: `[table]_[operation]_[role/scope]` (e.g., `users_select_own`, `machines_update_admin`).
- When modifying RLS policies, verify that:
  - Super Admin retains full access.
  - Operators can only see/modify their own records.
  - Managers/Supervisors see their assigned scope.
  - No policy accidentally grants broader access than intended.

### 5. Trigger Rules

- Triggers are used for:
  - Audit logging
  - Automatic timestamp updates
  - Derived field computation
  - Cross-table consistency enforcement
- Before modifying a trigger, understand its full impact chain.
- When backfilling data that conflicts with trigger logic, use `DISABLE TRIGGER USER` / `ENABLE TRIGGER USER` within a transaction.
- **Never** remove a trigger without understanding all consumers of its side effects.

### 6. Index Rules

- Add indexes **only** when justified by actual query patterns.
- Prefer partial indexes for commonly filtered subsets.
- Composite indexes should follow the selectivity order (most selective column first).
- **Never** add an index speculatively — measure first.
- Document new indexes in `AI/DATABASE.md`.

### 7. Constraint Rules

- Business-critical invariants MUST be enforced at the database level:
  - Unique constraints for natural keys.
  - CHECK constraints for valid ranges/enums.
  - Foreign keys for referential integrity.
  - NOT NULL where business logic requires a value.
- **Never** remove a constraint to make implementation easier.
- **Never** rely solely on application-level validation for data integrity.

### 8. Seed Data Rules

- Seed scripts target the **Development project only**.
- Use `seed_dummy_data.mjs` for test data.
- Use `verify_seed.mjs` to validate seed integrity.
- Seed data must respect all constraints, triggers, and RLS policies.
- **Never** seed data that would violate business rules.

### 9. Testing Rules

- RLS policies must be tested via scripts in `supabase/tests/`.
- Critical RPCs must have integration tests.
- Test scenarios must cover:
  - Authorized access (each role)
  - Unauthorized access (should be denied)
  - Edge cases (null values, boundary dates, duplicate submissions)
  - Concurrent operations (race conditions)
- Run `pnpm verify:seed` after schema changes.

### 10. Database-Specific Prohibitions

- **NEVER** execute write operations, DDL, migrations, or data mutations against Production without explicit user instruction. (Read-only inspection, log queries, and SELECT queries on Production are permitted anytime).
- **NEVER** disable RLS, even temporarily, without a migration to re-enable it.
- **NEVER** use `TRUNCATE` or `DROP TABLE` without explicit user approval.
- **NEVER** store passwords or secrets in database columns.
- **NEVER** use `SELECT *` in RPCs — always specify columns.
- **NEVER** create a function with `SECURITY DEFINER` without `SET search_path = public`.
- **NEVER** skip the migration file for a schema change ("I'll just run this SQL directly").
- **NEVER** modify an existing migration file that has already been applied.
- **NEVER** add a column as `NOT NULL` without a `DEFAULT` value on existing tables with data.
- **NEVER** reference the service role key in client-accessible code.

### 11. Emergency Stop Conditions (Database-Specific)

Immediately **STOP** and report if:

- An operation would perform unrequested write operations, DDL, or data mutations against Production without explicit user instruction.
- A migration would drop a table or column with existing data.
- An RLS policy change could expose data to unauthorized roles.
- A trigger removal could break data consistency.
- A constraint removal could allow invalid data.
- An RPC change could break existing client behavior.
- A schema change conflicts with an existing migration.
- Production data could be modified or corrupted without explicit user authorization.

### 12. Verification Commands

```bash
# Verify seed data integrity
pnpm verify:seed

# Run RLS tests (from supabase/ directory)
node tests/test_rls_policies.mjs

# Apply migration to dev
node exec_migration.mjs <migration_number>

# Verify migration applied
# Use Supabase MCP: execute_sql with project_id: "vlmxciuogczumumrwyot"
```
