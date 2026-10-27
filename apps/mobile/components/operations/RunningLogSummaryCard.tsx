import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions, Linking } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Text, Badge, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  UserCheck,
  Calendar,
} from '../ui/icon';

export interface RunningLogSummaryCardProps {
  viewMode: 'machine' | 'client' | 'operator';
  // Client props
  client?: {
    id: string;
    company_name: string;
    street?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    email?: string;
  } | null;
  clientMachinesCount?: number;
  // Machine props
  machine?: {
    id: string;
    machine_id?: string;
    model?: string;
    serial_number?: string;
    manufacturer?: string;
    status?: string;
  } | null;
  onOpenHistoryModal?: () => void;
  // Operator props
  operator?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
  } | null;
  // Shared metrics
  totalRunHours?: number;
  totalWorkingHours?: number;
  totalBreakdowns?: number;
  totalDays?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const RunningLogSummaryCard = React.memo<RunningLogSummaryCardProps>(function RunningLogSummaryCard({
  viewMode,
  client,
  clientMachinesCount = 0,
  machine,
  onOpenHistoryModal,
  operator,
  totalRunHours = 0,
  totalWorkingHours = 0,
  totalBreakdowns = 0,
  totalDays = 0,
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggle,
}) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTabletOrDesktop = width > 640;

  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const progress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: 240,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isExpanded, progress]);

  const chevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 180}deg` }],
    };
  });

  // Generous max height interpolation (600) prevents any clipping across all viewport sizes & font scales
  const collapsibleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      maxHeight: interpolate(progress.value, [0, 1], [0, 600]),
      overflow: 'hidden' as const,
    };
  });

  const handleToggle = useCallback(() => {
    if (controlledToggle) {
      controlledToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [controlledToggle]);

  const roundedRunHours = Math.round(totalRunHours * 10) / 10;
  const roundedWorkingHours = Math.round(totalWorkingHours * 10) / 10;

  // 1. CLIENT VIEW
  if (viewMode === 'client') {
    if (!client) return null;
    const address = [client.street, client.city, client.district, client.pincode]
      .filter(Boolean)
      .join(', ');

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleToggle}
          style={styles.headerPressable}
          accessibilityLabel={`Toggle ${client.company_name} summary details`}
        >
          <View style={styles.headerLeft}>
            <Text variant="subheading" weight="bold" style={[styles.title, { color: theme.colors.ink }]} numberOfLines={1}>
              {client.company_name}
            </Text>
            <Badge
              variant="info"
              size="sm"
              shape="pill"
              label={`${clientMachinesCount} ${clientMachinesCount === 1 ? 'Machine' : 'Machines'}`}
            />
          </View>

          <View style={styles.headerRight}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
              {roundedRunHours} hrs
            </Text>
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            {/* Meta Strip: Address & Contact */}
            {(Boolean(address) || Boolean(client.phone) || Boolean(client.email)) && (
              <View style={styles.metaStrip}>
                {Boolean(address) && (
                  <View style={styles.metaRow}>
                    <MapPin size={13} color={theme.colors.link} />
                    <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
                      {address}
                    </Text>
                  </View>
                )}
                <View style={styles.contactRow}>
                  {Boolean(client.phone) && (
                    <Pressable
                      variant="ghost"
                      onPress={() => Linking.openURL(`tel:${client.phone}`)}
                      style={styles.contactItem}
                      accessibilityLabel={`Call ${client.phone}`}
                    >
                      <Phone size={12} color="#10b981" />
                      <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                        {client.phone}
                      </Text>
                    </Pressable>
                  )}
                  {Boolean(client.email) && (
                    <Pressable
                      variant="ghost"
                      onPress={() => Linking.openURL(`mailto:${client.email}`)}
                      style={styles.contactItem}
                      accessibilityLabel={`Email ${client.email}`}
                    >
                      <Mail size={12} color="#6366f1" />
                      <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                        {client.email}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Standardized 4-Metric Mini KPI Grid (2 cols mobile, 4 cols tablet/desktop) */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Run Hours */}
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Clock size={13} color={theme.colors.link} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    RUN HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.link }}>
                  {roundedRunHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              {/* Card 2: Working Hours */}
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <UserCheck size={13} color="#10b981" />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    WORK HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: '#10b981' }}>
                  {roundedWorkingHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              {/* Card 3: Breakdowns */}
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <AlertTriangle size={13} color={totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    BREAKDOWNS
                  </Text>
                </View>
                <Text
                  variant="title"
                  weight="bold"
                  style={{
                    color: totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute,
                  }}
                >
                  {totalBreakdowns}
                </Text>
              </View>

              {/* Card 4: Logged Days */}
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Calendar size={13} color={theme.colors.ink} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    LOGGED DAYS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalDays}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    {totalDays === 1 ? 'day' : 'days'}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  // 2. MACHINE VIEW
  if (viewMode === 'machine') {
    if (!machine) return null;
    const model = machine.model || 'Equipment';
    const serial = machine.serial_number || machine.machine_id || '';
    const status = machine.status || 'available';

    const statusBadgeVariant =
      status === 'on_rent' || status === 'rented'
        ? 'info'
        : status === 'active'
        ? 'success'
        : status === 'under_maintenance'
        ? 'warning'
        : 'neutral';

    const statusLabel =
      status === 'on_rent' || status === 'rented'
        ? 'RENTED'
        : status.replace('_', ' ').toUpperCase();

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleToggle}
          style={styles.headerPressable}
          accessibilityLabel={`Toggle ${model} details`}
        >
          <View style={styles.headerLeft}>
            <Text variant="subheading" weight="bold" style={[styles.title, { color: theme.colors.ink }]}>
              {model} {serial ? `(${serial})` : ''}
            </Text>
            <Badge
              variant={statusBadgeVariant}
              size="sm"
              shape="pill"
              label={statusLabel}
            />
          </View>

          <View style={styles.headerRight}>
            {onOpenHistoryModal && (
              <Pressable
                variant="buttonSecondary"
                haptic="select"
                onPress={onOpenHistoryModal}
                style={[
                  styles.historyBtn,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvas,
                  },
                ]}
              >
                <Clock size={12} color={theme.colors.link} />
                <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                  History
                </Text>
                <ChevronDown size={12} color={theme.colors.mute} />
              </Pressable>
            )}

            <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
              {roundedRunHours} hrs
            </Text>

            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            {/* Manufacturer Tag if Available */}
            {Boolean(machine.manufacturer) && (
              <View style={styles.metaRow}>
                <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                  Manufacturer:{' '}
                  <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                    {machine.manufacturer}
                  </Text>
                </Text>
              </View>
            )}

            {/* Standardized 4-Metric Mini KPI Grid */}
            <View style={styles.kpiGrid}>
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Clock size={13} color={theme.colors.link} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    RUN HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.link }}>
                  {roundedRunHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <UserCheck size={13} color="#10b981" />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    WORK HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: '#10b981' }}>
                  {roundedWorkingHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <AlertTriangle size={13} color={totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    BREAKDOWNS
                  </Text>
                </View>
                <Text
                  variant="title"
                  weight="bold"
                  style={{
                    color: totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute,
                  }}
                >
                  {totalBreakdowns}
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Calendar size={13} color={theme.colors.ink} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    LOGGED DAYS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalDays}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    {totalDays === 1 ? 'day' : 'days'}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  // 3. OPERATOR VIEW
  if (viewMode === 'operator') {
    if (!operator) return null;

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <Pressable
          variant="card"
          haptic="select"
          onPress={handleToggle}
          style={styles.headerPressable}
          accessibilityLabel={`Toggle ${operator.full_name} details`}
        >
          <View style={styles.headerLeft}>
            <Text variant="subheading" weight="bold" style={[styles.title, { color: theme.colors.ink }]}>
              {operator.full_name}
            </Text>
            <Badge
              role="operator"
              size="sm"
              shape="pill"
              label="OPERATOR"
            />
          </View>

          <View style={styles.headerRight}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
              {roundedRunHours} hrs
            </Text>
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            {/* Meta Strip: Phone & Email */}
            {(Boolean(operator.phone) || Boolean(operator.email)) && (
              <View style={styles.contactRow}>
                {Boolean(operator.phone) && (
                  <Pressable
                    variant="ghost"
                    onPress={() => Linking.openURL(`tel:${operator.phone}`)}
                    style={styles.contactItem}
                    accessibilityLabel={`Call ${operator.phone}`}
                  >
                    <Phone size={12} color="#10b981" />
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                      {operator.phone}
                    </Text>
                  </Pressable>
                )}
                {Boolean(operator.email) && (
                  <Pressable
                    variant="ghost"
                    onPress={() => Linking.openURL(`mailto:${operator.email}`)}
                    style={styles.contactItem}
                    accessibilityLabel={`Email ${operator.email}`}
                  >
                    <Mail size={12} color="#6366f1" />
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
                      {operator.email}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Standardized 4-Metric Mini KPI Grid */}
            <View style={styles.kpiGrid}>
              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Clock size={13} color={theme.colors.link} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    RUN HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.link }}>
                  {roundedRunHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <UserCheck size={13} color="#10b981" />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    WORK HOURS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: '#10b981' }}>
                  {roundedWorkingHours}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    hrs
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <Calendar size={13} color={theme.colors.ink} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    WORKING DAYS
                  </Text>
                </View>
                <Text variant="title" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalDays}{' '}
                  <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                    {totalDays === 1 ? 'day' : 'days'}
                  </Text>
                </Text>
              </View>

              <View
                style={[
                  styles.kpiCard,
                  isTabletOrDesktop ? styles.kpiCardQuarter : styles.kpiCardHalf,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.kpiLabelRow}>
                  <AlertTriangle size={13} color={totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute} />
                  <Text variant="micro" weight="bold" style={[styles.kpiLabelText, { color: theme.colors.mute }]}>
                    BREAKDOWNS
                  </Text>
                </View>
                <Text
                  variant="title"
                  weight="bold"
                  style={{
                    color: totalBreakdowns > 0 ? (isDark ? '#f87171' : '#ee0000') : theme.colors.mute,
                  }}
                >
                  {totalBreakdowns}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  return null;
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacingNumeric.sm + 2,
  },
  collapsibleWrapper: {
    overflow: 'hidden',
  },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm + 2,
    minHeight: 48,
    gap: spacingNumeric.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 32,
  },
  expandedContent: {
    borderTopWidth: 1,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm + 2,
  },
  metaStrip: {
    gap: spacingNumeric.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.md,
    flexWrap: 'wrap',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    padding: spacingNumeric.sm + 2,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 4,
  },
  kpiCardHalf: {
    width: '48.5%',
  },
  kpiCardQuarter: {
    flex: 1,
    minWidth: 120,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kpiLabelText: {
  },
});
