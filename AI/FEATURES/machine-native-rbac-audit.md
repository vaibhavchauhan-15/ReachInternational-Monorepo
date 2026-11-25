# Native Machines Module — Pre-Edit Audit (RBAC / Bugs / Performance)

Date: 2026-11-23 (session)
Scope: `apps/mobile/app/(app)/machines.tsx`, `apps/mobile/components/machines/*`, `apps/mobile/lib/hooks/useMachinesData.ts`, native navigation entry points, plus DB objects used by the native Machines module only.
Out of scope: `apps/web` (owned by the parallel web prompt), all other mobile modules.

## 0. Render-mode confirmation

`/machines` is a **native** Expo Router screen. The WebView shell (`shell/AppWebView.tsx`) is only reached from
`app/index.tsx` when `getShellMode()` selects shell mode; `app/(app)/_layout.tsx` registers `machines` as a
`Tabs.Screen` rendered by `MobileBottomNav`. Everything below therefore targets native React Native / Hermes paths,
not the WebView bridge.

## 1. RBAC audit (current state, before changes)

| Capability (matrix) | Current native behaviour | Verdict |
|---|---|---|
| Route access HR ✗ | `machines.tsx` renders `<PermissionDeniedView>` in place; route/tab is still mounted, deep links land on a dead screen. Tab is hidden through `NAV_ITEMS`, but `_layout` still registers the screen. | **Gap**: no redirect guard |
| Route access operator ✓ (assigned only) | Operator sees the same screen as M+ and is scoped only by PostgREST `or(...)` filters built in the client | **Gap**: scope not server-enforced by a dedicated contract |
| Fleet directory/KPIs/search/filters operator ✗ | `MachineKPIStrip` (fleet totals), `MachineFilterPanel` (search + 5 filters), “Showing x of y machines” count and export action are all rendered for operators | **Gap** |
| Add / edit specs / bulk import M+ only | Header actions gated by `canCreate = admin\|super_admin\|manager` | OK (but string compare, not capability) |
| Delete M+ only | `DeleteMachineDialog` only reachable from `MachineDetailView` `canDelete` | OK |
| Assign/change supervisors M+ only | `MachineModal` supervisor branch omits supervisor ids; DB trigger `enforce_supervisor_machine_update_restrictions` also blocks | OK |
| Update HMR / health / rental status M+ + supervisor | **Supervisor cannot open any editor in native** (`canEdit = isAdminOrManager`); `MachineModal` already implements a supervisor-restricted payload (`hour_meter`, `status`, `health_status`, `client_id`, roster) that is never used | **Gap** |
| Assign/unassign operators + shifts M+ + supervisor | `canAssignOperator` booleans + `MobileAssignPersonnelModal` | OK |
| Assign client (rented) M+ + supervisor | Supervisor branch exists in `MachineModal` but is unreachable | **Gap** (blocked by edit gate) |
| Commercial rental rates (M+ only) | No rental-rate table/column exists in Dev DB (`information_schema` verified); nothing is projected | OK, must stay absent for supervisor/operator |
| Machine audit tab M+ + supervisor | Hidden for operator only; `audit_logs` RLS already returns 0 rows for operator | OK |
| Export M+ + supervisor | Header action visible to every non-operator role | **Gap**: not capability-gated |
| Operator view (ID, model, serial, manufacturer, year, health, HMR, worksite, site supervisor, CTAs Log Entry + History) | Card shows ID/model/serial/year/health/HMR/client/supervisors **and other operators**; manufacturer only on detail; footer CTA is History + “Assign Operator”, no Log Entry | **Gap** |

Single source of truth: the module re-derives roles ad hoc in 5 files (`machines.tsx` 3×, `MachineDetailView.tsx`,
`MobileMachineCard.tsx` booleans, `MachineKPIStrip.tsx`). `packages/permissions/src/machines.ts` now provides
`MACHINE_CAPABILITIES` / `hasMachineCapability` / `getMachineScope` and is the only matrix the native module will read.

### Server-side (independent of the UI)

* `machines_select_authorized` currently allows `hr` → HR can read the whole fleet table over PostgREST despite the UI denial.
* `get_machines_directory_summary` is `SECURITY DEFINER` with **no caller role check** → any authenticated user can request
  full-fleet counts. (Both are being fixed by migration `231_machines_rbac_and_query_hardening.sql`, shared with web.)
