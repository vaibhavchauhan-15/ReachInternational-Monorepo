import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

/**
 * High-fidelity, theme-aware Skeleton loaders for UserDetailView tabs.
 * Eradicates raw ActivityIndicator spinners in favor of native 60fps pulsating skeleton cards.
 */

export const UserMachinesSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.cardsList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={`machine-skel-${idx}`}
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Header row: Machine ID + Status Badge + Inspect button */}
          <View style={styles.rowBetween}>
            <View style={styles.rowGap8}>
              <Skeleton width={88} height={20} borderRadius={radiusNumeric.sm} />
              <Skeleton width={68} height={20} borderRadius={radiusNumeric.sm} />
            </View>
            <Skeleton width={64} height={24} borderRadius={radiusNumeric.pill} />
          </View>

          {/* Machine Name & Model */}
          <View style={styles.colGap4}>
            <Skeleton width="60%" height={16} borderRadius={radiusNumeric.sm} />
            <Skeleton width="35%" height={12} borderRadius={radiusNumeric.sm} />
          </View>

          {/* Specs Well */}
          <View
            style={[
              styles.wellContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.specsRow}>
              <Skeleton width="28%" height={14} borderRadius={radiusNumeric.sm} />
              <Skeleton width="28%" height={14} borderRadius={radiusNumeric.sm} />
              <Skeleton width="32%" height={14} borderRadius={radiusNumeric.sm} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export const UserLogsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.cardsList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={`log-skel-${idx}`}
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Header row: Date + Running Hours Badge */}
          <View style={styles.rowBetween}>
            <Skeleton width={110} height={16} borderRadius={radiusNumeric.sm} />
            <Skeleton width={80} height={22} borderRadius={radiusNumeric.pill} />
          </View>

          {/* Machine details */}
          <View style={styles.rowGap8}>
            <Skeleton width={72} height={14} borderRadius={radiusNumeric.sm} />
            <Skeleton width="45%" height={14} borderRadius={radiusNumeric.sm} />
          </View>

          {/* Meter & Timing Specs Well */}
          <View
            style={[
              styles.wellContainer,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.specsRow}>
              <Skeleton width="30%" height={14} borderRadius={radiusNumeric.sm} />
              <Skeleton width="30%" height={14} borderRadius={radiusNumeric.sm} />
              <Skeleton width="30%" height={14} borderRadius={radiusNumeric.sm} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export const UserAssignmentsSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.cardsList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={`assign-skel-${idx}`}
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Header row: Machine code + Status badge */}
          <View style={styles.rowBetween}>
            <Skeleton width={84} height={18} borderRadius={radiusNumeric.sm} />
            <Skeleton width={64} height={20} borderRadius={radiusNumeric.pill} />
          </View>

          {/* Machine Title */}
          <Skeleton width="55%" height={15} borderRadius={radiusNumeric.sm} />

          {/* Assignment times & shift code */}
          <View style={styles.rowBetween}>
            <Skeleton width={120} height={12} borderRadius={radiusNumeric.sm} />
            <Skeleton width={90} height={12} borderRadius={radiusNumeric.sm} />
          </View>
        </View>
      ))}
    </View>
  );
};

export const UserAttendanceSkeleton: React.FC = () => {
  const { theme } = useTheme();

  return (
    <View style={styles.attendanceCardsRow}>
      {/* 3 attendance KPI summary cards */}
      {Array.from({ length: 3 }).map((_, idx) => (
        <View
          key={`att-card-${idx}`}
          style={[
            styles.attendanceStatCard,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton width={110} height={14} borderRadius={radiusNumeric.sm} />
          <Skeleton width={80} height={24} borderRadius={radiusNumeric.sm} style={{ marginVertical: 6 }} />
          <Skeleton width={140} height={11} borderRadius={radiusNumeric.sm} />
        </View>
      ))}
    </View>
  );
};

export const UserDocumentsSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.cardsList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={`doc-skel-${idx}`}
          style={[
            styles.docListItem,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.docLeftRow}>
            <Skeleton width={38} height={38} borderRadius={radiusNumeric.md} />
            <View style={styles.colGap4}>
              <Skeleton width={140} height={16} borderRadius={radiusNumeric.sm} />
              <Skeleton width={96} height={11} borderRadius={radiusNumeric.sm} />
            </View>
          </View>

          <Skeleton width={110} height={36} borderRadius={radiusNumeric.pill} />
        </View>
      ))}
    </View>
  );
};

export const UserAuditSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.cardsList}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={`audit-skel-${idx}`}
          style={[
            styles.cardContainer,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <Skeleton width={130} height={16} borderRadius={radiusNumeric.sm} />
            <Skeleton width={70} height={12} borderRadius={radiusNumeric.sm} />
          </View>
          <Skeleton width={160} height={12} borderRadius={radiusNumeric.sm} />
          <Skeleton width="100%" height={44} borderRadius={radiusNumeric.sm} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  cardsList: {
    gap: 10,
  },
  cardContainer: {
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowGap8: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colGap4: {
    gap: 4,
  },
  wellContainer: {
    padding: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendanceCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attendanceStatCard: {
    flex: 1,
    minWidth: 220,
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  docListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 12,
  },
  docLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
