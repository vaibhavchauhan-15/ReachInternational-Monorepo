# Current Task

## Task: Client Sites Normalization (S00 Default Site Architecture, Deduplication, Single DAL & Fast Backend)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-02
**Target Modules**: `supabase/migrations`, `packages/types`, `packages/validation`, `packages/utils`, `apps/web`, `apps/mobile`

### Root Cause Verified & Resolved
1. **Running Logs Duplicate Locations**:
   - `OperationsLogsTab.tsx` fell back to reading unnormalized string entries from `machine_hour_logs.location` when `dbSites` was empty or loading.
   - Operators had entered 5 slight variants of the same location (`"CPM |PO : CP Mills"`, `"CPM |PO : CP Mills, Fort Songadh, Tapi, Gujrat, 3..."`, `"Fort Songadh"`, etc.).
   - Resolved by filtering exclusively by relational `site_id` (UUID), eradicating raw location string fallback in UI, and sourcing options from `getActiveClientSites`.
2. **Client Dropdown Label Pollution**:
   - `ClientSelect.tsx` was appending raw location strings (`• CPM |PO : CP Mills, Fort Songadh, T...`) below the client code and name.
   - Resolved by removing address string concatenation from trigger labels and displaying clean `CLI-0002 · JK Paper Ltd.`.
3. **Missing S00 Default Site on Registration**:
   - Client creation form previously inserted only into `public.clients` and never created a default site in `public.client_sites`.
   - Resolved by adding trigger `trg_client_create_default_site` and Server Action provisioning to immediately create `S00` default site upon client creation.
4. **Scattered Database Queries & Lack of Unified Caching**:
   - Web and mobile previously fetched sites through disparate queries and ad-hoc GraphQL-like queries.
   - Resolved with a single DAL module (`client-sites.ts`), single round-trip RPC `get_client_with_sites`, lean dropdown RPC `get_client_sites_dropdown`, and unified query key `['client-sites', clientId]` (staleTime: 5 mins).
5. **Database Migration Immutability Trigger Guard (Fix for Error 23514)**:
   - Migration 182 updated `site_code` from existing values (e.g. `CLI-0047-S01` to `CLI-0047-S00`) during renumbering.
   - Trigger `trg_enforce_site_code_immutable` on `public.client_sites` and `trg_enforce_machine_hour_logs_immutable` on `public.machine_hour_logs` intercepted the update and raised exception `23514`.
   - Resolved by temporarily dropping both immutability triggers during migration renumbering and two-step unique code assignment, then recreating both triggers cleanly at the end of the transaction.

### Verification Results
- `packages/utils`: 7/7 unit tests passing (`node --test --experimental-strip-types packages/utils/src/address.test.ts`)
- `apps/mobile`: 357/357 verification scenarios passing (`node apps/mobile/run-tests.mjs`)
- `typography`: 0 raw typography property violations (`node scripts/check-typography.mjs`)
- `typecheck`: 7/7 packages passed with 0 errors (`pnpm turbo run typecheck`)
- `monorepo test runner`: 10/10 test suites passed (`node scripts/run-all-tests.mjs`)
