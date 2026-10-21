import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { AppModal, Button, Badge, Text, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import {
  X,
  Wrench,
  AlertCircle,
  Phone,
  ChevronDown,
  ChevronUp,
  Truck,
  MapPin,
  Clock,
  UserCheck,
  History,
  ShieldCheck,
  Plus,
} from '../ui/icon';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import type { ClientItemData } from './ClientModal';

export interface ClientDetailModalProps {
  visible: boolean;
  onClose: () => void;
  client: (ClientItemData & { deleted_at?: string | null }) | null;
  mobileLocationExpanded: boolean;
  mobileLocationLoading: boolean;
  mobileLocationData: { site_address?: string; billing_address?: string } | null;
  onToggleMobileLocation: () => void;
  mobileActiveTab: string | null;
  mobileTabLoading: string | null;
  onMobileTabChange: (tab: 'machines' | 'sites' | 'logs' | 'assignments' | 'history' | 'audit') => void;
  mobileMachines: any[];
  mobileSites: any[];
  mobileLogs: any[];
  mobileAssignments: any[];
  mobileHistory: any[];
  mobileAudits: any[];
  onOpenAddSite: (clientId?: string) => void;
  onOpenEdit: (client: any) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  visible,
  onClose,
  client,
  mobileLocationExpanded,
  mobileLocationLoading,
  mobileLocationData,
  onToggleMobileLocation,
  mobileActiveTab,
  mobileTabLoading,
  onMobileTabChange,
  mobileMachines,
  mobileSites,
  mobileLogs,
  mobileAssignments,
  mobileHistory,
  mobileAudits,
  onOpenAddSite,
  onOpenEdit,
}) => {
  const { theme, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  if (!client) return null;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'bottom'}
      showHandle={false}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 580,
              width: '100%',
              alignSelf: 'center',
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : {
              maxHeight: '92%',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }
      }
    >
      <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, maxHeight: '92%' }]}>
        {/* Header: Summary */}
        <View style={styles.modalHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <Text variant="mono" style={{ color: theme.colors.primary }}>
                {client.client_id || client.code}
              </Text>
              {client.status && (
                <Badge
                  status={client.deleted_at ? 'inactive' : client.status}
                  customLabel={client.deleted_at ? 'SOFT DELETED' : client.status.toUpperCase()}
                />
              )}
              {typeof client.maintenance_allowance_minutes === 'number' && client.maintenance_allowance_minutes > 0 ? (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Wrench size={10} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                    MAINT: {Math.floor(client.maintenance_allowance_minutes / 60)}h
                    {client.maintenance_allowance_minutes % 60 > 0 ? ` ${client.maintenance_allowance_minutes % 60}m` : ''}/MO
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <AlertCircle size={10} color="#dc2626" />
                  <Text variant="caption" style={{ color: '#dc2626' }}>
                    MAINT: NOT ALLOWED
                  </Text>
                </View>
              )}
            </View>
            <Text variant="heading" style={{ color: theme.colors.ink }} numberOfLines={1}>
              {client.company_name}
            </Text>
          </View>
          <Pressable
            variant="iconButton"
            hitSlopToMin48
            onPress={onClose}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityLabel="Close detail modal"
          >
            <X size={20} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Scrollable Modal Body */}
        <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 10, paddingBottom: 10 }}>
            {/* 1. Primary Contact Card */}
            <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <Text variant="label" style={{ color: theme.colors.primary }}>
                Primary Contact
              </Text>
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Person: <Text variant="body" style={{ color: theme.colors.ink }}>{client.contact_person || '—'}</Text>
                </Text>
                {Boolean(client.phone) && (
                  <Pressable
                    variant="buttonGhost"
                    hitSlopToMin48
                    onPress={() => Linking.openURL(`tel:${client.phone}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Phone size={12} color={theme.colors.primary} />
                    <Text variant="mono" style={{ color: theme.colors.primary }}>
                      {client.phone}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* 2. Tax Identifiers Card */}
            <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <Text variant="label" style={{ color: '#7e22ce' }}>
                Tax & Statutory Identifiers
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>GSTIN</Text>
                  <Text variant="mono" style={{ color: theme.colors.ink }}>
                    {client.gstin || 'Not Registered'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>PAN</Text>
                  <Text variant="mono" style={{ color: theme.colors.ink }}>
                    {client.pan_number || '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. Location & Billing Card */}
            <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="label" style={{ color: '#059669' }}>
                  Operational & Billing Addresses
                </Text>
                <Pressable
                  variant="buttonGhost"
                  hitSlopToMin48
                  onPress={onToggleMobileLocation}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 6 }}
                >
                  <Text variant="caption" style={{ color: theme.colors.primary }}>
                    {mobileLocationExpanded ? 'Hide' : 'Load On Demand'}
                  </Text>
                  {mobileLocationExpanded ? <ChevronUp size={12} color={theme.colors.primary} /> : <ChevronDown size={12} color={theme.colors.primary} />}
                </Pressable>
              </View>

              {!mobileLocationExpanded ? (
                <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                  {[client.street, client.city, client.state].filter(Boolean).join(', ') || '—'}
                </Text>
              ) : mobileLocationLoading ? (
                <View style={{ paddingVertical: 12, alignItems: 'center', gap: 4 }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Fetching location details...</Text>
                </View>
              ) : (
                <View style={{ gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.hairline, paddingTop: 6 }}>
                  <View>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Site Address:</Text>
                    <Text variant="body" style={{ color: theme.colors.ink }}>
                      {mobileLocationData?.site_address || '—'}
                    </Text>
                  </View>
                  <View>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Billing Address:</Text>
                    <Text variant="body" style={{ color: theme.colors.ink }}>
                      {mobileLocationData?.billing_address || 'Same as site location'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 4. Horizontal Sub-Navigation Tab Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
              style={{ maxHeight: 48 }}
            >
              {(
                [
                  { id: 'machines', label: 'Machines', icon: Truck, count: mobileMachines.length },
                  { id: 'sites', label: 'Sites', icon: MapPin, count: mobileSites.length },
                  { id: 'logs', label: 'Running Logs', icon: Clock, count: mobileLogs.length },
                  { id: 'assignments', label: 'Assignments', icon: UserCheck, count: mobileAssignments.length },
                  { id: 'history', label: 'History', icon: History, count: mobileHistory.length },
                  { id: 'audit', label: 'Audit', icon: ShieldCheck, count: mobileAudits.length },
                ] as const
              ).map((tab) => {
                const isActive = mobileActiveTab === tab.id;
                const IconComponent = tab.icon;
                return (
                  <Pressable
                    key={tab.id}
                    variant="chip"
                    haptic="select"
                    onPress={() => onMobileTabChange(tab.id)}
                    style={[
                      styles.detailTabChip,
                      {
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.canvas,
                        borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                        minHeight: 44,
                      },
                    ]}
                  >
                    <IconComponent size={12} color={isActive ? '#ffffff' : theme.colors.mute} />
                    <Text variant="caption" style={{ color: isActive ? '#ffffff' : theme.colors.ink }}>
                      {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 5. Operational Tab Content Area */}
            {mobileActiveTab === null && (
              <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas, alignItems: 'center', paddingVertical: 16 }]}>
                <Text variant="caption" style={{ color: theme.colors.ink }}>
                  Operational Records (On Demand)
                </Text>
                <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center', marginTop: 4, marginBottom: 10 }}>
                  Select a tab above to load machines, logs, assignments, history, or audit logs on demand.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  <Pressable
                    variant="chip"
                    haptic="select"
                    onPress={() => onMobileTabChange('machines')}
                    style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                  >
                    <Truck size={12} color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Machines</Text>
                  </Pressable>
                  <Pressable
                    variant="chip"
                    haptic="select"
                    onPress={() => onMobileTabChange('logs')}
                    style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                  >
                    <Clock size={12} color="#059669" />
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Running Logs</Text>
                  </Pressable>
                  <Pressable
                    variant="chip"
                    haptic="select"
                    onPress={() => onMobileTabChange('assignments')}
                    style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                  >
                    <UserCheck size={12} color="#7e22ce" />
                    <Text variant="caption" style={{ color: theme.colors.ink }}>Assignments</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* TAB: MACHINES */}
            {mobileActiveTab === 'machines' && (
              <View style={{ gap: 8 }}>
                {mobileTabLoading === 'machines' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading deployed machines...</Text>
                  </View>
                ) : mobileMachines.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    No equipment assigned to this client.
                  </Text>
                ) : (
                  mobileMachines.map((m: any) => (
                    <View key={m.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                      <View>
                        <Text variant="mono" style={{ color: theme.colors.primary }}>
                          {m.machine_id}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>{m.model}</Text>
                      </View>
                      <Badge status={m.status === 'rented' || m.status === 'active' ? 'active' : 'inactive'} customLabel={m.status.toUpperCase()} />
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: SITES */}
            {mobileActiveTab === 'sites' && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text variant="caption" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                    Registered Sites ({mobileSites.length})
                  </Text>
                  <Pressable
                    variant="buttonPrimary"
                    hitSlopToMin48
                    onPress={() => onOpenAddSite(client.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minHeight: 32 }}
                  >
                    <Plus size={12} color="#ffffff" />
                    <Text variant="caption" style={{ color: '#ffffff' }}>Add Site</Text>
                  </Pressable>
                </View>
                {mobileTabLoading === 'sites' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading operational sites...</Text>
                  </View>
                ) : mobileSites.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    No sites registered for this client.
                  </Text>
                ) : (
                  mobileSites.map((s: any) => (
                    <View key={s.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Text variant="mono" style={{ color: theme.colors.primary }}>
                          {s.site_code}
                        </Text>
                        <Badge status={s.status === 'active' ? 'active' : 'inactive'} customLabel={s.status.toUpperCase()} />
                      </View>
                      <Text variant="body" style={{ color: theme.colors.ink }}>{s.site_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} color={theme.colors.mute} />
                        <Text variant="caption" style={{ color: theme.colors.mute, flexShrink: 1 }}>
                          {[s.street, s.city, s.district, s.state_name, s.pincode].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: LOGS */}
            {mobileActiveTab === 'logs' && (
              <View style={{ gap: 8 }}>
                {mobileTabLoading === 'logs' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading running logs...</Text>
                  </View>
                ) : mobileLogs.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    No running logs recorded.
                  </Text>
                ) : (
                  mobileLogs.map((l: any) => (
                    <View key={l.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                      <View>
                        <Text variant="mono" style={{ color: theme.colors.ink }}>
                          {l.machine_code} • {l.log_date}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Operator: {l.operator_name}</Text>
                      </View>
                      <Text variant="mono" style={{ color: '#059669' }}>
                        {l.running_hours} hrs
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: ASSIGNMENTS */}
            {mobileActiveTab === 'assignments' && (
              <View style={{ gap: 8 }}>
                {mobileTabLoading === 'assignments' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading assignments...</Text>
                  </View>
                ) : mobileAssignments.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    No operator assignments found.
                  </Text>
                ) : (
                  mobileAssignments.map((a: any) => (
                    <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                      <View>
                        <Text variant="body" style={{ color: theme.colors.ink }}>{a.operator_name}</Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>
                          {a.machine_code} • {a.shift_name || `Shift ${a.shift_code || '1'}`} ({a.shift})
                        </Text>
                      </View>
                      <Badge status={a.is_active ? 'active' : 'inactive'} customLabel={a.is_active ? 'ACTIVE' : 'ENDED'} />
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: HISTORY */}
            {mobileActiveTab === 'history' && (
              <View style={{ gap: 8 }}>
                {mobileTabLoading === 'history' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading history...</Text>
                  </View>
                ) : mobileHistory.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    No timeline history events found.
                  </Text>
                ) : (
                  mobileHistory.map((h: any) => (
                    <View key={h.id} style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="body" style={{ color: theme.colors.ink }}>{h.title}</Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>{new Date(h.date).toLocaleDateString()}</Text>
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>{h.desc}</Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB: AUDIT */}
            {mobileActiveTab === 'audit' && (
              <View style={{ gap: 8 }}>
                {mobileTabLoading === 'audit' ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading audit trail...</Text>
                  </View>
                ) : mobileAudits.length === 0 ? (
                  <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                    Zero audit entries logged.
                  </Text>
                ) : (
                  mobileAudits.map((a: any) => (
                    <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                      <View>
                        <Text variant="mono" style={{ color: theme.colors.primary }}>
                          {a.action}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Actor: {a.actor_name || 'System'}</Text>
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>{formatDate(a.created_at)}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal Footer */}
        <View style={styles.modalFooter}>
          <Button label="Close" variant="outline" onPress={onClose} />
          {client && (
            <Button
              label="Edit Client"
              variant="primary"
              onPress={() => {
                onClose();
                onOpenEdit(client);
              }}
            />
          )}
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    padding: spacingNumeric.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.md,
  },
  detailSectionCard: {
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    padding: spacingNumeric.sm,
  },
  detailTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  detailItemCard: {
    borderWidth: 1,
    borderRadius: radiusNumeric.sm,
    padding: spacingNumeric.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
  },
});
