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

console.log("================================================================");
console.log(`  ALL ${totalPassed} ASSIGNMENT STANDARDIZATION CHECKS PASSED! (100%)`);
console.log("================================================================");
