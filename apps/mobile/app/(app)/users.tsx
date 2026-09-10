import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { UserEditModal } from '../../components/users/UserEditModal';
import { PasswordResetModal } from '../../components/users/PasswordResetModal';
import { RejectReasonModal } from '../../components/users/RejectReasonModal';
import { UserExportModal } from '../../components/users/UserExportModal';
import {
  CustomFilterSelectorModal,
  type FilterModalType,
} from '../../components/users/CustomFilterSelectorModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatTinyRelativeTime } from '@reachinternational/utils';
import {
  Users,
  User,
  UserCheck,
  UserX,
  ShieldCheck,
  ShieldAlert,
  Shield,
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
  Filter,
  FileSpreadsheet,
  RotateCcw,
  SlidersHorizontal,
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

function getRoleAccentColor(role: string): string {
  switch (role) {
    case 'super_admin':
      return '#ef4444';
    case 'admin':
      return '#f59e0b';
    case 'manager':
    case 'branch_manager':
      return '#6366f1';
    case 'service_manager':
      return '#0284c7';
    case 'service_engineer':
    case 'engineer':
      return '#2563eb';
    case 'supervisor':
      return '#0d9488';
    case 'store_manager':
      return '#9333ea';
    case 'operator':
      return '#d97706';
    case 'mechanic':
      return '#ea580c';
    case 'hr_manager':
      return '#059669';
    default:
      return '#64748b';
  }
}

function truncateText(str?: string | null, maxChars: number = 22): string {
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

  if (trimmed.length === 1) {
    return query.or(`full_name.ilike.${sanitized}%,email.ilike.${sanitized}%,role.ilike.${sanitized}%`);
  }

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

  if (trimmed.includes('@') || trimmed.endsWith('.com') || trimmed.endsWith('.in')) {
    return query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

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

    for (const word of words) {
      const wRole = word.toLowerCase().replace(/s$/, '');
      query = query.or(
        `full_name.ilike.%${word}%,role.ilike.%${wRole}%,city.ilike.%${word}%,district.ilike.%${word}%,state.ilike.%${word}%,email.ilike.%${word}%`
      );
    }
    return query;
  }

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
  const { role: currentUserRole, user: authUser } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 300ms debounce
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

  // 6 Primary Filter Dimensions
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Filter Selector Modal State
  const [activeFilterModal, setActiveFilterModal] = useState<FilterModalType | null>(null);

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const PAGE_SIZE = 25;

  // Modals & Action States
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserRecord | null>(null);

  const [passwordResetModalVisible, setPasswordResetModalVisible] = useState(false);
  const [resetPasswordUserName, setResetPasswordUserName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const [exportModalVisible, setExportModalVisible] = useState(false);

  // Profile Change Requests State
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [approvingProfileId, setApprovingProfileId] = useState<string | null>(null);
  const [rejectModalReq, setRejectModalReq] = useState<any | null>(null);
  const [isRejectingProfileReq, setIsRejectingProfileReq] = useState(false);
  const [isBulkApprovingProfile, setIsBulkApprovingProfile] = useState(false);
  const [isBulkRejectingProfile, setIsBulkRejectingProfile] = useState(false);

  // Multi-Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (stateFilter !== 'all') count++;
    if (kycFilter !== 'all') count++;
    if (dateRangeFilter !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [roleFilter, statusFilter, stateFilter, kycFilter, dateRangeFilter, sortBy]);

  const resetAllFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setStateFilter('all');
    setKycFilter('all');
    setDateRangeFilter('all');
    setSortBy('newest');
    setSearch('');
    setDebouncedSearch('');
  };

  const buildBaseQuery = useCallback(() => {
    let query = supabase
      .from('users')
      .select(
        'id, full_name, email, phone, role, status, city, district, state, state_id, shift_time, address, aadhaar_number, license_number, supervisor_id, supervisor_ids, working_location_id, created_at',
        { count: 'exact' }
      );

    // 1. Role Filter
    if (roleFilter !== 'all') {
      if (roleFilter === 'engineers') {
        query = query.in('role', ['engineer', 'service_engineer']);
      } else if (roleFilter === 'managers') {
        query = query.in('role', ['manager', 'branch_manager', 'admin', 'super_admin']);
      } else {
        query = query.eq('role', roleFilter);
      }
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // 3. State Filter
    if (stateFilter !== 'all') {
      query = query.ilike('state', `%${stateFilter}%`);
    }

    // 4. KYC Filter
    if (kycFilter === 'verified') {
      query = query.not('aadhaar_number', 'is', null).neq('aadhaar_number', '');
    } else if (kycFilter === 'unverified') {
      query = query.or('aadhaar_number.is.null,aadhaar_number.eq.');
    }

    // 5. Joined Date Range Filter
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      if (dateRangeFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', today);
      } else if (dateRangeFilter === 'last_7_days') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', d7);
      } else if (dateRangeFilter === 'last_30_days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', d30);
      } else if (dateRangeFilter === 'last_90_days') {
        const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', d90);
      }
    }

    // 6. Search
    query = applyOptimizedUserSearch(query, debouncedSearch);

    // 7. Sort Order
    if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'name_asc') {
      query = query.order('full_name', { ascending: true });
    } else if (sortBy === 'name_desc') {
      query = query.order('full_name', { ascending: false });
    } else if (sortBy === 'role') {
      query = query.order('role', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }
    query = query.order('id', { ascending: true });

    return query;
  }, [roleFilter, statusFilter, stateFilter, kycFilter, dateRangeFilter, debouncedSearch, sortBy]);

  const fetchUsers = useCallback(async (isLoadMore = false, currentPage = 1) => {
    if (!isLoadMore) {
      setIsLoading(true);
    } else {
      setIsPaginating(true);
    }
    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const query = buildBaseQuery();
      const { data, count, error } = await query.range(from, to);

      if (count !== null) setTotalUsersCount(count);

      if (error) {
        console.warn('Error fetching users:', error);
      } else if (data) {
        const userMap = new Map((data as any[]).map((u) => [u.id, u]));

        let workingLocMap = new Map<string, any>();
        try {
          const { data: locs } = await supabase.from('working_locations').select('id, name, type, city, state');
          if (locs) {
            workingLocMap = new Map(locs.map((l: any) => [l.id, l]));
          }
        } catch {
          // ignore
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
  }, [buildBaseQuery]);

  // Export full matching users across all pages
  const handleFetchAllMatchingUsers = useCallback(async (): Promise<any[]> => {
    const query = buildBaseQuery();
    const { data, error } = await query.limit(2000);
    if (error) {
      throw error;
    }
    return data || [];
  }, [buildBaseQuery]);

  useEffect(() => {
    setPage(1);
    fetchUsers(false, 1);
  }, [fetchUsers]);

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

  // Profile Change Request Actions
  const handleApproveProfileReq = async (reqId: string, reqData: any, userId: string) => {
    setApprovingProfileId(reqId);
    try {
      const { error: userErr } = await supabase
        .from('users')
        .update({
          ...reqData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (userErr) throw userErr;

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

  const handleConfirmRejectProfileReq = async (reason: string) => {
    if (!rejectModalReq) return;
    setIsRejectingProfileReq(true);
    try {
      const { error } = await supabase
        .from('profile_change_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectModalReq.id);

      if (error) throw error;
      setRejectModalReq(null);
      Alert.alert('Rejected', 'Profile change request has been declined.');
      fetchUsers(false, 1);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to reject profile changes.');
    } finally {
      setIsRejectingProfileReq(false);
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

  // Password Reset Trigger
  const handleTriggerResetPassword = (userToReset: UserRecord) => {
    const rawFirst = (userToReset.full_name || '').trim().split(/\s+/)[0] || 'User';
    const cleaned = rawFirst.replace(/[^a-zA-Z0-9]/g, '');
    const firstName = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedPwd = `${firstName}@${randomNum}`;

    setResetPasswordUserName(userToReset.full_name);
    setTemporaryPassword(generatedPwd);
    setPasswordResetModalVisible(true);
  };

  // Edit Account Info Trigger
  const handleTriggerEdit = (userToEditRecord: UserRecord) => {
    setUserToEdit(userToEditRecord);
    setEditModalVisible(true);
  };

  const openUserDetail = (u: UserRecord) => {
    setSelectedUser(u);
    setDetailModalVisible(true);
  };

  // Multi-Selection Logic
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

  // Metric snapshot calculations
  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const activeCount = users.filter((u) => u.status === 'active').length;
  const engineerCount = users.filter((u) => u.role === 'service_engineer' || u.role === 'engineer').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Header */}
      <MobileHeader
        eyebrow="STAFF DIRECTORY"
        title="User Management"
        subtitle="Manage organization staff, role authorizations & account approvals"
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Export Directory CTA */}
            <TouchableOpacity
              onPress={() => setExportModalVisible(true)}
              style={[
                styles.headerActionBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
              ]}
              activeOpacity={0.75}
            >
              <FileSpreadsheet size={15} color="#10b981" />
              <Text style={[styles.headerActionBtnText, { color: theme.colors.ink }]}>Export</Text>
            </TouchableOpacity>

            {/* Select Mode Toggle */}
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
                styles.headerActionBtn,
                {
                  backgroundColor: isSelectMode ? theme.colors.ink : theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.headerActionBtnText, { color: isSelectMode ? theme.colors.canvas : theme.colors.ink }]}>
                {isSelectMode ? 'Done' : 'Select'}
              </Text>
            </TouchableOpacity>

            {/* Add User Button */}
            {!isSelectMode && (
              <TouchableOpacity
                onPress={() => setCreateModalVisible(true)}
                style={[styles.headerActionBtn, { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink }]}
                activeOpacity={0.8}
              >
                <Plus size={15} color={theme.colors.canvas} />
                <Text style={[styles.headerActionBtnText, { color: theme.colors.canvas }]}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Search and Filters Bar */}
      <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
        <Input
          placeholder="Search name, email, phone, city, role..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={theme.colors.mute} />}
          containerStyle={styles.searchInput}
        />

        {/* 6 Dimension Filter Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* 1. Role Filter Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('role')}
            style={[
              styles.filterPill,
              {
                backgroundColor: roleFilter !== 'all' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Shield size={12} color={roleFilter !== 'all' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: roleFilter !== 'all' ? theme.colors.canvas : theme.colors.ink }]}>
              {roleFilter !== 'all' ? formatRoleName(roleFilter) : 'Role: All'}
            </Text>
          </TouchableOpacity>

          {/* 2. Status Filter Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('status')}
            style={[
              styles.filterPill,
              {
                backgroundColor: statusFilter !== 'all' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <UserCheck size={12} color={statusFilter !== 'all' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: statusFilter !== 'all' ? theme.colors.canvas : theme.colors.ink }]}>
              {statusFilter !== 'all' ? statusFilter.toUpperCase() : 'Status: All'}
            </Text>
          </TouchableOpacity>

          {/* 3. State Filter Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('state')}
            style={[
              styles.filterPill,
              {
                backgroundColor: stateFilter !== 'all' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <MapPin size={12} color={stateFilter !== 'all' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: stateFilter !== 'all' ? theme.colors.canvas : theme.colors.ink }]}>
              {stateFilter !== 'all' ? stateFilter : 'State: All'}
            </Text>
          </TouchableOpacity>

          {/* 4. KYC Filter Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('kyc')}
            style={[
              styles.filterPill,
              {
                backgroundColor: kycFilter !== 'all' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <ShieldCheck size={12} color={kycFilter !== 'all' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: kycFilter !== 'all' ? theme.colors.canvas : theme.colors.ink }]}>
              {kycFilter === 'verified' ? 'KYC: Verified' : kycFilter === 'unverified' ? 'KYC: Unverified' : 'KYC: All'}
            </Text>
          </TouchableOpacity>

          {/* 5. Joined Date Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('joined')}
            style={[
              styles.filterPill,
              {
                backgroundColor: dateRangeFilter !== 'all' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Clock size={12} color={dateRangeFilter !== 'all' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: dateRangeFilter !== 'all' ? theme.colors.canvas : theme.colors.ink }]}>
              {dateRangeFilter !== 'all' ? dateRangeFilter.replace(/_/g, ' ') : 'Joined: All Time'}
            </Text>
          </TouchableOpacity>

          {/* 6. Sort By Pill */}
          <TouchableOpacity
            onPress={() => setActiveFilterModal('sort')}
            style={[
              styles.filterPill,
              {
                backgroundColor: sortBy !== 'newest' ? theme.colors.ink : theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <SlidersHorizontal size={12} color={sortBy !== 'newest' ? theme.colors.canvas : theme.colors.mute} />
            <Text style={[styles.filterPillText, { color: sortBy !== 'newest' ? theme.colors.canvas : theme.colors.ink }]}>
              Sort: {sortBy === 'newest' ? 'Newest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'name_asc' ? 'Name (A-Z)' : sortBy === 'name_desc' ? 'Name (Z-A)' : 'Role'}
            </Text>
          </TouchableOpacity>

          {/* Reset Filters Pill */}
          {activeFilterCount > 0 && (
            <TouchableOpacity
              onPress={resetAllFilters}
              style={[styles.filterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
            >
              <RotateCcw size={12} color="#b91c1c" />
              <Text style={[styles.filterPillText, { color: '#b91c1c', fontWeight: '700' }]}>
                Reset ({activeFilterCount})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Main Feed Content */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />}
        onMomentumScrollEnd={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 100) {
            handleLoadMore();
          }
        }}
      >
        {/* Interactive KPI Metric Cards */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Users */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              resetAllFilters();
            }}
            activeOpacity={0.8}
          >
            <Card style={styles.metricCard}>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: theme.colors.mute }]}>Total</Text>
                <Users size={14} color={theme.colors.ink} />
              </View>
              <Text style={[styles.metricVal, { color: theme.colors.ink }]}>{totalUsersCount || users.length}</Text>
            </Card>
          </TouchableOpacity>

          {/* Card 2: Active Users */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setStatusFilter(statusFilter === 'active' ? 'all' : 'active');
            }}
            activeOpacity={0.8}
          >
            <Card style={[styles.metricCard, statusFilter === 'active' && { borderColor: '#10b981', borderWidth: 1.5 }]}>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: '#047857' }]}>Active</Text>
                <UserCheck size={14} color="#10b981" />
              </View>
              <Text style={[styles.metricVal, { color: '#047857' }]}>{activeCount}</Text>
            </Card>
          </TouchableOpacity>

          {/* Card 3: Service Engineers */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setRoleFilter(roleFilter === 'service_engineer' ? 'all' : 'service_engineer');
            }}
            activeOpacity={0.8}
          >
            <Card style={[styles.metricCard, roleFilter === 'service_engineer' && { borderColor: '#2563eb', borderWidth: 1.5 }]}>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: '#1d4ed8' }]}>Engineers</Text>
                <Shield size={14} color="#2563eb" />
              </View>
              <Text style={[styles.metricVal, { color: '#1d4ed8' }]}>{engineerCount}</Text>
            </Card>
          </TouchableOpacity>

          {/* Card 4: Pending Approvals */}
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending');
            }}
            activeOpacity={0.8}
          >
            <Card style={[styles.metricCard, statusFilter === 'pending' && { borderColor: '#f59e0b', borderWidth: 1.5 }]}>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: '#b45309' }]}>Pending</Text>
                <ShieldAlert size={14} color="#f59e0b" />
              </View>
              <Text style={[styles.metricVal, { color: '#b45309' }]}>{pendingCount}</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Profile Detail Change Requests Section */}
        {profileRequests.length > 0 && (
          <View style={[styles.changeReqsContainer, { borderColor: '#6366f133', backgroundColor: '#6366f108' }]}>
            <View style={[styles.changeReqsHeader, { borderBottomColor: '#6366f120' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <View style={[styles.alertDot, { backgroundColor: '#6366f1' }]} />
                <Text style={[styles.changeReqsTitle, { color: theme.colors.ink }]}>
                  Profile Change Requests ({profileRequests.length})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.miniActionBtn, { backgroundColor: '#6366f1', borderColor: '#6366f1' }]}
                  onPress={handleApproveAllProfileReqs}
                  disabled={isBulkApprovingProfile}
                >
                  <Text style={styles.miniActionBtnTextWhite}>Accept All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniActionBtn, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}
                  onPress={handleRejectAllProfileReqs}
                  disabled={isBulkRejectingProfile}
                >
                  <Text style={[styles.miniActionBtnText, { color: theme.colors.ink }]}>Reject All</Text>
                </TouchableOpacity>
              </View>
            </View>

            {profileRequests.map((pr) => {
              const reqUser = pr.user || pr.current_data || {};
              const reqData = pr.requested_data || {};
              const currData = pr.current_data || {};
              const isApproving = approvingProfileId === pr.id;

              return (
                <View key={pr.id} style={[styles.changeReqCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <View style={styles.changeReqCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={[styles.avatarCircle, { backgroundColor: '#6366f115', borderColor: '#6366f130', borderWidth: 1 }]}>
                        <Text style={[styles.avatarLetter, { color: '#6366f1' }]}>
                          {reqUser.full_name ? reqUser.full_name[0].toUpperCase() : 'U'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.changeReqUserName, { color: theme.colors.ink }]}>
                          {reqUser.full_name || 'User'}
                        </Text>
                        <Text style={[styles.changeReqUserSub, { color: theme.colors.mute }]}>
                          {reqUser.email}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.changeReqTime, { color: '#6366f1' }]}>
                      {pr.created_at ? formatTinyRelativeTime(pr.created_at) : 'Just now'}
                    </Text>
                  </View>

                  {/* Diffs Comparison Box */}
                  <View style={[styles.diffsBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    {reqData.full_name && reqData.full_name !== currData.full_name && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Name: </Text>
                        <Text style={styles.diffOld}>{currData.full_name || '—'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.full_name}</Text>
                      </Text>
                    )}
                    {reqData.phone && reqData.phone !== currData.phone && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Phone: </Text>
                        <Text style={styles.diffOld}>{currData.phone || '—'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.phone}</Text>
                      </Text>
                    )}
                    {reqData.shift_time && reqData.shift_time !== currData.shift_time && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Shift: </Text>
                        <Text style={styles.diffOld}>{currData.shift_time || 'Standard'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.shift_time}</Text>
                      </Text>
                    )}
                    {reqData.address && reqData.address !== currData.address && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Address: </Text>
                        <Text style={styles.diffOld}>{currData.address || '—'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.address}</Text>
                      </Text>
                    )}
                    {reqData.aadhaar_number && reqData.aadhaar_number !== currData.aadhaar_number && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Aadhaar: </Text>
                        <Text style={styles.diffOld}>{currData.aadhaar_number || '—'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.aadhaar_number}</Text>
                      </Text>
                    )}
                    {reqData.license_number && reqData.license_number !== currData.license_number && (
                      <Text style={styles.diffItem}>
                        <Text style={{ fontWeight: '700', color: theme.colors.mute }}>Licence: </Text>
                        <Text style={styles.diffOld}>{currData.license_number || '—'}</Text>
                        <Text style={styles.diffArrow}> → </Text>
                        <Text style={styles.diffNew}>{reqData.license_number}</Text>
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.changeReqActions}>
                    <TouchableOpacity
                      style={[styles.reqApproveBtn, { backgroundColor: '#10b981' }]}
                      onPress={() => handleApproveProfileReq(pr.id, reqData, pr.user_id)}
                      disabled={isApproving}
                    >
                      {isApproving ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.reqBtnTextWhite}>Approve</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reqRejectBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                      onPress={() => setRejectModalReq(pr)}
                      disabled={isApproving}
                    >
                      <Text style={[styles.reqBtnText, { color: theme.colors.error }]}>Reject...</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* User Touch Cards List */}
        {showLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.link} />
            <Text style={[styles.loadingText, { color: theme.colors.mute }]}>Loading user accounts...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
            <Users size={36} color={theme.colors.mute} />
            <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>No user accounts found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.mute }]}>
              {search.trim() !== ''
                ? `No users match "${search.trim()}". Try clearing search or changing filters.`
                : 'No users in this directory scope.'}
            </Text>
            {(activeFilterCount > 0 || search.trim() !== '') && (
              <TouchableOpacity
                onPress={resetAllFilters}
                style={[styles.resetEmptyBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={styles.resetEmptyBtnText}>Reset Search & Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          users.map((u) => {
            const isSelected = selectedIds.includes(u.id);
            const accentColor = getRoleAccentColor(u.role);

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
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.userCard,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                      borderLeftColor: accentColor,
                      borderLeftWidth: 4,
                    },
                    isSelectMode && isSelected && {
                      borderColor: theme.colors.link,
                      borderWidth: 1.5,
                      borderLeftWidth: 4,
                      backgroundColor: theme.colors.canvas,
                    },
                  ]}
                >
                  {/* Card Header */}
                  <View style={styles.userCardHeader}>
                    <View style={styles.userAvatarRow}>
                      {isSelectMode ? (
                        <View style={{ marginRight: 6 }}>
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
                          {truncateText(u.full_name, 24)}
                        </Text>
                        <Text style={[styles.userEmail, { color: theme.colors.mute }]} numberOfLines={1}>
                          {truncateText(u.email, 28)}
                        </Text>
                      </View>
                    </View>

                    {/* Status Dot & Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {u.status === 'active' ? (
                        <View style={[styles.cardStatusBadge, { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }]}>
                          <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                          <Text style={[styles.cardStatusText, { color: '#047857' }]}>Active</Text>
                        </View>
                      ) : (
                        <View style={[styles.cardStatusBadge, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                          <View style={[styles.statusDot, { backgroundColor: '#94a3b8' }]} />
                          <Text style={[styles.cardStatusText, { color: '#64748b' }]}>
                            {u.status ? u.status.toUpperCase() : 'INACTIVE'}
                          </Text>
                        </View>
                      )}
                      <ChevronRight size={16} color={theme.colors.mute} />
                    </View>
                  </View>

                  {/* Card Metadata Section */}
                  <View style={[styles.cardMetaBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <View style={styles.cardMetaRow}>
                      <View style={[styles.roleBadgePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '35' }]}>
                        <Text style={[styles.roleBadgePillText, { color: accentColor }]}>
                          {formatRoleName(u.role)}
                        </Text>
                      </View>

                      {u.phone ? (
                        <View style={styles.metaChip}>
                          <Phone size={11} color={theme.colors.mute} />
                          <Text style={[styles.metaChipText, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                            {u.phone}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Location and Supervisor Details */}
                    {(u.city || u.state) && (
                      <View style={styles.metaChipRow}>
                        <MapPin size={11} color={theme.colors.mute} />
                        <Text style={[styles.metaChipText, { color: theme.colors.mute }]}>
                          {[u.city, u.district, u.state].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    )}

                    {((u.supervisors && u.supervisors.length > 0) || u.supervisor?.full_name) && (
                      <View style={styles.metaChipRow}>
                        <User size={11} color="#0d9488" />
                        <Text style={[styles.metaChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                          Supervisor: {u.supervisors && u.supervisors.length > 0
                            ? u.supervisors.map((s: any) => s.full_name).join(', ')
                            : u.supervisor?.full_name}
                        </Text>
                      </View>
                    )}

                    {u.working_location?.name && (
                      <View style={styles.metaChipRow}>
                        <MapPin size={11} color={theme.colors.link} />
                        <Text style={[styles.metaChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                          Base: {u.working_location.name}
                          {u.working_location.city ? ` (${u.working_location.city})` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {isPaginating && (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.colors.link} />
          </View>
        )}
      </ScrollView>

      {/* Floating Bulk Actions Bar */}
      {isSelectMode && selectedIds.length > 0 && (
        <View
          style={[
            styles.mobileBulkBar,
            { backgroundColor: theme.colors.ink, shadowColor: '#000' },
          ]}
        >
          <View style={styles.bulkCountRow}>
            <View style={[styles.bulkBadge, { backgroundColor: theme.colors.link }]}>
              <Text style={styles.bulkBadgeText}>{selectedIds.length}</Text>
            </View>
            <Text style={styles.bulkSelectedText}>selected</Text>
          </View>

          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              onPress={handleSelectAll}
              style={[styles.bulkBtnSecondary, { borderColor: 'rgba(255,255,255,0.2)' }]}
              activeOpacity={0.7}
            >
              <Text style={styles.bulkBtnSecondaryText}>
                {selectedIds.length === users.length ? 'Deselect' : 'All'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setExportModalVisible(true)}
              style={[styles.bulkBtnSecondary, { borderColor: 'rgba(255,255,255,0.2)' }]}
              activeOpacity={0.7}
            >
              <FileSpreadsheet size={13} color="#10b981" />
              <Text style={styles.bulkBtnSecondaryText}>Export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBulkDelete}
              disabled={isDeletingBulk}
              style={[styles.bulkBtnDanger, { backgroundColor: theme.colors.error }]}
              activeOpacity={0.8}
            >
              <Trash2 size={13} color="#ffffff" />
              <Text style={styles.bulkBtnDangerText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* User Detail Action Bottom Sheet */}
      <UserDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        user={selectedUser}
        currentUserRole={currentUserRole || 'super_admin'}
        currentUserId={authUser?.id}
        onSuccess={() => fetchUsers(false, 1)}
        onEdit={handleTriggerEdit}
        onResetPassword={handleTriggerResetPassword}
      />

      {/* Create User Modal */}
      <CreateUserModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => fetchUsers(false, 1)}
        isSuperAdmin={currentUserRole === 'super_admin'}
      />

      {/* User Edit Modal */}
      <UserEditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={userToEdit}
        onSuccess={() => fetchUsers(false, 1)}
        isSuperAdmin={currentUserRole === 'super_admin'}
      />

      {/* Password Reset Modal */}
      <PasswordResetModal
        visible={passwordResetModalVisible}
        onClose={() => setPasswordResetModalVisible(false)}
        userName={resetPasswordUserName}
        temporaryPassword={temporaryPassword}
      />

      {/* Reject Reason Modal */}
      <RejectReasonModal
        visible={Boolean(rejectModalReq)}
        onClose={() => setRejectModalReq(null)}
        userName={rejectModalReq?.user?.full_name || 'user'}
        onConfirm={handleConfirmRejectProfileReq}
        isSubmitting={isRejectingProfileReq}
      />

      {/* User Export Modal */}
      <UserExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        currentPageUsers={users}
        totalMatchingCount={totalUsersCount || users.length}
        selectedUserIds={selectedIds}
        currentPage={page}
        totalPages={Math.ceil((totalUsersCount || users.length) / PAGE_SIZE) || 1}
        activeFilterCount={activeFilterCount}
        onFetchAllMatchingUsers={handleFetchAllMatchingUsers}
      />

      {/* Filter Dimension Selector Modal */}
      {activeFilterModal && (
        <CustomFilterSelectorModal
          visible={Boolean(activeFilterModal)}
          onClose={() => setActiveFilterModal(null)}
          filterType={activeFilterModal}
          currentValue={
            activeFilterModal === 'role'
              ? roleFilter
              : activeFilterModal === 'status'
              ? statusFilter
              : activeFilterModal === 'state'
              ? stateFilter
              : activeFilterModal === 'kyc'
              ? kycFilter
              : activeFilterModal === 'joined'
              ? dateRangeFilter
              : sortBy
          }
          onSelect={(val) => {
            if (activeFilterModal === 'role') setRoleFilter(val);
            else if (activeFilterModal === 'status') setStatusFilter(val);
            else if (activeFilterModal === 'state') setStateFilter(val);
            else if (activeFilterModal === 'kyc') setKycFilter(val);
            else if (activeFilterModal === 'joined') setDateRangeFilter(val);
            else if (activeFilterModal === 'sort') setSortBy(val);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  headerActionBtnText: {
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
  searchInput: {
    marginBottom: 0,
  },
  filterScroll: {
    gap: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 90,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  changeReqsContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  changeReqsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  changeReqsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  miniActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  miniActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniActionBtnTextWhite: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  changeReqCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  changeReqCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeReqUserName: {
    fontSize: 13,
    fontWeight: '700',
  },
  changeReqUserSub: {
    fontSize: 11,
  },
  changeReqTime: {
    fontSize: 10,
    fontWeight: '700',
  },
  diffsBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 2,
  },
  diffItem: {
    fontSize: 11,
    lineHeight: 16,
  },
  diffOld: {
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  diffArrow: {
    color: '#64748b',
    fontWeight: '700',
  },
  diffNew: {
    color: '#10b981',
    fontWeight: '700',
  },
  changeReqActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  reqApproveBtn: {
    flex: 1,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqBtnTextWhite: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  reqRejectBtn: {
    flex: 1,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reqBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: 8,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: '800',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMetaBox: {
    padding: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  roleBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  roleBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaChipText: {
    fontSize: 11,
  },
  metaChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 24,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  resetEmptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
    marginTop: 6,
  },
  resetEmptyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mobileBulkBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radiusNumeric.full,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  bulkCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
  },
  bulkBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  bulkSelectedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  bulkBtnSecondaryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  bulkBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
  },
  bulkBtnDangerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
