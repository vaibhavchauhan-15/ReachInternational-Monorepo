import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import { supabase } from '../../lib/supabase';
import {
  Wrench,
  AlertTriangle,
  Clock,
  ArrowRight,
  Gauge,
  Users,
  Bell,
  CheckCircle2,
  Building2,
  Calendar,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const { user, role, userProfile } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Live Metrics
  const [metrics, setMetrics] = useState({
    totalMachines: 0,
    rentedMachines: 0,
    breakdownMachines: 0,
    maintenanceMachines: 0,
    activeTasks: 0,
    unreadAlerts: 0,
  });

  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);

  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'Operator');

  const fetchDashboardData = useCallback(async () => {
    try {
      const [machinesRes, tasksRes, notifsRes] = await Promise.all([
        supabase
          .from('machines')
          .select('id, status, health_status'),
        supabase
          .from('tasks')
          .select('id, status')
          .eq('status', 'pending')
          .limit(20),
        supabase
          .from('notifications')
          .select('id, alert_type, status, created_at, error_message, machine:machines(model, serial_number)')
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const machineList = machinesRes.data || [];
      let rented = 0;
      let breakdown = 0;
      let maintenance = 0;

      machineList.forEach((m) => {
        const r = (m.status || '').toLowerCase();
        const h = (m.health_status || '').toLowerCase();
        if (r === 'rented') rented++;
        if (h === 'breakdown') breakdown++;
        if (h === 'under_maintenance' || r === 'maintenance') maintenance++;
      });

      setMetrics({
        totalMachines: machineList.length,
        rentedMachines: rented,
        breakdownMachines: breakdown,
        maintenanceMachines: maintenance,
        activeTasks: (tasksRes.data || []).length,
        unreadAlerts: (notifsRes.data || []).filter((n) => n.status !== 'sent').length,
      });

      setRecentAlerts(notifsRes.data || []);
    } catch (err) {
      console.warn('[DashboardScreen] Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="FIELD OPERATIONS"
        title={`Welcome, ${userName}`}
        subtitle="Real-time machinery status, fleet telemetry & shift dispatch"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary KPI Fleet Summary Grid */}
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>FLEET ASSET STATUS</Text>
        <View style={styles.kpiGrid}>
          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
                {isLoading ? '—' : metrics.totalMachines}
              </Text>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Fleet</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
                {isLoading ? '—' : metrics.rentedMachines}
              </Text>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>On Rent</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
                {isLoading ? '—' : metrics.breakdownMachines}
              </Text>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Breakdowns</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                {isLoading ? '—' : metrics.maintenanceMachines}
              </Text>
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Maintenance</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Quick Operational Shortcuts */}
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.md }]}>
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
                Record equipment HMR logs, review shift overtime & resolve conflicts
              </Text>
            </View>
            <ArrowRight size={16} color={theme.colors.mute} />
          </Card>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/operations' as any)}
          activeOpacity={0.8}
          style={styles.actionCardWrapper}
        >
          <Card variant="elevated" style={styles.actionCard}>
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
              <Users size={20} color={theme.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.colors.ink }]}>Operator Machine Roster</Text>
              <Text style={[styles.actionDesc, { color: theme.colors.mute }]}>
                Assign operators to machinery across Shift 1, Shift 2 & Shift 3
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
              <Text style={[styles.actionTitle, { color: theme.colors.ink }]}>Machine Directory</Text>
              <Text style={[styles.actionDesc, { color: theme.colors.mute }]}>
                Browse fleet assets, track meters, manage categories & export reports
              </Text>
            </View>
            <ArrowRight size={16} color={theme.colors.mute} />
          </Card>
        </TouchableOpacity>

        {/* Priority Field Dispatches Feed */}
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.md }]}>
          RECENT DISPATCH ALERTS
        </Text>

        {isLoading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.link} />
          </View>
        ) : recentAlerts.length === 0 ? (
          <Card variant="base" style={styles.emptyCard}>
            <CheckCircle2 size={24} color={theme.colors.success} style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyCardText, { color: theme.colors.ink }]}>All Dispatches Cleared</Text>
            <Text style={[styles.emptyCardSub, { color: theme.colors.mute }]}>
              No outstanding automated alert failures or pending maintenance notices.
            </Text>
          </Card>
        ) : (
          recentAlerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              onPress={() => router.push('/(app)/notifications' as any)}
              activeOpacity={0.8}
            >
              <Card variant="elevated" style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <Badge
                    status={alert.status === 'sent' ? 'active' : alert.status === 'failed' ? 'breakdown' : 'pending'}
                    customLabel={(alert.status || 'PENDING').toUpperCase()}
                  />
                  <Text style={[styles.alertTime, { color: theme.colors.mute }]}>
                    {formatDate(alert.created_at)}
                  </Text>
                </View>
                <Text style={[styles.alertTitle, { color: theme.colors.ink }]}>
                  {(alert.alert_type || 'System Dispatch').replace(/_/g, ' ').toUpperCase()}
                </Text>
                {alert.machine && (
                  <Text style={[styles.alertMeta, { color: theme.colors.mute }]}>
                    Machine: {alert.machine.model || 'Equipment'} ({alert.machine.serial_number || '—'})
                  </Text>
                )}
              </Card>
            </TouchableOpacity>
          ))
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
    paddingBottom: spacingNumeric.xl,
  },
  eyebrowHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCardWrapper: {
    width: '48.5%',
  },
  kpiCard: {
    padding: spacingNumeric.md,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  actionCardWrapper: {
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    gap: 12,
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
    fontWeight: '700',
  },
  actionDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  alertCard: {
    marginBottom: 8,
    padding: spacingNumeric.md,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTime: {
    fontSize: 11,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertMeta: {
    fontSize: 11,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: radiusNumeric.md,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCardSub: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});

