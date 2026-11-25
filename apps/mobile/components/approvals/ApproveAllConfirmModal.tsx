import React from "react";
import {
  View,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { useTheme } from "../../lib/theming";
import { CheckCheck, X, AlertCircle } from "lucide-react-native";
import { haptics } from "../../lib/haptics";

export interface ApproveAllConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  count: number;
  typeLabel?: string;
  isSubmitting?: boolean;
}

export function ApproveAllConfirmModal({
  visible,
  onClose,
  onConfirm,
  count,
  typeLabel,
  isSubmitting = false,
}: ApproveAllConfirmModalProps) {
  const { colors } = useTheme();

  const handleConfirm = async () => {
    if (isSubmitting) return;
    haptics.confirm();
    await onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
            <View style={styles.headerTitle}>
              <View style={styles.iconBadge}>
                <CheckCheck size={18} color={colors.success} />
              </View>
              <Text variant="heading" style={{ color: colors.success }}>
                Approve All Pending
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
            >
              <X size={18} color={colors.mute} />
            </Pressable>
          </View>

          {/* Scope Box */}
          <View
            style={[
              styles.scopeBox,
              { backgroundColor: colors.canvas, borderColor: colors.hairline },
            ]}
          >
            <View style={styles.scopeRow}>
              <Text variant="caption" style={{ color: colors.ink }}>
                Scope of Bulk Approval:
              </Text>
              <View style={styles.countBadge}>
                <Text variant="caption" style={{ color: colors.success }}>
                  {count} {count === 1 ? "Request" : "Requests"} {typeLabel ? `(${typeLabel})` : ""}
                </Text>
              </View>
            </View>
            <Text variant="caption" style={{ color: colors.mute }}>
              All selected pending registrations will be approved immediately and user profiles will be activated.
            </Text>
          </View>

          {/* Statutory Documents Rule Notice */}
          <View style={styles.warningBox}>
            <AlertCircle size={18} color={colors.warningDeep} style={styles.warningIcon} />
            <View style={styles.warningContent}>
              <Text variant="body" style={{ color: colors.warningDeep }}>
                Statutory Documents Remain Pending
              </Text>
              <Text variant="caption" style={{ color: colors.warningDeep }}>
                All attached user documents (Aadhaar, Driving License, Bank Details) will remain in pending verification status. Only the user accounts will be activated. Documents can be reviewed and verified individually at any time.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={[styles.actionsRow, { borderTopColor: colors.hairline }]}>
            <Button
              variant="outline"
              size="md"
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.cancelBtn}
            >
              Cancel
            </Button>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm & Approve All"
              disabled={isSubmitting || count === 0}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor: isSubmitting || count === 0 ? colors.mute : colors.success,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <View style={styles.btnContent}>
                  <CheckCheck size={16} color={colors.onPrimary} />
                  <Text variant="body" style={{ color: colors.onPrimary }}>
                    Confirm & Approve All
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  scopeBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  warningBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  warningIcon: {
    marginTop: 2,
  },
  warningContent: {
    flex: 1,
    gap: 4,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
  },
  confirmBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
