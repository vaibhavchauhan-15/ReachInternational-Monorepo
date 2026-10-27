import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import { useTheme, MobileHeader, PermissionDeniedView } from '../../../components/ui';
import { ClientDetailView } from '../../../components/clients/ClientDetailView';

export default function ClientDetailScreen() {
  const { id, tab, action } = useLocalSearchParams<{ id: string; tab?: string; action?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { role } = useAuth();

  const normalizedRole = (role || '').toLowerCase();
  const canAccessClients = ['super_admin', 'admin', 'manager', 'supervisor'].includes(normalizedRole);
  const canManageClients = ['super_admin', 'admin', 'manager'].includes(normalizedRole);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/clients' as any);
    }
  };

  if (role && !canAccessClients) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="Client Profile"
          showBack={true}
          onPressBack={handleBack}
        />
        <PermissionDeniedView
          featureName="Client Profile"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager', 'supervisor']}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <ClientDetailView
        id={decodeURIComponent(id || '')}
        onBack={handleBack}
        canManageClients={canManageClients}
        initialTab={(tab as any) || (action === 'assign-supervisor' ? 'assignments' : 'machines')}
        initialAction={action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
