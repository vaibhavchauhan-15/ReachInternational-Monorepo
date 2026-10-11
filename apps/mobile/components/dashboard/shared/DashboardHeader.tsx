import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { spacingNumeric } from '@reachinternational/design-tokens';

interface DashboardHeaderProps {
  userName: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  subtitle,
  actions,
}) => {
  const { theme } = useTheme();
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text variant="title" style={[styles.greetingText, { color: theme.colors.ink }]}>
          {greeting}, {userName}
        </Text>
        {subtitle ? (
          <Text variant="caption" style={[styles.subtitleText, { color: theme.colors.mute }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View style={styles.actionsContainer}>
          {actions}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.xs,
    marginBottom: spacingNumeric.sm + 4,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  greetingText: {
  },
  subtitleText: {
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flexShrink: 0,
  },
});

