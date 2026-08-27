import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { UserDetailModal, type UserRecord } from '../../components/users/UserDetailModal';
import { CreateUserModal } from '../../components/users/CreateUserModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Users,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Phone,
  MapPin,
  Check,
  X,
} from 'lucide-react-native';

export default function UsersScreen() {
  const { theme } = useTheme();
  const { role } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, role, status, city, district, state, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching users:', error);
      } else if (data) {
        setUsers(data as any);
      }
    } catch (err) {
      console.error('Error fetching live users:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (userId: string) => {
    setApprovingId(userId);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (e) {
      console.warn('Error approving user:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setApprovingId(userId);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (e) {
      console.warn('Error rejecting user:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const openUserDetail = (u: UserRecord) => {
    setSelectedUser(u);
    setDetailModalVisible(true);
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeCount = users.filter((u) => u.status === 'active').length;
  const engineerCount = users.filter((u) => u.role === 'service_engineer' || u.role === 'engineer').length;

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.city && u.city.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'engineers' && (u.role === 'service_engineer' || u.role === 'engineer')) ||
      (roleFilter === 'managers' && (u.role.includes('manager') || u.role === 'admin' || u.role === 'super_admin')) ||
      (roleFilter === 'operators' && u.role === 'operator') ||
      (roleFilter === 'supervisors' && u.role === 'supervisor');

    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Header */}
      <MobileHeader
        eyebrow="STAFF DIRECTORY"
        title="Employee & User Accounts"
        subtitle="Manage organization staff, role authorizations & account approvals"
        rightAction={
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            style={[styles.addBtn, { backgroundColor: theme.colors.ink }]}
            activeOpacity={0.8}
          >
            <Plus size={14} color={theme.colors.canvas} />
            <Text style={[styles.addBtnText, { color: theme.colors.canvas }]}>Invite</Text>
          </TouchableOpacity>
        }
      />

      {/* Search and Filters */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <Input
          placeholder="Search user by name, email, phone, city, role..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={theme.colors.mute} />}
          containerStyle={styles.searchInput}
        />

        {/* Role Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: `All Roles (${users.length})` },
            { key: 'engineers', label: `Engineers (${engineerCount})` },
            { key: 'operators', label: 'Operators' },
            { key: 'supervisors', label: 'Supervisors' },
            { key: 'managers', label: 'Managers & Admins' },
          ].map((f) => {
            const isActive = roleFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setRoleFilter(f.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: isActive ? theme.colors.onPrimary : theme.colors.body }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed Content */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
      >
        {/* Metric Snapshot Counters */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Total Users</Text>
              <Users size={14} color={theme.colors.ink} />
            </View>
            <Text style={[styles.metricVal, { color: theme.colors.ink }]}>{users.length}</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.success }]}>Active</Text>
              <UserCheck size={14} color={theme.colors.success} />
            </View>
            <Text style={[styles.metricVal, { color: theme.colors.success }]}>{activeCount}</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.link }]}>Engineers</Text>
              <ShieldCheck size={14} color={theme.colors.link} />
            </View>
            <Text style={[styles.metricVal, { color: theme.colors.link }]}>{engineerCount}</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: theme.colors.warning }]}>Pending</Text>
              <ShieldAlert size={14} color={theme.colors.warning} />
            </View>
            <Text style={[styles.metricVal, { color: theme.colors.warning }]}>{pendingUsers.length}</Text>
          </Card>
        </View>

        {/* Pending Approvals Section */}
        {pendingUsers.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingHeaderRow}>
              <ShieldAlert size={16} color={theme.colors.warning} />
              <Text style={[styles.pendingTitle, { color: theme.colors.ink }]}>Pending User Approvals</Text>
              <Badge status="pending" customLabel={String(pendingUsers.length)} />
            </View>

            {pendingUsers.map((p) => (
              <Card key={p.id} style={styles.pendingCard}>
                <View style={styles.pendingCardLeft}>
                  <View style={[styles.avatarCircle, { backgroundColor: theme.colors.hairlineSoft }]}>
                    <Text style={[styles.avatarLetter, { color: theme.colors.ink }]}>
                      {p.full_name ? p.full_name[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pendingName, { color: theme.colors.ink }]}>{p.full_name}</Text>
                    <Text style={[styles.pendingEmail, { color: theme.colors.mute }]}>{p.email}</Text>
                    <Text style={[styles.pendingRole, { color: theme.colors.link }]}>
                      Requested: {p.role.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.pendingActions}>
                  <Button
                    label="Approve"
                    onPress={() => handleApprove(p.id)}
                    isLoading={approvingId === p.id}
                    variant="primary"
                    size="sm"
                    icon={<Check size={12} color={theme.colors.onPrimary} />}
                  />
                  <Button
                    label="Reject"
                    onPress={() => handleReject(p.id)}
                    variant="ghost"
                    size="sm"
                    icon={<X size={12} color={theme.colors.error} />}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* All Users Feed */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading user accounts...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Users size={32} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No user accounts found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              Try adjusting your search criteria or role filters.
            </Text>
          </View>
        ) : (
          filteredUsers.map((u) => (
            <TouchableOpacity
              key={u.id}
              onPress={() => openUserDetail(u)}
              activeOpacity={0.8}
            >
              <Card style={styles.userCard}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatarRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                      <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                        {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: theme.colors.ink }]}>{u.full_name}</Text>
                      <Text style={[styles.userEmail, { color: theme.colors.mute }]}>{u.email}</Text>
                    </View>
                  </View>

                  <Badge status={u.status === 'active' ? 'active' : 'inactive'} customLabel={u.status.toUpperCase()} />
                </View>

                {/* Sub details */}
                <View style={[styles.specsWell, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.subDetailRow}>
                    <Badge status="available" customLabel={u.role.replace('_', ' ').toUpperCase()} />
                    {u.phone && (
                      <View style={styles.metaItem}>
                        <Phone size={11} color={theme.colors.mute} />
                        <Text style={[styles.metaText, { color: theme.colors.body }]}>{u.phone}</Text>
                      </View>
                    )}
                  </View>

                  {(u.city || u.state) && (
                    <View style={[styles.metaItem, { marginTop: 4 }]}>
                      <MapPin size={11} color={theme.colors.mute} />
                      <Text style={[styles.metaText, { color: theme.colors.body }]}>
                        {[u.city, u.district, u.state].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* User Detail Action Bottom Sheet */}
      <UserDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      {/* Create User Modal */}
      <CreateUserModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={fetchUsers}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchFilterContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.xs,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
    gap: spacingNumeric.xs,
  },
  searchInput: { marginBottom: 0 },
  filterScroll: { gap: spacingNumeric.xs, paddingVertical: 2 },
  filterPill: {
    paddingHorizontal: spacingNumeric.sm + 2,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  feedContent: { padding: spacingNumeric.md, paddingBottom: 40, gap: spacingNumeric.md },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 8,
    gap: 2,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  pendingSection: {
    gap: 8,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 2,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingCard: {
    padding: spacingNumeric.sm,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f5a623',
  },
  pendingCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
  },
  pendingName: {
    fontSize: 14,
    fontWeight: '700',
  },
  pendingEmail: {
    fontSize: 11,
  },
  pendingRole: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  userCard: {
    padding: spacingNumeric.sm + 2,
    gap: spacingNumeric.xs,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
  },
  specsWell: {
    padding: spacingNumeric.xs + 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  subDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  emptyContainer: { padding: 32, borderRadius: radiusNumeric.md, borderWidth: 1, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtext: { fontSize: 12, textAlign: 'center' },
});
