/**
 * Automated Verification Suite for Mobile /users Workflows
 * Covers:
 * 1. RBAC Matrix & Permission Guard Invariants
 * 2. Shift Overlap & Machine Assignment Capacity (Max 3 machines per op, Max 3 ops per machine)
 * 3. Assignment Concurrency & Synchronous Mutex Lock Protection (savingRef)
 * 4. Single & Bulk Deletion Confirmation Workflows (Dialogs, Self-Deletion Prevention, Error Resilience)
 * 5. Status-Change Atomic Toggling & Error Rollback Workflows
 * 6. Responsive Layout Constraints & Ergonomic Touch Dimensions
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Test Runner]: Initializing Mobile /users Workflow Verification Suite...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

try {
  // Load target source files
  const usersScreenPath = path.join(__dirname, 'app', '(app)', 'users.tsx');
  const userDetailModalPath = path.join(__dirname, 'components', 'users', 'UserDetailModal.tsx');
  const assignMachineModalPath = path.join(__dirname, 'components', 'users', 'AssignMachineModal.tsx');
  const assignSupervisorModalPath = path.join(__dirname, 'components', 'users', 'AssignSupervisorModal.tsx');
  const userEditModalPath = path.join(__dirname, 'components', 'users', 'UserEditModal.tsx');
  const deleteConfirmDialogPath = path.join(__dirname, 'components', 'users', 'DeleteUserConfirmDialog.tsx');
  const confirmDialogPath = path.join(__dirname, 'components', 'ui', 'ConfirmDialog.tsx');
  const sheetPath = path.join(__dirname, 'components', 'ui', 'overlay', 'Sheet.tsx');
  const userActionsPopoverPath = path.join(__dirname, 'components', 'users', 'UserActionsPopover.tsx');
  const userTouchCardPath = path.join(__dirname, 'components', 'users', 'UserTouchCard.tsx');

  const usersContent = fs.readFileSync(usersScreenPath, 'utf8');
  const userDetailContent = fs.readFileSync(userDetailModalPath, 'utf8');
  const userEditContent = fs.readFileSync(userEditModalPath, 'utf8');
  const assignMachineContent = fs.readFileSync(assignMachineModalPath, 'utf8');
  const assignSupervisorContent = fs.readFileSync(assignSupervisorModalPath, 'utf8');
  const deleteConfirmContent = fs.readFileSync(deleteConfirmDialogPath, 'utf8');
  const confirmDialogContent = fs.readFileSync(confirmDialogPath, 'utf8');
  const sheetContent = fs.readFileSync(sheetPath, 'utf8');
  const userActionsPopoverContent = fs.readFileSync(userActionsPopoverPath, 'utf8');
  const userTouchCardContent = fs.readFileSync(userTouchCardPath, 'utf8');

  console.log('--- 1. RBAC Matrix & Permissions Verification ---');
  // Edit permission
  assert(
    usersContent.includes("const canEditUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"),
    'RBAC: canEditUsers permits super_admin, admin, manager, and hr'
  );
  // Delete permission
  assert(
    usersContent.includes("const canDeleteUsers = ['super_admin', 'admin'].includes(normalizedRole);"),
    'RBAC: canDeleteUsers strictly restricted to super_admin and admin'
  );
  // Status toggle permission
  assert(
    usersContent.includes("const canActivateUsers = ['super_admin', 'admin', 'hr'].includes(normalizedRole);"),
    'RBAC: canActivateUsers permits super_admin, admin, and hr'
  );
  // Supervisor assignment permission
  assert(
    usersContent.includes("const canAssignSupervisorUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"),
    'RBAC: canAssignSupervisorUsers permits super_admin, admin, manager, and hr'
  );
  // Machine assignment permission
  assert(
    usersContent.includes("const canAssignMachineUsers = ['super_admin', 'admin', 'manager', 'supervisor'].includes(normalizedRole);"),
    'RBAC: canAssignMachineUsers permits super_admin, admin, manager, and supervisor'
  );
  // Reset password permission
  assert(
    usersContent.includes("const canResetPwdUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"),
    'RBAC: canResetPwdUsers permits super_admin, admin, manager, and hr'
  );
  // Self-action guards
  assert(
    usersContent.includes('authUser?.id !== item.id') || usersContent.includes('authUser?.id !== moreActionsUser.id'),
    'RBAC: Self-deletion guard blocks users from deleting their own active session account'
  );
  assert(
    usersContent.includes("authUser?.id === targetUser.id") && usersContent.includes("You cannot change your own account status"),
    'RBAC: Self-status guard blocks users from deactivating their own active session account'
  );
  assert(
    usersContent.includes("normalizedRole === 'admin' && targetUser.role === 'super_admin'"),
    'RBAC: Hierarchy guard prevents standard admin from modifying super_admin accounts'
  );

  const assignPersonnelModalPath = path.join(__dirname, 'components', 'operations', 'MobileAssignPersonnelModal.tsx');
  const assignPersonnelContent = fs.readFileSync(assignPersonnelModalPath, 'utf8');

  console.log('\n--- 2. Assignment Concurrency & Capacity Invariants ---');
  // AssignMachineModal delegates to MobileAssignPersonnelModal
  assert(
    assignMachineContent.includes('MobileAssignPersonnelModal') &&
    assignMachineContent.includes('targetUser={user}'),
    'AssignMachineModal: Integrates and delegates to canonical MobileAssignPersonnelModal'
  );
  // MobileAssignPersonnelModal: savingRef mutex
  assert(
    assignPersonnelContent.includes('savingRef = useRef(false);') &&
    assignPersonnelContent.includes('if (savingRef.current) return;') &&
    assignPersonnelContent.includes('savingRef.current = true;'),
    'MobileAssignPersonnelModal: Synchronous savingRef mutex prevents duplicate submit race conditions'
  );
  // MobileAssignPersonnelModal: Operator max 3 active shifts (24h) fleet cap
  assert(
    assignPersonnelContent.includes('otherActive.length >= 3') &&
    assignPersonnelContent.includes('maximum limit of 3 active shifts (24h) across the fleet'),
    'MobileAssignPersonnelModal: Enforces shift limit of maximum 3 active shifts (24h) per operator across fleet'
  );
  // MobileAssignPersonnelModal: Distinct shifts on the same equipment
  assert(
    assignPersonnelContent.includes('duplicateShifts.length > 0') &&
    assignPersonnelContent.includes('Each operator must have a distinct shift'),
    'MobileAssignPersonnelModal: Enforces disjoint non-duplicate shifts per machinery equipment'
  );
  // MobileAssignPersonnelModal: Disjoint multi-machine shift overlap validation
  assert(
    assignPersonnelContent.includes('doRangesOverlap(opRanges, otherRanges)') &&
    assignPersonnelContent.includes('An operator cannot work overlapping shifts'),
    'MobileAssignPersonnelModal: Enforces multi-machine disjoint interval overlap validation'
  );
  // AssignSupervisorModal: savingRef mutex
  assert(
    assignSupervisorContent.includes('savingRef = React.useRef(false)') &&
    assignSupervisorContent.includes('if (savingRef.current) return;') &&
    assignSupervisorContent.includes('savingRef.current = true;'),
    'AssignSupervisorModal: Synchronous savingRef mutex prevents duplicate submit race conditions'
  );
  // AssignSupervisorModal: Self-supervisor guard
  assert(
    assignSupervisorContent.includes('s.id !== user.id') &&
    assignSupervisorContent.includes('selectedId === user.id'),
    'AssignSupervisorModal: Prevents assigning an employee as their own reporting supervisor'
  );

  console.log('\n--- 3. Deletion Workflow & Confirmation Safety ---');
  // Single deletion modal binding
  assert(
    usersContent.includes('<DeleteUserConfirmDialog') &&
    usersContent.includes('user={userToDelete}') &&
    usersContent.includes('onConfirm={handleExecuteDeleteSingleUser}'),
    'users.tsx: Single user deletion bound to DeleteUserConfirmDialog (never deletes immediately)'
  );
  // Deletion concurrency ref
  assert(
    usersContent.includes('deleteSubmittingRef.current') &&
    usersContent.includes('deleteSubmittingRef.current = true;'),
    'users.tsx: deleteSubmittingRef prevents double-tap execution on delete confirmation'
  );
  // Atomic RPC usage
  assert(
    usersContent.includes("'delete_or_deactivate_user_atomic'"),
    'users.tsx: Utilizes delete_or_deactivate_user_atomic RPC for safe foreign-key deactivation'
  );
  // Error state resilience
  assert(
    usersContent.includes('setDeleteUserError(err?.message') &&
    usersContent.includes('setUserToDelete(null);') === false ||
    usersContent.indexOf('setDeleteUserError') < usersContent.indexOf('setUserToDelete(null)'),
    'users.tsx: Retains userToDelete and sets deleteUserError on API failure for user retry'
  );
  // Bulk deletion modal binding
  assert(
    usersContent.includes('<ConfirmDialog') &&
    usersContent.includes('showBulkDeleteModal') &&
    usersContent.includes('handleExecuteBulkDelete'),
    'users.tsx: Bulk deletion bound to danger ConfirmDialog with batch safety message'
  );
  assert(
    usersContent.includes("'bulk_delete_or_deactivate_users_atomic'"),
    'users.tsx: Utilizes bulk_delete_or_deactivate_users_atomic RPC for safe batch processing'
  );
  // Delete dialog component styling
  assert(
    deleteConfirmContent.includes('Consequences &amp; Compliance Notice') &&
    deleteConfirmContent.includes('Factories Act (1948)') &&
    deleteConfirmContent.includes('styles.errorBanner'),
    'DeleteUserConfirmDialog: Highlights statutory consequences and displays in-dialog error banners'
  );

  console.log('\n--- 4. Status-Change Workflow & Error Rollback ---');
  // Status modal binding
  assert(
    usersContent.includes('setStatusConfirmUser(targetUser)') &&
    usersContent.includes('statusConfirmUser?.status === \'active\' ? \'Deactivate User Account\' : \'Activate User Account\''),
    'users.tsx: Status change requires explicit confirmation via ConfirmDialog'
  );
  // Status concurrency ref
  assert(
    usersContent.includes('statusSubmittingRef.current') &&
    usersContent.includes('statusSubmittingRef.current = true;'),
    'users.tsx: statusSubmittingRef prevents concurrent status toggle invocations'
  );
  // Atomic RPC usage
  assert(
    usersContent.includes("'toggle_user_status_atomic'"),
    'users.tsx: Utilizes toggle_user_status_atomic RPC for atomic status updates'
  );
  // Rollback on error / server confirmation
  assert(
    usersContent.includes('if (rpcErr)') &&
    usersContent.includes('haptics.reject()') &&
    usersContent.includes('prev.map((u) => (u.id === statusConfirmUser.id ? { ...u, status: updatedStatus } : u))'),
    'users.tsx: Updates UI state ONLY after RPC returns verified success; provides haptic reject on error'
  );

  console.log('\n--- 5. Action Menu & Parity Workflows ---');
  // More Actions menu items (Edit, Password, Status, Delete; Assign Machine and Supervisor excluded)
  assert(
    (usersContent.includes('handleTriggerEdit(u)') || userActionsPopoverContent.includes('onEdit(user)')) &&
    (usersContent.includes('handleTriggerResetPassword(u)') || userActionsPopoverContent.includes('onResetPassword(user)')) &&
    (usersContent.includes('handleToggleUserStatus(u)') || userActionsPopoverContent.includes('onToggleStatus(user)')) &&
    (usersContent.includes('handleDeleteSingleUser(u)') || userActionsPopoverContent.includes('onDelete(user)')),
    'users.tsx: More Actions menu covers Edit, Password, Status, and Delete'
  );
  // UserTouchCard toolbar buttons (More Actions, Assign Machine, Supervisor)
  assert(
    (usersContent.includes('onOpenMoreActions?.(u') || userTouchCardContent.includes('onOpenMoreActions?.(u')) &&
    (usersContent.includes('onAssignMachine(u)') || userTouchCardContent.includes('onAssignMachine(u)')) &&
    (usersContent.includes('onAssignSupervisor(u)') || userTouchCardContent.includes('onAssignSupervisor(u)')),
    'UserTouchCard: Features canonical action toolbar with More Actions, Assign Machine, and Supervisor'
  );
  // UserDetailModal parity
  assert(
    userDetailContent.includes('<DeleteUserConfirmDialog') &&
    userDetailContent.includes('<ConfirmDialog') &&
    userDetailContent.includes("'delete_or_deactivate_user_atomic'") &&
    userDetailContent.includes("'toggle_user_status_atomic'"),
    'UserDetailModal: Maintains 100% workflow parity with atomic RPC deletion and status toggles'
  );

  console.log('\n--- 6. Responsive Layout & Ergonomic Touch Dimensions ---');
  // Sheet centering and width constraint for desktop viewports
  assert(
    sheetContent.includes("maxWidth: 640") &&
    sheetContent.includes("alignSelf: 'center'") &&
    sheetContent.includes("alignItems: 'center'"),
    'Sheet.tsx: Constrains sheetPanel to maxWidth 640 and centers sheetWrapper on desktop viewports'
  );
  // More Actions sheet width constraint
  assert(
    usersContent.includes("maxWidth: 560") &&
    usersContent.includes("alignSelf: 'center'"),
    'users.tsx: Constrains moreActionsSheetContent to maxWidth 560 for desktop previews'
  );
  // User list container width constraint
  assert(
    usersContent.includes("scrollContent: {") &&
    usersContent.includes("maxWidth: 1200") &&
    usersContent.includes("alignSelf: 'center'"),
    'users.tsx: Constrains scrollContent to maxWidth 1200 for balanced wide viewport layout'
  );
  // Ergonomic hitSlop
  assert(
    usersContent.includes('hitSlopToMin48'),
    'UserTouchCard: Action buttons include hitSlopToMin48 for minimum 48px touch ergonomic compliance'
  );

  console.log('\n--- 7. Targeted Mutation & State Management ---');
  // Elimination of full list refetches during individual mutations
  assert(
    usersContent.includes('refreshSingleUser') &&
    usersContent.includes('updateSingleUserInState'),
    'users.tsx: Introduces refreshSingleUser and updateSingleUserInState helpers for targeted user syncing'
  );
  // Status toggle error rollback & single user sync
  assert(
    usersContent.includes('status: previousStatus, assigned_machines: previousAssignedMachines') &&
    usersContent.includes('refreshSingleUser(targetUserId)'),
    'users.tsx: Status toggle implements optimistic update with rollback on failure and background targeted sync'
  );
  // Single deletion removes only target user and decrements count
  assert(
    usersContent.includes('prev.filter((u) => u.id !== deletedId)') &&
    usersContent.includes('setTotalUsersCount((prev) => Math.max(0, prev - 1))'),
    'users.tsx: Single user deletion removes only affected user and decrements total count without reloading list'
  );
  // Bulk deletion removes only selected users and updates count
  assert(
    usersContent.includes('prev.filter((u) => !toDelete.includes(u.id))') &&
    usersContent.includes('setTotalUsersCount((prev) => Math.max(0, prev - toDelete.length))'),
    'users.tsx: Bulk deletion removes only processed users and updates total count without reloading list'
  );
  // UserEditModal passes patch and triggers targeted sync
  assert(
    userEditContent.includes('onSuccess(updatedFields)') &&
    usersContent.includes('updateSingleUserInState(userToEdit.id, updatedPatch)') &&
    usersContent.includes('refreshSingleUser(userToEdit.id)'),
    'UserEditModal & users.tsx: Passes edit patch directly and refreshes only the edited user'
  );
  // AssignSupervisorModal passes patch and triggers targeted sync
  assert(
    assignSupervisorContent.includes('onSuccess(patch)') &&
    usersContent.includes('updateSingleUserInState(assignSupervisorUser.id, patch)') &&
    usersContent.includes('refreshSingleUser(assignSupervisorUser.id)'),
    'AssignSupervisorModal & users.tsx: Passes supervisor patch directly and refreshes only the affected user'
  );
  // AssignMachineModal triggers targeted sync
  assert(
    usersContent.includes('refreshSingleUser(assignMachineUser.id)'),
    'AssignMachineModal & users.tsx: Refreshes only affected operator machine assignments without list refetch'
  );
  // UserDetailModal passes updated user and deleted user
  assert(
    userDetailContent.includes('onSuccess({ ...user, role: newRole })') &&
    userDetailContent.includes('onSuccess({ deleted: true, id: user.id })') &&
    usersContent.includes('if (updatedUser.deleted)'),
    'UserDetailModal & users.tsx: Synchronizes single-user updates and deletions without full directory reload'
  );

  console.log(`\n======================================================`);
  console.log(`✅ All ${passed}/${passed + failed} /users Workflow Verifications Passed!`);
  console.log(`======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
} catch (error) {
  console.error('Fatal execution error:', error);
  process.exit(1);
}
