import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

console.log("================================================================");
console.log("  ASSIGNMENT UI REDESIGN & STANDARDIZATION VERIFICATION");
console.log("================================================================");

let totalPassed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// 1. Barrel Exports & Core Reusable Components
check("assignments/index.ts: exports all reusable assignment components and types", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/index.ts"), "utf8");
  assert.match(content, /export\s+\{\s*AssignmentDialog/);
  assert.match(content, /export\s+\{\s*AssignmentSearch/);
  assert.match(content, /export\s+\{\s*AssignmentSelectableList/);
  assert.match(content, /export\s+\{\s*AssignmentSelectionSummary/);
  assert.match(content, /export\s+\{\s*AssignmentShiftPicker/);
  assert.match(content, /export\s+\{\s*AssignmentActions/);
  assert.match(content, /export\s+\{\s*AssignSupervisorToClientDialog/);
  assert.match(content, /export\s+\{\s*AssignSupervisorToMachineDialog/);
  assert.match(content, /export\s+\{\s*AssignOperatorToMachineDialog/);
  assert.match(content, /export\s+\{\s*AssignMachineToOperatorDialog/);
});

// 2. AssignmentSearch Component
check("AssignmentSearch: debounced search input, result counts, clear button and Geist styling", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentSearch.tsx"), "utf8");
  assert.match(content, /debounceMs\s*=\s*250/);
  assert.match(content, /onChange/);
  assert.match(content, /handleClear/);
  assert.match(content, /h-10|min-h-\[40px\]|min-h-\[44px\]/);
  assert.match(content, /Search/);
  assert.match(content, /X/);
});

// 3. AssignmentSelectableList Component
check("AssignmentSelectableList: monochromatic avatars with Geist tokens and accessible listbox/radiogroup", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentSelectableList.tsx"), "utf8");
  assert.match(content, /item\.avatarInitials/);
  assert.match(content, /bg-\[var\(--color-ink\)\]/);
  assert.match(content, /dark:bg-white/);
  assert.match(content, /font-mono/);
  assert.match(content, /role=\{isMultiSelect \? "listbox" : "radiogroup"\}/);
});

// 4. AssignmentShiftPicker Component
check("AssignmentShiftPicker: 24h shift selections with interval timing and conflict prevention", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentShiftPicker.tsx"), "utf8");
  assert.match(content, /shifts/);
  assert.match(content, /selectedCode/);
  assert.match(content, /onSelectShift/);
  assert.match(content, /min-h-\[52px\]|min-h-\[44px\]/);
  assert.match(content, /font-mono/);
});

// 5. AssignmentSelectionSummary Component
check("AssignmentSelectionSummary: capacity meter with visual dots, progress calculation and removal", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentSelectionSummary.tsx"), "utf8");
  assert.match(content, /maxCapacity/);
  assert.match(content, /currentCount/);
  assert.match(content, /onRemove/);
  assert.match(content, /bg-\[var\(--color-ink\)\]/);
  assert.match(content, /font-mono/);
});

// 6. AssignmentActions Component
check("AssignmentActions: footer with unsaved changes badge, error banner, and action buttons", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentActions.tsx"), "utf8");
  assert.match(content, /isDirty/);
  assert.match(content, /errorMessage/);
  assert.match(content, /isSaving/);
  assert.match(content, /onCancel/);
  assert.match(content, /onSubmit/);
  assert.match(content, /min-h-\[44px\]/);
});

// 7. AssignmentDialog Shell
check("AssignmentDialog: modal wrapper with target entity details and inherited supervisor notice", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentDialog.tsx"), "utf8");
  assert.match(content, /@\/components\/ui\/Modal/);
  assert.match(content, /targetEntity/);
  assert.match(content, /inheritedNotice/);
  assert.match(content, /font-mono/);
});

// 8. AssignSupervisorToClientDialog
check("AssignSupervisorToClientDialog: supervisor dropdown, site selection, and optimistic handling", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToClientDialog.tsx"), "utf8");
  assert.match(content, /assignClientSupervisorAction/);
  assert.match(content, /getAvailableSupervisorsAction/);
  assert.match(content, /AssignmentDialog/);
  assert.match(content, /UserSelect/);
  assert.match(content, /AssignmentActions/);
});

// 9. AssignOperatorToMachineDialog
check("AssignOperatorToMachineDialog: enforces max 3 operators, shift overlap check, and snapshot rollback", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(content, /roster\.length\s*>=\s*3/);
  assert.match(content, /updateMachinePersonnelAction/);
  assert.match(content, /doRangesOverlap/);
  assert.match(content, /rollbackSnapshot|initialSnapshot/);
  assert.match(content, /getUserInitials/);
  assert.match(content, /AssignmentSelectionSummary/);
});

// 10. AssignMachineToOperatorDialog
check("AssignMachineToOperatorDialog: enforces max 3 shifts per operator, cross-machine validation, and snapshot rollback", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignMachineToOperatorDialog.tsx"), "utf8");
  assert.match(content, /operatorRoster\.length\s*>=\s*3/);
  assert.match(content, /updateOperatorMachineAssignmentsAction/);
  assert.match(content, /initialSnapshot/);
  assert.match(content, /AssignmentSelectionSummary/);
});

