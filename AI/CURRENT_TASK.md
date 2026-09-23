# Current Task: Machines Page Personnel Assignment — Display All Operators & Supervisors from Database (/machines)

Status: COMPLETED (2026-09-23)

## Goal
Address user feedback on `/machines`:
> "while assign personel show the all list of operator and supervisor from the database"
(Viewport: 1536×695, Component: `<MultiUserSelect>` inside "Assign Shift Personnel" modal)

## Root Cause
1. **Schema Mismatch on PostgreSQL `public.users` in Machine DAL**:
   - `getActiveSupervisors()` and `getActiveOperators()` in `apps/web/lib/data/machines/machine-filters.ts` queried `shift_time` from `public.users` (which was dropped in migration 100 in favor of `shift_start_time` and `shift_end_time`) and queried non-existent `public.employees` table.
   - This caused PostgREST to return PostgreSQL errors `42703: column "shift_time" does not exist` and `42P01: relation "public.employees" does not exist`, resulting in `usersData = null` and empty arrays `[]` being cached and returned monorepo-wide.
2. **Missing Self-Hydrating On-Demand Load in `MachinePersonnelModal`**:
   - `MachinePersonnelModal` in `apps/web/components/machines/MachineEditModals.tsx` only accepted `supervisors = []` and `operators = []` as props and had no internal fetch or fallback to load options on demand.
   - When opened from `MachineListClient.tsx` (where options were not awaited before opening), `supervisors` and `operators` were empty arrays, causing `allSupervisors` and `allOperators` to only show the machine's currently assigned personnel (or empty) rather than the complete database roster.
3. **Obsolete `shift_time` Projection in Machine Details & Exports**:
   - `machine-detail.ts`, `machine-export.ts`, and `operations-log-detail.ts` still included obsolete `shift_time` in embedded user relations.

## Delivered Solution

### 1. Data Access Layer (`apps/web/lib/data/machines/machine-filters.ts`)
- Refactored `getActiveSupervisors`:
  - Queries `public.users` for valid columns: `id, full_name, phone, email, role, status, shift_start_time, shift_end_time`.
  - Filters by `.in("role", ["supervisor", "manager", "admin", "super_admin"])` and `.neq("status", "inactive")`.
  - Formats canonical `shift_time` string `${shift_start_time.slice(0, 5)} - ${shift_end_time.slice(0, 5)}` for display in `<MultiUserSelect>`.
  - Removed all queries to non-existent `employees` table.
  - Added error handling and bumped cache tag to `active-supervisors-v10` with `TAGS.users`.
- Refactored `getActiveOperators`:
  - Queries `public.users` for valid columns: `id, full_name, phone, email, role, status, shift_start_time, shift_end_time`.
  - Filters by `.eq("role", "operator")` and `.neq("status", "inactive")` (returns all 74 active operators).
  - Formats canonical `shift_time` string.
  - Removed all queries to non-existent `employees` table.
  - Added error handling and bumped cache tag to `active-operators-v10` with `TAGS.users`.
- Bumped `getCachedMachineFilterOptions` cache key to `machine-filter-options-master-v3` with `TAGS.users`.

### 2. Machine Edit Modals (`apps/web/components/machines/MachineEditModals.tsx`)
- In `MachinePersonnelModal`:
  - Added `lazySupervisors` and `lazyOperators` state initialized from props.
  - Added on-demand fetch via `getMachineModalOptionsAction()` when modal is open and options are empty, with `isLoadingOptions` state.
  - Updated `<MultiUserSelect>` placeholders with dynamic loading status:
    `isLoadingOptions && allSupervisors.length === 0 ? "Loading supervisors from database..." : "Search & assign supervisors..."`
    `isLoadingOptions && allOperators.length === 0 ? "Loading operators from database..." : "Search & assign operators..."`
  - Synced props whenever parent updates options.
- In `MachineClientModal`:
  - Added `lazyClients` state and on-demand fetch via `getClientSelectOptionsAction()`.
  - Added dynamic loading placeholder for `<ClientSelect>`.

### 3. Machine Edit Client (`apps/web/app/(app)/machines/[id]/edit/machine-edit-client.tsx`)
- Added `lazySupervisors`, `lazyOperators`, and `lazyClients` state with automatic on-demand fetch fallback via `getMachineModalOptionsAction()`.

### 4. Machine Details, Export & Logs Data Layer Fixes
- `apps/web/lib/data/machines/machine-detail.ts`:
  - Aligned PostgREST embedded user projections from `shift_time` to `shift_start_time, shift_end_time`.
  - Updated `hydrateMachinePersonnelSingle` to derive `shift_time` safely.
  - Updated `getMachineAssignments` operator query projection.
- `apps/web/lib/data/machines/machine-export.ts`:
  - Aligned PostgREST embedded user projections and `hydrateExportPersonnel` to select `shift_start_time, shift_end_time`.
- `apps/web/lib/data/operations/operations-log-detail.ts`:
  - Aligned `LOG_SUMMARY_PROJECTION` and `getLogAssignments` embedded operator projections to select `shift_start_time, shift_end_time`.

## Verification & Quality Gates
- `pnpm --filter @reachinternational/web typecheck`: 0 errors.
- `pnpm --filter @reachinternational/mobile typecheck`: 0 errors.
- `pnpm --filter @reachinternational/permissions test`: 3/3 passed.
- Supabase Live Database Verification:
  - 8 supervisors/managers/admins (`status != 'inactive'`).
  - 74 operators (`status != 'inactive'`).
  - Zero SQL errors on column projections.