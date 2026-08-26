# Current Task Context

## Completed Task (2026-08-26) — Navigation Sub-Items & Tabs Soft Removal (Operator Roster & Salary, Site Movement, Service Logs, Breakdown Complaints)

**Goal**: Soft remove the 4 unused sidebar menu sub-items and tabs across all roles per user feedback while maintaining zero performance impact and keeping all underlying backend handlers and components intact for seamless future activation.

### Key Changes & Implementation Details

1. **Sidebar Navigation Sub-Items Soft Removal (`apps/web/components/layout/AppSidebar.tsx`)**:
   - Soft-removed (commented out) **"Operator Roster & Salary"** (`tab: "operators"`) and **"Site Movement / Loading-Unloading"** (`tab: "site-movement"`) from `mainNavItems` and `visibleMainItems` mapping under `/operations` for all user roles.
   - Soft-removed (commented out) **"Service Logs"** (`tab: "services"`) and **"Breakdown Complaints"** (`tab: "complaints"`) from `mainNavItems` under `/machines` for all user roles.

2. **Operations Client Route Synchronization (`apps/web/components/operations/OperationsClient.tsx`)**:
   - Updated `validTabs` array to `["logs", "assignments"]` for non-operators.
   - Preserved component handlers and view rendering logic so underlying functionality remains 100% stable and performance-optimized.

3. **Machine List Sub-Menu Tabs Soft Removal (`apps/web/components/machines/MachineListClient.tsx`)**:
   - Soft-removed the mobile/tablet sub-menu tab buttons for "Service Logs" and "Breakdown Complaints".

4. **Global Command Palette Clean Up (`apps/web/components/ui/CommandPalette.tsx`)**:
   - Soft-removed `nav-services` command item ("Go to Service Logs") from quick navigation results.

5. **Mandatory Web-to-Mobile Synchronization (`apps/mobile/lib/nav/navItems.ts`)**:
   - Soft-removed `Service Logs` and `Complaints` under `/machines` sub-items and `Site Movement` and `Operators` under `/operations` sub-items in `mobileNavItems`.

### Verification Results

- **TypeScript Compilation**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).
