import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/useAuth';
import {
  useTheme,
  MobileHeader,
  ErrorState,
  classifyError,
  PermissionDeniedView,
  SlowNetworkBanner,
  showToast,
  type HeaderActionItem,
} from '../../components/ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  DashboardHeader,
  AlertWidget,
  DashboardSkeleton,
  OperatorDashboardCard,
  SupervisorDashboardCard,
  ManagerDashboardCard,
  AdminDashboardCard,
  SuperAdminDashboardCard,
  HRDashboardCard,
  getDashboardHeaderActions,
} from '../../components/dashboard';
import type {
  DashboardRole,
  SuperAdminDashboardDTO,
  AdminDashboardDTO,
  ManagerDashboardDTO,
  SupervisorDashboardDTO,
  HRDashboardDTO,
  OperatorDashboardDTO,
  DashboardAlert,
} from '@reachinternational/types';
import { haptics } from '../../lib/haptics';
import { useScreenSync } from '../../lib/offline';
import { checkAndNotifyShiftEnded } from '../../lib/notifications';

const CANONICAL_ROLES: readonly DashboardRole[] = [
  'super_admin',
  'admin',
  'manager',
  'supervisor',
  'hr',
  'operator',
];

export default function DashboardScreen() {
  const router = useRouter();
  const { user, role, userProfile } = useAuth();
  const { theme, isDark, setMode } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [isSlowDismissed, setIsSlowDismissed] = useState(false);

  const activeRole = (role as DashboardRole) || 'operator';
  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const isRecognizedRole = CANONICAL_ROLES.includes(activeRole);

  // Optimistic & Cached server state using TanStack Query
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', activeRole, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      switch (activeRole) {
        case 'super_admin': {
          const { data, error } = await supabase.rpc('get_super_admin_dashboard');
          if (error) throw error;
          return data as SuperAdminDashboardDTO;
        }
        case 'admin': {
          const { data, error } = await supabase.rpc('get_admin_dashboard');
          if (error) throw error;
          return data as AdminDashboardDTO;
        }
        case 'manager': {
          const { data, error } = await supabase.rpc('get_manager_dashboard');
          if (error) throw error;
          return data as ManagerDashboardDTO;
        }
        case 'supervisor': {
          const { data, error } = await supabase.rpc('get_supervisor_dashboard', {
            p_supervisor_id: user.id,
          });
          if (error) throw error;
          return data as SupervisorDashboardDTO;
        }
        case 'hr': {
          const { data, error } = await supabase.rpc('get_hr_dashboard');
          if (error) throw error;
          return data as HRDashboardDTO;
        }
        case 'operator':
        default: {
          const { data, error } = await supabase.rpc('get_operator_dashboard', {
            p_operator_id: user.id,
          });
          if (error) throw error;
          return data as OperatorDashboardDTO;
        }
      }
    },
    enabled: Boolean(user?.id && isRecognizedRole),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh cache
    placeholderData: (previousData) => previousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Telemetry: detect slow network if initial or refetch takes > 7 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if ((isLoading || isFetching) && !dashboardData) {
      timer = setTimeout(() => {
        setIsSlowNetwork(true);
      }, 7000);
    } else {
      setIsSlowNetwork(false);
      setIsSlowDismissed(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, isFetching, dashboardData]);

  const superAdminData = activeRole === 'super_admin' ? (dashboardData as SuperAdminDashboardDTO | null) : null;
  const adminData = activeRole === 'admin' ? (dashboardData as AdminDashboardDTO | null) : null;
  const managerData = activeRole === 'manager' ? (dashboardData as ManagerDashboardDTO | null) : null;
  const supervisorData = activeRole === 'supervisor' ? (dashboardData as SupervisorDashboardDTO | null) : null;
  const hrData = activeRole === 'hr' ? (dashboardData as HRDashboardDTO | null) : null;
  const operatorData =
    activeRole === 'operator' || !['super_admin', 'admin', 'manager', 'supervisor', 'hr'].includes(activeRole)
      ? (dashboardData as OperatorDashboardDTO | null)
      : null;

  const onRefresh = useCallback(async () => {
    try {
      haptics.select();
    } catch {
      // ignore
    }
    setRefreshing(true);
    try {
      const res = await refetch();
      if (res.isError) {
        const classified = classifyError(res.error);
        showToast('warning', 'Unable to Refresh', classified.message);
      } else {
        showToast('success', 'Dashboard Updated', 'Latest metrics and shift logs loaded.');
      }
    } catch {
      showToast('warning', 'Connection Issue', 'Could not refresh data. Displaying cached information.');
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleScreenSyncRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch {
      // Screen sync background refetch fails silently to avoid interrupting the user
    }
  }, [refetch]);

  useScreenSync({
    screen: 'dashboard',
    onRefresh: handleScreenSyncRefresh,
  });

  // Extra functions for 3-dot more menu on Home screen
  const headerActions: HeaderActionItem[] = useMemo(() => {
    return getDashboardHeaderActions({
      activeRole,
      refreshing,
      onRefresh,
      router,
      isDark,
      setMode,
      inkColor: theme.colors.ink,
    });
  }, [activeRole, isDark, onRefresh, refreshing, router, setMode, theme.colors.ink]);

  // Extract alerts for the active role matching web AlertWidget
  const alerts: DashboardAlert[] = useMemo(() => {
    if (activeRole === 'super_admin') return superAdminData?.alerts || [];
    if (activeRole === 'admin') return adminData?.alerts || [];
    if (activeRole === 'manager') return managerData?.alerts || [];
    if (activeRole === 'supervisor') return supervisorData?.alerts || [];
    if (activeRole === 'hr') return hrData?.alerts || [];
    if (activeRole === 'operator') {
      // Feedback 3: Alert card removed for operator; mobile notification pushed after shift end
      return [];
    }
    return [];
  }, [activeRole, superAdminData, adminData, managerData, supervisorData, hrData]);

  // Push notification when an assigned shift ends and remains unlogged (Feedback 3)
  useEffect(() => {
    if (activeRole === 'operator' && operatorData?.assigned_shifts) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      checkAndNotifyShiftEnded(operatorData.assigned_shifts).then((scheduledTimer) => {
        timer = scheduledTimer;
      });
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [activeRole, operatorData?.assigned_shifts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Flush edge-to-edge solid mobile top header: [Home] title + [Quick Search] matching web Screenshot */}
      <MobileHeader
        title="Home"
        showBack={false}
        showQuickAccess={true}
        showQuickAccessCapsule={false}
        showMoreMenu={false}
        actions={headerActions}
      />

      {/* Case 1: Unrecognized Role Access Gate */}
      {!isRecognizedRole ? (
        <PermissionDeniedView
          currentRole={activeRole}
          featureName="Operational Dashboard"
          title="Dashboard Access Restricted"
          description="Your current user role does not have authorization to access this operational dashboard."
          onBack={() => router.replace('/login')}
        />
      ) : isLoading && !dashboardData && activeRole !== 'operator' ? (
        /* Case 2: Initial Loading Skeleton with Ambient Slow Network Banner */
        <View style={styles.container}>
          {isSlowNetwork && !isSlowDismissed && (
            <SlowNetworkBanner
              visible={true}
              message="Connecting to database is taking longer than usual. Still loading your dashboard..."
              onRetry={onRefresh}
              onDismiss={() => setIsSlowDismissed(true)}
              style={styles.slowBanner}
            />
          )}
          <DashboardSkeleton
            role={activeRole}
            kpiCount={activeRole === 'super_admin' ? 6 : activeRole === 'admin' ? 5 : 4}
          />
        </View>
      ) : isError && !dashboardData ? (
        /* Case 3: Initial Load Failed (Network, Timeout, Server, or 403 Forbidden) */
        classifyError(error).classification === 'permission' ? (
          <PermissionDeniedView
            currentRole={activeRole}
            featureName="Operational Dashboard"
            title="Dashboard Access Restricted"
            description="You do not have required permissions to view this operational dashboard."
            onBack={() => router.replace('/login')}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.link}
                colors={[theme.colors.link]}
              />
            }
            showsVerticalScrollIndicator={true}
          >
            <DashboardHeader userName={userName} />
            <ErrorState
              error={error}
              onRetry={onRefresh}
              retryLabel="Retry Dashboard"
              style={{ marginTop: spacingNumeric.lg }}
            />
          </ScrollView>
        )
      ) : (
        /* Case 4: Dashboard Active (Cached or Live Server State) */
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.link}
              colors={[theme.colors.link]}
            />
          }
          showsVerticalScrollIndicator={true}
          indicatorStyle={isDark ? 'white' : 'black'}
          scrollEventThrottle={16}
          bounces={true}
          overScrollMode="always"
        >
          {/* Ambient Slow Network Feedback during background refetch */}
          {isSlowNetwork && !isSlowDismissed && (
            <SlowNetworkBanner
              visible={true}
              message="Network latency detected. Displaying cached dashboard data while updating..."
              onRetry={onRefresh}
              onDismiss={() => setIsSlowDismissed(true)}
              style={styles.slowBannerContent}
            />
          )}

          {/* Greeting Header */}
          <DashboardHeader userName={userName} />

          {/* Critical & Informational Alerts */}
          <AlertWidget alerts={alerts} />

          {/* Role-Specific Dashboard Views */}
          {activeRole === 'super_admin' && (
            <SuperAdminDashboardCard data={superAdminData} />
          )}
          {activeRole === 'admin' && (
            <AdminDashboardCard data={adminData} />
          )}
          {activeRole === 'manager' && (
            <ManagerDashboardCard data={managerData} />
          )}
          {activeRole === 'supervisor' && (
            <SupervisorDashboardCard data={supervisorData} />
          )}
          {activeRole === 'hr' && (
            <HRDashboardCard data={hrData} />
          )}
          {activeRole === 'operator' && (
            <OperatorDashboardCard
              data={operatorData}
              isLoading={isLoading && !dashboardData}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  slowBanner: {
    marginHorizontal: spacingNumeric.md,
    marginTop: spacingNumeric.xs,
    marginBottom: spacingNumeric.xs,
  },
  slowBannerContent: {
    marginBottom: spacingNumeric.sm,
  },
});
