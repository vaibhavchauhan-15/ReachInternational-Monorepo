import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { AppModal, Button, Input, Switch, Text, useTheme, useTypeStyle } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { Lock, X, Wrench, Sparkles, CheckCircle2 } from '../ui/icon';
import { CLIENT_SHIFT_PRESETS } from '@reachinternational/utils';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';

export interface ClientItemData {
  id: string;
  client_id?: string;
  code: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  gstin?: string;
  pan_number?: string;
  street?: string;
  address?: string;
  city: string;
  district?: string;
  state: string;
  pincode?: string;
  is_billing_address_different?: boolean;
  billing_address?: string;
  billing_city?: string;
  billing_district?: string;
  billing_state?: string;
  billing_pincode?: string;
  maintenance_allowance_minutes?: number;
  status: 'active' | 'inactive';
}

export interface ClientModalProps {
  visible: boolean;
  onClose: () => void;
  editingClient: ClientItemData | null;
  companyName: string;
  setCompanyName: (val: string) => void;
  contactPerson: string;
  setContactPerson: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  gstin: string;
  setGstin: (val: string) => void;
  panNumber: string;
  setPanNumber: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  district: string;
  setDistrict: (val: string) => void;
  stateName: string;
  setStateName: (val: string) => void;
  pincode: string;
  setPincode: (val: string) => void;
  isBillingAddressDifferent: boolean;
  setIsBillingAddressDifferent: (val: boolean) => void;
  billingAddress: string;
  setBillingAddress: (val: string) => void;
  billingCity: string;
  setBillingCity: (val: string) => void;
  billingDistrict: string;
  setBillingDistrict: (val: string) => void;
  billingState: string;
  setBillingState: (val: string) => void;
  billingPincode: string;
  setBillingPincode: (val: string) => void;
  allowanceHours: string;
  setAllowanceHours: (val: string) => void;
  allowanceMinutes: string;
  setAllowanceMinutes: (val: string) => void;
  selectedPresetId: string;
  setSelectedPresetId: (val: string) => void;
  onSave: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  visible,
  onClose,
  editingClient,
  companyName,
  setCompanyName,
  contactPerson,
  setContactPerson,
  phone,
  setPhone,
  gstin,
  setGstin,
  panNumber,
  setPanNumber,
  address,
  setAddress,
  city,
  setCity,
  district,
  setDistrict,
  stateName,
  setStateName,
  pincode,
  setPincode,
  isBillingAddressDifferent,
  setIsBillingAddressDifferent,
  billingAddress,
  setBillingAddress,
  billingCity,
  setBillingCity,
  billingDistrict,
  setBillingDistrict,
  billingState,
  setBillingState,
  billingPincode,
  setBillingPincode,
  allowanceHours,
  setAllowanceHours,
  allowanceMinutes,
  setAllowanceMinutes,
  selectedPresetId,
  setSelectedPresetId,
  onSave,
}) => {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'bottom'}
      showHandle={false}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 580,
              width: '100%',
              alignSelf: 'center',
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : {
              maxHeight: '92%',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }
      }
    >
      <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
        <View style={styles.modalHeader}>
          <Text variant="heading" style={{ color: theme.colors.ink }}>
            {editingClient ? `Edit (${editingClient.client_id || editingClient.code})` : 'Add New Client'}
          </Text>
          <Pressable variant="iconButton" hitSlopToMin48 onPress={onClose} accessibilityLabel="Close modal">
            <X size={20} color={theme.colors.mute} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <Text variant="label" style={{ color: theme.colors.mute }}>Company & Tax Details</Text>

            {editingClient && (
              <View style={styles.formGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>Client ID</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.canvas, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.hairline }}>
                    <Lock size={10} color="#f59e0b" />
                    <Text variant="mono" style={{ color: theme.colors.mute }}>Permanent</Text>
                  </View>
                </View>
                <Input
                  value={editingClient.client_id || editingClient.code}
                  editable={false}
                  style={[styles.modalInput, useTypeStyle('mono'), { borderColor: theme.colors.hairline, color: theme.colors.mute, backgroundColor: theme.colors.canvas }]}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Company Name *</Text>
              <Input
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Pushpa Infracon Pvt Ltd"
                placeholderTextColor={theme.colors.mute}
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Contact Person</Text>
              <Input
                value={contactPerson}
                onChangeText={setContactPerson}
                placeholder="e.g. Rajesh Sharma"
                placeholderTextColor={theme.colors.mute}
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Phone Number</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor={theme.colors.mute}
                keyboardType="phone-pad"
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>GSTIN Number</Text>
                <Input
                  value={gstin}
                  onChangeText={(t: string) => setGstin(t.toUpperCase())}
                  placeholder="07AAAAA0000A1Z5"
                  placeholderTextColor={theme.colors.mute}
                  autoCapitalize="characters"
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>PAN Number</Text>
                <Input
                  value={panNumber}
                  onChangeText={(t: string) => setPanNumber(t.toUpperCase())}
                  placeholder="ABCDE1234F"
                  placeholderTextColor={theme.colors.mute}
                  autoCapitalize="characters"
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text variant="label" style={{ color: theme.colors.mute, marginBottom: 8 }}>Site Location</Text>

            <View style={styles.formGroup}>
              <Text variant="caption" style={{ color: theme.colors.ink }}>Street / Area *</Text>
              <Input
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                placeholderTextColor={theme.colors.mute}
                style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>City / Town / Village *</Text>
                <Input
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Pune"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>District</Text>
                <Input
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="e.g. Pune"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>State *</Text>
                <Input
                  value={stateName}
                  onChangeText={setStateName}
                  placeholder="e.g. Maharashtra"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>Pincode</Text>
                <Input
                  value={pincode}
                  onChangeText={setPincode}
                  placeholder="411001"
                  placeholderTextColor={theme.colors.mute}
                  keyboardType="numeric"
                  maxLength={6}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.toggleRow}>
              <Text variant="label" style={{ color: theme.colors.mute, marginBottom: 0 }}>Billing Address</Text>
              <View style={styles.switchWrapper}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>Different Address</Text>
                <Switch
                  value={isBillingAddressDifferent}
                  onValueChange={setIsBillingAddressDifferent}
                  trackColor={{ false: theme.colors.hairline, true: theme.colors.primary }}
                />
              </View>
            </View>

            {isBillingAddressDifferent && (
              <View style={{ marginTop: 8 }}>
                <View style={styles.formGroup}>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>Billing Street / Area</Text>
                  <Input
                    value={billingAddress}
                    onChangeText={setBillingAddress}
                    placeholder="e.g. Corporate HQ, 5th Floor, Tower B, Cyber City"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Billing City / Town / Village</Text>
                    <Input
                      value={billingCity}
                      onChangeText={setBillingCity}
                      placeholder="e.g. Gurugram"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Billing District</Text>
                    <Input
                      value={billingDistrict}
                      onChangeText={setBillingDistrict}
                      placeholder="e.g. Gurugram"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Billing State</Text>
                    <Input
                      value={billingState}
                      onChangeText={setBillingState}
                      placeholder="e.g. Haryana"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Billing Pincode</Text>
                    <Input
                      value={billingPincode}
                      onChangeText={setBillingPincode}
                      placeholder="122002"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      maxLength={6}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Section 4: Monthly Maintenance Allowance */}
          <View style={styles.formSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Wrench size={14} color="#d97706" />
                <Text variant="label" style={{ color: theme.colors.mute, marginBottom: 0 }}>Monthly Maintenance Allowance</Text>
              </View>
              {(parseInt(allowanceHours, 10) > 0 || parseInt(allowanceMinutes, 10) > 0) && (
                <View style={{ backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d' }}>
                  <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    {parseInt(allowanceHours, 10) > 0 ? `${allowanceHours}h ` : ''}{parseInt(allowanceMinutes, 10) > 0 ? `${allowanceMinutes}m` : ''} / mo
                  </Text>
                </View>
              )}
            </View>

            <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 8 }}>
              Breakdowns up to this monthly limit per machine are classified as Maintenance instead of B/D. Leave at 0 for no allowance.
            </Text>

            <View style={styles.rowInputs}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>Allowance Hours</Text>
                <Input
                  value={allowanceHours}
                  onChangeText={setAllowanceHours}
                  placeholder="0"
                  placeholderTextColor={theme.colors.mute}
                  keyboardType="numeric"
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>Allowance Minutes</Text>
                <Input
                  value={allowanceMinutes}
                  onChangeText={setAllowanceMinutes}
                  placeholder="0"
                  placeholderTextColor={theme.colors.mute}
                  keyboardType="numeric"
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                />
              </View>
            </View>
          </View>

          {!editingClient && (
            <View style={[styles.formSection, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text variant="label" style={{ color: theme.colors.ink }}>
                  Shift Templates (1-Click Presets)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd' }}>
                  <Sparkles size={10} color={isDark ? '#38bdf8' : '#0284c7'} />
                  <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                    Auto Provision
                  </Text>
                </View>
              </View>

              <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 8 }}>
                Select an operational shift preset for this client. Shifts will be pre-configured upon creation.
              </Text>

              <View style={{ gap: 8 }}>
                {CLIENT_SHIFT_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      variant="cardSelect"
                      haptic="select"
                      onPress={() => setSelectedPresetId(preset.id)}
                      style={{
                        borderWidth: 1.5,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.hairline,
                        backgroundColor: isSelected ? (isDark ? 'rgba(0, 112, 243, 0.1)' : 'rgba(0, 112, 243, 0.05)') : theme.colors.canvasElevated,
                        borderRadius: radiusNumeric.sm,
                        padding: 10,
                        minHeight: 44,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Text variant="body" style={{ color: isSelected ? theme.colors.primary : theme.colors.ink }}>
                          {preset.name}
                        </Text>
                        {isSelected ? (
                          <CheckCircle2 size={16} color={theme.colors.primary} />
                        ) : (
                          <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.mute }} />
                        )}
                      </View>
                      <Text variant="caption" style={{ color: isSelected ? theme.colors.primary : theme.colors.mute, marginBottom: 4 }}>
                        {preset.badge}
                      </Text>
                      {preset.shifts.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                          {preset.shifts.map((s) => (
                            <View
                              key={s.code}
                              style={{
                                backgroundColor: theme.colors.canvas,
                                borderWidth: 1,
                                borderColor: theme.colors.hairline,
                                borderRadius: 4,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                              }}
                            >
                              <Text variant="mono" style={{ color: theme.colors.ink }}>
                                {s.code}: {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={onSave} />
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    padding: spacingNumeric.lg,
    maxHeight: '100%',
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
  },
});
