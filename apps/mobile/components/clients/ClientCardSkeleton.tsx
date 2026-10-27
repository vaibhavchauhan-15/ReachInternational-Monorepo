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
      {/* 1. Header: Client Name, ID and Status on the same compact header area */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Skeleton
            width={160}
            height={18}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={65}
            height={13}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Status Pill Skeleton */}
        <Skeleton
          width={68}
          height={24}
          borderRadius={radiusNumeric.full}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* 2. Inset Specs Well: 2-Column Grid (3 rows, 12dp padding, 12dp gap) */}
      <View
        style={[
          styles.specsWell,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Row 1: GST | PAN */}
        <View style={styles.twoColGrid}>
          <View style={styles.gridCol}>
            <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
          <View style={styles.gridCol}>
            <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={95} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
        </View>

        {/* Row 2: Contact Person | Contact Number */}
        <View style={styles.twoColGrid}>
          <View style={styles.gridCol}>
            <Skeleton width={90} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={115} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
          <View style={styles.gridCol}>
            <Skeleton width={95} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={105} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
        </View>

        {/* Row 3: Sites | Maintenance Allowance */}
        <View style={styles.twoColGrid}>
          <View style={styles.gridCol}>
            <Skeleton width={70} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={120} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
          <View style={styles.gridCol}>
            <Skeleton width={120} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={45} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.fieldIndent} />
          </View>
        </View>
      </View>

      {/* 3. Touch Action Buttons: Assign Supervisor, Assign Machine, 3-Dot Menu */}
      <View style={styles.cardActions}>
        <Skeleton
          width="43%"
          height={44}
          borderRadius={radiusNumeric.md}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width="43%"
          height={44}
          borderRadius={radiusNumeric.md}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={44}
          height={44}
          borderRadius={radiusNumeric.md}
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
    padding: 14,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  specsWell: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  twoColGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCol: {
    flex: 1,
    gap: 4,
  },
  fieldIndent: {
    marginLeft: 18,
    marginVertical: 0,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  noMargin: {
    marginVertical: 0,
  },
});
