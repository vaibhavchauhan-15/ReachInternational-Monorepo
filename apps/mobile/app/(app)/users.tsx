import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Easing,
  Platform,
  StatusBar,
  FlatList,
  ListRenderItem,
} from 'react-native';
import {
  Card,
  Badge,
  useTheme,
  MobileHeader,
  HeaderActionItem,
  DropdownFilterSelector,
  type FilterOption,
} from '../../components/ui';
import { UserDetailModal, type UserRecord } from '../../components/users/UserDetailModal';
import { CreateUserModal } from '../../components/users/CreateUserModal';
import { UserEditModal } from '../../components/users/UserEditModal';
import { PasswordResetModal } from '../../components/users/PasswordResetModal';
import { RejectReasonModal } from '../../components/users/RejectReasonModal';
import { UserExportModal } from '../../components/users/UserExportModal';
import { UserListSkeleton } from '../../components/users/UserCardSkeleton';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/useAuth';
import { notifyUserPasswordReset } from '../../lib/notifications';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { formatTinyRelativeTime, INDIAN_STATES } from '@reachinternational/utils';
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
  UserPlus,
  RefreshCw,
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
  ChevronDown,
  AlertTriangle,
  Globe,
  Smartphone,
} from 'lucide-react-native';

const ROLE_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Roles' },
  { id: 'super_admin', label: 'Super Admin', dotColor: '#ef4444' },
  { id: 'admin', label: 'Admin', dotColor: '#f59e0b' },
  { id: 'manager', label: 'Manager', dotColor: '#6366f1' },
  { id: 'service_manager', label: 'Service Manager', dotColor: '#0284c7' },
  { id: 'service_engineer', label: 'Service Engineer', dotColor: '#2563eb' },
  { id: 'supervisor', label: 'Supervisor', dotColor: '#0d9488' },
  { id: 'operator', label: 'Operator', dotColor: '#d97706' },
  { id: 'mechanic', label: 'Mechanic', dotColor: '#ea580c' },
  { id: 'store_manager', label: 'Store Manager', dotColor: '#9333ea' },
  { id: 'hr_manager', label: 'HR Manager', dotColor: '#059669' },
];

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Status' },
  { id: 'active', label: 'Active', dotColor: '#10b981' },
  { id: 'pending', label: 'Pending', dotColor: '#f59e0b' },
  { id: 'inactive', label: 'Inactive', dotColor: '#94a3b8' },
];

const KYC_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All KYC' },
  { id: 'verified', label: 'Verified', dotColor: '#10b981' },
  { id: 'unverified', label: 'Unverified', dotColor: '#f59e0b' },
];

const JOINED_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Joined Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
];

const SORT_FILTER_OPTIONS: FilterOption[] = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'name_asc', label: 'Name (A → Z)' },
  { id: 'name_desc', label: 'Name (Z → A)' },
  { id: 'role', label: 'Role (A → Z)' },
];

const STATE_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All States' },
  ...INDIAN_STATES.map((s) => ({
    id: s.name,
    label: s.name,
  })),
];

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

interface UserTouchCardProps {
  user: UserRecord;
  isSelected: boolean;
  isSelectMode: boolean;
  theme: any;
  onPress: (user: UserRecord) => void;
  onLongPress: (user: UserRecord) => void;
}

