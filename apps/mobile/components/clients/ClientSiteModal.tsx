import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AppModal, Button, Input, Text, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { X } from '../ui/icon';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';

export interface ClientSiteModalProps {
  visible: boolean;
  onClose: () => void;
  siteTargetClientId?: string | null;
  targetClientName?: string;
  siteFormName: string;
  setSiteFormName: (val: string) => void;
  siteFormStreet: string;
  setSiteFormStreet: (val: string) => void;
  siteFormCity: string;
  setSiteFormCity: (val: string) => void;
  siteFormDistrict: string;
  setSiteFormDistrict: (val: string) => void;
  siteFormPincode: string;
  setSiteFormPincode: (val: string) => void;
  onSaveSite: () => void;
  isSavingSite?: boolean;
}

export const ClientSiteModal: React.FC<ClientSiteModalProps> = ({
  visible,
  onClose,
  siteTargetClientId,
  targetClientName,
  siteFormName,
  setSiteFormName,
  siteFormStreet,
  setSiteFormStreet,
  siteFormCity,
  setSiteFormCity,
  siteFormDistrict,
  setSiteFormDistrict,
  siteFormPincode,
  setSiteFormPincode,
  onSaveSite,
  isSavingSite = false,
}) => {
  const { theme } = useTheme();

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom">
      <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text variant="heading" style={{ color: theme.colors.ink }}>Add Operating Site</Text>
            <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
              {siteTargetClientId
                ? (targetClientName || 'Existing Client')
                : 'Register an operational facility'}
            </Text>
          </View>
          <Pressable variant="iconButton" hitSlopToMin48 onPress={onClose} accessibilityLabel="Close site modal">
            <X size={20} color={theme.colors.mute} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Site Name *</Text>
              <Input
                value={siteFormName}
                onChangeText={setSiteFormName}
                placeholder="e.g. Pune Manufacturing Facility"
                placeholderTextColor={theme.colors.mute}
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Street / Area *</Text>
              <Input
                value={siteFormStreet}
                onChangeText={setSiteFormStreet}
                placeholder="e.g. Plot 42, MIDC Phase 2"
                placeholderTextColor={theme.colors.mute}
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>City / Town *</Text>
                <Input
                  value={siteFormCity}
                  onChangeText={setSiteFormCity}
                  placeholder="e.g. Pune"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>District *</Text>
                <Input
                  value={siteFormDistrict}
                  onChangeText={setSiteFormDistrict}
                  placeholder="e.g. Pune"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>State (Default: MH)</Text>
                <Input
                  value="Maharashtra"
                  editable={false}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.mute, backgroundColor: theme.colors.canvas, minHeight: 44 }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>Pincode (6 digits) *</Text>
                <Input
                  value={siteFormPincode}
                  onChangeText={setSiteFormPincode}
                  placeholder="411001"
                  placeholderTextColor={theme.colors.mute}
                  keyboardType="numeric"
                  maxLength={6}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button label="Cancel" variant="outline" onPress={onClose} disabled={isSavingSite} />
          <Button label={isSavingSite ? 'Saving...' : 'Save Site'} variant="primary" onPress={onSaveSite} disabled={isSavingSite} />
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    padding: spacingNumeric.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.md,
  },
  formSection: {
    marginBottom: spacingNumeric.md,
    gap: spacingNumeric.xs,
  },
  formGroup: {
    gap: 4,
    marginBottom: spacingNumeric.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
  },
});
