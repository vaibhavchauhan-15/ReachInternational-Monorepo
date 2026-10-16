import test from 'node:test';
import assert from 'node:assert/strict';
import {
  machineQueryKeys,
  userQueryKeys,
  attendanceQueryKeys,
  payrollQueryKeys,
  DOMAIN_QUERY_ROOTS,
} from './domain-keys.ts';

test('machineQueryKeys: produces stable, deterministic keys', () => {
  assert.deepEqual(machineQueryKeys.all, ['machines']);
  assert.deepEqual(machineQueryKeys.detail('m-123'), ['machines', 'detail', 'm-123']);
  assert.deepEqual(machineQueryKeys.list('operator', 'user-456', { status: 'active' }), [
    'machines',
    'list',
    'operator',
    'user-456',
    JSON.stringify({ status: 'active' }),
  ]);
});

test('userQueryKeys: produces stable, deterministic keys', () => {
  assert.deepEqual(userQueryKeys.all, ['users']);
  assert.deepEqual(userQueryKeys.pendingApprovals(), ['users', 'pending_approvals']);
  assert.deepEqual(userQueryKeys.supervisors(), ['users', 'supervisors']);
});

test('attendanceQueryKeys: produces formatted year-month keys', () => {
  assert.deepEqual(attendanceQueryKeys.detail('u-1', 2026, 9), ['attendance', 'detail', 'u-1', '2026-09']);
  assert.deepEqual(attendanceQueryKeys.summary(2026, 10), ['attendance', 'summary', '2026-10', 'all']);
});

test('payrollQueryKeys: produces canonical keys', () => {
  assert.deepEqual(payrollQueryKeys.summary('2026-09'), ['payroll', 'summary', '2026-09', 'all']);
  assert.deepEqual(payrollQueryKeys.detail('u-1', '2026-09'), ['payroll', 'detail', 'u-1', '2026-09']);
});
