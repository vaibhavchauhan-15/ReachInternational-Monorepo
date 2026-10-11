import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { MobileHeader } from '../ui/MobileHeader';
import { spacingNumeric } from '@reachinternational/design-tokens';

export interface SettingsScreenContainerProps {
  title: string;
  showBack?: boolean;
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
  onPressBack,
  children,
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  headerRight,
}: SettingsScreenContainerProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title={title}
        showBack={showBack}
        onPressBack={onPressBack}
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
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 96,
  },
});
