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
      {/* Top Header: Avatar + Name/Email + Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarRow}>
          {/* Avatar Circle */}
          <Skeleton
            width={36}
            height={36}
            borderRadius={18}
            animate={animate}
            style={styles.noMargin}
          />
          {/* User Name & Email Stack */}
          <View style={styles.nameEmailStack}>
            <Skeleton
              width={125}
              height={15}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={160}
              height={12}
              borderRadius={radiusNumeric.sm}
              animate={animate}
              style={{ marginTop: 4, marginBottom: 0 }}
            />
          </View>
        </View>

        {/* Status Badge Placeholder */}
        <Skeleton
          width={64}
          height={22}
          borderRadius={radiusNumeric.sm}
          animate={animate}
          style={styles.noMargin}
        />
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
  nameEmailStack: {
    flex: 1,
  },
  metaBox: {
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noMargin: {
    marginVertical: 0,
  },
});
