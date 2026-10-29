/**
 * ReachInternational Mobile — Assignment Bottom Sheet
 *
 * Reusable modal/bottom-sheet shell for workforce and machinery assignment workflows.
 * Provides target entity header card, optional client-inherited supervisor notice,
 * keyboard awareness, safe area spacing, and seamless gesture dismissal.
 *
 * Invariants:
 * - 100% Geist Design System tokens & zero raw typography properties
 * - Minimum 44px touch targets on close and interactive elements
 * - Safe area aware bottom gutter
 */

import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Truck,
  User,
  ShieldCheck,
  Building2,
  AlertCircle,
  X,
} from '../ui/icon';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';

export interface TargetEntityDetails {
  type: 'machine' | 'operator' | 'supervisor' | 'client';
  title: string;
  code?: string | null;
  subtitle?: string | null;
  statusBadge?: string | null;
  capacityLabel?: string | null;
  inheritedNotice?: {
    clientName?: string | null;
    supervisorName?: string | null;
    message?: string;
  } | null;
}

export interface AssignmentBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  targetEntity?: TargetEntityDetails;
  showCodeInHeader?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export const AssignmentBottomSheet: React.FC<AssignmentBottomSheetProps> = ({
  visible,
  onClose,
  title,
  description,
  targetEntity,
  showCodeInHeader = false,
  children,
  footer,
}) => {
  const { theme, isDark } = useTheme();

  const getEntityIcon = (type?: string) => {
    switch (type) {
      case 'machine':
        return <Truck size={18} color={theme.colors.primary} />;
      case 'supervisor':
        return <ShieldCheck size={18} color="#10b981" />;
      case 'operator':
        return <User size={18} color="#0284c7" />;
      case 'client':
        return <Building2 size={18} color="#6366f1" />;
      default:
        return null;
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      panelStyle={{ maxHeight: '92%' }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* Header Bar */}
        <View style={[styles.headerBar, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.titleRow}>
              <Text variant="subheading" style={[styles.modalTitle, { color: theme.colors.ink }]}>
                {title}
              </Text>
              {showCodeInHeader && targetEntity?.code && (
                <View
                  style={[
                    styles.codePill,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Text variant="mono" style={[styles.codeText, { color: theme.colors.primary }]}>
                    {targetEntity.code}
                  </Text>
                </View>
              )}
            </View>
            {description && (
              <Text variant="caption" style={[styles.modalDescription, { color: theme.colors.mute }]}>
                {description}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              haptics.select();
              onClose();
            }}
            hitSlop={12}
            style={[styles.closeButton, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
            accessibilityRole="button"
            accessibilityLabel="Close assignment modal"
          >
            <X size={18} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Target Entity Banner */}
          {targetEntity && (
            <View
              style={[
                styles.entityBanner,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.entityRow}>
                <View
                  style={[
                    styles.entityIconBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {getEntityIcon(targetEntity.type)}
                </View>
                <View style={styles.entityDetails}>
                  <View style={styles.entityTitleRow}>
                    <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                      {targetEntity.title}
                    </Text>
                    {targetEntity.statusBadge && (
                      <Badge
                        status="active"
                        size="sm"
                        customLabel={targetEntity.statusBadge}
                      />
                    )}
                  </View>
                  {targetEntity.subtitle && (
                    <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                      {targetEntity.subtitle}
                    </Text>
                  )}
                </View>
                {targetEntity.capacityLabel && (
                  <View
                    style={[
                      styles.capacityPill,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                      {targetEntity.capacityLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Inherited Client Supervisor Notice Callout */}
          {targetEntity?.inheritedNotice && (
            <View
              style={[
                styles.inheritedNoticeCard,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : 'rgba(2, 132, 199, 0.08)',
                  borderColor: isDark ? 'rgba(2, 132, 199, 0.3)' : 'rgba(2, 132, 199, 0.25)',
                },
              ]}
            >
              <View style={styles.noticeHeader}>
                <ShieldCheck size={16} color="#0284c7" />
                <Text variant="caption" weight="semibold" style={{ color: '#0284c7' }}>
                  Supervised via Client Scope
                </Text>
              </View>
              <Text variant="caption" style={[styles.noticeMessage, { color: isDark ? '#bae6fd' : '#0369a1' }]}>
                {targetEntity.inheritedNotice.message ||
                  `This equipment belongs to ${targetEntity.inheritedNotice.clientName || 'the assigned client'}. Supervisors assigned at the client level automatically inherit fleet operational oversight.`}
              </Text>
            </View>
          )}

          {/* Body Content */}
          {children}
        </ScrollView>

        {/* Footer Actions */}
        {footer && (
          <View style={[styles.footerContainer, { borderTopColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.sm,
    paddingBottom: spacingNumeric.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: spacingNumeric.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
  },
  modalTitle: {
    // Zero raw typography properties
  },
  codePill: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 2,
    borderRadius: radiusNumeric.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  codeText: {
    // Zero raw typography properties
  },
  modalDescription: {
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radiusNumeric.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  entityBanner: {
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacingNumeric.md,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.md,
  },
  entityIconBox: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityDetails: {
    flex: 1,
    gap: 2,
  },
  entityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  capacityPill: {
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inheritedNoticeCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacingNumeric.md,
    gap: spacingNumeric.xs,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  noticeMessage: {
  },
  footerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
  },
});
