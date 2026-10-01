# Current Task: Direct Operating Site Creation for Existing Clients (Web & Mobile)

Status: COMPLETED (2026-10-01)

## 1. Problem & User Requirement
- **Problem**:
  Previously, when adding a new operating location/site for an existing client, users either had to create a duplicate client with the same company name or navigate deep into `/clients/[id]` -> Sites Tab to add a new site.
- **Requirement**:
  1. Add an "Add Site" button directly on the client directory page (`/clients`) with a client selector dropdown to register a site for an existing client without navigating into the detail page first.
  2. Provide contextual "Add Site" shortcuts directly in the table row action menu (`ClientRowActionsMenu.tsx`) and mobile cards (`MobileClientCard.tsx`) so coordinators can add a site for a specific client with 1 click.
  3. Ensure full web-to-mobile synchronization (`apps/mobile/app/(app)/clients.tsx` and mobile components).

## 2. Delivered Solution
- **Unified Site Modal (`apps/web/components/clients/SiteModal.tsx`)**:
  - Enhanced to support both standalone client selection via `<ClientSelect>` (searchable dropdown) and contextual pre-selected client lock.
  - When opened contextually (e.g. from row action `⋮` -> "Add Site" or client detail page), renders a clean "Target Client Account" banner with building icon, client name, and client code.
  - When opened globally (e.g. from page header "Add Site"), renders the searchable `<ClientSelect>` picker allowing selection of any registered client account.
  - Hardened `handleOpenAddSiteModal` with defensive `typeof targetClientId === "string"` check and arrow function caller in `ClientsHeader.tsx` to prevent SyntheticEvent objects from bleeding into modal state.
- **Client Directory Header (`apps/web/components/clients/ClientsHeader.tsx`)**:
  - Added "Add Site" secondary action button with `<AnimatedMapPin size={15} className="text-emerald-600" />` alongside "Add Client".
- **Client Directory Coordinator (`apps/web/components/clients/ClientsCoordinatorClient.tsx`)**:
  - Wired `isAddSiteModalOpen`, `selectedSiteClientId`, and `handleOpenAddSiteModal`.
  - Passed `onAddSiteClient` to `ClientsTable` and `MobileClientCard` for 1-click contextual site creation.
  - Code-split `SiteModal` dynamic import with 0ms overhead on initial page load.
- **Contextual Actions Parity**:
  - `ClientRowActionsMenu.tsx`: Added "Add Site" menu item with `<AnimatedMapPin size={14} className="text-emerald-500" />`.
  - `MobileClientCard.tsx`: Added "Add Site" touch button with `<MapPin size={13} className="text-emerald-600" />`.
- **Cross-Platform Mobile Synchronization (`apps/mobile/app/(app)/clients.tsx` & `MobileClientCard.tsx`)**:
  - Added native `Add Client Site Modal` on mobile with site name, street, city, district, state, and 6-digit pincode inputs.
  - Added "+ Add Site" button to the registered Sites tab inside client detail modal.
  - Added "Add Site" action to mobile client cards.
- **Server Actions, DAL & Migrations**:
  - Added `getClientOptionsAction` in `apps/web/app/actions/clients.ts` and re-exported `getClientOptions` in `lib/data/clients/index.ts`.
  - Concurrent `getClientOptions()` query in `apps/web/app/(app)/clients/page.tsx` via `Promise.all` with class B cached directory tag.
  - `supabase/migrations/153_update_rpcs_for_site_id.sql`: Documented RPC updates (`get_clients_directory_summary` sites_count and `submit_operator_hour_log_atomic` site_id).

## 3. Verification & Compliance
- Web TypeScript check: 0 errors (`pnpm --filter @reachinternational/web exec tsc --noEmit`).
- Shared utils test: 5/5 unit tests passed (`pnpm --filter @reachinternational/utils test`).
- Mobile TypeScript check: 0 errors (`pnpm --filter @reachinternational/mobile exec tsc --noEmit`).
- End-to-End Browser Verification (`verify_client_site_refined_1790872156955.webp`):
  1. Verified header "Add Site" opens `SiteModal` with "Add Client Site" title and searchable "Target Client Account" `<ClientSelect>` dropdown (`header_add_site_modal_1790872184104.png`).
  2. Verified row action menu (`⋮`) -> "Add Site" opens `SiteModal` with "Add Site — Afcons Infrastructure" title and preselected client banner (`row_add_site_modal_1790872236562.png`).
  3. Verified clean modal cancel and backdrop closing.
- Supabase Dev project `vlmxciuogczumumrwyot` targeted; Production strictly protected.
