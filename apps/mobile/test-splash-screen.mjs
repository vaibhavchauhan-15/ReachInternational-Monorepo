/**
 * Automated Verification Suite for Mobile Launch / Splash Screen
 * Tests:
 * 1. Zero Loading Spinner: Verifies ActivityIndicator and spinner styles are eradicated from splash.
 * 2. Industry Standard Logo Sizing: Asserts 144dp emblem (with 120dp compact screen fallback).
 * 3. Elevated Aesthetic: Verifies bordered={true} and whisper elevation tokens.
 * 4. Micro-Animation: Asserts GPU-accelerated FadeIn entrance on the logo mark.
 * 5. Lifecycle Coordination: Asserts SplashScreen.hideAsync() is called on auth resolution.
 * 6. Component Memoization: Asserts NativeGatewayScreen is wrapped with React.memo.
 * 7. Zero Raw Typography: Validates no raw typography properties in StyleSheet.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Test Suite]: Running Mobile Splash Screen & Gateway Verification...');

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
  const indexFile = path.join(__dirname, 'app', 'index.tsx');
  assert(fs.existsSync(indexFile), 'app/index.tsx gateway screen exists');
  const indexContent = fs.readFileSync(indexFile, 'utf8');

  // 1. Zero Loading Spinner
  assert(!indexContent.includes('ActivityIndicator'), 'ActivityIndicator is completely removed from app/index.tsx');
  assert(!indexContent.includes('styles.indicator'), 'styles.indicator is completely removed from app/index.tsx');
  assert(!indexContent.includes('indicator: {'), 'indicator style definition is removed from StyleSheet');

  // 2. Industry Standard Logo Sizing
  assert(indexContent.includes('144'), 'Logo size is set to industry standard 144dp');
  assert(indexContent.includes('width < 360 ? 120 : 144'), 'Responsive sizing supports 120dp for ultra-compact viewports');
  assert(indexContent.includes('size={logoSize}'), 'ReachBrandEmblem dynamically binds size={logoSize}');
  assert(!indexContent.includes('size={84}'), 'Legacy tiny 84px logo size is eradicated');

  // 3. Elevated Aesthetic & Design Tokens
  assert(indexContent.includes('bordered={true}'), 'ReachBrandEmblem specifies bordered={true} for 1px hairline border');
  assert(indexContent.includes('logoLightElevation'), 'Configures tactile light mode elevation shadow');
  assert(indexContent.includes('logoDarkElevation'), 'Configures tactile dark mode glow/elevation');

  // 4. Smooth Micro-Animation
  assert(indexContent.includes('FadeIn.duration(200)') || indexContent.includes('FadeIn'), 'GPU-accelerated FadeIn transition is applied to logo');
  assert(indexContent.includes('Animated.View'), 'Animated.View wrapper surrounds emblem');

  // 5. Coordinated Splash Lifecycle & StatusBar
  assert(indexContent.includes('SplashScreen.hideAsync()'), 'SplashScreen.hideAsync() is called upon session resolution');
  assert(indexContent.includes('StatusBar style={isDark ? \'light\' : \'dark\'}'), 'StatusBar is synchronized to active colorScheme');

  // 6. Memoization & Clean Routing
  assert(indexContent.includes('const NativeGatewayScreen = memo('), 'NativeGatewayScreen is memoized to prevent re-render cascades');
  assert(indexContent.includes('getMobileRoleHomeRoute(role)'), 'Directly redirects authenticated users to role home route');
  assert(indexContent.includes('<Redirect href="/(auth)/login" />'), 'Redirects unauthenticated users to login');

  // 7. Zero Raw Typography
  assert(!/fontSize\s*:/.test(indexContent), 'Zero raw fontSize properties in app/index.tsx');
  assert(!/fontWeight\s*:/.test(indexContent), 'Zero raw fontWeight properties in app/index.tsx');
  assert(!/lineHeight\s*:/.test(indexContent), 'Zero raw lineHeight properties in app/index.tsx');

  console.log(`\n✅ Splash Screen Suite Completed: ${passed}/${passed + failed} assertions passed!`);
  if (failed > 0) {
    process.exit(1);
  }
} catch (err) {
  console.error('Unexpected error running splash screen verification suite:', err);
  process.exit(1);
}
