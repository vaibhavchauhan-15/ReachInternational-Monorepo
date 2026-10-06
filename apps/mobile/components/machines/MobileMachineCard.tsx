import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Badge, useTheme, HighlightText, Text, Touchable } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Copy,
  Check,
  ChevronRight,
  History,
} from 'lucide-react-native';

export interface MobileMachineCardProps {
  machine: any;
  isAdmin: boolean;
  isSupervisor?: boolean;
  searchTerm?: string;
  onEdit: (machine: any) => void;
  onDelete: (machine: any) => void;
  onLogMeter?: (machine: any) => void;
  onViewHistory?: (machine: any) => void;
  onViewDetails: (machine: any) => void;
}

export const MobileMachineCard: React.FC<MobileMachineCardProps> = ({
  machine,
  isAdmin,
  isSupervisor = false,
  searchTerm,
  onEdit,
  onDelete,
  onLogMeter,
  onViewHistory,
  onViewDetails,
}) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width <= 640;
  const [copied, setCopied] = useState(false);

  const handleCopyId = (e?: any) => {
    e?.stopPropagation?.();
    if (!machine.machine_id) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const getAccentBorderColor = () => {
    if (machine.health_status === 'breakdown') return '#ef4444';
    if (machine.health_status === 'under_maintenance') return '#f59e0b';
    if (machine.health_status === 'spare') return '#06b6d4';
    if (machine.status === 'rented') return '#0ea5e9';
    return '#10b981';
  };

  const supervisors = Array.isArray(machine.supervisors) && machine.supervisors.length > 0
    ? machine.supervisors.filter((s: any) => Boolean(s?.full_name))
    : machine.current_supervisor?.full_name
    ? [machine.current_supervisor]
    : [];

  const operators = Array.isArray(machine.operators) && machine.operators.length > 0
    ? machine.operators.filter((o: any) => Boolean(o?.full_name))
    : machine.current_operator?.full_name
    ? [machine.current_operator]
    : [];

  const clientName = machine.client?.company_name || machine.customer_name || '—';

  return (
    <Touchable
      preset="card"
      onPress={() => onViewDetails(machine)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: getAccentBorderColor(),
        },
      ]}
    >
      {/* Top Header Row (Screenshot 1: M/C ID chip + Model name on left, Badges on right) */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Touchable
            preset="icon"
            onPress={handleCopyId}
            style={[
              styles.codeBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <HighlightText
              text={machine.machine_id}
              query={searchTerm}
              variant="mono"
              style={[styles.codeText, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3' }}
            />
            {copied ? (
              <Check size={12} color={theme.colors.success} strokeWidth={2.5} />
            ) : (
              <Copy size={12} color={theme.colors.mute} />
            )}
          </Touchable>

          {machine.model && (
            <HighlightText
              text={machine.model}
              query={searchTerm}
              variant="heading"
              style={[styles.modelText, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3' }}
              numberOfLines={1}
            />
          )}
        </View>

        {/* Badges Column: Active / Health + Rented / Available */}
        <View style={styles.badgeWrap}>
          {machine.health_status === 'breakdown' && (
            <Badge status="breakdown" customLabel="Breakdown" size="sm" />
          )}
          {machine.health_status === 'under_maintenance' && (
            <Badge status="under_maintenance" customLabel="Maintenance" size="sm" />
          )}
          {machine.health_status === 'spare' && (
            <Badge status="spare" customLabel="Spare" size="sm" />
          )}
          {(!machine.health_status || machine.health_status === 'active') && (
            <Badge status="active" customLabel="Active" size="sm" />
          )}

          <Badge
            status={machine.status === 'rented' ? 'rented' : 'available'}
            customLabel={machine.status === 'rented' ? 'Rented' : 'Available'}
            size="sm"
          />
        </View>
      </View>

      {/* Sub Metadata Row: S/N */}
      {machine.serial_number && (
        <View style={styles.metaRow}>
          <Text variant="caption" style={{ color: theme.colors.body }}>
            S/N:{' '}
            <HighlightText
              text={machine.serial_number}
              query={searchTerm}
              variant="mono"
              style={{ color: theme.colors.body }}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3' }}
            />
          </Text>
        </View>
      )}

      {/* Inset Specs Well (Screenshot 1: Hour Meter & Client in Col 1 & 2; Supervisor & Operator in Row 2) */}
      <View
        style={[
          styles.specsWell,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.twoColGrid}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={[styles.specLabel, { color: theme.colors.mute }]}>
              Hour Meter (HMR):
            </Text>
            <Text variant="mono" style={[styles.specValueHmr, { color: theme.colors.ink }]}>
              {machine.hour_meter ?? 0} hrs
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text variant="caption" style={[styles.specLabel, { color: theme.colors.mute }]}>
              Assigned Client:
            </Text>
            <Text
              variant="subheading"
              style={[styles.specValueClient, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {clientName}
            </Text>
          </View>
        </View>

        <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

        {/* Personnel Rows: Supervisor & Operator (24h) */}
        <View style={styles.twoColGrid}>
          {/* Supervisors */}
          <View style={{ flex: 1 }}>
            <View style={styles.personnelHeader}>
              <Text variant="caption" style={[styles.specLabel, { color: theme.colors.mute }]}>
                Supervisor:
              </Text>
            </View>

            {supervisors.length === 0 ? (
              <Text variant="caption" style={[styles.unassignedText, { color: theme.colors.mute }]}>
                Unassigned
              </Text>
            ) : (
              supervisors.slice(0, 3).map((s: any, idx: number) => {
                const isLast = idx === Math.min(supervisors.length, 3) - 1;
                const remaining = supervisors.length > 3 ? supervisors.length - 3 : 0;
                return (
                  <View key={s.id || idx} style={styles.personnelRow}>
                    <Text
                      variant="caption"
                      style={[{ color: theme.colors.ink, flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {s.full_name}
                    </Text>
                    {isLast && remaining > 0 && (
                      <View
                        style={[
                          styles.inlineBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(20, 184, 166, 0.15)'
                              : 'rgba(20, 184, 166, 0.1)',
                            borderColor: isDark
                              ? 'rgba(20, 184, 166, 0.3)'
                              : 'rgba(20, 184, 166, 0.2)',
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={[
                            styles.inlineBadgeText,
                            { color: isDark ? '#2dd4bf' : '#0d9488' },
                          ]}
                        >
                          +{remaining}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Operators */}
          <View style={{ flex: 1 }}>
            <View style={styles.personnelHeader}>
              <Text variant="caption" style={[styles.specLabel, { color: theme.colors.mute }]}>
                Operator (24h):
              </Text>
            </View>

            {operators.length === 0 ? (
              <Text variant="caption" style={[styles.unassignedText, { color: theme.colors.mute }]}>
                Unassigned
              </Text>
            ) : (
              operators.slice(0, 3).map((o: any, idx: number) => {
                const isLast = idx === Math.min(operators.length, 3) - 1;
                const remaining = operators.length > 3 ? operators.length - 3 : 0;
                return (
                  <View key={o.id || idx} style={styles.personnelRow}>
                    <Text
                      variant="caption"
                      style={[{ color: theme.colors.ink, flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {o.full_name}
                    </Text>
                    {isLast && remaining > 0 && (
                      <View
                        style={[
                          styles.inlineBadge,
                          {
                            backgroundColor: isDark
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(245, 158, 11, 0.1)',
                            borderColor: isDark
                              ? 'rgba(245, 158, 11, 0.3)'
                              : 'rgba(245, 158, 11, 0.2)',
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={[
                            styles.inlineBadgeText,
                            { color: isDark ? '#fbbf24' : '#d97706' },
                          ]}
                        >
                          +{remaining}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

      {/* Action Buttons Footer (Screenshot 1: Left History Squircle & Right Details Squircle) */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <View style={styles.footerLeftBtns}>
          <Touchable
            preset="icon"
            onPress={(e) => {
              e?.stopPropagation?.();
              if (onViewHistory) {
                onViewHistory(machine);
              } else if (onLogMeter) {
                onLogMeter(machine);
              } else {
                onViewDetails(machine);
              }
            }}
            style={[
              styles.iconActionBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityLabel="View Machine Running Logs"
          >
            <History size={16} color={theme.colors.link} />
          </Touchable>
        </View>

        {/* View Details Right Squircle (Screenshot 1: Sky blue background with ChevronRight) */}
        <Touchable
          preset="icon"
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails(machine);
          }}
          style={[
            styles.iconActionBtn,
            {
              backgroundColor: isDark ? 'rgba(0, 112, 243, 0.16)' : 'rgba(0, 112, 243, 0.09)',
              borderColor: isDark ? 'rgba(0, 112, 243, 0.35)' : 'rgba(0, 112, 243, 0.22)',
            },
          ]}
          accessibilityLabel="View Machine Details"
        >
          <ChevronRight size={16} color={theme.colors.link} />
        </Touchable>
      </View>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.xs,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeText: {},
  modelText: {},
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
    gap: 6,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
    marginTop: 2,
  },
  specsWell: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  twoColGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
  },
  specsDivider: {
    height: 1,
    width: '100%',
  },
  specLabel: {},
  specValueHmr: {
    marginTop: 1,
  },
  specValueClient: {
    marginTop: 1,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  inlineBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  inlineBadgeText: {},
  unassignedText: {},
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    gap: spacingNumeric.xs,
  },
  footerLeftBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
});
