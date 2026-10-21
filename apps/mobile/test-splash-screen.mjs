/**
 * Automated Verification Suite for Mobile Launch / Splash Screen
 * Tests:
 * 1. Complete Logo Eradication: Verifies ReachBrandEmblem and logo styles are completely removed from app/index.tsx.
 * 2. Zero Loading Spinner: Verifies ActivityIndicator and spinner styles are eradicated from splash.
 * 3. Minimalist Canvas & Design Tokens: Asserts clean theme canvas background and dynamic StatusBar.
 * 4. Lifecycle Coordination: Asserts SplashScreen.hideAsync() is called on auth resolution.
 * 5. Component Memoization: Asserts NativeGatewayScreen is wrapped with React.memo.
 * 6. Native Config Eradication: Asserts app.json, styles.xml, and ic_launcher_background.xml have zero logo references.
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

  // 1. Complete Logo Eradication from app/index.tsx
  assert(!indexContent.includes('ReachBrandEmblem'), 'ReachBrandEmblem is completely eradicated from app/index.tsx');
  assert(!indexContent.includes('logoSize'), 'logoSize calculations are completely removed from app/index.tsx');
  assert(!indexContent.includes('logoContainer'), 'logoContainer style is completely removed from app/index.tsx');
  assert(!indexContent.includes('logoLightElevation'), 'logoLightElevation is completely removed from app/index.tsx');
  assert(!indexContent.includes('logoDarkElevation'), 'logoDarkElevation is completely removed from app/index.tsx');
  assert(!indexContent.includes('Animated.View'), 'Animated.View wrapper for logo is removed from app/index.tsx');

  // 2. Zero Loading Spinner
  assert(!indexContent.includes('ActivityIndicator'), 'ActivityIndicator is completely removed from app/index.tsx');
  assert(!indexContent.includes('styles.indicator'), 'styles.indicator is completely removed from app/index.tsx');
  assert(!indexContent.includes('indicator: {'), 'indicator style definition is removed from StyleSheet');

  // 3. Minimalist Canvas & Design Tokens
  assert(indexContent.includes('theme.colors.canvas'), 'Renders clean theme canvas background');
  assert(indexContent.includes("StatusBar style={isDark ? 'light' : 'dark'}"), 'StatusBar is synchronized to active colorScheme');

  // 4. Coordinated Splash Lifecycle
  assert(indexContent.includes('SplashScreen.hideAsync()'), 'SplashScreen.hideAsync() is called upon session resolution');

  // 5. Memoization & Clean Routing
  assert(indexContent.includes('const NativeGatewayScreen = memo('), 'NativeGatewayScreen is memoized to prevent re-render cascades');
  assert(indexContent.includes('getMobileRoleHomeRoute(role)'), 'Directly redirects authenticated users to role home route');
  assert(indexContent.includes('<Redirect href="/(auth)/login" />'), 'Redirects unauthenticated users to login');

  // 6. Native Configuration Verification
  const appJsonFile = path.join(__dirname, 'app.json');
  assert(fs.existsSync(appJsonFile), 'app.json exists');
  const appJsonContent = fs.readFileSync(appJsonFile, 'utf8');
  assert(!appJsonContent.includes('"./assets/splash.png"'), 'app.json removes splash image from expo-splash-screen config');

  const stylesXmlFile = path.join(__dirname, 'android/app/src/main/res/values/styles.xml');
  if (fs.existsSync(stylesXmlFile)) {
    const stylesXmlContent = fs.readFileSync(stylesXmlFile, 'utf8');
    assert(stylesXmlContent.includes('@android:color/transparent'), 'styles.xml sets windowSplashScreenAnimatedIcon to @android:color/transparent');
    assert(!stylesXmlContent.includes('@drawable/splashscreen_logo'), 'styles.xml no longer references @drawable/splashscreen_logo');
  }

  const launcherBgFile = path.join(__dirname, 'android/app/src/main/res/drawable/ic_launcher_background.xml');
  if (fs.existsSync(launcherBgFile)) {
    const launcherBgContent = fs.readFileSync(launcherBgFile, 'utf8');
    assert(!launcherBgContent.includes('@drawable/splashscreen_logo'), 'ic_launcher_background.xml no longer references @drawable/splashscreen_logo');
  }

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
