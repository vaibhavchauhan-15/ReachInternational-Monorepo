import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { Touchable } from '../../ui/Touchable';
import { LinearGradient } from '../../ui/AppLinearGradient';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
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
} from 'lucide-react-native';
import { formatTo12Hour } from '@reachinternational/utils';
import { haptics } from '../../../lib/interaction/haptics';

export interface OperatorDashboardCardProps {
  data: OperatorDashboardDTO | null;
}

export const OperatorDashboardCard: React.FC<OperatorDashboardCardProps> = ({
  data,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  const isSubmitted = data?.today?.entryStatus === 'submitted';
  const isPartial = data?.today?.entryStatus === 'partial';
  const submittedCount = data?.today?.submittedCount ?? 0;
  const totalAssignedCount =
    data?.today?.totalAssignedCount ?? (data?.assigned_shifts?.length || 1);
  const totalRunningHoursToday = data?.today?.totalRunningHoursToday ?? 0;

  const handleNavigate = async (route: string) => {
    try {
      haptics.select();
    } catch {
      // ignore
    }
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      {/* 1. Today's Shift Status & Meter Readings */}
      <View style={styles.section}>
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          TODAY'S SHIFT STATUS
        </Text>
        <View style={isWide ? styles.twoColRow : styles.oneColCol}>
          <StatusCard
            title="LOG SUBMISSION STATUS"
            status={isSubmitted ? 'success' : isPartial ? 'warning' : 'pending'}
            label={
              isSubmitted
                ? totalAssignedCount > 1
                  ? `All ${totalAssignedCount} Shifts Submitted`
                  : 'Submitted Today'
                : isPartial
                ? `${submittedCount}/${totalAssignedCount} Shifts Logged`
                : 'Pending Submission'
            }
            description={
              isSubmitted
                ? `${totalRunningHoursToday}h recorded across assigned shift(s) today.`
                : isPartial
                ? `${submittedCount} of ${totalAssignedCount} shifts recorded (${totalRunningHoursToday}h). Ready to log remaining shift.`
                : 'Remember to submit before the end of your shift.'
            }
            href={isSubmitted ? '/operations?tab=history' : '/operations'}
            style={isWide ? styles.cardInRow : undefined}
          />

          {/* Last Recorded Meter (HMR) Card */}
          <Touchable
            preset="card"
            onPress={() => handleNavigate('/(app)/operations')}
            accessibilityRole="button"
            accessibilityLabel={`Last recorded meter: ${data?.today?.lastHmr != null ? `${data.today.lastHmr.toFixed(1)} hrs` : 'No prior logs'}`}
            style={[styles.meterCardWrapper, isWide && styles.cardInRow]}
          >
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Top Hairline Gradient Accent Bar */}
              <LinearGradient
                colors={['rgba(148, 163, 184, 0.4)', 'rgba(148, 163, 184, 0.2)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topAccentBar}
              />

              <View style={styles.statCardContent}>
                <Text variant="caption" style={[styles.statCardEyebrow, { color: theme.colors.mute }]}>
                  LAST RECORDED METER (HMR)
                </Text>
                <View style={styles.meterValueRow}>
                  <View
                    style={[
                      styles.meterIconBox,
                      {
                        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.10)',
                        borderColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.18)',
                      },
                    ]}
                  >
                    <Gauge size={16} color={theme.colors.mute} />
                  </View>
                  <Text variant="mono" style={[styles.meterValueText, { color: theme.colors.ink }]}>
                    {data?.today?.lastHmr != null ? `${data.today.lastHmr.toFixed(1)} hrs` : 'No prior logs'}
                  </Text>
                </View>
                <Text variant="caption" style={[styles.statCardSubtext, { color: theme.colors.mute }]}>
                  Use as starting meter for your next log
                </Text>
              </View>
            </View>
          </Touchable>
        </View>
      </View>

      {/* 2. Continuous Shift Coverage Tracker (Up to 3 Shifts / 24h) */}
      {data?.assigned_shifts && data.assigned_shifts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={14} color={theme.colors.mute} />
            <Text variant="caption" style={[styles.eyebrowHeader, { color: theme.colors.mute, marginBottom: 0 }]}>
              SHIFT COVERAGE ({submittedCount}/{totalAssignedCount})
            </Text>
          </View>

          <View style={isWide ? styles.shiftCardsGrid : styles.oneColCol}>
            {data.assigned_shifts.map((s) => {
              const isLogged = s.is_logged_today;
              const shiftClean = s.code.replace(/^shift\s*/i, '').trim();
              const shiftCodeName = shiftClean ? `Shift ${shiftClean}` : s.code;
              const displayStartTime = formatTo12Hour(s.start_time) || s.start_time;
              const displayEndTime = formatTo12Hour(s.end_time) || s.end_time;

              return (
                <View
                  key={s.code}
                  style={[
                    styles.shiftCard,
                    isWide && styles.shiftCardInGrid,
                    {
                      backgroundColor: isLogged
                        ? isDark
                          ? 'rgba(16, 185, 129, 0.05)'
                          : 'rgba(16, 185, 129, 0.03)'
                        : theme.colors.canvasElevated,
                      borderColor: isLogged
                        ? isDark
                          ? 'rgba(16, 185, 129, 0.25)'
                          : 'rgba(16, 185, 129, 0.35)'
                        : theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.shiftCardTopRow}>
                    <View
                      style={[
                        styles.shiftCodeBadge,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text variant="mono" style={[styles.shiftCodeText, { color: theme.colors.ink }]}>
                        {shiftCodeName}
                      </Text>
                    </View>

                    {!isLogged && (
                      <View
                        style={[
                          styles.readyToLogPill,
                          {
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.10)',
                            borderColor: isDark ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.25)',
                          },
                        ]}
                      >
                        <Text variant="mono" style={[styles.readyToLogText, { color: isDark ? '#fbbf24' : '#d97706' }]}>
                          Ready to Log
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.shiftMetadataStack}>
                    <View style={styles.shiftMetaRow}>
                      <View style={styles.metaLabelGroup}>
                        <Clock size={12} color={theme.colors.mute} />
                        <Text variant="caption" style={[styles.metaLabelText, { color: theme.colors.mute }]}>
                          Timings:
                        </Text>
                      </View>
                      <Text variant="mono" style={[styles.metaValueText, { color: theme.colors.ink }]}>
                        {displayStartTime} – {displayEndTime} {s.crosses_midnight ? '🌙' : ''}
                      </Text>
                    </View>

                    {isLogged && (
                      <View style={styles.shiftMetaRow}>
                        <View style={styles.metaLabelGroup}>
                          <Timer size={12} color={theme.colors.mute} />
                          <Text variant="caption" style={[styles.metaLabelText, { color: theme.colors.mute }]}>
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
                          <Gauge size={12} color={theme.colors.mute} />
                          <Text variant="caption" style={[styles.metaLabelText, { color: theme.colors.mute }]}>
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
                      <Touchable
                        preset="row"
                        onPress={() => handleNavigate(`/(app)/operations?tab=history&shift=${encodeURIComponent(s.code)}`)}
                        style={styles.viewShiftBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`View log for ${shiftCodeName}`}
                      >
                        <Text variant="caption" style={[styles.viewShiftText, { color: theme.colors.link }]}>
                          View Shift Log
                        </Text>
                        <ArrowRight size={13} color={theme.colors.link} />
                      </Touchable>
                    ) : (
                      <Touchable
                        preset="button"
                        onPress={() => handleNavigate(`/(app)/operations?tab=entry&shift=${encodeURIComponent(s.code)}`)}
                        style={[styles.logShiftBtn, { backgroundColor: theme.colors.ink }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Log ${shiftCodeName}`}
                      >
                        <Text variant="subheading" style={[styles.logShiftBtnText, { color: theme.colors.canvas }]}>
                          Log {shiftCodeName}
                        </Text>
                        <ArrowRight size={14} color={theme.colors.canvas} />
                      </Touchable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 3. Assigned Equipment & Client Worksite */}
      <View style={styles.section}>
        <Text variant="caption" style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
          EQUIPMENT & WORKSITE ASSIGNMENT
        </Text>
        <View style={isWide ? styles.twoColRow : styles.oneColCol}>
          {/* Machine Card */}
          <Touchable
            preset="card"
            onPress={() => handleNavigate('/(app)/machines')}
            accessibilityRole="button"
            accessibilityLabel="Assigned Machine Details"
            style={[styles.assignmentCardWrapper, isWide && styles.cardInRow]}
          >
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Top Hairline Gradient Accent Bar */}
              <LinearGradient
                colors={['rgba(148, 163, 184, 0.4)', 'rgba(148, 163, 184, 0.2)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topAccentBar}
              />

              <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
                <View
                  style={[
                    styles.assignmentIconBox,
                    {
                      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.10)',
                      borderColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.18)',
                    },
                  ]}
                >
                  <Wrench size={14} color={theme.colors.mute} />
                </View>
                <Text variant="caption" style={[styles.assignmentHeaderTitle, { color: theme.colors.ink }]}>
                  ASSIGNED MACHINE
                </Text>
              </View>

              {data?.machine ? (
                <View style={styles.assignmentDetailsStack}>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Model:</Text>
                    <Text variant="subheading" style={[styles.detailValueBold, { color: theme.colors.ink }]}>
                      {data.machine.model || '—'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Machine ID:</Text>
                    <Text variant="mono" style={[styles.detailValueMono, { color: theme.colors.ink }]}>
                      {data.machine.name || '—'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Serial Number:</Text>
                    <Text variant="mono" style={[styles.detailValueMonoMuted, { color: theme.colors.mute }]}>
                      {data.machine.serialNumber || '—'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text variant="caption" style={[styles.emptyNoticeText, { color: theme.colors.mute }]}>
                  No active machine assigned. Contact your site supervisor.
                </Text>
              )}
            </View>
          </Touchable>

          {/* Client & Worksite Card */}
          <Touchable
            preset="card"
            onPress={() => handleNavigate('/(app)/machines')}
            accessibilityRole="button"
            accessibilityLabel="Client and location details"
            style={[styles.assignmentCardWrapper, isWide && styles.cardInRow]}
          >
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Top Hairline Gradient Accent Bar */}
              <LinearGradient
                colors={['rgba(148, 163, 184, 0.4)', 'rgba(148, 163, 184, 0.2)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topAccentBar}
              />

              <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
                <View
                  style={[
                    styles.assignmentIconBox,
                    {
                      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.10)',
                      borderColor: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.18)',
                    },
                  ]}
                >
                  <Building2 size={14} color={theme.colors.mute} />
                </View>
                <Text variant="caption" style={[styles.assignmentHeaderTitle, { color: theme.colors.ink }]}>
                  CLIENT & LOCATION
                </Text>
              </View>

              {data?.client ? (
                <View style={styles.assignmentDetailsStack}>
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Client:</Text>
                    <Text variant="subheading" style={[styles.detailValueBold, { color: theme.colors.ink }]} numberOfLines={1}>
                      {data.client.name || '—'}
                    </Text>
                  </View>
                  <View style={styles.detailRowStart}>
                    <View style={styles.metaLabelGroup}>
                      <MapPin size={12} color={theme.colors.mute} />
                      <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Site:</Text>
                    </View>
                    <Text variant="body" style={[styles.detailValueSite, { color: theme.colors.ink }]}>
                      {data.client.site || '—'}
                    </Text>
                  </View>
                  {(data.shift?.start || data.shift?.end) && (
                    <View style={[styles.detailRowShift, { borderTopColor: theme.colors.hairline }]}>
                      <View style={styles.metaLabelGroup}>
                        <Clock size={12} color={theme.colors.mute} />
                        <Text variant="caption" style={[styles.detailLabel, { color: theme.colors.mute }]}>Shift:</Text>
                      </View>
                      <Text variant="mono" style={[styles.detailValueMono, { color: theme.colors.ink }]}>
                        {data.shift.start} – {data.shift.end}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text variant="caption" style={[styles.emptyNoticeText, { color: theme.colors.mute }]}>
                  Client site will be determined by machine deployment.
                </Text>
              )}
            </View>
          </Touchable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.lg,
  },
  section: {
    marginBottom: spacingNumeric.xs,
  },
  eyebrowHeader: {
    textTransform: 'uppercase',
    marginBottom: spacingNumeric.xs + 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacingNumeric.xs + 3,
  },
  oneColCol: {
    flexDirection: 'column',
    gap: spacingNumeric.sm,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm + 2,
    alignItems: 'stretch',
  },
  cardInRow: {
    flex: 1,
  },
  meterCardWrapper: {
    flex: 1,
    minWidth: '47%',
  },
  statCard: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 108,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      } as any,
    }),
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 2,
  },
  statCardContent: {
    gap: spacingNumeric.xs,
  },
  statCardEyebrow: {
    textTransform: 'uppercase',
  },
  meterValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  meterIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meterValueText: {
  },
  statCardSubtext: {
    marginTop: 1,
  },
  shiftCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm + 2,
  },
  shiftCardInGrid: {
    flex: 1,
    minWidth: 260,
  },
  shiftCard: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    overflow: 'hidden',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
      } as any,
    }),
  },
  shiftCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: spacingNumeric.xs,
  },
  shiftCodeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  shiftCodeText: {
  },
  readyToLogPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  readyToLogText: {
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
  metaLabelText: {
  },
  metaValueText: {
  },
  shiftCardActionRow: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.xs + 2,
    marginTop: spacingNumeric.xs,
  },
  logShiftBtn: {
    width: '100%',
    minHeight: 44,
    borderRadius: radiusNumeric.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  logShiftBtnText: {
  },
  viewShiftBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewShiftText: {
  },
  assignmentCardWrapper: {
    flex: 1,
    minWidth: '47%',
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
    borderRadius: 8,
    borderWidth: 1,
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
  detailLabel: {
  },
  detailValueBold: {
  },
  detailValueMono: {
  },
  detailValueMonoMuted: {
  },
  detailValueSite: {
    textAlign: 'right',
    flex: 1,
  },
  emptyNoticeText: {
    paddingVertical: spacingNumeric.xs,
  },
});
