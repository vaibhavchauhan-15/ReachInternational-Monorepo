/**
 * ReachInternational Mobile — Font Size Settings Screen
 * Route: /settings/preferences/font-size
 * 
 * Provides interactive font scaling selection, live typography preview
 * with authentic shift log card data, and a Save Changes action that
 * commits updates app-wide.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  Button,
  useTheme,
  Text,
  useToast,
} from '../../../../components/ui';
import { Pressable } from '../../../../components/ui/touch/Pressable';
import { SettingsScreenContainer } from '../../../../components/settings';
import { useTypeScale, TypeScaleScope } from '../../../../lib/typography/TypeScaleProvider';
import {
  radiusNumeric,
  spacingNumeric,
  type FontScalePreset,
} from '@reachinternational/design-tokens';
import {
  Check,
  Clock,
  Wrench,
  Truck,
  Gauge,
  Building2,
  MapPin,
} from '../../../../components/ui/icon';
import { haptics } from '../../../../lib/haptics';

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

/**
 * Preview component for a realistic, clean, and formatted Shift Log card.
 * Scoped inside <TypeScaleScope> so all typography, dimensions, and iconography
 * respond in real-time to selected font scale preset changes.
 */
function ShiftCardPreview() {
  const { theme, isDark } = useTheme();
  const { scale } = useTypeScale();

  const avatarDim = Math.round(34 * scale);
  const iconSz = Math.max(10, Math.round(12 * scale));
  const dotDim = Math.max(4, Math.round(5 * scale));

  return (
    <View
      style={[
        styles.previewShiftCard,
        {
          backgroundColor: isDark
            ? 'rgba(2, 132, 199, 0.05)'
            : 'rgba(2, 132, 199, 0.03)',
          borderColor: isDark ? '#0284c755' : '#7dd3fc',
          borderLeftColor: '#10b981',
          borderLeftWidth: 4,
        },
      ]}
      accessibilityLabel="Shift Log Preview, Rajesh Kumar, Shift A, Status: ENTERED"
    >
      {/* LINE 1: Operator Name (Left) + Shift Log Status (Right) */}
      <View style={styles.cardHeader}>
        <View style={styles.userAvatarRow}>
          <View
            style={[
              styles.avatarCircle,
              {
                width: avatarDim,
                height: avatarDim,
                borderRadius: avatarDim / 2,
                backgroundColor: '#0284c7',
              },
            ]}
          >
            <Text variant="heading" style={{ color: '#ffffff' }}>
              R
            </Text>
          </View>
          <View style={styles.operatorNameCol}>
            <Text
              variant="subheading"
              style={{ color: theme.colors.ink }}
              numberOfLines={1}
            >
              Rajesh Kumar
            </Text>
          </View>
        </View>

        {/* Right Header: Shift Log Status Badge */}
        <View
          style={[
            styles.cardStatusBadge,
            {
              backgroundColor: isDark ? '#064e3b26' : '#d1fae5',
              borderColor: '#10b98133',
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                width: dotDim,
                height: dotDim,
                borderRadius: dotDim / 2,
                backgroundColor: '#10b981',
              },
            ]}
          />
          <Text
            variant="caption"
            style={[
              styles.cardStatusText,
              { color: isDark ? '#34d399' : '#047857' },
            ]}
          >
            ENTERED
          </Text>
        </View>
      </View>

      {/* STRUCTURED METADATA BOX (6 Focused Key-Value Rows) */}
      <View
        style={[
          styles.cardMetaBox,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Row 1: Shift */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Clock size={iconSz} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Shift:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.link }} numberOfLines={1}>
            A
          </Text>
        </View>

        {/* Row 2: M/C Model */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Wrench size={iconSz} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              M/C Model:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.ink }} numberOfLines={1}>
            JCB 3DX Super
          </Text>
        </View>

        {/* Row 3: M/C Sr no */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Truck size={iconSz} color={theme.colors.link} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              M/C Sr no:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.link }} numberOfLines={1}>
            JCB3DX-2024-001
          </Text>
        </View>

        {/* Row 4: HMR */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Gauge size={iconSz} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              HMR:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.ink }} numberOfLines={1}>
            {"1272.5->1279"}
          </Text>
        </View>

        {/* Row 5: Client */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <Building2 size={iconSz} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Client:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.ink }} numberOfLines={1}>
            Larsen & Toubro ECC
          </Text>
        </View>

        {/* Row 6: Site */}
        <View style={styles.metaFieldRow}>
          <View style={styles.metaFieldLabelGroup}>
            <MapPin size={iconSz} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Site:
            </Text>
          </View>
          <Text variant="caption" style={{ color: theme.colors.ink }} numberOfLines={1}>
            Delhi
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function FontSizeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { preset, setPreset } = useTypeScale();
  const { toast } = useToast();

  const [selectedPreset, setSelectedPreset] = useState<FontScalePreset>(preset);
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = () => {
    router.replace('/settings/preferences');
  };

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
        handleBack();
      }, 250);
    } catch {
      toast('error', 'Failed to save font size');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsScreenContainer
      title="Font Size"
      showBack={true}
      backRoute="/settings/preferences"
      onPressBack={handleBack}
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
          <Text
            variant="subheading"
            style={[styles.previewHeaderTitle, { color: theme.colors.ink }]}
          >
            Preview
          </Text>
        </View>

        {/* Live preview scoped strictly to selectedPreset */}
        <TypeScaleScope preset={selectedPreset}>
          <ShiftCardPreview />
        </TypeScaleScope>
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
  },
  previewHeaderTitle: {
    flex: 1,
  },
  previewShiftCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorNameCol: {
    flex: 1,
    minWidth: 0,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {},
  cardStatusText: {},
  cardMetaBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  metaFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaFieldLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveBtn: {
    marginTop: spacingNumeric.sm,
  },
});
