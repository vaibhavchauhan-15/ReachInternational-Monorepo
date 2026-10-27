import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import type { OperatorDashboardDTO } from '@reachinternational/types';
import { StatusCard } from '../shared/StatusCard';
import {
  Wrench,
  Building2,
  Gauge,
  Clock,
  MapPin,
  ArrowRight,
  Layers,
  Timer,
} from '../../ui/icon';
import { formatTo12Hour } from '@reachinternational/utils';

export interface OperatorDashboardCardProps {
  data: OperatorDashboardDTO | null;
  isLoading?: boolean;
}

export const OperatorDashboardCard: React.FC<OperatorDashboardCardProps> = ({
  data,
  isLoading = false,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const isSubmitted = data?.today?.entryStatus === 'submitted';
  const isPartial = data?.today?.entryStatus === 'partial';
  const submittedCount = data?.today?.submittedCount ?? 0;
  const hasShifts = Boolean(data?.assigned_shifts && data.assigned_shifts.length > 0);
  const totalAssignedCount =
    data?.today?.totalAssignedCount ?? (data?.assigned_shifts ? data.assigned_shifts.length : 0);
  const totalRunningHoursToday = data?.today?.totalRunningHoursToday ?? 0;
  const hasMachine = Boolean(data?.machine);
  const hasClient = Boolean(data?.client);
  const hasNoAssignments = !isLoading && !hasShifts && !hasMachine && !hasClient;

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* Informative Guidance when Operator has no assignments configured */}
      {hasNoAssignments && (
        <View style={styles.section}>
          <EmptyState
            variant="empty"
            title="No Shifts or Equipment Assigned"
            description="You do not have an active machine or shift assigned for today. Contact your site supervisor to receive your daily deployment."
            actionLabel="View Operations"
            onAction={() => handleNavigate('/operations')}
            compact
          />
        </View>
      )}

      {/* 1. Today's Shift Status */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Today's Shift Status
        </Text>
        <View style={styles.oneColCol}>
          <StatusCard
            title="LOG SUBMISSION STATUS"
            status={
              isLoading && !data
                ? 'pending'
                : isSubmitted
                ? 'success'
                : isPartial
                ? 'warning'
                : totalAssignedCount === 0
                ? 'default'
                : 'pending'
            }
            label={
              isLoading && !data ? (
                'Loading status...'
              ) : isSubmitted ? (
                totalAssignedCount > 1
                  ? `All ${totalAssignedCount} Shifts Submitted`
                  : 'Submitted Today'
              ) : isPartial ? (
                `${submittedCount}/${totalAssignedCount} Shifts Logged`
              ) : totalAssignedCount === 0 ? (
                'No Shifts Assigned'
              ) : (
                'Pending Submission'
              )
            }
            description={
              isLoading && !data ? (
                'Fetching today’s operational status...'
              ) : isSubmitted ? (
                `${totalRunningHoursToday}h recorded across assigned shift(s) today.`
              ) : isPartial ? (
                `${submittedCount} of ${totalAssignedCount} shifts recorded (${totalRunningHoursToday}h). Ready to log remaining shift.`
              ) : totalAssignedCount === 0 ? (
                'No shift schedule registered for today. Contact your supervisor if you are on duty.'
              ) : (
                'Remember to submit before the end of your shift.'
              )
            }
          />
        </View>
      </View>

      {/* 2. Continuous Shift Coverage Tracker (Up to 3 Shifts / 24h) */}
      {hasShifts ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={14} color={isDark ? '#94a3b8' : theme.colors.mute} />
            <Text
              variant="caption"
              weight="semibold"
              style={[
                styles.eyebrowHeader,
                { color: isDark ? '#94a3b8' : theme.colors.mute, marginBottom: 0 },
              ]}
            >
              Shift Coverage ({submittedCount}/{totalAssignedCount})
            </Text>
          </View>

          <View style={styles.oneColCol}>
            {(data?.assigned_shifts || []).map((s) => {
              const isLogged = s.is_logged_today;
              const shiftClean = s.code.replace(/^shift\s*/i, '').trim();
              const shiftCodeName = shiftClean ? `Shift ${shiftClean}` : s.code;
              const displayStartTime = formatTo12Hour(s.start_time) || s.start_time;
              const displayEndTime = formatTo12Hour(s.end_time) || s.end_time;

              return (
                <Card
                  key={s.code}
                  className="rounded-2xl border border-border bg-card p-3.5 sm:p-4"
                  style={
                    isLogged
                      ? {
                          backgroundColor: isDark
                            ? 'rgba(16, 185, 129, 0.05)'
                            : 'rgba(16, 185, 129, 0.03)',
                          borderColor: isDark
                            ? 'rgba(16, 185, 129, 0.30)'
                            : 'rgba(16, 185, 129, 0.35)',
                        }
                      : undefined
                  }
                >
                  <View style={styles.shiftCardTopRow}>
                    <Badge
                      variant="neutral"
                      label={shiftCodeName}
                      className="px-2.5 py-1"
                    />

                    {!isLogged && (
                      <Badge
                        variant="warning"
                        label="Ready to Log"
                        className="px-2.5 py-1"
                      />
                    )}
                  </View>

                  <View style={styles.shiftMetadataStack}>
                    <View style={styles.shiftMetaRow}>
                      <View style={styles.metaLabelGroup}>
                        <Clock size={12} color={isDark ? '#94a3b8' : theme.colors.mute} />
                        <Text
                          variant="caption"
                          style={[styles.metaLabelText, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
                        >
                          Timings:
                        </Text>
                      </View>
                      <Text
                        variant="mono"
                        style={[styles.metaValueText, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                      >
                        {displayStartTime} – {displayEndTime} {s.crosses_midnight ? '🌙' : ''}
                      </Text>
                    </View>

                    {isLogged && (
                      <View style={styles.shiftMetaRow}>
                        <View style={styles.metaLabelGroup}>
                          <Timer size={12} color={isDark ? '#94a3b8' : theme.colors.mute} />
                          <Text
                            variant="caption"
                            style={[styles.metaLabelText, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
                          >
                            Machine RT :
                          </Text>
                        </View>
                        <Text
                          variant="mono"
                          style={[
                            styles.metaValueText,
                            { color: isDark ? '#34d399' : '#059669' },
                          ]}
                        >
                          {s.running_hours_today != null ? `${Number(s.running_hours_today.toFixed(1))}h` : '0h'}
                        </Text>
                      </View>
                    )}

                    {isLogged && s.end_meter_today != null && (
                      <View style={styles.shiftMetaRow}>
                        <View style={styles.metaLabelGroup}>
                          <Gauge size={12} color={isDark ? '#94a3b8' : theme.colors.mute} />
                          <Text
                            variant="caption"
                            style={[styles.metaLabelText, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
                          >
                            End Meter:
                          </Text>
                        </View>
                        <Text
                          variant="mono"
                          style={[
                            styles.metaValueText,
                            { color: isDark ? '#34d399' : '#059669' },
                          ]}
                        >
                          {s.end_meter_today.toFixed(1)} hrs
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.shiftCardActionRow, { borderTopColor: theme.colors.hairline }]}>
                    {isLogged ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handleNavigate(
                            `/operations?tab=history&shift=${encodeURIComponent(s.code)}`
                          )
                        }
                        className="w-full flex-row items-center justify-between px-2"
                        label="View Shift Log"
                        rightIcon={<ArrowRight size={14} color={theme.colors.link} />}
                      />
                    ) : (
                      <Button
                        variant="default"
                        size="default"
                        fullWidth
                        onPress={() =>
                          handleNavigate(
                            `/operations?tab=entry&shift=${encodeURIComponent(s.code)}`
                          )
                        }
                        label={`Log ${shiftCodeName}`}
                        rightIcon={<ArrowRight size={15} color="#ffffff" />}
                      />
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>
      ) : isLoading && !data ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={14} color={isDark ? '#94a3b8' : theme.colors.mute} />
            <Text
              variant="caption"
              weight="semibold"
              style={[
                styles.eyebrowHeader,
                { color: isDark ? '#94a3b8' : theme.colors.mute, marginBottom: 0 },
              ]}
            >
              Shift Coverage
            </Text>
          </View>
          <View style={styles.oneColCol}>
            <Card className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
              <View style={styles.shiftCardTopRow}>
                <Skeleton width={80} height={20} borderRadius={radiusNumeric.xs} />
                <Skeleton width={90} height={20} borderRadius={radiusNumeric.xs} />
              </View>
              <View style={styles.shiftMetadataStack}>
                <Skeleton width="65%" height={14} borderRadius={radiusNumeric.xs} />
              </View>
              <View style={[styles.shiftCardActionRow, { borderTopColor: theme.colors.hairline }]}>
                <Skeleton width="100%" height={38} borderRadius={radiusNumeric.sm} />
              </View>
            </Card>
          </View>
        </View>
      ) : null}

      {/* 3. Assigned Equipment & Client Worksite */}
      <View style={styles.section}>
        <Text
          variant="caption"
          weight="semibold"
          style={[styles.eyebrowHeader, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
        >
          Equipment & Worksite Assignment
        </Text>
        <View style={styles.oneColCol}>
          {/* Machine Card */}
          <Card
            className="rounded-2xl border border-border bg-card p-3.5 sm:p-4"
          >
            <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View
                style={[
                  styles.assignmentIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.12)',
                  },
                ]}
              >
                <Wrench size={14} color={isDark ? '#94a3b8' : theme.colors.mute} />
              </View>
              <Text
                variant="caption"
                style={[
                  styles.assignmentHeaderTitle,
                  { color: isDark ? '#f8fafc' : theme.colors.ink },
                ]}
              >
                ASSIGNED MACHINE
              </Text>
            </View>

            {isLoading && !data ? (
              <View style={styles.assignmentDetailsStack}>
                <View style={styles.detailRow}>
                  <Skeleton width={50} height={13} borderRadius={radiusNumeric.xs} />
                  <Skeleton width={130} height={16} borderRadius={radiusNumeric.xs} />
                </View>
                <View style={styles.detailRow}>
                  <Skeleton width={70} height={13} borderRadius={radiusNumeric.xs} />
                  <Skeleton width={90} height={14} borderRadius={radiusNumeric.xs} />
                </View>
                <View style={styles.detailRow}>
                  <Skeleton width={80} height={13} borderRadius={radiusNumeric.xs} />
                  <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} />
                </View>
              </View>
            ) : data?.machine ? (
              <View style={styles.assignmentDetailsStack}>
                <View style={styles.detailRow}>
                  <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                    Model:
                  </Text>
                  <Text
                    variant="subheading"
                    style={[styles.detailValueBold, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                  >
                    {data.machine.model || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                    Machine ID:
                  </Text>
                  <Text
                    variant="mono"
                    style={[styles.detailValueMono, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                  >
                    {data.machine.name || '—'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                    Serial Number:
                  </Text>
                  <Text
                    variant="mono"
                    style={[styles.detailValueMonoMuted, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
                  >
                    {data.machine.serialNumber || '—'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text
                variant="caption"
                style={[styles.emptyNoticeText, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
              >
                No active machine assigned. Contact your site supervisor.
              </Text>
            )}
          </Card>

          {/* Client & Worksite Card */}
          <Card
            className="rounded-2xl border border-border bg-card p-3.5 sm:p-4"
          >
            <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <View
                style={[
                  styles.assignmentIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(100, 116, 139, 0.12)',
                  },
                ]}
              >
                <Building2 size={14} color={isDark ? '#94a3b8' : theme.colors.mute} />
              </View>
              <Text
                variant="caption"
                style={[
                  styles.assignmentHeaderTitle,
                  { color: isDark ? '#f8fafc' : theme.colors.ink },
                ]}
              >
                CLIENT & LOCATION
              </Text>
            </View>

            {isLoading && !data ? (
              <View style={styles.assignmentDetailsStack}>
                <View style={styles.detailRow}>
                  <Skeleton width={50} height={13} borderRadius={radiusNumeric.xs} />
                  <Skeleton width={140} height={16} borderRadius={radiusNumeric.xs} />
                </View>
                <View style={styles.detailRowStart}>
                  <Skeleton width={50} height={13} borderRadius={radiusNumeric.xs} />
                  <Skeleton width={160} height={14} borderRadius={radiusNumeric.xs} />
                </View>
              </View>
            ) : data?.client ? (
              <View style={styles.assignmentDetailsStack}>
                <View style={styles.detailRow}>
                  <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                    Client:
                  </Text>
                  <Text
                    variant="subheading"
                    style={[styles.detailValueBold, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                    numberOfLines={1}
                  >
                    {data.client.name || '—'}
                  </Text>
                </View>
                <View style={styles.detailRowStart}>
                  <View style={styles.metaLabelGroup}>
                    <MapPin size={12} color={isDark ? '#94a3b8' : theme.colors.mute} />
                    <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                      Site:
                    </Text>
                  </View>
                  <Text
                    variant="body"
                    style={[styles.detailValueSite, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                  >
                    {data.client.site || '—'}
                  </Text>
                </View>
                {(data.shift?.start || data.shift?.end) && (
                  <View style={[styles.detailRowShift, { borderTopColor: theme.colors.hairline }]}>
                    <View style={styles.metaLabelGroup}>
                      <Clock size={12} color={isDark ? '#94a3b8' : theme.colors.mute} />
                      <Text variant="caption" style={[styles.detailLabel, { color: isDark ? '#94a3b8' : theme.colors.mute }]}>
                        Shift:
                      </Text>
                    </View>
                    <Text
                      variant="mono"
                      style={[styles.detailValueMono, { color: isDark ? '#f8fafc' : theme.colors.ink }]}
                    >
                      {data.shift.start} – {data.shift.end}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text
                variant="caption"
                style={[styles.emptyNoticeText, { color: isDark ? '#94a3b8' : theme.colors.mute }]}
              >
                Client site will be determined by machine deployment.
              </Text>
            )}
          </Card>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.md,
  },
  section: {
    marginBottom: 0,
  },
  eyebrowHeader: {
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  oneColCol: {
    flexDirection: 'column',
    gap: spacingNumeric.sm,
  },
  shiftCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: spacingNumeric.xs,
  },
  shiftMetadataStack: {
    gap: 6,
    marginVertical: spacingNumeric.xs + 2,
  },
  shiftMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  metaLabelText: {},
  metaValueText: {},
  shiftCardActionRow: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.xs + 2,
    marginTop: spacingNumeric.xs,
  },
  assignmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: spacingNumeric.xs + 2,
    borderBottomWidth: 1,
    marginBottom: spacingNumeric.xs + 2,
  },
  assignmentIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  assignmentHeaderTitle: {
    textTransform: 'uppercase',
  },
  assignmentDetailsStack: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailRowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailRowShift: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    marginTop: 2,
  },
  detailLabel: {},
  detailValueBold: {},
  detailValueMono: {},
  detailValueMonoMuted: {},
  detailValueSite: {
    textAlign: 'right',
    flex: 1,
  },
  emptyNoticeText: {
    paddingVertical: spacingNumeric.xs,
  },
});