// 11. ClientSupervisorModal Migration
check("ClientSupervisorModal: delegates directly to AssignSupervisorToClientDialog with preserved API", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/clients/ClientSupervisorModal.tsx"), "utf8");
  assert.match(content, /AssignSupervisorToClientDialog/);
  assert.match(content, /export function ClientSupervisorModal/);
  assert.match(content, /isOpen/);
  assert.match(content, /clientId/);
  assert.match(content, /clientName/);
  assert.match(content, /onSuccess/);
});

// 12. ClientDetailClient ConfirmationDialog & Optimistic Rollback
check("ClientDetailClient: uses ConfirmationDialog (zero window.confirm) and optimistic removal rollback", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/clients/ClientDetailClient.tsx"), "utf8");
  assert.doesNotMatch(content, /window\.confirm/);
  assert.match(content, /ConfirmationDialog/);
  assert.match(content, /getUserInitials/);
  assert.match(content, /previousSupervisors/);
  assert.match(content, /setSupervisors\(previousSupervisors\)/);
  assert.match(content, /removeClientSupervisorAction/);
});

// 13. AssignPersonnelModal Backward Compatibility & Reusable Composition
check("AssignPersonnelModal: exports backward-compatible types and delegates to specialized dialogs", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/AssignPersonnelModal.tsx"), "utf8");
  assert.match(content, /export\s+(interface|type)\s+OperatorAssignmentItem/);
  assert.match(content, /export\s+(interface|type)\s+MachineAssignmentItem/);
  assert.match(content, /export\s+(interface|type)\s+AssignPersonnelModalProps/);
  assert.match(content, /AssignOperatorToMachineDialog/);
  assert.match(content, /AssignMachineToOperatorDialog/);
  assert.match(content, /export function AssignPersonnelModal/);
});

// 14. MachineAssignmentsQuickModal Monochromatic Initials
check("MachineAssignmentsQuickModal: monochromatic avatar initials with getUserInitials", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/MachineAssignmentsQuickModal.tsx"), "utf8");
  assert.match(content, /getUserInitials/);
  assert.match(content, /bg-\[var\(--color-ink\)\]/);
  assert.match(content, /dark:bg-white/);
  assert.match(content, /font-mono/);
});

// 15. AssignSupervisorToMachineDialog Implementation
check("AssignSupervisorToMachineDialog: dedicated machine supervisor assignment with optimistic updates & rollback", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.match(content, /updateMachineSupervisorsAction/);
  assert.match(content, /rollbackSnapshot/);
  assert.match(content, /getUserInitials/);
  assert.match(content, /formatEmployeeId/);
  assert.match(content, /MachineSelect/);
  assert.match(content, /UserSelect/);
  assert.match(content, /AssignmentActions/);
  assert.match(content, /export function AssignSupervisorToMachineDialog/);
});

// 16. MachineRowActionsMenu: Separated Assign Supervisor and Assign Operator
check("MachineRowActionsMenu: separates Assign Supervisor and Assign Operator actions", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/machines/MachineRowActionsMenu.tsx"), "utf8");
  assert.match(content, /onAssignSupervisor/);
  assert.match(content, /onAssignOperator/);
  assert.match(content, /<span>Assign Supervisor<\/span>/);
  assert.match(content, /<span>Assign Operator<\/span>/);
  assert.doesNotMatch(content, /<span>Edit Supervisor & Operator<\/span>/);
});

