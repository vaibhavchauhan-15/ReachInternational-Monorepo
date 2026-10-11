import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';

export interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
}

export function SettingsSection({
  title,
  description,
  children,
  style,
  cardStyle,
}: SettingsSectionProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionContainer, style]}>
      {title ? (
        <View style={styles.headerBox}>
          <Text
            variant="label"
            style={[styles.title, { color: theme.colors.mute }]}
          >
            {title.toUpperCase()}
          </Text>
          {description ? (
            <Text
              variant="caption"
              style={[styles.description, { color: theme.colors.mute }]}
            >
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Card
        variant="elevated"
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
          cardStyle,
        ]}
      >
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    gap: 8,
  },
  headerBox: {
    paddingHorizontal: 4,
    gap: 2,
  },
  title: {
  },
  description: {
    marginTop: 1,
  },
  card: {
    padding: 0,
    borderRadius: radiusNumeric.lg,
    overflow: 'hidden',
  },
});
