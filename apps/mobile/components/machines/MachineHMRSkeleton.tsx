import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MachineHMRSkeletonProps {
  count?: number;
  animate?: boolean;
}

/**
 * Skeleton shell for Machine Details HMR Tab matching Screenshot 5:
 * 1. Header with "Hours Meter Logs" title + "+49 hrs Run" badge + refresh squircle button
 * 2. Search pill and Filter button
 * 3. HMR log cards with date, operator pill, hour meter reading well, and worked/breakdown row
 */
export const MachineHMRSkeleton: React.FC<MachineHMRSkeletonProps> = ({
  count = 3,
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Header with Hours Meter Logs + "+X hrs Run" badge + refresh button */}
      <View style={[styles.headerRow, { borderBottomColor: theme.colors.hairline }]}>
        <View style={styles.headerLeft}>
          <Skeleton
            width={130}
            height={18}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={78}
            height={22}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        <Skeleton
          width={32}
          height={32}
          borderRadius={8}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* 2. Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton
            width={14}
            height={14}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width="60%"
            height={13}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        <View
          style={[
            styles.filterBtn,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton
            width={14}
            height={14}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={36}
            height={13}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>

      {/* 3. Log Cards List */}
      <View style={styles.logsList}>
        {Array.from({ length: count }).map((_, idx) => (
          <View
            key={`hmr-card-skel-${idx}`}
            style={[
              styles.logCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Top Row: Date & Operator Pill */}
            <View style={styles.logCardTopRow}>
              <Skeleton
                width={80}
                height={14}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <Skeleton
                width={76}
                height={20}
                borderRadius={9999}
                animate={animate}
                style={styles.noMargin}
              />
            </View>

            {/* Meter Readings Well */}
            <View
              style={[
                styles.meterWell,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View>
                <Skeleton
                  width={110}
                  height={10}
                  borderRadius={radiusNumeric.xs}
                  animate={animate}
                  style={styles.noMargin}
                />
                <Skeleton
                  width={80}
                  height={14}
                  borderRadius={radiusNumeric.xs}
                  animate={animate}
                  style={{ marginTop: 4, marginBottom: 0 }}
                />
              </View>

              <Skeleton
                width={52}
                height={20}
                borderRadius={9999}
                animate={animate}
                style={styles.noMargin}
              />
            </View>

            {/* Worked & Breakdown Row */}
            <View style={[styles.workedRow, { borderTopColor: theme.colors.hairline, borderBottomColor: theme.colors.hairline }]}>
              <Skeleton
                width={130}
                height={12}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <Skeleton
                width={65}
                height={12}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchPill: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  filterBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  logCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterWell: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  noMargin: {
    marginVertical: 0,
  },
});
