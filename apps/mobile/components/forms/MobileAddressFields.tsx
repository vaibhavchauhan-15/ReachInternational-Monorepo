import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Platform,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../ui/Input';
import { useTheme } from '../ui/ThemeProvider';
import {
  INDIAN_STATES,
  getStateById,
  getStateByName,
} from '@reachinternational/utils';
import { MapPin, ChevronDown, Search, X, Check } from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MobileAddressFieldsProps {
  street: string;
  city: string;
  district: string;
  stateName: string;
  stateId?: string | number | null;
  onStreetChange: (val: string) => void;
  onCityChange: (val: string) => void;
  onDistrictChange: (val: string) => void;
  onStateChange: (stateId: number, stateName: string) => void;
  errors?: {
    street?: string;
    city?: string;
    district?: string;
    state?: string;
  };
  required?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  idPrefix?: string;
}

export const MobileAddressFields: React.FC<MobileAddressFieldsProps> = ({
  street,
  city,
  district,
  stateName,
  stateId,
  onStreetChange,
  onCityChange,
  onDistrictChange,
  onStateChange,
  errors = {},
  required = true,
  disabled = false,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine current active state name
  const currentDisplayName = useMemo(() => {
    if (stateName && stateName.trim()) return stateName;
    if (stateId) {
      const match = getStateById(stateId);
      if (match) return match.name;
    }
    return '';
  }, [stateName, stateId]);

  const filteredStates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return INDIAN_STATES;
    return INDIAN_STATES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.id).includes(q)
    );
  }, [searchQuery]);

  const handleSelectState = (item: (typeof INDIAN_STATES)[0]) => {
    onStateChange(item.id, item.name);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={[styles.container, style]}>
      {/* 1. Street Address */}
      <Input
        label="Street Address"
        placeholder="e.g. Plot 42, MIDC Ind Area"
        value={street}
        onChangeText={onStreetChange}
        editable={!disabled}
        error={errors.street}
        leftIcon={<MapPin size={16} color={theme.colors.mute} />}
      />

      {/* 2. City / Town / Village */}
      <Input
        label={`City / Town / Village ${required ? '*' : ''}`}
        placeholder="e.g. Pune"
        value={city}
        onChangeText={onCityChange}
        editable={!disabled}
        required={required}
        error={errors.city}
        leftIcon={<MapPin size={16} color="#10b981" />}
      />

      {/* 3. District */}
      <Input
        label={`District ${required ? '*' : ''}`}
        placeholder="e.g. Pune"
        value={district}
        onChangeText={onDistrictChange}
        editable={!disabled}
        required={required}
        error={errors.district}
        leftIcon={<MapPin size={16} color="#10b981" />}
      />

      {/* 4. State Selector */}
      <View style={styles.stateContainer}>
        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
          State {required && <Text style={{ color: '#f43f5e', fontWeight: '700' }}>*</Text>}
        </Text>

        <TouchableOpacity
          onPress={() => {
            if (!disabled) {
              setSearchQuery('');
              setModalVisible(true);
            }
          }}
          activeOpacity={0.7}
          disabled={disabled}
          style={[
            styles.stateTrigger,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
              borderColor: errors.state ? '#f43f5e' : theme.colors.hairline,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
        >
          <View style={styles.triggerInner}>
            <MapPin size={16} color={currentDisplayName ? '#0070f3' : theme.colors.mute} />
            <Text
              style={[
                styles.stateTriggerText,
                { color: currentDisplayName ? theme.colors.ink : theme.colors.mute },
              ]}
              numberOfLines={1}
            >
              {currentDisplayName || 'Select state or union territory...'}
            </Text>
          </View>
          <ChevronDown size={16} color={theme.colors.mute} />
        </TouchableOpacity>

        {errors.state ? (
          <Text style={styles.errorText}>{errors.state}</Text>
        ) : null}
      </View>

      {/* State Picker Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            { backgroundColor: isDark ? '#000000' : '#fafafa' },
          ]}
        >
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: isDark ? '#111111' : '#ffffff',
                borderBottomColor: theme.colors.hairline,
              },
            ]}
          >
            <View>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                Select State
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.colors.mute }]}>
                Choose official state / union territory
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6',
                },
              ]}
            >
              <X size={18} color={theme.colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? '#111111' : '#ffffff',
                borderBottomColor: theme.colors.hairline,
              },
            ]}
          >
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? '#1a1a1a' : '#f4f4f5',
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Search size={16} color={theme.colors.mute} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.ink }]}
                placeholder="Search state, code, or GST TIN..."
                placeholderTextColor={theme.colors.mute}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={false}
                clearButtonMode="while-editing"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={14} color={theme.colors.mute} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* List of States */}
          <FlatList
            data={filteredStates}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected =
                currentDisplayName.toLowerCase() === item.name.toLowerCase() ||
                Number(stateId) === item.id;
              return (
                <TouchableOpacity
                  onPress={() => handleSelectState(item)}
                  activeOpacity={0.7}
                  style={[
                    styles.stateItem,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(0, 112, 243, 0.15)'
                          : '#eff6ff'
                        : isDark
                        ? '#111111'
                        : '#ffffff',
                      borderColor: isSelected ? '#0070f3' : theme.colors.hairline,
                    },
                  ]}
                >
                  <View style={styles.stateItemInfo}>
                    <Text
                      style={[
                        styles.stateItemName,
                        {
                          color: isSelected ? '#0070f3' : theme.colors.ink,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.stateItemCode, { color: theme.colors.mute }]}>
                      State ID: {item.id}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkedCircle}>
                      <Check size={14} color="#ffffff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingNumeric.sm,
  },
  stateContainer: {
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  stateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  stateTriggerText: {
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    color: '#f43f5e',
    marginTop: 4,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  stateItemInfo: {
    flex: 1,
  },
  stateItemName: {
    fontSize: 14,
  },
  stateItemCode: {
    fontSize: 11,
    marginTop: 2,
  },
  checkedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0070f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
