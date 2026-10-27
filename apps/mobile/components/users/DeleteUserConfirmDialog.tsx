/**
 * ReachInternational Mobile — Delete User Confirmation Dialog
 * Properly sized Material 3 / Geist centered confirmation dialog.
 * Displays employee's name, employee ID, role badge, status dot,
 * and clear explanation of consequences and statutory data preservation.
 * Disables repeated submissions and handles API errors without losing dialog state.
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Trash2, AlertTriangle, ShieldAlert } from '../ui/icon';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/overlay/Dialog';
import { Touchable } from '../ui/Touchable';
import { haptics } from '../../lib/haptics';
import type { UserRecord } from './UserDetailModal';

export interface DeleteUserConfirmDialogProps {
  visible: boolean;
  user: UserRecord | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  errorMessage?: string | null;
}

function getRoleAccentColor(role?: string): string {
  switch (role) {
    case 'super_admin':
      return '#ef4444';
    case 'admin':
      return '#f59e0b';
    case 'manager':
      return '#6366f1';
    case 'supervisor':
      return '#0d9488';
    case 'hr':
      return '#059669';
    case 'operator':
      return '#d97706';
    default:
      return '#64748b';
  }
}

function formatRoleLabel(role?: string): string {
  if (!role) return 'Staff';
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'hr':
      return 'HR';
    case 'operator':
      return 'Operator';
    default:
      return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export const DeleteUserConfirmDialog: React.FC<DeleteUserConfirmDialogProps> = ({
  visible,
  user,
  onClose,
  onConfirm,
  isDeleting = false,
  errorMessage = null,
}) => {
  const { theme, isDark } = useTheme();

  if (!user) return null;

  const roleColor = getRoleAccentColor(user.role);
  const initials = (user.full_name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleConfirmPress = () => {
    if (isDeleting) return;
    haptics.warning();
    onConfirm();
  };

  return (
    <Dialog
      visible={visible}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      persistent={isDeleting}
      contentStyle={[
        styles.dialogCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
      testID="delete-user-confirm-dialog"
    >
      <View
        style={styles.innerContent}
        accessibilityRole="alert"
        accessibilityLabel={`Delete account for ${user.full_name}`}
      >
        {/* Header Icon Orb */}
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.1)',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
            },
          ]}
        >
          <Trash2 size={24} color={theme.colors.error} />
        </View>

        {/* Dialog Title */}
        <Text variant="heading" weight="semibold" style={[styles.dialogTitle, { color: theme.colors.ink }]}>
          Delete User Account
        </Text>

        <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
          Please confirm account removal for this staff member.
        </Text>

        {/* Employee Summary Card */}
        <View
          style={[
            styles.employeeCard,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.employeeCardHeader}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  borderColor: roleColor,
                },
              ]}
            >
              <Text variant="caption" weight="bold" style={{ color: roleColor }}>
                {initials || 'U'}
              </Text>
            </View>

            <View style={styles.employeeMetaWrap}>
              <Text variant="subheading" weight="semibold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                {user.full_name}
              </Text>
              <View style={styles.idRow}>
                <Text variant="mono" weight="semibold" style={{ color: theme.colors.link }}>
                  {user.employee_id || 'ID Pending'}
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  {' · '}
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
          </View>

          {/* Badges Row */}
          <View style={styles.badgesRow}>
            <Badge
              role={user.role}
              label={formatRoleLabel(user.role)}
              size="sm"
            />

            <Badge
              status={user.status || 'active'}
              dot
              label={user.status === 'active' ? 'Active' : (user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase() : 'Active')}
              size="sm"
            />
          </View>
        </View>

        {/* Consequences & Statutory Compliance Notice */}
        <View
          style={[
            styles.consequencesBox,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)',
            },
          ]}
        >
          <View style={styles.consequencesHeader}>
            <AlertTriangle size={15} color="#d97706" />
            <Text variant="caption" weight="semibold" style={{ color: '#d97706' }}>
              Consequences &amp; Compliance Notice
            </Text>
          </View>
          <Text variant="caption" style={[styles.consequenceItem, { color: theme.colors.ink }]}>
            • Account access and authentication credentials will be immediately revoked.
          </Text>
          <Text variant="caption" style={[styles.consequenceItem, { color: theme.colors.ink }]}>
            • Active machine allocations and site supervisor links will be detached.
          </Text>
          <Text variant="caption" style={[styles.consequenceItem, { color: theme.colors.mute }]}>
            • Statutory machinery running logs (HMR), breakdown records, and payroll data are preserved under the Factories Act (1948). The account will be safely deactivated to preserve referential integrity.
          </Text>
        </View>

        {/* API Error Banner (if error occurred during deletion) */}
        {errorMessage ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.25)',
              },
            ]}
            accessibilityRole="alert"
          >
            <ShieldAlert size={16} color={theme.colors.error} />
            <View style={styles.errorTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.error }}>
                Deletion Failed
              </Text>
              <Text variant="caption" style={{ color: theme.colors.error }}>
                {errorMessage}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <Touchable
            preset="button"
            onPress={onClose}
            disabled={isDeleting}
            style={[
              styles.cancelBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel Deletion"
          >
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              Cancel
            </Text>
          </Touchable>

          <Touchable
            preset="button"
            onPress={handleConfirmPress}
            disabled={isDeleting}
            style={[
              styles.deleteBtn,
              {
                backgroundColor: theme.colors.error,
                opacity: isDeleting ? 0.75 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Confirm User Deletion"
          >
            {isDeleting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text variant="caption" weight="semibold" style={styles.deleteBtnText}>
                  Deleting...
                </Text>
              </View>
            ) : (
              <Text variant="caption" weight="semibold" style={styles.deleteBtnText}>
                Delete User
              </Text>
            )}
          </Touchable>
        </View>
      </View>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialogCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.35)',
      },
      default: {
        elevation: 32,
      },
    }),
  },
  innerContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingNumeric.sm,
  },
  dialogTitle: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacingNumeric.md,
    paddingHorizontal: 12,
  },
  employeeCard: {
    width: '100%',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
  },
  employeeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeMetaWrap: {
    flex: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  consequencesBox: {
    width: '100%',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
  consequencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  consequenceItem: {
    marginBottom: 4,
  },
  errorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    marginBottom: spacingNumeric.md,
  },
  errorTextCol: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  deleteBtnText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default DeleteUserConfirmDialog;
