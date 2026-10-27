import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface UserCardSkeletonProps {
  animate?: boolean;
}

export const UserCardSkeleton: React.FC<UserCardSkeletonProps> = ({
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
      {/* Top Header: Avatar + Name + Badges */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarRow}>
          {/* Avatar Circle */}
          <Skeleton
            width={32}
            height={32}
            borderRadius={16}
            animate={animate}
            style={styles.noMargin}
          />
          {/* User Name */}
          <Skeleton
            width={140}
            height={16}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Compact Badges Row Placeholder (Role + Status) */}
        <View style={styles.badgeRow}>
          <Skeleton
            width={72}
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

      {/* Metadata Well Box */}
      <View
        style={[
          styles.metaBox,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Role Pill & Phone Chip Row */}
        <View style={styles.metaRow}>
          <Skeleton
            width={84}
            height={20}
            borderRadius={radiusNumeric.full}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={100}
            height={18}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Location Row Placeholder */}
        <Skeleton
          width="60%"
          height={13}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={{ marginVertical: 1 }}
        />

        {/* Supervisor Row Placeholder */}
        <Skeleton
          width="75%"
          height={13}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={{ marginVertical: 1 }}
        />
      </View>

      {/* Bottom Action Buttons: More, Assign Machine, Supervisor */}
      <View style={[styles.cardActionsContainer, { borderTopColor: theme.colors.hairline }]}>
        <Skeleton
          width={64}
          height={36}
          borderRadius={radiusNumeric.pill}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={120}
          height={36}
          borderRadius={radiusNumeric.pill}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width={96}
          height={36}
          borderRadius={radiusNumeric.pill}
          animate={animate}
          style={styles.noMargin}
        />
      </View>
    </View>
  );
};

export interface UserListSkeletonProps {
  count?: number;
  animate?: boolean;
}

export const UserListSkeleton: React.FC<UserListSkeletonProps> = ({
  count = 4,
  animate = true,
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <UserCardSkeleton key={`user-skel-${idx}`} animate={animate} />
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
    borderLeftWidth: 4,
    padding: spacingNumeric.md,
    gap: 8,
    marginBottom: spacingNumeric.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameEmailStack: {
    flex: 1,
  },
  metaBox: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    marginTop: 4,
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  noMargin: {
    marginVertical: 0,
  },
});
