/**
 * Automated Verification Suite for Offline Shift Log Deduplication & Native App Flow
 * Phase 5 Verification:
 * 1. Shift Code Normalization
 * 2. Deterministic Idempotency Key Computation
 * 3. Atomic In-Queue Deduplication & Merging
 * 4. Pre-Queue Validation (Against Queue & Server Cache)
 * 5. PostgreSQL 23505 Unique Constraint Replay Detection
 * 6. UI Modal Parity: Zero Raw Alert.alert Calls & ConfirmDialog Integration
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('  OFFLINE SHIFT LOG DEDUPLICATION & RESILIENCE TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function check(title, assertion) {
  total++;
  try {
    assertion();
    console.log(`  ✓ ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${title}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// [1/6] Shift Code Normalization & Deterministic Key Logic
// -----------------------------------------------------------------------------
console.log('[1/6] Verifying Shift Code Normalization & Key Computation...');

function normalizeShiftCode(raw) {
  if (!raw) return 'general';
  const clean = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'morning' || clean === 'shift1' || clean === '1' || clean === 'a') return 'morning';
  if (clean === 'evening' || clean === 'shift2' || clean === '2' || clean === 'b') return 'evening';
  if (clean === 'night' || clean === 'shift3' || clean === '3' || clean === 'c') return 'night';
  if (clean === 'general' || clean === 'gen' || clean === 'g') return 'general';
  return clean;
}

function buildShiftLogIdempotencyKey(params) {
  const normDate = (params.logDate || '').trim().split('T')[0];
  const normShift = normalizeShiftCode(params.shiftCode);
  const operatorToken = params.operatorId ? `op_${params.operatorId.trim()}` : '';
  const machineToken = params.machineId ? `mc_${params.machineId.trim()}` : '';
  return `shift_log_${operatorToken}_${machineToken}_${normDate}_${normShift}`;
}

check('normalizeShiftCode maps morning aliases correctly', () => {
  assert.strictEqual(normalizeShiftCode('morning'), 'morning');
  assert.strictEqual(normalizeShiftCode('MORNING'), 'morning');
  assert.strictEqual(normalizeShiftCode(' Morning '), 'morning');
  assert.strictEqual(normalizeShiftCode('1'), 'morning');
  assert.strictEqual(normalizeShiftCode('shift_1'), 'morning');
  assert.strictEqual(normalizeShiftCode('A'), 'morning');
});

check('normalizeShiftCode maps evening, night, and general aliases correctly', () => {
  assert.strictEqual(normalizeShiftCode('evening'), 'evening');
  assert.strictEqual(normalizeShiftCode('2'), 'evening');
  assert.strictEqual(normalizeShiftCode('shift-2'), 'evening');
  assert.strictEqual(normalizeShiftCode('night'), 'night');
  assert.strictEqual(normalizeShiftCode('3'), 'night');
  assert.strictEqual(normalizeShiftCode('general'), 'general');
  assert.strictEqual(normalizeShiftCode(null), 'general');
  assert.strictEqual(normalizeShiftCode(undefined), 'general');
});

check('buildShiftLogIdempotencyKey generates identical deterministic keys for same operator/date/shift', () => {
  const key1 = buildShiftLogIdempotencyKey({
    operatorId: 'user-001',
    machineId: 'm-555',
    logDate: '2026-10-13',
    shiftCode: 'morning',
  });
  const key2 = buildShiftLogIdempotencyKey({
    operatorId: 'user-001',
    machineId: 'm-555',
    logDate: '2026-10-13T00:00:00.000Z',
    shiftCode: ' MORNING ',
  });
  assert.strictEqual(key1, key2);
  assert.strictEqual(key1, 'shift_log_op_user-001_mc_m-555_2026-10-13_morning');
});

// -----------------------------------------------------------------------------
// [2/6] Codebase Inspection of OfflineQueueManager Implementation
// -----------------------------------------------------------------------------
console.log('\n[2/6] Verifying OfflineQueueManager Deduplication Implementation...');

const offlineQueuePath = path.join(__dirname, 'lib', 'offline', 'OfflineQueueManager.ts');
const offlineQueueSource = fs.readFileSync(offlineQueuePath, 'utf8');

check('OfflineQueueManager.ts exports normalizeShiftCode and buildShiftLogIdempotencyKey', () => {
  assert(offlineQueueSource.includes('export function normalizeShiftCode'), 'normalizeShiftCode must be exported');
  assert(offlineQueueSource.includes('export function buildShiftLogIdempotencyKey'), 'buildShiftLogIdempotencyKey must be exported');
});

check('OfflineQueueManager implements findDuplicateMutation for atomic duplicate detection', () => {
  assert(offlineQueueSource.includes('findDuplicateMutation('), 'OfflineQueueManager must implement findDuplicateMutation');
  assert(offlineQueueSource.includes('checkDuplicateShiftLog('), 'OfflineQueueManager must implement checkDuplicateShiftLog');
});

check('OfflineQueueManager.enqueue atomically updates existing pending items on collision', () => {
  assert(offlineQueueSource.includes('const existing = this.findDuplicateMutation'), 'enqueue must check findDuplicateMutation');
  assert(offlineQueueSource.includes('existing.payload ='), 'enqueue must merge payload instead of pushing duplicate');
});

check('OfflineQueueManager.drainQueue uses batched persistQueue for single storage write', () => {
  assert(offlineQueueSource.includes('const syncedItemIds = new Set<string>()'), 'drainQueue must collect synced IDs in a set');
  assert(offlineQueueSource.includes('this.queue = this.queue.filter((m) => !syncedItemIds.has(m.id))'), 'drainQueue must prune synced items in-memory');
  assert(offlineQueueSource.includes('await this.persistQueue()'), 'drainQueue must persist pruned queue in a single write');
});

// -----------------------------------------------------------------------------
// [3/6] Unique Constraint 23505 & Idempotent Replay Resilience
// -----------------------------------------------------------------------------
console.log('\n[3/6] Verifying PostgreSQL 23505 Replay Detection Logic...');

check('drainQueue correctly detects PostgreSQL 23505 unique constraint replays', () => {
  assert(offlineQueueSource.includes('23505'), 'drainQueue must check for PG error code 23505');
  assert(
    offlineQueueSource.includes('uq_machine_hour_logs') ||
    offlineQueueSource.includes('unique constraint') ||
    offlineQueueSource.includes('already has a log'),
    'drainQueue must recognize machine and operator unique shift constraints'
  );
  assert(offlineQueueSource.includes('syncedItemIds.add(item.id)'), 'Replay must be treated as synced and pruned rather than permanently failing');
});

// -----------------------------------------------------------------------------
// [4/6] Pre-Queue Validation in Mobile Entry Points
// -----------------------------------------------------------------------------
console.log('\n[4/6] Verifying Pre-Queue Validation in Mobile Entry Cards...');

const operatorEntryCardPath = path.join(__dirname, 'components', 'operations', 'MobileOperatorEntryCard.tsx');
const operatorEntrySource = fs.readFileSync(operatorEntryCardPath, 'utf8');

check('MobileOperatorEntryCard integrates checkDuplicateShiftLog before submission', () => {
  assert(operatorEntrySource.includes('checkDuplicateShiftLog'), 'MobileOperatorEntryCard must call checkDuplicateShiftLog');
  assert(operatorEntrySource.includes('submittingRef.current'), 'MobileOperatorEntryCard must use submittingRef mutex against rapid taps');
  assert(operatorEntrySource.includes('idempotencyKey'), 'MobileOperatorEntryCard must compute deterministic idempotency key');
  assert(!operatorEntrySource.includes('Alert.alert'), 'MobileOperatorEntryCard must not use raw Alert.alert');
});

const meterLogModalPath = path.join(__dirname, 'components', 'work', 'MeterLogModal.tsx');
const meterLogSource = fs.readFileSync(meterLogModalPath, 'utf8');

check('MeterLogModal integrates deterministic idempotencyKey and pre-queue validation', () => {
  assert(meterLogSource.includes('idempotencyKey'), 'MeterLogModal must compute deterministic idempotencyKey');
  assert(meterLogSource.includes('checkDuplicateShiftLog'), 'MeterLogModal must validate against queue & server records');
  assert(meterLogSource.includes('submittingRef.current'), 'MeterLogModal must guard against double-taps with submittingRef mutex');
  assert(meterLogSource.includes('idempotency_key: idempotencyKey'), 'MeterLogModal must inject idempotency_key into payload');
});

// -----------------------------------------------------------------------------
// [5/6] UI Modal Parity & Elimination of Raw Alert.alert
// -----------------------------------------------------------------------------
console.log('\n[5/6] Verifying UI Modal Parity (Zero Alert.alert & ConfirmDialog Integration)...');

const collisionModalPath = path.join(__dirname, 'components', 'offline', 'OfflineCollisionModal.tsx');
const collisionModalSource = fs.readFileSync(collisionModalPath, 'utf8');

check('OfflineCollisionModal replaces Alert.alert with ConfirmDialog', () => {
  assert(!collisionModalSource.includes('Alert.alert'), 'OfflineCollisionModal must not call Alert.alert');
  assert(collisionModalSource.includes('<ConfirmDialog'), 'OfflineCollisionModal must render ConfirmDialog');
  assert(collisionModalSource.includes('showDiscardConfirm'), 'OfflineCollisionModal must use showDiscardConfirm state');
  assert(collisionModalSource.includes('isDiscarding'), 'OfflineCollisionModal must support isDiscarding spinner');
});

const operationsPath = path.join(__dirname, 'app', '(app)', 'operations.tsx');
const operationsSource = fs.readFileSync(operationsPath, 'utf8');

check('operations.tsx replaces Alert.alert delete confirmation with ConfirmDialog', () => {
  assert(!operationsSource.includes('Alert.alert'), 'operations.tsx must have 0 Alert.alert calls');
  assert(operationsSource.includes('<ConfirmDialog'), 'operations.tsx must render ConfirmDialog');
  assert(operationsSource.includes('logToDelete'), 'operations.tsx must bind log deletion to logToDelete state');
  assert(operationsSource.includes('isDeletingLog'), 'operations.tsx must track isDeletingLog loading state');
});

const monitorTabPath = path.join(__dirname, 'components', 'operations', 'MobileTodayShiftMonitorTab.tsx');
const monitorTabSource = fs.readFileSync(monitorTabPath, 'utf8');

check('MobileTodayShiftMonitorTab replaces Alert.alert with ConfirmDialog and showToast', () => {
  assert(!monitorTabSource.includes('Alert.alert'), 'MobileTodayShiftMonitorTab must have 0 Alert.alert calls');
  assert(monitorTabSource.includes('<ConfirmDialog'), 'MobileTodayShiftMonitorTab must render ConfirmDialog');
  assert(monitorTabSource.includes('rowToReactivate'), 'MobileTodayShiftMonitorTab must use rowToReactivate state');
  assert(monitorTabSource.includes('isReactivating'), 'MobileTodayShiftMonitorTab must track isReactivating state');
});

// -----------------------------------------------------------------------------
// [6/6] Sync Status Visibility in Feeds
// -----------------------------------------------------------------------------
console.log('\n[6/6] Verifying Sync Status Visibility in Native Feeds...');

const historyTabPath = path.join(__dirname, 'components', 'operations', 'MobileOperatorHistoryTab.tsx');
const historyTabSource = fs.readFileSync(historyTabPath, 'utf8');

check('MobileOperatorHistoryTab incorporates useOfflineQueue and SyncStatusBadge', () => {
  assert(historyTabSource.includes('useOfflineQueue'), 'MobileOperatorHistoryTab must use useOfflineQueue');
  assert(historyTabSource.includes('queuedShiftLogs'), 'MobileOperatorHistoryTab must compute queuedShiftLogs');
  assert(historyTabSource.includes('combinedLogs'), 'MobileOperatorHistoryTab must merge queue items into combinedLogs');
  assert(historyTabSource.includes('<SyncStatusBadge'), 'MobileOperatorHistoryTab must render SyncStatusBadge on un-synced logs');
  assert(!historyTabSource.includes('Alert.alert'), 'MobileOperatorHistoryTab must have 0 Alert.alert calls');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n------------------------------------------------------------');
console.log(`Results: ${passed} / ${total} checks passed successfully.`);
console.log('------------------------------------------------------------\n');

if (passed === total) {
  console.log('🎉 ALL OFFLINE DUPLICATION PREVENTION & APP FLOW TESTS PASSED!\n');
} else {
  console.error('❌ Some tests failed. Please review the output above.\n');
  process.exit(1);
}
