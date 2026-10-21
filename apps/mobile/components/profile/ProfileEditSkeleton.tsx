import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface ProfileEditSkeletonProps {
  animate?: boolean;
}

export const ProfileEditSkeleton: React.FC<ProfileEditSkeletonProps> = ({
  animate = true,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Section 1: Personal Information */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDark ? '#141414' : '#ffffff',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Section Header */}
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton width={24} height={24} borderRadius={radiusNumeric.full} animate={animate} />
            <Skeleton width={140} height={16} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.fieldsContainer}>
          <View style={styles.fieldItem}>
            <Skeleton width={70} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
          <View style={styles.fieldItem}>
            <Skeleton width={90} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
          <View style={styles.fieldItem}>
            <Skeleton width={80} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
        </View>
      </View>

      {/* Section 2: Banking Details */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDark ? '#141414' : '#ffffff',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton width={24} height={24} borderRadius={radiusNumeric.full} animate={animate} />
            <Skeleton width={120} height={16} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>

        <View style={styles.fieldsContainer}>
          <View style={styles.fieldItem}>
            <Skeleton width={130} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
          <View style={styles.fieldItem}>
            <Skeleton width={90} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
        </View>
      </View>

      {/* Section 3: Statutory Identity */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDark ? '#141414' : '#ffffff',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton width={24} height={24} borderRadius={radiusNumeric.full} animate={animate} />
            <Skeleton width={160} height={16} borderRadius={radiusNumeric.xs} animate={animate} />
          </View>
        </View>

        <View style={styles.fieldsContainer}>
          <View style={styles.fieldItem}>
            <Skeleton width={110} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
          <View style={styles.fieldItem}>
            <Skeleton width={130} height={12} borderRadius={radiusNumeric.xs} animate={animate} />
            <Skeleton width="100%" height={44} borderRadius={radiusNumeric.md} animate={animate} />
          </View>
        </View>
      </View>

      {/* Footer Buttons */}
      <View style={styles.footerRow}>
        <Skeleton width="48%" height={48} borderRadius={radiusNumeric.md} animate={animate} />
        <Skeleton width="48%" height={48} borderRadius={radiusNumeric.md} animate={animate} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldsContainer: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  fieldItem: {
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacingNumeric.xs,
  },
});
