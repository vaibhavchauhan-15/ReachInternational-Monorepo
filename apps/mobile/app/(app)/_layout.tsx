/**
 * ServiceCentric Mobile — Protected App Layout
 * Enforces authentication and provides primary navigation via CustomBottomTabBar.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, CustomBottomTabBar } from '../../components/ui';
import { DrawerProvider } from '../../lib/nav/DrawerContext';

export default function AppLayout() {
  const { session, isLoading } = useAuth();
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

  return (
    <DrawerProvider>
      <Tabs
        tabBar={(props) => <CustomBottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="my-work" options={{ title: 'My Work' }} />
        <Tabs.Screen name="tasks" options={{ title: 'To-Do / Tasks' }} />
        <Tabs.Screen name="machines" options={{ title: 'Machines' }} />
        <Tabs.Screen name="complaints" options={{ title: 'Complaints' }} />
        <Tabs.Screen name="fsr" options={{ title: 'Field Service Reports' }} />
        <Tabs.Screen name="operations" options={{ title: 'Operations Hub' }} />
        <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
        <Tabs.Screen name="rentals" options={{ title: 'Rentals' }} />
        <Tabs.Screen name="crm" options={{ title: 'CRM' }} />
        <Tabs.Screen name="finance" options={{ title: 'Finance' }} />
        <Tabs.Screen name="hr" options={{ title: 'HR' }} />
        <Tabs.Screen name="notifications" options={{ title: 'Alerts' }} />
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
