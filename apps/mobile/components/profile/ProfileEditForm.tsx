import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { showToast } from '../ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { ProfileUpdateSchema } from '@reachinternational/validation';
import { notifyProfileUpdated } from '../../lib/notifications';
import { MobileFormSectionCard } from '../forms';
import { MobileAddressFields } from '../forms/MobileAddressFields';
import { MobileDocumentUploadCard } from '../documents/MobileDocumentUploadCard';
import {
  User,
  CreditCard,
  Shield,
  Lock,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
} from '../ui/icon';
import {
  type MobilePickedDocument,
  type UserDocumentInfo,
  uploadPendingDocumentToStorage,
} from '../../lib/documents';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  validateBankAccountNumber,
  validateIfscCode,
} from '@reachinternational/utils';
import { haptics } from '../../lib/haptics';

export interface ProfileEditFormProps {
  currentUser?: any;
  existingDocuments?: UserDocumentInfo[];
  pendingRequest?: any | null;
  onSuccess?: (req?: any) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export function ProfileEditForm({
  currentUser,
  existingDocuments = [],
  pendingRequest = null,
  onSuccess,
  onCancel,
  isModal = false,
}: ProfileEditFormProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, userProfile: authProfile, refreshSession } = useAuth();

  // 1. Personal Information State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [stateId, setStateId] = useState<number | string | null>(null);

  // 2. Banking Details State
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  // 3. Identity and Statutory Details State
  const [aadhaar, setAadhaar] = useState('');
  const [license, setLicense] = useState('');

  // 4. Document Selection State
  const [selectedDocs, setSelectedDocs] = useState<Record<string, MobilePickedDocument | null>>({
    bank_document: null,
    aadhaar: null,
    driving_license: null,
  });
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // 5. Pending Request State & Submission
  const [activePendingRequest, setActivePendingRequest] = useState<any | null>(pendingRequest);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 6. Errors State
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const src = currentUser || authProfile || {};
    const meta = user?.user_metadata || {};

