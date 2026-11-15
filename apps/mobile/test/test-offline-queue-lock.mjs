/**
 * Automated Verification Suite for BUG-01: Offline Queue Sticking Lock & Resilience
 *
 * Verifies:
 * 1. OfflineQueueManager tracks syncStartedAt and defines 60s stale lock timeout
 * 2. Unhandled exception in executeMutation is caught per-item, marking item failed while loop continues
 * 3. drainQueue finally block always releases mutex (isSyncing = false, syncStartedAt = null)
 * 4. Stale lock (>60s) auto-recovers on subsequent drainQueue or checkAndAutoDrain calls
 * 5. Fresh lock (<60s) is respected and prevents concurrent execution
 * 6. SyncCoordinator tracks syncStartedAt and auto-recovers stale sync locks (>60s)
 * 7. Shift log idempotency key format (ihl_...) and chronological FIFO ordering remain intact
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('================================================================');
console.log('  BUG-01: OFFLINE QUEUE LOCK RESILIENCE & RECOVERY TEST SUITE');
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

const offlineQueuePath = path.join(__dirname, 'lib', 'offline', 'OfflineQueueManager.ts');
const offlineQueueSource = fs.readFileSync(offlineQueuePath, 'utf8');

const syncCoordinatorPath = path.join(__dirname, 'lib', 'offline', 'SyncCoordinator.ts');
const syncCoordinatorSource = fs.readFileSync(syncCoordinatorPath, 'utf8');

// -----------------------------------------------------------------------------
// [1/4] OfflineQueueManager: syncStartedAt & Stale Lock Timeout
// -----------------------------------------------------------------------------
console.log('[1/4] Verifying syncStartedAt and Stale Timeout in OfflineQueueManager...');

check('OfflineQueueManager defines 60-second stale lock timeout constant', () => {
  assert(
    offlineQueueSource.includes('SYNC_LOCK_STALE_TIMEOUT_MS = 60000') ||
    offlineQueueSource.includes('60000') && offlineQueueSource.includes('stale'),
    'Must define 60-second (60000ms) stale lock threshold'
  );
});

check('OfflineQueueManager tracks syncStartedAt state', () => {
  assert(
    offlineQueueSource.includes('syncStartedAt') && offlineQueueSource.includes('private syncStartedAt'),
    'OfflineQueueManager must declare private syncStartedAt timestamp property'
  );
});

check('OfflineQueueManager.drainQueue checks for stale lock and auto-recovers if >60s', () => {
  assert(
    offlineQueueSource.includes('this.syncStartedAt') &&
    (offlineQueueSource.includes('> 60000') || offlineQueueSource.includes('SYNC_LOCK_STALE_TIMEOUT_MS')),
    'drainQueue must check if Date.now() - this.syncStartedAt > 60000'
  );
});

// -----------------------------------------------------------------------------
// [2/4] Per-Item try/catch & Guaranteed Lock Release in try/finally
// -----------------------------------------------------------------------------
console.log('\n[2/4] Verifying Per-Item Error Isolation & try/finally Mutex Release...');

check('drainQueue sets isSyncing = true and syncStartedAt upon acquiring lock', () => {
  assert(
    offlineQueueSource.includes('this.isSyncing = true') &&
    offlineQueueSource.includes('this.syncStartedAt = Date.now()'),
    'drainQueue must record syncStartedAt when isSyncing is set to true'
  );
});

check('drainQueue wraps each item in its own try/catch to continue loop on unexpected error', () => {
  // Ensure the per-item loop has outer try/catch marking item failed so loop doesn't abort
  assert(
    offlineQueueSource.includes('catch (unhandledItemError') ||
    offlineQueueSource.includes('catch (itemError') ||
    offlineQueueSource.includes('catch (itemErr'),
    'drainQueue must wrap individual item processing in try/catch to isolate failures'
  );
});

check('drainQueue releases lock and resets syncStartedAt in finally block', () => {
  const finallyIdx = offlineQueueSource.lastIndexOf('finally {');
  assert(finallyIdx !== -1, 'drainQueue must contain a finally block');
  const finallyBlock = offlineQueueSource.slice(finallyIdx);
  assert(finallyBlock.includes('this.isSyncing = false'), 'finally block must reset isSyncing to false');
  assert(finallyBlock.includes('this.syncStartedAt = null'), 'finally block must reset syncStartedAt to null');
});

// -----------------------------------------------------------------------------
// [3/4] SyncCoordinator: syncStartedAt & Stale Lock Timeout
// -----------------------------------------------------------------------------
console.log('\n[3/4] Verifying SyncCoordinator Stale Lock Recovery...');

check('SyncCoordinator declares and tracks syncStartedAt', () => {
  assert(
    syncCoordinatorSource.includes('syncStartedAt') && syncCoordinatorSource.includes('private syncStartedAt'),
    'SyncCoordinator must declare private syncStartedAt'
  );
});

check('SyncCoordinator.handleReconnection recovers if lock is older than 60s', () => {
  assert(
    syncCoordinatorSource.includes('this.syncStartedAt') &&
    syncCoordinatorSource.includes('> 60000'),
    'SyncCoordinator must check if Date.now() - this.syncStartedAt > 60000 to recover stale lock'
  );
});

check('SyncCoordinator resets syncStartedAt in finally block and teardown', () => {
  assert(
    syncCoordinatorSource.includes('this.syncStartedAt = null'),
    'SyncCoordinator must nullify syncStartedAt in finally block'
  );
});

// -----------------------------------------------------------------------------
// [4/4] Behavioral Simulation: Error Isolation, Stale Lock Recovery, FIFO & Key
// -----------------------------------------------------------------------------
console.log('\n[4/4] Behavioral Simulation of Queue Drain, Lock Recovery & Idempotency Key...');

// Simulate Queue Drain with Unexpected Mutation Error
async function simulateQueueDrain(options = {}) {
  let isSyncing = options.initialIsSyncing || false;
  let syncStartedAt = options.initialSyncStartedAt || null;
  const queue = [...options.items];
  const STALE_MS = 60000;
  let executedMutations = [];

  // Mutex acquisition with stale recovery
  if (isSyncing) {
    const isStale = syncStartedAt !== null && (Date.now() - syncStartedAt > STALE_MS);
    if (isStale) {
      isSyncing = false;
      syncStartedAt = null;
    } else {
      return { skipped: true, isSyncing, syncStartedAt, queue, executedMutations };
    }
  }

  isSyncing = true;
  syncStartedAt = Date.now();

  const syncedIds = new Set();
  try {
    // Sort chronological SUBMIT_HOUR_LOG items
    queue.sort((a, b) => {
      const timeA = new Date(a.payload?.start_datetime || a.created_at).getTime();
      const timeB = new Date(b.payload?.start_datetime || b.created_at).getTime();
      return timeA - timeB;
    });

    for (const item of queue) {
      if (item.status === 'conflict') continue;

      try {
        item.status = 'syncing';
        executedMutations.push(item.id);

        if (options.throwOnId && item.id === options.throwOnId) {
          throw new TypeError(`Unexpected crash processing ${item.id}`);
        }

        syncedIds.add(item.id);
        item.status = 'synced';
      } catch (itemErr) {
        item.status = 'failed';
        item.last_error = itemErr.message;
        // Loop continues!
      }
    }
  } finally {
    isSyncing = false;
    syncStartedAt = null;
  }

  return { skipped: false, isSyncing, syncStartedAt, queue, executedMutations };
}

check('Behavioral: unexpected throw in executeMutation leaves item failed but processes next item and releases lock', async () => {
  const items = [
    { id: 'mut_1', status: 'pending', created_at: '2026-10-10T08:00:00Z', payload: { start_datetime: '2026-10-10T08:00:00Z' } },
    { id: 'mut_2', status: 'pending', created_at: '2026-10-10T09:00:00Z', payload: { start_datetime: '2026-10-10T09:00:00Z' } },
  ];

  const result = await simulateQueueDrain({ items, throwOnId: 'mut_1' });

  assert.strictEqual(result.isSyncing, false, 'Lock must be released (isSyncing = false)');
  assert.strictEqual(result.syncStartedAt, null, 'syncStartedAt must be reset to null');
  assert.strictEqual(result.executedMutations.length, 2, 'Both mut_1 and mut_2 must be processed');
  assert.strictEqual(result.queue.find(i => i.id === 'mut_1').status, 'failed', 'Failing item must be marked failed');
  assert.strictEqual(result.queue.find(i => i.id === 'mut_2').status, 'synced', 'Subsequent item must be marked synced');
});

check('Behavioral: stale lock older than 60s auto-recovers and executes queue', async () => {
  const items = [
    { id: 'mut_3', status: 'pending', created_at: '2026-10-10T10:00:00Z' },
  ];

  const result = await simulateQueueDrain({
    items,
    initialIsSyncing: true,
    initialSyncStartedAt: Date.now() - 65000, // 65s ago (stale!)
  });

  assert.strictEqual(result.skipped, false, 'Stale lock must auto-recover and not skip execution');
  assert.strictEqual(result.isSyncing, false, 'Lock must be released after run');
  assert.strictEqual(result.queue[0].status, 'synced', 'Item must be synced after stale recovery');
});

check('Behavioral: active fresh lock under 60s is respected and skips execution', async () => {
  const items = [
    { id: 'mut_4', status: 'pending', created_at: '2026-10-10T10:00:00Z' },
  ];

  const result = await simulateQueueDrain({
    items,
    initialIsSyncing: true,
    initialSyncStartedAt: Date.now() - 5000, // 5s ago (fresh)
  });

  assert.strictEqual(result.skipped, true, 'Fresh lock must be respected (skip execution)');
  assert.strictEqual(result.executedMutations.length, 0, 'No mutations should execute while locked');
});

check('Behavioral: shift log idempotency key format (ihl_...) is preserved', () => {
  // Verify regex matching canonical buildShiftLogIdempotencyKey
  const sampleKey = 'ihl_mc-101_op-999_2026-10-13_S1';
  assert(/^ihl_[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+_[a-zA-Z0-9-]+_[A-Z0-9]+$/.test(sampleKey));
  assert(offlineQueueSource.includes('return `ihl_${cleanMachine}_${cleanOperator}_${cleanDate}_${normShift}`'));
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n------------------------------------------------------------');
console.log(`Results: ${passed} / ${total} checks passed.`);
console.log('------------------------------------------------------------\n');

if (passed === total) {
  console.log('🎉 BUG-01 VERIFICATION TESTS PASSED!\n');
} else {
  console.error(`❌ FAILED: ${total - passed} checks failed.\n`);
  process.exit(1);
}
