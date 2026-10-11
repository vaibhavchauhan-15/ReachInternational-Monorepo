import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Skeleton, useTheme } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MachineDetailSkeletonProps {
  animate?: boolean;
}

/**
 * Full page skeleton shell matching Machine Details page:
 * 1. Hero Machine Banner (avatar squircle, model/serial title, machine ID, status badges)
 * 2. Segmented Toggle Capsule ([ Basic Info ]  [ HMR ])
 * 3. Basic Info Card (2x4 grid of spec cards)
 * 4. Assigned Shift Personnel Card (Supervisors and Operators shift cards with call/mail placeholders)
 * 5. Client Details Card (Client Name, Contact Person, Contact Mobile, City & State, Site Location + Call & WhatsApp buttons)
 */
export const MachineDetailSkeleton: React.FC<MachineDetailSkeletonProps> = ({
  animate = true,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Hero Machine Banner */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          {/* Avatar squircle */}
          <Skeleton
            width={44}
            height={44}
            borderRadius={14}
            animate={animate}
            style={styles.noMargin}
          />

          <View style={styles.heroTitleWrap}>
            {/* Title: Model - Serial No */}
            <Skeleton
              width="80%"
              height={18}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            {/* Subtitle: Machine ID • Manufacturer */}
            <Skeleton
              width={140}
              height={12}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={{ marginTop: 6, marginBottom: 0 }}
            />
          </View>

          {/* Right Action Button Placeholder */}
          <Skeleton
            width={64}
            height={32}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Status Badges Row */}
        <View style={[styles.heroBadgesRow, { borderTopColor: theme.colors.hairline }]}>
          <Skeleton
            width={72}
            height={22}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
          <Skeleton
            width={76}
            height={22}
            borderRadius={9999}
            animate={animate}
            style={styles.noMargin}
          />
        </View>
      </View>

      {/* 2. Segmented Capsule Toggle ([ Basic Info ]  [ HMR ]) */}
      <View
        style={[
          styles.toggleShell,
          {
            backgroundColor: theme.colors.hairlineSoft,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Skeleton
          width="48%"
          height={32}
          borderRadius={9999}
          animate={animate}
          style={styles.noMargin}
        />
        <Skeleton
          width="48%"
          height={32}
          borderRadius={9999}
          animate={animate}
          style={styles.noMargin}
        />
      </View>

      {/* 3. Section 1: Basic Info (Screenshot 3) */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton
              width={16}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={90}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <Skeleton
            width={52}
            height={28}
            borderRadius={radiusNumeric.sm}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* 2x4 Specs Grid */}
        <View style={styles.specsGrid}>
          {Array.from({ length: 8 }).map((_, idx) => (
            <View
              key={`spec-skel-${idx}`}
              style={[
                styles.specBox,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                  width: '48.5%',
                },
              ]}
            >
              <Skeleton
                width={70}
                height={10}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
              <Skeleton
                width={idx === 5 ? 75 : 95}
                height={15}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={{ marginTop: 6, marginBottom: 0 }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* 4. Section 2: Assigned Shift Personnel (Screenshot 3) */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton
              width={16}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={170}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <Skeleton
            width={32}
            height={32}
            borderRadius={8}
            animate={animate}
            style={styles.noMargin}
          />
        </View>

        {/* Personnel Panels: Supervisors & Operators */}
        <View style={styles.personnelPanels}>
          {/* Supervisors Card */}
          <View
            style={[
              styles.personnelCard,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.personnelCardHeader}>
              <Skeleton
                width={110}
                height={13}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
            </View>
            <View
              style={[
                styles.personnelItem,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Skeleton width={80} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                  <Skeleton width={48} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                </View>
                <Skeleton width={90} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={32} height={32} borderRadius={8} animate={animate} style={styles.noMargin} />
                <Skeleton width={32} height={32} borderRadius={8} animate={animate} style={styles.noMargin} />
              </View>
            </View>
          </View>

          {/* Operators Card */}
          <View
            style={[
              styles.personnelCard,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.personnelCardHeader}>
              <Skeleton
                width={95}
                height={13}
                borderRadius={radiusNumeric.xs}
                animate={animate}
                style={styles.noMargin}
              />
            </View>
            <View
              style={[
                styles.personnelItem,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Skeleton width={80} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                  <Skeleton width={68} height={18} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
                </View>
                <Skeleton width={90} height={11} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={32} height={32} borderRadius={8} animate={animate} style={styles.noMargin} />
                <Skeleton width={32} height={32} borderRadius={8} animate={animate} style={styles.noMargin} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 5. Section 3: Client Details (Screenshot 4) */}
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={[styles.sectionHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <Skeleton
              width={16}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
            <Skeleton
              width={100}
              height={16}
              borderRadius={radiusNumeric.xs}
              animate={animate}
              style={styles.noMargin}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Skeleton width={30} height={30} borderRadius={8} animate={animate} style={styles.noMargin} />
            <Skeleton width={30} height={30} borderRadius={8} animate={animate} style={styles.noMargin} />
          </View>
        </View>

        <View style={styles.stackedCards}>
          {/* CLIENT NAME */}
          <View style={[styles.stackedBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Skeleton width={85} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={160} height={16} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
          </View>

          {/* CONTACT PERSON */}
          <View style={[styles.stackedBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Skeleton width={95} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={110} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
          </View>

          {/* CONTACT MOBILE */}
          <View style={[styles.stackedBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Skeleton width={95} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={130} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
          </View>

          {/* CITY & STATE */}
          <View style={[styles.stackedBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Skeleton width={80} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width={120} height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
          </View>

          {/* SITE LOCATION */}
          <View style={[styles.stackedBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <Skeleton width={85} height={10} borderRadius={radiusNumeric.xs} animate={animate} style={styles.noMargin} />
            <Skeleton width="92%" height={14} borderRadius={radiusNumeric.xs} animate={animate} style={{ marginTop: 6, marginBottom: 0 }} />
          </View>

          {/* Call & WhatsApp CTAs */}
          <View style={styles.ctaRow}>
            <Skeleton width="48%" height={44} borderRadius={14} animate={animate} style={styles.noMargin} />
            <Skeleton width="48%" height={44} borderRadius={14} animate={animate} style={styles.noMargin} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
    paddingBottom: 24,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  toggleShell: {
    height: 44,
    borderRadius: 9999,
    borderWidth: 1,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    minHeight: 52,
    justifyContent: 'center',
  },
  personnelPanels: {
    gap: 10,
  },
  personnelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  personnelCardHeader: {
    paddingBottom: 6,
  },
  personnelItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stackedCards: {
    gap: 8,
  },
  stackedBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  noMargin: {
    marginVertical: 0,
  },
});
