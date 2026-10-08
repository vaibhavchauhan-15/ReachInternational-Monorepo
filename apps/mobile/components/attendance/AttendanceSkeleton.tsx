import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface AttendanceCardSkeletonProps {
  animate?: boolean;
}

export const AttendanceCardSkeleton: React.FC<AttendanceCardSkeletonProps> = ({
  animate = true,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.employeeCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      {/* Header Row: Initials Avatar, Name + Role badge, Meta Row (Phone & City) */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.empAvatar,
              {
                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Skeleton
              width={20}
              height={14}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <View style={styles.nameMetaCol}>
            <View style={styles.nameRow}>
              <Skeleton
                width={130}
                height={16}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <View style={[styles.roleBadge, { borderColor: theme.colors.hairline }]}>
                <Skeleton
                  width={56}
                  height={11}
                  borderRadius={radiusNumeric.xs}
                  animate={animate}
                  style={styles.noMargin}
                />
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Skeleton width={11} height={11} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
                <Skeleton width={78} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              </View>
              <View style={styles.metaItem}>
                <Skeleton width={11} height={11} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
                <Skeleton width={62} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 4-Stat Box: Scheduled, Present, Absent, Half-Day */}
      <View
        style={[
          styles.statsRow,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          },
        ]}
      >
        <View style={styles.statCol}>
          <Skeleton width={26} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={52} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.statCol}>
          <Skeleton width={26} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={44} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.statCol}>
          <Skeleton width={26} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={42} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
        <View style={styles.statCol}>
          <Skeleton width={26} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={46} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4, marginBottom: 0 }} />
        </View>
      </View>

      {/* Hours & Action Footer */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <View style={styles.hoursItem}>
          <Skeleton width={13} height={13} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
          <Skeleton width={88} height={13} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={54} height={13} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
        </View>

        <View style={styles.viewDetailBtn}>
          <Skeleton width={64} height={12} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={12} height={12} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
        </View>
      </View>
    </View>
  );
};

export const AttendanceKpiStripSkeleton: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.kpiRow}
    >
      {[
        { labelWidth: 80, valWidth: 32 },
        { labelWidth: 50, valWidth: 28 },
        { labelWidth: 48, valWidth: 24 },
        { labelWidth: 58, valWidth: 26 },
      ].map((kpi, idx) => (
        <View
          key={`kpi-att-skel-${idx}`}
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.kpiHeaderRow}>
            <Skeleton
              width={kpi.labelWidth}
              height={12}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={16}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <Skeleton
            width={kpi.valWidth}
            height={24}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={{ marginTop: 8, marginBottom: 0 }}
          />
        </View>
      ))}
    </ScrollView>
  );
};

export const AttendanceSearchSkeleton: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.searchBox,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
      ]}
    >
      <Skeleton width={16} height={16} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
      <Skeleton width="55%" height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
    </View>
  );
};

