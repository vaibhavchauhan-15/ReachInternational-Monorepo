/**
 * Reusable Mobile User Touch Card Component
 * Extracted from users.tsx for clean presentation-logic separation.
 */

import React, { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Badge, Text, HighlightText, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  User,
  Phone,
  MapPin,
  Mail,
  Clock,
  Wrench,
  ShieldCheck,
  CheckSquare,
  Square,
  MoreVertical,
} from '../ui/icon';
import type { UserRecord } from './UserDetailModal';

export interface AnchorCoords {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function formatRoleName(role: string): string {
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
      return role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'User';
  }
}

export function getRoleAccentColor(role: string): string {
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

function truncateText(str?: string | null, maxChars: number = 22): string {
  if (!str) return '';
  return str.length > maxChars ? `${str.slice(0, maxChars)}…` : str;
}

export interface UserTouchCardProps {
  user: UserRecord;
  isSelected: boolean;
  isSelectMode: boolean;
  theme: any;
  onPress: (user: UserRecord) => void;
  onLongPress: (user: UserRecord) => void;
  searchTerm?: string;
  onViewDetails: (user: UserRecord) => void;
  onEdit?: (user: UserRecord) => void;
  onDelete?: (user: UserRecord) => void;
  onAssignSupervisor?: (user: UserRecord) => void;
  onAssignMachine?: (user: UserRecord) => void;
  onResetPassword?: (user: UserRecord) => void;
  onOpenMoreActions?: (user: UserRecord, anchor?: AnchorCoords | null) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canAssignSupervisor?: boolean;
  canAssignMachine?: boolean;
  canResetPwd?: boolean;
}

function areUserTouchCardPropsEqual(prev: UserTouchCardProps, next: UserTouchCardProps): boolean {
  return (
    prev.user.id === next.user.id &&
    prev.user.status === next.user.status &&
    prev.user.role === next.user.role &&
    prev.user.full_name === next.user.full_name &&
    prev.user.email === next.user.email &&
    prev.user.phone === next.user.phone &&
    prev.user.shift_time === next.user.shift_time &&
    prev.user.city === next.user.city &&
    prev.user.district === next.user.district &&
    prev.user.state === next.user.state &&
    prev.user.supervisor_id === next.user.supervisor_id &&
    prev.user.supervisor?.full_name === next.user.supervisor?.full_name &&
    (prev.user.assigned_machines?.length ?? 0) === (next.user.assigned_machines?.length ?? 0) &&
    prev.isSelected === next.isSelected &&
    prev.isSelectMode === next.isSelectMode &&
    prev.searchTerm === next.searchTerm &&
    prev.canEdit === next.canEdit &&
    prev.canDelete === next.canDelete &&
    prev.canAssignSupervisor === next.canAssignSupervisor &&
    prev.canAssignMachine === next.canAssignMachine &&
    prev.canResetPwd === next.canResetPwd &&
    prev.theme?.dark === next.theme?.dark
  );
}

function BaseUserTouchCard({
  user: u,
  isSelected,
  isSelectMode,
  theme,
  onPress,
  onLongPress,
  searchTerm,
  onViewDetails,
  onAssignSupervisor,
  onAssignMachine,
  onOpenMoreActions,
  canAssignSupervisor = false,
  canAssignMachine = false,
}: UserTouchCardProps) {
  const { isDark } = useTheme();
  const accentColor = getRoleAccentColor(u.role);
  const moreBtnRef = useRef<View>(null);

  const handleMorePress = (e?: any) => {
    e?.stopPropagation?.();
    haptics.select();
    if (Platform.OS === 'web' && moreBtnRef.current) {
      const rect = (moreBtnRef.current as any)?.getBoundingClientRect?.();
      if (rect) {
        onOpenMoreActions?.(u, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
    }
    if (moreBtnRef.current?.measureInWindow) {
      moreBtnRef.current.measureInWindow((x, y, width, height) => {
        onOpenMoreActions?.(u, { x, y, width, height });
      });
    } else {
      onOpenMoreActions?.(u, null);
    }
  };

  const hasMeta = Boolean(
    u.employee_id ||
    u.email ||
    u.phone ||
    u.city ||
    u.district ||
    u.state ||
    (u.supervisors && u.supervisors.length > 0) ||
    u.supervisor?.full_name ||
    (u.assigned_machines && u.assigned_machines.length > 0) ||
    u.shift_time
  );

  return (
    <Pressable
      variant="card"
      haptic={false}
      onPress={() => (isSelectMode ? onPress(u) : onViewDetails(u))}
      onLongPress={() => onLongPress(u)}
      accessibilityRole="button"
      accessibilityLabel={`User ${u.full_name || 'Profile'}, role ${formatRoleName(u.role)}`}
      style={(state) => [
        styles.userCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: accentColor,
          borderLeftWidth: 4,
        },
        isSelectMode && isSelected && {
          borderColor: theme.colors.link,
          borderWidth: 1.5,
          borderLeftWidth: 4,
          backgroundColor: theme.colors.canvas,
        },
        state.pressed && {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : 'rgba(0, 0, 0, 0.02)',
        },
        Platform.OS === 'web' && ({
          cursor: 'pointer',
          transition: 'background-color 150ms ease, opacity 150ms ease',
        } as any),
      ]}
    >
      {/* Card Header: Avatar & Name on left; Role & Status Badges side-by-side on right */}
      <View style={styles.userCardHeader}>
          <View style={styles.userAvatarRow}>
            {isSelectMode ? (
              <View style={{ marginRight: 6 }}>
                {isSelected ? (
                  <CheckSquare size={20} color={theme.colors.link} />
                ) : (
                  <Square size={20} color={theme.colors.mute} />
                )}
              </View>
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                <Text variant="label" style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                  {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <HighlightText
                text={truncateText(u.full_name, 28)}
                query={searchTerm}
                variant="label"
                style={[styles.userName, { color: theme.colors.ink, flexShrink: 1 }]}
                numberOfLines={1}
              />
            </View>
          </View>

          {/* Header Right: Standardized 24px Role Badge & Status Badge in ONE ROW */}
          <View style={styles.headerRightActions}>
            <View style={styles.headerBadgesCluster}>
              {/* Role Badge (centralized Badge with theme tokens) */}
              <Badge
                role={u.role}
                label={formatRoleName(u.role)}
                size="md"
              />

              {/* Status Badge (centralized Badge with status dot) */}
              <Badge
                status={u.status}
                dot
                label={u.status === 'active' ? 'Active' : (u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1).toLowerCase() : 'Inactive')}
                size="md"
              />
            </View>
          </View>
        </View>

        {/* Card Metadata Section */}
        {hasMeta && (
          <View style={[styles.cardMetaBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            {u.employee_id ? (
              <View style={styles.metaChipRow}>
                <Badge
                  variant="outline"
                  size="sm"
                  style={[
                    styles.empIdBadge,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <HighlightText
                    text={u.employee_id}
                    query={searchTerm}
                    variant="mono"
                    style={{ color: theme.colors.ink }}
                  />
                </Badge>
              </View>
            ) : null}

            {u.email ? (
              <View style={styles.metaChipRow}>
                <Mail size={12} color={theme.colors.mute} />
                <HighlightText
                  text={u.email}
                  query={searchTerm}
                  variant="caption"
                  style={[styles.metaChipText, { color: theme.colors.ink }]}
                  numberOfLines={1}
                />
              </View>
            ) : null}

            {u.phone ? (
              <View style={styles.metaChipRow}>
                <Phone size={12} color={theme.colors.mute} />
                <HighlightText
                  text={u.phone}
                  query={searchTerm}
                  variant="mono"
                  style={[styles.metaChipText, { color: theme.colors.ink }]}
                />
              </View>
            ) : null}

            {Boolean(u.city || u.district || u.state) && (
              <View style={styles.metaChipRow}>
                <MapPin size={12} color={theme.colors.mute} />
                <HighlightText
                  text={[u.city, u.district, u.state].filter(Boolean).join(', ')}
                  query={searchTerm}
                  variant="caption"
                  style={[styles.metaChipText, { color: theme.colors.mute }]}
                  numberOfLines={1}
                />
              </View>
            )}

            {Boolean((u.supervisors && u.supervisors.length > 0) || u.supervisor?.full_name) && (
              <View style={styles.metaChipRow}>
                <User size={12} color="#0d9488" />
                <Text variant="caption" style={[styles.metaChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                  Supervisor: {u.supervisors && u.supervisors.length > 0
                    ? u.supervisors.map((s: any) => s.full_name).join(', ')
                    : u.supervisor?.full_name}
                </Text>
              </View>
            )}

            {Boolean(u.assigned_machines && u.assigned_machines.length > 0) && (
              <View style={styles.metaChipRow}>
                <Wrench size={12} color="#d97706" />
                <Text variant="caption" style={[styles.metaChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                  Machines: {u.assigned_machines?.map((m) => m.machine_id).join(', ')}
                </Text>
              </View>
            )}

            {Boolean(u.shift_time) && (
              <View style={styles.metaChipRow}>
                <Clock size={12} color={theme.colors.mute} />
                <Text variant="caption" style={[styles.metaChipText, { color: theme.colors.mute }]}>
                  Shift: {u.shift_time}
                </Text>
              </View>
            )}
          </View>
        )}

      {/* Action Buttons Toolbar at bottom: STRICTLY 3 actions (3-dot More, Assign Machine, Supervisor) */}
      <View style={[styles.cardActionsContainer, { borderTopColor: theme.colors.hairline }]}>
        {/* 1. 3-Dot More Actions Button */}
        <View ref={moreBtnRef} collapsable={false}>
          <Pressable
            variant="buttonOutline"
            hitSlopToMin48
            onPress={handleMorePress}
            style={[
              styles.actionPillBtn,
              {
                borderColor: isDark ? '#383838' : theme.colors.hairline,
                backgroundColor: isDark ? '#262626' : '#ffffff',
              },
            ]}
          >
            <MoreVertical size={13} color={theme.colors.ink} />
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              More
            </Text>
          </Pressable>
        </View>

        {/* 2. Assign Machine */}
        {canAssignMachine && onAssignMachine && (
          <Pressable
            variant="buttonOutline"
            hitSlopToMin48
            onPress={(e?: any) => {
              e?.stopPropagation?.();
              haptics.select();
              onAssignMachine(u);
            }}
            style={[
              styles.actionPillBtn,
              {
                borderColor: isDark ? '#383838' : theme.colors.hairline,
                backgroundColor: isDark ? '#262626' : '#ffffff',
              },
            ]}
          >
            <Wrench size={12} color={theme.colors.ink} />
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              Assign Machine
            </Text>
          </Pressable>
        )}

        {/* 3. Assign Supervisor */}
        {canAssignSupervisor && onAssignSupervisor && (
          <Pressable
            variant="buttonOutline"
            hitSlopToMin48
            onPress={(e?: any) => {
              e?.stopPropagation?.();
              haptics.select();
              onAssignSupervisor(u);
            }}
            style={[
              styles.actionPillBtn,
              {
                borderColor: isDark ? '#383838' : theme.colors.hairline,
                backgroundColor: isDark ? '#262626' : '#ffffff',
              },
            ]}
          >
            <ShieldCheck size={12} color={theme.colors.ink} />
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              Supervisor
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export const UserTouchCard = React.memo(BaseUserTouchCard, areUserTouchCardPropsEqual);

const styles = StyleSheet.create({
  userCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    textAlign: 'center',
  },
  userName: {
    flexShrink: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  headerBadgesCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipBadge: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardMetaBox: {
    padding: spacingNumeric.xs,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: spacingNumeric.xs,
    gap: 4,
  },
  metaChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  empIdBadge: {
    alignSelf: 'flex-start',
  },
  metaChipText: {
    flexShrink: 1,
  },
  cardActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
  },
});