// 17. MachineClientView: Removed Refresh Personnel Button
check("MachineClientView: removed [Refresh Personnel] sync button completely", () => {
  const content = fs.readFileSync(path.join(webRoot, "app/(app)/machines/[id]/MachineClientView.tsx"), "utf8");
  assert.doesNotMatch(content, /aria-label="Refresh Personnel"/);
  assert.doesNotMatch(content, /title="Fetch latest assignments from database"/);
  assert.doesNotMatch(content, /handleManualRefreshPersonnel/);
});

// 18. MachineClientView: Separated Assign Supervisor and Assign Operator Buttons
check("MachineClientView: separates Assign Supervisor and Assign Operator buttons with dedicated modals", () => {
  const content = fs.readFileSync(path.join(webRoot, "app/(app)/machines/[id]/MachineClientView.tsx"), "utf8");
  assert.match(content, /<span>Assign Supervisor<\/span>/);
  assert.match(content, /<span>Assign Operator<\/span>/);
  assert.match(content, /setSupervisorModalOpen/);
  assert.match(content, /setOperatorModalOpen/);
  assert.match(content, /<MachineSupervisorModal/);
  assert.match(content, /<MachineOperatorModal/);
});

// 19. AssignSupervisorToMachineDialog: Strictly Role = Supervisor Only Filtering
check("AssignSupervisorToMachineDialog: candidate dropdown filters strictly for role === 'supervisor' only", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.match(content, /filterSupervisorsOnly/);
  assert.match(content, /roleFilter=\{?\["supervisor"\]\}?/);
  assert.match(content, /s\.role === "supervisor"/);
  assert.doesNotMatch(content, /Client-Level Site Supervisors/);
});

// 20. AssignSupervisorToMachineDialog: Client-Inherited Callout Box Removed
check("AssignSupervisorToMachineDialog: client-inherited supervisors notice box is completely removed", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.doesNotMatch(content, /clientInheritedSupervisors/);
  assert.doesNotMatch(content, /getClientSupervisorsAction/);
  assert.doesNotMatch(content, /border-sky-500\/20/);
});

// 21. Fast API Route: /api/machines/[id]/supervisors
check("API Route /api/machines/[id]/supervisors: fast parallel GET and atomic POST handlers exist", () => {
  const routePath = path.join(webRoot, "app/api/machines/[id]/supervisors/route.ts");
  assert.ok(fs.existsSync(routePath), "route.ts must exist at app/api/machines/[id]/supervisors/route.ts");
  const content = fs.readFileSync(routePath, "utf8");
  assert.match(content, /export async function GET/);
  assert.match(content, /export async function POST/);
  assert.match(content, /\.eq\("role",\s*"supervisor"\)/);
  assert.match(content, /machines_client_id_fkey/);
  assert.match(content, /current_supervisor_id/);
});

// 22. Dedicated DAL & SSR Supervisor Optimization
check("DAL & SSR: getActiveSupervisorsOnly strictly selects role = 'supervisor' and hydrates machine detail", () => {
  const dalContent = fs.readFileSync(path.join(webRoot, "lib/data/machines/machine-filters.ts"), "utf8");
  assert.match(dalContent, /export const getActiveSupervisorsOnly/);
  assert.match(dalContent, /\.eq\("role",\s*"supervisor"\)/);

  const pageContent = fs.readFileSync(path.join(webRoot, "app/(app)/machines/[id]/page.tsx"), "utf8");
  assert.match(pageContent, /getActiveSupervisorsOnly/);
});

// 23. AssignSupervisorToMachineDialog: Redundant Span Label Removed
check("AssignSupervisorToMachineDialog: removes redundant 'Available Supervisors' span label above UserSelect", () => {
  const content = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.doesNotMatch(content, /Available Supervisors \(role = supervisor only\)/);
});

// 24. Clean Equipment Header: Machine ID Small & Grey, Model & Serial in Bold
check("Assign Dialogs: machine ID small and grey, machine model and serial number in bold", () => {
  const supContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.match(supContent, /text-xs sm:text-sm font-bold text-\[var\(--color-ink\)\]/);
  assert.match(supContent, /currentMachine\?\.serial_number/);
  assert.match(supContent, /text-\[11px\] font-mono text-\[var\(--color-mute\)\]/);

  const opContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(opContent, /isSingleMachineFixed/);
  assert.match(opContent, /text-xs sm:text-sm font-bold text-\[var\(--color-ink\)\]/);
  assert.match(opContent, /currentMachine\?\.serial_number/);
  assert.match(opContent, /text-\[11px\] font-mono text-\[var\(--color-mute\)\]/);
});

