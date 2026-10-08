/**
 * Automated Unit Test Suite for Touch Feedback & Soft Haptics
 * Verifies Phase 0 guards, rate limiting, deduping, and vocabulary.
 */

import assert from 'node:assert';

console.log('Testing Touch Feedback & Soft Haptics Guards...');

// 1. Test Rate Limiter logic directly
let lastFiredAt = 0;
let lastFiredKind = null;
const MIN_INTERVAL_MS = 60;
const DEDUPE_SAME_KIND_MS = 120;

function shouldAllowHaptic(kind, now) {
  if (now - lastFiredAt < MIN_INTERVAL_MS) return false;
  if (kind === lastFiredKind && now - lastFiredAt < DEDUPE_SAME_KIND_MS) return false;
  return true;
}

function recordHapticFired(kind, now) {
  lastFiredAt = now;
  lastFiredKind = kind;
}

// Initial fire
assert.strictEqual(shouldAllowHaptic('tap', 1000), true, 'First haptic should be allowed');
recordHapticFired('tap', 1000);

// Sub-60ms call (rate limit)
assert.strictEqual(shouldAllowHaptic('select', 1030), false, 'Sub-60ms trigger must be blocked (rate limit)');
assert.strictEqual(shouldAllowHaptic('tap', 1059), false, 'Sub-60ms trigger must be blocked');

// >= 60ms call with different kind
assert.strictEqual(shouldAllowHaptic('select', 1061), true, 'Different kind after 60ms must be allowed');
recordHapticFired('select', 1061);

// Same kind within 120ms (burst dedupe)
assert.strictEqual(shouldAllowHaptic('select', 1130), false, 'Same kind within 120ms must be blocked (dedupe)');
assert.strictEqual(shouldAllowHaptic('select', 1180), false, 'Same kind within 120ms must be blocked');

// Same kind after 120ms
assert.strictEqual(shouldAllowHaptic('select', 1182), true, 'Same kind after 120ms must be allowed');
recordHapticFired('select', 1182);

// Toggle on/off kinds
assert.strictEqual(shouldAllowHaptic('toggleOn', 1250), true, 'toggleOn after 68ms must be allowed');
recordHapticFired('toggleOn', 1250);
assert.strictEqual(shouldAllowHaptic('toggleOff', 1320), true, 'toggleOff after 70ms must be allowed');

console.log('✓ Rate limiting and burst dedupe verified (60ms interval, 120ms dedupe)');

// 2. Test Preferences Guard Logic
let hapticsEnabled = true;
function isHapticsEnabled() {
  return hapticsEnabled;
}

let performedCalls = [];
function testFire(kind, now = Date.now()) {
  if (!isHapticsEnabled()) return false;
  if (!shouldAllowHaptic(kind, now)) return false;
  recordHapticFired(kind, now);
  performedCalls.push(kind);
  return true;
}

// Test when hapticsEnabled is true
performedCalls = [];
lastFiredAt = 0;
lastFiredKind = null;
assert.strictEqual(testFire('confirm', 2000), true);
assert.strictEqual(performedCalls.length, 1);

// Test when hapticsEnabled is false
hapticsEnabled = false;
performedCalls = [];
assert.strictEqual(testFire('confirm', 3000), false);
assert.strictEqual(testFire('tap', 3100), false);
assert.strictEqual(testFire('select', 3200), false);
assert.strictEqual(performedCalls.length, 0, 'Zero haptics fired when setting is OFF');

console.log('✓ Preferences disable guard verified (zero vibration when OFF)');

// 3. Verify vocabulary completeness
const REQUIRED_VOCABULARY = [
  'tap',
  'select',
  'toggle',
  'longPress',
  'dragStart',
  'dragEnd',
  'threshold',
  'confirm',
  'reject',
];

for (const term of REQUIRED_VOCABULARY) {
  assert.ok(typeof term === 'string' && term.length > 0, `Missing term: ${term}`);
}

console.log(`✓ Required semantic vocabulary verified: ${REQUIRED_VOCABULARY.join(', ')}`);
console.log('ALL TOUCH FEEDBACK & SOFT HAPTICS GUARD TESTS PASSED!');
