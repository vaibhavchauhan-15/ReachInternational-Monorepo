import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { ChevronDown, Clock, MapPin, Phone, Mail, AlertTriangle, ShieldCheck } from '../ui/icon';

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
  const [internalExpanded, setInternalExpanded] = useState<boolean>(true);

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const progress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isExpanded ? 1 : 0, {
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isExpanded, progress]);

  const chevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${progress.value * 180}deg` }],
    };
  });

  const collapsibleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      maxHeight: interpolate(progress.value, [0, 1], [0, 280]),
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
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            {address ? (
              <View style={styles.metaRow}>
                <MapPin size={12} color={theme.colors.mute} />
                <Text variant="caption" style={{ color: theme.colors.mute, flex: 1 }}>
                  {address}
                </Text>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  TOTAL RUN TIME
                </Text>
                <Text variant="body" weight="bold" style={{ color: theme.colors.link }}>
                  {Math.round(totalRunHours * 10) / 10}h
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  LOGGED DAYS
                </Text>
                <Text variant="body" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalDays} {totalDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
              {totalBreakdowns > 0 && (
                <View style={styles.statCol}>
                  <Text variant="caption" style={{ color: '#ee0000' }}>
                    BREAKDOWNS
                  </Text>
                  <Text variant="body" weight="bold" style={{ color: '#ee0000' }}>
                    {totalBreakdowns}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

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

            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            <View style={styles.statsRow}>
              {machine.manufacturer ? (
                <View style={styles.statCol}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    MANUFACTURER
                  </Text>
                  <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                    {machine.manufacturer}
                  </Text>
                </View>
              ) : null}

              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  TOTAL RUN TIME
                </Text>
                <Text variant="body" weight="bold" style={{ color: theme.colors.link }}>
                  {Math.round(totalRunHours * 10) / 10}h
                </Text>
              </View>

              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  BREAKDOWN EVENTS
                </Text>
                <Text
                  variant="body"
                  weight="bold"
                  style={{ color: totalBreakdowns > 0 ? '#ee0000' : theme.colors.mute }}
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
            <Text variant="body" weight="bold" style={{ color: theme.colors.link }}>
              {Math.round(totalRunHours * 10) / 10} hrs
            </Text>
            <Animated.View style={chevronAnimatedStyle}>
              <ChevronDown size={16} color={theme.colors.mute} />
            </Animated.View>
          </View>
        </Pressable>

        <Animated.View style={[styles.collapsibleWrapper, collapsibleAnimatedStyle]}>
          <View style={[styles.expandedContent, { borderTopColor: theme.colors.hairline }]}>
            {operator.phone ? (
              <View style={styles.metaRow}>
                <Phone size={12} color={theme.colors.mute} />
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  {operator.phone}
                </Text>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  TOTAL RUN TIME
                </Text>
                <Text variant="body" weight="bold" style={{ color: theme.colors.link }}>
                  {Math.round(totalRunHours * 10) / 10}h
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  WORKING DAYS
                </Text>
                <Text variant="body" weight="bold" style={{ color: theme.colors.ink }}>
                  {totalDays} {totalDays === 1 ? 'day' : 'days'}
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
    minHeight: 46,
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
    gap: 8,
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
  },
  expandedContent: {
    borderTopWidth: 1,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
    flexWrap: 'wrap',
  },
  statCol: {
    gap: 2,
  },
});
