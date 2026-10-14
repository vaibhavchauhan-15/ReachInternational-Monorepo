/**
 * ReachInternational Mobile — Account & Data Deletion Screen
 * Fulfills Google Play Account Deletion Policy & statutory data erasure rights.
 * Allows field personnel to submit a verified account deletion request directly in-app.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from '../../../components/ui/touch/Pressable';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  Card,
  Badge,
  Button,
  Input,
  useTheme,
  MobileHeader,
  Text,
  useToast,
  SearchableSelect,
  ConfirmDialog,
  FormError,
} from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Trash2,
  Clock,
  ChevronRight,
  XCircle,
  FileText,
} from '../../../components/ui/icon';

const REASON_OPTIONS = [
  'Leaving organization / Change of employment',
  'No longer using machinery or mobile application',
  'Privacy & personal data minimization',
  'Duplicate or test account',
  'Other operational reason',
];

export default function AccountDeletionScreen() {
  const router = useRouter();
  const { user, userProfile, role } = useAuth();
  const { theme, isDark } = useTheme();
  const { toast } = useToast();

  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isLoadingCheck, setIsLoadingCheck] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const userEmail = user?.email || userProfile?.email || '';
  const userName = userProfile?.full_name || 'Field Personnel';

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
    if (selectedReason === 'Other operational reason' && !customReason.trim()) {
      toast('warning', 'Reason Required', 'Please describe your operational reason in the text box.');
      return;
    }

    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      toast('warning', 'Confirmation Required', 'Please type "DELETE" into the box to confirm account de-provisioning.');
      return;
    }

    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmitDeletion = async () => {
    setIsSubmitting(true);
    try {
      const fullReason =
        selectedReason === 'Other operational reason'
          ? customReason.trim()
            ? `Other operational reason: ${customReason.trim()}`
            : 'Other operational reason'
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

      toast(
        'success',
        'Request Submitted',
        'Your account deletion request has been sent to our administrator and compliance desk. It will be reviewed and processed within 14 business days.'
      );
      setShowSubmitConfirm(false);
      checkPendingDeletion();
    } catch (err: any) {
      toast('error', 'Submission Failed', err?.message || 'Failed to submit account deletion request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Withdraw / Cancel pending request
  const handleCancelRequest = async () => {
    if (!pendingRequest?.id) return;
    setShowCancelConfirm(true);
  };

  const handleConfirmCancelRequest = async () => {
    if (!pendingRequest?.id) return;
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

      toast('success', 'Request Withdrawn', 'Your account deletion request has been cancelled.');
      setShowCancelConfirm(false);
      setPendingRequest(null);
    } catch (err: any) {
      toast('error', 'Error', err?.message || 'Failed to withdraw deletion request.');
    } finally {
      setIsCancelling(false);
    }
  };

  const isDeleteDisabled =
    isSubmitting ||
    confirmText.trim().toUpperCase() !== 'DELETE' ||
    !selectedReason ||
    (selectedReason === 'Other operational reason' && !customReason.trim());

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
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Guide Action Button / Banner */}
          <Pressable
            variant="card"
            haptic="select"
            onPress={() => router.push('/account-deletion/guide')}
            style={[
              styles.guideBanner,
              {
                borderColor: isDark ? 'rgba(2, 132, 199, 0.35)' : 'rgba(2, 132, 199, 0.25)',
                backgroundColor: isDark ? 'rgba(2, 132, 199, 0.08)' : 'rgba(2, 132, 199, 0.04)',
              },
            ]}
          >
            <View style={styles.guideBannerLeft}>
              <View
                style={[
                  styles.guideIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : 'rgba(2, 132, 199, 0.1)',
                  },
                ]}
              >
                <FileText size={18} color="#0284c7" />
              </View>
              <View style={styles.guideTextCol}>
                <Text variant="subheading" style={{ color: theme.colors.ink }}>
                  Read this before delete the account
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Review policy, purged data &amp; statutory records retention
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={theme.colors.mute} />
          </Pressable>

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
                  <Text variant="subheading" style={styles.pendingTitle}>Deletion Request Pending Review</Text>
                </View>
                <Badge status="pending" customLabel="PENDING" />
              </View>
              <Text variant="body" style={[styles.pendingBody, { color: theme.colors.ink }]}>
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

          {/* Deletion Form (Hidden if request already pending) */}
          {!pendingRequest && (
            <Card variant="elevated" style={styles.card}>
              <Text variant="caption" style={[styles.sectionEyebrow, { color: theme.colors.mute }]}>
                SUBMIT DELETION REQUEST
              </Text>

              {/* Custom Dropdown Selection */}
              <SearchableSelect
                label="Reason for Deletion"
                required
                options={REASON_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={selectedReason}
                onChange={(val) => {
                  setSelectedReason(val);
                  if (val !== 'Other operational reason') {
                    setCustomReason('');
                  }
                }}
                placeholder="Select a reason for deletion..."
                searchable={false}
                presentation="dropdown"
                containerStyle={{ marginTop: 6, marginBottom: 10 }}
              />

              {/* Input for other reasons if "Other operational reason" is selected */}
              {selectedReason === 'Other operational reason' && (
                <View style={styles.otherReasonContainer}>
                  <Text variant="label" style={{ color: theme.colors.ink, marginBottom: 4 }}>
                    Specify Reason <Text variant="label" style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <Input
                    placeholder="Enter your operational reason for deletion..."
                    value={customReason}
                    onChangeText={setCustomReason}
                    containerStyle={{ marginVertical: 0 }}
                  />
                </View>
              )}

              {/* Confirmation Box */}
              <View
                style={[
                  styles.confirmBox,
                  {
                    borderColor: 'rgba(220, 38, 38, 0.3)',
                    backgroundColor: 'rgba(220, 38, 38, 0.05)',
                  },
                ]}
              >
                <Text variant="label" style={{ color: '#dc2626', marginBottom: 4 }}>
                  TYPE &quot;DELETE&quot; TO CONFIRM
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 8 }}>
                  This confirms you understand that login access will be terminated upon administrator approval.
                </Text>
                <Input
                  placeholder='Type "DELETE"'
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  containerStyle={{ marginVertical: 0 }}
                />
                {confirmText.length > 0 && confirmText.trim().toUpperCase() !== 'DELETE' ? (
                  <FormError message="Please type DELETE in capital letters to confirm" style={{ marginTop: 6 }} />
                ) : null}
              </View>

              {/* Submit Button */}
              <Button
                label="Submit Account Deletion Request"
                onPress={handleSubmitDeletion}
                variant="destructive"
                size="md"
                isLoading={isSubmitting}
                disabled={isDeleteDisabled}
                icon={<Trash2 size={16} color="#ffffff" />}
                fullWidth
                style={{ marginTop: spacingNumeric.md }}
              />
            </Card>
          )}

          {/* Processing Timeline Notice */}
          <View style={styles.timelineNotice}>
            <Clock size={14} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.timelineText, { color: theme.colors.mute }]}>
              Processing Timeline: Requests are acknowledged within 48 hours and executed within 14 business days.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleConfirmSubmitDeletion}
        title="Confirm Account Deletion Request"
        message={`Are you sure you want to submit an account deletion request for ${userEmail}? This will be reviewed by the compliance desk to de-provision your account.`}
        confirmText="Confirm & Submit"
        cancelText="Cancel"
        variant="danger"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        visible={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleConfirmCancelRequest}
        title="Withdraw Deletion Request"
        message="Do you want to cancel your pending account deletion request and keep your account active?"
        confirmText="Withdraw Request"
        cancelText="Keep Request"
        variant="primary"
        isLoading={isCancelling}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    paddingBottom: spacingNumeric.xl,
  },
  card: {
    marginVertical: spacingNumeric.xs,
    padding: spacingNumeric.md,
  },
  guideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
    minHeight: 52,
  },
  guideBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  guideIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTextCol: {
    flex: 1,
  },
  sectionEyebrow: {
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  otherReasonContainer: {
    marginBottom: 12,
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pendingTitle: {
    color: '#d97706',
  },
  pendingBody: {
    marginTop: 2,
  },
  confirmBox: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginTop: 8,
  },
  timelineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  timelineText: {
    textAlign: 'center',
    flex: 1,
  },
});
