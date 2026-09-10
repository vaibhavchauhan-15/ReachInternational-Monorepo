/**
 * Reach International Mobile — Signup / Registration Screen
 * Exact replication of the Web Mobile Viewport Signup UI/UX.
 * Production-ready with native keyboard management, safe areas, theme adaptation,
 * dynamic status bar contrast, haptic feedback, validation, and full Supabase authentication lifecycle parity.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Input, Alert, TimeInput, useTheme } from '../../components/ui';
import { ReachInternationalLogo } from '../../components/branding/ReachInternationalLogo';
import {
  validateAadhaarNumber,
  validateLicenseNumber,
  formatAadhaar,
  INDIAN_STATES,
  getStateById,
  computeShiftTiming,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import {
  User,
  Mail,
  Phone,
  Lock,
  MapPin,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  X,
  Check,
  Info,
  Search,
  Sun,
  Moon,
} from 'lucide-react-native';

const SIGNUP_ROLES = [
  { value: 'service_engineer', label: 'Service Engineer', desc: 'Field operations & breakdown resolution' },
  { value: 'manager', label: 'Manager', desc: 'Operations, fleet, client contracts & business management' },
  { value: 'service_manager', label: 'Service Manager', desc: 'Service planning, engineer dispatch & FSR approval' },
  { value: 'store_manager', label: 'Store Manager', desc: 'Inventory stock ledger & transfers' },
  { value: 'supervisor', label: 'Supervisor', desc: 'Raise complaints & machine inspection' },
  { value: 'operator', label: 'Operator', desc: 'Machine duty & daily running hour logs' },
  { value: 'mechanic', label: 'Mechanic / Technician', desc: 'Repair work orders & parts request' },
  { value: 'hr_manager', label: 'HR Manager', desc: 'Staff onboarding & payroll management' },
];

export default function SignupScreen() {
  const router = useRouter();
  const { theme, isDark, setMode } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('service_engineer');
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const [shiftStartTime, setShiftStartTime] = useState('08:00 AM');
  const [shiftEndTime, setShiftEndTime] = useState('08:00 PM');

  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [stateId, setStateId] = useState<number | null>(null);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Supervisor Selection State
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
  const [supervisorSearch, setSupervisorSearch] = useState('');

  // Working Location Selection State
  const [workingLocations, setWorkingLocations] = useState<Array<{ id: string; name: string; type: string; city?: string }>>([]);
  const [selectedWorkingLocationId, setSelectedWorkingLocationId] = useState('');
  const [workingLocationModalVisible, setWorkingLocationModalVisible] = useState(false);
  const [workingLocationSearch, setWorkingLocationSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function loadSupervisors() {
      try {
        const { data, error } = await supabase.rpc('get_active_supervisors_public');
        if (!error && data && isMounted) {
          setSupervisors(data as Array<{ id: string; full_name: string; email?: string }>);
        }
      } catch (err) {
        console.warn('Failed to load active supervisors for mobile signup:', err);
      }
    }

    async function loadWorkingLocations() {
      try {
        const { data, error } = await supabase.rpc('get_active_working_locations_public');
        if (!error && data && isMounted) {
          setWorkingLocations(data as Array<{ id: string; name: string; type: string; city?: string }>);
        }
      } catch (err) {
        console.warn('Failed to load active working locations for mobile signup:', err);
      }
    }

    loadSupervisors();
    loadWorkingLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedRoleObj = SIGNUP_ROLES.find((r) => r.value === selectedRole) || SIGNUP_ROLES[0];
  const selectedSupervisor = supervisors.find((s) => s.id === selectedSupervisorId);
  const selectedWorkingLocation = workingLocations.find((l) => l.id === selectedWorkingLocationId);

  const shiftSummary = useMemo(() => {
    if (!shiftStartTime || !shiftEndTime) return null;
    return computeShiftTiming({
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  }, [shiftStartTime, shiftEndTime]);

  const triggerHaptic = () => {
    if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(12);
      } catch {
        // Safe fallback
      }
    }
  };

  const handleAadhaarChange = (val: string) => {
    const formatted = formatAadhaar(val);
    setAadhaarNumber(formatted);
    clearFieldError('aadhaar_number');
    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 12) {
      const res = validateAadhaarNumber(clean);
      if (!res.isValid) {
        setFieldErrors((prev) => ({ ...prev, aadhaar_number: res.error || 'Invalid Aadhaar number' }));
      }
    }
  };

  const handleLicenseChange = (val: string) => {
    const upper = val.toUpperCase();
    setLicenseNumber(upper);
    clearFieldError('license_number');
  };

  const handleSignup = async () => {
    if (isSubmittingRef.current || isLoading) return;
    triggerHaptic();
    setErrorMessage('');
    setSuccessMessage('');

    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.full_name = 'Full name is required (minimum 2 characters).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim().toLowerCase())) {
      errors.email = 'Please enter a valid email address.';
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit mobile number is required.';
    }

    if (isSupervisedRole(selectedRole) && supervisors.length > 0 && !selectedSupervisorId) {
      errors.supervisor_id = 'Please select your designated supervisor.';
    }

    if (!shiftStartTime.trim()) {
      errors.shift_start_time = 'Shift start time is required.';
    }
    if (!shiftEndTime.trim()) {
      errors.shift_end_time = 'Shift end time is required.';
    }

    if (!city.trim() || city.trim().length < 2) {
      errors.city = 'City/Town/Village is required.';
    }
    if (!district.trim() || district.trim().length < 2) {
      errors.district = 'District is required.';
    }
    if (!stateVal.trim() && !stateId) {
      errors.state = 'State is required.';
    }
    if (!address.trim()) {
      errors.address = 'Street / site base address is required.';
    }

    if (!aadhaarNumber.trim()) {
      errors.aadhaar_number = 'Aadhaar card number is required.';
    } else {
      const aadhaarRes = validateAadhaarNumber(aadhaarNumber);
      if (!aadhaarRes.isValid) {
        errors.aadhaar_number = aadhaarRes.error || 'Invalid Aadhaar number.';
      }
    }

    if (licenseNumber.trim()) {
      const licRes = validateLicenseNumber(licenseNumber);
      if (!licRes.isValid) {
        errors.license_number = licRes.error || 'Invalid driving licence format.';
      }
    }

    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else {
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasDigit = /\d/.test(password);
      if (!hasUppercase || !hasLowercase || !hasDigit) {
        errors.password = 'Password must include uppercase, lowercase, and a number.';
      }
    }

    if (password !== confirmPassword) {
      errors.confirm_password = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please correct the highlighted fields before submitting.');
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsLoading(true);

    const finalShift =
      shiftStartTime.trim() && shiftEndTime.trim()
        ? `${shiftStartTime.trim()} - ${shiftEndTime.trim()}`
        : shiftStartTime.trim() || shiftEndTime.trim() || null;

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanPhone,
            role: selectedRole,
            supervisor_id: isSupervisedRole(selectedRole) ? selectedSupervisorId || null : null,
            working_location_id: selectedWorkingLocationId || null,
            shift_time: finalShift,
            shift_start_time: shiftStartTime.trim() || null,
            shift_end_time: shiftEndTime.trim() || null,
            address: address.trim(),
            city: city.trim(),
            district: district.trim(),
            state: stateVal.trim(),
            state_id: stateId,
            location: `${address.trim() ? `${address.trim()}, ` : ''}${city.trim()}, ${district.trim()}, ${stateVal.trim()}`,
            aadhaar_number: aadhaarNumber.replace(/\D/g, ''),
            license_number: licenseNumber.trim().toUpperCase() || null,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        isSubmittingRef.current = false;
        setIsLoading(false);
      } else {
        setSuccessMessage('Registration request submitted! Your account is pending administrator approval.');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2200);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred during signup.');
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const canvasBackground = isDark ? '#0a0a0a' : '#fafafa';
  const cardBackground = isDark ? '#171717' : '#ffffff';
  const cardBorder = isDark ? '#262626' : '#ebebeb';
  const sectionBg = isDark ? 'rgba(10, 10, 10, 0.6)' : 'rgba(250, 250, 250, 0.8)';
  const primarySkyBlue = '#0ea5e9';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: canvasBackground }]}>
      {/* Dynamic Status Bar — Ensures battery, wifi, notifications & time are dark in light theme and light in dark theme */}
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card Container */}
          <View style={styles.centerContainer}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBackground,
                  borderColor: cardBorder,
                },
              ]}
            >
              {/* Brand Logo Centered */}
              <View style={styles.logoContainer}>
                <ReachInternationalLogo size={28} />
              </View>

              {/* Card Title */}
              <Text style={[styles.title, { color: theme.colors.ink }]}>
                Create an account
              </Text>

              {/* Global Error Banner */}
              {errorMessage && Object.keys(fieldErrors).length === 0 ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="error">{errorMessage}</Alert>
                </View>
              ) : null}

              {/* Global Success Banner */}
              {successMessage ? (
                <View style={styles.bannerContainer}>
                  <Alert variant="success">{successMessage}</Alert>
                </View>
              ) : null}

              {/* Section 1: Account & Role */}
              <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor: cardBorder }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: cardBorder }]}>
                  <View style={styles.sectionHeaderTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>1</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      Account & Role
                    </Text>
                  </View>
                </View>

                <Input
                  label="Full Name"
                  required
                  placeholder="Rahul Sharma"
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    clearFieldError('full_name');
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  error={fieldErrors.full_name}
                  leftIcon={<User size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Input
                  label="Email Address"
                  required
                  placeholder="rahul@domain.com"
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    clearFieldError('email');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  error={fieldErrors.email}
                  leftIcon={<Mail size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Input
                  label="Mobile Number"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    clearFieldError('phone');
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  error={fieldErrors.phone}
                  leftIcon={<Phone size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                {/* Role Selector Trigger */}
                <View style={styles.selectGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                    Role Requested <Text style={{ color: '#ef4444', fontWeight: '700' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setRoleModalVisible(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.selectTrigger,
                      {
                        backgroundColor: isDark ? '#121212' : theme.colors.canvasElevated,
                        borderColor: isDark ? '#292c2f' : cardBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectValue, { color: theme.colors.ink }]}>
                        {selectedRoleObj.label}
                      </Text>
                      <Text style={[styles.selectSubtext, { color: theme.colors.mute }]}>
                        {selectedRoleObj.desc}
                      </Text>
                    </View>
                    <ChevronDown size={16} color={isDark ? '#737373' : '#9ca3af'} />
                  </TouchableOpacity>
                </View>

                {/* Conditional Supervisor Selector */}
                {isSupervisedRole(selectedRole) && (
                  <View style={[styles.selectGroup, { paddingTop: 6, borderTopWidth: 1, borderTopColor: cardBorder }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                      Supervisor <Text style={{ color: '#ef4444', fontWeight: '700' }}>*</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={() => setSupervisorModalVisible(true)}
                      activeOpacity={0.7}
                      style={[
                        styles.selectTrigger,
                        {
                          backgroundColor: isDark ? '#121212' : theme.colors.canvasElevated,
                          borderColor: fieldErrors.supervisor_id ? '#ef4444' : isDark ? '#292c2f' : cardBorder,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.selectValue,
                            { color: selectedSupervisor ? theme.colors.ink : isDark ? '#525252' : '#9ca3af' },
                          ]}
                        >
                          {selectedSupervisor ? selectedSupervisor.full_name : 'Select supervisor who oversees your work...'}
                        </Text>
                      </View>
                      <ChevronDown size={16} color={isDark ? '#737373' : '#9ca3af'} />
                    </TouchableOpacity>
                    {fieldErrors.supervisor_id ? (
                      <Text style={styles.errorText}>{fieldErrors.supervisor_id}</Text>
                    ) : null}
                  </View>
                )}

                {/* Working Location Selector */}
                <View style={[styles.selectGroup, { paddingTop: 6, borderTopWidth: 1, borderTopColor: cardBorder }]}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                    Working Location / Site <Text style={{ fontSize: 11, fontWeight: '400', color: theme.colors.mute }}>(Optional)</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setWorkingLocationModalVisible(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.selectTrigger,
                      {
                        backgroundColor: isDark ? '#121212' : theme.colors.canvasElevated,
                        borderColor: isDark ? '#292c2f' : cardBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.selectValue,
                          { color: selectedWorkingLocation ? theme.colors.ink : isDark ? '#525252' : '#9ca3af' },
                        ]}
                      >
                        {selectedWorkingLocation ? selectedWorkingLocation.name : 'Select operational base yard / site...'}
                      </Text>
                    </View>
                    <ChevronDown size={16} color={isDark ? '#737373' : '#9ca3af'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section 2: Work Shift Schedule */}
              <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor: cardBorder }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: cardBorder }]}>
                  <View style={styles.sectionHeaderTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>2</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      Work Shift Schedule
                    </Text>
                  </View>
                  {shiftSummary?.isValid && (
                    <View style={styles.shiftPill}>
                      <Text style={styles.shiftPillText}>
                        {shiftSummary.isOvernight ? '🌙 Overnight' : '☀️ Standard'} · {shiftSummary.durationFormatted}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="Shift Start Time"
                      value={shiftStartTime}
                      onChange={setShiftStartTime}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimeInput
                      label="Shift End Time"
                      value={shiftEndTime}
                      onChange={setShiftEndTime}
                    />
                  </View>
                </View>

                <Text style={[styles.helperCaption, { color: theme.colors.mute }]}>
                  Assigned daily operational work hours. This schedule is recorded on your profile and daily duty logs.
                </Text>
              </View>

              {/* Section 3: Work Location & Identity */}
              <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor: cardBorder }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: cardBorder }]}>
                  <View style={styles.sectionHeaderTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>3</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      Work Location & Identity
                    </Text>
                  </View>
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="City / Town"
                      required
                      placeholder="Pune"
                      value={city}
                      onChangeText={(val) => {
                        setCity(val);
                        clearFieldError('city');
                      }}
                      error={fieldErrors.city}
                      leftIcon={<MapPin size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="District"
                      required
                      placeholder="Pune"
                      value={district}
                      onChangeText={(val) => {
                        setDistrict(val);
                        clearFieldError('district');
                      }}
                      error={fieldErrors.district}
                      leftIcon={<MapPin size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                    />
                  </View>
                </View>

                {/* State Picker Trigger */}
                <View style={styles.selectGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                    State <Text style={{ color: '#ef4444', fontWeight: '700' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStateModalVisible(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.selectTrigger,
                      {
                        backgroundColor: isDark ? '#121212' : theme.colors.canvasElevated,
                        borderColor: fieldErrors.state ? '#ef4444' : isDark ? '#292c2f' : cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectValue,
                        { color: stateVal ? theme.colors.ink : isDark ? '#525252' : '#9ca3af' },
                      ]}
                    >
                      {stateVal || 'Select state...'}
                    </Text>
                    <ChevronDown size={16} color={isDark ? '#737373' : '#9ca3af'} />
                  </TouchableOpacity>
                  {fieldErrors.state ? (
                    <Text style={styles.errorText}>{fieldErrors.state}</Text>
                  ) : null}
                </View>

                <Input
                  label="Street / Site Base Address"
                  required
                  placeholder="Plot No. 42, MIDC Industrial Area"
                  value={address}
                  onChangeText={(val) => {
                    setAddress(val);
                    clearFieldError('address');
                  }}
                  error={fieldErrors.address}
                  leftIcon={<MapPin size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Input
                  label="Aadhaar Card Number"
                  required
                  placeholder="12-digit Aadhaar Number"
                  value={aadhaarNumber}
                  onChangeText={handleAadhaarChange}
                  keyboardType="numeric"
                  maxLength={14}
                  error={fieldErrors.aadhaar_number}
                  leftIcon={<ShieldCheck size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Input
                  label="Driving Licence Number (Optional)"
                  placeholder="e.g. MH12 20110012345"
                  value={licenseNumber}
                  onChangeText={handleLicenseChange}
                  autoCapitalize="characters"
                  maxLength={25}
                  error={fieldErrors.license_number}
                  leftIcon={<CreditCard size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />
              </View>

              {/* Section 4: Security Credentials */}
              <View style={[styles.sectionCard, { backgroundColor: sectionBg, borderColor: cardBorder }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: cardBorder }]}>
                  <View style={styles.sectionHeaderTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Text style={styles.sectionBadgeText}>4</Text>
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      Security Credentials
                    </Text>
                  </View>
                </View>

                <Input
                  label="Password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    clearFieldError('password');
                  }}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={fieldErrors.password}
                  leftIcon={<Lock size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Input
                  label="Confirm Password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    clearFieldError('confirm_password');
                  }}
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={fieldErrors.confirm_password}
                  leftIcon={<Lock size={16} color={isDark ? '#737373' : '#9ca3af'} />}
                />

                <Text style={[styles.helperCaption, { color: theme.colors.mute }]}>
                  Password must be at least 8 characters long. Make sure both passwords match.
                </Text>
              </View>

              {/* Note Banner */}
              <View style={styles.noteBox}>
                <Info size={16} color="#0ea5e9" style={{ marginTop: 2 }} />
                <Text style={styles.noteText}>
                  <Text style={{ fontWeight: '700' }}>Note: </Text>
                  Account status will be &ldquo;pending&rdquo; until approved by an administrator.
                </Text>
              </View>

              {/* Submit CTA Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: primarySkyBlue },
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Request Platform Access</Text>
                )}
              </TouchableOpacity>

              {/* Card Footer */}
              <View style={[styles.cardFooter, { borderTopColor: cardBorder }]}>
                <Text style={[styles.cardFooterText, { color: theme.colors.mute }]}>
                  Already have an account?
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Text style={[styles.signInLinkText, { color: primarySkyBlue }]}>
                    Sign in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bottom Screen Footer & Theme Toggle */}
          <View style={styles.screenFooter}>
            <View style={styles.footerInner}>
              <Text
                style={[
                  styles.copyrightText,
                  { color: isDark ? '#737373' : '#8f8f8f' },
                ]}
              >
                &copy; {new Date().getFullYear()} REACH INTERNATIONAL. ALL RIGHTS RESERVED.
              </Text>

              {/* Quick Floating Theme Switcher */}
              <TouchableOpacity
                style={[
                  styles.themeToggleBtn,
                  {
                    backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0',
                    borderColor: cardBorder,
                  },
                ]}
                onPress={() => setMode(isDark ? 'light' : 'dark')}
                activeOpacity={0.7}
                accessibilityLabel="Toggle Theme"
                hitSlop={8}
              >
                {isDark ? (
                  <Sun size={15} color="#e0e0e0" />
                ) : (
                  <Moon size={15} color="#333333" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Role Selection Modal */}
      <Modal visible={roleModalVisible} animationType="slide" transparent onRequestClose={() => setRoleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Account Role</Text>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
              {SIGNUP_ROLES.map((r) => {
                const isSelected = selectedRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => {
                      setSelectedRole(r.value);
                      if (!isSupervisedRole(r.value)) {
                        setSelectedSupervisorId('');
                      }
                      setRoleModalVisible(false);
                    }}
                    style={[
                      styles.modalItemRow,
                      { borderBottomColor: cardBorder },
                      isSelected && { backgroundColor: 'rgba(14, 165, 233, 0.1)' },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemTitle, { color: isSelected ? primarySkyBlue : theme.colors.ink }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.modalItemDesc, { color: theme.colors.mute }]}>{r.desc}</Text>
                    </View>
                    {isSelected && <Check size={18} color={primarySkyBlue} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* State Selection Modal */}
      <Modal visible={stateModalVisible} animationType="slide" transparent onRequestClose={() => setStateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select State</Text>
              <TouchableOpacity onPress={() => setStateModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Input
                placeholder="Search state..."
                value={stateSearch}
                onChangeText={setStateSearch}
                leftIcon={<Search size={15} color={isDark ? '#737373' : '#9ca3af'} />}
              />
            </View>
            <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
              {INDIAN_STATES.filter((s) => s.name.toLowerCase().includes(stateSearch.toLowerCase().trim())).map((s) => {
                const isSelected = stateId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      setStateId(s.id);
                      setStateVal(s.name);
                      setStateModalVisible(false);
                      setStateSearch('');
                      clearFieldError('state');
                    }}
                    style={[
                      styles.modalItemRow,
                      { borderBottomColor: cardBorder },
                      isSelected && { backgroundColor: 'rgba(14, 165, 233, 0.1)' },
                    ]}
                  >
                    <Text style={[styles.modalItemTitle, { color: isSelected ? primarySkyBlue : theme.colors.ink }]}>
                      {s.name}
                    </Text>
                    {isSelected && <Check size={18} color={primarySkyBlue} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Supervisor Selection Modal */}
      <Modal visible={supervisorModalVisible} animationType="slide" transparent onRequestClose={() => setSupervisorModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Supervisor</Text>
              <TouchableOpacity onPress={() => setSupervisorModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Input
                placeholder="Search supervisor by name..."
                value={supervisorSearch}
                onChangeText={setSupervisorSearch}
                leftIcon={<Search size={15} color={isDark ? '#737373' : '#9ca3af'} />}
              />
            </View>
            <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
              {supervisors
                .filter((s) => s.full_name.toLowerCase().includes(supervisorSearch.toLowerCase().trim()))
                .map((s) => {
                  const isSelected = selectedSupervisorId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        setSelectedSupervisorId(s.id);
                        setSupervisorModalVisible(false);
                        setSupervisorSearch('');
                        clearFieldError('supervisor_id');
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: cardBorder },
                        isSelected && { backgroundColor: 'rgba(14, 165, 233, 0.1)' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalItemTitle, { color: isSelected ? primarySkyBlue : theme.colors.ink }]}>
                          {s.full_name}
                        </Text>
                        {s.email && (
                          <Text style={[styles.modalItemDesc, { color: theme.colors.mute }]}>{s.email}</Text>
                        )}
                      </View>
                      {isSelected && <Check size={18} color={primarySkyBlue} />}
                    </TouchableOpacity>
                  );
                })}
              {supervisors.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.mute, fontSize: 13 }}>No active supervisors found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Working Location Selection Modal */}
      <Modal visible={workingLocationModalVisible} animationType="slide" transparent onRequestClose={() => setWorkingLocationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: cardBackground, borderColor: cardBorder }]}>
            <View style={[styles.modalHeader, { borderBottomColor: cardBorder }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Working Location</Text>
              <TouchableOpacity onPress={() => setWorkingLocationModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Input
                placeholder="Search by location name or city..."
                value={workingLocationSearch}
                onChangeText={setWorkingLocationSearch}
                leftIcon={<Search size={15} color={isDark ? '#737373' : '#9ca3af'} />}
              />
            </View>
            <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
              {workingLocations
                .filter((l) => {
                  const q = workingLocationSearch.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    l.name.toLowerCase().includes(q) ||
                    (l.city && l.city.toLowerCase().includes(q)) ||
                    (l.type && l.type.toLowerCase().includes(q))
                  );
                })
                .map((l) => {
                  const isSelected = selectedWorkingLocationId === l.id;
                  return (
                    <TouchableOpacity
                      key={l.id}
                      onPress={() => {
                        setSelectedWorkingLocationId(l.id);
                        setWorkingLocationModalVisible(false);
                        setWorkingLocationSearch('');
                        clearFieldError('working_location_id');
                      }}
                      style={[
                        styles.modalItemRow,
                        { borderBottomColor: cardBorder },
                        isSelected && { backgroundColor: 'rgba(14, 165, 233, 0.1)' },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalItemTitle, { color: isSelected ? primarySkyBlue : theme.colors.ink }]}>
                          {l.name}
                        </Text>
                        <Text style={[styles.modalItemDesc, { color: theme.colors.mute }]}>
                          {[l.type?.toUpperCase(), l.city].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={primarySkyBlue} />}
                    </TouchableOpacity>
                  );
                })}
              {workingLocations.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: theme.colors.mute, fontSize: 13 }}>No active working locations found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  bannerContainer: {
    marginBottom: 14,
  },
  sectionCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBadge: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    color: '#0ea5e9',
    fontSize: 10,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  shiftPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  shiftPillText: {
    color: '#0ea5e9',
    fontSize: 10,
    fontWeight: '600',
  },
  selectGroup: {
    marginBottom: 12,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  selectValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  helperCaption: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    marginBottom: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#0ea5e9',
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardFooter: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardFooterText: {
    fontSize: 13,
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  screenFooter: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  copyrightText: {
    flex: 1,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalListScroll: {
    maxHeight: 380,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
