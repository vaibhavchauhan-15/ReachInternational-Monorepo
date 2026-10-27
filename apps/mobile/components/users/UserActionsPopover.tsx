import React from 'react';
import { View, StyleSheet, ScrollView, Modal } from 'react-native';
import { Text, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { X, Edit2, KeyRound, UserX, UserCheck, Trash2 } from '../ui/icon';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import type { UserRecord } from './UserDetailModal';
import { formatRoleName } from './UserTouchCard';

export interface UserActionsPopoverProps {
  user: UserRecord | null;
  position: { top: number; left: number; width: number; maxHeight: number };
  onClose: () => void;
  onEdit: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onToggleStatus: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
  canEdit?: boolean;
  canResetPassword?: boolean;
  canToggleStatus?: boolean;
  canDelete?: boolean;
  currentAuthUserId?: string;
  currentUserRole?: string;
}

export const UserActionsPopover: React.FC<UserActionsPopoverProps> = ({
  user,
  position,
  onClose,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
  canEdit = true,
  canResetPassword = true,
  canToggleStatus = false,
  canDelete = false,
  currentAuthUserId,
  currentUserRole,
}) => {
  const { theme, isDark } = useTheme();

  if (!user) return null;

  const isSelf = currentAuthUserId === user.id;
  const isTargetSuperAdmin = user.role === 'super_admin';
  const isAdminTargetingSuperAdmin = currentUserRole === 'admin' && isTargetSuperAdmin;
  const canMutatePrivileged = !isSelf && !isAdminTargetingSuperAdmin;

  return (
    <Modal
      visible={Boolean(user)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.popoverBackdrop}
        onPress={onClose}
        accessibilityLabel="Close contextual menu"
        accessibilityRole="button"
      >
        <Pressable
          style={[
            styles.popoverMenuCard,
            {
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
          onPress={(e) => {
            e?.stopPropagation?.();
          }}
        >
          {/* Header info */}
          <View style={[styles.popoverUserHeader, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.popoverHeaderInfo}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink, width: 26, height: 26 }]}>
                <Text variant="caption" weight="bold" style={{ color: theme.colors.canvas }}>
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                  {user.full_name}
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                  {formatRoleName(user.role)} {user.employee_id ? `• ${user.employee_id}` : ''}
                </Text>
              </View>
            </View>
            <Pressable
              variant="plain"
              hitSlopToMin48
              onPress={onClose}
              style={styles.popoverHeaderCloseBtn}
              accessibilityLabel="Close popover"
            >
              <X size={15} color={theme.colors.mute} />
            </Pressable>
          </View>

          {/* Scrollable Actions List */}
          <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false} bounces={false}>
            {/* 1. Edit User Details */}
            {canEdit && (
              <Pressable
                variant="plain"
                hitSlopToMin48
                style={[styles.popoverActionItem, { borderBottomColor: theme.colors.hairline }]}
                onPress={() => {
                  onClose();
                  onEdit(user);
                }}
              >
                <View style={[styles.popoverActionIconBox, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.1)' }]}>
                  <Edit2 size={14} color={theme.colors.link} />
                </View>
                <Text variant="caption" weight="medium" style={{ color: theme.colors.ink, flex: 1 }}>Edit User Details</Text>
              </Pressable>
            )}

            {/* 2. Reset Password */}
            {canResetPassword && (
              <Pressable
                variant="plain"
                hitSlopToMin48
                style={[
                  styles.popoverActionItem,
                  (canToggleStatus || canDelete) && canMutatePrivileged
                    ? { borderBottomColor: theme.colors.hairline }
                    : { borderBottomWidth: 0 },
                ]}
                onPress={() => {
                  onClose();
                  onResetPassword(user);
                }}
              >
                <View style={[styles.popoverActionIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)' }]}>
                  <KeyRound size={14} color="#f59e0b" />
                </View>
                <Text variant="caption" weight="medium" style={{ color: theme.colors.ink, flex: 1 }}>Reset Password</Text>
              </Pressable>
            )}

            {/* 3. Activate / Deactivate Account */}
            {canToggleStatus && canMutatePrivileged && (
              <Pressable
                variant="plain"
                hitSlopToMin48
                style={[
                  styles.popoverActionItem,
                  canDelete
                    ? { borderBottomColor: theme.colors.hairline }
                    : { borderBottomWidth: 0 },
                ]}
                onPress={() => {
                  onClose();
                  onToggleStatus(user);
                }}
              >
                <View
                  style={[
                    styles.popoverActionIconBox,
                    user.status === 'active'
                      ? { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }
                      : { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)' },
                  ]}
                >
                  {user.status === 'active' ? (
                    <UserX size={14} color={theme.colors.error} />
                  ) : (
                    <UserCheck size={14} color="#10b981" />
                  )}
                </View>
                <Text
                  variant="caption"
                  weight="medium"
                  style={{
                    flex: 1,
                    color: user.status === 'active' ? theme.colors.error : '#10b981',
                  }}
                >
                  {user.status === 'active' ? 'Deactivate User Account' : 'Activate User Account'}
                </Text>
              </Pressable>
            )}

            {/* 4. Delete Account */}
            {canDelete && canMutatePrivileged && (
              <Pressable
                variant="plain"
                hitSlopToMin48
                style={[styles.popoverActionItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  onClose();
                  onDelete(user);
                }}
              >
                <View style={[styles.popoverActionIconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <Trash2 size={14} color={theme.colors.error} />
                </View>
                <Text variant="caption" weight="medium" style={{ color: theme.colors.error, flex: 1 }}>
                  Delete User
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  popoverMenuCard: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  popoverUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  popoverHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircle: {
    borderRadius: radiusNumeric.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popoverHeaderCloseBtn: {
    padding: 4,
  },
  popoverActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  popoverActionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
