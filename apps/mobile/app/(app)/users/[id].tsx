/**
 * Native Mobile Dedicated User Details Route Screen: /(app)/users/[id]
 * Supports direct deep-linking, operator-to-supervisor navigation, and push notifications.
 * 100% Web Parity with apps/web/app/(app)/users/[id]/page.tsx
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import { useTheme, MobileHeader, PermissionDeniedView } from '../../../components/ui';
import { UserDetailView, type UserDetailTabKey } from '../../../components/users/UserDetailView';

export default function UserDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { role, user: authUser } = useAuth();

  const normalizedRole = (role || '').toLowerCase();
  const canAccessUsers = ['super_admin', 'admin', 'manager', 'supervisor', 'hr'].includes(normalizedRole);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/users' as any);
    }
  };

  const decodedId = decodeURIComponent(id || '').trim();

  // If user is accessing their own profile or has directory permission
  const isSelf = Boolean(authUser?.id && authUser.id === decodedId);

  if (role && !canAccessUsers && !isSelf) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="User Profile"
          showBack={true}
          onPressBack={handleBack}
        />
        <PermissionDeniedView
          featureName="User Profile"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager', 'supervisor', 'hr']}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <UserDetailView
        userId={decodedId}
        onBack={handleBack}
        currentUserRole={role || 'super_admin'}
        currentUserId={authUser?.id}
        initialTab={(tab as UserDetailTabKey) || 'machines'}
        onViewUser={(targetId: string) => {
          router.push(`/(app)/users/${targetId}` as any);
        }}
        onUserDeleted={handleBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
