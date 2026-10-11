import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, MobileHeader, type HeaderActionItem } from '../../components/ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import {
  RefreshCw,
  FileSpreadsheet,
  Wrench,
  CalendarCheck,
  Clock,
  Users,
  Building2,
  Settings,
  Sun,
  Moon,
} from '../../components/ui/icon';
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

export default function DashboardScreen() {
  const router = useRouter();
  const { user, role, userProfile } = useAuth();
  const { theme, isDark, setMode } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const activeRole = (role as DashboardRole) || 'operator';
  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User');

  // Optimistic & Cached server state using TanStack Query
  const {
    data: dashboardData,
    isLoading,
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
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 5, // 5 minutes fresh cache
  });

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
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleScreenSyncRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useScreenSync({
    screen: 'dashboard',
    onRefresh: handleScreenSyncRefresh,
  });

  // Extra functions for 3-dot more menu on Home screen
  const headerActions: HeaderActionItem[] = useMemo(() => {
    const actions: HeaderActionItem[] = [
      {
        id: 'refresh-data',
        label: refreshing ? 'Refreshing...' : 'Refresh Dashboard',
        icon: <RefreshCw size={15} color={theme.colors.ink} />,
        onPress: onRefresh,
        disabled: refreshing,
      },
    ];

    // Role-specific operational shortcuts
    switch (activeRole) {
      case 'supervisor':
        actions.push(
          {
            id: 'op-logs',
            label: 'Review Shift Logs',
            icon: <FileSpreadsheet size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/operations'),
          },
          {
            id: 'op-fleet',
            label: 'Supervised Machinery',
            icon: <Wrench size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/machines'),
          },
          {
            id: 'op-attendance',
            label: 'Shift Attendance',
            icon: <CalendarCheck size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/attendance'),
          }
        );
        break;

      case 'operator':
        actions.push(
          {
            id: 'op-entry',
            label: 'Record Running Hours',
            icon: <FileSpreadsheet size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/operations'),
          },
          {
            id: 'op-machine',
            label: 'Assigned Equipment',
            icon: <Wrench size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/machines'),
          },
          {
            id: 'op-history',
            label: 'Shift History & Logs',
            icon: <Clock size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/operations'),
          },
          {
            id: 'op-attendance',
            label: 'My Attendance',
            icon: <CalendarCheck size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/attendance'),
          }
        );
        break;

      case 'manager':
        actions.push(
          {
            id: 'mgr-ops',
            label: 'Operations Review',
            icon: <FileSpreadsheet size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/operations'),
          },
          {
            id: 'mgr-fleet',
            label: 'Fleet Utilization',
            icon: <Wrench size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/machines'),
          },
          {
            id: 'mgr-attendance',
            label: 'Attendance Roster',
            icon: <CalendarCheck size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/attendance'),
          },
          {
            id: 'mgr-payroll',
            label: 'Running Hours & Payroll',
            icon: <Clock size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/payroll'),
          }
        );
        break;

      case 'admin':
        actions.push(
          {
            id: 'adm-ops',
            label: 'Operations & Running Logs',
            icon: <FileSpreadsheet size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/operations'),
          },
          {
            id: 'adm-fleet',
            label: 'Machinery Fleet',
            icon: <Wrench size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/machines'),
          },
          {
            id: 'adm-users',
            label: 'Personnel & Directory',
            icon: <Users size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/users'),
          },
          {
            id: 'adm-clients',
            label: 'Client Worksites',
            icon: <Building2 size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/clients'),
          }
        );
        break;

      case 'super_admin':
        actions.push(
          {
            id: 'sa-fleet',
            label: 'Machinery Fleet Matrix',
            icon: <Wrench size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/machines'),
          },
          {
            id: 'sa-users',
            label: 'User Directory & Access',
            icon: <Users size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/users'),
          },
          {
            id: 'sa-clients',
            label: 'Client Directory',
            icon: <Building2 size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/clients'),
          }
        );
        break;

      case 'hr':
        actions.push(
          {
            id: 'hr-staff',
            label: 'Employee Directory',
            icon: <Users size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/users'),
          },
          {
            id: 'hr-attendance',
            label: 'Attendance Records',
            icon: <CalendarCheck size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/attendance'),
          },
          {
            id: 'hr-payroll',
            label: 'Payroll Overview',
            icon: <Clock size={15} color={theme.colors.ink} />,
            onPress: () => router.push('/payroll'),
          }
        );
        break;
    }

    // Common system shortcuts
    actions.push(
      {
        id: 'app-settings',
        label: 'Settings & Preferences',
        icon: <Settings size={15} color={theme.colors.ink} />,
        onPress: () => router.push('/settings' as any),
      },
      {
        id: 'theme-toggle',
        label: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        icon: isDark ? <Sun size={15} color={theme.colors.ink} /> : <Moon size={15} color={theme.colors.ink} />,
        onPress: () => setMode(isDark ? 'light' : 'dark'),
      }
    );

    return actions;
  }, [activeRole, isDark, onRefresh, refreshing, router, setMode, theme.colors.ink]);

  // Extract alerts for the active role matching web AlertWidget
  const alerts: DashboardAlert[] = useMemo(() => {
    if (activeRole === 'super_admin') return superAdminData?.alerts || [];
    if (activeRole === 'admin') return adminData?.alerts || [];
    if (activeRole === 'manager') return managerData?.alerts || [];
    if (activeRole === 'supervisor') return supervisorData?.alerts || [];
    if (activeRole === 'hr') return hrData?.alerts || [];
    if (activeRole === 'operator') {
      if (operatorData?.alerts && operatorData.alerts.length > 0) {
        return operatorData.alerts;
      }
      const isSubmitted = operatorData?.today?.entryStatus === 'submitted';
      const isPartial = operatorData?.today?.entryStatus === 'partial';
      const submittedCount = operatorData?.today?.submittedCount ?? 0;
      const totalAssignedCount =
        operatorData?.today?.totalAssignedCount ?? (operatorData?.assigned_shifts?.length || 1);
      const totalHours = operatorData?.today?.totalRunningHoursToday ?? 0;

      return [
        isSubmitted
          ? {
              id: 'entry-submitted',
              severity: 'success' as const,
              title: "Today's Shift Logs Submitted",
              description: `All assigned shifts (${totalHours}h total) are recorded for today.`,
              actionUrl: '/operations?tab=history',
            }
          : isPartial
          ? {
              id: 'entry-partial',
              severity: 'warning' as const,
              title: `${submittedCount} of ${totalAssignedCount} Shifts Logged`,
              description: `Recorded ${totalHours}h so far. Remember to submit remaining assigned shift(s).`,
              actionUrl: '/operations',
            }
          : {
              id: 'entry-pending',
              severity: 'warning' as const,
              title: 'Shift Logs Pending',
              description: `You have ${totalAssignedCount} assigned shifts pending submission today.`,
              actionUrl: '/operations',
            },
      ];
    }
    return [];
  }, [activeRole, superAdminData, adminData, managerData, supervisorData, hrData, operatorData]);

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

      {isLoading && !dashboardData ? (
        <DashboardSkeleton
          role={activeRole}
          kpiCount={activeRole === 'super_admin' ? 6 : activeRole === 'admin' ? 5 : 4}
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
          indicatorStyle={isDark ? 'white' : 'black'}
          scrollEventThrottle={16}
          bounces={true}
          overScrollMode="always"
        >
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
            <OperatorDashboardCard data={operatorData} />
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
});
