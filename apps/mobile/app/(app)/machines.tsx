import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { MachineDetailModal } from '../../components/machines/MachineDetailModal';
import { AddMachineModal } from '../../components/machines/AddMachineModal';
import { MeterLogModal } from '../../components/work/MeterLogModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Plus, Wrench, Copy, Check, Edit2, Trash2 } from 'lucide-react-native';

export type StatusFilter = 'all' | 'available' | 'rented';

export interface MachineRecord {
  id: string;
  machine_id: string;
  model: string;
  serial_number: string;
  year_of_mfg?: string;
  manufacturer?: string;
  status: string;
  health_status: string;
  hour_meter: number;
  service_count: number;
  customer_name?: string;
  supervisor_id?: string;
  operator_id?: string;
  current_supervisor?: { full_name: string } | null;
  current_operator?: { full_name: string } | null;
}

export default function MachinesScreen() {
  const { theme } = useTheme();
  const { role } = useAuth();

  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState<any | null>(null);

  const [meterModalVisible, setMeterModalVisible] = useState(false);
  const [meterMachineData, setMeterMachineData] = useState<{ id: string; code: string; model?: string; serial?: string }>({
    id: '',
    code: '',
  });

  const normalizedRole = (role || '').toLowerCase();
  const isManagerOrAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager' ||
    normalizedRole === 'service_manager';
  const canEdit = isManagerOrAdmin || normalizedRole === 'supervisor';
  const canDelete = isManagerOrAdmin;

  const handleDeleteMachine = (m: MachineRecord) => {
    Alert.alert(
      'Delete Machine',
      `Are you sure you want to permanently delete machine ${m.machine_id} (${m.model || 'Unknown Model'})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('machines').delete().eq('id', m.id);
              if (error) throw error;
              fetchMachines();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete machine');
            }
          },
        },
      ]
    );
  };

  const fetchMachines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select(`
          id,
          machine_id,
          model,
          serial_number,
          year_of_mfg,
          manufacturer,
          status,
          health_status,
          hour_meter,
          service_count,
          customer_name,
          supervisor_id,
          operator_id,
          current_supervisor:users!machines_supervisor_id_fkey(full_name),
          current_operator:users!machines_operator_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching machines:', error);
      } else if (data) {
        setMachines(data as any);
      }
    } catch (err) {
      console.error('Error fetching live machines:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMachines();
  }, [fetchMachines]);

  const handleCopyId = (mId: string) => {
    setCopiedId(mId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openDetail = (m: MachineRecord) => {
    setSelectedMachine({
      ...m,
      customer_name: m.customer_name,
      supervisor_name: m.current_supervisor?.full_name,
      operator_name: m.current_operator?.full_name,
    });
    setDetailModalVisible(true);
  };

  const openEdit = (m: MachineRecord) => {
    setMachineToEdit(m);
    setAddModalVisible(true);
  };

  const openAdd = () => {
    setMachineToEdit(null);
    setAddModalVisible(true);
  };

  const openMeter = (m: MachineRecord) => {
    setMeterMachineData({
      id: m.id,
      code: m.machine_id,
      model: m.model,
      serial: m.serial_number,
    });
    setMeterModalVisible(true);
  };

  const filteredMachines = machines.filter((m) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (m.machine_id && m.machine_id.toLowerCase().includes(query)) ||
      (m.model && m.model.toLowerCase().includes(query)) ||
      (m.serial_number && m.serial_number.toLowerCase().includes(query)) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(query));

    const matchesStatus = activeFilter === 'all' || m.status === activeFilter;

    return matchesSearch && matchesStatus;
  });

  const availableCount = machines.filter((m) => m.status === 'available').length;
  const rentedCount = machines.filter((m) => m.status === 'rented').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header */}
      <MobileHeader
        eyebrow="FLEET ASSETS"
        title="Machine Fleet Directory"
        subtitle="Industrial machinery assets, HMR meter readings & personnel assignments"
        rightAction={
          isManagerOrAdmin ? (
            <TouchableOpacity
              onPress={openAdd}
              style={[
                styles.addBtn,
                { backgroundColor: theme.colors.ink },
              ]}
              activeOpacity={0.8}
            >
              <Plus size={14} color={theme.colors.canvas} />
              <Text style={[styles.addBtnText, { color: theme.colors.canvas }]}>Add</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Search & Filter Bar */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <Input
          placeholder="Search ID, model, serial no, manufacturer..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={theme.colors.mute} />}
          containerStyle={styles.searchInput}
        />

        {/* Filter Pills Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: `All Fleet (${machines.length})` },
            { key: 'available', label: `Available (${availableCount})` },
            { key: 'rented', label: `Rented (${rentedCount})` },
          ].map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key as StatusFilter)}
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: isActive ? theme.colors.onPrimary : theme.colors.body }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Machine Card List Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading fleet inventory...</Text>
          </View>
        ) : filteredMachines.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Wrench size={32} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No machines found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              Try adjusting your search criteria or clear active status filters.
            </Text>
          </View>
        ) : (
          filteredMachines.map((m) => {
            const isCopied = copiedId === m.machine_id;
            return (
              <Card key={m.id} style={styles.card}>
                {/* Top Row: Machine Code, Model & Status Badges */}
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeftInfo}>
                    <TouchableOpacity
                      onPress={() => handleCopyId(m.machine_id)}
                      activeOpacity={0.7}
                      style={styles.codeBtn}
                    >
                      <Text style={[styles.codeText, { color: theme.colors.ink }]}>
                        {m.machine_id}
                      </Text>
                      {isCopied ? (
                        <Check size={12} color={theme.colors.success} />
                      ) : (
                        <Copy size={12} color={theme.colors.mute} />
                      )}
                    </TouchableOpacity>
                    {m.model && (
                      <Text style={[styles.modelText, { color: theme.colors.ink }]} numberOfLines={1}>
                        • {m.model}
                      </Text>
                    )}
                  </View>

                  <View style={styles.badgeColumn}>
                    {m.health_status === 'breakdown' && <Badge status="breakdown" customLabel="Breakdown" />}
                    {m.health_status === 'under_maintenance' && <Badge status="under_maintenance" customLabel="Maintenance" />}
                    {m.health_status === 'active' && <Badge status="active" customLabel="Active" />}
                    <Badge status={m.status === 'rented' ? 'in_transit' : 'available'} customLabel={m.status === 'rented' ? 'Rented' : 'Available'} />
                  </View>
                </View>

                {/* Sub Metadata Row */}
                <View style={styles.metaRow}>
                  {m.serial_number && (
                    <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                      S/N: {m.serial_number}
                    </Text>
                  )}
                  {m.year_of_mfg && (
                    <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                      • YUM: {m.year_of_mfg}
                    </Text>
                  )}
                  {m.manufacturer && (
                    <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                      • Mfg: {m.manufacturer}
                    </Text>
                  )}
                </View>

                {/* Inset Specs Well */}
                <View style={[styles.specsWell, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specsGrid}>
                    <View style={styles.specsItem}>
                      <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Hour Meter (HMR):</Text>
                      <Text style={[styles.specsValue, { color: theme.colors.ink }]}>{m.hour_meter ?? 0} hrs</Text>
                    </View>
                    <View style={styles.specsItem}>
                      <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Assigned Client:</Text>
                      <Text style={[styles.specsValue, { color: theme.colors.ink }]} numberOfLines={1}>
                        {m.customer_name || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.specsDivider, { backgroundColor: theme.colors.hairline }]} />

                  <View style={styles.specsGrid}>
                    <View style={styles.specsItem}>
                      <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Supervisor:</Text>
                      <Text style={[styles.personnelText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {m.current_supervisor?.full_name || 'Unassigned'}
                      </Text>
                    </View>
                    <View style={styles.specsItem}>
                      <Text style={[styles.specsLabel, { color: theme.colors.mute }]}>Operator:</Text>
                      <Text style={[styles.personnelText, { color: theme.colors.ink }]} numberOfLines={1}>
                        {m.current_operator?.full_name || 'Unassigned'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card Actions Footer */}
                <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
                  <View style={styles.actionsLeft}>
                    {canEdit && (
                      <Button
                        label="Edit"
                        onPress={() => openEdit(m)}
                        size="sm"
                        variant="ghost"
                        icon={<Edit2 size={12} color={theme.colors.body} />}
                      />
                    )}
                    {canDelete && (
                      <Button
                        label="Delete"
                        onPress={() => handleDeleteMachine(m)}
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={12} color={theme.colors.error} />}
                      />
                    )}
                    <Button
                      label="Log Meter"
                      onPress={() => openMeter(m)}
                      size="sm"
                      variant="outline"
                    />
                  </View>

                  <Button
                    label="View Specs"
                    onPress={() => openDetail(m)}
                    size="sm"
                    variant="primary"
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Machine Details Bottom Sheet Modal */}
      {selectedMachine && (
        <MachineDetailModal
          visible={detailModalVisible}
          onClose={() => setDetailModalVisible(false)}
          machineData={selectedMachine}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => {
            setDetailModalVisible(false);
            openEdit(selectedMachine);
          }}
          onDelete={() => {
            setDetailModalVisible(false);
            handleDeleteMachine(selectedMachine);
          }}
        />
      )}

      {/* Add / Edit Machine Modal */}
      <AddMachineModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={fetchMachines}
        machineToEdit={machineToEdit}
      />

      {/* Meter Log Modal */}
      <MeterLogModal
        visible={meterModalVisible}
        onClose={() => setMeterModalVisible(false)}
        machineId={meterMachineData.id}
        machineCode={meterMachineData.code}
        model={meterMachineData.model}
        serialNumber={meterMachineData.serial}
        onSubmit={fetchMachines}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchFilterContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterScroll: {
    gap: spacingNumeric.xs,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: spacingNumeric.sm + 2,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    paddingBottom: 40,
    gap: spacingNumeric.md,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    gap: spacingNumeric.xs,
    padding: spacingNumeric.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  modelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  specsWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  specsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specsItem: {
    flex: 1,
  },
  specsLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  specsValue: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  personnelText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  specsDivider: {
    height: 1,
    marginVertical: 6,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
    marginTop: 4,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
