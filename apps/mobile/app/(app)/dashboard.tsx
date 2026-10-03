import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, MobileHeader } from '../../components/ui';
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

export default function DashboardScreen() {
  const { user, role, userProfile } = useAuth();
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Role dashboard data states
  const [superAdminData, setSuperAdminData] = useState<SuperAdminDashboardDTO | null>(null);
  const [adminData, setAdminData] = useState<AdminDashboardDTO | null>(null);
  const [managerData, setManagerData] = useState<ManagerDashboardDTO | null>(null);
  const [supervisorData, setSupervisorData] = useState<SupervisorDashboardDTO | null>(null);
  const [hrData, setHrData] = useState<HRDashboardDTO | null>(null);
  const [operatorData, setOperatorData] = useState<OperatorDashboardDTO | null>(null);

  const activeRole = (role as DashboardRole) || 'operator';
  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User');

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!user?.id) return;

      switch (activeRole) {
        case 'super_admin': {
          const { data } = await supabase.rpc('get_super_admin_dashboard');
          if (data) setSuperAdminData(data as SuperAdminDashboardDTO);
          break;
        }
        case 'admin': {
          const { data } = await supabase.rpc('get_admin_dashboard');
          if (data) setAdminData(data as AdminDashboardDTO);
          break;
        }
        case 'manager': {
          const { data } = await supabase.rpc('get_manager_dashboard');
          if (data) setManagerData(data as ManagerDashboardDTO);
          break;
        }
        case 'supervisor': {
          const { data } = await supabase.rpc('get_supervisor_dashboard', {
            p_supervisor_id: user.id,
          });
          if (data) setSupervisorData(data as SupervisorDashboardDTO);
          break;
        }
        case 'hr': {
          const { data } = await supabase.rpc('get_hr_dashboard');
          if (data) setHrData(data as HRDashboardDTO);
          break;
        }
        case 'operator':
        default: {
          const { data } = await supabase.rpc('get_operator_dashboard', {
            p_operator_id: user.id,
          });
          if (data) setOperatorData(data as OperatorDashboardDTO);
          break;
        }
      }
    } catch (err) {
      console.warn('[DashboardScreen] Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeRole]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

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
              title: "Today's Log Pending",
              description: 'Daily running hours have not been submitted for today.',
              actionUrl: '/operations',
            },
      ];
    }
    return [];
  }, [activeRole, superAdminData, adminData, managerData, supervisorData, hrData, operatorData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Flush edge-to-edge solid mobile top header: [Home] title + [Quick Search] */}
      <MobileHeader
        title="Home"
        showLogo={false}
        showBack={false}
        showQuickAccess={true}
        showQuickAccessCapsule={false}
        showMoreMenu={false}
      />

      {isLoading ? (
        <DashboardSkeleton kpiCount={activeRole === 'super_admin' ? 6 : activeRole === 'admin' ? 5 : 4} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.link}
            />
          }
          showsVerticalScrollIndicator={false}
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
    paddingBottom: 96,
  },
});
