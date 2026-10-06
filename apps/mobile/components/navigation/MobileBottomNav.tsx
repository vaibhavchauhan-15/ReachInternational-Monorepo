/**
 * ReachInternational Mobile — Floating Bottom Navigation Bar
 * Manifest-driven: reads from @reachinternational/permissions getNavForRole().
 * Last slot is More (if overflow exists) or Account (if no overflow).
 * Hides while keyboard is open.
 */

import React, { useState, useEffect, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Touchable } from '../ui/Touchable';
import { Icon as CanonicalIcon } from '../ui/Icon';
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
  Settings,
  Banknote,
  CalendarCheck,
  Activity,
} from 'lucide-react-native';
import { MobileMenuDrawer } from './MobileMenuDrawer';

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
  settings: Settings,
  banknote: Banknote,
  'calendar-check': CalendarCheck,
  activity: Activity,
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
  const Icon = ICONS[item.icon] || Menu;
  const itemColor = isActive ? theme.colors.ink : theme.colors.mute;

  return (
    <Touchable
      preset="nav"
      onPress={onPress}
      style={styles.navItemBtn}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      <View style={styles.itemContent}>
        <CanonicalIcon
          as={Icon}
          level="body"
          color={itemColor}
          anim="pop"
        />
        <Text
          variant="caption"
          numberOfLines={1}
          style={[
            styles.itemLabel,
            {
              color: itemColor,
            },
          ]}
        >
          {item.label}
        </Text>

        {/* Active Dot Indicator */}
        <View
          style={[
            styles.activeDot,
            { backgroundColor: isActive ? theme.colors.ink : 'transparent' },
          ]}
        />
      </View>
    </Touchable>
  );
};

export interface MobileBottomNavProps {}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = memo(
  function MobileBottomNav() {
    const { theme, isDark } = useTheme();
    const { user, role, signOut, userProfile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

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

    const primaryKeySet = new Set(primary.map((p) => p.key));
    const drawerItems = more
      .filter((i) => !primaryKeySet.has(i.key))
      .map((i) => ({
        key: i.key,
        label: labelFor(i, normalizedRole),
        href: i.href.startsWith('/(app)') ? i.href : `/(app)${i.href}`,
        icon: i.icon,
        match: i.match,
      }));

    const primaryItems = primary.map(i => ({
      key: i.key,
      label: labelFor(i, normalizedRole),
      href: i.href.startsWith('/(app)') ? i.href : `/(app)${i.href}`,
      icon: i.icon,
      match: i.match,
    }));

    const userName = userProfile?.full_name || user?.user_metadata?.full_name || 'User';
    const userEmail = user?.email || '';
    const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

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
        label: hasMore ? 'Menu' : 'Account',
        href: hasMore ? '' : '/(app)/profile',
        icon: hasMore ? 'menu' : 'user',
        match: hasMore
          ? more.flatMap((i) => i.match)
          : ['/profile'],
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
            let isActive = item.match.some(
              (p) => pathname.includes(p.replace('/', '')),
            );
            if (item.key === 'more' && menuOpen) {
              isActive = true;
            }

            return (
              <BottomNavTabItem
                key={item.key}
                item={item}
                isActive={isActive}
                onPress={() => {
                  if (item.key === 'more' && hasMore) {
                    setMenuOpen(true);
                    return;
                  }
                  if (isActive) return;
                  router.push(item.href as any);
                }}
                theme={theme}
              />
            );
          })}
        </View>
        {menuOpen && (
          <MobileMenuDrawer
            items={drawerItems}
            primaryItems={primaryItems}
            user={{ name: userName, email: userEmail, initials }}
            onClosed={() => setMenuOpen(false)}
            onLogout={async () => { await signOut(); router.replace('/(auth)/login' as any); }}
          />
        )}
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
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 9999,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  navItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
    minHeight: 44,
  },
  itemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  itemLabel: {
    marginTop: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
