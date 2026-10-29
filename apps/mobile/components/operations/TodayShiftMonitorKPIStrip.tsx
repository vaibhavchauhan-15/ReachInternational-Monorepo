/**
 * ReachInternational Mobile — Today's Shift Monitor KPI Strip
 * 100% Web Parity with apps/web/components/operations/TodayShiftMonitorKPIStrip.tsx
 *
 * Implements:
 * - 4-column responsive grid via KPIGrid (auto reflows to 4 cols on desktop & tablet, 2 on mobile)
 * - Exact token matching: Total Roster, Entered, Pending, Unassigned
 * - Inline semantic status icons: UserCheck, Clock, AlertCircle
 * - Zero raw typography properties (strictly uses canonical <Text variant="..." weight="...">)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { KPIGrid } from '../dashboard/shared/KPIGrid';
import { Text } from '../ui/Text';
import { Skeleton } from '../ui/Skeleton';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { UserCheck, Clock, AlertCircle } from '../ui/icon';

export interface TodayShiftSummary {
  total: number;
  entered: number;
  pending: number;
  unassigned: number;
}

export interface TodayShiftMonitorKPIStripProps {
  summary: TodayShiftSummary;
  isLoading?: boolean;
}

export function TodayShiftMonitorKPIStrip({
  summary,
  isLoading = false,
}: TodayShiftMonitorKPIStripProps) {
  const { theme, isDark } = useTheme();

  return (
    <KPIGrid columns={4}>
      {/* 1. Total Roster */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
          Total Shift
        </Text>
        <View style={styles.valueRow}>
          {isLoading ? (
            <Skeleton width={36} height={24} borderRadius={radiusNumeric.xs} />
          ) : (
            <Text variant="title" weight="bold" style={{ color: theme.colors.ink }}>
              {summary.total}
            </Text>
          )}
        </View>
      </View>

      {/* 2. Entered */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : 'rgba(16, 185, 129, 0.08)',
            borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : 'rgba(16, 185, 129, 0.25)',
          },
        ]}
      >
        <View style={styles.labelWithIcon}>
          <UserCheck size={13} color={isDark ? '#34d399' : '#047857'} />
          <Text
            variant="caption"
            weight="medium"
            style={{ color: isDark ? '#34d399' : '#047857' }}
          >
            Entered
          </Text>
        </View>
        <View style={styles.valueRow}>
          {isLoading ? (
            <Skeleton width={36} height={24} borderRadius={radiusNumeric.xs} />
          ) : (
            <Text
              variant="title"
              weight="bold"
              style={{ color: isDark ? '#34d399' : '#047857' }}
            >
              {summary.entered}
            </Text>
          )}
        </View>
      </View>

      {/* 3. Pending */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: isDark ? 'rgba(217, 119, 6, 0.12)' : 'rgba(245, 158, 11, 0.08)',
            borderColor: isDark ? 'rgba(217, 119, 6, 0.3)' : 'rgba(245, 158, 11, 0.25)' ,
          },
        ]}
      >
        <View style={styles.labelWithIcon}>
          <Clock size={13} color={isDark ? '#fbbf24' : '#b45309'} />
          <Text
            variant="caption"
            weight="medium"
            style={{ color: isDark ? '#fbbf24' : '#b45309' }}
          >
            Pending
          </Text>
        </View>
        <View style={styles.valueRow}>
          {isLoading ? (
            <Skeleton width={36} height={24} borderRadius={radiusNumeric.xs} />
          ) : (
            <Text
              variant="title"
              weight="bold"
              style={{ color: isDark ? '#fbbf24' : '#b45309' }}
            >
              {summary.pending}
            </Text>
          )}
        </View>
      </View>

      {/* 4. Unassigned */}
      <View
        style={[
          styles.kpiCard,
          {
            backgroundColor: isDark ? 'rgba(220, 38, 38, 0.12)' : 'rgba(239, 68, 68, 0.08)',
            borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : 'rgba(239, 68, 68, 0.25)',
          },
        ]}
      >
        <View style={styles.labelWithIcon}>
          <AlertCircle size={13} color={isDark ? '#f87171' : '#b91c1c'} />
          <Text
            variant="caption"
            weight="medium"
            style={{ color: isDark ? '#f87171' : '#b91c1c' }}
          >
            Unassigned
          </Text>
        </View>
        <View style={styles.valueRow}>
          {isLoading ? (
            <Skeleton width={36} height={24} borderRadius={radiusNumeric.xs} />
          ) : (
            <Text
              variant="title"
              weight="bold"
              style={{ color: isDark ? '#f87171' : '#b91c1c' }}
            >
              {summary.unassigned}
            </Text>
          )}
        </View>
      </View>
    </KPIGrid>
  );
}

const styles = StyleSheet.create({
  kpiCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm + 4,
    justifyContent: 'space-between',
    minHeight: 74,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  valueRow: {
    marginTop: spacingNumeric.xs,
  },
});
