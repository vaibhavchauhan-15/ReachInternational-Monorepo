# Current Task

## Task: 290 — Machines Fleet Directory (/machines) Header Dropdown Relocation, Multi-Site Conditional Dropdown & 100% Web/Native Parity
**Status**: 🟢 COMPLETED & MONOREPO VERIFIED
**Date**: 2026-10-29
**Target Scope**:
- Web Application (`apps/web`):
  - `apps/web/components/machines/MachineEditModals.tsx` (`MachineClientModal`)
  - `apps/web/lib/data/machines/machine-list.ts` (`MACHINE_LIST_COLUMNS`)
  - `apps/web/lib/data/machines/machine-detail.ts` (`MACHINE_DETAIL_COLUMNS`)
  - `apps/web/app/actions/assignments.ts` (`getAssignableMachinesAction`)
  - `apps/web/app/actions/machines.ts` (`updateMachineClientAssignmentAction`)
  - `apps/web/scripts/test-machine-client-modal.mjs`
- Mobile Application (`apps/mobile`):
  - `apps/mobile/components/machines/MachineModal.tsx`

**Key Accomplishments**:
1. **Feedback 1: Header Dropdown Removal & Placement Above Clients**:
   - In `MachineClientModal`, removed the `<MachineSelect>` dropdown from the `<Modal title="...">` header. Title is now a clean string `title="Client Assignment"`.
   - Placed the `<MachineSelect>` dropdown inside the modal body directly above `<ClientSelect>` with the clear label "Machinery Unit", allowing switching target equipment cleanly.
   - On native mobile (`MachineModal.tsx`), when editing client assignment (`initialSection === 'client'`), displayed the Machinery Unit summary card above the client selection, maintaining 100% layout and hierarchy parity.
2. **Feedback 2: Multi-Site Conditional Dropdown & Auto-Assignment**:
   - Web: Below the client dropdown, if the selected client has more than 1 active site (`sites.length > 1`), dynamically renders the Client Deployment Site dropdown (`SearchableSelect`). If the client has only 1 active site (`sites.length === 1`), automatically links `siteId` to that single site and renders a clean information notice pill without cluttering the UI with an unnecessary dropdown. If 0 sites, no dropdown is rendered.
   - Mobile: In `MachineModal.tsx`, updated site loading to auto-assign `siteId` when `clientSites.length === 1`. In the UI, the `SearchableSelect` is now strictly shown when `selectedClient && clientSites.length > 1`. When `clientSites.length === 1`, renders the single-site information pill.
3. **Data Access Layer & Actions**:
   - Updated `updateMachineClientAssignmentAction` in `apps/web/app/actions/machines.ts` to return `site_id: validSiteId` alongside `client_id` and `status`.
   - Included `site_id` in `MACHINE_LIST_COLUMNS` (`machine-list.ts`) and `MACHINE_DETAIL_COLUMNS` (`machine-detail.ts`).
   - Included `site_id` in `getAssignableMachinesAction` (`assignments.ts`) so switching machines updates `siteId` seamlessly.
4. **Mobile Optimization & Touch Ergonomics**:
   - Enforced >= 44px min touch targets monorepo-wide.
   - Zero raw typography property violations across mobile (`StyleSheet.create` strictly compliant).
   - Forbidden cursor on save button when unchanged/not dirty.
5. **Testing & Verification**:
   - Created and executed `apps/web/scripts/test-machine-client-modal.mjs` (5/5 passed).
   - Executed `apps/web/scripts/test-assignment-standardization.mjs` (14/14 passed).
   - Executed `pnpm --filter @reachinternational/permissions test` (15/15 passed).
   - Executed `node apps/mobile/run-tests.mjs` (357/357 passed).
   - Executed `node scripts/check-typography.mjs` (0 violations).