const UserTouchCard = React.memo(function UserTouchCard({
  user: u,
  isSelected,
  isSelectMode,
  theme,
  onPress,
  onLongPress,
}: UserTouchCardProps) {
  const accentColor = getRoleAccentColor(u.role);

  return (
    <TouchableOpacity
      onPress={() => onPress(u)}
      onLongPress={() => onLongPress(u)}
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
});

export default function UsersScreen() {
  const { theme, isDark } = useTheme();
  const { role: currentUserRole, user: authUser } = useAuth();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // 6 Primary Filter Dimensions
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [panelContentHeight, setPanelContentHeight] = useState(0);
  const isWeb = Platform.OS === 'web';

  // Snappy 280ms search debounce for fluid typing and instant skeleton loading
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === debouncedSearch.trim()) {
      setIsSearching(false);
      return;
    }

    if (trimmed === '') {
      setDebouncedSearch('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(trimmed);
      setIsSearching(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const handleSearchSubmit = () => {
    const trimmed = search.trim();
    setDebouncedSearch(trimmed);
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setIsSearching(false);
    searchInputRef.current?.focus();
  };

  // Smooth filter open & close animation for native platforms (web uses GPU-accelerated CSS Grid)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.timing(filterAnim, {
      toValue: filterPanelOpen ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [filterPanelOpen, filterAnim]);

  const showLoading = isLoading || isSearching;

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const requestVersionRef = useRef(0);
  const onEndReachedCalledDuringMomentum = useRef(true);
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

  // Account Deletion Requests State (Web & Mobile Parity)
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
  const [approvingDeletionId, setApprovingDeletionId] = useState<string | null>(null);
  const [rejectingDeletionId, setRejectingDeletionId] = useState<string | null>(null);

  // Multi-Selection State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Get current filter label helpers
  const currentRoleLabel =
    ROLE_FILTER_OPTIONS.find((opt) => opt.id === roleFilter)?.label || 'Role';
  const currentStatusLabel =
    STATUS_FILTER_OPTIONS.find((opt) => opt.id === statusFilter)?.label || 'Status';
  const currentStateLabel =
    STATE_FILTER_OPTIONS.find((opt) => opt.id === stateFilter)?.label || stateFilter;
  const currentKycLabel =
    KYC_FILTER_OPTIONS.find((opt) => opt.id === kycFilter)?.label || 'KYC';
  const currentJoinedLabel =
    JOINED_FILTER_OPTIONS.find((opt) => opt.id === dateRangeFilter)?.label || 'Joined';
  const currentSortLabel =
    SORT_FILTER_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Sort';

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

  const handleResetAllFilters = useCallback(() => {
    setRoleFilter('all');
    setStatusFilter('all');
    setStateFilter('all');
    setKycFilter('all');
    setDateRangeFilter('all');
    setSortBy('newest');
    setSearch('');
    setDebouncedSearch('');
    setIsSearching(false);
  }, []);

  const renderFilterPanelContent = () => (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - panelContentHeight) > 2) {
          setPanelContentHeight(h);
        }
      }}
      style={[styles.filterPanelContent, { borderTopColor: theme.colors.hairline }]}
    >
      {/* 6 Dimension Filter Selector Dropdowns */}
      <View style={styles.filterSelectorsGrid}>
        {/* 1. Role Dropdown */}
        <DropdownFilterSelector
          label="Role"
          value={roleFilter}
          options={ROLE_FILTER_OPTIONS}
          onChange={(val) => setRoleFilter(val)}
        />

        {/* 2. Status Dropdown */}
        <DropdownFilterSelector
          label="Status"
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={(val) => setStatusFilter(val)}
        />

        {/* 3. State Dropdown (Searchable) */}
        <DropdownFilterSelector
          label="State"
          value={stateFilter}
          options={STATE_FILTER_OPTIONS}
          onChange={(val) => setStateFilter(val)}
          showSearch
        />

        {/* 4. KYC Status Dropdown */}
        <DropdownFilterSelector
          label="KYC"
          value={kycFilter}
          options={KYC_FILTER_OPTIONS}
          onChange={(val) => setKycFilter(val)}
        />

        {/* 5. Joined Date Range Dropdown */}
        <DropdownFilterSelector
          label="Joined"
          value={dateRangeFilter}
          options={JOINED_FILTER_OPTIONS}
          onChange={(val) => setDateRangeFilter(val)}
        />

        {/* 6. Sort By Dropdown */}
        <DropdownFilterSelector
          label="Sort"
          value={sortBy}
          options={SORT_FILTER_OPTIONS}
          onChange={(val) => setSortBy(val)}
          align="right"
          showSearch={false}
        />
      </View>

      {/* Active Filter Chips Strip */}
      {activeFilterCount > 0 && (
        <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
          <Text style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
            Active Filters:
          </Text>
          {debouncedSearch.trim() !== '' && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                Search: "{debouncedSearch}"
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          {roleFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setRoleFilter('all')}
              style={[styles.badgeChip, { backgroundColor: isDark ? '#1e3a8a26' : '#eff6ff', borderColor: '#3b82f633' }]}
            >
              <Text style={[styles.badgeChipText, { color: '#2563eb' }]}>
                Role: {currentRoleLabel}
              </Text>
              <X size={12} color="#2563eb" />
            </TouchableOpacity>
          )}

          {statusFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setStatusFilter('all')}
              style={[
                styles.badgeChip,
                {
                  backgroundColor:
                    statusFilter === 'active'
                      ? isDark ? '#064e3b26' : '#ecfdf5'
                      : statusFilter === 'pending'
                      ? isDark ? '#78350f26' : '#fffbeb'
                      : isDark ? '#33415526' : '#f1f5f9',
                  borderColor:
                    statusFilter === 'active'
                      ? '#10b98133'
                      : statusFilter === 'pending'
                      ? '#f59e0b33'
                      : '#94a3b833',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeChipText,
                  {
                    color:
                      statusFilter === 'active'
                        ? '#059669'
                        : statusFilter === 'pending'
                        ? '#d97706'
                        : '#64748b',
                  },
                ]}
              >
                Status: {currentStatusLabel}
              </Text>
              <X
                size={12}
                color={
                  statusFilter === 'active'
                    ? '#059669'
                    : statusFilter === 'pending'
                    ? '#d97706'
                    : '#64748b'
                }
              />
            </TouchableOpacity>
          )}

          {stateFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setStateFilter('all')}
              style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                State: {currentStateLabel}
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          {kycFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setKycFilter('all')}
              style={[
                styles.badgeChip,
                {
                  backgroundColor: kycFilter === 'verified' ? (isDark ? '#064e3b26' : '#ecfdf5') : (isDark ? '#78350f26' : '#fffbeb'),
                  borderColor: kycFilter === 'verified' ? '#10b98133' : '#f59e0b33',
                },
              ]}
            >
              <Text style={[styles.badgeChipText, { color: kycFilter === 'verified' ? '#059669' : '#d97706' }]}>
                KYC: {currentKycLabel}
              </Text>
              <X size={12} color={kycFilter === 'verified' ? '#059669' : '#d97706'} />
            </TouchableOpacity>
          )}

          {dateRangeFilter !== 'all' && (
            <TouchableOpacity
              onPress={() => setDateRangeFilter('all')}
              style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                Joined: {currentJoinedLabel}
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          {sortBy !== 'newest' && (
            <TouchableOpacity
              onPress={() => setSortBy('newest')}
              style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
            >
              <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                Sort: {currentSortLabel}
              </Text>
              <X size={12} color={theme.colors.mute} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleResetAllFilters}
            style={styles.resetAllLink}
          >
            <RotateCcw size={11} color={theme.colors.link} />
            <Text style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
              Reset all
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
    // If already paginating and another loadMore arrives, drop it
    if (isFetchingRef.current && isLoadMore) {
      return;
    }

    isFetchingRef.current = true;
    if (!isLoadMore) {
      setIsLoading(true);
      setInitialError(null);
    } else {
      setIsPaginating(true);
      setLoadMoreError(null);
    }

    const currentVersion = ++requestVersionRef.current;

    try {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const query = buildBaseQuery();
      const { data, count, error } = await query.range(from, to);

      // If a newer search/filter was triggered, discard this stale response
      if (currentVersion !== requestVersionRef.current) {
        return;
      }

      if (count !== null) setTotalUsersCount(count);

      if (error) {
        console.warn('Error fetching users:', error);
        if (isLoadMore) {
          setLoadMoreError('Unable to load more staff. Tap retry to reload.');
        } else {
          setInitialError('Failed to load user accounts.');
        }
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
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => u.id));
            const newItems = (hydrated as UserRecord[]).filter((u) => !existingIds.has(u.id));
            return [...prev, ...newItems];
          });
        } else {
          setUsers(hydrated as any);
        }

        const receivedCount = data.length;
        const totalFetched = (currentPage - 1) * PAGE_SIZE + receivedCount;
        const moreAvailable = receivedCount === PAGE_SIZE && (count !== null ? totalFetched < count : true);
        setHasMore(moreAvailable);
      }

      // Fetch pending profile change requests and account deletion requests only on initial page or refresh
      if (!isLoadMore) {
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

          if (pReqs && currentVersion === requestVersionRef.current) {
            // Filter out account deletion requests from normal profile change list
            const standardProfileReqs = (pReqs as any[]).filter(
              (r) => r.requested_data?.type !== 'account_deletion'
            );
            setProfileRequests(standardProfileReqs);
          }

          // Load account deletion requests (dual-path resilience)
          let delList: any[] = [];
          try {
            const { data: directReqs, error: directErr } = await supabase
              .from('account_deletion_requests')
              .select('*')
              .eq('status', 'pending')
              .order('created_at', { ascending: false });

            if (!directErr && directReqs && directReqs.length > 0) {
              delList = directReqs;
            }
          } catch {
            // Direct table might not be in cached schema yet
          }

          // Merge profile_change_requests fallback
          if (pReqs && pReqs.length > 0) {
            const delFromProfile = (pReqs as any[]).filter(
              (r) => r.requested_data?.type === 'account_deletion'
            );
            const directIds = new Set(delList.map((d) => d.id));
            for (const pr of delFromProfile) {
              if (!directIds.has(pr.id)) {
                delList.push({
                  id: pr.id,
                  user_id: pr.user_id,
                  email: pr.requested_data?.email || pr.user?.email || '',
                  phone: pr.requested_data?.phone || pr.user?.phone || null,
                  reason: pr.requested_data?.reason || 'Account deletion requested via mobile settings',
                  status: pr.status,
                  source: pr.requested_data?.source || 'mobile',
                  created_at: pr.created_at,
                  user: pr.user,
                  _isProfileChangeRequest: true,
                });
              }
            }
          }

          if (currentVersion === requestVersionRef.current) {
            setDeletionRequests(delList);
          }
        } catch (pErr) {
          console.warn('Note on fetching requests:', pErr);
        }
      }
    } catch (err) {
      if (currentVersion === requestVersionRef.current) {
        console.error('Error fetching live users:', err);
        if (isLoadMore) {
          setLoadMoreError('Network error while loading more staff.');
        } else {
          setInitialError('Network error. Unable to load users.');
        }
      }
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setIsLoading(false);
        setRefreshing(false);
        setIsPaginating(false);
      }
      isFetchingRef.current = false;
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
    setHasMore(true);
    setLoadMoreError(null);
    setInitialError(null);
    onEndReachedCalledDuringMomentum.current = true;
    fetchUsers(false, 1);
  }, [fetchUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    setLoadMoreError(null);
    setInitialError(null);
    onEndReachedCalledDuringMomentum.current = true;
    fetchUsers(false, 1);
  }, [fetchUsers]);

  const handleMomentumScrollBegin = useCallback(() => {
    onEndReachedCalledDuringMomentum.current = false;
  }, []);

  const handleLoadMore = useCallback(() => {
    if (
      onEndReachedCalledDuringMomentum.current ||
      !hasMore ||
      isPaginating ||
      isLoading ||
      loadMoreError !== null ||
      users.length === 0
    ) {
      return;
    }
    onEndReachedCalledDuringMomentum.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchUsers(true, nextPage);
  }, [hasMore, isPaginating, isLoading, loadMoreError, users.length, page, fetchUsers]);

  const handleRetryLoadMore = useCallback(() => {
    setLoadMoreError(null);
    onEndReachedCalledDuringMomentum.current = false;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchUsers(true, nextPage);
  }, [page, fetchUsers]);

  const handleRetryInitial = useCallback(() => {
    setInitialError(null);
    setPage(1);
    setHasMore(true);
    fetchUsers(false, 1);
  }, [fetchUsers]);

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

  // Account Deletion Approval and Rejection Handlers
  const handleApproveDeletionReq = async (req: any) => {
    const displayName = req.user?.full_name || req.email || 'this user';
    Alert.alert(
      'Approve Account Deletion',
      `Are you sure you want to approve account deletion for ${displayName}? The account will be deactivated and KYC details purged. Statutory machine hour logs (HMR) are permanently retained.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Deactivate',
          style: 'destructive',
          onPress: async () => {
            setApprovingDeletionId(req.id);
            try {
              // 1. Deactivate user and wipe KYC info
              if (req.user_id) {
                await supabase
                  .from('users')
                  .update({
                    status: 'inactive',
                    aadhaar_number: null,
                    license_number: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', req.user_id);
              } else if (req.email) {
                await supabase
                  .from('users')
                  .update({
                    status: 'inactive',
                    aadhaar_number: null,
                    license_number: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('email', req.email);
              }

              // 2. Mark request approved
              if (req._isProfileChangeRequest) {
                await supabase
                  .from('profile_change_requests')
                  .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq('id', req.id);
              } else {
                try {
                  await supabase
                    .from('account_deletion_requests')
                    .update({
                      status: 'approved',
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', req.id);
                } catch {
                  await supabase
                    .from('profile_change_requests')
                    .update({
                      status: 'approved',
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', req.id);
                }
              }

              // 3. Log audit event
              try {
                await supabase.from('audit_logs').insert({
                  action: 'user.account_deleted',
                  entity_type: 'user',
                  entity_id: req.user_id || req.id,
                  new_values: { reason: req.reason, source: req.source, email: req.email },
                  user_id: authUser?.id || null,
                });
              } catch {
                // non-blocking
              }

              Alert.alert('Approved', `Account for ${displayName} has been deactivated.`);
              fetchUsers(false, 1);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to approve account deletion.');
            } finally {
              setApprovingDeletionId(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectDeletionReq = async (req: any) => {
    const displayName = req.user?.full_name || req.email || 'this user';
    Alert.alert(
      'Decline Deletion Request',
      `Are you sure you want to decline the account deletion request for ${displayName}? The account will remain active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline Request',
          onPress: async () => {
            setRejectingDeletionId(req.id);
            try {
              if (req._isProfileChangeRequest) {
                await supabase
                  .from('profile_change_requests')
                  .update({
                    status: 'rejected',
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq('id', req.id);
              } else {
                try {
                  await supabase
                    .from('account_deletion_requests')
                    .update({
                      status: 'rejected',
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', req.id);
                } catch {
                  await supabase
                    .from('profile_change_requests')
                    .update({
                      status: 'rejected',
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', req.id);
                }
              }

              Alert.alert('Declined', `Deletion request for ${displayName} has been declined.`);
              fetchUsers(false, 1);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to decline deletion request.');
            } finally {
              setRejectingDeletionId(null);
            }
          },
        },
      ]
    );
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
    notifyUserPasswordReset(userToReset.full_name);
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
    setSelectedIds((prev) => {
      const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId];
      if (next.length === 0) {
        setIsSelectMode(false);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
      setIsSelectMode(false);
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

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    list.push({
      id: 'add-user',
      label: 'Add / Invite Staff',
      icon: <UserPlus size={16} color={theme.colors.ink} />,
      onPress: () => setCreateModalVisible(true),
    });

    list.push({
      id: 'export-users',
      label: 'Export Users Directory',
      icon: <FileSpreadsheet size={16} color="#10b981" />,
      onPress: () => setExportModalVisible(true),
    });

    list.push({
      id: 'select-mode',
      label: isSelectMode ? 'Exit Selection Mode' : 'Batch Select Staff',
      icon: <CheckSquare size={16} color={theme.colors.ink} />,
      onPress: () => {
        if (isSelectMode) {
          setIsSelectMode(false);
          setSelectedIds([]);
        } else {
          setIsSelectMode(true);
        }
      },
    });

    list.push({
      id: 'reset-filters',
      label: 'Reset Active Filters',
      icon: <RotateCcw size={16} color={theme.colors.ink} />,
      onPress: () => handleResetAllFilters(),
    });

    list.push({
      id: 'refresh-users',
      label: 'Refresh Users Directory',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => fetchUsers(false, 1),
    });

    return list;
  }, [isSelectMode, theme.colors.ink, handleResetAllFilters, fetchUsers]);

  const handleUserCardPress = useCallback((u: UserRecord) => {
    if (isSelectMode) {
      toggleSelectUser(u.id);
    } else {
      openUserDetail(u);
    }
  }, [isSelectMode]);

  const handleUserCardLongPress = useCallback((u: UserRecord) => {
    if (!isSelectMode) {
      setIsSelectMode(true);
      setSelectedIds([u.id]);
    }
  }, [isSelectMode]);

  const renderUserCardItem: ListRenderItem<UserRecord> = useCallback(
    ({ item }) => (
      <UserTouchCard
        user={item}
        isSelected={selectedIds.includes(item.id)}
        isSelectMode={isSelectMode}
        theme={theme}
        onPress={handleUserCardPress}
        onLongPress={handleUserCardLongPress}
      />
    ),
    [selectedIds, isSelectMode, theme, handleUserCardPress, handleUserCardLongPress]
  );

  const keyExtractor = useCallback((item: UserRecord) => item.id, []);

  const renderListEmpty = useCallback(() => {
    if (showLoading) {
      return <UserListSkeleton count={4} />;
    }

    if (initialError) {
      return (
        <View style={[styles.initialErrorContainer, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <Users size={32} color={theme.colors.error} />
          <Text style={[styles.initialErrorTitle, { color: theme.colors.ink }]}>Failed to load users</Text>
          <Text style={[styles.initialErrorSubtext, { color: theme.colors.mute }]}>
            {initialError}
          </Text>
          <TouchableOpacity
            onPress={handleRetryInitial}
            activeOpacity={0.8}
            style={[styles.retryInitialBtn, { backgroundColor: theme.colors.ink }]}
          >
            <RotateCcw size={13} color={theme.colors.canvas} />
            <Text style={[styles.retryInitialBtnText, { color: theme.colors.canvas }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
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
            onPress={handleResetAllFilters}
            style={[styles.resetEmptyBtn, { backgroundColor: theme.colors.ink }]}
          >
            <Text style={styles.resetEmptyBtnText}>Reset Search & Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [showLoading, initialError, theme, handleRetryInitial, search, activeFilterCount, handleResetAllFilters]);

  const renderListFooter = useCallback(() => {
    if (isPaginating) {
      return (
        <View style={styles.paginationFooterContainer}>
          <ActivityIndicator size="small" color={theme.colors.link} />
          <Text style={[styles.paginationFooterText, { color: theme.colors.mute }]}>
            Loading more staff...
          </Text>
        </View>
      );
    }

    if (loadMoreError) {
      return (
        <View style={[styles.paginationErrorCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <View style={styles.paginationErrorRow}>
            <Text style={[styles.paginationErrorText, { color: theme.colors.error }]}>
              {loadMoreError}
            </Text>
            <TouchableOpacity
              onPress={handleRetryLoadMore}
              activeOpacity={0.8}
              style={[styles.retryLoadMoreBtn, { backgroundColor: theme.colors.ink }]}
            >
              <RotateCcw size={12} color={theme.colors.canvas} />
              <Text style={[styles.retryLoadMoreBtnText, { color: theme.colors.canvas }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (!hasMore && users.length > 0 && !showLoading) {
      return (
        <View style={styles.endOfListFooter}>
          <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          <View style={styles.endOfListContent}>
            <Check size={12} color={theme.colors.mute} />
            <Text style={[styles.endOfListText, { color: theme.colors.mute }]}>
              All users have been displayed
            </Text>
          </View>
          <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
        </View>
      );
    }

    return <View style={{ height: isSelectMode ? 90 : 20 }} />;
  }, [isPaginating, loadMoreError, hasMore, users.length, showLoading, theme, handleRetryLoadMore, isSelectMode]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MobileHeader
        title="User Management"
        actions={headerActions}
      />

      <FlatList<UserRecord>
        data={showLoading || initialError ? [] : users}
        keyExtractor={keyExtractor}
        renderItem={renderUserCardItem}
        ListHeaderComponent={
          <View style={styles.listHeaderWrapper}>
            {/* Interactive 4-Card KPI Metric Grid */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Total Users */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor:
                      roleFilter === 'all' && statusFilter === 'all'
                        ? theme.colors.ink
                        : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>TOTAL STAFF</Text>
                <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>
                  {totalUsersCount || users.length}
                </Text>
              </TouchableOpacity>

              {/* Card 2: Active Users */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setStatusFilter((prev) => (prev === 'active' ? 'all' : 'active'));
                }}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor:
                      statusFilter === 'active'
                        ? isDark ? '#064e3b26' : '#ecfdf5'
                        : theme.colors.canvasElevated,
                    borderColor: statusFilter === 'active' ? '#10b981' : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: '#10b981' }]}>ACTIVE</Text>
                <Text style={[styles.kpiValue, { color: '#059669' }]}>{activeCount}</Text>
              </TouchableOpacity>

              {/* Card 3: Service Engineers */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setRoleFilter((prev) => (prev === 'service_engineer' ? 'all' : 'service_engineer'));
                }}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor:
                      roleFilter === 'service_engineer'
                        ? isDark ? '#1e3a8a26' : '#eff6ff'
                        : theme.colors.canvasElevated,
                    borderColor: roleFilter === 'service_engineer' ? '#2563eb' : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: '#2563eb' }]}>ENGINEERS</Text>
                <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{engineerCount}</Text>
              </TouchableOpacity>

              {/* Card 4: Pending Approvals */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'));
                }}
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor:
                      statusFilter === 'pending'
                        ? isDark ? '#78350f26' : '#fffbeb'
                        : theme.colors.canvasElevated,
                    borderColor: statusFilter === 'pending' ? '#f59e0b' : theme.colors.hairline,
                  },
                ]}
              >
                <Text style={[styles.kpiLabel, { color: '#f59e0b' }]}>PENDING</Text>
                <Text style={[styles.kpiValue, { color: '#d97706' }]}>{pendingCount}</Text>
              </TouchableOpacity>
            </View>

            {/* FilterToolbar Card Wrapper */}
            <View
              style={[
                styles.filterToolbar,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Top Search & Filter Action Row */}
              <View style={styles.toolbarTopRow}>
                {/* Search Input Bar (Capsule Pill with Web outline suppression & Focus Ring) */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => searchInputRef.current?.focus()}
                  style={[
                    styles.searchBarBox,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: isSearchFocused ? theme.colors.ink : theme.colors.hairline,
                    },
                    isSearchFocused && Platform.OS === 'web' && ({
                      boxShadow: isDark
                        ? '0 0 0 1px rgba(255, 255, 255, 0.35)'
                        : '0 0 0 1px rgba(0, 0, 0, 0.22)',
                    } as any),
                  ]}
                >
                  {isSearching ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.mute}
                      style={styles.searchIcon}
                    />
                  ) : (
                    <Search
                      size={15}
                      color={isSearchFocused ? theme.colors.ink : theme.colors.mute}
                      style={styles.searchIcon}
                    />
                  )}
                  <TextInput
                    ref={searchInputRef}
                    placeholder="Search staff by name, email, phone, city..."
                    placeholderTextColor={theme.colors.mute}
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={handleSearchSubmit}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    style={[
                      styles.searchInputText,
                      { color: theme.colors.ink },
                      Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                    ]}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearSearch}
                      style={styles.searchClearBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Clear search"
                    >
                      <X size={14} color={theme.colors.mute} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Filter Toggle Button */}
                <TouchableOpacity
                  onPress={() => setFilterPanelOpen((prev) => !prev)}
                  activeOpacity={0.8}
                  style={[
                    styles.filterToggleBtn,
                    {
                      backgroundColor:
                        filterPanelOpen || activeFilterCount > 0
                          ? theme.colors.ink
                          : theme.colors.canvas,
                      borderColor:
                        filterPanelOpen || activeFilterCount > 0
                          ? theme.colors.ink
                          : theme.colors.hairline,
                    },
                    isWeb && ({
                      transition: 'background-color 180ms ease, border-color 180ms ease',
                    } as any),
                  ]}
                  accessibilityLabel="Toggle filter selectors"
                >
                  <SlidersHorizontal
                    size={13}
                    color={
                      filterPanelOpen || activeFilterCount > 0
                        ? theme.colors.canvas
                        : theme.colors.ink
                    }
                  />
                  <Text
                    style={[
                      styles.filterToggleBtnText,
                      {
                        color:
                          filterPanelOpen || activeFilterCount > 0
                            ? theme.colors.canvas
                            : theme.colors.ink,
                      },
                    ]}
                  >
                    Filter
                  </Text>
                  {activeFilterCount > 0 && (
                    <View
                      style={[
                        styles.activeCountBadge,
                        {
                          backgroundColor:
                            filterPanelOpen || activeFilterCount > 0
                              ? theme.colors.canvas
                              : theme.colors.ink,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.activeCountBadgeText,
                          {
                            color:
                              filterPanelOpen || activeFilterCount > 0
                                ? theme.colors.ink
                                : theme.colors.canvas,
                          },
                        ]}
                      >
                        {activeFilterCount}
                      </Text>
                    </View>
                  )}
                  {isWeb ? (
                    <View
                      style={{
                        transform: [{ rotate: filterPanelOpen ? '180deg' : '0deg' }],
                        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                      } as any}
                    >
                      <ChevronDown
                        size={13}
                        color={
                          filterPanelOpen || activeFilterCount > 0
                            ? theme.colors.canvas
                            : theme.colors.mute
                        }
                      />
                    </View>
                  ) : (
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: filterAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '180deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <ChevronDown
                        size={13}
                        color={
                          filterPanelOpen || activeFilterCount > 0
                            ? theme.colors.canvas
                            : theme.colors.mute
                        }
                      />
                    </Animated.View>
                  )}
                </TouchableOpacity>

                {/* Quick Reset Filters Button */}
                {activeFilterCount > 0 && (
                  <TouchableOpacity
                    onPress={handleResetAllFilters}
                    activeOpacity={0.8}
                    style={[
                      styles.quickResetBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Reset all filters"
                  >
                    <RotateCcw size={13} color={theme.colors.mute} />
                    <Text style={[styles.quickResetBtnText, { color: theme.colors.mute }]}>
                      Reset
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Instant & Smooth Animated Expandable Filter & Sort Selectors Section */}
              {isWeb ? (
                <View
                  style={[
                    styles.filterPanelWebContainer,
                    {
                      display: 'grid',
                      gridTemplateRows: filterPanelOpen ? '1fr' : '0fr',
                      opacity: filterPanelOpen ? 1 : 0,
                      transition:
                        'grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                      pointerEvents: filterPanelOpen ? 'auto' : 'none',
                    } as any,
                  ]}
                >
                  <View style={{ minHeight: 0, overflow: 'hidden' } as any}>
                    {renderFilterPanelContent()}
                  </View>
                </View>
              ) : (
                <Animated.View
                  style={[
                    styles.filterPanelAnimatedContainer,
                    {
                      maxHeight: filterAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, panelContentHeight > 0 ? panelContentHeight : 180],
                      }),
                      opacity: filterAnim.interpolate({
                        inputRange: [0, 0.2, 1],
                        outputRange: [0, 0.4, 1],
                      }),
                    },
                  ]}
                >
                  {renderFilterPanelContent()}
                </Animated.View>
              )}
            </View>

            {/* Results count indicator */}
            <View style={styles.resultsCountRow}>
              <Text style={[styles.resultsCountText, { color: theme.colors.mute }]}>
                Showing {users.length} {users.length === 1 ? 'staff member' : 'staff members'}
                {totalUsersCount > 0 ? ` of ${totalUsersCount}` : ''}
                {activeFilterCount > 0 ? ' (filtered)' : ''}
              </Text>
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
                              {reqUser.full_name || 'Staff Member'}
                            </Text>
                            <Text style={[styles.changeReqUserSub, { color: theme.colors.mute }]}>
                              {formatRoleName(reqUser.role || pr.requester_role)} • {reqUser.phone || reqUser.email || '—'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.changeReqTime, { color: theme.colors.mute }]}>
                          {formatTinyRelativeTime(pr.created_at)}
                        </Text>
                      </View>

                      {/* Diff Box */}
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
                        {reqData.city && reqData.city !== currData.city && (
                          <Text style={styles.diffItem}>
                            <Text style={{ fontWeight: '700', color: theme.colors.mute }}>City: </Text>
                            <Text style={styles.diffOld}>{currData.city || '—'}</Text>
                            <Text style={styles.diffArrow}> → </Text>
                            <Text style={styles.diffNew}>{reqData.city}</Text>
                          </Text>
                        )}
                        {reqData.district && reqData.district !== currData.district && (
                          <Text style={styles.diffItem}>
                            <Text style={{ fontWeight: '700', color: theme.colors.mute }}>District: </Text>
                            <Text style={styles.diffOld}>{currData.district || '—'}</Text>
                            <Text style={styles.diffArrow}> → </Text>
                            <Text style={styles.diffNew}>{reqData.district}</Text>
                          </Text>
                        )}
                        {reqData.state && reqData.state !== currData.state && (
                          <Text style={styles.diffItem}>
                            <Text style={{ fontWeight: '700', color: theme.colors.mute }}>State: </Text>
                            <Text style={styles.diffOld}>{currData.state || '—'}</Text>
                            <Text style={styles.diffArrow}> → </Text>
                            <Text style={styles.diffNew}>{reqData.state}</Text>
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

            {/* Account Deletion Requests Section (Web & Mobile Parity) */}
            {deletionRequests.length > 0 && (
              <View style={[styles.deletionReqsContainer, { borderColor: '#ef444433', backgroundColor: isDark ? '#450a0a26' : '#fef2f2' }]}>
                <View style={[styles.changeReqsHeader, { borderBottomColor: isDark ? '#7f1d1d40' : '#fee2e2' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[styles.alertDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.changeReqsTitle, { color: theme.colors.ink }]}>
                      Account Deletion Requests ({deletionRequests.length})
                    </Text>
                  </View>
                  <View style={[styles.deletionCountPill, { backgroundColor: isDark ? '#7f1d1d66' : '#fee2e2' }]}>
                    <AlertTriangle size={11} color="#ef4444" />
                    <Text style={[styles.deletionCountPillText, { color: '#dc2626' }]}>Action Required</Text>
                  </View>
                </View>

                <Text style={[styles.deletionSectionSubtext, { color: theme.colors.mute }]}>
                  Requests received via Web Portal & Mobile App. Approving deactivates account access and wipes personal KYC data; statutory machine logs (HMR) are permanently retained.
                </Text>

                {deletionRequests.map((dr) => {
                  const isApproving = approvingDeletionId === dr.id;
                  const isRejecting = rejectingDeletionId === dr.id;
                  const reqUser = dr.user || {};
                  const displayName = reqUser.full_name || dr.email || 'User';
                  const isWebPortal = dr.source === 'web';

                  return (
                    <View key={dr.id} style={[styles.deletionCard, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                      <View style={styles.changeReqCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#7f1d1d33' : '#fee2e2', borderColor: '#ef444440', borderWidth: 1 }]}>
                            <Text style={[styles.avatarLetter, { color: '#ef4444' }]}>
                              {displayName ? displayName[0].toUpperCase() : 'D'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.changeReqUserName, { color: theme.colors.ink }]} numberOfLines={1}>
                                {displayName}
                              </Text>
                              <View style={[styles.sourceBadge, { backgroundColor: isWebPortal ? (isDark ? '#1e3a8a33' : '#eff6ff') : (isDark ? '#581c8733' : '#f5f3ff'), borderColor: isWebPortal ? '#3b82f640' : '#8b5cf640' }]}>
                                {isWebPortal ? <Globe size={9} color={theme.colors.link} /> : <Smartphone size={9} color="#7c3aed" />}
                                <Text style={[styles.sourceBadgeText, { color: isWebPortal ? theme.colors.link : '#7c3aed' }]}>
                                  {isWebPortal ? 'Web Portal' : 'Mobile App'}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.changeReqUserSub, { color: theme.colors.mute }]} numberOfLines={1}>
                              {dr.email || reqUser.email || '—'}{dr.phone ? ` • ${dr.phone}` : ''}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.changeReqTime, { color: theme.colors.mute }]}>
                          {formatTinyRelativeTime(dr.created_at)}
                        </Text>
                      </View>

                      {/* Reason Box */}
                      <View style={[styles.deletionReasonBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                        <Text style={[styles.deletionReasonLabel, { color: theme.colors.mute }]}>Reason for deletion:</Text>
                        <Text style={[styles.deletionReasonText, { color: theme.colors.ink }]}>
                          "{dr.reason || 'No specific reason provided'}"
                        </Text>
                      </View>

                      {/* Actions */}
                      <View style={styles.changeReqActions}>
                        <TouchableOpacity
                          style={[styles.reqApproveBtn, { backgroundColor: '#dc2626' }]}
                          onPress={() => handleApproveDeletionReq(dr)}
                          disabled={isApproving || isRejecting}
                        >
                          {isApproving ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.reqBtnTextWhite}>Approve & Deactivate</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.reqRejectBtn, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                          onPress={() => handleRejectDeletionReq(dr)}
                          disabled={isApproving || isRejecting}
                        >
                          {isRejecting ? (
                            <ActivityIndicator size="small" color={theme.colors.mute} />
                          ) : (
                            <Text style={[styles.reqBtnText, { color: theme.colors.ink }]}>Decline</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.ink}
            colors={[theme.colors.ink]}
          />
        }
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      {/* Floating Bulk Actions Bar */}
      {isSelectMode && selectedIds.length > 0 && (
        <View
          style={[
            styles.mobileBulkBar,
            { backgroundColor: theme.colors.ink, shadowColor: '#000' },
          ]}
        >
          <View style={styles.bulkCountRow}>
            <TouchableOpacity
              onPress={() => {
                setSelectedIds([]);
                setIsSelectMode(false);
              }}
              style={styles.bulkCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Cancel selection mode"
            >
              <X size={15} color="#ffffff" />
            </TouchableOpacity>
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 90,
    gap: spacingNumeric.md,
  },
  listHeaderWrapper: {
    gap: spacingNumeric.md,
    paddingBottom: spacingNumeric.xs,
  },
  paginationFooterContainer: {
    paddingVertical: spacingNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  paginationFooterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  paginationErrorCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginVertical: spacingNumeric.xs,
  },
  paginationErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  retryLoadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radiusNumeric.sm,
  },
  retryLoadMoreBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  endOfListFooter: {
    paddingVertical: spacingNumeric.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  endOfListLine: {
    flex: 1,
    height: 1,
  },
  endOfListContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  endOfListText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  initialErrorContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: spacingNumeric.md,
  },
  initialErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  initialErrorSubtext: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryInitialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radiusNumeric.md,
    marginTop: 4,
  },
  retryInitialBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  filterToolbar: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: spacingNumeric.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  toolbarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    height: '100%',
  },
  searchClearBtn: {
    padding: 3,
    marginLeft: 4,
  },
  filterToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  filterToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  quickResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 11,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  quickResetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPanelWebContainer: {
    overflow: 'hidden',
  },
  filterPanelAnimatedContainer: {
    overflow: 'hidden',
  },
  filterPanelContent: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: spacingNumeric.sm,
  },
  filterSelectorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacingNumeric.xs,
    borderTopWidth: 1,
  },
  activeBadgesHeader: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 2,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  badgeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetAllLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginTop: -4,
  },
  resultsCountText: {
    fontSize: 12,
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
  deletionReqsContainer: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  deletionCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
  },
  deletionCountPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deletionSectionSubtext: {
    fontSize: 11,
    lineHeight: 15,
  },
  deletionCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  deletionReasonBox: {
    padding: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 2,
  },
  deletionReasonLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deletionReasonText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
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
  bulkCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
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
