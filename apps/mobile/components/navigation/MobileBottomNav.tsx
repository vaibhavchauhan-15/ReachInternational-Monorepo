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
import { Touchable } from '../ui/Touchable';
import { Icon as CanonicalIcon } from '../ui/icon';
import { useAuth } from '../../lib/auth/useAuth';
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
}

const BottomNavTabItem: React.FC<BottomNavTabItemProps> = ({
  item,
  isActive,
  state,
  onPress,
  theme,
}) => {
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
      <>
        <Animated.View
          pointerEvents={keyboardVisible ? 'none' : 'auto'}
          style={[
            styles.outerContainer,
            {
              paddingBottom: Math.max(insets.bottom, 10),
            },
            navAnimatedStyle,
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
