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
      {/* Top Header Row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          {/* Client Code */}
          <Skeleton
            width={64}
            height={13}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
          {/* Company Name */}
          <Skeleton
            width={160}
            height={17}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={{ marginTop: 4, marginBottom: 0 }}
          />
          {/* Tax Badges */}
          <View style={styles.tagRow}>
            <Skeleton
              width={105}
              height={16}
              borderRadius={4}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={90}
              height={16}
              borderRadius={4}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
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

      {/* Card Details */}
      <View style={[styles.cardDetails, { borderTopColor: theme.colors.hairline }]}>
        <Skeleton
          width={130}
          height={13}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.microMargin}
        />
        <Skeleton
          width={110}
          height={13}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.microMargin}
        />
        <Skeleton
          width="70%"
          height={13}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.microMargin}
        />
      </View>

      {/* Card Actions */}
      <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
        <Skeleton
          width={60}
          height={32}
          borderRadius={6}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={84}
          height={32}
          borderRadius={6}
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
    gap: spacingNumeric.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  cardDetails: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