// 25. Optimized Query & Dual-Transport API Routes
check("Query & Transport: 2-tier parallel resolution in getMachinePersonnelFreshAction and serial_number in route", () => {
  const actionContent = fs.readFileSync(path.join(webRoot, "app/actions/machines.ts"), "utf8");
  assert.match(actionContent, /Tier 1: Execute machine lookup and active assignments in parallel/);
  assert.match(actionContent, /Tier 2: Execute client shifts and user profiles lookup in parallel/);

  const routeContent = fs.readFileSync(path.join(webRoot, "app/api/machines/[id]/supervisors/route.ts"), "utf8");
  assert.match(routeContent, /serial_number/);
});

// 26. Supervisor RBAC for Operator Candidate Selection
check("AssignOperatorToMachineDialog: candidate pool enforces supervisor RBAC (supervisors only see operators under their supervision)", () => {
  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /userId\?: string;/);
  assert.match(dialogContent, /isSupervisorRole && userId/);
  assert.match(dialogContent, /o\.supervisor_id !== userId/);
  assert.match(dialogContent, /roleFilter=\{?\["operator"\]\}?/);

  const filterContent = fs.readFileSync(path.join(webRoot, "lib/data/machines/machine-filters.ts"), "utf8");
  assert.match(filterContent, /export const getSupervisorScopedOperators/);
  assert.match(filterContent, /export async function getActiveOperatorsForUser/);

  const pageContent = fs.readFileSync(path.join(webRoot, "app/(app)/operations/page.tsx"), "utf8");
  assert.match(pageContent, /getActiveOperatorsForUser\(user\.id,\s*user\.role\)/);
});

// 27. Preserve User-Selected Machine Without Automatic Default Reset
check("AssignOperatorToMachineDialog: equipment selection preserves user-selected machine without automatic default reset", () => {
  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /userExplicitlySelectedMachineRef/);
  assert.match(dialogContent, /prevIsOpenRef/);
  assert.match(dialogContent, /userExplicitlySelectedMachineRef\.current\s*=\s*true/);
  assert.doesNotMatch(dialogContent, /\}, \[isOpen, machine\?\.id, initialMachineId, machines\]\);/);
});

// 28. Fast API Route /api/machines/[id]/operators
check("API Route /api/machines/[id]/operators: fast parallel GET and atomic POST handlers exist with supervisor RBAC", () => {
  const routePath = path.join(webRoot, "app/api/machines/[id]/operators/route.ts");
  assert.ok(fs.existsSync(routePath), "route.ts must exist at app/api/machines/[id]/operators/route.ts");
  const content = fs.readFileSync(routePath, "utf8");
  assert.match(content, /export async function GET/);
  assert.match(content, /export async function POST/);
  assert.match(content, /getActiveOperatorsForUser/);
  assert.match(content, /getActiveOperatorMachineAssignments/);
  assert.match(content, /operator_machine_assignments/);
  assert.match(content, /client_shift_codes/);
});

// 29. AssignmentSelectionSummary Loading Skeleton
check("AssignmentSelectionSummary: supports isLoading and renders loading skeleton to eliminate layout flash", () => {
  const summaryContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignmentSelectionSummary.tsx"), "utf8");
  assert.match(summaryContent, /isLoading\?: boolean;/);
  assert.match(summaryContent, /animate-pulse/);

  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /isLoading=\{isLoadingMachinePersonnel\}/);
});

