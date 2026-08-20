/**
 * ServiceCentric Mobile — Dynamic Sub-Menu Bottom Navigation Bar
 * Dynamically renders sub-menu tabs for main pages containing subItems.
 * Hides completely (returns null) for screens without sub-menus.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from '../ui';
import { mobileNavItems, type MobileSubItem } from '../../lib/nav/navItems';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';

export interface DynamicBottomNavProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const DynamicBottomNav: React.FC<DynamicBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  // Find active nav item matching current route
  const activeNavItem = mobileNavItems.find((item) => {
    const routePath = item.href.replace('/(app)', '');
    return pathname === item.href || pathname === routePath || (routePath !== '' && pathname.startsWith(routePath));
  });

  // Guard: If active item has NO subItems, return null (hide bottom navbar completely)
  if (!activeNavItem || !activeNavItem.subItems || activeNavItem.subItems.length === 0) {
    return null;
  }

  const subItems = activeNavItem.subItems;

  return (
    <View
      style={[
        styles.bottomNavContainer,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderTopColor: theme.colors.hairline,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {subItems.map((sub: MobileSubItem, index: number) => {
          const IconComp = sub.icon;
          const isSelected = activeTab ? activeTab === sub.tab : index === 0;

          return (
            <TouchableOpacity
              key={sub.tab}
              onPress={() => {
                if (onTabChange) {
                  onTabChange(sub.tab);
                }
              }}
              activeOpacity={0.7}
              style={[
                styles.tabBtn,
                isSelected && [
                  styles.selectedTabBtn,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ],
                !isSelected && {
                  backgroundColor: theme.colors.hairlineSoft,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {IconComp && (
                <IconComp
                  size={14}
                  color={isSelected ? theme.colors.onPrimary : theme.colors.body}
                />
              )}
              <Text
                style={[
                  styles.tabLabel,
                  { color: isSelected ? theme.colors.onPrimary : theme.colors.body },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {sub.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNavContainer: {
    height: 60,
    borderTopWidth: 1,
    justifyContent: 'center',
    paddingVertical: spacingNumeric.xs,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingNumeric.md,
    gap: 8,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacingNumeric.sm,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    gap: 6,
  },
  selectedTabBtn: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