    setFullName(src.full_name || meta.full_name || '');
    setPhone(src.phone || meta.phone || '');
    setEmail(src.email || meta.email || '');
    setStreet(src.street || src.address || '');
    setCity(src.city || '');
    setDistrict(src.district || '');
    setStateName(src.state || '');
    setStateId(src.state_id || null);
    setBankAccount(src.bank_account_number || '');
    setBankIfsc(src.bank_ifsc_code || '');
    setAadhaar(src.aadhaar_number || '');
    setLicense(src.license_number || '');
    setActivePendingRequest(pendingRequest);
    setErrors({});
  }, [currentUser, authProfile, user, pendingRequest]);

  // Existing documents lookup map
  const activeDocMap = useMemo(() => {
    const map = new Map<string, UserDocumentInfo>();
    existingDocuments.forEach((doc) => {
      map.set(doc.document_type_code, doc);
    });
    return map;
  }, [existingDocuments]);

  // Check if bank details modified
  const isBankModified = useMemo(() => {
    const src = currentUser || authProfile || {};
    const originalAccount = (src.bank_account_number || '').trim();
    const originalIfsc = (src.bank_ifsc_code || '').trim().toUpperCase();
    const currentAccount = bankAccount.trim();
    const currentIfsc = bankIfsc.trim().toUpperCase();

    return (
      (Boolean(currentAccount) && currentAccount !== originalAccount) ||
      (Boolean(currentIfsc) && currentIfsc !== originalIfsc)
    );
  }, [bankAccount, bankIfsc, currentUser, authProfile]);

  // Check if identity details modified
  const isIdentityModified = useMemo(() => {
    const src = currentUser || authProfile || {};
    const origAadhaar = (src.aadhaar_number || '').replace(/\D/g, '');
    const curAadhaar = aadhaar.replace(/\D/g, '');
    const origLic = (src.license_number || '').trim().toUpperCase();
    const curLic = license.trim().toUpperCase();

    return (
      (Boolean(curAadhaar) && curAadhaar !== origAadhaar) ||
      (Boolean(curLic) && curLic !== origLic) ||
      Boolean(selectedDocs.aadhaar) ||
      Boolean(selectedDocs.driving_license)
    );
  }, [aadhaar, license, currentUser, authProfile, selectedDocs]);

  // Validation helper
  const validateField = (field: string, val: string): boolean => {
    const newErrors = { ...errors };

    switch (field) {
      case 'full_name': {
        const trimmed = val.trim();
        if (!trimmed) {
          newErrors.full_name = 'Full name is required.';
        } else if (trimmed.length < 2) {
          newErrors.full_name = 'Full name must be at least 2 characters.';
        } else {
          delete newErrors.full_name;
        }
        break;
      }
      case 'phone': {
        const digits = val.replace(/\D/g, '');
        if (!digits) {
          newErrors.phone = 'Mobile number is required.';
        } else if (digits.length < 10) {
          newErrors.phone = 'Enter a valid 10-digit mobile number.';
        } else {
          delete newErrors.phone;
        }
        break;
      }
      case 'email': {
        const trimmed = val.trim();
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          newErrors.email = 'Enter a valid email address.';
        } else {
          delete newErrors.email;
        }
        break;
      }
      case 'bank_account_number': {
        if (val.trim()) {
          const res = validateBankAccountNumber(val);
          if (!res.isValid) {
            newErrors.bank_account_number = res.error || 'Invalid bank account number.';
          } else {
            delete newErrors.bank_account_number;
          }
        } else {
          delete newErrors.bank_account_number;
        }
        break;
      }
      case 'bank_ifsc_code': {
        if (val.trim()) {
          const res = validateIfscCode(val);
          if (!res.isValid) {
            newErrors.bank_ifsc_code = res.error || 'Invalid IFSC code.';
          } else {
            delete newErrors.bank_ifsc_code;
          }
        } else {
          delete newErrors.bank_ifsc_code;
        }
        break;
      }
      case 'aadhaar_number': {
        if (val.trim()) {
          const res = validateAadhaarNumber(val);
          if (!res.isValid) {
            newErrors.aadhaar_number = res.error || 'Invalid Aadhaar number.';
          } else {
            delete newErrors.aadhaar_number;
          }
        } else {
          delete newErrors.aadhaar_number;
        }
        break;
      }
      case 'license_number': {
        if (val.trim()) {
          const res = validateLicenseNumber(val);
          if (!res.isValid) {
            newErrors.license_number = res.error || 'Invalid driving licence number.';
          } else {
            delete newErrors.license_number;
          }
        } else {
          delete newErrors.license_number;
        }
        break;
      }
    }

    setErrors(newErrors);
    return !newErrors[field];
  };

  const isPersonalMandatoryFilled = Boolean(
    fullName.trim().length >= 2 &&
    !errors.full_name &&
    phone.replace(/\D/g, '').length >= 10 &&
    !errors.phone &&
    street.trim().length >= 2 &&
    city.trim().length >= 2
  );

  // Withdraw pending change request
  const handleWithdrawRequest = async () => {
    if (!activePendingRequest?.id) return;
    haptics.select();
    setIsWithdrawing(true);
    try {
      const { error } = await supabase
        .from('profile_change_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePendingRequest.id);

      if (error) throw error;

      setActivePendingRequest(null);
      showToast('success', 'Request Cancelled', 'Your pending profile change request has been withdrawn.');
    } catch (err: any) {
      console.error('Error withdrawing request:', err);
      showToast('error', 'Withdraw Failed', err?.message || 'Failed to withdraw request.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Submit profile updates
  const handleSubmit = async () => {
    haptics.select();

    const isNameOk = validateField('full_name', fullName);
    const isPhoneOk = validateField('phone', phone);
    const isEmailOk = validateField('email', email);
    const isBankOk = validateField('bank_account_number', bankAccount);
    const isIfscOk = validateField('bank_ifsc_code', bankIfsc);
    const isAadhaarOk = validateField('aadhaar_number', aadhaar);
    const isLicOk = validateField('license_number', license);

    if (!isNameOk || !isPhoneOk || !isEmailOk || !isBankOk || !isIfscOk || !isAadhaarOk || !isLicOk) {
      showToast('warning', 'Validation Error', 'Please fix all highlighted errors before submitting.');
      return;
    }

    if (!street.trim() || !city.trim()) {
      showToast('warning', 'Address Required', 'Street address and city are required.');
      return;
    }

    // Enforce supporting document requirement for banking changes
    if (isBankModified) {
      const hasBankDocSelected = Boolean(selectedDocs.bank_document);
      const hasExistingBankDoc = Boolean(
        activeDocMap.get('bank_document') || activeDocMap.get('bank_passbook')
      );

      if (!hasBankDocSelected && !hasExistingBankDoc) {
        showToast(
          'error',
          'Document Required',
          'Supporting document (Bank passbook or cancelled cheque) is required when updating banking details.'
        );
        return;
      }
    }

    const targetUserId = currentUser?.id || user?.id;
    if (!targetUserId) {
      showToast('error', 'Error', 'User account identifier not found.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Check unique phone against other users
      const digitsOnly = phone.replace(/\D/g, '');
      const { data: existingPhones } = await supabase
        .from('users')
        .select('id, phone')
        .neq('id', targetUserId)
        .not('phone', 'is', null);

      const hasDuplicatePhone = existingPhones?.some((u: any) => {
        if (!u.phone) return false;
        const uDigits = u.phone.replace(/\D/g, '');
        if (digitsOnly.length >= 10 && uDigits.length >= 10) {
          return digitsOnly.slice(-10) === uDigits.slice(-10);
        }
        return digitsOnly === uDigits;
      });

      if (hasDuplicatePhone) {
        showToast('error', 'Duplicate Phone', 'Another user account with this mobile number already exists.');
        setIsSubmitting(false);
        return;
      }

      // 2. Upload any newly selected replacement documents
      const pendingDocsPayload: Record<string, any> = {};

      for (const [code, pickedDoc] of Object.entries(selectedDocs)) {
        if (pickedDoc) {
          const uploadRes = await uploadPendingDocumentToStorage({
            userId: targetUserId,
            documentTypeCode: code,
            doc: pickedDoc,
            onProgress: (pct) => setUploadProgress((p) => ({ ...p, [code]: pct })),
          });

          if (!uploadRes.success || !uploadRes.docInfo) {
            throw new Error(uploadRes.error || `Failed to upload ${code} document.`);
          }

          pendingDocsPayload[code] = uploadRes.docInfo;
        }
      }

      // 3. Always update Personal Information directly on public.users
      const personalUpdate: Record<string, any> = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        street: street.trim(),
        address: street.trim(),
        city: city.trim(),
        district: district.trim(),
        state: stateName.trim(),
        state_id: stateId ? Number(stateId) : null,
        updated_at: new Date().toISOString(),
      };
      if (email.trim()) {
        personalUpdate.email = email.trim().toLowerCase();
      }

      const { error: personalErr } = await supabase
        .from('users')
        .update(personalUpdate)
        .eq('id', targetUserId);

      if (personalErr) throw personalErr;

      // Update Supabase auth user metadata
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            location: `${city.trim()}, ${district.trim()}, ${stateName.trim()}`,
          },
        });
      } catch (authErr) {
        console.warn('Auth metadata update note:', authErr);
      }

      // 4. Handle Banking & Identity Changes
      const hasBankChanges = isBankModified || Boolean(selectedDocs.bank_document);
      const userRole = currentUser?.role || authProfile?.role || 'operator';

      if (userRole === 'super_admin') {
        // Super Admin applies changes directly
        const adminUpdate: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (aadhaar.trim()) adminUpdate.aadhaar_number = aadhaar.trim();
        if (license.trim()) adminUpdate.license_number = license.trim().toUpperCase();
        if (bankAccount.trim()) adminUpdate.bank_account_number = bankAccount.trim();
        if (bankIfsc.trim()) adminUpdate.bank_ifsc_code = bankIfsc.trim().toUpperCase();

        if (Object.keys(adminUpdate).length > 1) {
          await supabase.from('users').update(adminUpdate).eq('id', targetUserId);
        }

        // Upsert approved documents
        for (const [docCode, docInfo] of Object.entries(pendingDocsPayload)) {
          await supabase.from('user_documents').upsert(
            {
              user_id: targetUserId,
              document_type_code: docCode,
              storage_path: docInfo.storage_path,
              mime_type: docInfo.mime_type,
              file_size_bytes: docInfo.file_size_bytes,
              file_name: docInfo.file_name,
              status: 'verified',
              uploaded_by: targetUserId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,document_type_code' }
          );
        }

        showToast('success', 'Profile Updated', 'Your profile details and documents have been updated successfully.');
      } else if (hasBankChanges || isIdentityModified) {
        // Non-Super Admin creates profile_change_requests entry
        const targetApproverRole = userRole === 'admin' ? 'super_admin' : ['manager', 'hr'].includes(userRole) ? 'admin' : 'manager';

        const requestPayload = {
          bank_account_number: bankAccount.trim() || null,
          bank_ifsc_code: bankIfsc.trim().toUpperCase() || null,
          aadhaar_number: aadhaar.trim() || null,
          license_number: license.trim().toUpperCase() || null,
          documents: pendingDocsPayload,
        };

        const currentSnapshot = {
          full_name: currentUser?.full_name,
          phone: currentUser?.phone,
          email: currentUser?.email,
          aadhaar_number: currentUser?.aadhaar_number,
          license_number: currentUser?.license_number,
          bank_account_number: currentUser?.bank_account_number,
          bank_ifsc_code: currentUser?.bank_ifsc_code,
        };

        if (activePendingRequest?.id) {
          await supabase
            .from('profile_change_requests')
            .update({
              requested_data: requestPayload,
              target_approver_role: targetApproverRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activePendingRequest.id);
        } else {
          await supabase
            .from('profile_change_requests')
            .insert({
              user_id: targetUserId,
              requester_role: userRole,
              current_data: currentSnapshot,
              requested_data: requestPayload,
              target_approver_role: targetApproverRole,
              status: 'pending',
            });
        }

        const approverName = targetApproverRole === 'super_admin' ? 'Super Admin' : targetApproverRole === 'admin' ? 'Administrator' : 'Manager';
        showToast(
          'success',
          'Submitted for Review',
          `Personal details saved. Banking & identity updates submitted for approval by ${approverName}. Active documents remain in effect.`
        );
      } else {
        showToast('success', 'Profile Updated', 'Your personal details have been updated successfully.');
      }

      // Refresh cached auth profile
      try {
        await refreshSession();
      } catch (refErr) {
        console.warn('Session refresh note:', refErr);
      }

      notifyProfileUpdated(fullName.trim());
      onSuccess?.();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      showToast('error', 'Update Failed', err?.message || 'Failed to update profile details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approverLabel =
    activePendingRequest?.target_approver_role === 'super_admin'
      ? 'Super Administrator'
      : activePendingRequest?.target_approver_role === 'admin'
      ? 'Administrator'
      : 'Manager';

  return (
    <View style={isModal ? styles.modalContainer : styles.pageContainer}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: isModal ? 24 : Math.max(insets.bottom + 90, 120) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── 0. Pending Approval Card ─── */}
        {activePendingRequest && (
          <View style={[styles.pendingCard, { backgroundColor: isDark ? '#2a1e05' : '#fffbeb', borderColor: isDark ? '#854d0e' : '#fde68a' }]}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingTitleRow}>
                <AlertTriangle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                <Text variant="label" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                  Changes Awaiting Approval
                </Text>
              </View>
              <View style={[styles.pendingBadge, { backgroundColor: isDark ? '#451a03' : '#fef3c7' }]}>
                <Text variant="caption" style={{ color: isDark ? '#f59e0b' : '#b45309' }}>
                  PENDING
                </Text>
              </View>
            </View>

            <Text variant="caption" style={[styles.pendingDesc, { color: theme.colors.mute }]}>
              Updates are under review by your {approverLabel}. Your existing approved details and documents remain active until reviewed.
            </Text>

            <View style={styles.pendingActionRow}>
              <Button
                label="Withdraw Request"
                onPress={handleWithdrawRequest}
                variant="outline"
                size="sm"
                isLoading={isWithdrawing}
                disabled={isWithdrawing || isSubmitting}
                style={styles.withdrawBtn}
              />
            </View>
          </View>
        )}

        {/* ─── 1. Section 1: Personal Details ─── */}
        <MobileFormSectionCard
          title="Personal Information"
          description="Update your contact details and address. Changes save immediately."
          icon={<User size={14} color={theme.colors.link} />}
          isMandatory={true}
          isCompleted={isPersonalMandatoryFilled}
        >
          <Input
            label="Full Name"
            required={true}
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              validateField('full_name', t);
            }}
            onBlur={() => validateField('full_name', fullName)}
            placeholder="e.g. Rahul Sharma"
            error={errors.full_name}
            containerStyle={styles.inputSpacing}
          />

          <Input
            label="Mobile Phone"
            required={true}
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              validateField('phone', t);
            }}
            onBlur={() => validateField('phone', phone)}
            placeholder="e.g. 9876543210"
            keyboardType="phone-pad"
            maxLength={15}
            error={errors.phone}
            containerStyle={styles.inputSpacing}
          />

          <Input
            label="Email Address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              validateField('email', t);
            }}
            onBlur={() => validateField('email', email)}
            placeholder="e.g. rahul.sharma@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            containerStyle={styles.inputSpacing}
          />

          <View style={styles.addressSection}>
            <Text variant="label" style={styles.sectionSubtitle}>
              Residential / Work Address
            </Text>
            <MobileAddressFields
              street={street}
              city={city}
              district={district}
              stateName={stateName}
              stateId={stateId}
              onStreetChange={setStreet}
              onCityChange={setCity}
              onDistrictChange={setDistrict}
              onStateChange={(id, name) => {
                setStateId(id);
                setStateName(name);
              }}
              required={true}
              disabled={isSubmitting}
            />
          </View>
        </MobileFormSectionCard>

        {/* ─── 2. Section 2: Banking Details ─── */}
        <MobileFormSectionCard
          title="Banking Details"
          description="Salary disbursement details. Requires management review and supporting documents."
          icon={<CreditCard size={14} color={theme.colors.link} />}
          isMandatory={false}
          isCompleted={Boolean(bankAccount.trim() && bankIfsc.trim())}
        >
          <Input
            label="Bank Account Number"
            value={bankAccount}
            onChangeText={(t) => {
              setBankAccount(t);
              validateField('bank_account_number', t);
            }}
            onBlur={() => validateField('bank_account_number', bankAccount)}
            placeholder="e.g. 123456789012"
            keyboardType="number-pad"
            error={errors.bank_account_number}
            containerStyle={styles.inputSpacing}
          />

          <Input
            label="IFSC Code"
            value={bankIfsc}
            onChangeText={(t) => {
              const upper = t.toUpperCase();
              setBankIfsc(upper);
              validateField('bank_ifsc_code', upper);
            }}
            onBlur={() => validateField('bank_ifsc_code', bankIfsc)}
            placeholder="e.g. SBIN0001234"
            autoCapitalize="characters"
            maxLength={11}
            error={errors.bank_ifsc_code}
            containerStyle={styles.inputSpacing}
          />

          {isBankModified && (
            <View style={[styles.alertBanner, { backgroundColor: isDark ? '#2a1e05' : '#fffbeb', borderColor: isDark ? '#854d0e' : '#fde68a' }]}>
              <AlertTriangle size={14} color={isDark ? '#fbbf24' : '#d97706'} />
              <View style={styles.alertContent}>
                <Text variant="label" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                  Supporting Document Mandatory
                </Text>
                <Text variant="caption" style={[styles.alertText, { color: theme.colors.mute }]}>
                  Attaching a copy of your bank passbook or cancelled cheque is required when updating banking details.
                </Text>
              </View>
            </View>
          )}

          <MobileDocumentUploadCard
            title="Bank Passbook / Cheque Document"
            subtitle="Upload passbook front page or cancelled cheque"
            docTypeCode="bank_document"
            required={isBankModified}
            selectedDoc={selectedDocs.bank_document}
            existingDoc={activeDocMap.get('bank_document') || activeDocMap.get('bank_passbook')}
            onDocSelected={(doc) => setSelectedDocs((p) => ({ ...p, bank_document: doc }))}
            onDocRemoved={() => setSelectedDocs((p) => ({ ...p, bank_document: null }))}
            uploadProgress={uploadProgress.bank_document || 0}
          />
        </MobileFormSectionCard>

        {/* ─── 3. Section 3: Identity & Statutory Details ─── */}
        <MobileFormSectionCard
          title="Identity and Statutory Details"
          description="Official KYC verification documents. Replaces documents once approved."
          icon={<Shield size={14} color={theme.colors.link} />}
          isMandatory={false}
          isCompleted={Boolean(aadhaar.trim() || license.trim())}
        >
          <Input
            label="Aadhaar Number (12 Digits)"
            value={aadhaar}
            onChangeText={(t) => {
              setAadhaar(t);
              validateField('aadhaar_number', t);
            }}
            onBlur={() => validateField('aadhaar_number', aadhaar)}
            placeholder="e.g. 123456789012"
            keyboardType="number-pad"
            maxLength={14}
            error={errors.aadhaar_number}
            containerStyle={styles.inputSpacing}
          />

          <MobileDocumentUploadCard
            title="Aadhaar Card Document"
            subtitle="Upload front and back copy of Aadhaar"
            docTypeCode="aadhaar"
            selectedDoc={selectedDocs.aadhaar}
            existingDoc={activeDocMap.get('aadhaar')}
            onDocSelected={(doc) => setSelectedDocs((p) => ({ ...p, aadhaar: doc }))}
            onDocRemoved={() => setSelectedDocs((p) => ({ ...p, aadhaar: null }))}
            uploadProgress={uploadProgress.aadhaar || 0}
          />

          <View style={styles.divider} />

          <Input
            label="Driving Licence Number"
            value={license}
            onChangeText={(t) => {
              const upper = t.toUpperCase();
              setLicense(upper);
              validateField('license_number', upper);
            }}
            onBlur={() => validateField('license_number', license)}
            placeholder="e.g. MH1420110062821"
            autoCapitalize="characters"
            maxLength={20}
            error={errors.license_number}
            containerStyle={styles.inputSpacing}
          />

          <MobileDocumentUploadCard
            title="Driving Licence Document"
            subtitle="Upload commercial/private driving licence"
            docTypeCode="driving_license"
            selectedDoc={selectedDocs.driving_license}
            existingDoc={activeDocMap.get('driving_license')}
            onDocSelected={(doc) => setSelectedDocs((p) => ({ ...p, driving_license: doc }))}
            onDocRemoved={() => setSelectedDocs((p) => ({ ...p, driving_license: null }))}
            uploadProgress={uploadProgress.driving_license || 0}
          />
        </MobileFormSectionCard>

        {/* ─── 4. Section 4: Company-Managed Operational Details ─── */}
        <MobileFormSectionCard
          title="Company-Managed Operational Details"
          description="These operational settings are controlled exclusively by authorized management and HR."
          icon={<Lock size={14} color={isDark ? '#a3a3a3' : '#737373'} />}
          isMandatory={false}
        >
          <View style={[styles.readOnlyContainer, { backgroundColor: isDark ? '#171717' : '#f5f5f5', borderColor: theme.colors.hairline }]}>
            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>System Role</Text>
              <Text variant="label">Super Admin / Admin</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Account Status</Text>
              <Text variant="label">Authorized Admin</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Salary, Daily Rate, OT</Text>
              <Text variant="label">Payroll / Management</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Shift & Timings</Text>
              <Text variant="label">Operations Management</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Site Supervisor</Text>
              <Text variant="label">Operations Management</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Working Location / Site</Text>
              <Text variant="label">Operations Management</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Annual PL Quota & Balance</Text>
              <Text variant="label">HR / Leave Management</Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Member Since / Updates</Text>
              <Text variant="label">System-Generated</Text>
            </View>

            <View style={[styles.readOnlyRow, { borderBottomWidth: 0 }]}>
              <Text variant="caption" style={{ color: theme.colors.mute }}>Profile Completion</Text>
              <Text variant="label">System-Calculated</Text>
            </View>
          </View>

          <Text variant="caption" style={[styles.readOnlyNote, { color: theme.colors.mute }]}>
            * Users can view these details in their full profile, but cannot modify them through Edit Profile.
          </Text>
        </MobileFormSectionCard>

        {/* ─── 5. Action Buttons ─── */}
        <View style={styles.actionsRow}>
          {onCancel && (
            <Button
              label="Cancel"
              onPress={() => {
                haptics.select();
                onCancel();
              }}
              variant="outline"
              size="md"
              disabled={isSubmitting}
              style={styles.actionBtn}
            />
          )}
          <Button
            label={
              isSubmitting
                ? 'Saving...'
                : isBankModified || isIdentityModified
                ? 'Save & Submit'
                : 'Save Changes'
            }
            onPress={handleSubmit}
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={!isPersonalMandatoryFilled || isSubmitting}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    maxHeight: '90%',
  },
  pageContainer: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacingNumeric.md,
  },
  inputSpacing: {
    marginBottom: 12,
  },
  sectionSubtitle: {
    marginBottom: 8,
  },
  addressSection: {
    marginTop: 8,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#ebebeb',
    marginVertical: 14,
  },
  pendingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pendingDesc: {
    marginBottom: 10,
  },
  pendingActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  withdrawBtn: {
    minHeight: 36,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    marginTop: 2,
  },
  readOnlyContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  readOnlyNote: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacingNumeric.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
  },
});
