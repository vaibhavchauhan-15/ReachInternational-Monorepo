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
  Keyboard,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ReduceMotion,
} from 'react-native-reanimated';
import { EFFECTS } from '../../lib/motion/tokens';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Icon as CanonicalIcon } from '../ui/icon';
import { useAuth } from '../../lib/auth/useAuth';
import { haptics } from '../../lib/haptics';
import {
  getNavForRole,
  labelFor,
} from '@reachinternational/permissions';
import type { UserRole } from '@reachinternational/types';
import { MobileMenuDrawer } from './MobileMenuDrawer';

interface BottomNavTabItemProps {
  item: {
    key: string;
    label: string;
    href: string;
    icon: string;
    match: readonly string[] | string[];
  };
  isActive: boolean;
  state?: 'open' | 'closed';
  onPress: () => void;
  theme: any;
  isDark: boolean;
}

const BottomNavTabItem: React.FC<BottomNavTabItemProps> = ({
  item,
  isActive,
  state,
  onPress,
  theme,
  isDark,
}) => {
  const primaryColor = theme.colors.primary || (isDark ? '#0ea5e9' : '#0284c7');
  const itemColor = isActive ? primaryColor : theme.colors.mute;

  const handlePress = () => {
    try {
      haptics.tap();
    } catch {
      // ignore
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.navItemBtn}
      android_ripple={{
        color: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(23, 23, 23, 0.08)',
        borderless: false,
        radius: 28,
        foreground: false,
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      {({ pressed, hovered }: any) => {
        const isPressed = Boolean(pressed);
        const isHovered = Boolean(hovered && !pressed);

        const pressedBg = isDark
          ? (isActive ? 'rgba(14, 165, 233, 0.16)' : 'rgba(255, 255, 255, 0.08)')
          : (isActive ? 'rgba(2, 132, 199, 0.12)' : 'rgba(23, 23, 23, 0.06)');

        const hoveredBg = isDark
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(23, 23, 23, 0.04)';

        return (
          <View
            style={[
              styles.tabPill,
              isHovered && { backgroundColor: hoveredBg },
              isPressed && { backgroundColor: pressedBg },
            ]}
          >
            <CanonicalIcon
              name={item.icon}
              level="body"
              color={itemColor}
              pulseKey={isActive}
              animate={isActive ? 'pulse' : 'auto'}
              state={state}
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
                { backgroundColor: isActive ? primaryColor : 'transparent' },
              ]}
            />
          </View>
        );
      }}
    </Pressable>
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
    const navTranslateY = useSharedValue(0);

    // Smoothly animate bar down when keyboard opens and back up when it closes
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardVisible(true);
        navTranslateY.value = withSpring(140, {
          ...EFFECTS.fast,
          reduceMotion: ReduceMotion.System,
        });
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardVisible(false);
        navTranslateY.value = withSpring(0, {
          ...EFFECTS.fast,
          reduceMotion: ReduceMotion.System,
        });
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [navTranslateY]);

    const navAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: navTranslateY.value }],
    }));

    const normalizedRole = ((role || 'operator') as string).toLowerCase() as UserRole;
    const { primary, more, hasMore } = getNavForRole(normalizedRole);

    const primaryKeySet = new Set(primary.map((p) => p.key));
    const drawerItems = more
      .filter((i) => !primaryKeySet.has(i.key))
      .map((i) => {
        let routeHref = i.href;
        if (i.key === 'settings') {
          routeHref = '/settings';
        } else {
          routeHref = routeHref.replace(/^\/\(app\)/, '');
        }
        return {
          key: i.key,
          label: labelFor(i, normalizedRole),
          href: routeHref,
          icon: i.icon,
          match: i.match,
        };
      });

    const primaryItems = primary.map(i => ({
      key: i.key,
      label: labelFor(i, normalizedRole),
      href: i.href.replace(/^\/\(app\)/, ''),
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
        href: i.href.replace(/^\/\(app\)/, ''),
        icon: i.icon,
        match: i.match,
      })),
      {
        key: 'more' as const,
        label: hasMore ? 'Menu' : 'Account',
        href: hasMore ? '' : '/profile',
        icon: hasMore ? 'menu' : 'user',
        match: hasMore
          ? more.flatMap((i) => i.match)
          : ['/profile'],
      },
    ];

    return (
      <>
        <Animated.View
          pointerEvents={keyboardVisible ? 'none' : 'auto'}
          style={[
            styles.navBarContainer,
            {
              backgroundColor: isDark ? '#171717' : '#ffffff',
              borderTopColor: theme.colors.hairline,
              paddingBottom: Math.max(insets.bottom, 6),
            },
            navAnimatedStyle,
          ]}
        >
          <View style={styles.tabsRow}>
            {tabs.map((item) => {
              // Compute active state
              let isActive = item.match.some((p) => {
                const cleanP = p.replace('/', '');
                return cleanP ? pathname.includes(cleanP) : false;
              });
              if (
                item.key === 'home' &&
                (pathname === '/' ||
                  pathname === '/(app)' ||
                  pathname === '/(app)/dashboard' ||
                  pathname === '/dashboard')
              ) {
                isActive = true;
              }
              if (item.key === 'more' && menuOpen) {
                isActive = true;
              }

              return (
                <BottomNavTabItem
                  key={item.key}
                  item={item}
                  isActive={isActive}
                  state={item.key === 'more' ? (menuOpen ? 'open' : 'closed') : undefined}
                  onPress={() => {
                    if (item.key === 'more' && hasMore) {
                      setMenuOpen(true);
                      return;
                    }
                    if (isActive) return;
                    router.push(item.href as any);
                  }}
                  theme={theme}
                  isDark={isDark}
                />
              );
            })}
          </View>
        </Animated.View>

        {menuOpen && (
          <MobileMenuDrawer
            items={drawerItems}
            primaryItems={primaryItems}
            user={{ name: userName, email: userEmail, initials }}
            role={normalizedRole}
            onClosed={() => setMenuOpen(false)}
            onLogout={async () => {
              await signOut();
              router.replace('/(auth)/login' as any);
            }}
          />
        )}
      </>
    );
  },
);

const styles = StyleSheet.create({
  navBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    ...Platform.select({
      web: {
        position: 'fixed' as any,
        bottom: 0,
        left: 0,
        right: 0,
        boxShadow: 'none',
      },
      default: {
        elevation: 0,
        shadowOpacity: 0,
      },
    }),
  },
  tabsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
    paddingHorizontal: 4,
  },
  navItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  tabPill: {
    width: '100%',
    maxWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 12,
    ...Platform.select({
      web: {
        transition: 'background-color 150ms ease',
        outlineStyle: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      } as any,
      default: {},
    }),
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
