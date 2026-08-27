import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, CustomBottomTabBar } from '../../components/ui';
import { DrawerProvider } from '../../lib/nav/DrawerContext';

export default function AppLayout() {
  const { session, isLoading, role } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text style={{ color: theme.colors.mute }}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  const normalizedRole = (role || '').toLowerCase();
  const isManagerOrAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'service_manager' ||
    normalizedRole === 'hr_manager';

  return (
    <DrawerProvider>
      <Tabs
        tabBar={(props) => <CustomBottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
        <Tabs.Screen name="operations" options={{ title: 'Operations Hub' }} />
        {isManagerOrAdmin && (
          <Tabs.Screen name="users" options={{ title: 'Employees & Users' }} />
        )}
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </DrawerProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
