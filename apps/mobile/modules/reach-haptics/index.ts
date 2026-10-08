/**
 * ReachHaptics Expo Module JS Interface
 */

export interface ReachHapticsNativeModule {
  perform(kind: string): boolean;
}

let nativeModule: ReachHapticsNativeModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { requireOptionalNativeModule } = require('expo-modules-core');
  if (typeof requireOptionalNativeModule === 'function') {
    nativeModule = requireOptionalNativeModule('ReachHaptics');
  }
} catch {
  nativeModule = null;
}

export const ReachHaptics: ReachHapticsNativeModule | null = nativeModule;
export default ReachHaptics;
