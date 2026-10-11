import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { showToast } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Wrench, CheckSquare, Square, X, Cpu } from '../ui/icon';
import type { UserRecord } from './UserDetailModal';

export interface AssignMachineModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: () => void;
}

interface MachineItem {
  id: string;
  machine_id: string;
  model: string;
  status: string;
  operator_ids?: string[] | null;
  supervisor_ids?: string[] | null;
}

export const AssignMachineModal: React.FC<AssignMachineModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isSupervisorRole = Boolean(
    user?.role && ['supervisor', 'manager'].includes(user.role.toLowerCase())
  );

  useEffect(() => {
    if (visible && user) {
      setSearch('');
      loadMachines();
    }
  }, [visible, user]);

  const loadMachines = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('id, machine_id, model, status, operator_ids, supervisor_ids')
        .order('machine_id', { ascending: true });

      if (error) throw error;
      if (data) {
        const rawMachines = data as MachineItem[];
        setMachines(rawMachines);

        const assigned = rawMachines
          .filter((m) => {
            if (isSupervisorRole) {
              return Array.isArray(m.supervisor_ids) && m.supervisor_ids.includes(user.id);
            }
            return Array.isArray(m.operator_ids) && m.operator_ids.includes(user.id);
          })
          .map((m) => m.id);

        setSelectedMachineIds(assigned);
        setInitialSelectedIds(assigned);
      }
    } catch (err: any) {
      console.warn('Failed to load machines:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMachines = useMemo(() => {
    if (!search.trim()) return machines;
    const q = search.trim().toLowerCase();
    return machines.filter(
      (m) =>
        m.machine_id?.toLowerCase().includes(q) ||
        m.model?.toLowerCase().includes(q) ||
        m.status?.toLowerCase().includes(q)
    );
  }, [machines, search]);

  const toggleMachine = (machineId: string) => {
    haptics.select();
    setSelectedMachineIds((prev) =>
      prev.includes(machineId)
        ? prev.filter((id) => id !== machineId)
        : [...prev, machineId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Find machines where assignment status changed
      const initialSet = new Set(initialSelectedIds);
      const currentSet = new Set(selectedMachineIds);

      const changedMachines = machines.filter((m) => {
        const wasSelected = initialSet.has(m.id);
        const isNowSelected = currentSet.has(m.id);
        return wasSelected !== isNowSelected;
      });

      for (const m of changedMachines) {
        const isNowSelected = currentSet.has(m.id);
        let updatedOpIds = Array.isArray(m.operator_ids) ? [...m.operator_ids] : [];
        let updatedSupIds = Array.isArray(m.supervisor_ids) ? [...m.supervisor_ids] : [];

        if (isSupervisorRole) {
          updatedSupIds = isNowSelected
            ? Array.from(new Set([...updatedSupIds, user.id]))
            : updatedSupIds.filter((id) => id !== user.id);
        } else {
          updatedOpIds = isNowSelected
            ? Array.from(new Set([...updatedOpIds, user.id]))
            : updatedOpIds.filter((id) => id !== user.id);
        }

        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (isSupervisorRole) {
          updatePayload.supervisor_ids = updatedSupIds;
        } else {
          updatePayload.operator_ids = updatedOpIds;
        }

        const { error: updateErr } = await supabase
          .from('machines')
          .update(updatePayload)
          .eq('id', m.id);

        if (updateErr) throw updateErr;
      }

      haptics.confirm();
      showToast(
        'success',
        'Machines Assigned',
        `Updated machinery assignments for ${user.full_name} (${selectedMachineIds.length} assigned).`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      haptics.reject();
      showToast('error', 'Assignment Failed', err?.message || 'Failed to update machine assignments.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom" testID="assign-machine-modal">
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Notch / Drag handle */}
        <View style={styles.notchWrapper}>
          <View style={[styles.notch, { backgroundColor: theme.colors.hairline }]} />
        </View>

        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.modalHeaderLeft}>
            <View style={[styles.iconCircle, { backgroundColor: '#d9770618' }]}>
              <Wrench size={18} color="#d97706" />
            </View>
            <View style={styles.headerTitles}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Assign Machinery
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {user ? `Assign machines to ${user.full_name}` : 'Assign machinery'}
              </Text>
            </View>
          </View>
          <Pressable variant="plain" hitSlopToMin48 onPress={onClose} style={styles.closeBtn}>
            <X size={18} color={theme.colors.mute} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search machines by ID or model..."
          />
        </View>

        {/* Machine List */}
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.link} />
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Loading fleet machines...
              </Text>
            </View>
          ) : (
            <>
              {filteredMachines.map((m) => {
                const isChecked = selectedMachineIds.includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    variant="plain"
                    haptic={false}
                    onPress={() => toggleMachine(m.id)}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: isChecked ? theme.colors.canvas : 'transparent',
                        borderColor: isChecked ? theme.colors.link : theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View style={{ marginRight: 6 }}>
                        {isChecked ? (
                          <CheckSquare size={20} color={theme.colors.link} />
                        ) : (
                          <Square size={20} color={theme.colors.mute} />
                        )}
                      </View>
                      <View style={styles.optionTextContainer}>
                        <View style={styles.nameRow}>
                          <Text variant="mono" style={{ color: theme.colors.ink }}>
                            {m.machine_id}
                          </Text>
                          <Badge status={m.status} size="sm">
                            <Text variant="micro">
                              {m.status ? m.status.toUpperCase() : 'UNKNOWN'}
                            </Text>
                          </Badge>
                        </View>
                        <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                          {m.model || 'Standard Machinery'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {filteredMachines.length === 0 && !isLoading && (
                <View style={styles.emptyBox}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    No machines found matching "{search}".
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Modal Footer / Save Action */}
        <View style={[styles.modalFooter, { borderTopColor: theme.colors.hairline }]}>
          <Pressable
            variant="plain"
            onPress={onClose}
            disabled={isSaving}
            style={[styles.cancelBtn, { borderColor: theme.colors.hairline }]}
          >
            <Text variant="label" style={{ color: theme.colors.ink }}>
              Cancel
            </Text>
          </Pressable>

          <Pressable
            variant="plain"
            onPress={handleSave}
            disabled={isSaving || isLoading}
            style={[
              styles.saveBtn,
              { backgroundColor: '#0284c7', opacity: isSaving ? 0.7 : 1 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Wrench size={16} color="#ffffff" />
                <Text variant="label" style={{ color: '#ffffff' }}>
                  Save Assignments ({selectedMachineIds.length})
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: radiusNumeric.xl,
    borderTopRightRadius: radiusNumeric.xl,
    borderTopWidth: 1,
    maxHeight: 560,
    width: '100%',
  },
  notchWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  notch: {
    width: 36,
    height: 4,
    borderRadius: radiusNumeric.full,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  closeBtn: {
    padding: 6,
  },
  searchSection: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 4,
  },
  listScroll: {
    maxHeight: 320,
    paddingHorizontal: spacingNumeric.md,
  },
  listContent: {
    gap: 8,
    paddingVertical: 8,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 48,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: spacingNumeric.md,
    borderTopWidth: 1,
  },
  cancelBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radiusNumeric.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
