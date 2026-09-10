import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X, Search, UserCheck, Clock } from 'lucide-react-native';

export interface SelectableUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  shift_time?: string | null;
}

export interface MultiUserSelectModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  users: SelectableUser[];
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  roleLabel?: string;
}

export const MultiUserSelectModal: React.FC<MultiUserSelectModalProps> = ({
  visible,
  onClose,
  title,
  users,
  selectedIds: initialSelectedIds,
  onConfirm,
  roleLabel = 'personnel',
}) => {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [search, setSearch] = useState('');

  // Sync state on open
  React.useEffect(() => {
    if (visible) {
      setSelectedIds(initialSelectedIds);
      setSearch('');
    }
  }, [visible, initialSelectedIds]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const removeUser = (id: string) => {
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.shift_time?.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const handleSave = () => {
    onConfirm(selectedIds);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View>
              <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                {selectedIds.length} {roleLabel} assigned
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { borderBottomColor: theme.colors.hairline }]}>
            <View
              style={[
                styles.searchInputWrap,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Search size={14} color={theme.colors.mute} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.ink }]}
                placeholder={`Search ${roleLabel} by name, phone...`}
                placeholderTextColor={theme.colors.mute}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={14} color={theme.colors.mute} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Selected Chips Strip */}
          {selectedIds.length > 0 && (
            <View style={[styles.chipsContainer, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.chipsHeader}>
                <Text style={[styles.chipsLabel, { color: theme.colors.mute }]}>Selected:</Text>
                <TouchableOpacity onPress={clearAll}>
                  <Text style={[styles.clearBtnText, { color: theme.colors.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {selectedIds.map((id) => {
                  const u = users.find((item) => item.id === id);
                  if (!u) return null;
                  return (
                    <View
                      key={id}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: theme.colors.ink }]}>
                        {u.full_name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeUser(id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={12} color={theme.colors.mute} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* User List */}
          <ScrollView
            style={styles.userList}
            contentContainerStyle={styles.userListContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: theme.colors.mute }]}>
                  No {roleLabel} found matching &quot;{search}&quot;.
                </Text>
              </View>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => toggleUser(u.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.userRow,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary + '12'
                          : theme.colors.canvas,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.userLeft}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.primary
                              : 'transparent',
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.hairline,
                          },
                        ]}
                      >
                        {isSelected && (
                          <Check size={12} color={theme.colors.onPrimary} strokeWidth={3} />
                        )}
                      </View>

                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.colors.ink }]}>
                          {u.full_name}
                        </Text>
                        <View style={styles.userMeta}>
                          {u.shift_time && (
                            <View style={styles.shiftTag}>
                              <Clock size={10} color={theme.colors.success} />
                              <Text style={[styles.shiftText, { color: theme.colors.success }]}>
                                {u.shift_time}
                              </Text>
                            </View>
                          )}
                          {u.phone && (
                            <Text style={[styles.phoneText, { color: theme.colors.mute }]}>
                              {u.phone}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.colors.ink }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.confirmBtn, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmBtnText, { color: theme.colors.onPrimary }]}>
                Done ({selectedIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    maxHeight: '85%',
    minHeight: 440,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  chipsContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
  },
  chipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chipsLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipsScroll: {
    gap: spacingNumeric.xs,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userList: {
    flex: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  userListContent: {
    paddingVertical: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    minHeight: 52,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    marginTop: 2,
  },
  shiftTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  shiftText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  phoneText: {
    fontSize: 11,
  },
  emptyWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
    minWidth: 120,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
