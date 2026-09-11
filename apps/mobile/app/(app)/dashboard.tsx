import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, useTheme, MobileHeader, Skeleton, HeaderActionItem } from '../../components/ui';
import { spacingNumeric } from '@reachinternational/design-tokens';
import { supabase } from '../../lib/supabase';
import {
  Wrench,
  AlertTriangle,
  Clock,
  ArrowRight,
  Gauge,
  Users,
  Building2,
  Calendar,
  Truck,
  RefreshCw,
  Search,
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
  });

  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'Operator');

  const fetchDashboardData = useCallback(async () => {
    try {
      const machinesRes = await supabase
        .from('machines')
        .select('id, status, health_status');

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
      });
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

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    list.push({
      id: 'view-machines',
      label: 'View Machine Directory',
      icon: <Truck size={16} color={theme.colors.ink} />,
      onPress: () => router.push('/(app)/machines' as any),
    });

    list.push({
      id: 'view-operations',
      label: 'View Fleet Operations',
      icon: <Gauge size={16} color={theme.colors.ink} />,
      onPress: () => router.push('/(app)/operations' as any),
    });

    list.push({
      id: 'refresh-dashboard',
      label: 'Refresh Dashboard Data',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => onRefresh(),
    });

    return list;
  }, [theme.colors.ink, router, onRefresh]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [Search] + [3-Dot Actions] */}
      <MobileHeader
        title={`Welcome, ${userName}`}
        searchPlaceholder="Search anything across platform..."
        actions={headerActions}
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
              {isLoading ? (
                <Skeleton width={44} height={26} borderRadius={4} style={{ marginVertical: 1 }} />
              ) : (
                <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
                  {metrics.totalMachines}
                </Text>
              )}
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Fleet</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              {isLoading ? (
                <Skeleton width={44} height={26} borderRadius={4} style={{ marginVertical: 1 }} />
              ) : (
                <Text style={[styles.kpiValue, { color: theme.colors.link }]}>
                  {metrics.rentedMachines}
                </Text>
              )}
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>On Rent</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              {isLoading ? (
                <Skeleton width={44} height={26} borderRadius={4} style={{ marginVertical: 1 }} />
              ) : (
                <Text style={[styles.kpiValue, { color: '#dc2626' }]}>
                  {metrics.breakdownMachines}
                </Text>
              )}
              <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Breakdowns</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCardWrapper}
            onPress={() => router.push('/(app)/machines' as any)}
            activeOpacity={0.7}
          >
            <Card variant="elevated" style={styles.kpiCard}>
              {isLoading ? (
                <Skeleton width={44} height={26} borderRadius={4} style={{ marginVertical: 1 }} />
              ) : (
                <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                  {metrics.maintenanceMachines}
                </Text>
              )}
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
});

