/**
 * ReachInternational Mobile — Dedicated Font Size Settings Screen
 * Route: /settings/fontsize
 * 
 * Provides interactive font scaling selection, live typography preview,
 * and a Save Changes action that commits updates app-wide.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Badge,
  Button,
  useTheme,
  Text,
  useToast,
} from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../components/settings';
import { useTypeScale } from '../../../lib/typography/TypeScaleProvider';
import {
  radiusNumeric,
  spacingNumeric,
  FONT_SCALE_PRESETS,
  type FontScalePreset,
} from '@reachinternational/design-tokens';
import {
  Type,
  Check,
  Eye,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';

interface FontOption {
  id: FontScalePreset;
  title: string;
  percentage: string;
}

const FONT_OPTIONS: FontOption[] = [
  { id: 'small', title: 'Small', percentage: '92%' },
  { id: 'medium', title: 'Default (Medium)', percentage: '100%' },
  { id: 'large', title: 'Large', percentage: '120%' },
];

export default function FontSizeScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { preset, setPreset } = useTypeScale();
  const { toast } = useToast();

  const [selectedPreset, setSelectedPreset] = useState<FontScalePreset>(preset);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = (optId: FontScalePreset) => {
    haptics.select();
    setSelectedPreset(optId);
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      setPreset(selectedPreset);
      haptics.confirm();
      toast('success', `Font size set to ${selectedPreset.toUpperCase()}`);
      setTimeout(() => {
        router.back();
      }, 300);
    } catch (err: any) {
      toast('error', 'Failed to save font size');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsScreenContainer
      title="Font Size"
      showBack={true}
      onPressBack={() => router.back()}
      contentContainerStyle={styles.containerContent}
    >
      {/* 1. Selection Options Card */}
      <Card
        variant="elevated"
        style={[
          styles.optionsCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {FONT_OPTIONS.map((opt, index) => {
          const isSelected = selectedPreset === opt.id;
          const isLast = index === FONT_OPTIONS.length - 1;

          return (
            <React.Fragment key={opt.id}>
              <Pressable
                variant="listRow"
                haptic="select"
                onPress={() => handleSelect(opt.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${opt.title} font size (${opt.percentage})`}
                style={styles.optionRow}
              >
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                      backgroundColor: isSelected ? theme.colors.link : 'transparent',
                    },
                  ]}
                >
                  {isSelected ? <Check size={12} color="#ffffff" /> : null}
                </View>

                <View style={styles.optionTextCol}>
                  <Text
                    variant="subheading"
                    style={{ color: theme.colors.ink }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: theme.colors.mute }}
                  >
                    {opt.percentage}
                  </Text>
                </View>
              </Pressable>

              {!isLast ? (
                <View
                  style={[
                    styles.rowDivider,
                    { backgroundColor: theme.colors.hairline },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </Card>

      {/* 2. Live Typography Preview Card */}
      <Card
        variant="elevated"
        style={[
          styles.previewCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.previewHeaderRow}>
          <Eye size={16} color={theme.colors.link} />
          <Text
            variant="subheading"
            style={[styles.previewHeaderTitle, { color: theme.colors.ink }]}
          >
            Live Preview
          </Text>
        </View>

        <View
          style={[
            styles.previewInnerBox,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            JCB 3DX EcoXcellence #M-104
          </Text>
          <Text variant="body" style={{ color: theme.colors.mute }}>
            Operator shift active • Current HMR: 4,821.5 hrs
          </Text>

          <View style={styles.previewPillsRow}>
            <Badge status="active" customLabel="OPERATIONAL" />
            <Badge status="neutral" customLabel="SHIFT #1" />
          </View>
        </View>
      </Card>

      {/* 3. Save Button */}
      <Button
        label={isSaving ? 'Saving...' : 'Save Changes'}
        onPress={handleSave}
        variant="primary"
        shape="pill"
        fullWidth
        style={styles.saveBtn}
      />
    </SettingsScreenContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    gap: 14,
  },
  optionsCard: {
    padding: 0,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  previewCard: {
    padding: 16,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 12,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewHeaderTitle: {
    flex: 1,
  },
  previewInnerBox: {
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
  },
  previewPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveBtn: {
    marginTop: spacingNumeric.sm,
  },
});
