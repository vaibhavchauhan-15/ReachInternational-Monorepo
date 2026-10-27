import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme, Card } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface ClientDetailSkeletonProps {
  animate?: boolean;
}

/**
 * Full page skeleton shell matching native Client Details page:
 * 1. Hero Client Card (Client code, status badge, allowance pill, company name)
 * 2. Key Metrics Row (4 KPI cards: Fleet, Sites, Operators, Logs)
 * 3. Horizontal Tab Capsule Strip
 * 4. Primary Contact Card
 * 5. Tax & Statutory Identifiers Card
 * 6. Operational & Billing Addresses Card
 * 7. Tab Items Content Placeholder
 */
export const ClientDetailSkeleton: React.FC<ClientDetailSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Hero Client Identity Card */}
      <Card
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          {/* Client Code Pill */}
          <Skeleton
            width={85}
            height={26}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
          {/* Status Badge */}
          <Skeleton
            width={65}
            height={22}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          {/* Maintenance Allowance Badge */}
          <Skeleton
            width={120}
            height={22}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Company Name */}
        <View style={{ marginTop: spacingNumeric.sm }}>
          <Skeleton
            width="75%"
            height={24}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </Card>

      {/* 2. Key Metrics KPI Row (4 cards in responsive grid) */}
      <View style={styles.kpiGrid}>
        {[1, 2, 3, 4].map((k) => (
          <View
            key={k}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton
                width={70}
                height={12}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <Skeleton
                width={24}
                height={24}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
            </View>
            <Skeleton
              width={45}
              height={26}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={{ marginTop: 8 }}
            />
          </View>
        ))}
      </View>

      {/* 3. Horizontal Tab Capsule Strip */}
      <View style={styles.tabStrip}>
        {[80, 70, 95, 90, 65, 65].map((w, idx) => (
          <Skeleton
            key={idx}
            width={w}
            height={36}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
        ))}
      </View>

      {/* 4. Primary Contact Card */}
      <Card
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton
          width={110}
          height={14}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.noMargin}
        />
        <View style={{ marginTop: 8, gap: 6 }}>
          <Skeleton
            width="60%"
            height={16}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width="45%"
            height={16}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </Card>

      {/* 5. Tax & Statutory Identifiers Card */}
      <Card
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton
          width={150}
          height={14}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.noMargin}
        />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={50} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="85%" height={16} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={40} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="75%" height={16} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>
      </Card>

      {/* 6. Operational & Billing Addresses Card */}
      <Card
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton
          width={180}
          height={14}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.noMargin}
        />
        <View style={{ marginTop: 8, gap: 4 }}>
          <Skeleton width="90%" height={14} borderRadius={radiusNumeric.xs} animate={animate} />
          <Skeleton width="70%" height={14} borderRadius={radiusNumeric.xs} animate={animate} />
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.md,
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.xl,
  },
  heroCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  tabStrip: {
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  sectionCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  noMargin: {
    marginTop: 0,
    marginBottom: 0,
  },
});
