import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Badge, useTheme, HighlightText, Text, Touchable, showToast } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';
import {
  Copy,
  Check,
  ChevronRight,
  History,
  Shield,
  User,
} from '../ui/icon';

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
  const [copied, setCopied] = useState(false);

  const handleCopyId = async (e?: any) => {
    e?.stopPropagation?.();
    if (!machine.machine_id) return;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(machine.machine_id);
      }
    } catch {
      // Fallback
    }
    haptics.select();
    setCopied(true);
    showToast('success', 'Copied to clipboard', `Machine ID "${machine.machine_id}" copied.`);
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: getAccentBorderColor(),
        },
      ]}
    >
      {/* Top Header Row: M/C ID chip + Model name on left, Badges on right */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {/* Machine ID Reusable Badge Chip */}
          <Touchable
            preset="icon"
            onPress={handleCopyId}
            style={styles.codeBtn}
            accessibilityLabel={`Copy machine ID ${machine.machine_id}`}
            accessibilityHint="Copies machine ID to clipboard and shows toast"
          >
            <Badge
              variant="outline"
              size="md"
              style={[
                styles.codeBadge,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.codeBadgeContent}>
                <HighlightText
                  text={machine.machine_id}
                  query={searchTerm}
                  variant="mono"
                  style={{ color: theme.colors.ink }}
                  matchStyle={{ color: isDark ? '#3291ff' : '#0070f3' }}
                />
                {copied ? (
                  <Check size={12} color={theme.colors.success} strokeWidth={2.5} />
                ) : (
                  <Copy size={12} color={theme.colors.mute} />
                )}
              </View>
            </Badge>
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
            <Badge status="breakdown" customLabel="Breakdown" size="md" />
          )}
          {machine.health_status === 'under_maintenance' && (
            <Badge status="under_maintenance" customLabel="Maintenance" size="md" />
          )}
          {machine.health_status === 'spare' && (
            <Badge status="spare" customLabel="Spare" size="md" />
          )}
          {(!machine.health_status || machine.health_status === 'active') && (
            <Badge status="active" customLabel="Active" size="md" />
          )}

          <Badge
            status={machine.status === 'rented' ? 'rented' : 'available'}
            customLabel={machine.status === 'rented' ? 'Rented' : 'Available'}
            size="md"
          />
        </View>
      </View>

      {/* Sub Metadata Row: S/N and Year of Mfg */}
      {(machine.serial_number || machine.year_of_mfg) && (
        <View style={styles.metaRow}>
          {machine.serial_number && (
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
          )}
          {machine.serial_number && machine.year_of_mfg && (
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              •
            </Text>
          )}
          {machine.year_of_mfg && (
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Mfg: {machine.year_of_mfg}
            </Text>
          )}
        </View>
      )}

      {/* Inset Specs Well: Hour Meter & Client in Col 1 & 2; Supervisor & Operator in Row 2 */}
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
          <View style={styles.gridCol}>
            <Text variant="caption" style={[styles.specLabel, { color: theme.colors.mute }]}>
              Hour Meter (HMR):
            </Text>
            <Text variant="mono" style={[styles.specValueHmr, { color: theme.colors.ink }]}>
              {machine.hour_meter ?? 0} hrs
            </Text>
          </View>

          <View style={styles.gridCol}>
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
          <View style={styles.gridCol}>
            <View style={styles.personnelHeader}>
              <Shield size={12} color="#0d9488" />
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
                      <Badge variant="neutral" size="md">
                        +{remaining}
                      </Badge>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Operators */}
          <View style={styles.gridCol}>
            <View style={styles.personnelHeader}>
              <User size={12} color="#d97706" />
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
                      <Badge variant="neutral" size="md">
                        +{remaining}
                      </Badge>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

      {/* Action Buttons Footer: Left History Log & Right View Details */}
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

        {/* View Details Right Squircle */}
        <Touchable
          preset="button"
          onPress={(e) => {
            e?.stopPropagation?.();
            onViewDetails(machine);
          }}
          style={[
            styles.viewDetailsBtn,
            {
              backgroundColor: '#0284c7',
              borderColor: '#0284c7',
            },
          ]}
          accessibilityLabel="View Machine Details"
        >
          <Text variant="label" style={{ color: '#ffffff' }}>
            Details
          </Text>
          <ChevronRight size={14} color="#ffffff" strokeWidth={2.5} />
        </Touchable>
      </View>
    </View>
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
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
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
    alignSelf: 'flex-start',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.md,
  },
  codeBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modelText: {
    flexShrink: 1,
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
    marginTop: 1,
  },
  specsWell: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  twoColGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
  },
  gridCol: {
    flex: 1,
  },
  specsDivider: {
    height: 1,
    width: '100%',
  },
  specLabel: {
    marginBottom: 2,
  },
  specValueHmr: {
    marginTop: 1,
  },
  specValueClient: {
    marginTop: 1,
  },
  personnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  personnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  unassignedText: {
    fontStyle: 'italic',
  },
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
  },
  iconActionBtn: {
    width: 36,
    height: 36,
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
    height: 36,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
});
