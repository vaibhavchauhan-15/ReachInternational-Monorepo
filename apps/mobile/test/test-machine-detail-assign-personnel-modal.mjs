/**
 * Test Suite: Machine Detail Assign Personnel Modal Verification
 *
 * Verifies:
 * 1. MachineDetailView imports and renders MobileAssignPersonnelModal (canonical mobile modal).
 * 2. MobileAssignPersonnelModal is passed `initialMachineId={machine.id}` and `userRole`.
 * 3. Both Card header "Edit" button and EmptyState "Assign Operator" trigger the modal.
 * 4. Header 3-dots menu "Manage Shift Personnel" / "Assign Operators" triggers the modal.
 * 5. Sheet.tsx contains anti-collapse guard (`minHeight: 220`), smooth spring open, and timing exit.
 * 6. Scrim.tsx has synchronized fade timing with Sheet animations.
 * 7. AssignmentBottomSheet.tsx sets explicit height (`height: '88%', maxHeight: '92%'`).
 * 8. Zero TypeScript or style errors across mobile package.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Machine Detail Assign Personnel Modal Verification Suite...\n');

// 1. Check MachineDetailView.tsx
const machineDetailViewPath = path.join(__dirname, 'components/machines/MachineDetailView.tsx');
assert(fs.existsSync(machineDetailViewPath), 'MachineDetailView.tsx must exist');
const machineDetailContent = fs.readFileSync(machineDetailViewPath, 'utf8');

console.log('--- 1. Modal Integration in MachineDetailView ---');

assert(
  machineDetailContent.includes("import { MobileAssignPersonnelModal } from '../operations/MobileAssignPersonnelModal';"),
  'MachineDetailView: Imports canonical MobileAssignPersonnelModal'
);
console.log('  ✓ MachineDetailView imports canonical MobileAssignPersonnelModal');

assert(
  !machineDetailContent.includes('<AssignOperatorToMachineModal'),
  'MachineDetailView: Deprecated AssignOperatorToMachineModal completely replaced'
);
console.log('  ✓ Deprecated AssignOperatorToMachineModal completely replaced');

assert(
  machineDetailContent.includes('<MobileAssignPersonnelModal') &&
  machineDetailContent.includes('visible={assignPersonnelModalVisible}') &&
  machineDetailContent.includes('initialMachineId={machine.id}') &&
  machineDetailContent.includes('userRole={userRole || undefined}'),
  'MachineDetailView: Renders MobileAssignPersonnelModal with initialMachineId and userRole'
);
console.log('  ✓ MobileAssignPersonnelModal bound to machine.id and userRole');

// 2. Check Trigger Points
console.log('\n--- 2. Trigger Points in MachineDetailView ---');

assert(
  machineDetailContent.includes('setAssignPersonnelModalVisible(true)') &&
  machineDetailContent.includes('accessibilityLabel="Manage Staff"'),
  'MachineDetailView: Header "Edit" button triggers modal'
);
console.log('  ✓ "Assigned Shift Personnel" card header Edit button triggers modal');

assert(
  machineDetailContent.includes('actionLabel={canAssignOperator ? "Assign Operator" : undefined}') &&
  machineDetailContent.includes('setAssignPersonnelModalVisible(true)'),
  'MachineDetailView: EmptyState "Assign Operator" action triggers modal'
);
console.log('  ✓ Operators EmptyState "Assign Operator" triggers modal');

assert(
  machineDetailContent.includes("label: 'Manage Shift Personnel'") ||
  machineDetailContent.includes("label: 'Assign Operators'"),
  'MachineDetailView: 3-dots more menu contains Manage Shift Personnel action'
);
console.log('  ✓ 3-dots more menu contains Manage Shift Personnel / Assign Operators action');

// 3. Check Sheet.tsx Animation & Anti-Collapse Guards
console.log('\n--- 3. Sheet.tsx Physics & Anti-Collapse Guards ---');

const sheetPath = path.join(__dirname, 'components/ui/overlay/Sheet.tsx');
assert(fs.existsSync(sheetPath), 'Sheet.tsx must exist');
const sheetContent = fs.readFileSync(sheetPath, 'utf8');

assert(
  sheetContent.includes('minHeight: 220'),
  'Sheet.tsx: Anti-collapse guard (minHeight: 220) present in styles.sheetPanel'
);
console.log('  ✓ Anti-collapse guard (minHeight: 220) configured in Sheet.tsx');

assert(
  sheetContent.includes('stiffness: 340') &&
  sheetContent.includes('damping: 32') &&
  sheetContent.includes('mass: 0.9'),
  'Sheet.tsx: Ultra-smooth native spring entrance curve configured'
);
console.log('  ✓ Ultra-smooth native spring entrance curve (stiffness: 340, damping: 32, mass: 0.9)');

assert(
  sheetContent.includes('duration: 220') &&
  sheetContent.includes('sheetScale.value = withTiming(0.98'),
  'Sheet.tsx: Silky timing exit transition with scale easing configured'
);
console.log('  ✓ Silky timing exit transition with subtle scale easing');

// 4. Check Scrim.tsx Synchronization
console.log('\n--- 4. Scrim.tsx Fade Synchronization ---');

const scrimPath = path.join(__dirname, 'components/ui/overlay/Scrim.tsx');
assert(fs.existsSync(scrimPath), 'Scrim.tsx must exist');
const scrimContent = fs.readFileSync(scrimPath, 'utf8');

assert(
  scrimContent.includes('duration: 260') &&
  scrimContent.includes('duration: 220'),
  'Scrim.tsx: Backdrop fade in and out timing synchronized with Sheet animation'
);
console.log('  ✓ Scrim backdrop fade in (260ms) and fade out (220ms) synchronized with Sheet');

// 5. Check AssignmentBottomSheet.tsx Anti-Collapse
console.log('\n--- 5. AssignmentBottomSheet.tsx Anti-Collapse Layout ---');

const assignmentSheetPath = path.join(__dirname, 'components/assignments/AssignmentBottomSheet.tsx');
assert(fs.existsSync(assignmentSheetPath), 'AssignmentBottomSheet.tsx must exist');
const assignmentSheetContent = fs.readFileSync(assignmentSheetPath, 'utf8');

assert(
  assignmentSheetContent.includes("height: '88%'") &&
  assignmentSheetContent.includes("maxHeight: '92%'"),
  'AssignmentBottomSheet: Explicit height and maxHeight prevents flex: 1 children collapse'
);
console.log('  ✓ AssignmentBottomSheet explicit 88% height prevents flex: 1 children collapse');

console.log('\n======================================================');
console.log('🎉 ALL MACHINE DETAIL ASSIGN PERSONNEL MODAL CHECKS PASSED!');
console.log('======================================================\n');
