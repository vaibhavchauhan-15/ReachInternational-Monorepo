# AI State

## Monorepo Health & Status
- **Current Task**: Normalize Client Sites (S00 Default Site Architecture, Deduplication, Single DAL & Fast Backend)
- **Status**: 🟢 Clean / Verified & Production Ready
- **Last Verified**: 2026-11-02
- **Turborepo Typecheck**: 7/7 packages passed with 0 errors (`pnpm turbo run typecheck`)
- **Monorepo Test Suite**: 10/10 suites passed cleanly (`node scripts/run-all-tests.mjs`)
- **Mobile Verification Suite**: 357/357 assertions passed cleanly (`node apps/mobile/run-tests.mjs`)
- **Typography Linter**: 0 raw typography violations (`node scripts/check-typography.mjs`)
- **Deliverables Completed**:
  - `supabase/migrations/182_normalize_client_sites_s00.sql`: Added `site_no`, `code`, `legacy_code`, `address_full`, `deleted_at`, `is_default`; temporarily drops `trg_enforce_site_code_immutable` and `trg_assign_site_code` during renumbering and updates `site_code` through a safe two-pass temporary assignment (`TMP-` prefix) to prevent `23514: site_code is immutable once assigned` and unique index collisions; temporarily drops `trg_enforce_machine_hour_logs_immutable` during `machine_hour_logs.site_id` backfill; updates `assign_site_code()` trigger for S00, S01, S02 sequences; deploys `create_default_client_site()` trigger on `public.clients` for automatic S00 site provisioning; deploys `get_client_with_sites` and `get_client_sites_dropdown` RPCs.
  - `packages/types`: Added `ClientSite`, `ClientSiteDropdownItem`, `ClientWithSitesResponse`.
  - `packages/validation`: Added `ClientSiteDropdownItemSchema`, updated `SiteSchema`.
  - `packages/utils`: Added `formatSiteDropdownLabel` (`S00 · Fort Songadh`), `formatSiteDropdownDescription`, `formatClientDropdownLabel` (`CLI-0002 · JK Paper Ltd.`); 7/7 unit tests passing.
  - `apps/web/lib/data/clients/client-sites.ts`: Single authoritative DAL module for `client_sites` with React `cache()` and tag-based invalidation (`TAGS.clientSites(clientId)`).
  - `apps/web/lib/data/clients/client-mutations.ts`: Auto-provisions `S00` default site upon client creation.
  - `apps/web/lib/data/operations/operations-client-logs.ts`: Filters strictly by `site_id` (UUID), eradicating raw location string fallback and duplicate dropdown options.
  - `apps/web/components/ui/ClientSelect.tsx`: Cleans client dropdown labels to show only client code and company name.
  - `apps/web/components/operations/logs/OperationsLogsTab.tsx`: Standardized location select to `S00 · Site Name` with `address_full` secondary text.
  - `apps/web/components/clients/SitesList.tsx`: Displays `S00 · CLI-XXXX-S00` with `Default` badge.
  - `apps/mobile`: Synchronized `useOperationsData.ts`, `RunningLogFilterPanel.tsx`, `MachineModal.tsx`, `useClientDetailData.ts`, and `ClientDetailView.tsx` with unified `['client-sites', clientId]` query key (staleTime: 5 mins).
