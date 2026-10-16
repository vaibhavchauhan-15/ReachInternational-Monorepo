import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, Text, Pressable } from '../ui';
import { formatTinyRelativeTime } from '@reachinternational/utils';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface ProfileChangeRequestItem {
  id: string;
  user_id: string;
  requester_role?: string;
  created_at: string;
  current_data?: any;
  requested_data?: any;
  user?: {
    id?: string;
    full_name?: string;
    role?: string;
    phone?: string;
    email?: string;
  };
}

export interface ProfileChangeRequestsSectionProps {
  requests: ProfileChangeRequestItem[];
  approvingProfileId: string | null;
  isBulkApprovingProfile: boolean;
  isBulkRejectingProfile: boolean;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onApprove: (id: string, reqData: any, userId: string) => void;
  onReject: (req: ProfileChangeRequestItem) => void;
}

function formatRoleName(role?: string): string {
  if (!role) return 'Staff';
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'hr':
      return 'HR';
    case 'operator':
      return 'Operator';
    default:
      return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function ProfileChangeRequestsSection({
  requests,
  approvingProfileId,
  isBulkApprovingProfile,
  isBulkRejectingProfile,
  onApproveAll,
  onRejectAll,
  onApprove,
  onReject,
}: ProfileChangeRequestsSectionProps) {
  const { theme } = useTheme();

  if (!requests || requests.length === 0) return null;

  return (
    <View style={[styles.changeReqsContainer, { borderColor: '#6366f133', backgroundColor: '#6366f108' }]}>
      <View style={[styles.changeReqsHeader, { borderBottomColor: '#6366f120' }]}>
        <View style={styles.titleRow}>
          <View style={[styles.alertDot, { backgroundColor: '#6366f1' }]} />
          <Text variant="label" style={{ color: theme.colors.ink }}>
            Profile Change Requests ({requests.length})
          </Text>
        </View>
        <View style={styles.headerActionsRow}>
          <Pressable
            variant="buttonPrimary"
            hitSlopToMin48
            style={[styles.miniActionBtn, { backgroundColor: '#6366f1', borderColor: '#6366f1' }]}
            onPress={onApproveAll}
            disabled={isBulkApprovingProfile}
          >
            <Text variant="caption" style={styles.miniActionBtnTextWhite}>
              Accept All
            </Text>
          </Pressable>
          <Pressable
            variant="buttonSecondary"
            hitSlopToMin48
            style={[styles.miniActionBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
            onPress={onRejectAll}
            disabled={isBulkRejectingProfile}
          >
            <Text variant="caption" style={{ color: theme.colors.ink }}>
              Reject All
            </Text>
          </Pressable>
        </View>
      </View>

      {requests.map((pr) => {
        const reqUser = pr.user || pr.current_data || {};
        const reqData = pr.requested_data || {};
        const currData = pr.current_data || {};
        const isApproving = approvingProfileId === pr.id;

        return (
          <View
            key={pr.id}
            style={[styles.changeReqCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <View style={styles.changeReqCardHeader}>
              <View style={styles.userMetaRow}>
                <View style={[styles.avatarCircle, { backgroundColor: '#6366f115', borderColor: '#6366f130' }]}>
                  <Text variant="label" style={{ color: '#6366f1' }}>
                    {reqUser.full_name ? reqUser.full_name[0].toUpperCase() : 'U'}
                  </Text>
                </View>
                <View style={styles.flex1}>
                  <Text variant="label" style={{ color: theme.colors.ink }} numberOfLines={1}>
                    {reqUser.full_name || 'Staff Member'}
                  </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                    {formatRoleName(reqUser.role || pr.requester_role)} • {reqUser.phone || reqUser.email || '—'}
                  </Text>
                </View>
              </View>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                {formatTinyRelativeTime(pr.created_at)}
              </Text>
            </View>

            {/* Diff Box */}
            <View style={[styles.diffsBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              {reqData.full_name && reqData.full_name !== currData.full_name && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Name: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.full_name || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.full_name}</Text>
                </View>
              )}
              {reqData.phone && reqData.phone !== currData.phone && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Phone: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.phone || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.phone}</Text>
                </View>
              )}
              {reqData.city && reqData.city !== currData.city && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>City: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.city || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.city}</Text>
                </View>
              )}
              {reqData.district && reqData.district !== currData.district && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>District: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.district || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.district}</Text>
                </View>
              )}
              {reqData.state && reqData.state !== currData.state && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>State: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.state || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.state}</Text>
                </View>
              )}
              {reqData.address && reqData.address !== currData.address && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Address: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.address || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.address}</Text>
                </View>
              )}
              {reqData.aadhaar_number && reqData.aadhaar_number !== currData.aadhaar_number && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Aadhaar: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.aadhaar_number || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.aadhaar_number}</Text>
                </View>
              )}
              {reqData.license_number && reqData.license_number !== currData.license_number && (
                <View style={styles.diffRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Licence: </Text>
                  <Text variant="caption" style={{ color: theme.colors.mute, textDecorationLine: 'line-through' }}>{currData.license_number || '—'}</Text>
                  <Text variant="caption" style={{ color: theme.colors.link }}> → </Text>
                  <Text variant="caption" style={{ color: theme.colors.ink }}>{reqData.license_number}</Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={styles.changeReqActions}>
              <Pressable
                variant="buttonPrimary"
                hitSlopToMin48
                style={[styles.reqApproveBtn, { backgroundColor: '#10b981' }]}
                onPress={() => onApprove(pr.id, reqData, pr.user_id)}
                disabled={isApproving}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text variant="label" style={styles.whiteText}>Approve</Text>
                )}
              </Pressable>
              <Pressable
                variant="buttonSecondary"
                hitSlopToMin48
                style={[styles.reqRejectBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                onPress={() => onReject(pr)}
                disabled={isApproving}
              >
                <Text variant="label" style={{ color: theme.colors.error }}>Reject...</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  changeReqsContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginTop: spacingNumeric.md,
    marginBottom: spacingNumeric.xs,
    gap: 12,
  },
  changeReqsHeader: {
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
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniActionBtnTextWhite: {
    color: '#ffffff',
  },
  changeReqCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm + 2,
    gap: 8,
  },
  changeReqCardHeader: {
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
  diffsBox: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
    gap: 4,
  },
  diffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  changeReqActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  reqApproveBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  reqRejectBtn: {
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
