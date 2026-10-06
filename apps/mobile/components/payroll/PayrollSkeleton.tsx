import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton, useTheme, Card } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface PayrollCardSkeletonProps {
  animate?: boolean;
}

export const PayrollCardSkeleton: React.FC<PayrollCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <Card
      variant="elevated"
      style={[
        styles.operatorCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Card Header Row */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Skeleton width={28} height={16} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width={140} height={18} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
          <Skeleton width={160} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>

        <View style={styles.headerRight}>
          <Skeleton width={80} height={20} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Breakdown Row */}
      <View
        style={[
          styles.breakdownRow,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.breakdownCol}>
          <Skeleton width={70} height={10} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={60} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>

        <View style={styles.breakdownCol}>
          <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={70} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>

        <View style={styles.breakdownCol}>
          <Skeleton width={65} height={10} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={65} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>
      </View>
    </Card>
  );
};

export interface PayrollSkeletonProps {
  cardCount?: number;
  animate?: boolean;
}

export const PayrollSkeleton: React.FC<PayrollSkeletonProps> = ({
  cardCount = 4,
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Month Selector Pills Skeleton */}
      <View style={styles.monthScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScrollContent}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={`month-skel-${i}`}
              width={i === 0 ? 95 : 85}
              height={36}
              borderRadius={radiusNumeric.full}
              animate={animate}
            />
          ))}
        </ScrollView>
      </View>

      {/* KPI Grid Skeleton */}
      <View style={styles.kpiRow}>
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton width={80} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={110} height={24} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 8 }} />
        </View>

        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton width={70} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={100} height={24} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 8 }} />
        </View>
      </View>

      {/* Search Bar Skeleton */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton width={16} height={16} borderRadius={radiusNumeric.full} animate={animate} />
        <Skeleton width="60%" height={14} borderRadius={radiusNumeric.xs} animate={animate} />
      </View>

      {/* Payout Filter Strip Skeleton */}
      <View style={styles.filterStripContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={`filter-skel-${i}`}
              width={i === 0 ? 50 : i === 1 ? 95 : 85}
              height={32}
              borderRadius={radiusNumeric.full}
              animate={animate}
            />
          ))}
        </ScrollView>
      </View>

      {/* Operators List Skeleton */}
      <View style={styles.listSection}>
        <Skeleton width={110} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginLeft: 4, marginBottom: 4 }} />
        {Array.from({ length: cardCount }).map((_, i) => (
          <PayrollCardSkeleton key={`op-skel-${i}`} animate={animate} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.md,
  },
  monthScroll: {
    maxHeight: 40,
  },
  monthScrollContent: {
    gap: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    flex: 1,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  filterStripContainer: {
    marginVertical: 2,
  },
  filterStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  listSection: {
    gap: spacingNumeric.sm,
  },
  operatorCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  breakdownRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: 10,
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center',
  },
});
