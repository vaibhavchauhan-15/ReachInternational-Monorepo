/**
 * ReachInternational Mobile — Floating Bottom Navigation Bar
 * 100% Parity with Web MobileBottomNav (apps/web/components/layout/MobileBottomNav.tsx)
 * Features floating pill container, role-based tabs, active dot indicator,
 * integrated Command Palette search for all pages, and Slide-Up Profile Sheet.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { useAuth } from '../../lib/auth/useAuth';
import { MobileProfileSheet } from './MobileProfileSheet';
import {
  Wrench,
  Gauge,
  Users,
  User,
  Settings,
} from 'lucide-react-native';

export interface MobileBottomNavProps {
  // Optional custom props if needed
}

interface NavItemConfig {
  id: string;
  href?: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  isAction?: boolean;
  actionType?: 'profile';
  roles?: string[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const normalizedRole = (role || 'operator').toLowerCase();
  const isOperator = normalizedRole === 'operator';
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super_admin';

  // Build clean page navigation items (Quick Access is placed directly in the header of every page)
  const navItems: NavItemConfig[] = isOperator
    ? [
        {
          id: 'operations',
          href: '/(app)/operations',
          label: 'Operations',
          icon: Gauge,
        },
        {
          id: 'settings',
          href: '/(app)/settings',
          label: 'Settings',
          icon: Settings,
        },
      ]
    : [
        {
          id: 'machines',
          href: '/(app)/machines',
          label: 'Machines',
          icon: Wrench,
        },
        {
          id: 'operations',
          href: '/(app)/operations',
          label: 'Operations',
          icon: Gauge,
        },
        ...(isAdmin
          ? [
              {
                id: 'users',
                href: '/(app)/users',
                label: 'Users',
                icon: Users,
              },
            ]
          : []),
        {
          id: 'settings',
          href: '/(app)/settings',
          label: 'Settings',
          icon: Settings,
        },
      ];

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(normalizedRole)
  );

  const handleItemPress = (item: NavItemConfig) => {
    if (item.isAction && item.actionType === 'profile') {
      setProfileSheetOpen(true);
      return;
    }

    if (item.href) {
      router.push(item.href as any);
    }
  };

  return (
    <>
      {/* Floating Bottom Navigation Pill Container */}
      <View
        style={[
          styles.outerContainer,
          {
            paddingBottom: Math.max(insets.bottom, 10),
            pointerEvents: 'box-none',
          },
        ]}
      >
        <View
          style={[
            styles.pillBar,
            {
              backgroundColor: isDark ? 'rgba(23, 23, 23, 0.94)' : 'rgba(255, 255, 255, 0.94)',
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;

            // Compute active state
            let isActive = false;
            if (item.id === 'settings') {
              isActive = pathname.includes('settings');
            } else if (item.isAction && item.actionType === 'profile') {
              isActive = profileSheetOpen || pathname.includes('profile');
            } else if (item.id === 'machines') {
              isActive = pathname.includes('machines');
            } else if (item.id === 'operations') {
              isActive = pathname.includes('operations');
            } else if (item.id === 'users') {
              isActive = pathname.includes('users');
            }

            const itemColor = isActive ? theme.colors.ink : theme.colors.mute;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleItemPress(item)}
                style={styles.navItemBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.itemContent}>
                  <Icon size={20} color={itemColor} />
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

                  {/* Active Dot Indicator beneath active item label */}
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
          })}
        </View>
      </View>

      {/* Integrated Slide-Up Profile Sheet Modal */}
      <MobileProfileSheet
        isOpen={profileSheetOpen}
        onClose={() => setProfileSheetOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  pillBar: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 6,
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
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  itemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  itemLabel: {
    fontSize: 10,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});
