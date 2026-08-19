/**
 * ServiceCentric Mobile — Protected App Layout
 * Enforces authentication and provides primary navigation tabs.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme } from '../../components/ui';
import { LayoutDashboard, CheckSquare, Truck, Bell, User } from 'lucide-react-native';

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.canvasElevated,
          borderTopColor: theme.colors.hairline,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.link,
        tabBarInactiveTintColor: theme.colors.mute,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-work"
        options={{
          title: 'My Work',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: 'Machines',
          tabBarIcon: ({ color, size }) => <Truck size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size || 20} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
