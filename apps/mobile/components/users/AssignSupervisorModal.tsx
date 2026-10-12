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
import { User, ShieldCheck, Check, X } from '../ui/icon';
import type { UserRecord } from './UserDetailModal';

export interface AssignSupervisorModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: () => void;
}

interface SupervisorItem {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
}

export const AssignSupervisorModal: React.FC<AssignSupervisorModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setSelectedId(user.supervisor_id || (user.supervisors?.[0]?.id ?? null));
      setSearch('');
      loadSupervisors();
    }
  }, [visible, user]);

  const loadSupervisors = async () => {
    setIsLoading(true);
    try {
      // First try RPC get_active_supervisors_public
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_active_supervisors_public');
      if (!rpcErr && rpcData && Array.isArray(rpcData)) {
        setSupervisors(rpcData as SupervisorItem[]);
        return;
      }

      // Fallback: direct query
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, role')
        .in('role', ['supervisor', 'manager', 'admin', 'super_admin'])
        .eq('status', 'active')
        .order('full_name', { ascending: true });

      if (error) throw error;
      if (data) {
        setSupervisors(data as SupervisorItem[]);
      }
    } catch (err: any) {
      console.warn('Failed to load supervisors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSupervisors = useMemo(() => {
    if (!search.trim()) return supervisors;
    const q = search.trim().toLowerCase();
    return supervisors.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
    );
  }, [supervisors, search]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error: userErr } = await supabase
        .from('users')
        .update({
          supervisor_id: selectedId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (userErr) throw userErr;

      // Sync user_supervisors junction table
      if (selectedId) {
        try {
          await supabase
            .from('user_supervisors')
            .upsert(
              { user_id: user.id, supervisor_id: selectedId },
              { onConflict: 'user_id,supervisor_id' }
            );
        } catch {
          // ignore junction fallback
        }
      } else {
        try {
          await supabase
            .from('user_supervisors')
            .delete()
            .eq('user_id', user.id);
        } catch {
          // ignore junction fallback
        }
      }

      const assignedName = supervisors.find((s) => s.id === selectedId)?.full_name;
      haptics.confirm();
      showToast(
        'success',
        'Supervisor Assigned',
        selectedId
          ? `Assigned ${assignedName || 'supervisor'} to ${user.full_name}.`
          : `Removed supervisor from ${user.full_name}.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      haptics.reject();
      showToast('error', 'Update Failed', err?.message || 'Failed to update supervisor assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <AppModal visible={visible} onClose={onClose} variant="bottom" testID="assign-supervisor-modal">
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
            <View style={[styles.iconCircle, { backgroundColor: '#0d948818' }]}>
              <ShieldCheck size={18} color="#0d9488" />
            </View>
            <View style={styles.headerTitles}>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Assign Supervisor
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                {user ? `Select supervisor for ${user.full_name}` : 'Select supervisor'}
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
            placeholder="Search supervisors by name or email..."
          />
        </View>

        {/* Supervisor List */}
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.link} />
              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Loading available supervisors...
              </Text>
            </View>
          ) : (
            <>
              {/* Option: Unassigned */}
              <Pressable
                variant="plain"
                haptic={false}
                onPress={() => {
                  haptics.select();
                  setSelectedId(null);
                }}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: selectedId === null ? theme.colors.canvas : 'transparent',
                    borderColor: selectedId === null ? theme.colors.link : theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                    ]}
                  >
                    <User size={16} color={theme.colors.mute} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text
                      variant="label"
                      style={{ color: selectedId === null ? theme.colors.link : theme.colors.ink }}
                    >
                      None (Unassigned)
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      Remove current supervisor assignment
                    </Text>
                  </View>
                </View>
                {selectedId === null && (
                  <View style={[styles.checkCircle, { backgroundColor: theme.colors.link }]}>
                    <Check size={12} color="#ffffff" />
                  </View>
                )}
              </Pressable>

              {/* List of Supervisors */}
              {filteredSupervisors.map((s) => {
                const isSelected = selectedId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    variant="plain"
                    haptic={false}
                    onPress={() => {
                      haptics.select();
                      setSelectedId(s.id);
                    }}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: isSelected ? theme.colors.canvas : 'transparent',
                        borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: isSelected ? theme.colors.ink : theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={{
                            color: isSelected ? theme.colors.canvas : theme.colors.ink,
                          }}
                        >
                          {s.full_name ? s.full_name[0].toUpperCase() : 'S'}
                        </Text>
                      </View>
                      <View style={styles.optionTextContainer}>
                        <View style={styles.nameRow}>
                          <Text
                            variant="label"
                            style={{ color: isSelected ? theme.colors.link : theme.colors.ink }}
                          >
                            {s.full_name}
                          </Text>
                          <Badge variant="neutral" size="sm">
                            <Text variant="micro" style={{ color: '#0d9488' }}>
                              {s.role ? s.role.replace(/_/g, ' ').toUpperCase() : 'SUPERVISOR'}
                            </Text>
                          </Badge>
                        </View>
                        {s.email ? (
                          <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
                            {s.email}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: theme.colors.link }]}>
                        <Check size={12} color="#ffffff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {filteredSupervisors.length === 0 && !isLoading && (
                <View style={styles.emptyBox}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    No supervisors found matching "{search}".
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
              { backgroundColor: theme.colors.link, opacity: isSaving ? 0.7 : 1 },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <ShieldCheck size={16} color="#ffffff" />
                <Text variant="label" style={{ color: '#ffffff' }}>
                  Save Assignment
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
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
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
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
