import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { UserDetailModal, type UserRecord } from '../../components/users/UserDetailModal';
import { CreateUserModal } from '../../components/users/CreateUserModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatTinyRelativeTime } from '@reachinternational/utils';
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
  Trash2,
  CheckSquare,
  Square,
  Mail,
  Clock,
  ChevronRight,
} from 'lucide-react-native';

function formatRoleName(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
    case 'branch_manager':
      return 'Manager';
    case 'service_manager':
      return 'Service Manager';
    case 'service_engineer':
    case 'engineer':
      return 'Service Engineer';
    case 'supervisor':
      return 'Supervisor';
    case 'store_manager':
      return 'Store Manager';
    case 'operator':
      return 'Operator';
    case 'mechanic':
      return 'Mechanic';
    case 'hr_manager':
      return 'HR Manager';
    default:
      return role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'User';
  }
}

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
        .select('id, full_name, email, phone, role, status, city, district, state, state_id, created_at')
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
    const prevUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'active' as const } : u))
    );
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (e) {
      setUsers(prevUsers);
      console.warn('Error approving user:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setApprovingId(userId);
    const prevUsers = [...users];
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (e) {
      setUsers(prevUsers);
      console.warn('Error rejecting user:', e);
    } finally {
      setApprovingId(null);
    }
  };

  const [isBulkApprovingMobile, setIsBulkApprovingMobile] = useState(false);
  const [isBulkRejectingMobile, setIsBulkRejectingMobile] = useState(false);

  const handleApproveAll = async () => {
    if (pendingUsers.length === 0) return;
    const pendingIds = pendingUsers.map((u) => u.id);
    const prevUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (pendingIds.includes(u.id) ? { ...u, status: 'active' } : u))
    );
    setIsBulkApprovingMobile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .in('id', pendingIds);
      if (error) throw error;
      fetchUsers();
    } catch (e) {
      setUsers(prevUsers);
      console.warn('Error bulk approving users:', e);
    } finally {
      setIsBulkApprovingMobile(false);
    }
  };

  const handleRejectAll = async () => {
    if (pendingUsers.length === 0) return;
    const pendingIds = pendingUsers.map((u) => u.id);
    const prevUsers = [...users];
    setUsers((prev) => prev.filter((u) => !pendingIds.includes(u.id)));
    setIsBulkRejectingMobile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .in('id', pendingIds);
      if (error) throw error;
      fetchUsers();
    } catch (e) {
      setUsers(prevUsers);
      console.warn('Error bulk rejecting users:', e);
    } finally {
      setIsBulkRejectingMobile(false);
    }
  };

  const openUserDetail = (u: UserRecord) => {
    setSelectedUser(u);
    setDetailModalVisible(true);
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeCount = users.filter((u) => u.status === 'active').length;
  const engineerCount = users.filter((u) => u.role === 'service_engineer' || u.role === 'engineer').length;

  // Multi-Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const toggleSelectUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Delete Users',
      `Are you sure you want to delete ${selectedIds.length} user account${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete (${selectedIds.length})`,
          style: 'destructive',
          onPress: async () => {
            setIsDeletingBulk(true);
            const prevUsers = [...users];
            const toDelete = [...selectedIds];
            setUsers((prev) => prev.filter((u) => !toDelete.includes(u.id)));

            try {
              const { error } = await supabase
                .from('users')
                .delete()
                .in('id', toDelete);

              if (error) throw error;
              setSelectedIds([]);
              setIsSelectMode(false);
              fetchUsers();
            } catch (err: any) {
              setUsers(prevUsers);
              Alert.alert('Error', err?.message || 'Failed to delete selected users.');
            } finally {
              setIsDeletingBulk(false);
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const qNoSpaces = q.replace(/\s+/g, '');
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.city && u.city.toLowerCase().includes(q)) ||
      (u.state && u.state.toLowerCase().includes(q)) ||
      (u.district && u.district.toLowerCase().includes(q)) ||
      (u.aadhaar_number && u.aadhaar_number.replace(/\s+/g, '').includes(qNoSpaces)) ||
      u.role?.toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'engineers' && (u.role === 'service_engineer' || u.role === 'engineer')) ||
      (roleFilter === 'managers' && (u.role.includes('manager') || u.role === 'admin' || u.role === 'super_admin')) ||
      (roleFilter === 'operators' && u.role === 'operator') ||
      (roleFilter === 'supervisors' && u.role === 'supervisor') ||
      (roleFilter === 'mechanics' && u.role === 'mechanic') ||
      (roleFilter === 'active' && u.status === 'active') ||
      (roleFilter === 'pending' && u.status === 'pending') ||
      (roleFilter === 'inactive' && u.status === 'inactive');

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                if (isSelectMode) {
                  setIsSelectMode(false);
                  setSelectedIds([]);
                } else {
                  setIsSelectMode(true);
                }
              }}
              style={[
                styles.addBtn,
                {
                  backgroundColor: isSelectMode ? theme.colors.canvasElevated : theme.colors.hairlineSoft,
                  borderWidth: 1,
                  borderColor: theme.colors.hairline,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.addBtnText, { color: isSelectMode ? theme.colors.link : theme.colors.body }]}>
                {isSelectMode ? 'Done' : 'Select'}
              </Text>
            </TouchableOpacity>

            {!isSelectMode && (
              <TouchableOpacity
                onPress={() => setCreateModalVisible(true)}
                style={[styles.addBtn, { backgroundColor: theme.colors.ink }]}
                activeOpacity={0.8}
              >
                <Plus size={14} color={theme.colors.canvas} />
                <Text style={[styles.addBtnText, { color: theme.colors.canvas }]}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
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

        {/* Role & Status Filter Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { key: 'all', label: `All Users (${users.length})` },
            { key: 'active', label: `Active (${activeCount})` },
            { key: 'pending', label: `Pending (${pendingUsers.length})` },
            { key: 'engineers', label: `Engineers (${engineerCount})` },
            { key: 'operators', label: 'Operators' },
            { key: 'mechanics', label: 'Mechanics' },
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
            <View style={[styles.pendingHeaderRow, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} color={theme.colors.warning} />
                <Text style={[styles.pendingTitle, { color: theme.colors.ink }]}>Pending User Approvals</Text>
                <Badge status="pending" customLabel={`${pendingUsers.length} Pending`} />
              </View>
              {pendingUsers.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Button
                    label={`Accept All (${pendingUsers.length})`}
                    onPress={handleApproveAll}
                    isLoading={isBulkApprovingMobile}
                    variant="primary"
                    size="sm"
                  />
                  <Button
                    label="Reject All"
                    onPress={handleRejectAll}
                    isLoading={isBulkRejectingMobile}
                    variant="ghost"
                    size="sm"
                  />
                </View>
              )}
            </View>

            {pendingUsers.map((p) => (
              <Card key={p.id} style={styles.pendingCard}>
                <View style={styles.pendingCardLeft}>
                  <View style={[styles.avatarCircle, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline, borderWidth: 1 }]}>
                    <Text style={[styles.avatarLetter, { color: theme.colors.ink }]}>
                      {p.full_name ? p.full_name[0].toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={[styles.pendingName, { color: theme.colors.ink }]}>{p.full_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={[styles.pendingRoleChip, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
                          <Text style={[styles.pendingRoleChipText, { color: theme.colors.link }]}>
                            {formatRoleName(p.role)}
                          </Text>
                        </View>
                        {p.created_at ? (
                          <View style={[styles.pendingTimeChip, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
                            <Clock size={9} color={theme.colors.warning} />
                            <Text style={[styles.pendingTimeChipText, { color: theme.colors.warning }]}>
                              {formatTinyRelativeTime(p.created_at)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Mail size={11} color={theme.colors.mute} />
                      <Text style={[styles.pendingEmail, { color: theme.colors.mute }]}>{p.email}</Text>
                    </View>
                    {p.phone ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} color={theme.colors.mute} />
                        <Text style={[styles.pendingEmail, { color: theme.colors.mute }]}>{p.phone}</Text>
                      </View>
                    ) : null}
                    {p.city ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} color={theme.colors.mute} />
                        <Text style={[styles.pendingEmail, { color: theme.colors.mute }]}>{p.city}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.pendingActions}>
                  <Button
                    label="Approve"
                    onPress={() => handleApprove(p.id)}
                    isLoading={approvingId === p.id}
                    variant="primary"
                    size="sm"
                  />
                  <Button
                    label="Reject"
                    onPress={() => handleReject(p.id)}
                    variant="ghost"
                    size="sm"
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
          filteredUsers.map((u) => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => {
                  if (isSelectMode) {
                    toggleSelectUser(u.id);
                  } else {
                    openUserDetail(u);
                  }
                }}
                onLongPress={() => {
                  if (!isSelectMode) {
                    setIsSelectMode(true);
                    setSelectedIds([u.id]);
                  }
                }}
                activeOpacity={0.8}
              >
                <Card
                  style={[
                    styles.userCard,
                    isSelectMode && isSelected
                      ? { borderColor: theme.colors.link, borderWidth: 1.5, backgroundColor: theme.colors.canvasElevated }
                      : null,
                  ]}
                >
                  <View style={styles.userHeader}>
                    <View style={styles.userAvatarRow}>
                      {isSelectMode ? (
                        <View style={{ marginRight: 2 }}>
                          {isSelected ? (
                            <CheckSquare size={20} color={theme.colors.link} />
                          ) : (
                            <Square size={20} color={theme.colors.mute} />
                          )}
                        </View>
                      ) : (
                        <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                          <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                            {u.full_name ? u.full_name[0].toUpperCase() : 'U'}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userName, { color: theme.colors.ink }]}>{u.full_name}</Text>
                        <Text style={[styles.userEmail, { color: theme.colors.mute }]}>{u.email}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge status={u.status === 'active' ? 'active' : 'inactive'} customLabel={u.status.toUpperCase()} />
                      <ChevronRight size={16} color={theme.colors.mute} />
                    </View>
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
            );
          })
        )}
      </ScrollView>

      {/* Floating Bulk Actions Bar for Mobile */}
      {isSelectMode && selectedIds.length > 0 && (
        <View
          style={[
            styles.mobileBulkBar,
            {
              backgroundColor: theme.colors.ink,
              shadowColor: '#000',
            },
          ]}
        >
          <View style={styles.bulkCountRow}>
            <View style={[styles.bulkBadge, { backgroundColor: theme.colors.link }]}>
              <Text style={[styles.bulkBadgeText, { color: '#ffffff' }]}>{selectedIds.length}</Text>
            </View>
            <Text style={[styles.bulkSelectedText, { color: '#ffffff' }]}>selected</Text>
          </View>

          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              onPress={handleSelectAll}
              style={[styles.bulkBtnSecondary, { borderColor: 'rgba(255,255,255,0.2)' }]}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                {selectedIds.length === filteredUsers.length ? 'Deselect' : 'All'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBulkDelete}
              disabled={isDeletingBulk}
              style={[styles.bulkBtnDanger, { backgroundColor: theme.colors.error }]}
              activeOpacity={0.8}
            >
              <Trash2 size={14} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                Delete ({selectedIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  pendingRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pendingRoleLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  pendingRoleChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  pendingRoleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  pendingTimeChipText: {
    fontSize: 10,
    fontWeight: '700',
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
  mobileBulkBar: {
    position: 'absolute',
    bottom: 24,
    left: spacingNumeric.md,
    right: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    padding: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  bulkCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bulkSelectedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkBtnSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  bulkBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
  },
});
