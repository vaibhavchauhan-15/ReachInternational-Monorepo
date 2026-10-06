import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MobileMachineCardSkeletonProps {
  animate?: boolean;
}

export const MobileMachineCardSkeleton: React.FC<MobileMachineCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {/* Machine ID Pill Chip Placeholder */}
          <Skeleton
            width={86}
            height={28}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
          {/* Model Name Placeholder */}
          <Skeleton
            width={110}
            height={18}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Badges Column: Active & Rented Pills */}
        <View style={styles.badgeWrap}>
          <Skeleton
            width={64}
            height={22}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={64}
            height={22}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>

      {/* Sub Metadata Row: S/N Placeholder */}
      <View style={styles.metaRow}>
        <Skeleton
          width={150}
          height={13}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* Inset Specs Well */}
      <View
        style={[
          styles.specsWell,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Top Specs Row: HMR & Client */}
        <View style={styles.twoColGrid}>
          <View style={{ flex: 1 }}>
            <Skeleton
              width={90}
              height={11}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={65}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Skeleton
              width={85}
              height={11}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={120}
              height={15}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
        </View>

        <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

        {/* Bottom Specs Row: Supervisor & Operator */}
        <View style={styles.twoColGrid}>
          <View style={{ flex: 1 }}>
            <Skeleton
              width={75}
              height={11}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={100}
              height={14}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Skeleton
              width={85}
              height={11}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={95}
              height={14}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
        </View>
      </View>

      {/* Card Action Footer: Left History squircle & Right Chevron squircle */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <Skeleton
          width={36}
          height={36}
          borderRadius={10}
          animate={animate}
          style={styles.noMargin}
        />

        <Skeleton
          width={36}
          height={36}
          borderRadius={10}
          animate={animate}
          style={styles.noMargin}
        />
      </View>
    </View>
  );
};

export interface MobileMachineListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const MobileMachineListSkeleton: React.FC<MobileMachineListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <MobileMachineCardSkeleton key={`machine-skel-${idx}`} animate={animate} />
      ))}
    </View>
  );
};

export interface MachineListSkeletonProps {
  count?: number;
  animate?: boolean;
}

/**
 * Full page skeleton shell matching Screenshot 1:
 * 1. 2x2 KPI Cards Grid (Assigned Fleet, Available, On Rent, Breakdown Events)
 * 2. Search pill & Filter button toolbar
 * 3. Machine list cards
 */
export const MachineListSkeleton: React.FC<MachineListSkeletonProps> = ({
  count = 3,
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.fullPageContainer}>
      {/* 2x2 KPI Grid Skeleton matching Screenshot 1 */}
      <View style={styles.kpiGrid}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <View
            key={`kpi-skel-${idx}`}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Skeleton
              width={idx % 2 === 0 ? 95 : 75}
              height={12}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={35}
              height={26}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={{ marginTop: 6, marginBottom: 0 }}
            />
          </View>
        ))}
      </View>

      {/* Search & Filter Toolbar Skeleton matching Screenshot 1 */}
      <View style={styles.toolbarRow}>
        <View
          style={[
            styles.searchBarSkeleton,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton
            width={16}
            height={16}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width="65%"
            height={14}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        <View
          style={[
            styles.filterBtnSkeleton,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton
            width={15}
            height={15}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={38}
            height={14}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>

      {/* Machine Cards */}
      <MobileMachineListSkeleton count={count} animate={animate} />
    </View>
  );
};

const styles = StyleSheet.create({
  fullPageContainer: {
    width: '100%',
    paddingBottom: spacingNumeric.lg,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 74,
    justifyContent: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchBarSkeleton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  filterBtnSkeleton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listContainer: {
    width: '100%',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: spacingNumeric.sm,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  specsWell: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  twoColGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
  },
  specsDivider: {
    height: 1,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  noMargin: {
    marginVertical: 0,
  },
  microMargin: {
    marginVertical: 2,
  },
});
