/**
 * ReachInternational Mobile — Early Warning Suppression
 * Must be imported at the very top of app entry points BEFORE any components/styles load.
 * Suppresses known React Native Web deprecation warnings and harmless runtime notices.
 *
 * NOTE: Intentionally avoids top-level ES module imports so console.warn is patched
 * synchronously BEFORE react-native-web evaluates module stylesheets.
 */

const IGNORED_WARNING_PATTERNS = [
  'shadow*',
  'boxShadow',
  'useNativeDriver',
  'pointerEvents',
  'setLayoutAnimationEnabledExperimental',
  'TouchableWithoutFeedback',
  'Invalid style property of "outline"',
  'validateDOMNesting',
  'style props are deprecated',
];

const shouldSuppress = (args: any[]): boolean => {
  if (!args || args.length === 0) return false;
  const fullMsg = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg.message === 'string') return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

  return IGNORED_WARNING_PATTERNS.some((pattern) => fullMsg.includes(pattern));
};

if (typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (shouldSuppress(args)) {
      return;
    }
    originalWarn(...args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (shouldSuppress(args)) {
      return;
    }
    originalError(...args);
  };
}

// Safely register LogBox ignore rules
try {
  const { LogBox } = require('react-native');
  LogBox.ignoreLogs(IGNORED_WARNING_PATTERNS);
} catch {
  // Ignore in environments where react-native is not yet initialized
}

// Polyfill React Native Web's empty Alert.alert stub
try {
  const { Alert, Platform } = require('react-native');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && Alert) {
    Alert.alert = (
      title?: string,
      message?: string,
      buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
      _options?: any
    ) => {
      const formattedText = [title, message].filter(Boolean).join('\n\n');
      if (!buttons || buttons.length <= 1) {
        if (formattedText) {
          window.alert(formattedText);
        }
        buttons?.[0]?.onPress?.();
        return;
      }

      // Dialog with multiple buttons (e.g. Cancel + Sign Out / Delete)
      const confirmed = window.confirm(formattedText);
      if (confirmed) {
        const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[buttons.length - 1];
        actionBtn?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        cancelBtn?.onPress?.();
      }
    };
  }
} catch {
  // Ignore in environments where react-native is not yet initialized
}
