import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface MobileSubmitButtonProps {
  isReady: boolean;
  isLoading: boolean;
  onPress: () => void | Promise<any>;
  label: string;
  loadingLabel?: string;
  missingCount?: number;
  missingFields?: string[];
  helperText?: string;
  style?: ViewStyle;
}

export const MobileSubmitButton: React.FC<MobileSubmitButtonProps> = ({
  isReady,
  isLoading,
  onPress,
  label,
  loadingLabel = 'Submitting...',
  missingCount = 0,
  missingFields,
  helperText,
  style,
}) => {
  const { theme, isDark } = useTheme();
  const isExecutingRef = useRef(false);

  const handlePress = async () => {
    if (!isReady || isLoading || isExecutingRef.current) return;
    isExecutingRef.current = true;
    try {
      await onPress();
    } finally {
      isExecutingRef.current = false;
    }
  };

  const isLocked = !isReady || isLoading;

  const missingDescription = React.useMemo(() => {
    if (missingFields && missingFields.length > 0) {
      if (missingFields.length <= 2) {
        return `Please fill: ${missingFields.join(', ')}`;
      }
      return `Fill ${missingFields.length} fields: ${missingFields.slice(0, 2).join(', ')} +${missingFields.length - 2} more`;
    }
    if (missingCount > 0) {
      return `${missingCount} mandatory ${missingCount === 1 ? 'field' : 'fields'} required to proceed`;
    }
    return 'Complete all mandatory fields to unlock submission';
  }, [missingFields, missingCount]);

  return (
    <View style={[styles.container, style]}>
      {/* Helper Status Chip if Incomplete */}
      {!isReady && !isLoading && (
        <View
          style={[
            styles.incompleteChip,
            {
              backgroundColor: isDark ? 'rgba(244, 63, 94, 0.08)' : '#fff1f2',
              borderColor: isDark ? 'rgba(244, 63, 94, 0.2)' : '#fecdd3',
            },
          ]}
        >
          <Lock size={12} color="#f43f5e" />
          <Text style={styles.incompleteChipText} numberOfLines={1}>
            {missingDescription}
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLocked}
        activeOpacity={isReady ? 0.8 : 1}
        style={[
          styles.button,
          {
            backgroundColor: isReady
              ? '#0070f3'
              : isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : '#e5e7eb',
            borderColor: isReady
              ? '#0070f3'
              : isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : '#d1d5db',
            opacity: isLoading ? 0.8 : isReady ? 1 : 0.6,
          },
        ]}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        ) : (
          <View style={styles.contentRow}>
            <Text
              style={[
                styles.buttonText,
                {
                  color: isReady
                    ? '#ffffff'
                    : isDark
                    ? theme.colors.mute
                    : '#9ca3af',
                },
              ]}
            >
              {label}
            </Text>
            {isReady ? (
              <ArrowRight size={16} color="#ffffff" strokeWidth={2.5} />
            ) : (
              <Lock size={14} color={isDark ? theme.colors.mute : '#9ca3af'} />
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Optional Success Note or Helper Text */}
      {isReady && !isLoading && (
        <View style={styles.readyRow}>
          <CheckCircle2 size={12} color="#10b981" />
          <Text style={styles.readyText}>
            {helperText || 'All mandatory requirements satisfied. Ready to submit.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  incompleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  incompleteChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f43f5e',
  },
  button: {
    minHeight: 48,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacingNumeric.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  readyText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500',
  },
});
