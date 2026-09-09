/**
 * ReachInternational Mobile — Native WebView Shell Component
 * Wraps authoritative Next.js web application with:
 * - Cookie jar session persistence across app restarts
 * - Native hardware back button navigation
 * - NetInfo-driven offline interception
 * - Progress bar indicator
 * - Native bridge dispatching (print, downloads, links)
 * - Safe area edge handling
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  BackHandler,
  Platform,
  Linking,
  StatusBar,
} from "react-native";
import {
  WebView as RNWebView,
  type WebViewProps,
  type WebViewNavigation,
} from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import { colorsDark } from "@reachinternational/design-tokens";

// Cast RNWebView to component type with ref to satisfy React 19 / TS 5 strict types
const WebView = RNWebView as unknown as React.ComponentType<
  WebViewProps & { ref?: React.Ref<any> }
>;

import {
  getWebAppUrl,
  isAllowedUrl,
  SHELL_USER_AGENT_SUFFIX,
} from "./webview-config";
import {
  INJECTED_BRIDGE_JAVASCRIPT,
  handleBridgeMessage,
} from "./NativeBridge";
import { OfflineScreen } from "./screens/OfflineScreen";
import { ErrorScreen } from "./screens/ErrorScreen";

export function AppWebView() {
  const webViewRef = useRef<any>(null);
  const netInfo = useNetInfo();

  const [canGoBack, setCanGoBack] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [hasFatalError, setHasFatalError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialUrl = getWebAppUrl();

  // 1. Android Hardware Back Button Handling
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // Intercept back action
      }
      return false; // Allow default back/exit behavior
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [canGoBack]);

  // 2. Navigation State Change Listener
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (navState.loading === false) {
      setHasFatalError(false);
    }
  }, []);

  // 3. Security & Link Interception
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const { url } = request;

      // Allow trusted in-app navigation
      if (isAllowedUrl(url)) {
        return true;
      }

      // External or special scheme links (tel:, mailto:, sms:, external URLs)
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          }
        })
        .catch((err) => {
          console.warn("[AppWebView] Could not open external URL:", url, err);
        });

      return false; // Prevent WebView from loading untrusted external domains
    },
    []
  );

  // 4. Send Message Back to Web
  const sendMessageToWeb = useCallback((message: any) => {
    if (webViewRef.current) {
      const script = `window.postMessage(${JSON.stringify(message)}, '*'); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, []);

  // 5. Message Dispatcher
  const onBridgeMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      handleBridgeMessage(event.nativeEvent.data, sendMessageToWeb);
    },
    [sendMessageToWeb]
  );

  // 6. Direct Native File Download Handler
  const handleFileDownload = useCallback(
    ({ nativeEvent }: { nativeEvent: { downloadUrl: string } }) => {
      if (nativeEvent.downloadUrl) {
        handleBridgeMessage(
          JSON.stringify({
            type: "DOWNLOAD_FILE",
            payload: { url: nativeEvent.downloadUrl },
          })
        );
      }
    },
    []
  );

  // 7. Error Handlers
  const handleError = useCallback((event: any) => {
    const desc = event?.nativeEvent?.description || "Network connection failed.";
    setErrorMessage(desc);
    setHasFatalError(true);
  }, []);

  const handleHttpError = useCallback((event: any) => {
    const statusCode = event?.nativeEvent?.statusCode;
    if (statusCode && statusCode >= 500) {
      setErrorMessage(`Server responded with error (${statusCode}).`);
      setHasFatalError(true);
    }
  }, []);

  const handleReload = useCallback(() => {
    setHasFatalError(false);
    setErrorMessage(null);
    webViewRef.current?.reload();
  }, []);

  const handleGoHome = useCallback(() => {
    setHasFatalError(false);
    setErrorMessage(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = '${initialUrl}'; true;`);
    }
  }, [initialUrl]);

  // 8. Offline Screen Guard
  const isOffline =
    netInfo.isConnected === false ||
    (netInfo.isInternetReachable === false && netInfo.isConnected !== null);

  if (isOffline) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor={colorsDark.canvas} />
        <OfflineScreen onRetry={handleReload} />
      </SafeAreaView>
    );
  }

  // 9. Fatal Error Screen Guard
  if (hasFatalError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor={colorsDark.canvas} />
        <ErrorScreen
          errorDescription={errorMessage || undefined}
          onReload={handleReload}
          onGoHome={handleGoHome}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={colorsDark.canvas} />

      {/* Progress Bar Indicator */}
      {loadProgress < 1 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.max(loadProgress * 100, 10)}%` },
            ]}
          />
        </View>
      )}

      {/* Web Application View */}
      <WebView
        ref={webViewRef}
        source={{ uri: initialUrl }}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
        // Bridge & Injections
        injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE_JAVASCRIPT}
        onMessage={onBridgeMessage}
        // Navigation & Security
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onFileDownload={handleFileDownload}
        // Error Handlers
        onError={handleError}
        onHttpError={handleHttpError}
        onLoadProgress={(e: any) => setLoadProgress(e?.nativeEvent?.progress ?? 0)}
        // Session Cookies & Native Capabilities
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        mixedContentMode="never"
        cacheEnabled={true}
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        applicationNameForUserAgent={SHELL_USER_AGENT_SUFFIX}
        // Visuals & Layout
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
  },
  progressTrack: {
    height: 2,
    width: "100%",
    backgroundColor: "transparent",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  progressBar: {
    height: "100%",
    backgroundColor: colorsDark.link,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
  },
  webView: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
  },
});
