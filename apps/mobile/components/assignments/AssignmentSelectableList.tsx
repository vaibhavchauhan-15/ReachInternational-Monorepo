/**
 * ReachInternational Mobile — Assignment Selectable List
 *
 * Performant selectable candidate list for workforce and machinery selection.
 * Supports single and multiple selection modes, monochromatic initials avatars,
 * employee ID and machine ID badges, conflict warnings, and min 44px touch targets.
 *
 * Invariants:
 * - 100% Geist Design System tokens & zero raw typography properties
 * - Monochromatic avatars (light: #171717 ink / dark: #ffffff elevated)
 * - Tactile haptics on selection toggles
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { getUserInitials } from '@reachinternational/utils';
import { Check, AlertCircle, Phone, Mail, User, Truck } from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { EmptyState } from '../ui/EmptyState';

export interface AssignmentCandidateItem {
  id: string;
  title: string;
  code?: string | null;
  subtitle?: string | null;
  phone?: string | null;
  email?: string | null;
  statusBadge?: string | null;
  entityType?: 'user' | 'machine';
  disabled?: boolean;
  conflictNotice?: string | null;
  isAlreadyAssigned?: boolean;
}

export interface AssignmentSelectableListProps {
  candidates: AssignmentCandidateItem[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  selectionMode?: 'single' | 'multiple';
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  maxSelectable?: number;
}

export const AssignmentSelectableList: React.FC<AssignmentSelectableListProps> = ({
  candidates,
  selectedIds,
  onSelect,
  selectionMode = 'single',
  isLoading = false,
  emptyTitle = 'No candidates found',
  emptyDescription = 'No eligible candidates match your search criteria.',
  maxSelectable,
}) => {
  const { theme, isDark } = useTheme();

  const handleRowPress = useCallback(
    (item: AssignmentCandidateItem) => {
      if (item.disabled || item.isAlreadyAssigned) {
        haptics.reject();
        return;
      }
      haptics.select();
      onSelect(item.id);
    },
    [onSelect]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text variant="caption" style={{ color: theme.colors.mute }}>
          Loading candidate list...
        </Text>
      </View>
    );
  }

  if (candidates.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <View style={styles.listContainer}>
      {candidates.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const initials = getUserInitials(item.title);
        const isDisabled = Boolean(item.disabled || item.isAlreadyAssigned);

        return (
          <Pressable
            key={item.id}
            onPress={() => handleRowPress(item)}
            disabled={isDisabled}
            style={[
              styles.candidateCard,
              {
                backgroundColor: isSelected
                  ? isDark
                    ? 'rgba(2, 132, 199, 0.12)'
                    : 'rgba(2, 132, 199, 0.06)'
                  : theme.colors.canvasElevated,
                borderColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.hairline,
                opacity: isDisabled ? 0.6 : 1,
              },
            ]}
            accessibilityRole={selectionMode === 'single' ? 'radio' : 'checkbox'}
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            accessibilityLabel={`${item.title}${item.code ? `, ID ${item.code}` : ''}`}
          >
            {/* Left: Monochromatic Avatar or Machine Icon */}
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
                  {initials || 'U'}
                </Text>
              </View>
            )}

            {/* Middle: Details */}
            <View style={styles.detailsCol}>
              <View style={styles.titleRow}>
                <Text
                  variant="body"
                  weight="semibold"
                  style={{ color: theme.colors.ink }}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.code && (
                  <View
                    style={[
                      styles.codeBadge,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                      {item.code}
                    </Text>
                  </View>
                )}
                {item.isAlreadyAssigned && (
                  <Badge status="active" size="sm" customLabel="ASSIGNED" />
                )}
              </View>

              {item.subtitle && (
                <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              )}

              {/* Conflict / Overlap Alert */}
              {item.conflictNotice && (
                <View style={styles.conflictRow}>
                  <AlertCircle size={12} color="#f59e0b" />
                  <Text variant="micro" style={{ color: '#f59e0b' }} numberOfLines={1}>
                    {item.conflictNotice}
                  </Text>
                </View>
              )}
            </View>

            {/* Right: Selection Checkbox / Radio */}
            <View
              style={[
                styles.indicatorCircle,
                selectionMode === 'multiple' && styles.indicatorSquare,
                {
                  borderColor: isSelected ? theme.colors.primary : theme.colors.hairline,
                  backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                },
              ]}
            >
              {isSelected && <Check size={12} color="#ffffff" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.sm,
  },
  listContainer: {
    gap: spacingNumeric.sm,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    gap: spacingNumeric.md,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCol: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flexWrap: 'wrap',
  },
  codeBadge: {
    paddingHorizontal: spacingNumeric.xs,
    paddingVertical: 1,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  indicatorCircle: {
    width: 20,
    height: 20,
    borderRadius: radiusNumeric.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSquare: {
    borderRadius: radiusNumeric.xs,
  },
});
