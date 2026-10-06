import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AttendanceCardSkeletonProps {
  animate?: boolean;
}

export const AttendanceCardSkeleton: React.FC<AttendanceCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.employeeCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Header Row: Initials Avatar, Name, Role badge */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Skeleton
            width={38}
            height={38}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          <View style={styles.nameMetaCol}>
            <Skeleton
              width={120}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={80}
              height={12}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
          </View>
        </View>

        <Skeleton
          width={60}
          height={22}
          borderRadius={radiusNumeric.full}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* Inset Stats Box */}
      <View
        style={[
          styles.statsBox,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.statCol}>
          <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={30} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />
        <View style={styles.statCol}>
          <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={30} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />
        <View style={styles.statCol}>
          <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={30} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
      </View>
    </View>
  );
};

export interface AttendanceListSkeletonProps {
  count?: number;
  showKpi?: boolean;
  animate?: boolean;
}

export const AttendanceListSkeleton: React.FC<AttendanceListSkeletonProps> = ({
  count = 4,
  showKpi = true,
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Horizontal KPI Strip Skeleton */}
      {showKpi && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          {Array.from({ length: 4 }).map((_, idx) => (
            <View
              key={`kpi-att-${idx}`}
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Skeleton
                width={80}
                height={12}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <Skeleton
                width={40}
                height={24}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={{ marginTop: 8, marginBottom: 0 }}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Cards List Skeleton */}
      <View style={styles.cardList}>
        {Array.from({ length: count }).map((_, idx) => (
          <AttendanceCardSkeleton key={`att-card-${idx}`} animate={animate} />
        ))}
      </View>
    </View>
  );
};

export interface AttendanceDetailSkeletonProps {
  animate?: boolean;
}

export const AttendanceDetailSkeleton: React.FC<AttendanceDetailSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.detailContainer}>
      {/* Header Profile Info */}
      <View
        style={[
          styles.detailHeroCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.detailHeroRow}>
          <Skeleton
            width={48}
            height={48}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={140} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={90} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          </View>
        </View>

        {/* 3 Stats Row */}
        <View
          style={[
            styles.statsBox,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
              marginTop: 12,
            },
          ]}
        >
          <View style={styles.statCol}>
            <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={32} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.statCol}>
            <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={32} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.statCol}>
            <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={32} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
          </View>
        </View>
      </View>

      {/* Calendar Grid Shell */}
      <View
        style={[
          styles.calendarCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.calendarHeaderRow}>
          <Skeleton width={120} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
        </View>
        <View style={styles.calendarGrid}>
          {Array.from({ length: 28 }).map((_, idx) => (
            <View
              key={`cal-cell-${idx}`}
              style={[
                styles.calendarCell,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Skeleton width={16} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacingNumeric.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  kpiCard: {
    width: 140,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  cardList: {
    gap: spacingNumeric.sm,
  },
  employeeCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  nameMetaCol: {
    flex: 1,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  detailContainer: {
    width: '100%',
    gap: spacingNumeric.md,
  },
  detailHeroCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  detailHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  calendarHeaderRow: {
    paddingBottom: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  calendarCell: {
    width: '12.5%',
    height: 40,
    borderRadius: radiusNumeric.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMargin: {
    marginVertical: 0,
  },
});
