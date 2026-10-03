import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Badge, useTheme, HighlightText } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Copy,
  Check,
  Edit2,
  Trash2,
  ChevronRight,
  Gauge,
} from 'lucide-react-native';

export interface MobileMachineCardProps {
  machine: any;
  isAdmin: boolean;
  isSupervisor?: boolean;
  searchTerm?: string;
  onEdit: (machine: any) => void;
  onDelete: (machine: any) => void;
  onLogMeter?: (machine: any) => void;
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
    <TouchableOpacity
      activeOpacity={0.88}
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
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={handleCopyId}
            activeOpacity={0.7}
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
              style={[styles.codeText, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
            />
            {copied ? (
              <Check size={12} color={theme.colors.success} strokeWidth={2.5} />
            ) : (
              <Copy size={12} color={theme.colors.mute} />
            )}
          </TouchableOpacity>

          {machine.model && (
            <HighlightText
              text={machine.model}
              query={searchTerm}
              style={[styles.modelText, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
              numberOfLines={1}
            />
          )}
        </View>

        {/* Badges Column */}
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

      {/* Sub Metadata Row */}
      {machine.serial_number && (
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: theme.colors.body }]}>
            S/N:{' '}
            <HighlightText
              text={machine.serial_number}
              query={searchTerm}
              style={[styles.metaText, { color: theme.colors.body }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
            />
          </Text>
        </View>
      )}

      {/* Inset Specs Well */}
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
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>
              Hour Meter (HMR):
            </Text>
            <Text style={[styles.specValueHmr, { color: theme.colors.ink }]}>
              {machine.hour_meter ?? 0} hrs
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>
              Assigned Client:
            </Text>
            <Text
              style={[styles.specValueClient, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {clientName}
            </Text>
          </View>
        </View>

        <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

        {/* Personnel Rows */}
        <View style={styles.twoColGrid}>
          {/* Supervisors */}
          <View style={{ flex: 1 }}>
            <View style={styles.personnelHeader}>
              <Text style={[styles.specLabel, { color: theme.colors.mute }]}>
                Supervisor:
              </Text>
            </View>

            {supervisors.length === 0 ? (
              <Text style={[styles.unassignedText, { color: theme.colors.mute }]}>
                Unassigned
              </Text>
            ) : (
              supervisors.slice(0, 3).map((s: any, idx: number) => {
                const isLast = idx === Math.min(supervisors.length, 3) - 1;
                const remaining = supervisors.length > 3 ? supervisors.length - 3 : 0;
                return (
                  <View key={s.id || idx} style={styles.personnelRow}>
                    <Text
                      style={[styles.personnelName, { color: theme.colors.ink, flexShrink: 1 }]}
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
              <Text style={[styles.specLabel, { color: theme.colors.mute }]}>
                Operator (24h):
              </Text>
            </View>

            {operators.length === 0 ? (
              <Text style={[styles.unassignedText, { color: theme.colors.mute }]}>
                Unassigned
              </Text>
            ) : (
              operators.slice(0, 3).map((o: any, idx: number) => {
                const isLast = idx === Math.min(operators.length, 3) - 1;
                const remaining = operators.length > 3 ? operators.length - 3 : 0;
                return (
                  <View key={o.id || idx} style={styles.personnelRow}>
                    <Text
                      style={[styles.personnelName, { color: theme.colors.ink, flexShrink: 1 }]}
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

      {/* Action Buttons Footer */}
      <View style={[styles.cardFooter, { borderTopColor: theme.colors.hairline }]}>
        <View style={styles.footerLeftBtns}>
          {isAdmin && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onEdit(machine);
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Edit Machine"
              accessibilityRole="button"
            >
              <Edit2 size={14} color="#f59e0b" />
            </TouchableOpacity>
          )}

          {isSupervisor && !isAdmin && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onEdit(machine);
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: isDark ? 'rgba(14, 165, 233, 0.35)' : 'rgba(14, 165, 233, 0.25)',
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Update Machine Status"
              accessibilityRole="button"
            >
              <Edit2 size={14} color="#0ea5e9" />
            </TouchableOpacity>
          )}

          {isAdmin && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onDelete(machine);
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.32)' : 'rgba(239, 68, 68, 0.22)',
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Delete Machine"
              accessibilityRole="button"
            >
              <Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          )}

          {onLogMeter && (
            <TouchableOpacity
              onPress={(e) => {
                e?.stopPropagation?.();
                onLogMeter(machine);
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel="Log Running Hours (HMR)"
              accessibilityRole="button"
            >
              <Gauge size={14} color={theme.colors.mute} />
            </TouchableOpacity>
          )}
        </View>

        {isMobile ? (
          <TouchableOpacity
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
            activeOpacity={0.7}
            accessibilityLabel="View Machine Details"
            accessibilityRole="button"
          >
            <ChevronRight size={16} color={theme.colors.link} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              onViewDetails(machine);
            }}
            style={[
              styles.viewDetailsBtn,
              {
                backgroundColor: isDark ? 'rgba(0, 112, 243, 0.15)' : 'rgba(0, 112, 243, 0.08)',
              },
            ]}
            activeOpacity={0.8}
            accessibilityLabel="View Machine Details"
            accessibilityRole="button"
          >
            <Text style={[styles.viewDetailsText, { color: theme.colors.link }]}>
              View Details
            </Text>
            <ChevronRight size={13} color={theme.colors.link} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
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
    gap: 4,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modelText: {
    fontSize: 15,
    fontWeight: '700',
  },
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
  },
  metaText: {
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specsWell: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
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
  specLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  specValueHmr: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specValueClient: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 1,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  moreCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  personnelName: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  inlineBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  inlineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  unassignedText: {
    fontSize: 12.5,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.xs,
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
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radiusNumeric.md,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  viewDetailsText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
