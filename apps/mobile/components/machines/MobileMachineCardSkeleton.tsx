import React from 'react';
import { View, StyleSheet } from 'react-native';
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
          {/* Machine ID Pill Placeholder */}
          <Skeleton
            width={86}
            height={26}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
          {/* Model Name Placeholder */}
          <Skeleton
            width={76}
            height={16}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Badges Column Placeholder */}
        <View style={styles.badgeWrap}>
          <Skeleton
            width={60}
            height={20}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={56}
            height={20}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>

      {/* Sub Metadata Row */}
      <View style={styles.metaRow}>
        <Skeleton
          width="55%"
          height={12}
          borderRadius={radiusNumeric.sm}
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
              width={75}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={65}
              height={16}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Skeleton
              width={75}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={105}
              height={14}
              borderRadius={radiusNumeric.sm}
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
              width={68}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={88}
              height={12}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Skeleton
              width={76}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={88}
              height={12}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
        </View>
      </View>

      {/* Action Buttons Footer */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <View style={styles.footerLeftBtns}>
          <Skeleton
            width={54}
            height={26}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={64}
            height={26}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        <Skeleton
          width={88}
          height={26}
          borderRadius={radiusNumeric.sm}
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

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
  },
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
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
    marginBottom: spacingNumeric.sm,
    marginTop: 2,
  },
  specsWell: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    marginBottom: spacingNumeric.sm,
    gap: spacingNumeric.xs,
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
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  footerLeftBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  noMargin: {
    marginVertical: 0,
  },
  microMargin: {
    marginVertical: 2,
  },
});
