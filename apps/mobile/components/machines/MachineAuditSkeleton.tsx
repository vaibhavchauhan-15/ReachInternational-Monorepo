import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MachineAuditSkeletonProps {
  count?: number;
  animate?: boolean;
}

/**
 * Skeleton shell for Machine Details Audit Trail Tab:
 * 1. Filter Category Pills strip skeleton
 * 2. Audit Trail event cards skeleton
 */
export const MachineAuditSkeleton: React.FC<MachineAuditSkeletonProps> = ({
  count = 3,
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Category Pills Strip */}
      <View style={styles.categoryRow}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton
            key={`audit-cat-${idx}`}
            width={idx === 0 ? 50 : 80}
            height={28}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
        ))}
      </View>

      {/* Audit Event Cards */}
      <View style={styles.eventsList}>
        {Array.from({ length: count }).map((_, idx) => (
          <View
            key={`audit-card-skel-${idx}`}
            style={[
              styles.auditCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Header: User & Action */}
            <View style={styles.auditCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Skeleton width={28} height={28} borderRadius={9999} animate={animate} style={styles.noMargin} />
                <View>
                  <Skeleton width={90} height={13} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                  <Skeleton width={130} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
                </View>
              </View>
              <Skeleton width={60} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            </View>

            {/* Inset Change Box */}
            <View
              style={[
                styles.changeBox,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Skeleton width={80} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width="90%" height={12} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
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
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  eventsList: {
    gap: 10,
  },
  auditCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  auditCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  noMargin: {
    marginVertical: 0,
  },
});
