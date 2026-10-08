import { Text } from "../../components/ui/Text";
/**
 * ReachInternational Mobile — Offline Interception Screen
 * Premium, dark-mode screen displayed when network connectivity is lost.
 */

import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator} from "react-native";
import { WifiOff, RefreshCw } from '../../components/ui/icon';
import { colorsDark, spacingNumeric, radiusNumeric } from "@reachinternational/design-tokens";
import { Pressable } from "../../components/ui/touch/Pressable";

interface OfflineScreenProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function OfflineScreen({ onRetry, isRetrying = false }: OfflineScreenProps) {
  const [internalRetrying, setInternalRetrying] = useState(false);

  const handleRetry = () => {
    setInternalRetrying(true);
    onRetry();
    setTimeout(() => {
      setInternalRetrying(false);
    }, 1200);
  };

  const loading = isRetrying || internalRetrying;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <WifiOff size={40} color={colorsDark.link} strokeWidth={1.75} />
        </View>

        <Text variant="title" style={styles.title}>No Internet Connection</Text>

        <Text variant="body" style={styles.description}>
          ReachInternational requires an active network connection to track
          heavy machinery telemetry, log operator shifts, and synchronize fleet operations.
        </Text>

        <Pressable
          variant="buttonPrimary"
          haptic="tap"
          style={[styles.retryButton, loading && styles.retryButtonDisabled]}
          onPress={handleRetry}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Retry Connection"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <RefreshCw size={16} color="#ffffff" strokeWidth={2} style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        ReachInternational Fleet Enterprise • v1.0.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorsDark.canvas,
    justifyContent: "center",
    alignItems: "center",
    padding: spacingNumeric.lg },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colorsDark.canvasElevated,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderColor: colorsDark.hairline,
    padding: spacingNumeric.xl,
    alignItems: "center" },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 112, 243, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 112, 243, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacingNumeric.lg },
  title: {
    color: colorsDark.ink,
    textAlign: "center",
    marginBottom: spacingNumeric.sm },
  description: {
    color: colorsDark.mute,
    textAlign: "center",
    marginBottom: spacingNumeric.xl },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colorsDark.link,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radiusNumeric.md,
    width: "100%",
    minHeight: 48, // Touch target guideline: min 44px
  },
  retryButtonDisabled: {
    opacity: 0.6 },
  buttonIcon: {
    marginRight: 8 },
  retryButtonText: {
    color: "#ffffff" },
  footerText: {
    position: "absolute",
    bottom: 32,
    color: colorsDark.mute } });
