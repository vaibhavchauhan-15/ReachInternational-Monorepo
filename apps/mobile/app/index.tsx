import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth/useAuth";
import { colorsDark, spacingNumeric } from "@reachinternational/design-tokens";
import { AppWebView } from "../shell/AppWebView";

const SHELL_MODE = process.env.EXPO_PUBLIC_SHELL_MODE || "native";

function NativeGatewayScreen() {
  const { isLoading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        router.replace("/(app)/machines");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [isLoading, session, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colorsDark.link} />
      <Text style={styles.loadingText}>Initializing Reach International...</Text>
    </View>
  );
}

export default function GatewayScreen() {
  // WebView Shell Mode (Optional override via EXPO_PUBLIC_SHELL_MODE=webview)
  if (SHELL_MODE === "webview") {
    return <AppWebView />;
  }

  // Authoritative Native Mobile App Mode (Default for Expo Go & Native Builds)
  return <NativeGatewayScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  loadingText: {
    marginTop: spacingNumeric.md,
    color: colorsDark.body,
    fontSize: 14,
    fontWeight: '500',
  },
});
