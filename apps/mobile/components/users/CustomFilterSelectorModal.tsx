import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { INDIAN_STATES } from '@reachinternational/utils';
import { Check, X, Search } from 'lucide-react-native';

export type FilterModalType = 'role' | 'status' | 'state' | 'kyc' | 'joined' | 'sort';

export interface FilterOption {
  id: string;
  label: string;
  dotColor?: string;
  activeColor?: string;
}

export interface CustomFilterSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  filterType?: FilterModalType;
  title?: string;
  options?: FilterOption[];
  selectedValue?: string;
  currentValue?: string;
  onSelect: (value: string) => void;
  enableSearch?: boolean;
}

const PRESET_ROLES: FilterOption[] = [
  { id: 'all', label: 'All Roles' },
  { id: 'super_admin', label: 'Super Admin', dotColor: '#ef4444' },
  { id: 'admin', label: 'Admin', dotColor: '#f59e0b' },
  { id: 'manager', label: 'Manager', dotColor: '#6366f1' },
  { id: 'service_manager', label: 'Service Manager', dotColor: '#0284c7' },
  { id: 'service_engineer', label: 'Service Engineer', dotColor: '#2563eb' },
  { id: 'supervisor', label: 'Supervisor', dotColor: '#0d9488' },
  { id: 'store_manager', label: 'Store Manager', dotColor: '#9333ea' },
  { id: 'operator', label: 'Operator', dotColor: '#d97706' },
  { id: 'mechanic', label: 'Mechanic', dotColor: '#ea580c' },
  { id: 'hr_manager', label: 'HR Manager', dotColor: '#059669' },
];

const PRESET_STATUSES: FilterOption[] = [
  { id: 'all', label: 'All Statuses' },
  { id: 'active', label: 'Active', dotColor: '#10b981' },
  { id: 'inactive', label: 'Inactive', dotColor: '#94a3b8' },
  { id: 'pending', label: 'Pending Approval', dotColor: '#f59e0b' },
];

const PRESET_KYC: FilterOption[] = [
  { id: 'all', label: 'All KYC Statuses' },
  { id: 'verified', label: 'Aadhaar Verified', dotColor: '#10b981' },
  { id: 'unverified', label: 'Unverified (Missing Aadhaar)', dotColor: '#f59e0b' },
];

const PRESET_JOINED: FilterOption[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Joined Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
];

const PRESET_SORT: FilterOption[] = [
  { id: 'newest', label: 'Newest First (Default)' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'name_asc', label: 'Name (A to Z)' },
  { id: 'name_desc', label: 'Name (Z to A)' },
  { id: 'role', label: 'Role (A to Z)' },
];

const PRESET_STATES: FilterOption[] = [
  { id: 'all', label: 'All States' },
  ...INDIAN_STATES.map((s) => ({
    id: s.name,
    label: s.name,
  })),
];

export const CustomFilterSelectorModal: React.FC<CustomFilterSelectorModalProps> = ({
  visible,
  onClose,
  filterType,
  title: customTitle,
  options: customOptions,
  selectedValue,
  currentValue,
  onSelect,
  enableSearch: customEnableSearch,
}) => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const activeValue = selectedValue ?? currentValue ?? 'all';

  let title = customTitle || 'Select Filter';
  let options = customOptions || [];
  let shouldEnableSearch = customEnableSearch || false;

  if (filterType) {
    switch (filterType) {
      case 'role':
        title = 'Filter by Role';
        options = PRESET_ROLES;
        break;
      case 'status':
        title = 'Filter by Status';
        options = PRESET_STATUSES;
        break;
      case 'state':
        title = 'Filter by State';
        options = PRESET_STATES;
        shouldEnableSearch = true;
        break;
      case 'kyc':
        title = 'Filter by KYC';
        options = PRESET_KYC;
        break;
      case 'joined':
        title = 'Filter by Joined Date';
        options = PRESET_JOINED;
        break;
      case 'sort':
        title = 'Sort Users Directory';
        options = PRESET_SORT;
        break;
    }
  }

  const filteredOptions = useMemo(() => {
    if (!shouldEnableSearch || !searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, shouldEnableSearch, searchTerm]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
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
                <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              {shouldEnableSearch && options.length > 6 && (
                <View
                  style={[
                    styles.searchWrap,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  <Search size={14} color={theme.colors.mute} />
                  <TextInput
                    placeholder="Search options..."
                    placeholderTextColor={theme.colors.mute}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    style={[styles.searchInput, { color: theme.colors.ink }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchTerm.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchTerm('')}>
                      <X size={14} color={theme.colors.mute} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Options List */}
              <ScrollView
                style={styles.optionsList}
                showsVerticalScrollIndicator={false}
              >
                {filteredOptions.map((opt) => {
                  const isSelected = opt.id === activeValue;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => {
                        onSelect(opt.id);
                        onClose();
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.ink
                            : theme.colors.canvasElevated,
                          borderColor: isSelected
                            ? theme.colors.ink
                            : theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={styles.optionLeft}>
                        {opt.dotColor && (
                          <View
                            style={[
                              styles.dot,
                              {
                                backgroundColor: isSelected ? theme.colors.canvas : opt.dotColor,
                              },
                            ]}
                          />
                        )}
                        <Text
                          style={[
                            styles.optionLabel,
                            {
                              color: isSelected ? theme.colors.canvas : theme.colors.ink,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>

                      {isSelected && (
                        <Check size={16} color={theme.colors.canvas} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: theme.colors.mute }]}>
                      No matching options
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  optionsList: {
    padding: spacingNumeric.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    marginBottom: spacingNumeric.xs,
    minHeight: 44,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  optionLabel: {
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
});
