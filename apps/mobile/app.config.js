const fs = require('fs');
const path = require('path');
const {
  withAndroidStyles,
  withAndroidManifest,
  withGradleProperties,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

/**
 * Android 15 Edge-to-Edge and styling compliance:
 * - Transparent autofill highlight
 * - Cutout mode: set to 'always' to migrate away from deprecated SHORT_EDGES and DEFAULT in Android 15
 * - Transparent status and navigation bars to prevent deprecated Window.setStatusBarColor / setNavigationBarColor runtime warnings
 * - Disable system bar contrast enforcement for pure edge-to-edge
 */
const withAndroidEdgeToEdgeStyles = (config) => {
  return withAndroidStyles(config, (cfg) => {
    const styleItems = [
      { name: 'android:autofilledHighlight', value: '@android:color/transparent' },
      { name: 'android:windowLayoutInDisplayCutoutMode', value: 'always' },
      { name: 'android:statusBarColor', value: '@android:color/transparent' },
      { name: 'android:navigationBarColor', value: '@android:color/transparent' },
      { name: 'android:enforceStatusBarContrast', value: 'false' },
      { name: 'android:enforceNavigationBarContrast', value: 'false' },
    ];

    for (const item of styleItems) {
      cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
        add: true,
        parent: AndroidConfig.Styles.getAppThemeGroup(),
        name: item.name,
        value: item.value,
      });
    }
    return cfg;
  });
};

/**
 * Android 16+ Large Screen Support & Strict Permissions Stripping:
 * - Remove hardcoded screenOrientation='PORTRAIT' restriction from MainActivity
 * - Set resizeableActivity='true' for foldables, tablets, and split screen
 * - Enforce tools:node='remove' on deprecated/unneeded permissions to strip them from merged manifest
 */
const withAndroidLargeScreenAndPermissions = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const androidManifest = cfg.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);

    // 1. Remove orientation restriction for Android 16+ foldables/tablets
    if (mainActivity.$['android:screenOrientation']) {
      delete mainActivity.$['android:screenOrientation'];
    }

    // 2. Mark resizable activity explicitly for multi-window and large screens
    mainActivity.$['android:resizeableActivity'] = 'true';
    if (Array.isArray(androidManifest.manifest.application) && androidManifest.manifest.application[0]) {
      androidManifest.manifest.application[0].$['android:resizeableActivity'] = 'true';
    }

    // 3. Ensure xmlns:tools exists for tools:node="remove"
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // 4. Blocked permissions to strip from final merged manifest
    const blockedList = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.USE_FINGERPRINT',
      'android.permission.USE_BIOMETRIC',
      'com.android.vending.CHECK_LICENSE',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_CONTACTS',
    ];

    if (!Array.isArray(androidManifest.manifest['uses-permission'])) {
      androidManifest.manifest['uses-permission'] = [];
    }

    for (const perm of blockedList) {
      const existing = androidManifest.manifest['uses-permission'].find(
        (p) => p.$ && p.$['android:name'] === perm
      );
      if (existing) {
        existing.$['tools:node'] = 'remove';
      } else {
        androidManifest.manifest['uses-permission'].push({
          $: {
            'android:name': perm,
            'tools:node': 'remove',
          },
        });
      }
    }

    return cfg;
  });
};

/**
 * Release Build DEX Optimization & Obfuscation:
 * - Enables R8/ProGuard minification (`android.enableMinifyInReleaseBuilds=true`)
 * - Enables resource shrinking (`android.enableShrinkResourcesInReleaseBuilds=true`)
 * - Enables R8 fullMode (`android.enableR8.fullMode=true`)
 * - Brings DEX obfuscation rate well above Google Play's 25% threshold
 */
const withOptimizationGradleProperties = (config) => {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      cfg.modResults,
      'android.enableMinifyInReleaseBuilds',
      'true'
    );
    cfg.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      cfg.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'true'
    );
    cfg.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      cfg.modResults,
      'android.enableR8.fullMode',
      'true'
    );
    cfg.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      cfg.modResults,
      'edgeToEdgeEnabled',
      'true'
    );
    return cfg;
  });
};

/**
 * Release ProGuard Keep Rules for Safe R8 Shrinking:
 * - Preserves React Native core, TurboModules, Reanimated, Expo modules, SecureStore, NetInfo, AsyncStorage, Sentry
 */
const withCustomProguardRules = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardFile = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      const rules = `
# Reach International - Proguard / R8 Optimization Keep Rules
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepattributes LineNumberTable,SourceFile

# React Native & TurboModules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }

# Expo Modules & SecureStore
-keep class expo.modules.** { *; }
-keep class expo.modules.securestore.** { *; }

# Network & Storage
-keep class com.reactnativecommunity.netinfo.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Sentry
-keep class io.sentry.** { *; }
`;

      try {
        if (fs.existsSync(proguardFile)) {
          const content = fs.readFileSync(proguardFile, 'utf8');
          if (!content.includes('Reach International - Proguard')) {
            fs.appendFileSync(proguardFile, '\n' + rules);
          }
        }
      } catch (err) {
        console.warn('Could not append Proguard rules:', err);
      }
      return cfg;
    },
  ]);
};

module.exports = ({ config }) => {
  const isEASBuild = process.env.EAS_BUILD === 'true';

  // Sentry source map auto-upload during native build:
  // Must be disabled if SENTRY_AUTH_TOKEN is not provided or if SENTRY_DISABLE_AUTO_UPLOAD is true,
  // preventing Gradle / Sentry CLI from failing release builds with:
  // "error: Auth token is required for this request. Please run 'sentry-cli login' and try again!"
  const hasSentryToken = Boolean(process.env.SENTRY_AUTH_TOKEN);
  const shouldDisableAutoUpload =
    process.env.SENTRY_DISABLE_AUTO_UPLOAD !== undefined
      ? process.env.SENTRY_DISABLE_AUTO_UPLOAD === 'true'
      : !hasSentryToken;

  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo') {
      return [
        '@sentry/react-native/expo',
        {
          ...(plugin[1] || {}),
          disableAutoUpload: shouldDisableAutoUpload,
        },
      ];
    }
    return plugin;
  });

  const finalConfig = {
    ...config,
    runtimeVersion:
      typeof config.runtimeVersion === 'string'
        ? config.runtimeVersion
        : (config.version || '1.1.0'),
    plugins,
    updates: isEASBuild
      ? {
          url: 'https://u.expo.dev/40432ac1-55a2-4bfa-985e-a51562398743',
          enabled: true,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        }
      : {
          enabled: false,
          checkAutomatically: 'NEVER',
        },
  };

  return withCustomProguardRules(
    withOptimizationGradleProperties(
      withAndroidLargeScreenAndPermissions(
        withAndroidEdgeToEdgeStyles(finalConfig)
      )
    )
  );
};
