import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';

export const DashboardSkeleton: React.FC<{ kpiCount?: number }> = ({
  kpiCount = 6,
}) => {
  return (
    <View style={styles.container}>
      {/* Greeting Title */}
      <View style={styles.header}>
        <Skeleton width={220} height={26} borderRadius={radiusNumeric.sm} />
      </View>

      {/* Alert Banner */}
      <Skeleton
        width="100%"
        height={64}
        borderRadius={radiusNumeric.md || 12}
        style={{ marginBottom: spacingNumeric.md }}
      />

      {/* Eyebrow Label */}
      <Skeleton
        width={160}
        height={13}
        borderRadius={radiusNumeric.sm}
        style={{ marginBottom: spacingNumeric.xs }}
      />

      {/* KPI 2-Col Grid */}
      <View style={styles.kpiGrid}>
        {Array.from({ length: kpiCount }).map((_, idx) => (
          <View key={idx} style={styles.kpiCardWrapper}>
            <Skeleton
              width="100%"
              height={96}
              borderRadius={radiusNumeric.md || 14}
            />
          </View>
        ))}
      </View>

      {/* Eyebrow Label */}
      <Skeleton
        width={180}
        height={13}
        borderRadius={radiusNumeric.sm}
        style={{ marginTop: spacingNumeric.sm, marginBottom: spacingNumeric.xs }}
      />

      {/* Action Cards */}
      <View style={styles.actions}>
        <Skeleton width="100%" height={68} borderRadius={radiusNumeric.md || 14} />
        <Skeleton width="100%" height={68} borderRadius={radiusNumeric.md || 14} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.xs,
  },
  header: {
    marginBottom: spacingNumeric.md,
    marginTop: spacingNumeric.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.sm,
  },
  kpiCardWrapper: {
    flex: 1,
    minWidth: '47%',
  },
  actions: {
    gap: spacingNumeric.xs + 2,
    marginTop: spacingNumeric.xs,
  },
});
