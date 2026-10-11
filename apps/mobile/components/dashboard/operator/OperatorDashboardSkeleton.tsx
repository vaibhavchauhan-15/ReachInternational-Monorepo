import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { useTheme } from '../../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface OperatorDashboardSkeletonProps {
  animate?: boolean;
}

export const OperatorDashboardSkeleton: React.FC<OperatorDashboardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Greeting Header */}
      <View style={[styles.greetingHeader, { borderBottomColor: theme.colors.hairline }]}>
        <Skeleton width={230} height={26} borderRadius={radiusNumeric.sm} animate={animate} />
      </View>

      {/* 2. Alert Card Skeleton */}
      <View style={styles.section}>
        <Skeleton
          width={60}
          height={12}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.eyebrowMargin}
        />
        <View
          style={[
            styles.alertCardShell,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.alertContentRow}>
            <Skeleton width={32} height={32} borderRadius={8} animate={animate} />
            <View style={styles.alertTextStack}>
              <Skeleton width={140} height={15} borderRadius={radiusNumeric.xs} animate={animate} />
              <Skeleton width="90%" height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            </View>
          </View>
          <Skeleton width={16} height={16} borderRadius={4} animate={animate} />
        </View>
      </View>

      {/* 3. Today's Shift Status Section */}
      <View style={styles.section}>
        <Skeleton
          width={160}
          height={12}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.eyebrowMargin}
        />
        <View style={styles.oneColCol}>
          {/* Status Card 1: Log Submission Status */}
          <View
            style={[
              styles.cardShell,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Skeleton width={140} height={11} borderRadius={radiusNumeric.xs} animate={animate} />
            <View style={styles.cardMainRow}>
              <Skeleton width={32} height={32} borderRadius={16} animate={animate} />
              <Skeleton width={150} height={18} borderRadius={radiusNumeric.xs} animate={animate} />
            </View>
            <Skeleton width="85%" height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>

          {/* Status Card 2: Last Recorded Meter */}
          <View
            style={[
              styles.cardShell,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Skeleton width={160} height={11} borderRadius={radiusNumeric.xs} animate={animate} />
            <View style={styles.cardMainRow}>
              <Skeleton width={30} height={30} borderRadius={8} animate={animate} />
              <Skeleton width={120} height={20} borderRadius={radiusNumeric.xs} animate={animate} />
            </View>
            <Skeleton width="80%" height={12} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>
      </View>

      {/* 4. Shift Coverage Section */}
      <View style={styles.section}>
        <Skeleton
          width={150}
          height={12}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.eyebrowMargin}
        />
        <View
          style={[
            styles.shiftCardShell,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Top row: Shift A + Ready to Log pills */}
          <View style={styles.shiftCardTopRow}>
            <Skeleton width={64} height={22} borderRadius={4} animate={animate} />
            <Skeleton width={88} height={20} borderRadius={9999} animate={animate} />
          </View>

          {/* Timings row */}
          <View style={styles.shiftCardTimingsRow}>
            <Skeleton width={60} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width={150} height={15} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>

          {/* Bottom CTA Button */}
          <View style={[styles.shiftCardCtaRow, { borderTopColor: theme.colors.hairline }]}>
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.sm} animate={animate} />
          </View>
        </View>
      </View>

      {/* 5. Equipment & Worksite Assignment Section */}
      <View style={styles.section}>
        <Skeleton
          width={220}
          height={12}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.eyebrowMargin}
        />
        <View style={styles.oneColCol}>
          {/* Machine Card */}
          <View
            style={[
              styles.assignmentCardShell,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <Skeleton width={28} height={28} borderRadius={8} animate={animate} />
              <Skeleton width={130} height={14} borderRadius={radiusNumeric.xs} animate={animate} />
            </View>
            <View style={styles.assignmentDetailsStack}>
              <View style={styles.detailRow}>
                <Skeleton width={45} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={110} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
              <View style={styles.detailRow}>
                <Skeleton width={70} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={85} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
              <View style={styles.detailRow}>
                <Skeleton width={80} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={120} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
            </View>
          </View>

          {/* Client & Location Card */}
          <View
            style={[
              styles.assignmentCardShell,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.assignmentHeaderRow, { borderBottomColor: theme.colors.hairline }]}>
              <Skeleton width={28} height={28} borderRadius={8} animate={animate} />
              <Skeleton width={140} height={14} borderRadius={radiusNumeric.xs} animate={animate} />
            </View>
            <View style={styles.assignmentDetailsStack}>
              <View style={styles.detailRow}>
                <Skeleton width={45} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={140} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
              <View style={styles.detailRow}>
                <Skeleton width={40} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={180} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
              <View style={styles.detailRow}>
                <Skeleton width={45} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
                <Skeleton width={130} height={13} borderRadius={radiusNumeric.xs} animate={animate} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.lg,
  },
  greetingHeader: {
    paddingBottom: spacingNumeric.sm + 4,
    marginBottom: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  section: {
    gap: spacingNumeric.xs,
  },
  eyebrowMargin: {
    marginBottom: 2,
  },
  oneColCol: {
    flexDirection: 'column',
    gap: spacingNumeric.sm,
  },
  alertCardShell: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.sm + 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  alertContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  alertTextStack: {
    gap: 6,
    flex: 1,
  },
  cardShell: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    minHeight: 108,
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs + 2,
  },
  shiftCardShell: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    gap: spacingNumeric.sm,
  },
  shiftCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftCardTimingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  shiftCardCtaRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  assignmentCardShell: {
    borderRadius: radiusNumeric.md || 14,
    borderWidth: 1,
    padding: spacingNumeric.md - 2,
    gap: spacingNumeric.xs,
  },
  assignmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: spacingNumeric.xs + 2,
    borderBottomWidth: 1,
    marginBottom: spacingNumeric.xs,
  },
  assignmentDetailsStack: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
