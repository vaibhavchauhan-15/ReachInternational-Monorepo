import React, { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../ui/ThemeProvider';
import { MobileHeader } from '../ui/MobileHeader';
import { spacingNumeric } from '@reachinternational/design-tokens';

export interface SettingsScreenContainerProps {
  title: string;
  showBack?: boolean;
  backRoute?: string;
  onPressBack?: () => void;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerRight?: React.ReactNode;
}

export function SettingsScreenContainer({
  title,
  showBack = true,
  backRoute,
  onPressBack,
  children,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  headerRight,
}: SettingsScreenContainerProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const handleBack = useCallback(() => {
    if (onPressBack) {
      onPressBack();
      return;
    }
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    if (backRoute) {
      router.replace(backRoute as any);
      return;
    }
    router.replace('/settings' as any);
  }, [onPressBack, backRoute, router]);

  // Intercept Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!showBack) return;

    const onHardwareBack = () => {
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBack
    );
    return () => subscription.remove();
  }, [showBack, handleBack]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title={title}
        showBack={showBack}
        backRoute={backRoute}
        onPressBack={handleBack}
        showQuickAccess={!showBack}
        showQuickAccessCapsule={false}
        rightAction={headerRight}
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.link}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 96,
  },
});
