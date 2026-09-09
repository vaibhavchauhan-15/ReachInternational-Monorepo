/**
 * ReachInternational Mobile — Error Screen
 * Displayed when WebView encounters HTTP errors or fatal page load failures.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { AlertTriangle, RefreshCw, Home } from "lucide-react-native";
import { colorsDark, spacingNumeric, radiusNumeric } from "@reachinternational/design-tokens";

interface ErrorScreenProps {
  errorDescription?: string;
  onReload: () => void;
  onGoHome?: () => void;
}

export function ErrorScreen({
  errorDescription,
  onReload,
  onGoHome,
}: ErrorScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <AlertTriangle size={40} color="#f59e0b" strokeWidth={1.75} />
        </View>

        <Text style={styles.title}>Unable to Load Page</Text>

        <Text style={styles.description}>
          {errorDescription ||
            "We experienced an issue connecting to ReachInternational. Please verify your server connectivity and try again."}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onReload}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reload Page"
          >
            <RefreshCw size={16} color="#ffffff" strokeWidth={2} style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Reload Page</Text>
          </TouchableOpacity>

          {onGoHome && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onGoHome}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Return to Dashboard"
            >
              <Home size={16} color={colorsDark.ink} strokeWidth={2} style={styles.buttonIcon} />
              <Text style={styles.secondaryButtonText}>Return to Home</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
    justifyContent: "center",
    alignItems: "center",
    padding: spacingNumeric.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colorsDark.canvasElevated,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderColor: colorsDark.hairline,
    padding: spacingNumeric.xl,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacingNumeric.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colorsDark.ink,
    textAlign: "center",
    marginBottom: spacingNumeric.sm,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colorsDark.mute,
    textAlign: "center",
    marginBottom: spacingNumeric.xl,
  },
  actions: {
    width: "100%",
    gap: spacingNumeric.sm,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colorsDark.link,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radiusNumeric.md,
    width: "100%",
    minHeight: 48,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colorsDark.hairline,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radiusNumeric.md,
    width: "100%",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: colorsDark.ink,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  buttonIcon: {
    marginRight: 8,
  },
});
