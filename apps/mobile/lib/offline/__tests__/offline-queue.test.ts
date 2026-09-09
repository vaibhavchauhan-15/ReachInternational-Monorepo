/**
 * Validation tests for OfflineQueueManager
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Verifies item enqueueing, serialization into AsyncStorage, idempotency key generation, and FIFO retrieval order.
 */

import { OfflineQueueManager, QUEUE_STORAGE_KEY, generateUUID } from '../OfflineQueueManager';
import { QueuedMutation } from '../types';

describe('OfflineQueueManager', () => {
  let manager: OfflineQueueManager;

  beforeEach(async () => {
    manager = OfflineQueueManager.getInstance();
    await manager.clearQueue();
  });

  afterEach(() => {
    manager.teardown();
  });

  it('generates a valid RFC4122 v4 UUID for idempotency keys', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuid1).toMatch(uuidRegex);
    expect(uuid2).toMatch(uuidRegex);
    expect(uuid1).not.toBe(uuid2);
  });

  it('enqueues a shift mutation with pending status and idempotency key', async () => {
    const payload = {
      machine_id: 'm-123',
      start_meter: 100,
      end_meter: 108,
      log_date: '2026-09-09',
    };

    const item = await manager.enqueue('SUBMIT_HOUR_LOG', payload);

    expect(item).toBeDefined();
    expect(item.id).toBeDefined();
    expect(item.idempotency_key).toBeDefined();
    expect(item.status).toBe('pending');
    expect(item.retry_count).toBe(0);
    expect(item.payload).toEqual(payload);

    const queue = await manager.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(item.id);
  });

  it('preserves strict FIFO retrieval order across multiple enqueued items', async () => {
    const item1 = await manager.enqueue('SUBMIT_HOUR_LOG', { order: 1 });
    const item2 = await manager.enqueue('SUBMIT_HOUR_LOG', { order: 2 });
    const item3 = await manager.enqueue('SUBMIT_HOUR_LOG', { order: 3 });

    const queue = await manager.getQueue();
    expect(queue.length).toBe(3);
    expect(queue[0].id).toBe(item1.id);
    expect(queue[1].id).toBe(item2.id);
    expect(queue[2].id).toBe(item3.id);
  });

  it('updates mutation status and handles removals correctly', async () => {
    const item = await manager.enqueue('SUBMIT_HOUR_LOG', { test: true });

    await manager.updateMutation(item.id, { status: 'syncing' });
    let state = manager.getState();
    expect(state.syncingCount).toBe(1);
    expect(state.pendingCount).toBe(0);

    await manager.removeMutation(item.id);
    state = manager.getState();
    expect(state.queue.length).toBe(0);
    expect(state.syncingCount).toBe(0);
  });
});
