/**
 * ReachInternational Mobile — Account & Data Deletion Screen
 * Fulfills Google Play Account Deletion Policy & statutory data erasure rights.
 * Allows field personnel to submit a verified account deletion request directly in-app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import {
  Card,
  Badge,
  Button,
  Input,
  useTheme,
  MobileHeader,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Shield,
  User,
  Mail,
  Clock,
  ChevronRight,
  ArrowLeft,
  XCircle,
} from 'lucide-react-native';

const REASON_OPTIONS = [
  'Leaving organization / Change of employment',
  'No longer using machinery or mobile application',
  'Privacy & personal data minimization',
  'Duplicate or test account',
  'Other operational reason',
];

export default function AccountDeletionScreen() {
  const router = useRouter();
  const { user, userProfile, role, signOut } = useAuth();
  const { theme, isDark } = useTheme();

  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isLoadingCheck, setIsLoadingCheck] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const userEmail = user?.email || userProfile?.email || '';
  const userName = userProfile?.full_name || 'Field Personnel';
  const roleLabel = (role || userProfile?.role || 'operator').replace(/_/g, ' ').toUpperCase();

  // Check if user already has a pending deletion request
  const checkPendingDeletion = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingCheck(false);
      return;
    }

    try {
      // 1. Check account_deletion_requests
      const { data: directReq } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (directReq) {
        setPendingRequest(directReq);
        setIsLoadingCheck(false);
        return;
      }

      // 2. Check profile_change_requests fallback
      const { data: fallbackReq } = await supabase
        .from('profile_change_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (fallbackReq && (fallbackReq.requested_data as any)?.type === 'account_deletion') {
        setPendingRequest(fallbackReq);
      } else {
        setPendingRequest(null);
      }
    } catch (err) {
      console.warn('[AccountDeletion] Check error:', err);
    } finally {
      setIsLoadingCheck(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkPendingDeletion();
  }, [checkPendingDeletion]);

  // Handle Deletion Submission
  const handleSubmitDeletion = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type "DELETE" into the box to confirm account de-provisioning.');
      return;
    }

    Alert.alert(
      'Confirm Account Deletion Request',
      `Are you sure you want to submit a deletion request for ${userEmail}? This will be reviewed by the compliance desk to de-provision your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Submit',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const fullReason = customReason.trim()
                ? `${selectedReason}: ${customReason.trim()}`
                : selectedReason;

              // Try inserting into account_deletion_requests
              const { error: directErr } = await supabase
                .from('account_deletion_requests')
                .insert({
                  user_id: user?.id,
                  email: userEmail,
                  full_name: userName,
                  phone: userProfile?.phone,
                  role: role || userProfile?.role,
                  reason: fullReason,
                  source: 'mobile',
                  status: 'pending',
                });

              if (directErr) {
                // Fallback to profile_change_requests
                const { error: fallbackErr } = await supabase
                  .from('profile_change_requests')
                  .insert({
                    user_id: user?.id,
                    requester_role: role || 'operator',
                    current_data: { email: userEmail },
                    requested_data: {
                      type: 'account_deletion',
                      email: userEmail,
                      full_name: userName,
                      phone: userProfile?.phone,
                      role: role || userProfile?.role,
                      reason: fullReason,
                      source: 'mobile',
                      requested_at: new Date().toISOString(),
                    },
                    target_approver_role: 'admin',
                    status: 'pending',
                  });

                if (fallbackErr) throw fallbackErr;
              }

              Alert.alert(
                'Request Submitted',
                'Your account deletion request has been sent to our administrator and compliance desk. It will be reviewed and processed within 14 business days.',
                [{ text: 'OK', onPress: () => checkPendingDeletion() }]
              );
            } catch (err: any) {
              Alert.alert('Submission Failed', err?.message || 'Failed to submit account deletion request. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Withdraw / Cancel pending request
  const handleCancelRequest = async () => {
    if (!pendingRequest?.id) return;

    Alert.alert(
      'Withdraw Deletion Request',
      'Do you want to cancel your pending account deletion request and keep your account active?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Withdraw Request',
          style: 'default',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await supabase
                .from('account_deletion_requests')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', pendingRequest.id);

              await supabase
                .from('profile_change_requests')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', pendingRequest.id);

              Alert.alert('Request Withdrawn', 'Your account deletion request has been cancelled.');
              setPendingRequest(null);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to withdraw deletion request.');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title="Account Deletion"
        showBack={true}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Policy Card */}
          <Card variant="elevated" style={styles.card}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconBox, { backgroundColor: 'rgba(220, 38, 38, 0.1)' }]}>
                <Trash2 size={22} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: theme.colors.ink }]}>
                  Request Account & Data Erasure
                </Text>
                <Text style={[styles.heroSub, { color: theme.colors.mute }]}>
                  Google Play Store Policy & Privacy Compliance
                </Text>
              </View>
            </View>

            <Text style={[styles.heroBody, { color: theme.colors.mute }]}>
              Under statutory data privacy regulations and Google Play Developer policies, you may request permanent de-provisioning of your user account and erasure of personal KYC data.
            </Text>
          </Card>

          {/* User Identity Card */}
          <Card variant="elevated" style={styles.card}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>ACCOUNT TO BE DELETED</Text>

            <View style={styles.identityRow}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.colors.link }]}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.identityName, { color: theme.colors.ink }]}>{userName}</Text>
                  <Badge status="active" customLabel={roleLabel} />
                </View>
                <Text style={[styles.identityEmail, { color: theme.colors.mute }]}>{userEmail}</Text>
              </View>
            </View>
          </Card>

          {/* Pending Request Banner if already submitted */}
          {pendingRequest && (
            <Card
              variant="elevated"
              style={[
                styles.card,
                { borderColor: 'rgba(217, 119, 6, 0.4)', backgroundColor: 'rgba(217, 119, 6, 0.06)' },
              ]}
            >
              <View style={styles.pendingHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="#d97706" />
                  <Text style={styles.pendingTitle}>Deletion Request Pending Review</Text>
                </View>
                <Badge status="pending" customLabel="PENDING" />
              </View>
              <Text style={[styles.pendingBody, { color: theme.colors.ink }]}>
                Your account deletion request was received and is currently in the compliance queue. It will be reviewed and finalized within 14 business days.
              </Text>
              <Button
                label="Withdraw Deletion Request"
                onPress={handleCancelRequest}
                variant="outline"
                size="sm"
                isLoading={isCancelling}
                icon={<XCircle size={14} color="#d97706" />}
                style={{ marginTop: 8 }}
              />
            </Card>
          )}

          {/* Data Erasure Breakdown */}
          <Card variant="elevated" style={styles.card}>
            <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>DATA RETENTION & ERASURE RULES</Text>

            {/* Purged */}
            <View style={[styles.infoBox, { backgroundColor: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <CheckCircle2 size={14} color="#059669" />
                <Text style={[styles.infoBoxTitle, { color: '#059669' }]}>Data Permanently Purged</Text>
              </View>
              <Text style={[styles.infoBoxBody, { color: theme.colors.ink }]}>
                • Legal name, official email, phone number{'\n'}
                • Authentication sessions and passwords{'\n'}
                • Aadhaar and Driving Licence numbers{'\n'}
                • Push tokens and device telemetry
              </Text>
            </View>

            {/* Retained */}
            <View style={[styles.infoBox, { backgroundColor: 'rgba(217, 119, 6, 0.06)', borderColor: 'rgba(217, 119, 6, 0.25)', marginTop: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <FileCheck size={14} color="#d97706" />
                <Text style={[styles.infoBoxTitle, { color: '#d97706' }]}>Statutory Machinery Records</Text>
              </View>
              <Text style={[styles.infoBoxBody, { color: theme.colors.ink }]}>
                Under industrial safety and equipment warranty legislation, historical machine hour meter logs (HMR), pre-shift checklists, and breakdown tickets are preserved in an anonymized format for auditing purposes.
              </Text>
            </View>
          </Card>

          {/* Deletion Form (Hidden if request already pending) */}
          {!pendingRequest && (
            <Card variant="elevated" style={styles.card}>
              <Text style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>SUBMIT DELETION REQUEST</Text>

              <Text style={[styles.label, { color: theme.colors.ink, marginTop: 4 }]}>Select Reason</Text>
              {REASON_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setSelectedReason(opt)}
                  style={[
                    styles.radioRow,
                    {
                      borderColor: selectedReason === opt ? theme.colors.link : theme.colors.hairline,
                      backgroundColor: selectedReason === opt ? (isDark ? 'rgba(14, 165, 233, 0.1)' : '#f0f9ff') : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: selectedReason === opt ? theme.colors.link : theme.colors.mute,
                      },
                    ]}
                  >
                    {selectedReason === opt && (
                      <View style={[styles.radioDot, { backgroundColor: theme.colors.link }]} />
                    )}
                  </View>
                  <Text style={[styles.radioText, { color: theme.colors.ink }]}>{opt}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.label, { color: theme.colors.ink, marginTop: 10 }]}>Additional Notes (Optional)</Text>
              <Input
                placeholder="Any comments for the compliance desk..."
                value={customReason}
                onChangeText={setCustomReason}
                containerStyle={{ marginVertical: 4 }}
              />

              <View style={[styles.confirmBox, { borderColor: 'rgba(220, 38, 38, 0.3)', backgroundColor: 'rgba(220, 38, 38, 0.05)' }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginBottom: 4 }}>
                  TYPE &quot;DELETE&quot; TO CONFIRM
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.mute, marginBottom: 8, lineHeight: 15 }}>
                  This confirms you understand that login access will be terminated upon administrator approval.
                </Text>
                <Input
                  placeholder='Type "DELETE"'
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  containerStyle={{ marginVertical: 0 }}
                />
              </View>

              <Button
                label="Submit Account Deletion Request"
                onPress={handleSubmitDeletion}
                variant="danger"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting || confirmText.trim().toUpperCase() !== 'DELETE'}
                icon={<Trash2 size={16} color="#ffffff" />}
                fullWidth
                style={{ marginTop: spacingNumeric.md }}
              />
            </Card>
          )}

          {/* Processing Timeline Notice */}
          <View style={styles.timelineNotice}>
            <Clock size={14} color={theme.colors.mute} />
            <Text style={[styles.timelineText, { color: theme.colors.mute }]}>
              Processing Timeline: Requests are acknowledged within 48 hours and executed within 14 business days.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacingNumeric.md, paddingBottom: spacingNumeric.xl },
  card: { marginVertical: spacingNumeric.xs, padding: spacingNumeric.md },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  heroIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  heroSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  heroBody: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  identityName: { fontSize: 13, fontWeight: '700' },
  identityEmail: { fontSize: 11, marginTop: 1 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#d97706' },
  pendingBody: { fontSize: 12, lineHeight: 17 },
  infoBox: { padding: 10, borderRadius: radiusNumeric.md, borderWidth: 1 },
  infoBoxTitle: { fontSize: 12, fontWeight: '700' },
  infoBoxBody: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radiusNumeric.md, borderWidth: 1, marginVertical: 3 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5 },
  radioText: { fontSize: 12, fontWeight: '500', flex: 1 },
  confirmBox: { padding: 12, borderRadius: radiusNumeric.md, borderWidth: 1, marginTop: 12 },
  timelineNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 12, justifyContent: 'center' },
  timelineText: { fontSize: 11, textAlign: 'center', lineHeight: 15, flex: 1 },
});
