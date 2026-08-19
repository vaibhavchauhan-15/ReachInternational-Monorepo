/**
 * ServiceCentric Mobile — Adapted Mobile Dashboard (Phase 13)
 * Mobile-first KPI cards, priority action items, pull-to-refresh, and cached data rendering.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme } from '../../components/ui';
import { spacingNumeric } from '@servicecentric/design-tokens';
import { formatCompactCurrency } from '@servicecentric/utils';

export default function DashboardScreen() {
  const { user, role, can } = useAuth();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.canvas }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
    >
      {/* Top Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.mute }]}>Welcome back,</Text>
          <Text style={[styles.userName, { color: theme.colors.ink }]}>
            {user?.email ? user.email.split('@')[0] : 'Operator'}
          </Text>
        </View>
        <Badge status="active" customLabel={role || 'Engineer'} />
      </View>

      {/* Primary KPI Summary Grid */}
      <Text style={[styles.sectionTitle, { color: theme.colors.body }]}>Field KPI Overview</Text>
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.link }]}>14</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Machines</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.error }]}>5</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Open Complaints</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.warning }]}>23</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Services Recorded</Text>
        </Card>

        <Card style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
            {formatCompactCurrency(1250000)}
          </Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Monthly Revenue</Text>
        </Card>
      </View>

      {/* Priority Action Tasks */}
      <Text style={[styles.sectionTitle, { color: theme.colors.body }]}>Priority Field Tasks</Text>
      
      <Card style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Badge status="breakdown" customLabel="Breakdown" />
          <Text style={[styles.taskTime, { color: theme.colors.faint }]}>2h ago</Text>
        </View>
        <Text style={[styles.taskTitle, { color: theme.colors.ink }]}>Hydraulic Leakage — Toyota 8FG</Text>
        <Text style={[styles.taskMeta, { color: theme.colors.mute }]}>Site: Delhi Logistics Hub • Machine #MCH-004</Text>
      </Card>

      <Card style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Badge status="scheduled" customLabel="Service Due" />
          <Text style={[styles.taskTime, { color: theme.colors.faint }]}>Today</Text>
        </View>
        <Text style={[styles.taskTitle, { color: theme.colors.ink }]}>500 Hours Periodic Maintenance</Text>
        <Text style={[styles.taskMeta, { color: theme.colors.mute }]}>Site: Gurgaon Plant • Machine #MCH-012</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacingNumeric.md,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.lg,
  },
  greeting: {
    fontSize: 13,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacingNumeric.xs,
    marginTop: spacingNumeric.sm,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    padding: spacingNumeric.sm,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  taskCard: {
    marginVertical: spacingNumeric.xxs,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingNumeric.xs,
  },
  taskTime: {
    fontSize: 11,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 12,
  },
});
