/**
 * ReachInternational Mobile — Floating Bottom Navigation Bar
 * Manifest-driven: reads from @reachinternational/permissions getNavForRole().
 * Last slot is More (if overflow exists) or Account (if no overflow).
 * Hides while keyboard is open.
 */

import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { InteractiveIcon } from '../ui/InteractiveIcon';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getNavForRole,
  labelFor,
} from '@reachinternational/permissions';
import type { UserRole } from '@reachinternational/types';
import {
  Home,
  Wrench,
  Gauge,
  Users,
  Building2,
  Shield,
  Menu,
  User,
  Banknote,
  CalendarCheck,
} from 'lucide-react-native';

// Icon string key → Lucide RN component
const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  home: Home,
  gauge: Gauge,
  wrench: Wrench,
  building: Building2,
  users: Users,
  shield: Shield,
  menu: Menu,
  user: User,
  banknote: Banknote,
  'calendar-check': CalendarCheck,
};
interface BottomNavTabItemProps {
  item: {
    key: string;
    label: string;
    href: string;
    icon: string;
    match: readonly string[] | string[];
  };
  isActive: boolean;
  onPress: () => void;
  theme: any;
}

const BottomNavTabItem: React.FC<BottomNavTabItemProps> = ({
  item,
  isActive,
  onPress,
  theme,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const Icon = ICONS[item.icon] || Menu;
  const itemColor = isActive ? theme.colors.ink : theme.colors.mute;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={styles.navItemBtn}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      <View style={styles.itemContent}>
        <InteractiveIcon
          icon={<Icon size={18} color={itemColor} />}
          pressed={isPressed}
          variant="bounce"
        />
        <Text
          style={[
            styles.itemLabel,
            {
              color: itemColor,
              fontWeight: isActive ? '700' : '500',
            },
          ]}
        >
          {item.label}
        </Text>

        {/* Active Dot Indicator */}
        {isActive && (
          <View
            style={[
              styles.activeDot,
              { backgroundColor: theme.colors.ink },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

export interface MobileBottomNavProps {}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = memo(
  function MobileBottomNav() {
    const { theme, isDark } = useTheme();
    const { role } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Hide bar while keyboard is open
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', () =>
        setKeyboardVisible(true),
      );
      const hideSub = Keyboard.addListener('keyboardDidHide', () =>
        setKeyboardVisible(false),
      );
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    if (keyboardVisible) return null;

    const normalizedRole = ((role || 'operator') as string).toLowerCase() as UserRole;
    const { primary, more, hasMore } = getNavForRole(normalizedRole);

    // Build tab list from manifest
    const tabs = [
      ...primary.map((i) => ({
        key: i.key,
        label: labelFor(i, normalizedRole),
        href: `/(app)${i.href}`,
        icon: i.icon,
        match: i.match,
      })),
      {
        key: 'more' as const,
        label: hasMore ? 'More' : 'Account',
        href: '/(app)/more',
        icon: hasMore ? 'menu' : 'user',
        match: [
          '/more',
          '/profile',
          '/settings',
          '/privacy',
          '/terms',
          '/account-deletion',
          ...more.flatMap((i) => i.match),
        ],
      },
    ];

    return (
      <View
        style={[
          styles.outerContainer,
          {
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View
          style={[
            styles.pillBar,
            {
              backgroundColor: isDark
                ? 'rgba(23, 23, 23, 0.94)'
                : 'rgba(255, 255, 255, 0.94)',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {tabs.map((item) => {
            // Compute active state
            const isActive = item.match.some(
              (p) => pathname.includes(p.replace('/', '')),
            );

            return (
              <BottomNavTabItem
                key={item.key}
                item={item}
                isActive={isActive}
                onPress={() => router.push(item.href as any)}
                theme={theme}
              />
            );
          })}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  pillBar: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 9999,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  navItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 1,
    minHeight: 44,
  },
  itemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  itemLabel: {
    fontSize: 9.5,
    letterSpacing: -0.3,
    marginTop: 1.5,
  },
  activeDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    marginTop: 2,
  },
});
