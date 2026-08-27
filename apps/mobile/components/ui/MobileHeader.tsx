import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme } from './ThemeProvider';
import { Badge } from './Badge';
import { Sun, Moon, Menu } from 'lucide-react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useDrawer } from '../../lib/nav/DrawerContext';

export interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  onPressMenu?: () => void;
  rightAction?: React.ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  onPressMenu,
  rightAction,
}) => {
  const { role } = useAuth();
  const { theme, isDark, setMode } = useTheme();
  const { openDrawer } = useDrawer();
  const router = useRouter();

  const handleMenuPress = onPressMenu || openDrawer;

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
      {/* Top Branding Strip */}
      <View style={styles.topRow}>
        {/* Left Hamburger Menu Button */}
        <View style={styles.leftBrandContainer}>
          <TouchableOpacity
            onPress={handleMenuPress}
            activeOpacity={0.7}
            style={[styles.menuBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
          >
            <Menu size={18} color={theme.colors.ink} />
          </TouchableOpacity>

          {/* Brand Emblem & Logo */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/machines')}
            activeOpacity={0.8}
            style={styles.brandContainer}
          >
            <View style={[styles.logoEmblem, { backgroundColor: theme.colors.ink }]}>
              <Text style={[styles.logoLetter, { color: theme.colors.canvas }]}>R</Text>
            </View>
            <View>
              <Text style={[styles.brandName, { color: theme.colors.ink }]}>
                Reach International
              </Text>
              <View style={styles.syncRow}>
                <View style={[styles.syncDot, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.syncText, { color: theme.colors.mute }]}>Live Fleet Sync</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Right Action Icons: Theme Toggle, Role Pill */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.iconBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
            activeOpacity={0.7}
          >
            {isDark ? <Sun size={15} color={theme.colors.warning} /> : <Moon size={15} color={theme.colors.ink} />}
          </TouchableOpacity>

          <Badge status="active" customLabel={(role || 'Operator').replace('_', ' ')} />
        </View>
      </View>

      {/* Screen Title & Eyebrow Section Header */}
      {title && (
        <View style={styles.titleSection}>
          {eyebrow && (
            <Text style={[styles.eyebrowText, { color: theme.colors.link }]}>
              {eyebrow.replace(/^\/\/\s*/, '').toUpperCase()}
            </Text>
          )}
          <View style={styles.titleRow}>
            <Text style={[styles.titleText, { color: theme.colors.ink }]}>{title}</Text>
            {rightAction}
          </View>
          {subtitle && (
            <Text style={[styles.subtitleText, { color: theme.colors.body }]}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: 48,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacingNumeric.xs,
  },
  leftBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoEmblem: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 16,
    fontWeight: '800',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  syncDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: spacingNumeric.xs,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