* Operator list reads full fleet columns (`operator_ids`, `customer_mobile`, `notes`, `created_by`) because the client
  projection is one shared wide `MACHINE_SELECT_COLUMNS`.

## 2. Interaction / animation audit

* `components/ui/touch/Pressable.tsx` already supports opt-in UI-thread `pressScale` (`PRESS = { scale: 0.97, inMs: 90, outMs: 110 }`).
  `MobileMachineCard` uses `Touchable preset="card"`, whose variant matrix scale is `1.0` → **the fleet cards have no
  press scale at all**; buttons use the variant matrix (0.98) only.
* Overlay primitives (`Sheet`, `Dialog`, `Drawer`, `Popover`) already own enter/exit presets (spring in / 220 ms timing out),
  `ReduceMotion.System`, safe-area insets and BackHandler priority through `OverlayHost`. The machine modal/filter drawer
  inherit these — no new animation system is needed, only consistent usage.
* Haptics already respect the Settings toggle + 60 ms / 120 ms throttle + screen-reader suppression (`lib/haptics`).

## 3. Bug audit

1. **Keyboard overlap / extra taps in machine modal** — inner `ScrollView` has no `keyboardShouldPersistTaps` /
   `keyboardDismissMode`, so a tap on a dropdown while the keyboard is open is swallowed by the dismiss gesture.
2. **Android back** — `machines.tsx` registers a screen-level `BackHandler` for the state-swapped detail view that never
   yields when a modal/drawer is open; overlay dismissal relies on listener ordering.
3. **Stale lists after edits** — `machines.length` comes from a `localMachines` mirror synchronised by `useEffect`, while
   mutations patch the TanStack cache *and* the mirror; delete rollback restores a whole pre-mutation array into every page.
4. **Duplicate taps** — delete is guarded by `isDeletingRef`, modal save by `isSaving`; card press has no in-flight guard.
5. **Persisted filter state** — AsyncStorage hydration happens after the first render, so the first query fires with default
   filters and is immediately refetched with the restored ones (wasted RPC + visible flicker).
6. **360×800 clipping** — card header badges are `flexWrap: 'nowrap'` next to a long `machine_id` chip; at 360 dp the
   Rented/Available badge can be pushed against the hairline. No horizontal scroll container, `paddingBottom: 120` is fixed.
7. **Dead/duplicated code** — duplicate `MachineModal` import paths (direct + barrel-adjacent), empty `StyleSheet` entries
   (`resultsCountText`, `endOfListText`), `MachineExportModal` imports `expo-print`, `expo-sharing`, `expo-file-system/legacy`
   at module scope (registered at startup although export is rare).

## 4. Performance audit

* Eager modules: `MachineDetailView` (172 KB source), `MachineModal` (93 KB), `MachineExportModal` (20 KB) + print/sharing/fs,
  `MachineCategoryModal` (15 KB), `MachineImportModal` (9 KB), skeletons — all imported statically by `machines.tsx`.
* `FlatList`: `initialNumToRender={6}`, `maxToRenderPerBatch={8}`, `windowSize={7}` while the data hook paginates 15 rows
  per chunk; `renderMachineItem` is memoised but the card comparator re-renders on every filter-option array identity change.
* TanStack Query: `staleTime` 30 s (list) / 15 s (KPIs), no explicit `gcTime`, `keepPreviousData` already used for paging.
* Two queries per operator/HR session are avoidable (fleet KPI RPC + filter-option query).

## 5. Change plan (smallest correct change)

1. Consume `@reachinternational/permissions` machine capabilities everywhere in the native module (no parallel matrix).
2. Redirect-guard `/machines` for non-authorized roles (`canAccessMachinesRoute`).
3. Operator: dedicated server contract (`get_operator_assigned_machines`, migration 232) with slim projection; no fleet list,
   KPIs, filter options or audit fetch; operator card view (manufacturer + worksite + site supervisor) with Log Entry/History CTAs.
4. Gate every action/menu/modal launcher by capability and mount modals lazily on first authorised use.
5. Fix the interaction bugs above (persist-taps, back-handler yield, single cache source, hydration gate, badge wrap, 44 px targets).
6. Retune FlatList for the 10-row chunk, add `gcTime`, drop the mirror state, keep callbacks stable.
7. Add DB migration 232 (Dev only) + native RBAC negative tests (RLS/RPC per role) and update the existing machine test suite.
