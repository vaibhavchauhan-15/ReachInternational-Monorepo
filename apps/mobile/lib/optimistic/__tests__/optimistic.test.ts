import test from 'node:test';
import assert from 'node:assert/strict';

import { createTempId, isTempId, TEMP_ID_PREFIX } from '../tempId';
import { reconcileRow, removeTempRow, isRealtimeEcho } from '../reconcile';
import { isSensitiveQuery, sanitizeDataForPersistence } from '../persist';
import { defaultFormatErrorMessage } from '../useOptimisticMutation';
import { isPendingSync, isOptimistic } from '../syncState';

test('createTempId produces valid temp IDs with prefix and isTempId recognizes them', () => {
  const id1 = createTempId();
  assert.ok(id1.startsWith(TEMP_ID_PREFIX), 'Default temp ID must start with tmp_');
  assert.equal(isTempId(id1), true);

  const customId = createTempId('log');
  assert.ok(customId.startsWith('tmp_log_'), 'Prefixed temp ID must start with tmp_log_');
  assert.equal(isTempId(customId), true);

  assert.equal(isTempId('real-uuid-1234-5678'), false);
  assert.equal(isTempId(null), false);
  assert.equal(isTempId(undefined), false);
});

test('reconcileRow correctly replaces tempId with server ID and updates syncState to synced', () => {
  const tempId = createTempId('machine');
  const initialItems = [
    { id: 'perm-1', name: 'Machine 1', syncState: 'synced' as const },
    { id: tempId, name: 'Machine 2', syncState: 'pending' as const, clientMutationId: 'cmid-42' },
  ];

  const serverRow = {
    id: 'perm-2',
    name: 'Machine 2 (Verified)',
    clientMutationId: 'cmid-42',
  };

  const reconciled = reconcileRow(initialItems, tempId, serverRow);

  assert.equal(reconciled.length, 2);
  const updatedItem = reconciled.find((i) => i.id === 'perm-2');
  assert.ok(updatedItem, 'Item with server ID perm-2 must exist');
  assert.equal(updatedItem?.syncState, 'synced');
  assert.equal(updatedItem?.name, 'Machine 2 (Verified)');
  assert.equal(reconciled.some((i) => i.id === tempId), false, 'Temporary ID must be removed');
});

test('removeTempRow cleanly removes optimistic temp item on rollback', () => {
  const tempId = createTempId('log');
  const items = [
    { id: 'perm-1', running_hours: 8 },
    { id: tempId, running_hours: 4 },
  ];

  const rolledBack = removeTempRow(items, tempId);
  assert.equal(rolledBack.length, 1);
  assert.equal(rolledBack[0].id, 'perm-1');
});

test('isRealtimeEcho detects echoes matching clientMutationId', () => {
  const activeIds = new Set(['mut-abc', 'mut-def']);

  assert.equal(isRealtimeEcho({ clientMutationId: 'mut-abc' }, activeIds), true);
  assert.equal(isRealtimeEcho({ client_mutation_id: 'mut-def' }, activeIds), true);
  assert.equal(isRealtimeEcho({ idempotency_key: 'mut-abc' }, activeIds), true);
  assert.equal(isRealtimeEcho({ clientMutationId: 'mut-xyz' }, activeIds), false);
  assert.equal(isRealtimeEcho(null, activeIds), false);
});

test('isSensitiveQuery correctly flags sensitive domains to prevent disk persistence', () => {
  const payrollQuery = {
    queryKey: ['payroll', 'slips', 'user-1'],
    meta: {},
  } as any;
  assert.equal(isSensitiveQuery(payrollQuery), true, 'Payroll query must be denied persistence');

  const metaSensitiveQuery = {
    queryKey: ['custom-data'],
    meta: { sensitive: true },
  } as any;
  assert.equal(isSensitiveQuery(metaSensitiveQuery), true, 'Query with meta: { sensitive: true } must be denied');

  const safeLogsQuery = {
    queryKey: ['operations', 'logs', 'machine-1'],
    meta: {},
  } as any;
  assert.equal(isSensitiveQuery(safeLogsQuery), false, 'Operations logs query can be persisted');
});

test('sanitizeDataForPersistence strips any tmp_ rows before dehydration', () => {
  const cachedList = [
    { id: 'real-1', name: 'Alpha' },
    { id: 'tmp_machine_999', name: 'Beta Pending' },
    { id: 'real-2', name: 'Gamma' },
  ];

  const sanitized = sanitizeDataForPersistence(cachedList);
  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].id, 'real-1');
  assert.equal(sanitized[1].id, 'real-2');
});

test('defaultFormatErrorMessage translates PostgreSQL error codes into user-friendly messages', () => {
  const p0002 = defaultFormatErrorMessage({ code: 'P0002', message: 'overlapping shifts' });
  assert.ok(p0002.includes('collision'), 'P0002 must explain shift collision');

  const uniqueErr = defaultFormatErrorMessage({ code: '23505', message: 'duplicate key' });
  assert.ok(uniqueErr.includes('duplicate') || uniqueErr.includes('already exists'));

  const checkErr = defaultFormatErrorMessage({ code: '23514', message: 'check constraint' });
  assert.ok(checkErr.includes('validation rules'));

  const rlsErr = defaultFormatErrorMessage({ code: '42501', message: 'permission denied' });
  assert.ok(rlsErr.includes('Permission denied'));
});

test('syncState helper predicates correctly evaluate pending and optimistic status', () => {
  assert.equal(isPendingSync('pending'), true);
  assert.equal(isPendingSync('queued'), true);
  assert.equal(isPendingSync('synced'), false);
  assert.equal(isPendingSync('failed'), false);

  assert.equal(isOptimistic({ syncState: 'pending' }), true);
  assert.equal(isOptimistic({ syncState: 'queued' }), true);
  assert.equal(isOptimistic({ syncState: 'synced' }), false);
  assert.equal(isOptimistic(null), false);
});
