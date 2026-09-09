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
  User,
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

function truncateText(str?: string | null, maxChars: number = 15): string {
  if (!str) return '';
  return str.length > maxChars ? `${str.slice(0, maxChars)}…` : str;
}

function sanitizeSearchToken(token: string): string {
  return token
    .replace(/[,()"]/g, '')
    .replace(/[\\%_]/g, '\\$&')
    .trim();
}

function applyOptimizedUserSearch(query: any, search?: string) {
  if (!search) return query;
  const trimmed = search.trim();
  if (trimmed.length === 0) return query;

  const sanitized = sanitizeSearchToken(trimmed);
  if (!sanitized) return query;

  // Single-character fast prefix search: hits B-Tree index on prefix without full table scan
  if (trimmed.length === 1) {
    return query.or(`full_name.ilike.${sanitized}%,email.ilike.${sanitized}%,role.ilike.${sanitized}%`);
  }

  // 1. Phone or Aadhaar search: input consists mostly of numbers, +, -, spaces, ()
  const isDigitsOnly = /^[0-9+\s\-()]+$/.test(trimmed);
  const digits = trimmed.replace(/\D/g, '');

  if (isDigitsOnly && digits.length >= 3) {
    let phoneDigits = digits;
    if (digits.length === 12 && digits.startsWith('91')) {
      phoneDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      phoneDigits = digits.slice(1);
    }

    const conditions: string[] = [];
    if (phoneDigits.length >= 3) {
      conditions.push(`phone.ilike.%${phoneDigits}%`);
    }
    if (digits.length >= 4) {
      conditions.push(`aadhaar_number.ilike.%${digits}%`);
    }
    conditions.push(`license_number.ilike.%${sanitized}%`);
    conditions.push(`full_name.ilike.%${sanitized}%`);

    return query.or(conditions.join(','));
  }

  // 2. Email search: contains @ or domain ending
  if (trimmed.includes('@') || trimmed.endsWith('.com') || trimmed.endsWith('.in')) {
    return query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  // 3. Multi-token or Role search
  const words = trimmed.split(/\s+/).map(sanitizeSearchToken).filter((w) => w.length >= 2);
  const roleSlug = sanitized.toLowerCase().replace(/\s+/g, '_');
  const isKnownRole = [
    'super_admin',
    'admin',
    'service_manager',
    'service_engineer',
    'engineer',
    'supervisor',
    'store_manager',
    'hr_manager',
    'operator',
    'mechanic',
    'manager',
    'branch_manager',
  ].some((r) => r === roleSlug || r.includes(roleSlug) || roleSlug.includes(r));

  if (words.length > 1) {
    if (isKnownRole) {
      return query.or(`role.ilike.%${roleSlug}%,full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
    }

    // Composite multi-token AND matching across name, role, city, district, state, email
    for (const word of words) {
      const wRole = word.toLowerCase().replace(/s$/, '');
      query = query.or(
        `full_name.ilike.%${word}%,role.ilike.%${wRole}%,city.ilike.%${word}%,district.ilike.%${word}%,state.ilike.%${word}%,email.ilike.%${word}%`
      );
    }
    return query;
  }

  // 4. Single-token text search
  const roleVariant = sanitized.toLowerCase().replace(/s$/, '');
  const conditions = [
    `full_name.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `role.ilike.%${sanitized}%`,
    `city.ilike.%${sanitized}%`,
    `district.ilike.%${sanitized}%`,
    `state.ilike.%${sanitized}%`,
    `license_number.ilike.%${sanitized}%`,
  ];

  if (roleVariant !== sanitized.toLowerCase()) {
    conditions.push(`role.ilike.%${roleVariant}%`);
  }

  if (digits.length >= 3) {
    conditions.push(`phone.ilike.%${digits}%`);
    conditions.push(`aadhaar_number.ilike.%${digits}%`);
  }

  return query.or(conditions.join(','));
}

export default function UsersScreen() {
  const { theme } = useTheme();
  const { role } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms debounce: search automatically when user pauses
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length === 0) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const isSearchingDebounce = search.trim() !== debouncedSearch;
  const showLoading = isLoading || isSearchingDebounce;

  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const PAGE_SIZE = 20;

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [approvingProfileId, setApprovingProfileId] = useState<string | null>(null);
  const [isBulkApprovingProfile, setIsBulkApprovingProfile] = useState(false);
  const [isBulkRejectingProfile, setIsBulkRejectingProfile] = useState(false);

  const fetchUsers = useCallback(async (isLoadMore = false, currentPage = 1) => {
    if (!isLoadMore) {
      setIsLoading(true);
    } else {
      setIsPaginating(true);
    }
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('users')
        .select('id, full_name, email, phone, role, status, city, district, state, state_id, shift_time, address, aadhaar_number, license_number, supervisor_id, supervisor_ids, working_location_id, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (roleFilter !== 'all') {
        if (roleFilter === 'engineers') query = query.in('role', ['engineer', 'service_engineer']);
        else if (roleFilter === 'managers') query = query.in('role', ['manager', 'branch_manager', 'admin', 'super_admin']);
        else if (roleFilter === 'operators') query = query.eq('role', 'operator');
        else if (roleFilter === 'mechanics') query = query.eq('role', 'mechanic');
        else if (roleFilter === 'supervisors') query = query.eq('role', 'supervisor');
        else if (roleFilter === 'active') query = query.eq('status', 'active');
        else if (roleFilter === 'pending') query = query.eq('status', 'pending');
      }

      query = applyOptimizedUserSearch(query, debouncedSearch);


      const { data, count, error } = await query.range(from, to);
      if (count !== null) setTotalUsersCount(count);

      if (error) {
        console.warn('Error fetching users:', error);
      } else if (data) {
        const userMap = new Map((data as any[]).map((u) => [u.id, u]));

        // Fetch working locations to hydrate working_location
        let workingLocMap = new Map<string, any>();
        try {
          const { data: locs } = await supabase.from('working_locations').select('id, name, type, city, state');
          if (locs) {
            workingLocMap = new Map(locs.map((l: any) => [l.id, l]));
          }
        } catch {
          // ignore if table not accessible
        }

        const hydrated = (data as any[]).map((u) => {
          const supIds: string[] = Array.isArray(u.supervisor_ids) && u.supervisor_ids.length > 0
            ? u.supervisor_ids
            : u.supervisor_id
            ? [u.supervisor_id]
            : [];
          const supervisorsList = supIds
            .map((id) => userMap.get(id))
            .filter(Boolean)
            .map((s) => ({
              id: s.id,
              full_name: s.full_name || '',
              email: s.email || null,
            }));
          const primarySup = (u.supervisor_id && userMap.has(u.supervisor_id))
            ? {
                id: u.supervisor_id,
                full_name: userMap.get(u.supervisor_id)?.full_name || '',
                email: userMap.get(u.supervisor_id)?.email || null,
              }
            : supervisorsList[0] || null;

          return {
            ...u,
            supervisor_id: primarySup?.id || null,
            supervisor_ids: supIds,
            supervisor: primarySup,
            supervisors: supervisorsList,
            working_location: u.working_location_id && workingLocMap.has(u.working_location_id)
              ? workingLocMap.get(u.working_location_id)
              : null,
          };
        });
        if (isLoadMore) {
          setUsers((prev) => [...prev, ...(hydrated as any)]);
        } else {
          setUsers(hydrated as any);
        }
        setHasMore((hydrated?.length || 0) === PAGE_SIZE);
      }

      // Fetch pending profile change requests
      try {
        const { data: pReqs } = await supabase
          .from('profile_change_requests')
          .select(`
            id,
            user_id,
            requester_role,
            current_data,
            requested_data,
            target_approver_role,
            status,
            created_at,
            user:users!profile_change_requests_user_id_fkey(id, full_name, email, role, phone)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (pReqs) {
          setProfileRequests(pReqs);
        }
      } catch (pErr) {
        console.warn('Note on fetching profile change requests:', pErr);
      }
    } catch (err) {
      console.error('Error fetching live users:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsPaginating(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchUsers(false, 1);
  }, [fetchUsers, debouncedSearch, roleFilter, statusFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchUsers(false, 1);
  }, [fetchUsers]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isPaginating) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchUsers(true, nextPage);
  }, [page, hasMore, isPaginating, fetchUsers]);

  const handleApproveProfileReq = async (reqId: string, reqData: any, userId: string) => {
    setApprovingProfileId(reqId);
    try {
      // 1. Update user row
      const { error: userErr } = await supabase
        .from('users')
        .update({
          ...reqData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (userErr) throw userErr;

      // 2. Mark request approved
      const { error: reqErr } = await supabase
        .from('profile_change_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      if (reqErr) throw reqErr;

      Alert.alert('Approved', 'Profile changes have been approved and applied.');
      fetchUsers(false, 1);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to approve profile changes.');
    } finally {
      setApprovingProfileId(null);
    }
  };

  const handleRejectProfileReq = async (reqId: string) => {
    setApprovingProfileId(reqId);
    try {
      const { error } = await supabase
        .from('profile_change_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      if (error) throw error;
      Alert.alert('Rejected', 'Profile change request has been declined.');
      fetchUsers(false, 1);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject profile changes.');
    } finally {
      setApprovingProfileId(null);
    }
  };

  const handleApproveAllProfileReqs = async () => {
    if (profileRequests.length === 0) return;
    setIsBulkApprovingProfile(true);
    try {
      for (const pr of profileRequests) {
        await supabase
          .from('users')
          .update({
            ...pr.requested_data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pr.user_id);

        await supabase
          .from('profile_change_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', pr.id);
      }
      Alert.alert('Success', `Approved all ${profileRequests.length} profile requests.`);
      fetchUsers(false, 1);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to bulk approve profile requests.');
    } finally {
      setIsBulkApprovingProfile(false);
    }
  };

  const handleRejectAllProfileReqs = async () => {
    if (profileRequests.length === 0) return;
    setIsBulkRejectingProfile(true);
    try {
      const reqIds = profileRequests.map((r) => r.id);
      await supabase
        .from('profile_change_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .in('id', reqIds);

      Alert.alert('Success', `Rejected all ${profileRequests.length} profile requests.`);
      fetchUsers(false, 1);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to bulk reject profile requests.');
    } finally {
      setIsBulkRejectingProfile(false);
    }
  };

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
      fetchUsers(false, 1);
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
      fetchUsers(false, 1);
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
      fetchUsers(false, 1);
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
      fetchUsers(false, 1);
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
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
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
              fetchUsers(false, 1);
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
            { key: 'all', label: `All Users (${totalUsersCount})` },
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

        {/* Profile Detail Change Requests Section */}
        {profileRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={[styles.pendingHeaderRow, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#6366f1" />
                <Text style={[styles.pendingTitle, { color: theme.colors.ink }]}>Profile Change Requests</Text>
                <Badge status="pending" customLabel={`${profileRequests.length} Pending`} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Button
                  label={`Accept All (${profileRequests.length})`}
                  onPress={handleApproveAllProfileReqs}
                  isLoading={isBulkApprovingProfile}
                  variant="primary"
                  size="sm"
                />
                <Button
                  label="Reject All"
                  onPress={handleRejectAllProfileReqs}
                  isLoading={isBulkRejectingProfile}
                  variant="ghost"
                  size="sm"
                />
              </View>
            </View>

            {profileRequests.map((pr) => {
              const reqUser = pr.user || pr.current_data || {};
              const reqData = pr.requested_data || {};
              const currData = pr.current_data || {};
              const isApproving = approvingProfileId === pr.id;

              return (
                <Card key={pr.id} style={[styles.pendingCard, { borderLeftWidth: 3, borderLeftColor: '#6366f1' }]}>
                  <View style={{ gap: 8 }}>
                    {/* User Info Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.avatarCircle, { backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1 }]}>
                          <Text style={[styles.avatarLetter, { color: '#6366f1' }]}>
                            {reqUser.full_name ? reqUser.full_name[0].toUpperCase() : 'U'}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.pendingName, { color: theme.colors.ink }]}>{reqUser.full_name || 'User'}</Text>
                          <Text style={[styles.pendingEmail, { color: theme.colors.mute }]}>{reqUser.email}</Text>
                        </View>
                      </View>
                      <View style={[styles.pendingTimeChip, { backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }]}>
                        <Clock size={9} color="#6366f1" />
                        <Text style={[styles.pendingTimeChipText, { color: '#6366f1' }]}>
                          {pr.created_at ? formatTinyRelativeTime(pr.created_at) : 'Just now'}
                        </Text>
                      </View>
                    </View>

                    {/* Diffs Summary */}
                    <View style={{ backgroundColor: theme.colors.canvasElevated, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.hairline }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.mute, textTransform: 'uppercase', marginBottom: 4 }}>
                        Requested Changes:
                      </Text>
                      {reqData.full_name && reqData.full_name !== currData.full_name && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Name: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.full_name || '—'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.success }}>{reqData.full_name}</Text>
                        </Text>
                      )}
                      {reqData.shift_time && reqData.shift_time !== currData.shift_time && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Shift: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.shift_time || 'Standard'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.link }}>{reqData.shift_time}</Text>
                        </Text>
                      )}
                      {reqData.phone && reqData.phone !== currData.phone && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Phone: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.phone || '—'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.success }}>{reqData.phone}</Text>
                        </Text>
                      )}
                      {reqData.address && reqData.address !== currData.address && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Address: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.address || '—'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.success }}>{reqData.address}</Text>
                        </Text>
                      )}
                      {reqData.aadhaar_number && reqData.aadhaar_number !== currData.aadhaar_number && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Aadhaar: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.aadhaar_number || '—'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.success }}>{reqData.aadhaar_number}</Text>
                        </Text>
                      )}
                      {reqData.license_number && reqData.license_number !== currData.license_number && (
                        <Text style={{ fontSize: 11, color: theme.colors.ink, marginBottom: 2 }}>
                          • Licence: <Text style={{ textDecorationLine: 'line-through', color: theme.colors.mute }}>{currData.license_number || '—'}</Text> → <Text style={{ fontWeight: '700', color: theme.colors.success }}>{reqData.license_number}</Text>
                        </Text>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <Button
                        label="Approve Change"
                        onPress={() => handleApproveProfileReq(pr.id, reqData, pr.user_id)}
                        isLoading={isApproving}
                        variant="primary"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Reject"
                        onPress={() => handleRejectProfileReq(pr.id)}
                        disabled={isApproving}
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Pending Registrations Approvals Section */}
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
        {showLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading user accounts...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Users size={32} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No user accounts found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              {search.trim() !== ''
                ? `No users match "${search.trim()}". Check for typos or search by name, role, or phone.`
                : 'Try adjusting your search criteria or role filters.'}
            </Text>
            {(search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all') && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.ink }}>Clear Search & Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          users.map((u) => {
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
                        <Text style={[styles.userName, { color: theme.colors.ink }]} numberOfLines={1}>
                          {truncateText(u.full_name, 15)}
                        </Text>
                        <Text style={[styles.userEmail, { color: theme.colors.mute }]} numberOfLines={1}>
                          {truncateText(u.email, 20)}
                        </Text>
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

                    {((u.supervisors && u.supervisors.length > 0) || u.supervisor?.full_name) && (
                      <View style={[styles.metaItem, { marginTop: 4 }]}>
                        <User size={11} color={theme.colors.link} />
                        <Text style={[styles.metaText, { color: theme.colors.body }]} numberOfLines={1}>
                          Sup: {u.supervisors && u.supervisors.length > 0
                            ? u.supervisors.map((s: any) => truncateText(s.full_name, 15)).join(', ')
                            : truncateText(u.supervisor?.full_name, 15)}
                        </Text>
                      </View>
                    )}

                    {u.working_location?.name && (
                      <View style={[styles.metaItem, { marginTop: 4 }]}>
                        <MapPin size={11} color={theme.colors.link} />
                        <Text style={[styles.metaText, { color: theme.colors.body }]}>
                          Base: {u.working_location.name}
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
                {selectedIds.length === users.length ? 'Deselect' : 'All'}
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
