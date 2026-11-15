import React, { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { useTheme } from "../../lib/theming";
import { AlertTriangle, X } from "lucide-react-native";
import { haptics } from "../../lib/haptics";

export interface RejectReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  requestSummary?: string;
  isSubmitting?: boolean;
}

export function RejectReasonModal({
  visible,
  onClose,
  onConfirm,
  requestSummary,
  isSubmitting = false,
}: RejectReasonModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason for rejecting this request.");
      haptics.reject();
      return;
    }

    try {
      setError(null);
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      haptics.reject();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <AlertTriangle size={18} color="#ef4444" />
              <Text variant="heading" style={{ color: "#ef4444" }}>
                Reject Request
              </Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
            >
              <X size={18} color={colors.mute} />
            </Button>
          </View>

          {requestSummary ? (
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: colors.canvas, borderColor: colors.hairline },
              ]}
            >
              <Text variant="caption" numberOfLines={2}>
                {requestSummary}
              </Text>
            </View>
          ) : null}

          <View style={styles.body}>
            <Text variant="label" style={styles.inputLabel}>
              Rejection Reason *
            </Text>
            <TextInput
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (error) setError(null);
              }}
              placeholder="e.g. Incomplete documentation, blurred photo..."
              placeholderTextColor={colors.mute}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                {
                  backgroundColor: colors.canvas,
                  borderColor: error ? "#ef4444" : colors.hairline,
                  color: colors.ink,
                },
              ]}
              editable={!isSubmitting}
            />
            {error ? (
              <Text variant="micro" style={styles.errorText}>
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Button
              variant="outline"
              size="sm"
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.actionBtn}
            >
              <Text variant="label">Cancel</Text>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.actionBtn}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text variant="label" style={{ color: "#ffffff" }}>
                  Confirm Reject
                </Text>
              )}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  body: {
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorText: {
    color: "#ef4444",
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
  },
});
