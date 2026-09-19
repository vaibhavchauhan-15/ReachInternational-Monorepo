import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, useTheme, MobileHeader, Skeleton, HeaderActionItem, Badge } from '../../components/ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  Wrench,
  AlertTriangle,
  ArrowRight,
  Gauge,
  RefreshCw,
} from 'lucide-react-native';
import {
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
  const router = useRouter();

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

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [
      {
        id: 'refresh-dashboard',
        label: 'Refresh Dashboard',
        icon: <RefreshCw size={16} color={theme.colors.ink} />,
        onPress: () => onRefresh(),
      },
    ];

    if (activeRole !== 'operator') {
      list.push({
        id: 'view-machines',
        label: 'Machine Directory',
        icon: <Wrench size={16} color={theme.colors.ink} />,
        onPress: () => router.push('/(app)/machines' as any),
      });
      list.push({
        id: 'view-operations',
        label: 'Fleet Operations',
        icon: <Gauge size={16} color={theme.colors.ink} />,
        onPress: () => router.push('/(app)/operations' as any),
      });
    }

    return list;
  }, [theme.colors.ink, activeRole, router, onRefresh]);

  // Extract alerts for the active role
  const alerts: DashboardAlert[] = useMemo(() => {
    if (activeRole === 'super_admin') return superAdminData?.alerts || [];
    if (activeRole === 'admin') return adminData?.alerts || [];
    if (activeRole === 'manager') return managerData?.alerts || [];
    if (activeRole === 'supervisor') return supervisorData?.alerts || [];
    if (activeRole === 'hr') return hrData?.alerts || [];
    if (activeRole === 'operator') return operatorData?.alerts || [];
    return [];
  }, [activeRole, superAdminData, adminData, managerData, supervisorData, hrData, operatorData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        title={`Welcome, ${userName}`}
        searchPlaceholder="Search platform..."
        actions={headerActions}
      />

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
        {/* Alerts Banner if any */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>
              ALERT
            </Text>
            {alerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isWarn = alert.severity === 'warning';
              const bg = isCrit
                ? 'rgba(239, 68, 68, 0.1)'
                : isWarn
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(0, 112, 243, 0.1)';
              const border = isCrit
                ? 'rgba(239, 68, 68, 0.25)'
                : isWarn
                ? 'rgba(245, 158, 11, 0.25)'
                : 'rgba(0, 112, 243, 0.25)';
              const textColor = isCrit ? '#dc2626' : isWarn ? '#d97706' : theme.colors.link;

              return (
                <TouchableOpacity
                  key={alert.id}
                  style={[styles.alertCard, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => {
                    if (alert.actionUrl) {
                      const target = alert.actionUrl.startsWith('/operations')
                        ? '/(app)/operations'
                        : alert.actionUrl.startsWith('/machines')
                        ? '/(app)/machines'
                        : '/(app)/users';
                      router.push(target as any);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <AlertTriangle size={18} color={textColor} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: textColor }]}>
                      {alert.title}
                    </Text>
                    {alert.description && (
                      <Text style={[styles.alertDesc, { color: theme.colors.mute }]}>
                        {alert.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ---------------- ROLE-SPECIFIC DASHBOARD VIEWS ---------------- */}
        {activeRole === 'operator' && <OperatorDashboardCard data={operatorData} />}
        {activeRole === 'supervisor' && <SupervisorDashboardCard data={supervisorData} />}
        {activeRole === 'manager' && <ManagerDashboardCard data={managerData} />}
        {activeRole === 'admin' && <AdminDashboardCard data={adminData} />}
        {activeRole === 'super_admin' && <SuperAdminDashboardCard data={superAdminData} />}
        {activeRole === 'hr' && <HRDashboardCard data={hrData} />}

        {/* Quick Nav Workflows (Common to non-operators) */}
        {activeRole !== 'operator' && (
          <>
            <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.lg }]}>
              OPERATIONAL WORKFLOWS
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/(app)/operations' as any)}
              activeOpacity={0.8}
              style={styles.actionCardWrapper}
            >
              <Card variant="elevated" style={styles.actionCard}>
                <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(0, 112, 243, 0.08)' }]}>
                  <Gauge size={20} color={theme.colors.link} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, { color: theme.colors.ink }]}>Daily Running Hours</Text>
                  <Text style={[styles.actionDesc, { color: theme.colors.mute }]}>
                    Review operator logs, verify meters & analyze site runtime
                  </Text>
                </View>
                <ArrowRight size={16} color={theme.colors.mute} />
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(app)/machines' as any)}
              activeOpacity={0.8}
              style={styles.actionCardWrapper}
            >
              <Card variant="elevated" style={styles.actionCard}>
                <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.08)' }]}>
                  <Wrench size={20} color="#6366f1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, { color: theme.colors.ink }]}>Machinery Fleet</Text>
                  <Text style={[styles.actionDesc, { color: theme.colors.mute }]}>
                    Browse equipment inventory, track meters & check status
                  </Text>
                </View>
                <ArrowRight size={16} color={theme.colors.mute} />
              </Card>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    paddingBottom: spacingNumeric['2xl'],
  },
  section: {
    marginBottom: spacingNumeric.md,
  },
  eyebrowHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: spacingNumeric.sm + 4,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  actionCardWrapper: {
    marginBottom: spacingNumeric.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
  },
});
