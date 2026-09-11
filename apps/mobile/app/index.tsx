import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth/useAuth";
import { useTheme } from "../components/ui/ThemeProvider";
import { ReachInternationalLogo } from "../components/branding";
import { AppWebView } from "../shell/AppWebView";

const SHELL_MODE = process.env.EXPO_PUBLIC_SHELL_MODE || "native";

function NativeGatewayScreen() {
  const { isLoading, session } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();

  // Subtle breathing animation for the brand logo during initial initialization
  const pulseAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.92,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, opacityAnim]);

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
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Centered Brand Logo with smooth pulse animation */}
      <Animated.View
        style={[
          styles.logoWrap,
          {
            transform: [{ scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <ReachInternationalLogo
          size={42}
          showIcon={true}
          showTagline={true}
          variant={isDark ? 'light' : 'dark'}
        />
      </Animated.View>

      {/* Micro Status Badge */}
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: isDark ? '#18181b' : '#f1f5f9',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.pulseDot, { backgroundColor: theme.colors.link }]} />
        <Text style={[styles.statusText, { color: theme.colors.mute }]}>
          INITIALIZING FLEET PLATFORM
        </Text>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
