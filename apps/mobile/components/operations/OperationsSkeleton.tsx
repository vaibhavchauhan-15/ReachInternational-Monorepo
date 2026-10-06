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

export interface ShiftRosterCardSkeletonProps {
  animate?: boolean;
}

export const ShiftRosterCardSkeleton: React.FC<ShiftRosterCardSkeletonProps> = ({
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
      <View style={styles.logCardHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Skeleton width={78} height={20} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={110} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          </View>
          <Skeleton width={130} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
        </View>
        <Skeleton width={68} height={22} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
      </View>

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
          <View style={{ flex: 1, gap: 2 }}>
            <Skeleton width={65} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
            <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={90} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          </View>
        </View>
      </View>
    </Card>
  );
};

export interface ShiftRosterListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const ShiftRosterListSkeleton: React.FC<ShiftRosterListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <ShiftRosterCardSkeleton key={`shift-roster-skel-${idx}`} animate={animate} />
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
  noMargin: {
    marginVertical: 0,
  },
  microMargin: {
    marginVertical: 1,
  },
  entryOuterCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.lg,
    marginBottom: spacingNumeric.md,
  },
  entryTitleBlock: {
    marginBottom: spacingNumeric.sm,
  },
  entryDivider: {
    height: 1,
    marginVertical: spacingNumeric.sm,
  },
  entrySectionBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  entryInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
});

export interface OperatorEntrySkeletonProps {
  animate?: boolean;
}

export const OperatorEntrySkeleton: React.FC<OperatorEntrySkeletonProps> = ({
  animate = true,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.entryOuterCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Title Block */}
      <View style={styles.entryTitleBlock}>
        <Skeleton width={180} height={20} borderRadius={radiusNumeric.xs} animate={animate} />
        <Skeleton width={230} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6 }} />
      </View>

      <View style={[styles.entryDivider, { backgroundColor: theme.colors.hairline }]} />

      {/* 1. ASSIGNED MACHINE & SITE SECTION */}
      <View
        style={[
          styles.entrySectionBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton width={150} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginBottom: 10 }} />

        {/* Machine Card */}
        <View
          style={[
            styles.entryInfoCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton width={36} height={36} borderRadius={radiusNumeric.full} animate={animate} />
          <View style={{ flex: 1, gap: 6, marginLeft: 10 }}>
            <Skeleton width="70%" height={16} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>

        {/* Site Card */}
        <View
          style={[
            styles.entryInfoCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              marginTop: 8,
            },
          ]}
        >
          <Skeleton width={36} height={36} borderRadius={radiusNumeric.full} animate={animate} />
          <View style={{ flex: 1, gap: 6, marginLeft: 10 }}>
            <Skeleton width="60%" height={16} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="85%" height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>
      </View>

      {/* 2. HMR SECTION */}
      <View
        style={[
          styles.entrySectionBox,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            borderColor: theme.colors.hairline,
            marginTop: 12,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Skeleton width={60} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width={90} height={20} borderRadius={radiusNumeric.full} animate={animate} />
        </View>

        {/* Start Meter Field */}
        <View style={{ gap: 6, marginBottom: 12 }}>
          <Skeleton width={120} height={14} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
        </View>

        {/* End Meter Field */}
        <View style={{ gap: 6 }}>
          <Skeleton width={120} height={14} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
        </View>
      </View>

      {/* 3. ACTIONS SKELETON */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Skeleton width="48%" height={44} borderRadius={radiusNumeric.full} animate={animate} />
        <Skeleton width="48%" height={44} borderRadius={radiusNumeric.full} animate={animate} />
      </View>
    </View>
  );
};

