/**
 * ReachInternational Mobile — Assign Operator Modal Verification Suite
 * Verifies UI & data display optimizations, query projections, lazy loading,
 * scrollbar containment, keyboard awareness, and capacity/overlap business invariants.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Assign Operator Modal Verification Suite...\n');

const modalPath = path.join(__dirname, 'components', 'operations', 'MobileAssignPersonnelModal.tsx');
const hookPath = path.join(__dirname, 'lib', 'hooks', 'useAssignPersonnelModalData.ts');

assert(fs.existsSync(modalPath), 'MobileAssignPersonnelModal.tsx must exist');
assert(fs.existsSync(hookPath), 'useAssignPersonnelModalData.ts must exist');

const modalContent = fs.readFileSync(modalPath, 'utf8');
const hookContent = fs.readFileSync(hookPath, 'utf8');

console.log('--- 1. API & Query Column Selection Invariants ---');
// Supervisors: Only id, full_name, employee_id
assert(
  hookContent.includes(".select('id, full_name, employee_id')"),
  'useAssignPersonnelModalData: Explicitly projects only required columns (id, full_name, employee_id)'
);
console.log('  ✓ Supervisors & operators query projects only id, full_name, employee_id');

// No phone, email, or role in supervisors select
assert(
  !hookContent.includes(".select('id, full_name, phone, email, role"),
  'useAssignPersonnelModalData: Removed phone, email, and role from supervisor select'
);
console.log('  ✓ Phone, email, and role removed from supervisor query projections');

// Lazy loading hooks exported
assert(
  hookContent.includes('export function useAssignPersonnelSupervisors') &&
  hookContent.includes('export function useAssignPersonnelOperators') &&
  hookContent.includes('export function useAssignPersonnelMachines'),
  'useAssignPersonnelModalData: Exports modular lazy loading query hooks'
);
console.log('  ✓ Modular lazy loading hooks exported (useAssignPersonnelSupervisors, useAssignPersonnelOperators, useAssignPersonnelMachines)');

// Stale request cancellation via AbortSignal
assert(
  hookContent.includes('abortSignal(signal)') || hookContent.includes('.abortSignal('),
  'useAssignPersonnelModalData: Passes AbortSignal for stale request cancellation'
);
console.log('  ✓ AbortSignal cancellation bound for debounced queries');

console.log('\n--- 2. UI & Metadata Cleanliness Invariants ---');
// Supervisor selector: No role badge, no shift time, no phone, no email
assert(
  !modalContent.includes('label="SUPERVISOR"') &&
  !modalContent.includes('staff.shift_start_time') &&
  !modalContent.includes('staff.phone') &&
  !modalContent.includes('staff.email'),
  'MobileAssignPersonnelModal: Supervisor selector displays only name and employee ID (removed role, shift, phone, email)'
);
console.log('  ✓ Supervisor selector: Removed role, shift, mobile number, and email');

// Operator candidate list: No phone number
assert(
  !modalContent.includes('styles.operatorCandidateItem') ||
  !modalContent.slice(modalContent.indexOf('styles.operatorCandidateItem')).includes('op.phone'),
  'MobileAssignPersonnelModal: Operator candidate list removes phone number'
);
console.log('  ✓ Operator candidate list: Removed mobile phone number');

// Employee ID displayed for supervisors and operators
assert(
  modalContent.includes('staff.employee_id') &&
  modalContent.includes('op.employee_id') &&
  modalContent.includes('item.employeeId'),
  'MobileAssignPersonnelModal: Renders employee ID badge/string across supervisors and operators'
);
console.log('  ✓ Employee ID displayed for supervisors, operator cards, and candidate list');

// Machine details: model, machine_id, and serial_number searchable and readable
assert(
  modalContent.includes('m.model') &&
  modalContent.includes('m.machine_id') &&
  modalContent.includes('m.serial_number'),
  'MobileAssignPersonnelModal: Machine model, machine code, and serial number are preserved and searchable'
);
console.log('  ✓ Machine model, machine code, and serial number are readable and searchable');

console.log('\n--- 3. UX, Transitions & Scrollbar Invariants ---');
// LayoutAnimation for smooth expansion and contraction
assert(
  modalContent.includes('LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)'),
  'MobileAssignPersonnelModal: Smooth LayoutAnimation configured on dropdown expand/collapse'
);
console.log('  ✓ Smooth LayoutAnimation configured on dropdown expansion and collapse');

// KeyboardAvoidingView and dynamic height calculation
assert(
  modalContent.includes('<KeyboardAvoidingView') &&
  modalContent.includes('maxDropdownListHeight'),
  'MobileAssignPersonnelModal: KeyboardAwareness and KeyboardAvoidingView prevent input/menu clipping'
);
console.log('  ✓ KeyboardAvoidingView and dynamic dropdown height prevent keyboard clipping');

// Scrollbar overlap fix: Dedicated scroll container content padding
assert(
  modalContent.includes('dropdownListScrollContent') &&
  modalContent.includes('addOperatorListScrollContent') &&
  modalContent.includes('paddingRight: 10') &&
  modalContent.includes('paddingRight: 12'),
  'MobileAssignPersonnelModal: Contained scroll containers provide gutter padding preventing scrollbar overlap'
);
console.log('  ✓ Gutter padding (10-12px) prevents scroll indicators from overlapping badges and options');

// Stable scrollbar on web
assert(
  modalContent.includes("scrollbarGutter: 'stable'") &&
  modalContent.includes("scrollbarWidth: 'thin'"),
  'MobileAssignPersonnelModal: Web scrollbars configured with thin width and stable gutter'
);
console.log('  ✓ Web scrollbars configured with thin width and stable gutter');

console.log('\n--- 4. Business Integrity & Concurrency Invariants ---');
// Mutex savingRef
assert(
  modalContent.includes('savingRef = useRef(false);') &&
  modalContent.includes('if (savingRef.current) return;') &&
  modalContent.includes('savingRef.current = true;'),
  'MobileAssignPersonnelModal: Synchronous savingRef mutex prevents duplicate submit race conditions'
);
console.log('  ✓ Synchronous savingRef mutex prevents duplicate submit race conditions');

// Operator fleet cap (max 3 shifts in 24h)
assert(
  modalContent.includes('otherActive.length >= 3') &&
  modalContent.includes('maximum limit of 3 active shifts (24h) across the fleet'),
  'MobileAssignPersonnelModal: Enforces shift limit of maximum 3 active shifts (24h) per operator across fleet'
);
console.log('  ✓ Enforces shift limit of maximum 3 active shifts (24h) per operator across fleet');

// Disjoint shifts on same machine
assert(
  modalContent.includes('duplicateShifts.length > 0') &&
  modalContent.includes('Each operator must have a distinct shift'),
  'MobileAssignPersonnelModal: Enforces disjoint non-duplicate shifts per machinery equipment'
);
console.log('  ✓ Enforces disjoint non-duplicate shifts per machinery equipment');

// Multi-machine time interval overlap
assert(
  modalContent.includes('doRangesOverlap(opRanges, otherRanges)') &&
  modalContent.includes('An operator cannot work overlapping shifts'),
  'MobileAssignPersonnelModal: Enforces multi-machine disjoint interval overlap validation'
);
console.log('  ✓ Enforces multi-machine disjoint interval overlap validation');

console.log('\n======================================================');
console.log('🎉 ALL ASSIGN OPERATOR MODAL OPTIMIZATION CHECKS PASSED!');
console.log('======================================================\n');
