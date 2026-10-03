import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Input } from '../ui/Input';
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect';
import { useTheme } from '../ui/ThemeProvider';
import { INDIAN_STATES } from '@reachinternational/utils';
import { MapPin } from 'lucide-react-native';

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
  const { isDark } = useTheme();

  // Canonical Indian states mapped to SelectOption
  const stateOptions = useMemo<SelectOption[]>(() => {
    return INDIAN_STATES.map((s) => ({
      value: String(s.id),
      label: s.name,
    }));
  }, []);

  // Determine current active state value
  const currentStateValue = useMemo(() => {
    if (stateId !== null && stateId !== undefined && String(stateId).trim() !== '') {
      return String(stateId);
    }
    if (stateName && stateName.trim()) {
      const match = INDIAN_STATES.find(
        (s) => s.name.toLowerCase() === stateName.trim().toLowerCase()
      );
      if (match) return String(match.id);
    }
    return '';
  }, [stateId, stateName]);

  const iconColor = isDark ? '#737373' : '#9ca3af';

  return (
    <View style={[styles.container, style]}>
      {/* 1. Street Address */}
      <Input
        label="Street / Building / Locality Address"
        placeholder="e.g. Plot No. 42, MIDC Industrial Area, Chakan"
        value={street}
        onChangeText={onStreetChange}
        editable={!disabled}
        required={required}
        error={errors.street}
        leftIcon={<MapPin size={16} color={iconColor} />}
      />

      {/* 2. City / Town / Village */}
      <Input
        label="City / Town / Village"
        placeholder="e.g. Pune"
        value={city}
        onChangeText={onCityChange}
        editable={!disabled}
        required={required}
        error={errors.city}
        leftIcon={<MapPin size={16} color={iconColor} />}
      />

      {/* 3. District */}
      <Input
        label="District"
        placeholder="e.g. Pune"
        value={district}
        onChangeText={onDistrictChange}
        editable={!disabled}
        required={required}
        error={errors.district}
        leftIcon={<MapPin size={16} color={iconColor} />}
      />

      {/* 4. State Selector using SearchableSelect Dropdown (replaces dialogue box) */}
      <SearchableSelect
        label="State"
        required={required}
        options={stateOptions}
        value={currentStateValue}
        onChange={(val, opt) => {
          const matched = INDIAN_STATES.find((s) => String(s.id) === val);
          if (matched) {
            onStateChange(matched.id, matched.name);
          } else if (opt) {
            onStateChange(Number(val) || 0, opt.label);
          }
        }}
        placeholder="Select state..."
        leftIcon={<MapPin size={16} color={iconColor} />}
        error={errors.state}
        disabled={disabled}
        searchable
        searchPlaceholder="Search state name..."
        presentation="dropdown"
        containerStyle={{ zIndex: 100 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
});
