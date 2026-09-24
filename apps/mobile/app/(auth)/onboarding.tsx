import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { Button, Input, Card, TimeInput, useTheme, ReachInternationalLogo } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  computeShiftTiming,
  parseProfileShiftTime,
} from '@reachinternational/utils';
import {
  MobilePickedDocument,
  UserDocumentInfo,
  fetchUserDocuments,
  uploadUserDocumentDirect,
  deleteUserDocument,
} from '../../lib/documents';
import { MobileDocumentUploadCard } from '../../components/documents/MobileDocumentUploadCard';
import {
  MobileFormSectionCard,
  MobileAddressFields,
  MobileSalaryField,
  MobileSubmitButton,
} from '../../components/forms';
import {
  User as UserIcon,
  Phone,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  X,
  Check,
  Info,
} from 'lucide-react-native';

const ONBOARDING_ROLES = [
  { value: 'operator', label: 'Operator', desc: 'Machine duty & daily running hour logs' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Equipment monitoring & shift supervision' },
  { value: 'manager', label: 'Manager', desc: 'Fleet operations, client accounts & asset management' },
  { value: 'hr', label: 'HR', desc: 'Staff onboarding & personnel management' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, userProfile, refreshSession } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('08:00 PM');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Document attachments
  const [existingDocs, setExistingDocs] = useState<Record<string, UserDocumentInfo>>({});
  const [aadhaarDoc, setAadhaarDoc] = useState<MobilePickedDocument | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<MobilePickedDocument | null>(null);
  const [aadhaarUploading, setAadhaarUploading] = useState(false);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [aadhaarProgress, setAadhaarProgress] = useState(0);
  const [licenseProgress, setLicenseProgress] = useState(0);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-fill fields from existing profile if available
  useEffect(() => {
    if (userProfile) {
      if (userProfile.full_name && userProfile.full_name !== user?.email) {
        setFullName(userProfile.full_name);
      }
      if (userProfile.phone) setPhone(userProfile.phone);
      if (userProfile.role) setSelectedRole(userProfile.role);
      if ((userProfile as any).monthly_salary) {
        setMonthlySalary(String((userProfile as any).monthly_salary));
      }
      if (userProfile.shift_time) {
        const parsed = parseProfileShiftTime(userProfile.shift_time);
        if (parsed && parsed.startTime && parsed.endTime) {
          setShiftStartTime(parsed.startTime);
          setShiftEndTime(parsed.endTime);
        }
      }
      if (userProfile.city) setCity(userProfile.city);
      if (userProfile.district) setDistrict(userProfile.district);
      if ((userProfile as any).street) {
        setStreet((userProfile as any).street);
      } else if (userProfile.address) {
        setStreet(userProfile.address);
      }
      if (userProfile.state) setStateVal(userProfile.state);
      if (userProfile.state_id) setStateId(userProfile.state_id);
      if (userProfile.aadhaar_number) setAadhaarNumber(formatAadhaar(userProfile.aadhaar_number));
      if (userProfile.license_number) setLicenseNumber(userProfile.license_number);
    }
  }, [userProfile, user]);

  // Load existing documents
  useEffect(() => {
    if (user?.id) {
      fetchUserDocuments(user.id).then((docs) => {
        const map: Record<string, UserDocumentInfo> = {};
        docs.forEach((d) => {
          map[d.document_type_code] = d;
        });
        setExistingDocs(map);
      });
    }
  }, [user?.id]);

  const handleUploadDoc = async (
    typeCode: 'aadhaar' | 'driving_license',
    doc: MobilePickedDocument
  ) => {
    if (!user?.id) return;

    if (typeCode === 'aadhaar') {
      setAadhaarUploading(true);
      setAadhaarProgress(10);
      setAadhaarError(null);
    } else {
      setLicenseUploading(true);
      setLicenseProgress(10);
      setLicenseError(null);
    }

    try {
      const res = await uploadUserDocumentDirect({
        userId: user.id,
        documentTypeCode: typeCode,
        doc,
        onProgress: (p) => {
          if (typeCode === 'aadhaar') setAadhaarProgress(p);
          else setLicenseProgress(p);
        },
      });

      if (!res.success) {
        if (typeCode === 'aadhaar') setAadhaarError(res.error || 'Upload failed');
        else setLicenseError(res.error || 'Upload failed');
      } else {
        const docs = await fetchUserDocuments(user.id);
        const map: Record<string, UserDocumentInfo> = {};
        docs.forEach((d) => {
          map[d.document_type_code] = d;
        });
        setExistingDocs(map);
        if (typeCode === 'aadhaar') setAadhaarDoc(null);
        else setLicenseDoc(null);
      }
    } catch (err: any) {
      if (typeCode === 'aadhaar') setAadhaarError(err.message || 'Upload error');
      else setLicenseError(err.message || 'Upload error');
    } finally {
      if (typeCode === 'aadhaar') setAadhaarUploading(false);
      else setLicenseUploading(false);
    }
  };

  const handleDeleteDoc = async (typeCode: 'aadhaar' | 'driving_license') => {
    if (!user?.id) return;
    const existing = existingDocs[typeCode];
    if (!existing) return;

    const res = await deleteUserDocument(user.id, typeCode, existing.storage_path);
    if (res.success) {
      setExistingDocs((prev) => {
        const next = { ...prev };
        delete next[typeCode];
        return next;
      });
    }
  };

  useEffect(() => {
    if (userProfile?.complete_profile === true || userProfile?.complete_profile === 'yes') {
      router.replace('/(app)/dashboard' as any);
    }
  }, [userProfile, router]);

  const selectedRoleObj = ONBOARDING_ROLES.find((r) => r.value === selectedRole) || ONBOARDING_ROLES[0];

  const shiftSummary = React.useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    return computeShiftTiming({
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [shiftStartTime, shiftEndTime]);

  const handleComplete = async () => {
    if (isSubmittingRef.current || isLoading) return;
    setErrorMessage('');

    // Validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Full name is required (minimum 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Valid 10-digit mobile number is required.');
      return;
    }
    if (!shiftStartTime.trim()) {
      setErrorMessage('Shift start time is required.');
      return;
    }
    if (!shiftEndTime.trim()) {
      setErrorMessage('Shift end time is required.');
      return;
    }
    if (!city.trim() || city.trim().length < 2) {
      setErrorMessage('City/Town/Village is required.');
      return;
    }
    if (!district.trim() || district.trim().length < 2) {
      setErrorMessage('District is required.');
      return;
    }
    if (!stateVal.trim() && !stateId) {
      setErrorMessage('State is required.');
      return;
    }

    const effectiveRole = userProfile?.role || selectedRole;
    if (effectiveRole === 'operator') {
      const sal = Number(monthlySalary);
      if (!monthlySalary || isNaN(sal) || sal <= 0) {
        setErrorMessage('Monthly salary is mandatory for operator accounts and must be greater than 0.');
        return;
      }
    }

    if (!aadhaarNumber.trim()) {
      setErrorMessage('Aadhaar card number is required.');
      return;
    }
    const aadhaarRes = validateAadhaarNumber(aadhaarNumber);
    if (!aadhaarRes.isValid) {
      setErrorMessage(aadhaarRes.error || 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    const cleanAadhaar = aadhaarRes.clean || null;

    let formattedLic: string | null = null;
    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        setErrorMessage(licRes.error || 'Please enter a valid driving licence number.');
        return;
      }
      formattedLic = licRes.formatted || licenseNumber.trim().toUpperCase();
    }

    const finalShift =
      shiftStartTime.trim() && shiftEndTime.trim()
        ? `${shiftStartTime.trim()} - ${shiftEndTime.trim()}`
        : shiftStartTime.trim() || shiftEndTime.trim() || null;

    if (!user?.id) {
      setErrorMessage('Authentication session expired. Please log in again.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      // 1. Attempt atomic RPC
      const { error: rpcError } = await supabase.rpc('complete_user_onboarding_atomic', {
        p_user_id: user.id,
        p_full_name: fullName.trim(),
        p_phone: cleanPhone,
        p_role: effectiveRole,
        p_shift_time: finalShift,
        p_address: street.trim(),
        p_city: city.trim(),
        p_district: district.trim(),
        p_state: stateVal.trim(),
        p_state_id: stateId,
        p_aadhaar_number: cleanAadhaar,
        p_license_number: formattedLic,
      });

      if (!rpcError && (monthlySalary || street.trim())) {
        await supabase
          .from('users')
          .update({
            street: street.trim(),
            address: street.trim(),
            monthly_salary: monthlySalary ? Number(monthlySalary) : null,
          })
          .eq('id', user.id);
      }

      if (rpcError) {
        // Fallback: direct table update
        console.warn('[Mobile Onboarding] RPC error, using direct table update fallback:', rpcError.message);
        const { error: directError } = await supabase
          .from('users')
          .update({
            full_name: fullName.trim(),
            phone: cleanPhone,
            shift_start_time: shiftStartTime.trim() || null,
            shift_end_time: shiftEndTime.trim() || null,
            street: street.trim(),
            address: street.trim(),
            monthly_salary: monthlySalary ? Number(monthlySalary) : null,
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateId,
            aadhaar_number: cleanAadhaar,
            license_number: formattedLic,
            complete_profile: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (directError) {
          setErrorMessage(directError.message || 'Failed to update profile. Please try again.');
          isSubmittingRef.current = false;
          setIsLoading(false);
          return;
        }
      }

      await refreshSession();

      router.replace('/(app)/dashboard' as any);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const effectiveRole = userProfile?.role || selectedRole;

  const section1Complete = Boolean(
    fullName.trim().length >= 2 &&
    cleanPhone.length >= 10 &&
    (effectiveRole !== 'operator' || (monthlySalary && Number(monthlySalary) > 0))
  );

  const section2Complete = Boolean(
    shiftStartTime.trim().length > 0 &&
    shiftEndTime.trim().length > 0
  );

  const section3Complete = Boolean(
    city.trim().length >= 2 &&
    district.trim().length >= 2 &&
    (stateVal.trim().length > 0 || stateId !== null)
  );

  const section4Complete = Boolean(
    aadhaarNumber.replace(/\D/g, '').length === 12
  );

  const isAllMandatoryFilled = Boolean(
    section1Complete && section2Complete && section3Complete && section4Complete
  );

  const missingFields: string[] = [];
  if (!fullName.trim() || fullName.trim().length < 2) missingFields.push('Full Name');
  if (cleanPhone.length < 10) missingFields.push('10-digit Phone');
  if (effectiveRole === 'operator' && (!monthlySalary || Number(monthlySalary) <= 0)) missingFields.push('Monthly Salary');
  if (!shiftStartTime.trim() || !shiftEndTime.trim()) missingFields.push('Shift Hours');
  if (!city.trim() || city.trim().length < 2) missingFields.push('City/Town');
  if (!district.trim() || district.trim().length < 2) missingFields.push('District');
  if (!stateVal.trim() && !stateId) missingFields.push('State');
  if (aadhaarNumber.replace(/\D/g, '').length !== 12) missingFields.push('12-digit Aadhaar');

  const missingMandatoryCount = missingFields.length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.canvas }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <View style={styles.header}>
          <ReachInternationalLogo size={26} style={{ marginBottom: 14 }} />
          <View style={[styles.badge, { backgroundColor: theme.colors.link + '18', borderColor: theme.colors.link + '30' }]}>
            <Text style={[styles.badgeText, { color: theme.colors.link }]}>Setup Required</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Complete Profile</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            Fill in your shift timings, operational site, and identity records to activate your account.
          </Text>
        </View>

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error + '40' }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <Card variant="elevated" style={styles.formCard}>
          {/* Section 1: Account Information & Role */}
          <MobileFormSectionCard
            stepNumber={1}
            title="Account & Role"
            description="Your full name, phone number, and organization role."
            isMandatory={true}
            isCompleted={section1Complete}
          >
            <Input
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Rahul Sharma"
              autoCapitalize="words"
              leftIcon={<UserIcon size={16} color={theme.colors.mute} />}
            />

            <Input
              label="Mobile Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              leftIcon={<Phone size={16} color={theme.colors.mute} />}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.colors.ink }]}>
                Assigned Role <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectTrigger,
                  { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated },
                ]}
                onPress={() => setRoleModalVisible(true)}
              >
                <View style={styles.selectTriggerContent}>
                  <Text style={[styles.selectTriggerText, { color: theme.colors.ink }]}>
                    {selectedRoleObj.label}
                  </Text>
                  <Text style={[styles.selectTriggerDesc, { color: theme.colors.mute }]} numberOfLines={1}>
                    {selectedRoleObj.desc}
                  </Text>
                </View>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            {/* Monthly Salary Input for Operators */}
            {effectiveRole === 'operator' && (
              <View style={{ paddingTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.hairline }}>
                <MobileSalaryField
                  value={monthlySalary}
                  onChangeText={setMonthlySalary}
                  role={effectiveRole}
                />
              </View>
            )}
          </MobileFormSectionCard>

          {/* Section 2: Work Shift Schedule */}
          <MobileFormSectionCard
            stepNumber={2}
            title="Work Shift Schedule"
            description="Assigned shift schedule for operations."
            isMandatory={true}
            isCompleted={section2Complete}
          >
            <View style={styles.timeInputsRow}>
              <View style={styles.timeInputCol}>
                <TimeInput
                  label="Shift Start"
                  value={shiftStartTime}
                  onChange={setShiftStartTime}
                  required
                />
              </View>
              <View style={styles.timeInputCol}>
                <TimeInput
                  label="Shift End"
                  value={shiftEndTime}
                  onChange={setShiftEndTime}
                  required
                />
              </View>
            </View>

            {shiftSummary?.isValid && (
              <View style={[styles.shiftBadge, { backgroundColor: theme.colors.link + '15', borderColor: theme.colors.link + '30' }]}>
                <Text style={[styles.shiftBadgeText, { color: theme.colors.link }]}>
                  {shiftSummary.isOvernight ? '🌙' : '☀️'} {shiftSummary.durationFormatted}
                </Text>
              </View>
            )}
          </MobileFormSectionCard>

          {/* Section 3: Work Location & Address */}
          <MobileFormSectionCard
            stepNumber={3}
            title="Work Location & Address"
            description="Operating site address and geographic base."
            isMandatory={true}
            isCompleted={section3Complete}
          >
            <MobileAddressFields
              street={street}
              city={city}
              district={district}
              stateName={stateVal}
              stateId={stateId}
              onStreetChange={setStreet}
              onCityChange={setCity}
              onDistrictChange={setDistrict}
              onStateChange={(id, name) => {
                setStateId(id);
                setStateVal(name);
              }}
              required={true}
            />
          </MobileFormSectionCard>

          {/* Section 4: Identity Verification */}
          <MobileFormSectionCard
            stepNumber={4}
            title="Identity Verification"
            description="Regulatory identity compliance documents."
            isMandatory={true}
            isCompleted={section4Complete}
          >
            <Input
              label="Aadhaar Card Number *"
              value={aadhaarNumber}
              onChangeText={(val) => setAadhaarNumber(formatAadhaar(val))}
              placeholder="12-digit Aadhaar Number"
              keyboardType="number-pad"
              maxLength={14}
              leftIcon={<ShieldCheck size={16} color={theme.colors.mute} />}
            />

            <MobileDocumentUploadCard
              title="Aadhaar Card Document"
              subtitle="Front image or PDF (max 2 MB)"
              docTypeCode="aadhaar"
              selectedDoc={aadhaarDoc}
              existingDoc={existingDocs['aadhaar']}
              onDocSelected={(doc) => {
                setAadhaarDoc(doc);
                handleUploadDoc('aadhaar', doc);
              }}
              onDocRemoved={() => {
                if (existingDocs['aadhaar']) {
                  handleDeleteDoc('aadhaar');
                } else {
                  setAadhaarDoc(null);
                }
              }}
              uploading={aadhaarUploading}
              uploadProgress={aadhaarProgress}
              errorMessage={aadhaarError}
            />

            <Input
              label="Driving Licence Number (Optional)"
              value={licenseNumber}
              onChangeText={(val) => setLicenseNumber(val.toUpperCase())}
              placeholder="e.g. MH12 20110012345"
              autoCapitalize="characters"
              maxLength={25}
              leftIcon={<CreditCard size={16} color={theme.colors.mute} />}
            />

            <MobileDocumentUploadCard
              title="Driving Licence Document"
              subtitle="Front scan or PDF (max 2 MB)"
              docTypeCode="driving_license"
              selectedDoc={licenseDoc}
              existingDoc={existingDocs['driving_license']}
              onDocSelected={(doc) => {
                setLicenseDoc(doc);
                handleUploadDoc('driving_license', doc);
              }}
              onDocRemoved={() => {
                if (existingDocs['driving_license']) {
                  handleDeleteDoc('driving_license');
                } else {
                  setLicenseDoc(null);
                }
              }}
              uploading={licenseUploading}
              uploadProgress={licenseProgress}
              errorMessage={licenseError}
            />
          </MobileFormSectionCard>

          {/* One-Time Reassurance Banner */}
          <View style={[styles.noticeBox, { backgroundColor: theme.colors.link + '12', borderColor: theme.colors.link + '30' }]}>
            <Info size={16} color={theme.colors.link} style={{ marginTop: 1 }} />
            <Text style={[styles.noticeText, { color: theme.colors.link, flex: 1 }]}>
              <Text style={{ fontWeight: '700' }}>Fast One-Time Setup: </Text>
              Your profile is verified once and saved permanently. Subsequent logins will route directly to your dashboard.
            </Text>
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <MobileSubmitButton
              isReady={isAllMandatoryFilled}
              isLoading={isLoading}
              onPress={handleComplete}
              label="Complete Profile & Enter"
              loadingLabel="Saving Profile..."
              missingCount={missingMandatoryCount}
              helperText="All required details completed. Ready to activate profile."
            />
          </View>
        </Card>
      </ScrollView>

      {/* Role Picker Modal */}
      <Modal visible={roleModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={[styles.modalHeader, { borderColor: theme.colors.hairline }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Your Role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} hitSlop={8}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {ONBOARDING_ROLES.map((r) => {
                const isSelected = selectedRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.modalOption,
                      { borderColor: theme.colors.hairline },
                      isSelected && { backgroundColor: theme.colors.link + '15' },
                    ]}
                    onPress={() => {
                      setSelectedRole(r.value);
                      setRoleModalVisible(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: isSelected ? theme.colors.link : theme.colors.ink }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                        {r.desc}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={theme.colors.link} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.lg,
    paddingBottom: spacingNumeric['3xl'],
  },
  header: {
    marginBottom: spacingNumeric.lg,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  formCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
  },
  sectionContainer: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  stepPill: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInputCol: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#ef4444',
  },
  selectTrigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectTriggerContent: {
    flex: 1,
    marginRight: 8,
  },
  selectTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectTriggerDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 16,
  },
  submitContainer: {
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: radiusNumeric.md,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
