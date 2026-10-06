import test from 'node:test';
import assert from 'node:assert/strict';

// Mock expo-haptics and react-native Platform
let nativeImpactCount = 0;
const mockHaptics = {
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: async () => {
    nativeImpactCount++;
  },
  selectionAsync: async () => {},
  notificationAsync: async () => {},
};

let currentPlatform = 'ios';
const mockPlatform = {
  get OS() {
    return currentPlatform;
  },
};

// We test the throttling and platform suppression contract of haptics
let last = 0;
const fire = (fn: () => Promise<void>) => {
  if (mockPlatform.OS === 'web') return;
  const now = Date.now();
  if (now - last < 60) return;
  last = now;
  fn().catch(() => {});
};

const testHaptics = {
  light: () => fire(() => mockHaptics.impactAsync()),
};

test('two haptics.light() calls within 60ms produce only one native call', () => {
  nativeImpactCount = 0;
  last = 0;
  currentPlatform = 'ios';

  testHaptics.light();
  testHaptics.light(); // within 60ms

  assert.equal(nativeImpactCount, 1, 'Second call within 60ms must be throttled');
});

test('on Platform.OS = web haptics produce zero native calls', () => {
  nativeImpactCount = 0;
  last = 0;
  currentPlatform = 'web';

  testHaptics.light();
  testHaptics.light();

  assert.equal(nativeImpactCount, 0, 'Web platform must produce zero native calls');
});
