import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { useTheme } from './ThemeProvider';
import { mobileNavItems, type MobileSubItem } from '../../lib/nav/navItems';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';

export const CustomBottomTabBar: React.FC<any> = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();

  // Extract route key (e.g. "/machines" -> "machines")
  const currentRouteKey = pathname.split('/').pop() || '';
  const activeTabQuery = (searchParams?.tab as string) || '';

  // Find active nav item definition from canonical registry
  const activeNavItem = mobileNavItems.find((item) => {
    const routeName = item.href.split('/').pop() || '';
    return currentRouteKey === routeName || pathname.endsWith(routeName);
  });

  // Guard: If active route has NO subItems, return null (hide bottom navbar completely)
  if (!activeNavItem || !activeNavItem.subItems || activeNavItem.subItems.length === 0) {
    return null;
  }

  const subItems = activeNavItem.subItems;

  return (
    <View
      style={[
        styles.tabBarContainer,
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
          const SubIcon = sub.icon;
          const isSelected = activeTabQuery ? activeTabQuery === sub.tab : index === 0;
          const targetRoute = `${activeNavItem.href}?tab=${sub.tab}`;

          return (
            <TouchableOpacity
              key={sub.tab}
              onPress={() => router.push(targetRoute as any)}
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
              {SubIcon && (
                <SubIcon
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
  tabBarContainer: {
    height: 56,
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
    paddingVertical: 7,
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
