import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useAuth } from '../../lib/auth/useAuth';
import { Card, Badge, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric } from '@servicecentric/design-tokens';
import { formatCompactCurrency } from '@servicecentric/utils';

export default function DashboardScreen() {
  const { user, role } = useAuth();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const userName = user?.email ? user.email.split('@')[0] : 'Operator';

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader
        eyebrow="FIELD OPERATIONS"
        title={`Welcome, ${userName}`}
        subtitle="Real-time machinery status & operational overview"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* Primary KPI Summary Grid */}
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute }]}>KEY METRICS OVERVIEW</Text>
        <View style={styles.kpiGrid}>
          <Card variant="elevated" style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: theme.colors.link }]}>14</Text>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Machines</Text>
          </Card>

          <Card variant="elevated" style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: theme.colors.error }]}>5</Text>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Open Complaints</Text>
          </Card>

          <Card variant="elevated" style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: theme.colors.warning }]}>23</Text>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Services Recorded</Text>
          </Card>

          <Card variant="elevated" style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
              {formatCompactCurrency(1250000)}
            </Text>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Monthly Revenue</Text>
          </Card>
        </View>

        {/* Priority Action Tasks */}
        <Text style={[styles.eyebrowHeader, { color: theme.colors.mute, marginTop: spacingNumeric.lg }]}>
          PRIORITY FIELD TASKS
        </Text>
        
        <Card variant="base" style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <Badge status="breakdown" customLabel="Breakdown" />
            <Text style={[styles.taskTime, { color: theme.colors.faint }]}>2h ago</Text>
          </View>
          <Text style={[styles.taskTitle, { color: theme.colors.ink }]}>Hydraulic Leakage — Toyota 8FG</Text>
          <Text style={[styles.taskMeta, { color: theme.colors.mute }]}>Site: Delhi Logistics Hub • Machine #MCH-004</Text>
        </Card>

        <Card variant="base" style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <Badge status="scheduled" customLabel="Service Due" />
            <Text style={[styles.taskTime, { color: theme.colors.faint }]}>Today</Text>
          </View>
          <Text style={[styles.taskTitle, { color: theme.colors.ink }]}>500 Hours Periodic Maintenance</Text>
          <Text style={[styles.taskMeta, { color: theme.colors.mute }]}>Site: Gurgaon Plant • Machine #MCH-012</Text>
        </Card>
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacingNumeric.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    padding: spacingNumeric.md,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    fontWeight: '500',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 12,
  },
});
