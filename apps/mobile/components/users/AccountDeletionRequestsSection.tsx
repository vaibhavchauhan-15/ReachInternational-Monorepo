import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, Text, Pressable } from '../ui';
import { formatTinyRelativeTime } from '@reachinternational/utils';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { AlertTriangle, Globe, Smartphone } from '../ui/icon';

export interface AccountDeletionRequestItem {
  id: string;
  user_id?: string;
  email?: string;
  phone?: string;
  reason?: string;
  source?: 'web' | 'mobile' | string;
  created_at: string;
  _isProfileChangeRequest?: boolean;
  user?: {
    id?: string;
    full_name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
}

export interface AccountDeletionRequestsSectionProps {
  requests: AccountDeletionRequestItem[];
  approvingDeletionId: string | null;
  rejectingDeletionId: string | null;
  onApprove: (req: AccountDeletionRequestItem) => void;
  onReject: (req: AccountDeletionRequestItem) => void;
}

export function AccountDeletionRequestsSection({
  requests,
  approvingDeletionId,
  rejectingDeletionId,
  onApprove,
  onReject,
}: AccountDeletionRequestsSectionProps) {
  const { theme, isDark } = useTheme();

  if (!requests || requests.length === 0) return null;

  return (
    <View
      style={[
        styles.deletionReqsContainer,
        {
          borderColor: '#ef444433',
          backgroundColor: isDark ? '#450a0a26' : '#fef2f2',
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: isDark ? '#7f1d1d40' : '#fee2e2' }]}>
        <View style={styles.titleRow}>
          <View style={[styles.alertDot, { backgroundColor: '#ef4444' }]} />
          <Text variant="label" style={{ color: theme.colors.ink }}>
            Account Deletion Requests ({requests.length})
          </Text>
        </View>
        <View style={[styles.deletionCountPill, { backgroundColor: isDark ? '#7f1d1d66' : '#fee2e2' }]}>
          <AlertTriangle size={11} color="#ef4444" />
          <Text variant="micro" style={{ color: '#dc2626' }}>
            Action Required
          </Text>
        </View>
      </View>

      <Text variant="caption" style={{ color: theme.colors.mute }}>
        Requests received via Web Portal & Mobile App. Approving deactivates account access and wipes personal KYC data; statutory machine logs (HMR) are permanently retained.
      </Text>

      {requests.map((dr) => {
        const isApproving = approvingDeletionId === dr.id;
        const isRejecting = rejectingDeletionId === dr.id;
        const reqUser = dr.user || {};
        const displayName = reqUser.full_name || dr.email || 'User';
        const isWebPortal = dr.source === 'web';

        return (
          <View
            key={dr.id}
            style={[
              styles.deletionCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.userMetaRow}>
                <View
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: isDark ? '#7f1d1d33' : '#fee2e2',
                      borderColor: '#ef444440',
                    },
                  ]}
                >
                  <Text variant="label" style={{ color: '#ef4444' }}>
                    {displayName ? displayName[0].toUpperCase() : 'D'}
                  </Text>
                </View>
                <View style={styles.flex1}>
                  <View style={styles.nameBadgeRow}>
                    <Text variant="label" style={{ color: theme.colors.ink }} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <View
                      style={[
                        styles.sourceBadge,
                        {
                          backgroundColor: isWebPortal
                            ? isDark
                              ? '#1e3a8a33'
                              : '#eff6ff'
                            : isDark
                            ? '#581c8733'
                            : '#f5f3ff',
                          borderColor: isWebPortal ? '#3b82f640' : '#8b5cf640',
                        },
                      ]}
                    >
                      {isWebPortal ? (
                        <Globe size={9} color={theme.colors.link} />
                      ) : (
                        <Smartphone size={9} color="#7c3aed" />
                      )}
                      <Text
                        variant="micro"
                        style={{ color: isWebPortal ? theme.colors.link : '#7c3aed' }}
                      >
                        {isWebPortal ? 'Web Portal' : 'Mobile App'}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                    {dr.email || reqUser.email || '—'}
                    {dr.phone ? ` • ${dr.phone}` : ''}
                  </Text>
                </View>
              </View>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                {formatTinyRelativeTime(dr.created_at)}
              </Text>
            </View>

            {/* Reason Box */}
            <View
              style={[
                styles.deletionReasonBox,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                Reason for deletion:
              </Text>
              <Text variant="caption" style={{ color: theme.colors.ink }}>
                "{dr.reason || 'No specific reason provided'}"
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable
                variant="buttonDanger"
                hitSlopToMin48
                style={[styles.approveBtn, { backgroundColor: '#dc2626' }]}
                onPress={() => onApprove(dr)}
                disabled={isApproving || isRejecting}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text variant="label" style={styles.whiteText}>
                    Approve & Deactivate
                  </Text>
                )}
              </Pressable>
              <Pressable
                variant="buttonSecondary"
                hitSlopToMin48
                style={[
                  styles.rejectBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                onPress={() => onReject(dr)}
                disabled={isApproving || isRejecting}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color={theme.colors.mute} />
                ) : (
                  <Text variant="label" style={{ color: theme.colors.ink }}>
                    Decline
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  deletionReqsContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.md,
    marginBottom: spacingNumeric.xs,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  deletionCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  deletionCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm + 2,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  deletionReasonBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    gap: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  approveBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  whiteText: {
    color: '#ffffff',
  },
});
