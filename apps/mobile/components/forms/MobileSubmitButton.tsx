import React, { useRef } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { useTheme } from '../ui/ThemeProvider';
import { AlertCircle, CheckCircle2 } from '../ui/icon';
import { haptics } from '../../lib/haptics';

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
    haptics.light();
    try {
      await onPress();
    } finally {
      isExecutingRef.current = false;
    }
  };

  const isLocked = !isReady || isLoading;

  const missingDescription = React.useMemo(() => {
    if (missingCount > 0) {
      if (missingFields && missingFields.length > 0 && missingFields.length <= 2) {
        return `Required: ${missingFields.join(', ')}`;
      }
      return `${missingCount} required ${missingCount === 1 ? 'field' : 'fields'} remaining`;
    }
    if (missingFields && missingFields.length > 0) {
      return `Required: ${missingFields.slice(0, 2).join(', ')}`;
    }
    return 'Complete all required fields';
  }, [missingFields, missingCount]);

  return (
    <View style={[styles.container, style]}>
      {/* 1. Status Banner: Incomplete (Amber) or Ready (Emerald) with 100% solid opacity */}
      {!isReady && !isLoading && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isDark ? '#451a03' : '#fef3c7',
              borderColor: isDark ? '#78350f' : '#fcd34d',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <AlertCircle size={14} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginTop: 1 }} />
            <Text
              variant="caption"
              weight="medium"
              style={[
                styles.bannerText,
                { color: isDark ? '#fef3c7' : '#92400e' },
              ]}
              numberOfLines={1}
            >
              {missingDescription}
            </Text>
          </View>
          <Badge
            variant="warning"
            solid
            size="sm"
            shape="pill"
            label="INCOMPLETE"
          />
        </View>
      )}

      {isReady && !isLoading && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
              borderColor: isDark ? '#047857' : '#a7f3d0',
            },
          ]}
        >
          <View style={styles.bannerLeft}>
            <CheckCircle2 size={14} color={isDark ? '#34d399' : '#10b981'} style={{ marginTop: 1 }} />
            <Text
              variant="caption"
              weight="medium"
              style={[
                styles.bannerText,
                { color: isDark ? '#ecfdf5' : '#065f46' },
              ]}
              numberOfLines={1}
            >
              All fields complete • Ready to submit
            </Text>
          </View>
          <Badge
            variant="success"
            solid
            size="sm"
            shape="pill"
            label="READY"
          />
        </View>
      )}

      {/* 2. Submit Button backed by RNR Button */}
      <Button
        variant="default"
        size="lg"
        fullWidth
        label={isLoading ? loadingLabel : label}
        isLoading={isLoading}
        disabled={isLocked}
        onPress={handlePress}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bannerText: {
    flex: 1,
  },
});
