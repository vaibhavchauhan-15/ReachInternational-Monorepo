import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Input } from '../ui/Input';
import { useTheme } from '../ui/ThemeProvider';
import { Lock } from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MobileSalaryFieldProps {
  value: string;
  onChangeText: (val: string) => void;
  role?: string;
  error?: string;
  readOnly?: boolean;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export const MobileSalaryField: React.FC<MobileSalaryFieldProps> = ({
  value,
  onChangeText,
  role,
  error,
  readOnly = false,
  label = 'Monthly Salary (₹)',
  helperText,
  disabled = false,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const isOperator = role === 'operator';
  const isMandatory = isOperator;

  if (readOnly) {
    const formattedSalary = value && !isNaN(Number(value))
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(Number(value))
      : 'Not configured';

    return (
      <View style={[styles.container, style]}>
        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
            {label}
          </Text>
          <View
            style={[
              styles.lockBadge,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f3f4f6',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Lock size={10} color={theme.colors.mute} />
            <Text style={[styles.lockBadgeText, { color: theme.colors.mute }]}>
              Managed by HR / Admin
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.readOnlyBox,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f9fafb',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <Text style={[styles.readOnlyText, { color: theme.colors.ink }]}>
            {formattedSalary}
          </Text>
        </View>

        <Text style={[styles.helperText, { color: theme.colors.mute }]}>
          Monthly salary compensation is determined and managed by administrative operations.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Input
        label={`${label} ${isMandatory ? '*' : ''}`}
        placeholder="e.g. 25000"
        value={value}
        onChangeText={(val) => {
          // Allow only numeric digits
          const cleaned = val.replace(/[^0-9]/g, '');
          onChangeText(cleaned);
        }}
        keyboardType="number-pad"
        error={error}
        editable={!disabled}
        required={isMandatory}
        leftIcon={
          <Text
            style={[
              styles.currencyPrefix,
              {
                color: isMandatory ? '#0070f3' : theme.colors.mute,
              },
            ]}
          >
            ₹
          </Text>
        }
      />

      <Text style={[styles.helperText, { color: theme.colors.mute }]}>
        {helperText ||
          (isOperator
            ? 'Mandatory compensation rate for active machine operator deployment.'
            : 'Configured monthly payroll compensation (Optional).')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  readOnlyBox: {
    minHeight: 46,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  readOnlyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    paddingLeft: 4,
  },
  helperText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    paddingHorizontal: 2,
  },
});
