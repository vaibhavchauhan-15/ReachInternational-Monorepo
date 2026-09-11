import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme, Card } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface OperationLogCardSkeletonProps {
  animate?: boolean;
}

export const OperationLogCardSkeleton: React.FC<OperationLogCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <Card
      variant="elevated"
      style={[
        styles.logCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Header Row */}
      <View style={styles.logCardHeader}>
        <View style={styles.logCardHeaderLeft}>
          <View style={styles.dateRow}>
            {/* Date Pill */}
            <Skeleton
              width={75}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
            {/* Timestamp Badge */}
            <Skeleton
              width={130}
              height={18}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          {/* Machine Model */}
          <Skeleton
            width={95}
            height={16}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={{ marginTop: 4, marginBottom: 2 }}
          />
          {/* Serial Number */}
          <Skeleton
            width={110}
            height={12}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Status Badge */}
        <Skeleton
          width={65}
          height={22}
          borderRadius={radiusNumeric.full}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* Middle Specs Box */}
      <View
        style={[
          styles.logDetailsBox,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Skeleton
              width={80}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={140}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Skeleton
              width={60}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={100}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
        </View>

        <View style={[styles.boxDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Skeleton
              width={70}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={110}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Skeleton
              width={65}
              height={10}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
            <Skeleton
              width={85}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.microMargin}
            />
          </View>
        </View>
      </View>
    </Card>
  );
};

export interface OperationLogListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const OperationLogListSkeleton: React.FC<OperationLogListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <OperationLogCardSkeleton key={`op-log-skel-${idx}`} animate={animate} />
      ))}
    </View>
  );
};

export interface AssignmentCardSkeletonProps {
  animate?: boolean;
}

export const AssignmentCardSkeleton: React.FC<AssignmentCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <Card
      variant="elevated"
      style={[
        styles.machCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <View style={styles.machCardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.machCardTitleRow}>
            <Skeleton
              width={80}
              height={16}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={65}
              height={14}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <Skeleton
            width={110}
            height={12}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={{ marginTop: 4, marginBottom: 6 }}
          />
          <View style={styles.machMetaRow}>
            <Skeleton
              width={85}
              height={12}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={85}
              height={12}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
        </View>

        {/* Right side capacity badge & quick action */}
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Skeleton
            width={105}
            height={22}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={100}
            height={26}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>
    </Card>
  );
};

export interface AssignmentListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const AssignmentListSkeleton: React.FC<AssignmentListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <AssignmentCardSkeleton key={`assignment-skel-${idx}`} animate={animate} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
    gap: spacingNumeric.sm,
  },
  logCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    marginBottom: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logCardHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logDetailsBox: {
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  boxDivider: {
    height: 1,
    marginVertical: 2,
  },
  machCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
  },
  machCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  machCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  machMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noMargin: {
    marginVertical: 0,
  },
  microMargin: {
    marginVertical: 1,
  },
});
