import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, useTheme } from '../../ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import {
  Wrench,
  Building2,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react-native';
import type { OperatorDashboardDTO } from '@reachinternational/types';

export interface OperatorDashboardCardProps {
  data: OperatorDashboardDTO | null;
}

export const OperatorDashboardCard: React.FC<OperatorDashboardCardProps> = ({ data }) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const isSubmitted = data?.today?.entryStatus === 'submitted';

  return (
    <>
      {/* Primary Action CTA Card / Alert Banner */}
      <TouchableOpacity
        onPress={() =>
          router.push(
            (isSubmitted
              ? '/(app)/operations?tab=history'
              : '/(app)/operations?tab=entry') as any
          )
        }
        activeOpacity={0.85}
        style={{ marginBottom: spacingNumeric.md }}
        accessibilityRole="button"
        accessibilityLabel={isSubmitted ? "Today's Log Submitted" : "Today's Log Pending"}
      >
        <Card
          variant="elevated"
          style={[
            styles.ctaCard,
            {
              backgroundColor: isSubmitted
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5')
                : (isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb'),
              borderColor: isSubmitted
                ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0')
                : (isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'),
            },
          ]}
        >
          <View style={styles.ctaLeft}>
            <View
              style={[
                styles.ctaIconWrap,
                {
                  backgroundColor: isSubmitted
                    ? 'rgba(16, 185, 129, 0.18)'
                    : 'rgba(245, 158, 11, 0.18)',
                },
              ]}
            >
              {isSubmitted ? (
                <FileCheck2 size={22} color={isDark ? '#34d399' : '#059669'} />
              ) : (
                <AlertTriangle size={22} color={isDark ? '#fbbf24' : '#d97706'} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.ctaTitle,
                  {
                    color: isSubmitted
                      ? (isDark ? '#34d399' : '#065f46')
                      : (isDark ? '#fbbf24' : '#92400e'),
                  },
                ]}
              >
                {isSubmitted ? "Today's Log Submitted" : "Today's Log Pending"}
              </Text>
              <Text
                style={[
                  styles.ctaSubtitle,
                  {
                    color: isSubmitted
                      ? (isDark ? '#6ee7b7' : '#047857')
                      : (isDark ? '#fcd34d' : '#b45309'),
                  },
                ]}
              >
                {isSubmitted
                  ? 'Daily shift running hours are recorded. Tap to view or update.'
                  : 'Daily running hours have not been submitted for today.'}
              </Text>
            </View>
          </View>
          <ArrowRight
            size={18}
            color={
              isSubmitted
                ? (isDark ? '#34d399' : '#059669')
                : (isDark ? '#fbbf24' : '#d97706')
            }
          />
        </Card>
      </TouchableOpacity>

      {/* Shift & Meter Status */}
      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
        TODAY'S SHIFT TELEMETRY
      </Text>
      <View style={styles.kpiGrid}>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Log Status</Text>
          <Text
            style={[
              styles.kpiValue,
              {
                color: isSubmitted ? theme.colors.success : '#d97706',
              },
            ]}
          >
            {isSubmitted ? 'Submitted' : 'Pending'}
          </Text>
        </Card>
        <Card variant="elevated" style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Last Meter (HMR)</Text>
          <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
            {data?.today?.lastHmr != null
              ? `${data.today.lastHmr.toFixed(1)}`
              : '—'}
          </Text>
        </Card>
      </View>

      {/* Equipment & Worksite Cards */}
      <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.md }]}>
        ASSIGNED EQUIPMENT & WORKSITE
      </Text>
      <Card variant="elevated" style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Wrench size={18} color={theme.colors.link} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoCardTitle, { color: theme.colors.ink }]}>
              {data?.machine?.model || 'No Machine Assigned'}
            </Text>
            <Text style={[styles.infoCardDesc, { color: theme.colors.mute }]}>
              ID: {data?.machine?.name || '—'} • Serial: {data?.machine?.serialNumber || '—'}
            </Text>
          </View>
        </View>
      </Card>

      <Card variant="elevated" style={[styles.infoCard, { marginTop: 8 }]}>
        <View style={styles.infoRow}>
          <Building2 size={18} color={theme.colors.success} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.infoCardTitle, { color: theme.colors.ink }]}>
              {data?.client?.name || 'No Client Assigned'}
            </Text>
            <Text style={[styles.infoCardDesc, { color: theme.colors.mute }]}>
              Site: {data?.client?.site || '—'}
            </Text>
          </View>
        </View>
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  eyebrowHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.xs,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    padding: spacingNumeric.md,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  ctaCard: {
    padding: spacingNumeric.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacingNumeric.sm,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingNumeric.md,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    padding: spacingNumeric.md,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoCardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