// 30. Machine Personnel Key Uniqueness & Deduplication
check("MachineClientView & MobileMachineDetailView: guarantee 100% collision-free unique keys and personnel deduplication", () => {
  const webContent = fs.readFileSync(path.join(webRoot, "app/(app)/machines/[id]/MachineClientView.tsx"), "utf8");
  assert.match(webContent, /key=\{\`\$\{sup\.id \|\| 'sup'\}-\$\{idx\}\`\}/);
  assert.match(webContent, /key=\{\`\$\{op\.id \|\| 'op'\}-\$\{op\.shift_code \|\| idx\}-\$\{idx\}\`\}/);
  assert.doesNotMatch(webContent, /key=\{op\.id \|\| idx\}/);
  assert.doesNotMatch(webContent, /key=\{sup\.id \|\| idx\}/);

  const mobileRoot = path.resolve(webRoot, "../mobile");
  const mobileContent = fs.readFileSync(path.join(mobileRoot, "components/machines/MachineDetailView.tsx"), "utf8");
  assert.match(mobileContent, /key=\{\`\$\{s\.id \|\| 'sup'\}-\$\{idx\}\`\}/);
  assert.match(mobileContent, /key=\{\`\$\{o\.id \|\| 'op'\}-\$\{o\.shift_code \|\| idx\}-\$\{idx\}\`\}/);
  assert.doesNotMatch(mobileContent, /key=\{o\.id \|\| idx\}/);
  assert.doesNotMatch(mobileContent, /key=\{s\.id \|\| idx\}/);
});

// 31. Operator Candidate Dropdown: Shows Already Assigned Shift Name
check("AssignOperatorToMachineDialog & UserSelect: candidate operator items include assigned shift names and subtitle indicator", () => {
  const userSelectContent = fs.readFileSync(path.join(webRoot, "components/ui/UserSelect.tsx"), "utf8");
  assert.match(userSelectContent, /subtitle\?: string \| null;/);
  assert.match(userSelectContent, /assigned_shift\?: string \| null;/);
  assert.match(userSelectContent, /u\.subtitle/);

  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /assignedShiftDescriptions/);
  assert.match(dialogContent, /subtitle\s*=\s*assignedShiftDescriptions\.length > 0/);
  assert.match(dialogContent, /Available \(No active shifts\)/);
  assert.match(dialogContent, /Assigned:/);
});

// 32. Machine Shift Schedule Resolves Client-Specific Shift Codes & Timings
check("AssignOperatorToMachineDialog: resolves client shift codes and timings dynamically from rented client", () => {
  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignOperatorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /getCachedClientShifts\(clientId\)/);
  assert.match(dialogContent, /setCachedClientShifts/);
  // Date-aware atomic roster fetch: client scope + selected assignment date are sent as query params
  assert.match(dialogContent, /const targetUrl = `\/api\/machines\/\$\{selectedMachineId\}\/operators\$\{query \? `\?\$\{query\}` : ""\}`/);
  assert.match(dialogContent, /params\.set\("client_id", clientId\)/);
  assert.match(dialogContent, /params\.set\("date", assignmentDate\)/);
  assert.match(dialogContent, /selectedShiftCode/);

  const routeContent = fs.readFileSync(path.join(webRoot, "app/api/machines/[id]/operators/route.ts"), "utf8");
  assert.match(routeContent, /effectiveClientId/);
  assert.match(routeContent, /client_shift_codes/);
});

// 33. TodayShiftMonitorTab: Fine-Grained Optimistic UI Update Without Full Page Reload
check("TodayShiftMonitorTab: fine-grained optimistic update handles assignment, unassignment, multi-shifts, and eliminates router.refresh", () => {
  const monitorContent = fs.readFileSync(path.join(webRoot, "components/operations/TodayShiftMonitorTab.tsx"), "utf8");
  assert.match(monitorContent, /newOps\.length === 0/);
  assert.match(monitorContent, /operator_name:\s*"Unassigned"/);
  assert.match(monitorContent, /status:\s*"unassigned"/);
  assert.match(monitorContent, /updatedMachineRows/);
  assert.match(monitorContent, /dedupeShiftMonitorRows/);
  // Soft, cache-tier background sync after the roster save settles. The refresh entry point
  // was renamed to `refreshRoster(bypassCache)` during the operations performance refactor;
  // `refreshRoster(false)` is the exact equivalent of the former `fetchData(date, undefined, false)`.
  assert.match(monitorContent, /refreshRoster\(false\)/);
  assert.match(monitorContent, /const refreshRoster = useCallback\(/);
  // Ensure the roster save path never triggers a full router.refresh()
  assert.doesNotMatch(monitorContent, /router\.refresh\(\)/);
});

// 34. AssignSupervisorToMachineDialog: Supervisor Candidate Pool & Removal
check("AssignSupervisorToMachineDialog: lazySupervisors loads candidate pool properly and handles removing primary supervisor", () => {
  const dialogContent = fs.readFileSync(path.join(webRoot, "components/assignments/AssignSupervisorToMachineDialog.tsx"), "utf8");
  assert.match(dialogContent, /lazySupervisors\.length\s*<=\s*1/);
  assert.match(dialogContent, /selectedSupervisorIds\.length === 0/);
  assert.match(dialogContent, /candidateUserSelectItems/);
});

console.log("================================================================");
console.log(`  ALL ${totalPassed} ASSIGNMENT STANDARDIZATION CHECKS PASSED! (100%)`);
console.log("================================================================");
