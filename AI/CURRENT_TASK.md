# Current Task: Fix Migration 132 Non-Existent Machine Column Error (42703) on Production

Status: COMPLETED (2026-09-29)

## 1. Problem & Root Cause
- When running `132_enforce_shift_logs_immutable_and_optimize_queries.sql` on the Production database (`dhbbgfzbyatzvqafnsqp`), Postgres errored out with:
  `ERROR: 42703: column m.customer_address does not exist`
  `LINE 6: SET location = COALESCE(c.street, m.customer_address, 'Main Site')`
- **Root Cause**:
  1. Early migration 002 previously defined `customer_address` on `public.machines`, but client site location has long since been normalized to `public.clients` (`street`, `city`, `district`, `state`) linked via `client_id` (migration 050/065).
  2. In the production database schema, `public.machines` does not contain the column `customer_address`.
  3. Step 1 of Migration 132 statically referenced `m.customer_address` in `COALESCE(c.street, m.customer_address, 'Main Site')`, failing Postgres query parsing at execution time.

## 2. Solution Implemented
1. **Resilient Address Fallback (`supabase/migrations/132_enforce_shift_logs_immutable_and_optimize_queries.sql`)**:
   - Replaced `m.customer_address` with canonical client address columns (`c.street` and fallback `c.city`) with whitespace trimming and nullification:
     ```sql
     UPDATE public.machine_hour_logs mhl
     SET location = COALESCE(NULLIF(btrim(c.street), ''), NULLIF(btrim(c.city), ''), 'Main Site')
     FROM public.machines m
     LEFT JOIN public.clients c ON c.id = m.client_id
     WHERE mhl.machine_id = m.id
       AND (mhl.location IS NULL OR btrim(mhl.location) = '');
     ```
2. **Defensive Catch-All Backfill**:
   - Added a second-pass fallback for any unassigned or orphaned logs before attaching the immutability trigger:
     ```sql
     UPDATE public.machine_hour_logs
     SET location = 'Main Site'
     WHERE location IS NULL OR btrim(location) = '';
     ```
   - Guarantees 100% of shift logs have a non-null location before `trg_enforce_machine_hour_logs_immutable` locks down updates.

## 3. Files Changed
- `supabase/migrations/132_enforce_shift_logs_immutable_and_optimize_queries.sql`

## 4. Verification
- SQL script validated and executed directly against Development DB (`vlmxciuogczumumrwyot`) via Supabase MCP: 0 errors.
- Web typecheck (`pnpm --filter @reachinternational/web exec tsc --noEmit`): 0 errors.
- Mobile typecheck (`pnpm --filter @reachinternational/mobile exec tsc --noEmit`): 0 errors.
- Production DB (`dhbbgfzbyatzvqafnsqp`) strictly untouched during development.
