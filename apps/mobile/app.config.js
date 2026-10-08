const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

const withTransparentAutofillHighlight = (config) => {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:autofilledHighlight',
      value: '@android:color/transparent',
    });
    return cfg;
  });
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

  return withTransparentAutofillHighlight(finalConfig);
};