export const AttendanceFilterStripSkeleton: React.FC<{ animate?: boolean }> = ({ animate = true }) => {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterStrip}
    >
      {[58, 82, 78, 86, 96, 80].map((width, idx) => (
        <View
          key={`filter-chip-skel-${idx}`}
          style={[
            styles.filterChip,
            {
              width,
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Skeleton
            width={width - 24}
            height={12}
            borderRadius={radiusNumeric.xs}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      ))}
    </ScrollView>
  );
};

export interface AttendanceListSkeletonProps {
  count?: number;
  showKpi?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  animate?: boolean;
}

export const AttendanceListSkeleton: React.FC<AttendanceListSkeletonProps> = ({
  count = 4,
  showKpi = true,
  showSearch = true,
  showFilters = true,
  animate = true,
}) => {
  return (
    <View style={styles.container}>
      {/* 1. Horizontal KPI Strip Skeleton */}
      {showKpi && <AttendanceKpiStripSkeleton animate={animate} />}

      {/* 2. Search Box Skeleton */}
      {showSearch && <AttendanceSearchSkeleton animate={animate} />}

      {/* 3. Status Filter Strip Skeleton */}
      {showFilters && <AttendanceFilterStripSkeleton animate={animate} />}

      {/* 4. Operator Cards List Skeleton */}
      <View style={styles.cardList}>
        {Array.from({ length: count }).map((_, idx) => (
          <AttendanceCardSkeleton key={`att-card-${idx}`} animate={animate} />
        ))}
      </View>
    </View>
  );
};

export interface AttendanceDetailSkeletonProps {
  animate?: boolean;
  showMetaCard?: boolean;
}

export const AttendanceDetailSkeleton: React.FC<AttendanceDetailSkeletonProps> = ({
  animate = true,
  showMetaCard = true,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.detailContainer}>
      {/* 1. Employee Meta Card (EMPLOYEE ID, PHONE, SITE LOCATION, SHIFT) */}
      {showMetaCard && (
        <View
          style={[
            styles.modalEmpCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.modalEmpRow}>
            <View style={styles.modalEmpCol}>
              <Skeleton width={70} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.modalEmpCol}>
              <Skeleton width={45} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={95} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
            </View>
          </View>

          <View style={[styles.modalEmpRow, { marginTop: 10 }]}>
            <View style={styles.modalEmpCol}>
              <Skeleton width={80} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={130} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.modalEmpCol}>
              <Skeleton width={40} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={120} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>
      )}

      {/* 2. 4-Stat Summary Cards: Present, Absent, Half Days, Week Offs */}
      <View style={styles.detailSummaryRow}>
        {['Present', 'Absent', 'Half Days', 'Week Offs'].map((lbl, idx) => (
          <View
            key={`detail-stat-${idx}`}
            style={[
              styles.detailStatCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Skeleton width={24} height={20} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={46} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* 3. Total Hours Card */}
      <View
        style={[
          styles.hoursSummaryCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.hoursCol}>
          <Skeleton width={70} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={55} height={20} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.hoursCol}>
          <Skeleton width={78} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
          <Skeleton width={48} height={20} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* 4. Section Heading */}
      <View style={{ marginBottom: 12 }}>
        <Skeleton width={180} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
      </View>

      {/* 5. Daily Attendance Record Cards (3 cards) */}
      {Array.from({ length: 3 }).map((_, idx) => (
        <View
          key={`day-card-skel-${idx}`}
          style={[
            styles.dayCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Day Card Header */}
          <View style={styles.dayCardHeader}>
            <View style={styles.dayCardDateGroup}>
              <View
                style={[
                  styles.dayNumberPill,
                  {
                    backgroundColor: isDark ? '#262626' : '#f4f4f5',
                  },
                ]}
              >
                <Skeleton width={18} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              </View>
              <View style={{ marginLeft: 10, gap: 4 }}>
                <Skeleton width={68} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                <Skeleton width={52} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              </View>
            </View>

            <Skeleton width={72} height={22} borderRadius={radiusNumeric.full} animate={animate} style={styles.noMargin} />
          </View>

          {/* Day Card Content / Punches Well */}
          <View
            style={[
              styles.dayHoursWell,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={{ gap: 4 }}>
              <Skeleton width={60} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={90} height={13} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Skeleton width={50} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
              <Skeleton width={44} height={13} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: spacingNumeric.md,
  },
  kpiCard: {
    width: 140,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: spacingNumeric.sm,
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: spacingNumeric.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardList: {
    gap: 12,
  },
  employeeCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 14,
    gap: spacingNumeric.sm,
  },
  cardHeader: {
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  empAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameMetaCol: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    marginBottom: 4,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  hoursItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  detailContainer: {
    width: '100%',
  },
  modalEmpCard: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalEmpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalEmpCol: {
    flex: 1,
  },
  detailSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  detailStatCard: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  hoursSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 14,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  hoursCol: {
    alignItems: 'center',
  },
  dayCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
    gap: 8,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayCardDateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayNumberPill: {
    width: 38,
    height: 38,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHoursWell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  noMargin: {
    marginVertical: 0,
  },
});
