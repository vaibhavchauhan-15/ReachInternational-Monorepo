import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme, Card } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface ClientCardSkeletonProps {
  animate?: boolean;
}

export const ClientCardSkeleton: React.FC<ClientCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <Card
      style={[
        styles.clientCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Top Header Row: Client ID Code on left, Status Badge on right */}
      <View style={styles.cardHeader}>
        <Skeleton
          width={72}
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
      </View>

      {/* Company Name */}
      <View style={styles.companyRow}>
        <Skeleton
          width={180}
          height={18}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* Tax Badges */}
      <View style={styles.tagRow}>
        <Skeleton
          width={105}
          height={18}
          borderRadius={4}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={90}
          height={18}
          borderRadius={4}
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
        <View style={styles.twoColGrid}>
          <View style={{ flex: 1 }}>
            <Skeleton width={85} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
            <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Skeleton width={80} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
            <Skeleton width={95} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
          </View>
        </View>

        <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={{ gap: 4 }}>
          <Skeleton width={75} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
          <Skeleton width="70%" height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
        </View>

        <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width={100} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.microMargin} />
          <Skeleton width={60} height={18} borderRadius={radiusNumeric.sm} animate={animate} style={styles.microMargin} />
        </View>
      </View>

      {/* Touch Action Buttons Row (Edit, Add Site, Delete) */}
      <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
        <Skeleton
          width={72}
          height={34}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={88}
          height={34}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={72}
          height={34}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.noMargin}
        />
      </View>
    </Card>
  );
};

export interface ClientListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const ClientListSkeleton: React.FC<ClientListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <ClientCardSkeleton key={`client-skel-${idx}`} animate={animate} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
    gap: spacingNumeric.sm,
  },
  clientCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  specsWell: {
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  twoColGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
  },
  specsDivider: {
    height: 1,
    marginVertical: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  noMargin: {
    marginVertical: 0,
  },
  microMargin: {
    marginVertical: 2,
  },
});
