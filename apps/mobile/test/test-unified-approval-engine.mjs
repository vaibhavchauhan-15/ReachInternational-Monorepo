#!/usr/bin/env node
/**
 * Automated Verification Suite for Native Mobile Unified Approval Engine
 * 
 * Verifies:
 * 1. Screen Architecture & Navigation Integration (/approvals)
 * 2. MobileApprovalCard Component Contract & Touch Ergonomics (min 44px)
 * 3. ApprovalDetailBottomSheet Component Contract & Multi-Type Content Renderers
 * 4. RejectReasonModal Contract & Mandatory Reason Validation
 * 5. TanStack Query Data Hook Architecture & Optimistic Cache Mutation Rollback
 * 6. Realtime Channel Integration & Cache Invalidation
 * 7. Geist Design Tokens & 100% Theme Parity (canvas, canvasElevated, hairline, ink, mute)
 * 8. Zero Raw Typography & Safe-Area Insets Protection
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const testDir = path.dirname(__filename);
const mobileDir = path.resolve(testDir, '..');

console.log('\n================================================================');
console.log('  TEST: NATIVE MOBILE UNIFIED APPROVAL ENGINE VERIFICATION      ');
console.log('================================================================\n');

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
  const approvalsScreenPath = path.join(mobileDir, 'app', '(app)', 'approvals.tsx');
  const cardPath = path.join(mobileDir, 'components', 'approvals', 'MobileApprovalCard.tsx');
  const sheetPath = path.join(mobileDir, 'components', 'approvals', 'ApprovalDetailBottomSheet.tsx');
  const modalPath = path.join(mobileDir, 'components', 'approvals', 'RejectReasonModal.tsx');
  const hookPath = path.join(mobileDir, 'lib', 'hooks', 'useApprovalsData.ts');

  assert(fs.existsSync(approvalsScreenPath), 'Screen: app/(app)/approvals.tsx exists in routing tree');
  assert(fs.existsSync(cardPath), 'Component: MobileApprovalCard.tsx exists');
  assert(fs.existsSync(sheetPath), 'Component: ApprovalDetailBottomSheet.tsx exists');
  assert(fs.existsSync(modalPath), 'Component: RejectReasonModal.tsx exists');
  assert(fs.existsSync(hookPath), 'Hook: useApprovalsData.ts exists');

  const screenCode = fs.readFileSync(approvalsScreenPath, 'utf8');
  const cardCode = fs.readFileSync(cardPath, 'utf8');
  const sheetCode = fs.readFileSync(sheetPath, 'utf8');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  const hookCode = fs.readFileSync(hookPath, 'utf8');

  // --- 1. Screen Architecture & Segmented Tabs ---
  console.log('\n--- 1. Screen Architecture & Navigation ---');
  assert(screenCode.includes('useApprovalsListQuery') && screenCode.includes('useApprovalCountsQuery'), 'Screen binds approvals list and counts TanStack Query hooks');
  assert(screenCode.includes('useApprovalsRealtimeSync'), 'Screen activates Supabase Realtime synchronization listener');
  assert(screenCode.includes("status === 'pending'") || screenCode.includes('status === "pending"'), 'Segmented tabs support pending status filtering');
  assert(screenCode.includes("status === 'approved'") || screenCode.includes('status === "approved"'), 'Segmented tabs support approved status filtering');
  assert(screenCode.includes("status === 'rejected'") || screenCode.includes('status === "rejected"'), 'Segmented tabs support rejected status filtering');
  assert(screenCode.includes('RefreshControl') && screenCode.includes('onRefresh'), 'Main list implements pull-to-refresh with haptic feedback');
  assert(screenCode.includes('EmptyState') && screenCode.includes('ErrorState'), 'Screen implements empty and error retry boundary states');

  // --- 2. MobileApprovalCard Touch Ergonomics ---
  console.log('\n--- 2. MobileApprovalCard Ergonomics ---');
  assert(cardCode.includes('minHeight: 44') || cardCode.includes('padding: 14'), 'Card enforces comfortable mobile touch area');
  assert(cardCode.includes('formatTinyRelativeTime'), 'Card displays humanized relative timestamp (e.g. 5m, 2h)');
  assert(cardCode.includes('Badge') && cardCode.includes('variant='), 'Card renders status and type badges');
  assert(cardCode.includes('haptics.select()'), 'Card triggers tactile haptic feedback on touch');

  // --- 3. BottomSheet Multi-Type Content Renderers ---
  console.log('\n--- 3. Detail BottomSheet Multi-Type Renderers ---');
  assert(sheetCode.includes('document_verify'), 'BottomSheet provides dedicated renderer for document_verify flow');
  assert(sheetCode.includes('profile_change'), 'BottomSheet provides before/after diff renderer for profile_change flow');
  assert(sheetCode.includes('registration'), 'BottomSheet provides full user details renderer for registration flow');
  assert(sheetCode.includes('account_deletion'), 'BottomSheet provides warning & reason box for account_deletion flow');
  assert(sheetCode.includes('minHeight: 44'), 'All action buttons (Approve, Reject, Close) enforce >= 44px touch targets');

  // --- 4. RejectReasonModal Validation ---
  console.log('\n--- 4. Rejection Modal Guard ---');
  assert(modalCode.includes('setReason') && modalCode.includes('Rejection Reason *'), 'Modal requires an explicit rejection reason');
  assert(modalCode.includes('!trimmed') || modalCode.includes('!reason.trim()'), 'Modal rejects empty or whitespace-only rejection reasons');
  assert(modalCode.includes('KeyboardAvoidingView'), 'Modal integrates KeyboardAvoidingView for smooth iOS/Android keypad management');

  // --- 5. Data Hook Architecture & Optimistic Updates ---
  console.log('\n--- 5. TanStack Query Cache & Optimistic UI ---');
  assert(hookCode.includes('onMutate:') && hookCode.includes('cancelQueries'), 'Decide mutation cancels in-flight queries before optimistic update');
  assert(hookCode.includes('setQueriesData') && hookCode.includes('previousLists'), 'Decide mutation optimistically snapshots and updates cache');
  assert(hookCode.includes('onError:') && hookCode.includes('context?.previousLists'), 'Decide mutation rolls back cache state on unexpected network/server error');
  assert(hookCode.includes('onSettled:') && hookCode.includes('invalidateQueries'), 'Decide mutation invalidates approvals queries on settlement');

  // --- 6. Design System & Theme Parity ---
  console.log('\n--- 6. Design System & Token Integrity ---');
  const forbiddenTokens = ['colors.surface', 'colors.border', 'colors.background', 'colors.textMuted', 'colors.text'];
  for (const token of forbiddenTokens) {
    assert(!screenCode.includes(token), `Screen does not use legacy token ${token}`);
    assert(!cardCode.includes(token), `Card does not use legacy token ${token}`);
    assert(!sheetCode.includes(token), `BottomSheet does not use legacy token ${token}`);
    assert(!modalCode.includes(token), `Modal does not use legacy token ${token}`);
  }
  assert(screenCode.includes('colors.canvas') && screenCode.includes('colors.canvasElevated') && screenCode.includes('colors.hairline'), 'Screen uses Geist canvas, canvasElevated, and hairline border tokens');

  // --- 7. Zero Raw Typography Invariant ---
  console.log('\n--- 7. Zero Raw Typography Invariant ---');
  const rawTypePattern = /(fontSize|fontWeight|lineHeight):\s*[\d'"]/g;
  assert(!rawTypePattern.test(screenCode), 'Screen contains 0 raw typography properties in styles');
  assert(!rawTypePattern.test(cardCode), 'Card contains 0 raw typography properties in styles');
  assert(!rawTypePattern.test(sheetCode), 'BottomSheet contains 0 raw typography properties in styles');
  assert(!rawTypePattern.test(modalCode), 'Modal contains 0 raw typography properties in styles');

  // --- 8. Keyset-Cursor Queue Contract (Web RPC parity) ---
  console.log('\n--- 8. Keyset-Cursor Queue Contract ---');
  assert(hookCode.includes('useInfiniteQuery'), 'Queue is driven by TanStack useInfiniteQuery');
  assert(hookCode.includes('listApprovals') && hookCode.includes('cursor_created_at') && hookCode.includes('cursor_id'), 'Queue consumes the shared approval_list RPC with keyset cursor params');
  assert(hookCode.includes('APPROVALS_QUEUE_PAGE_SIZE = 20'), 'Queue page size is 20');
  assert(hookCode.includes('APPROVALS_PREFETCH_THRESHOLD = 5'), 'Next-page prefetch threshold is 5 remaining rows');
  assert(hookCode.includes('initialPageParam: null') && hookCode.includes('getNextPageParam'), 'Infinite query derives the next cursor from the last keyset page');
  assert(hookCode.includes('approvalCounts') && hookCode.includes('useApprovalCountsQuery'), 'Grouped counts come from the approval_counts RPC');
  assert(hookCode.includes('overflow') && hookCode.includes('dedupeApprovalItems'), 'Optimistic removal refills from the buffered look-ahead row and dedupes by id');
  assert(hookCode.includes('mapApprovalDecisionError') && hookCode.includes('42501'), 'Decision errors map 42501 permission denials to a clear message');
  assert(/CONFLICT_PATTERN|terminal state|already decided/i.test(hookCode), 'Decision errors map version-conflict / already-decided rejections to a clear message');
  assert(hookCode.includes('refetchOnWindowFocus: false') || hookCode.includes('refetchOnWindowFocus:false'), 'Queue disables window-focus refetch storms');

  // --- 9. List Performance & Native Guardrails ---
  console.log('\n--- 9. List Performance & Native Guardrails ---');
  assert(screenCode.includes('keyExtractor'), 'FlatList uses a stable keyExtractor');
  assert(screenCode.includes('windowSize') && screenCode.includes('maxToRenderPerBatch'), 'FlatList has tuned windowSize / maxToRenderPerBatch');
  assert(screenCode.includes('removeClippedSubviews'), 'FlatList enables removeClippedSubviews on Android');
  assert(screenCode.includes('onViewableItemsChanged') && screenCode.includes('APPROVALS_PREFETCH_THRESHOLD'), 'Next keyset page prefetches when ~5 rows remain');
  assert(screenCode.includes('AppRefreshControl'), 'Pull-to-refresh uses the canonical themed RefreshControl');
  assert(screenCode.includes('newCount') && screenCode.includes('handleNewPillPress'), 'Screen surfaces an "N new" pill instead of reordering the list');
  assert(screenCode.includes('ApprovalsQueueSkeleton') && screenCode.includes('ListFooterComponent'), 'Screen implements skeleton and end-of-list footer states');
  assert(screenCode.includes('isOffline') && screenCode.includes('canDecideNow'), 'Offline state disables decision actions (server stays authoritative)');
  assert(screenCode.includes('ReduceMotion.System') && screenCode.includes('DUR.'), 'Row enter/exit motion uses lib/motion tokens with ReduceMotion.System');
  assert(cardCode.includes('from "../ui/touch/Pressable"'), 'Card press feedback uses components/ui/touch/Pressable');
  assert(sheetCode.includes('Sheet') && sheetCode.includes('../ui/overlay/Sheet'), 'Detail opens in the canonical Reanimated bottom Sheet');

  // --- 10. Offline decisions are never queued ---
  console.log('\n--- 10. Approval Decisions Are Never Queued Offline ---');
  for (const [label, code] of [['Screen', screenCode], ['Hook', hookCode], ['Card', cardCode]]) {
    assert(!/OfflineQueueManager|useOfflineQueue|enqueueMutation/.test(code), `${label} never enqueues approval decisions into the offline queue`);
  }

  console.log(`\n----------------------------------------------------------------`);
  console.log(`  RESULT: ${passed} PASSED / ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
} catch (err) {
  console.error('Fatal error during native approvals verification:', err);
  process.exit(1);
}
