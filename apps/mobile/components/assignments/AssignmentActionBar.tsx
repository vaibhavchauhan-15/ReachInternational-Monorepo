/**
 * ReachInternational Mobile — Assignment Action Bar
 *
 * Sticky action footer for assignment bottom sheets.
 * Features unsaved changes indicator badge, error callout banner,
 * secondary Cancel button, and primary Save/Confirm button with spinner.
 *
 * Invariants:
 * - Minimum 44px touch targets
 * - Zero raw typography properties in StyleSheet.create
 * - Vercel Geist design tokens and Light/Dark theme synchronization
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { AlertCircle, Check } from '../ui/icon';
import { haptics } from '../../lib/haptics';

export interface AssignmentActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  hasUnsavedChanges?: boolean;
  error?: string | null;
}

export const AssignmentActionBar: React.FC<AssignmentActionBarProps> = ({
  onSave,
  onCancel,
  isSaving = false,
  saveLabel = 'Save Assignments',
  cancelLabel = 'Cancel',
  disabled = false,
  hasUnsavedChanges = false,
  error,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Error Callout Banner */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
              borderColor: isDark ? '#b91c1c' : '#fecaca',
            },
          ]}
        >
          <AlertCircle size={14} color="#ef4444" style={{ marginTop: 1 }} />
          <Text variant="caption" style={[styles.errorText, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges && !error && (
        <View style={styles.unsavedRow}>
          <View style={[styles.unsavedDot, { backgroundColor: '#f59e0b' }]} />
          <Text variant="micro" weight="medium" style={{ color: '#f59e0b' }}>
            Unsaved assignment changes
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.buttonsRow}>
        <Button
          variant="outline"
          label={cancelLabel}
          onPress={() => {
            haptics.select();
            onCancel();
          }}
          disabled={isSaving}
          style={styles.cancelBtn}
        />
        <Button
          variant="primary"
          label={saveLabel}
          onPress={() => {
            haptics.confirm();
            onSave();
          }}
          disabled={disabled || isSaving}
          loading={isSaving}
          style={styles.saveBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    flex: 1,
  },
  unsavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacingNumeric.xs,
  },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: radiusNumeric.full,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.md,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
  },
  saveBtn: {
    flex: 2,
    minHeight: 44,
  },
});
