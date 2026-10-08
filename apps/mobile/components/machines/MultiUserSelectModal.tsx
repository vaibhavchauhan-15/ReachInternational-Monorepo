import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text, useTypeStyle } from '../ui/Text';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X, Search, UserCheck, Clock } from '../ui/icon';

export interface SelectableUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  shift_time?: string | null;
  role?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
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
  const bodyTypeStyle = useTypeStyle('body');
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
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      testID="multi-user-select-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ width: '100%' }}
      >
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
              <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
              <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
                {selectedIds.length} {roleLabel} assigned
              </Text>
            </View>
            <Touchable
              preset="icon"
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
            >
              <X size={16} color={theme.colors.mute} />
            </Touchable>
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
                style={[styles.searchInput, bodyTypeStyle, { color: theme.colors.ink }]}
                placeholder={`Search ${roleLabel} by name, phone...`}
                placeholderTextColor={theme.colors.mute}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Touchable preset="icon" onPress={() => setSearch('')}>
                  <X size={14} color={theme.colors.mute} />
                </Touchable>
              )}
            </View>
          </View>

          {/* Selected Chips Strip */}
          {selectedIds.length > 0 && (
            <View style={[styles.chipsContainer, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.chipsHeader}>
                <Text variant="caption" style={[styles.chipsLabel, { color: theme.colors.mute }]}>Selected:</Text>
                <Touchable preset="button" onPress={() => { haptics.select(); clearAll(); }}>
                  <Text variant="caption" style={[styles.clearBtnText, { color: theme.colors.error }]}>Clear All</Text>
                </Touchable>
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
                      <Text variant="caption" style={[styles.chipText, { color: theme.colors.ink }]}>
                        {u.full_name}
                      </Text>
                      <Pressable
                        variant="iconButton"
                        haptic="tap"
                        hitSlopToMin48
                        onPress={() => removeUser(id)}
                        accessibilityLabel={`Remove ${u.full_name}`}
                      >
                        <X size={12} color={theme.colors.mute} />
                      </Pressable>
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
                <Text variant="caption" style={[styles.emptyText, { color: theme.colors.mute }]}>
                  No {roleLabel} found matching &quot;{search}&quot;.
                </Text>
              </View>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <Pressable
                    key={u.id}
                    variant="listRow"
                    haptic="select"
                    onPress={() => toggleUser(u.id)}
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
                        <Text variant="subheading" style={[styles.userName, { color: theme.colors.ink }]}>
                          {u.full_name}
                        </Text>
                        <View style={styles.userMeta}>
                          {u.shift_time && (
                            <View style={styles.shiftTag}>
                              <Clock size={10} color={theme.colors.success} />
                              <Text variant="mono" style={[styles.shiftText, { color: theme.colors.success }]}>
                                {u.shift_time}
                              </Text>
                            </View>
                          )}
                          {u.phone && (
                            <Text variant="caption" style={[styles.phoneText, { color: theme.colors.mute }]}>
                              {u.phone}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Pressable
              variant="outline"
              haptic="tap"
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
            >
              <Text variant="label" style={[styles.cancelBtnText, { color: theme.colors.ink }]}>Cancel</Text>
            </Pressable>

            <Touchable
              preset="button"
              onPress={() => {
                haptics.confirm();
                handleSave();
              }}
              style={[styles.confirmBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Text variant="label" style={[styles.confirmBtnText, { color: theme.colors.onPrimary }]}>
                Done ({selectedIds.length})
              </Text>
            </Touchable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
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
  title: {},
  subtitle: {
    marginTop: 2,
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
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
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
    textTransform: 'uppercase',
  },
  clearBtnText: {},
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
  chipText: {},
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
  userName: {},
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
  shiftText: {},
  phoneText: {},
  emptyWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
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
  cancelBtnText: {},
  confirmBtn: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
    minWidth: 120,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmBtnText: {},
});
