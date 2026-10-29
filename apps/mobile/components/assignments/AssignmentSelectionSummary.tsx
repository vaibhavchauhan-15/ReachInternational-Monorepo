/**
 * ReachInternational Mobile — Assignment Selection Summary
 *
 * Visual roster summary displaying currently selected/assigned operators or equipment.
 * Features capacity meter (e.g. 2 / 3 Shifts Assigned), progress dots,
 * monochromatic avatars, shift time badges, and removal actions with confirmation.
 *
 * Invariants:
 * - Minimum 44px touch targets on removal buttons
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { getUserInitials } from '@reachinternational/utils';
import { Trash2, Truck, User, AlertCircle } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface SelectedAssignmentSummaryItem {
  id: string; // operatorId or machineId
  title: string;
  code?: string | null;
  employeeId?: string | null;
  subtitle?: string | null;
  shiftCode?: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  entityType?: 'user' | 'machine';
  assignmentId?: string;
}

export interface AssignmentSelectionSummaryProps {
  items: SelectedAssignmentSummaryItem[];
  onRemove: (item: SelectedAssignmentSummaryItem) => void;
  maxCapacity?: number;
  title?: string;
  capacityLabel?: string;
  disabled?: boolean;
}

export const AssignmentSelectionSummary: React.FC<AssignmentSelectionSummaryProps> = ({
  items,
  onRemove,
  maxCapacity = 3,
  title = 'ASSIGNED OPERATORS (24H)',
  capacityLabel,
  disabled = false,
}) => {
  const { theme, isDark } = useTheme();
  const [confirmTarget, setConfirmTarget] = useState<SelectedAssignmentSummaryItem | null>(null);

  const handleConfirmRemove = () => {
    if (confirmTarget) {
      haptics.confirm();
      onRemove(confirmTarget);
      setConfirmTarget(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Title and Capacity Badge */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithDots}>
          <Text variant="caption" weight="semibold" style={{ color: theme.colors.mute }}>
            {title}
          </Text>
          {/* Capacity Progress Dots */}
          {maxCapacity > 1 && (
            <View style={styles.dotsRow}>
              {Array.from({ length: maxCapacity }).map((_, i) => {
                const isFilled = i < items.length;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isFilled
                          ? theme.colors.primary
                          : theme.colors.hairline,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>

        <Badge
          status={items.length >= maxCapacity ? 'warning' : 'active'}
          size="sm"
          customLabel={capacityLabel || `${items.length}/${maxCapacity} Assigned`}
        />
      </View>

      {/* Roster Cards List */}
      {items.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="caption" style={{ color: theme.colors.mute }}>
            No personnel or equipment assigned yet. Select from the candidate list below.
          </Text>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {items.map((item, index) => {
            const initials = getUserInitials(item.title);
            const shiftBadgeText = item.shiftCode
              ? item.shiftCode.trim().toLowerCase().startsWith('shift')
                ? item.shiftCode.trim()
                : `Shift ${item.shiftCode.trim()}`
              : null;
            const empId = item.employeeId || item.code || item.subtitle;

            return (
              <View
                key={`${item.id}-${item.shiftCode || index}`}
                style={[
                  styles.rosterCard,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                {/* Index & Avatar */}
                <View style={styles.leftRow}>
                  <View
                    style={[
                      styles.indexPill,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="micro" weight="bold" style={{ color: theme.colors.mute }}>
                      #{index + 1}
                    </Text>
                  </View>

                  {item.entityType === 'machine' ? (
                    <View
                      style={[
                        styles.avatarBox,
                        {
                          backgroundColor: isDark ? '#262626' : '#f5f5f5',
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Truck size={16} color={theme.colors.primary} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.avatarBox,
                        {
                          backgroundColor: isDark ? '#ffffff' : '#171717',
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        style={{ color: isDark ? '#171717' : '#ffffff' }}
                      >
                        {initials || 'OP'}
                      </Text>
                    </View>
                  )}

                  {/* Title & Details */}
                  <View style={styles.infoCol}>
                    <View style={styles.titleLine}>
                      <Text
                        variant="body"
                        weight="semibold"
                        style={{ color: theme.colors.ink }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {shiftBadgeText && (
                        <View
                          style={[
                            styles.shiftCodePill,
                            {
                              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.16)' : '#e0f2fe',
                              borderColor: isDark ? '#0284c7' : '#bae6fd',
                            },
                          ]}
                        >
                          <Text variant="micro" weight="bold" style={{ color: '#0284c7' }}>
                            {shiftBadgeText}
                          </Text>
                        </View>
                      )}
                    </View>

                    {empId && (
                      <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                        {empId}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Remove Action Button */}
                <Pressable
                  onPress={() => {
                    if (disabled) return;
                    haptics.select();
                    setConfirmTarget(item);
                  }}
                  disabled={disabled}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.title}`}
                  hitSlop={10}
                >
                  <Trash2 size={16} color="#ef4444" />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Confirmation Dialog for Removal */}
      <ConfirmDialog
        visible={Boolean(confirmTarget)}
        title="Remove Assignment?"
        message={`Are you sure you want to remove ${confirmTarget?.title || 'this assignment'}? This will end their shift coverage on this unit.`}
        confirmText="Remove"
        cancelText="Keep Assigned"
        variant="danger"
        onConfirm={handleConfirmRemove}
        onClose={() => setConfirmTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.xs,
  },
  titleWithDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radiusNumeric.full,
  },
  emptyCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsList: {
    gap: spacingNumeric.xs,
  },
  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  indexPill: {
    width: 24,
    height: 24,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flexWrap: 'wrap',
  },
  codeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shiftDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  shiftCodePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacingNumeric.xs,
  },
});
