import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../ui/ThemeProvider';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';

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
  loadingLabel = 'Submitting Request...',
  missingCount = 0,
  missingFields,
  style,
}) => {
  const { isDark } = useTheme();
  const isExecutingRef = useRef(false);

  const handlePress = async () => {
    if (!isReady || isLoading || isExecutingRef.current) return;
    isExecutingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
      return `Please fill ${missingFields.length} required fields: ${missingFields.slice(0, 2).join(', ')}...`;
    }
    if (missingCount > 0) {
      return `Please complete all mandatory fields (${missingCount} remaining)`;
    }
    return 'Please complete all mandatory fields to proceed';
  }, [missingFields, missingCount]);

  return (
    <View style={[styles.container, style]}>
      {/* 1. Status Banner: Incomplete (Amber) or Ready (Emerald) matching web mobile viewport */}
      {!isReady && !isLoading && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <AlertCircle size={13} color="#d97706" style={{ marginTop: 1 }} />
            <Text
              style={[
                styles.bannerText,
                { color: isDark ? '#fbbf24' : '#b45309' },
              ]}
              numberOfLines={1}
            >
              {missingDescription}
            </Text>
          </View>
          <Text style={[styles.tagText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
            INCOMPLETE
          </Text>
        </View>
      )}

      {isReady && !isLoading && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <CheckCircle2 size={13} color="#10b981" style={{ marginTop: 1 }} />
            <Text
              style={[
                styles.bannerText,
                { color: isDark ? '#34d399' : '#047857' },
              ]}
              numberOfLines={1}
            >
              All mandatory fields completed. Ready to submit.
            </Text>
          </View>
          <Text style={[styles.tagText, { color: isDark ? '#34d399' : '#065f46' }]}>
            READY
          </Text>
        </View>
      )}

      {/* 2. Submit Button */}
      <TouchableOpacity
        onPress={handlePress}
        disabled={isLocked}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            backgroundColor: isReady
              ? '#0284c7'
              : isDark
              ? 'rgba(2, 132, 199, 0.35)'
              : '#7dd3fc',
          },
        ]}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.buttonText}>{loadingLabel}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  button: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
