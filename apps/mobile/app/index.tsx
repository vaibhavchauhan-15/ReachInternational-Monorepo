import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth/useAuth";
import { colorsDark, spacingNumeric } from "@reachinternational/design-tokens";
import { AppWebView } from "../shell/AppWebView";

const SHELL_MODE = process.env.EXPO_PUBLIC_SHELL_MODE || "webview";

function LegacyGatewayScreen() {
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
      <Text style={styles.loadingText}>Initializing Reach International (Legacy)...</Text>
    </View>
  );
}

export default function GatewayScreen() {
  if (SHELL_MODE === "legacy") {
    return <LegacyGatewayScreen />;
  }

  // Authoritative WebView Shell Mode (Default)
  return <AppWebView />;
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
