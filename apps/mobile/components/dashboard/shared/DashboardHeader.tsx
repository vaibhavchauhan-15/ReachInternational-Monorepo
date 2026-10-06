import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../ui/ThemeProvider';
import { Text } from '../../ui/Text';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Calendar } from 'lucide-react-native';

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

function formatDate(): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  subtitle,
  actions,
}) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const greeting = getGreeting();
  const dateStr = formatDate();

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.hairline }]}>
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
      <View style={styles.actionsContainer}>
        {isWide ? (
          <View
            style={[
              styles.dateBadge,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Calendar size={13} color={theme.colors.mute} />
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              {dateStr}
            </Text>
          </View>
        ) : null}
        {actions}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacingNumeric.sm + 4,
    marginBottom: spacingNumeric.md,
    borderBottomWidth: 1,
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
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
});

