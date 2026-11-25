/**
 * Native Mobile User Details Page & View Component
 * 100% Web & Mobile Parity with apps/web/app/(app)/users/[id]/UserDetailClient.tsx
 * Adheres strictly to Vercel Geist tokens (#171717 ink, #fafafa canvas, #ffffff elevated, #ebebeb hairline),
 * 3-tier responsiveness, zero raw typography, touch ergonomics (min 44px), and on-demand lazy loading.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
  useWindowDimensions,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Pressable } from '../ui/touch/Pressable';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import {
  MobileHeader,
  type HeaderActionItem,
  AppRefreshControl,
  EmptyState,
  SearchInput,
  showToast,
} from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  formatDate,
  formatTimeAgo,
  maskAadhaar,
  maskBankAccount,
  formatLicenseNumber,
  getUserInitials,
  formatMachineCategoryLabel,
} from '@reachinternational/utils';
import { useQueryClient } from '@tanstack/react-query';
import { RunningLogShiftCard } from '../operations/RunningLogShiftCard';
import { DeleteUserConfirmDialog } from './DeleteUserConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { UserEditModal } from './UserEditModal';
import { AssignSupervisorModal } from './AssignSupervisorModal';
import { AssignMachineModal } from './AssignMachineModal';
import { PasswordResetModal } from './PasswordResetModal';
import { MobileMachineCard } from '../machines/MobileMachineCard';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../documents/MobileDocumentViewerModal';
import {
  useUserDetailOverview,
  useUserDetailMachinesInfinite,
  useUserDetailOperatorsInfinite,
  useUserDetailRunningLogsInfinite,
  useUserDetailAssignmentsInfinite,
  useUserDetailAttendanceInfinite,
  useUserDetailDocumentsInfinite,
  useUserDetailAuditLogsInfinite,
  resetUserPasswordMobile,
  fetchUpdatedUserRecord,
  logSensitiveRevealMobile,
  type UserMachineItem,
  type SupervisedOperatorItem,
  type UserRunningLogItem,
  type UserAssignmentItem,
  type UserDocumentItem,
  type UserAuditItem,
} from '../../lib/hooks/useUserDetailData';
import {
  UserMachinesSkeleton,
  UserLogsSkeleton,
  UserAssignmentsSkeleton,
  UserAttendanceSkeleton,
  UserDocumentsSkeleton,
  UserAuditSkeleton,
} from './UserDetailSkeletons';
import type { UserRecord } from './UserDetailModal';
import {
  User,
  Users,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Clock,
  Wrench,
  Truck,
  FileText,
  Calendar,
  ShieldCheck,
  Edit2,
  Trash2,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  WhatsAppIcon,
  Search,
  ChevronRight,
  MoreVertical,
  Plus,
  Shield,
  ShieldAlert,
  ChevronDown,
  Eye,
  EyeOff,
} from '../ui/icon';

export type UserDetailTabKey = 'machines' | 'operators' | 'logs' | 'assignments' | 'attendance' | 'documents' | 'audit';

export interface UserDetailViewProps {
  user?: UserRecord | null;
  userId?: string;
  onBack: () => void;
  currentUserRole?: string;
  currentUserId?: string;
  onUserUpdated?: (updatedUser?: any) => void;
  onUserDeleted?: () => void;
  initialTab?: UserDetailTabKey;
  onViewUser?: (userId: string) => void;
}

function formatShiftTime(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${mStr || '00'} ${ampm}`;
  };
  if (start && end) return `${formatTime(start)} - ${formatTime(end)}`;
  return formatTime(start || end);
}

function getInitials(name?: string): string {
  return getUserInitials(name);
}

function formatFileSizeMobile(bytes?: number | null): string {
  const size = Number(bytes || 0);
  if (!size) return 'Size n/a';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getRoleAvatarColors(role?: string, isDark?: boolean) {
  return {
    bg: isDark ? '#ffffff' : '#171717',
    border: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    text: isDark ? '#171717' : '#ffffff',
  };
}

interface TabPaginationFooterProps {
  currentCount: number;
  totalCount: number;
  label: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

const paginationStyles = StyleSheet.create({
  tabPaginationFooter: {
    marginTop: 16,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMorePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 44,
  },
  endOfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    paddingVertical: 8,
  },
  endOfListLine: {
    flex: 1,
    height: 1,
  },
  endOfListBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

const TabPaginationFooter: React.FC<TabPaginationFooterProps> = ({
  currentCount,
  totalCount,
  label,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) => {
  const { theme } = useTheme();

  if (currentCount === 0) return null;

  return (
    <View style={paginationStyles.tabPaginationFooter}>
      {hasNextPage ? (
        <Pressable
          variant="outline"
          haptic="tap"
          hitSlopToMin48
          disabled={isFetchingNextPage}
          onPress={onLoadMore}
          style={[
            paginationStyles.loadMorePillBtn,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
          accessibilityLabel={`Load more ${label}`}
        >
          {isFetchingNextPage ? (
            <ActivityIndicator size="small" color={theme.colors.ink} />
          ) : (
            <>
              <ChevronDown size={14} color={theme.colors.ink} />
              <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                Load More {label}
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                ({currentCount} of {totalCount})
              </Text>
            </>
          )}
        </Pressable>
      ) : totalCount > 0 ? (
        <View style={paginationStyles.endOfListRow}>
          <View style={[paginationStyles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          <View style={paginationStyles.endOfListBadge}>
            <Check size={12} color="#10b981" />
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              All {totalCount} {label} loaded
            </Text>
          </View>
          <View style={[paginationStyles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
        </View>
      ) : null}
    </View>
  );
};

export const UserDetailView: React.FC<UserDetailViewProps> = ({
  user: initialUser,
  userId: initialUserId,
  onBack,
  currentUserRole = 'super_admin',
  currentUserId,
  onUserUpdated,
  onUserDeleted,
  initialTab = 'machines',
  onViewUser,
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 641 && windowWidth <= 1023;
  const isDesktop = windowWidth >= 1024;

  const [user, setUser] = useState<UserRecord | null>(initialUser || null);
  const [activeTab, setActiveTab] = useState<UserDetailTabKey>(initialTab);
  const [tabSearch, setTabSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [showFullBankAccount, setShowFullBankAccount] = useState(false);

  const effectiveUserId = user?.id || initialUserId || '';

  // Lazy tab navigation states: track which tabs have been navigated to
  const [visitedTabs, setVisitedTabs] = useState<Record<UserDetailTabKey, boolean>>({
    machines: initialTab === 'machines',
    operators: initialTab === 'operators',
    logs: initialTab === 'logs',
    assignments: initialTab === 'assignments',
    attendance: initialTab === 'attendance',
    documents: initialTab === 'documents',
    audit: initialTab === 'audit',
  });

  const handleTabChange = useCallback((newTab: string) => {
    const tabKey = newTab as UserDetailTabKey;
    setActiveTab(tabKey);
    setTabSearch('');
    setVisitedTabs((prev) => ({ ...prev, [tabKey]: true }));
    haptics.select();
  }, []);

  const handleToggleAadhaar = useCallback(async () => {
    const next = !showFullAadhaar;
    setShowFullAadhaar(next);
    haptics.select();
    if (next && effectiveUserId) {
      void logSensitiveRevealMobile(effectiveUserId, 'aadhaar');
    }
  }, [showFullAadhaar, effectiveUserId]);

  const handleToggleBankAccount = useCallback(async () => {
    const next = !showFullBankAccount;
    setShowFullBankAccount(next);
    haptics.select();
    if (next && effectiveUserId) {
      void logSensitiveRevealMobile(effectiveUserId, 'bank_account');
    }
  }, [showFullBankAccount, effectiveUserId]);

  // 1. Overview Hook: Loads User Details, KPIs, Supervisor
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useUserDetailOverview(effectiveUserId);

  // Synchronize user from overview if refreshed
  React.useEffect(() => {
    if (overviewData?.user) {
      setUser((prev) => ({ ...(prev || {}), ...overviewData.user } as UserRecord));
    }
  }, [overviewData?.user]);

  React.useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    }
  }, [initialUser]);

  // 2. Tab Hooks: Strictly Lazy Loaded on Tab Activation with Infinite Pagination!
  const {
    data: machinesInfiniteData,
    isLoading: isMachinesLoading,
    isFetchingNextPage: isFetchingNextMachines,
    hasNextPage: hasNextMachines,
    fetchNextPage: fetchNextMachines,
    refetch: refetchMachines,
  } = useUserDetailMachinesInfinite(effectiveUserId, user?.role, visitedTabs.machines, 20);

  const machines = useMemo(() => {
    return machinesInfiniteData?.pages.flatMap((p) => p.machines) || [];
  }, [machinesInfiniteData?.pages]);
  const totalMachinesCount = machinesInfiniteData?.pages[0]?.totalCount ?? machines.length;

  const {
    data: operatorsInfiniteData,
    isLoading: isOperatorsLoading,
    isFetchingNextPage: isFetchingNextOperators,
    hasNextPage: hasNextOperators,
    fetchNextPage: fetchNextOperators,
    refetch: refetchOperators,
  } = useUserDetailOperatorsInfinite(effectiveUserId, visitedTabs.operators && user?.role === 'supervisor', 20);

  const operators = useMemo(() => {
    return operatorsInfiniteData?.pages.flatMap((p) => p.operators) || [];
  }, [operatorsInfiniteData?.pages]);
  const totalOperatorsCount = operatorsInfiniteData?.pages[0]?.totalCount ?? operators.length;

  const {
    data: logsInfiniteData,
    isLoading: isLogsLoading,
    isFetchingNextPage: isFetchingNextLogs,
    hasNextPage: hasNextLogs,
    fetchNextPage: fetchNextLogs,
    refetch: refetchLogs,
  } = useUserDetailRunningLogsInfinite(effectiveUserId, visitedTabs.logs, 20);

  const runningLogs = useMemo(() => {
    return logsInfiniteData?.pages.flatMap((p) => p.logs) || [];
  }, [logsInfiniteData?.pages]);
  const totalLogsCount = logsInfiniteData?.pages[0]?.totalCount ?? runningLogs.length;

  const {
    data: assignmentsInfiniteData,
    isLoading: isAssignmentsLoading,
    isFetchingNextPage: isFetchingNextAssignments,
    hasNextPage: hasNextAssignments,
    fetchNextPage: fetchNextAssignments,
    refetch: refetchAssignments,
  } = useUserDetailAssignmentsInfinite(effectiveUserId, visitedTabs.assignments, 20);

  const assignments = useMemo(() => {
    return assignmentsInfiniteData?.pages.flatMap((p) => p.assignments) || [];
  }, [assignmentsInfiniteData?.pages]);
  const totalAssignmentsCount = assignmentsInfiniteData?.pages[0]?.totalCount ?? assignments.length;

  const {
    data: attendanceInfiniteData,
    isLoading: isAttendanceLoading,
    isFetchingNextPage: isFetchingNextAttendance,
    hasNextPage: hasNextAttendance,
    fetchNextPage: fetchNextAttendance,
    refetch: refetchAttendance,
  } = useUserDetailAttendanceInfinite(effectiveUserId, visitedTabs.attendance && user?.role === 'operator', 20);

  const attendanceData = useMemo(() => {
    const firstPage = attendanceInfiniteData?.pages[0];
    const allLogs = attendanceInfiniteData?.pages.flatMap((p) => p.logs) || [];
    return {
      totalActiveWorkDays: firstPage?.totalActiveWorkDays ?? 0,
      totalShiftRunningTime: firstPage?.totalShiftRunningTime ?? 0,
      shiftSchedule: firstPage?.shiftSchedule ?? '06:00 AM - 02:00 PM',
      recentLogs: allLogs,
      totalCount: firstPage?.totalCount ?? allLogs.length,
    };
  }, [attendanceInfiniteData?.pages]);

  const {
    data: documentsInfiniteData,
    isLoading: isDocumentsLoading,
    isFetchingNextPage: isFetchingNextDocs,
    hasNextPage: hasNextDocs,
    fetchNextPage: fetchNextDocs,
    refetch: refetchDocuments,
  } = useUserDetailDocumentsInfinite(effectiveUserId, visitedTabs.documents, 20);

  const documents = useMemo(() => {
    return documentsInfiniteData?.pages.flatMap((p) => p.documents) || [];
  }, [documentsInfiniteData?.pages]);
  const totalDocumentsCount = documentsInfiniteData?.pages[0]?.totalCount ?? documents.length;

  // 3. RBAC Permissions Matrix
  const normalizedRole = (currentUserRole || '').toLowerCase();
  const isSuperAdmin = normalizedRole === 'super_admin';
  const isAdmin = normalizedRole === 'admin';
  const isManager = normalizedRole === 'manager';
  const isSupervisor = normalizedRole === 'supervisor';
  const isHr = normalizedRole === 'hr';
  const isOperator = normalizedRole === 'operator';
  const isSelf = currentUserId === user?.id;

  const canManageUsers = isSuperAdmin || isAdmin || isManager || isHr;
  const canEditUsers = canManageUsers;
  const canDeleteUsers = (isSuperAdmin || isAdmin) && !isSelf;
  const canActivateUsers = (isSuperAdmin || isAdmin || isHr) && !isSelf;
  const canAssignSupervisorUsers = canManageUsers;
  const canAssignMachineUsers = (canManageUsers || isSupervisor) && user?.role === 'operator';
  const canResetPwdUsers = canManageUsers;
  const canViewSalary = canManageUsers || isSelf;
  const canRevealDocs = isSuperAdmin || isAdmin || isHr || isSelf;
  const canVerifyReject = (isSuperAdmin || isAdmin || isHr) && !isSelf;
  const canViewAudit = canManageUsers;

  const {
    data: auditInfiniteData,
    isLoading: isAuditLoading,
    isFetchingNextPage: isFetchingNextAudit,
    hasNextPage: hasNextAudit,
    fetchNextPage: fetchNextAudit,
    refetch: refetchAudit,
  } = useUserDetailAuditLogsInfinite(effectiveUserId, visitedTabs.audit && canViewAudit, 20);

  const auditLogs = useMemo(() => {
    return auditInfiniteData?.pages.flatMap((p) => p.logs) || [];
  }, [auditInfiniteData?.pages]);
  const totalAuditCount = auditInfiniteData?.pages[0]?.totalCount ?? auditLogs.length;

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    try {
      await Promise.all([
        refetchOverview(),
        visitedTabs.machines ? refetchMachines() : Promise.resolve(),
        visitedTabs.operators && user?.role === 'supervisor' ? refetchOperators() : Promise.resolve(),
        visitedTabs.logs ? refetchLogs() : Promise.resolve(),
        visitedTabs.assignments ? refetchAssignments() : Promise.resolve(),
        visitedTabs.attendance ? refetchAttendance() : Promise.resolve(),
        visitedTabs.documents ? refetchDocuments() : Promise.resolve(),
        visitedTabs.audit && canViewAudit ? refetchAudit() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetchOverview,
    visitedTabs,
    refetchMachines,
    refetchOperators,
    refetchLogs,
    refetchAssignments,
    refetchAttendance,
    refetchDocuments,
    refetchAudit,
    canViewAudit,
  ]);

  // Copy to clipboard
  const handleCopy = useCallback(async (text?: string | null, key?: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    haptics.confirm();
    setCopiedKey(key || 'text');
    showToast('success', `${key || 'Item'} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }, []);

  const queryClient = useQueryClient();

  // Modals & Action States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteSubmittingRef = useRef(false);

  const [statusConfirmVisible, setStatusConfirmVisible] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const statusSubmittingRef = useRef(false);

  const [resetPwdConfirmVisible, setResetPwdConfirmVisible] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    userName: string;
    temporaryPassword: string;
  } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [assignSupervisorVisible, setAssignSupervisorVisible] = useState(false);
  const [assignMachineVisible, setAssignMachineVisible] = useState(false);
  const [activeViewerDoc, setActiveViewerDoc] = useState<MobileViewerDoc | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  // Secure Document Viewer Handler with Signed URL Resolution
  const handleViewDocument = useCallback(async (doc: UserDocumentItem) => {
    if (openingDocId) return;
    setOpeningDocId(doc.id);
    haptics.select();

    try {
      let targetUrl = doc.signed_url;
      if (!targetUrl && doc.storage_path) {
        const bucket = doc.is_pending_request ? 'doc_staging' : 'user_files';
        const cleanPath = doc.storage_path.replace(/^\/+/, '');
        const { data: signedData, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 3600);

        if (!signErr && signedData?.signedUrl) {
          targetUrl = signedData.signedUrl;
        }
      }

      if (!targetUrl) {
        showToast('error', 'Document URL unavailable');
        return;
      }

      setActiveViewerDoc({
        id: doc.id,
        title: doc.type_label || doc.document_type_code.replace(/_/g, ' ').toUpperCase(),
        mimeType: doc.mime_type || (doc.storage_path?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        url: targetUrl,
        uri: targetUrl,
        fileSize: doc.file_size_bytes,
        fileName: doc.storage_path?.split('/').pop() || doc.document_type_code,
      });
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to open document');
    } finally {
      setOpeningDocId(null);
    }
  }, [openingDocId]);

  // Preview Staged Replacement Document Image
  const handlePreviewReplacement = useCallback((doc: UserDocumentItem) => {
    const rep = doc.pending_replacement;
    if (!rep) return;
    const targetUrl = rep.signed_url || rep.thumb_signed_url;
    if (!targetUrl) {
      showToast('error', 'Replacement image unavailable');
      return;
    }
    haptics.select();
    setActiveViewerDoc({
      id: rep.id,
      title: `${doc.type_label || doc.document_type_code.replace(/_/g, ' ').toUpperCase()} (Replacement)`,
      mimeType: 'image/jpeg',
      url: targetUrl,
      uri: targetUrl,
      fileSize: 0,
      fileName: `${doc.document_type_code}_replacement.jpg`,
    });
  }, []);

  // Administrative Password Reset Trigger (Web Parity)
  const handleExecuteResetPassword = useCallback(async () => {
    if (!user || isResettingPassword) return;
    setIsResettingPassword(true);
    try {
      const res = await resetUserPasswordMobile(user.id, user.full_name);
      setResetPwdConfirmVisible(false);
      if (!res.success || !res.temporaryPassword) {
        haptics.reject();
        showToast('error', res.error || 'Failed to reset password');
      } else {
        haptics.confirm();
        setResetPasswordResult({
          userName: res.userName || user?.full_name || '',
          temporaryPassword: res.temporaryPassword,
        });
        showToast('success', 'Temporary password generated successfully');
      }
    } catch (err: any) {
      setResetPwdConfirmVisible(false);
      haptics.reject();
      showToast('error', err?.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  }, [isResettingPassword, user?.id, user?.full_name]);

  // Status Toggle
  const handleToggleStatus = useCallback(() => {
    if (isSelf) {
      showToast('error', 'You cannot change your own account status.');
      return;
    }
    if (normalizedRole === 'admin' && user?.role === 'super_admin') {
      showToast('error', 'Only Super Admins can modify Super Admin accounts.');
      return;
    }
    setStatusConfirmVisible(true);
  }, [isSelf, normalizedRole, user?.role]);

  const handleConfirmToggleStatus = useCallback(async () => {
    if (!user || statusSubmittingRef.current || isUpdatingStatus) return;
    statusSubmittingRef.current = true;
    setIsUpdatingStatus(true);
    setStatusConfirmVisible(false);

    const prevStatus = user.status;
    const targetStatus = prevStatus === 'active' ? 'inactive' : 'active';
    setUser((prev) => (prev ? ({ ...prev, status: targetStatus } as UserRecord) : null));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('toggle_user_status_atomic', {
        p_target_user_id: user.id,
      });

      if (rpcErr || (rpcRes && rpcRes.success === false)) {
        setUser((prev) => (prev ? ({ ...prev, status: prevStatus } as UserRecord) : null));
        haptics.reject();
        showToast('error', 'Failed to update user status');
        return;
      }

      const updatedStatus = rpcRes?.status || targetStatus;
      setUser((prev) => (prev ? ({ ...prev, status: updatedStatus } as UserRecord) : null));
      onUserUpdated?.({ ...user, status: updatedStatus });
      haptics.confirm();
      showToast(
        'success',
        updatedStatus === 'active' ? 'Account Activated' : 'Account Deactivated'
      );
      // Selective Query Optimization: Refetch only updated user row without full overview re-queries
      const freshUser = await fetchUpdatedUserRecord(queryClient, user.id);
      if (freshUser) {
        setUser(freshUser);
        onUserUpdated?.(freshUser);
      }
    } catch {
      setUser((prev) => (prev ? ({ ...prev, status: prevStatus } as UserRecord) : null));
      haptics.reject();
      showToast('error', 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
      statusSubmittingRef.current = false;
    }
  }, [isUpdatingStatus, user, onUserUpdated, queryClient]);

  // Delete User Trigger
  const handleDeleteUser = useCallback(async () => {
    if (!user || deleteSubmittingRef.current || isDeleting) return;
    deleteSubmittingRef.current = true;
    setIsDeleting(true);

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        'delete_or_deactivate_user_atomic',
        { p_target_user_id: user.id }
      );

      if (rpcErr || (rpcRes && rpcRes.success === false)) {
        haptics.reject();
        showToast('error', 'Failed to delete user account');
        return;
      }

      haptics.confirm();
      showToast('success', 'User Account Deleted');
      setDeleteConfirmVisible(false);
      onUserUpdated?.({ deleted: true, id: user.id });
      onUserDeleted?.();
      onBack();
    } catch {
      haptics.reject();
      showToast('error', 'An unexpected error occurred during deletion');
    } finally {
      setIsDeleting(false);
      deleteSubmittingRef.current = false;
    }
  }, [isDeleting, user?.id, onUserUpdated, onUserDeleted, onBack]);

  // Communication Handlers
  const cleanPhone = (user?.phone || '').replace(/[^0-9+]/g, '');
  const whatsappUrl = cleanPhone && user
    ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(
        `Hello ${user.full_name}, ReachInternational regarding your profile ${user.employee_id || ''}.`
      )}`
    : '';

  const handleCall = useCallback(() => {
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`);
    } else {
      showToast('error', 'No phone number available for calls');
    }
  }, [cleanPhone]);

  const handleEmail = useCallback(() => {
    if (user?.email) {
      Linking.openURL(`mailto:${user.email}`);
    } else {
      showToast('error', 'No email address registered for this user');
    }
  }, [user?.email]);

  const handleWhatsapp = useCallback(() => {
    if (whatsappUrl) {
      Linking.openURL(whatsappUrl);
    } else {
      showToast('error', 'No phone number available for WhatsApp');
    }
  }, [whatsappUrl]);

  // Header Actions List (Consolidates 3-Dot Actions in MobileHeader)
  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (canEditUsers) {
      list.push({
        id: 'edit-user',
        label: 'Edit Profile',
        icon: <Edit2 size={16} color={theme.colors.ink} />,
        onPress: () => setEditModalVisible(true),
      });
    }

    if (canAssignMachineUsers) {
      list.push({
        id: 'assign-machine',
        label: 'Assign Equipment',
        icon: <Wrench size={16} color={theme.colors.ink} />,
        onPress: () => setAssignMachineVisible(true),
      });
    }

    if (canAssignSupervisorUsers) {
      list.push({
        id: 'assign-supervisor',
        label: 'Assign Supervisor',
        icon: <Users size={16} color={theme.colors.ink} />,
        onPress: () => setAssignSupervisorVisible(true),
      });
    }

    if (canResetPwdUsers) {
      list.push({
        id: 'reset-pwd',
        label: 'Reset Password',
        icon: <KeyRound size={16} color={theme.colors.ink} />,
        onPress: () => setResetPwdConfirmVisible(true),
      });
    }

    if (canActivateUsers && user) {
      list.push({
        id: 'toggle-status',
        label: user.status === 'active' ? 'Deactivate Account' : 'Activate Account',
        icon: (
          <ShieldAlert
            size={16}
            color={user.status === 'active' ? theme.colors.warning : theme.colors.link}
          />
        ),
        onPress: handleToggleStatus,
      });
    }

    if (canDeleteUsers) {
      list.push({
        id: 'delete-user',
        label: 'Delete User Account',
        icon: <Trash2 size={16} color={theme.colors.error} />,
        destructive: true,
        onPress: () => setDeleteConfirmVisible(true),
      });
    }

    return list;
  }, [
    canEditUsers,
    canAssignMachineUsers,
    canAssignSupervisorUsers,
    canResetPwdUsers,
    canActivateUsers,
    canDeleteUsers,
    user?.status,
    theme.colors,
    handleToggleStatus,
  ]);

  const kpis = overviewData?.kpis || {
    assignedMachinesCount: 0,
    totalRunningHours: 0,
    totalDaysWorked: 0,
    documentsCount: 0,
  };

  // Tab Definitions for Horizontal Chips Tab Strip (100% Client Details & Web Parity)
  const tabChips = useMemo(() => {
    const tabs: Array<{
      id: UserDetailTabKey;
      label: string;
      icon: React.ComponentType<{ size?: number; color?: string }>;
      count: number;
    }> = [
      {
        id: 'machines',
        label: 'Machines',
        icon: Truck,
        count: totalMachinesCount || kpis.assignedMachinesCount || 0,
      },
    ];

    if (user?.role === 'supervisor') {
      tabs.push({
        id: 'operators',
        label: 'Operators',
        icon: Users,
        count: totalOperatorsCount || kpis.supervisedOperatorsCount || 0,
      });
    } else if (user?.role === 'operator') {
      tabs.push({
        id: 'logs',
        label: 'Running Logs',
        icon: Clock,
        count: totalLogsCount || 0,
      });
      tabs.push({
        id: 'assignments',
        label: 'Assignments',
        icon: UserCheck,
        count: totalAssignmentsCount || 0,
      });
      tabs.push({
        id: 'attendance',
        label: 'Attendance',
        icon: Calendar,
        count: attendanceData.totalActiveWorkDays || kpis.totalDaysWorked || 0,
      });
    }

    tabs.push({
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      count: totalDocumentsCount || kpis.documentsCount || 0,
    });

    if (canViewAudit) {
      tabs.push({
        id: 'audit',
        label: 'Audit',
        icon: ShieldCheck,
        count: totalAuditCount || 0,
      });
    }

    return tabs;
  }, [
    user?.role,
    totalMachinesCount,
    kpis.assignedMachinesCount,
    totalOperatorsCount,
    kpis.supervisedOperatorsCount,
    totalLogsCount,
    totalAssignmentsCount,
    attendanceData.totalActiveWorkDays,
    kpis.totalDaysWorked,
    totalDocumentsCount,
    kpis.documentsCount,
    canViewAudit,
    totalAuditCount,
  ]);

  React.useEffect(() => {
    if (tabChips.length > 0 && !tabChips.some((t) => t.id === activeTab)) {
      setActiveTab('machines');
    }
  }, [tabChips, activeTab]);

  const filteredMachines = useMemo(() => {
    if (!tabSearch.trim()) return machines;
    const q = tabSearch.toLowerCase().trim();
    return machines.filter(
      (m) =>
        m.machine_id.toLowerCase().includes(q) ||
        m.machine_name.toLowerCase().includes(q) ||
        (m.model && m.model.toLowerCase().includes(q)) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(q)) ||
        (m.assigned_operator_name && m.assigned_operator_name.toLowerCase().includes(q)) ||
        (m.assigned_operator_code && m.assigned_operator_code.toLowerCase().includes(q))
    );
  }, [machines, tabSearch]);

  const filteredOperators = useMemo(() => {
    if (!tabSearch.trim()) return operators;
    const q = tabSearch.toLowerCase().trim();
    return operators.filter(
      (op) =>
        op.full_name.toLowerCase().includes(q) ||
        (op.employee_id && op.employee_id.toLowerCase().includes(q)) ||
        (op.phone && op.phone.toLowerCase().includes(q)) ||
        (op.email && op.email.toLowerCase().includes(q)) ||
        (op.machine_category && op.machine_category.toLowerCase().includes(q)) ||
        (op.active_machine_name && op.active_machine_name.toLowerCase().includes(q)) ||
        (op.active_machine_code && op.active_machine_code.toLowerCase().includes(q)) ||
        (op.city && op.city.toLowerCase().includes(q)) ||
        (op.state && op.state.toLowerCase().includes(q))
    );
  }, [operators, tabSearch]);

  const filteredLogs = useMemo(() => {
    if (!tabSearch.trim()) return runningLogs;
    const q = tabSearch.toLowerCase().trim();
    return runningLogs.filter(
      (l) =>
        l.machine_code.toLowerCase().includes(q) ||
        l.machine_name.toLowerCase().includes(q) ||
        l.log_date.includes(q) ||
        (l.location && l.location.toLowerCase().includes(q)) ||
        (l.remarks && l.remarks.toLowerCase().includes(q))
    );
  }, [runningLogs, tabSearch]);

  const filteredAssignments = useMemo(() => {
    if (!tabSearch.trim()) return assignments;
    const q = tabSearch.toLowerCase().trim();
    return assignments.filter(
      (a) =>
        a.machine_code.toLowerCase().includes(q) ||
        a.machine_name.toLowerCase().includes(q) ||
        (a.model && a.model.toLowerCase().includes(q))
    );
  }, [assignments, tabSearch]);

  const filteredAuditLogs = useMemo(() => {
    if (!tabSearch.trim()) return auditLogs;
    const q = tabSearch.toLowerCase().trim();
    return auditLogs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        (a.actor_name && a.actor_name.toLowerCase().includes(q)) ||
        (a.actor_role && a.actor_role.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
    );
  }, [auditLogs, tabSearch]);

  const filteredDocuments = useMemo(() => {
    if (!tabSearch.trim()) return documents;
    const q = tabSearch.toLowerCase().trim();
    return documents.filter(
      (d) =>
        d.document_type_code.toLowerCase().includes(q) ||
        (d.type_label && d.type_label.toLowerCase().includes(q)) ||
        (d.verification_status && d.verification_status.toLowerCase().includes(q))
    );
  }, [documents, tabSearch]);

  // Document status summary (Web parity with docStats)
  const docStatusCounts = useMemo(() => {
    const verified = documents.filter((d) => d.verification_status === 'verified').length;
    const rejected = documents.filter((d) => d.verification_status === 'rejected').length;
    return { verified, rejected, pending: Math.max(documents.length - verified - rejected, 0) };
  }, [documents]);

  // Statutory numbers on record whose scan has not been uploaded yet
  const missingTypedDocs = useMemo(() => {
    const has = (code: string) => documents.some((d) => d.document_type_code === code);
    const items: Array<{
      code: 'aadhaar' | 'driving_license' | 'bank_document';
      label: string;
      typedLabel: string;
      typedValue: string;
      copyLabel: string;
      revealable: boolean;
    }> = [];

    if (user?.aadhaar_number && !has('aadhaar')) {
      items.push({
        code: 'aadhaar',
        label: 'Aadhaar Card',
        typedLabel: 'Aadhaar number',
        typedValue: showFullAadhaar ? user.aadhaar_number : maskAadhaar(user.aadhaar_number),
        copyLabel: 'Aadhaar',
        revealable: canRevealDocs,
      });
    }
    if (user?.license_number && !has('driving_license')) {
      items.push({
        code: 'driving_license',
        label: 'Driving Licence',
        typedLabel: 'Licence number',
        typedValue: formatLicenseNumber(user.license_number),
        copyLabel: 'Licence',
        revealable: false,
      });
    }
    if (user?.bank_account_number && !has('bank_document')) {
      items.push({
        code: 'bank_document',
        label: 'Banking Document',
        typedLabel: 'Bank account',
        typedValue: `${showFullBankAccount ? user.bank_account_number : maskBankAccount(user.bank_account_number)} · ${
          user.bank_ifsc_code || 'No IFSC'
        }`,
        copyLabel: 'Bank Account',
        revealable: canRevealDocs && canVerifyReject,
      });
    }
    return items;
  }, [
    documents,
    user?.aadhaar_number,
    user?.license_number,
    user?.bank_account_number,
    user?.bank_ifsc_code,
    showFullAadhaar,
    showFullBankAccount,
    canRevealDocs,
    canVerifyReject,
  ]);

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          showBack={true}
          onPressBack={onBack}
          title="User Profile"
          subtitle="Loading profile..."
        />
        <ScrollView style={styles.scrollArea} contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}>
          <UserMachinesSkeleton count={3} />
        </ScrollView>
      </View>
    );
  }

  const roleAvatarStyle = getRoleAvatarColors(user.role, isDark);
  const avatarBg = isDark ? '#ffffff' : '#171717';
  const avatarText = isDark ? '#171717' : '#ffffff';
  const avatarBorder = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)';
  const shiftDisplay = formatShiftTime(user.shift_start_time, user.shift_end_time);
  const supervisorDisplay = overviewData?.supervisorName || user.supervisor?.full_name || 'Unassigned';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* ─── 1. TOP MOBILE HEADER WITH EMPLOYEE ID ─── */}
      <MobileHeader
        showBack={true}
        onPressBack={onBack}
        title={user.full_name}
        subtitle={user.employee_id || `ID: ${user.id.slice(0, 8)}`}
        actions={headerActions}
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ─── 2. MASTER HERO BANNER CARD ─── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Subtle top accent ribbon */}
          <View style={[styles.heroRibbon, { backgroundColor: theme.colors.link }]} />

          {/* Top Row: Avatar + Name + Badges */}
          <View style={styles.heroMainRow}>
            {/* Avatar with Role Styling and Status Pulse Dot */}
            <View style={{ position: 'relative' }}>
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: avatarBg,
                    borderColor: avatarBorder,
                  },
                ]}
              >
                <Text variant="subheading" weight="bold" style={{ color: avatarText }}>
                  {getUserInitials(user.full_name)}
                </Text>
              </View>
              {/* Active/Inactive Status Dot */}
              <View
                style={[
                  styles.statusPulseDot,
                  {
                    backgroundColor: user.status === 'active' ? '#10b981' : '#94a3b8',
                    borderColor: theme.colors.canvasElevated,
                  },
                ]}
              />
            </View>

            {/* Title & Metadata Details */}
            <View style={styles.heroDetails}>
              <Text variant="heading" weight="bold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {user.full_name}
              </Text>

              {/* Badges Row: 1-click copy EMP-xxxx badge, Role, Machine Category, Status */}
              <View style={styles.heroBadgeRow}>
                {/* 1-Click Copy EMP-ID Badge */}
                <Pressable
                  variant="plain"
                  haptic="tap"
                  hitSlopToMin48
                  onPress={() =>
                    handleCopy(
                      user.employee_id || `EMP-${user.id.slice(0, 4).toUpperCase()}`,
                      'Employee ID'
                    )
                  }
                  style={[
                    styles.empIdBadge,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  accessibilityLabel="Copy Employee ID"
                >
                  <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                    {user.employee_id || `EMP-${user.id.slice(0, 4).toUpperCase()}`}
                  </Text>
                  {copiedKey === 'Employee ID' ? (
                    <Check size={11} color="#10b981" />
                  ) : (
                    <Copy size={11} color={theme.colors.mute} />
                  )}
                </Pressable>

                <Badge role={user.role} />

                {user.role === 'operator' && user.machine_category && (
                  <Badge
                    variant="info"
                    label={formatMachineCategoryLabel(user.machine_category)}
                  />
                )}

                <Badge
                  status={user.status}
                  dot
                  customLabel={user.status === 'active' ? 'Active' : 'Inactive'}
                />
              </View>
            </View>
          </View>

          {/* Structured Operational Metadata Grid: Shift, Joining, Supervisor, Location */}
          <View
            style={[
              styles.heroMetadataGrid,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Shift Time */}
            <View style={styles.heroMetaCol}>
              <View style={styles.heroMetaColHeader}>
                <Clock size={12} color="#f59e0b" />
                <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                  Shift Time
                </Text>
              </View>
              <Text variant="caption" weight="semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {shiftDisplay && shiftDisplay !== '—' ? shiftDisplay : 'Standard Shift'}
              </Text>
            </View>

            {/* Joining Date */}
            <View style={styles.heroMetaCol}>
              <View style={styles.heroMetaColHeader}>
                <Calendar size={12} color="#8b5cf6" />
                <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                  Joining Date
                </Text>
              </View>
              <Text variant="caption" weight="semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {formatDate((user as any).doj || user.created_at)}
              </Text>
            </View>

            {/* Supervisor */}
            <View style={styles.heroMetaCol}>
              <View style={styles.heroMetaColHeader}>
                <Users size={12} color="#0d9488" />
                <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                  Supervisor
                </Text>
              </View>
              <Text variant="caption" weight="semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {supervisorDisplay}
              </Text>
            </View>

            {/* Location */}
            <View style={styles.heroMetaCol}>
              <View style={styles.heroMetaColHeader}>
                <MapPin size={12} color="#0284c7" />
                <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                  Location
                </Text>
              </View>
              <Text variant="caption" weight="semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {user.location || (user.city && user.state ? `${user.city}, ${user.state}` : user.city || '—')}
              </Text>
            </View>
          </View>

          {/* Mobile Full-Width Edit Profile Button (Eliminates dead space on mobile) */}
          {canEditUsers && (
            <Pressable
              variant="primary"
              haptic="tap"
              onPress={() => setEditModalVisible(true)}
              style={styles.heroEditProfileBtn}
              accessibilityLabel="Edit Profile"
            >
              <Edit2 size={13} color="#ffffff" />
              <Text variant="label" weight="semibold" style={{ color: '#ffffff' }}>
                Edit Profile
              </Text>
            </Pressable>
          )}
        </View>

        {/* ─── 3. PROFILE DETAILS GROUPS (Single Surface, Zero Duplication) ─── */}
        <View
          style={[
            styles.profileDetailsCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Section Header */}
          <View style={[styles.profileDetailsHeader, { borderBottomColor: theme.colors.hairline }]}>
            <Text variant="micro" weight="bold" style={[styles.profileDetailsHeaderTitle, { color: theme.colors.mute }]}>
              PROFILE DETAILS
            </Text>
            <Text variant="micro" style={{ color: theme.colors.mute }}>
              Directory record · read-only
            </Text>
          </View>

          <View style={styles.profileDetailsBody}>
            {/* Group 1: Contact Information */}
            <View style={styles.profileGroupCard}>
              <View style={styles.profileGroupTitleRow}>
                <View style={[styles.profileGroupIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.1)', borderColor: 'rgba(2, 132, 199, 0.2)' }]}>
                  <Mail size={12} color="#0284c7" />
                </View>
                <Text variant="micro" weight="bold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Contact
                </Text>
              </View>

              <View style={styles.profileGroupRows}>
                {/* Email */}
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Email</Text>
                  <View style={styles.detailValueRow}>
                    <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                      {user.email || '—'}
                    </Text>
                    {user.email ? (
                      <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(user.email, 'Email')}>
                        {copiedKey === 'Email' ? <Check size={12} color="#10b981" /> : <Copy size={12} color={theme.colors.mute} />}
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Phone */}
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Phone</Text>
                  <View style={styles.detailValueRow}>
                    <Text variant="mono" weight="semibold" style={{ color: theme.colors.ink }}>
                      {user.phone || '—'}
                    </Text>
                    {user.phone ? (
                      <Pressable variant="iconButton" haptic="tap" hitSlopToMin48 onPress={() => handleCopy(user.phone, 'Phone')}>
                        {copiedKey === 'Phone' ? <Check size={12} color="#10b981" /> : <Copy size={12} color={theme.colors.mute} />}
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* WhatsApp */}
                <View style={styles.detailRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>WhatsApp</Text>
                  {whatsappUrl ? (
                    <Pressable variant="plain" haptic="tap" hitSlopToMin48 onPress={handleWhatsapp} style={styles.whatsappActionRow}>
                      <WhatsAppIcon size={12} color="#10b981" />
                      <Text variant="caption" weight="bold" style={{ color: '#10b981' }}>
                        Chat direct
                      </Text>
                      <ExternalLink size={10} color="#10b981" />
                    </Pressable>
                  ) : (
                    <Text variant="caption" style={{ color: theme.colors.mute }}>—</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Group 2: Pay & Leave */}
            <View style={[styles.profileGroupCard, { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
              <View style={styles.profileGroupTitleRow}>
                <View style={[styles.profileGroupIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Clock size={12} color="#f59e0b" />
                </View>
                <Text variant="micro" weight="bold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Pay & Leave
                </Text>
              </View>

              <View style={styles.profileGroupRows}>
                {/* PL Leave Quota */}
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>PL Leave Quota</Text>
                  <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                    {(user as any).total_pl_quota != null
                      ? `${(user as any).total_pl_quota - ((user as any).pl_used_as_on_date || 0)} / ${(user as any).total_pl_quota} days`
                      : '12 days'}
                  </Text>
                </View>

                {/* Monthly Salary */}
                {canViewSalary && user.monthly_salary != null && Number(user.monthly_salary) > 0 ? (
                  <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Monthly Salary</Text>
                    <Text variant="mono" weight="bold" style={{ color: '#10b981' }}>
                      ₹{Number(user.monthly_salary).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Compensation</Text>
                    <Text variant="caption" weight="semibold" style={{ color: theme.colors.mute }}>
                      Standard grade
                    </Text>
                  </View>
                )}

                {/* Supervised Operators (if Supervisor) */}
                {user.role === 'supervisor' ? (
                  <View style={styles.detailRow}>
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Supervised</Text>
                    <Pressable
                      variant="plain"
                      haptic="tap"
                      hitSlopToMin48
                      onPress={() => handleTabChange('operators')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text variant="caption" weight="semibold" style={{ color: theme.colors.link }}>
                        {totalOperatorsCount || kpis.supervisedOperatorsCount || 0} operators
                      </Text>
                      <ChevronRight size={12} color={theme.colors.link} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Group 3: Address */}
            <View style={[styles.profileGroupCard, { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
              <View style={styles.profileGroupTitleRow}>
                <View style={[styles.profileGroupIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.2)' }]}>
                  <MapPin size={12} color="#f43f5e" />
                </View>
                <Text variant="micro" weight="bold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Address
                </Text>
              </View>

              <View style={styles.profileGroupRows}>
                {/* Street */}
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Street</Text>
                  <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                    {user.street || user.address || '—'}
                  </Text>
                </View>

                {/* City / District */}
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>City / District</Text>
                  <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                    {user.city && user.district ? `${user.city}, ${user.district}` : user.city || user.district || '—'}
                  </Text>
                </View>

                {/* State */}
                <View style={styles.detailRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>State</Text>
                  <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                    {user.state || '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 4. HORIZONTAL TAB STRIP (CHIPS) ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabStripContent}
          style={styles.tabStripContainer}
        >
          {tabChips.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <Pressable
                key={tab.id}
                variant="chip"
                haptic="select"
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label} tab${tab.count > 0 ? `, ${tab.count} items` : ''}`}
                onPress={() => handleTabChange(tab.id)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                    minHeight: 44,
                  },
                ]}
              >
                <IconComponent size={13} color={isActive ? '#ffffff' : theme.colors.mute} />
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: isActive ? '#ffffff' : theme.colors.ink }}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── 6. TAB CONTENT PANELS WITH LAZY LOADING & INFINITE PAGINATION ─── */}

        {/* TAB 1: Assigned Machinery Fleet */}
        {activeTab === 'machines' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <Truck size={16} color="#0284c7" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  {user.role === 'supervisor' ? 'Supervised Machinery Fleet' : 'Assigned Fleet'}
                </Text>
              </View>

              <View style={styles.panelHeaderRight}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Showing {filteredMachines.length} of {totalMachinesCount} machines
                </Text>
                {canAssignMachineUsers && (
                  <Pressable
                    variant="outline"
                    haptic="tap"
                    hitSlopToMin48
                    onPress={() => setAssignMachineVisible(true)}
                    style={[
                      styles.assignActionBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Plus size={13} color="#f59e0b" />
                    <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                      Assign Equipment
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {isMachinesLoading ? (
              <UserMachinesSkeleton count={2} />
            ) : filteredMachines.length === 0 ? (
              <EmptyState
                title="No Machines Found"
                description={
                  tabSearch
                    ? 'No assigned machines match your search.'
                    : user.role === 'supervisor'
                    ? 'No machinery currently under supervision for this user or their operators.'
                    : 'No machinery currently assigned to this user.'
                }
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredMachines.map((m) => (
                    <MobileMachineCard
                      key={m.id}
                      machine={m}
                      isAdmin={canManageUsers}
                      isSupervisor={isSupervisor}
                      onAssignOperator={canAssignMachineUsers ? () => setAssignMachineVisible(true) : undefined}
                      onViewDetails={(item: any) => {
                        router.push(`/(app)/machines?id=${item.id || item.machine_id}` as any);
                      }}
                    />
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={filteredMachines.length}
                  totalCount={totalMachinesCount}
                  label="machines"
                  hasNextPage={Boolean(hasNextMachines)}
                  isFetchingNextPage={Boolean(isFetchingNextMachines)}
                  onLoadMore={() => fetchNextMachines()}
                />
              </>
            )}
          </View>
        )}

        {/* TAB 1B: Supervised Operators (Supervisor Role Only) */}
        {activeTab === 'operators' && user.role === 'supervisor' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <Users size={16} color="#0284c7" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Supervised Operators
                </Text>
              </View>

              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing {filteredOperators.length} of {totalOperatorsCount} operators
              </Text>
            </View>

            {isOperatorsLoading ? (
              <UserMachinesSkeleton count={2} />
            ) : filteredOperators.length === 0 ? (
              <EmptyState
                title="No Reporting Operators"
                description={
                  tabSearch
                    ? 'No reporting operators match your search.'
                    : 'No operators currently report to this supervisor.'
                }
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredOperators.map((op) => {
                    const cleanPhone = op.phone ? op.phone.replace(/[^0-9+]/g, '') : '';
                    const whatsappNumber = cleanPhone.replace(/^\+/, '');
                    const opShift = formatShiftTime(op.shift_start_time, op.shift_end_time);

                    return (
                      <View
                        key={op.id}
                        style={[
                          styles.machineListItem,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        {/* Operator Header: Avatar, Name, Employee ID & Status Badge */}
                        <View style={styles.machineItemHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View
                              style={[
                                styles.operatorAvatarBox,
                                {
                                  backgroundColor: isDark ? '#262626' : '#f5f5f5',
                                  borderColor: theme.colors.hairline,
                                },
                              ]}
                            >
                              <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                                {getUserInitials(op.full_name)}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text variant="body" weight="semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                                {op.full_name}
                              </Text>
                              <Text variant="mono" style={{ color: theme.colors.mute }}>
                                {op.employee_id || `ID: ${op.id.slice(0, 8)}`}
                              </Text>
                            </View>
                          </View>

                          <Badge
                            status={op.status === 'active' ? 'active' : 'inactive'}
                            customLabel={op.status}
                          />
                        </View>

                        {/* Operator Assignment Details */}
                        <View style={[styles.operatorDetailRows, { borderTopColor: theme.colors.hairline }]}>
                          {op.active_machine_code ? (
                            <View style={styles.operatorDetailRow}>
                              <Text variant="caption" style={{ color: theme.colors.mute }}>
                                Equipment:
                              </Text>
                              <Text
                                variant="caption"
                                weight="semibold"
                                numberOfLines={1}
                                style={[styles.truncateMax, { color: theme.colors.link }]}
                              >
                                {op.active_machine_code} - {op.active_machine_name || 'Machine'}
                              </Text>
                            </View>
                          ) : null}

                          {op.machine_category ? (
                            <View style={styles.operatorDetailRow}>
                              <Text variant="caption" style={{ color: theme.colors.mute }}>
                                Category:
                              </Text>
                              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                                {formatMachineCategoryLabel(op.machine_category)}
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.operatorDetailRow}>
                            <Text variant="caption" style={{ color: theme.colors.mute }}>
                              Shift:
                            </Text>
                            <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                              {opShift}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Contact & Profile Navigation Actions */}
                        <View style={[styles.operatorActionsRow, { borderTopColor: theme.colors.hairline }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {cleanPhone ? (
                              <Pressable
                                variant="outline"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={() => {
                                  Linking.openURL(`tel:${cleanPhone}`);
                                }}
                                style={[
                                  styles.quickIconBtn,
                                  {
                                    backgroundColor: theme.colors.canvasElevated,
                                    borderColor: theme.colors.hairline,
                                  },
                                ]}
                                accessibilityLabel={`Call ${op.full_name}`}
                              >
                                <Phone size={14} color="#0d9488" />
                              </Pressable>
                            ) : null}

                            {whatsappNumber ? (
                              <Pressable
                                variant="outline"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={() => {
                                  Linking.openURL(`https://wa.me/${whatsappNumber}`);
                                }}
                                style={[
                                  styles.quickIconBtn,
                                  {
                                    backgroundColor: theme.colors.canvasElevated,
                                    borderColor: theme.colors.hairline,
                                  },
                                ]}
                                accessibilityLabel={`WhatsApp ${op.full_name}`}
                              >
                                <ExternalLink size={14} color="#10b981" />
                              </Pressable>
                            ) : null}
                          </View>

                          <Pressable
                            variant="buttonPrimary"
                            haptic="tap"
                            hitSlopToMin48
                            onPress={() => {
                              haptics.select();
                              if (onViewUser) {
                                onViewUser(op.id);
                              } else {
                                router.push(`/(app)/users?id=${op.id}`);
                              }
                            }}
                            style={[
                              styles.viewProfileBtn,
                              {
                                backgroundColor: theme.colors.ink,
                              },
                            ]}
                            accessibilityLabel={`View ${op.full_name}'s profile`}
                          >
                            <Text variant="caption" weight="semibold" style={{ color: theme.colors.canvas }}>
                              View Profile →
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <TabPaginationFooter
                  currentCount={filteredOperators.length}
                  totalCount={totalOperatorsCount}
                  label="operators"
                  hasNextPage={Boolean(hasNextOperators)}
                  isFetchingNextPage={Boolean(isFetchingNextOperators)}
                  onLoadMore={() => fetchNextOperators()}
                />
              </>
            )}
          </View>
        )}

        {/* TAB 2: Shift Running Logs */}
        {activeTab === 'logs' && user.role === 'operator' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <Clock size={16} color="#10b981" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Shift Logs
                </Text>
              </View>

              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing {filteredLogs.length} of {totalLogsCount} logs
              </Text>
            </View>

            {isLogsLoading ? (
              <UserLogsSkeleton count={3} />
            ) : filteredLogs.length === 0 ? (
              <EmptyState
                title="No Running Logs"
                description={
                  tabSearch
                    ? 'No running logs match your search.'
                    : 'No telemetry running logs recorded for this operator.'
                }
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredLogs.map((log) => (
                    <RunningLogShiftCard
                      key={log.id}
                      log={{
                        id: log.id,
                        machine_code: log.machine_code || '—',
                        log_date: log.log_date,
                        start_time: log.start_time ?? undefined,
                        end_time: log.end_time ?? undefined,
                        start_meter: log.start_meter ?? 0,
                        end_meter: log.end_meter ?? 0,
                        running_hours: log.running_hours ?? 0,
                        normal_working_hours: log.normal_working_hours ?? undefined,
                        overtime_hours: log.overtime_hours ?? undefined,
                        is_breakdown: Boolean(log.is_breakdown),
                        location: log.location ?? undefined,
                        remarks: log.remarks ?? undefined,
                        created_at: log.created_at ?? undefined,
                        machine: {
                          machine_id: log.machine_code || '—',
                          model: log.model ?? undefined,
                        },
                        operator: {
                          full_name: user.full_name,
                        },
                      } as any}
                      logsViewMode="operator"
                    />
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={filteredLogs.length}
                  totalCount={totalLogsCount}
                  label="shift logs"
                  hasNextPage={Boolean(hasNextLogs)}
                  isFetchingNextPage={Boolean(isFetchingNextLogs)}
                  onLoadMore={() => fetchNextLogs()}
                />
              </>
            )}
          </View>
        )}

        {/* TAB 3: Machine Assignment History */}
        {activeTab === 'assignments' && user.role === 'operator' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <Wrench size={16} color="#0d9488" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Assignment History
                </Text>
              </View>

              <View style={styles.panelHeaderRight}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>
                  Showing {filteredAssignments.length} of {totalAssignmentsCount} assignments
                </Text>
                {canAssignMachineUsers && (
                  <Pressable
                    variant="outline"
                    haptic="tap"
                    hitSlopToMin48
                    onPress={() => setAssignMachineVisible(true)}
                    style={[
                      styles.assignActionBtn,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                    accessibilityLabel="Manage Shifts"
                  >
                    <Plus size={13} color="#0d9488" />
                    <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
                      Manage Shifts
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {isAssignmentsLoading ? (
              <UserAssignmentsSkeleton count={2} />
            ) : filteredAssignments.length === 0 ? (
              <EmptyState
                title="No Assignments Found"
                description={
                  tabSearch
                    ? 'No assignments match your search.'
                    : 'No past or active machine assignments recorded.'
                }
              />
            ) : (
              <>
                <View style={styles.assignmentsGrid}>
                  {filteredAssignments.map((a) => (
                    <View
                      key={a.id}
                      style={[
                        styles.assignmentCard,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                          width: isDesktop ? '31.5%' : isTablet ? '48.5%' : '100%',
                        },
                      ]}
                    >
                      <View style={styles.assignmentTopRow}>
                        <View>
                          <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                            {a.machine_code}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
                            {a.model || a.machine_name}
                          </Text>
                        </View>

                        <Badge
                          status={a.is_active ? 'active' : 'inactive'}
                          customLabel={a.is_active ? 'Active Duty' : 'Ended'}
                        />
                      </View>

                      <View style={styles.assignmentMetaRow}>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Shift</Text>
                        <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                          {a.shift_code ? `Shift ${a.shift_code} · ` : ''}
                          {formatShiftTime(a.shift_start_time, a.shift_end_time)}
                        </Text>
                      </View>

                      <View style={styles.assignmentMetaRow}>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>Assigned At</Text>
                        <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                          {formatDate(a.assigned_at)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={filteredAssignments.length}
                  totalCount={totalAssignmentsCount}
                  label="assignments"
                  hasNextPage={Boolean(hasNextAssignments)}
                  isFetchingNextPage={Boolean(isFetchingNextAssignments)}
                  onLoadMore={() => fetchNextAssignments()}
                />
              </>
            )}
          </View>
        )}

        {/* TAB 4: Attendance & Timesheet Ledger (Operator Role Only) */}
        {activeTab === 'attendance' && user.role === 'operator' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <Calendar size={16} color="#f59e0b" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Attendance Ledger
                </Text>
              </View>

              <Pressable
                variant="buttonPrimary"
                haptic="tap"
                hitSlopToMin48
                onPress={() => router.push('/attendance' as any)}
                style={[styles.viewLedgerBtn, { backgroundColor: theme.colors.ink }]}
                accessibilityLabel="View Attendance Ledger"
              >
                <Text variant="caption" weight="bold" style={{ color: theme.colors.canvas }}>
                  View Ledger
                </Text>
                <ExternalLink size={12} color={theme.colors.canvas} />
              </Pressable>
            </View>

            {isAttendanceLoading ? (
              <UserAttendanceSkeleton />
            ) : (
              <View style={styles.attendanceCardsRow}>
                {/* 1. Total Active Work Days */}
                <View
                  style={[
                    styles.attendanceStatCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: isDesktop ? '31.5%' : isTablet ? '48.5%' : '100%',
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Total Active Work Days
                  </Text>
                  <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginVertical: 4 }}>
                    {attendanceData?.totalActiveWorkDays ?? kpis.totalDaysWorked}
                  </Text>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>
                    From verified daily machine logs
                  </Text>
                </View>

                {/* 2. Total Shift Running Time */}
                <View
                  style={[
                    styles.attendanceStatCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: isDesktop ? '31.5%' : isTablet ? '48.5%' : '100%',
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Total Shift Running Time
                  </Text>
                  <Text variant="heading" weight="bold" style={{ color: '#10b981', marginVertical: 4 }}>
                    {attendanceData?.totalShiftRunningTime ?? kpis.totalRunningHours} h
                  </Text>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>
                    Cumulated operating duration
                  </Text>
                </View>

                {/* 3. Shift Schedule */}
                <View
                  style={[
                    styles.attendanceStatCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                      width: isDesktop ? '31.5%' : isTablet ? '48.5%' : '100%',
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Shift Schedule
                  </Text>
                  <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginVertical: 4 }}>
                    {shiftDisplay !== '—' ? shiftDisplay : '06:00 AM - 02:00 PM'}
                  </Text>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>
                    Standard operating window
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* TAB 5: KYC & Documents */}
        {activeTab === 'documents' && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <FileText size={16} color="#0d9488" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Identity & KYC Documents
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge status="active" customLabel={`${docStatusCounts.verified} verified`} />
                {docStatusCounts.pending > 0 && (
                  <Badge status="pending" customLabel={`${docStatusCounts.pending} pending`} />
                )}
                {docStatusCounts.rejected > 0 && (
                  <Badge status="overdue" customLabel={`${docStatusCounts.rejected} rejected`} />
                )}
              </View>
            </View>

            {isDocumentsLoading ? (
              <UserDocumentsSkeleton count={2} />
            ) : filteredDocuments.length === 0 && missingTypedDocs.length === 0 ? (
              <EmptyState
                title="No Identity Documents"
                description="No statutory identity or compliance documents have been uploaded for this profile yet."
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredDocuments.map((doc) => {
                    const isVerified = doc.verification_status === 'verified';
                    const isRejected = doc.verification_status === 'rejected';
                    const isPending = !isVerified && !isRejected;
                    const thumbUrl = doc.thumb_signed_url || doc.signed_url;
                    const isPdf = (doc.mime_type || '').toLowerCase() === 'application/pdf';

                    let typedLabel = '';
                    let typedValue = '';
                    let revealable = false;
                    if (doc.document_type_code === 'aadhaar' && user.aadhaar_number) {
                      typedLabel = 'Aadhaar number';
                      typedValue = showFullAadhaar ? user.aadhaar_number : maskAadhaar(user.aadhaar_number);
                      revealable = canRevealDocs;
                    } else if (doc.document_type_code === 'driving_license' && user.license_number) {
                      typedLabel = 'Licence number';
                      typedValue = formatLicenseNumber(user.license_number);
                    } else if (doc.document_type_code === 'bank_document' && user.bank_account_number) {
                      typedLabel = 'Bank account';
                      typedValue = `${showFullBankAccount ? user.bank_account_number : maskBankAccount(user.bank_account_number)} · ${
                        user.bank_ifsc_code || 'No IFSC'
                      }`;
                      revealable = canRevealDocs && canVerifyReject;
                    }

                    return (
                      <View
                        key={doc.id}
                        style={[
                          styles.docListItem,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.docLeftRow}>
                          {/* Scan thumbnail — tap opens the full document */}
                          <Pressable
                            variant="plain"
                            haptic="tap"
                            hitSlopToMin48
                            onPress={() => handleViewDocument(doc)}
                            accessibilityLabel={`View full ${doc.type_label || doc.document_type_code} document`}
                            style={[
                              styles.docThumbBox,
                              { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                            ]}
                          >
                            {isPdf ? (
                              <View style={{ alignItems: 'center', gap: 2 }}>
                                <FileText size={18} color="#e11d48" />
                                <Text variant="micro" weight="bold" style={{ color: '#e11d48' }}>
                                  PDF
                                </Text>
                              </View>
                            ) : thumbUrl ? (
                              <Image source={{ uri: thumbUrl }} style={styles.docThumbImage} resizeMode="cover" />
                            ) : (
                              <View style={{ alignItems: 'center', gap: 2 }}>
                                <FileText size={18} color="#0284c7" />
                                <Text variant="micro" weight="bold" style={{ color: '#0284c7' }}>
                                  IMG
                                </Text>
                              </View>
                            )}
                          </Pressable>

                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                                {doc.type_label || doc.document_type_code.replace(/_/g, ' ').toUpperCase()}
                              </Text>
                              {isVerified && <Badge status="active" customLabel="Verified" />}
                              {isRejected && <Badge status="overdue" customLabel="Rejected" />}
                              {isPending && (
                                <Badge
                                  status="pending"
                                  customLabel={doc.is_pending_request ? 'Pending Review' : 'Pending'}
                                />
                              )}
                            </View>
                            <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 2 }}>
                              {(doc.mime_type.split('/')[1] || '').toUpperCase()} · {formatFileSizeMobile(doc.file_size_bytes)} ·{' '}
                              {formatDate(doc.created_at)}
                            </Text>

                            {isRejected && doc.rejection_reason ? (
                              <Text variant="micro" style={{ color: '#ef4444', marginTop: 2 }}>
                                Reason: {doc.rejection_reason}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        {/* Registered statutory number shown beside its own scan */}
                        {typedLabel ? (
                          <View
                            style={[
                              styles.docTypedValueBox,
                              { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute }}>
                                {typedLabel.toUpperCase()}
                              </Text>
                              <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                                {typedValue}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              {revealable && (
                                <Pressable
                                  variant="plain"
                                  haptic="select"
                                  hitSlopToMin48
                                  onPress={
                                    doc.document_type_code === 'aadhaar'
                                      ? handleToggleAadhaar
                                      : handleToggleBankAccount
                                  }
                                  accessibilityLabel={
                                    (doc.document_type_code === 'aadhaar' ? showFullAadhaar : showFullBankAccount)
                                      ? 'Hide number'
                                      : 'Reveal full number'
                                  }
                                  style={{ padding: 6 }}
                                >
                                  {(doc.document_type_code === 'aadhaar' ? showFullAadhaar : showFullBankAccount) ? (
                                    <EyeOff size={14} color={theme.colors.mute} />
                                  ) : (
                                    <Eye size={14} color={theme.colors.mute} />
                                  )}
                                </Pressable>
                              )}
                              <Pressable
                                variant="plain"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={() =>
                                  handleCopy(
                                    doc.document_type_code === 'aadhaar'
                                      ? user.aadhaar_number
                                      : doc.document_type_code === 'driving_license'
                                        ? user.license_number
                                        : user.bank_account_number,
                                    doc.document_type_code === 'aadhaar'
                                      ? 'Aadhaar'
                                      : doc.document_type_code === 'driving_license'
                                        ? 'Licence'
                                        : 'Bank Account'
                                  )
                                }
                                accessibilityLabel="Copy registered number"
                                style={{ padding: 6 }}
                              >
                                {copiedKey ===
                                (doc.document_type_code === 'aadhaar'
                                  ? 'Aadhaar'
                                  : doc.document_type_code === 'driving_license'
                                    ? 'Licence'
                                    : 'Bank Account') ? (
                                  <Check size={14} color="#10b981" />
                                ) : (
                                  <Copy size={14} color={theme.colors.mute} />
                                )}
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Pressable
                            variant="outline"
                            haptic="tap"
                            hitSlopToMin48
                            disabled={openingDocId === doc.id}
                            onPress={() => handleViewDocument(doc)}
                            style={[
                              styles.viewDocBtn,
                              {
                                backgroundColor: theme.colors.canvasElevated,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                            accessibilityLabel={`View ${doc.type_label || 'Document'}`}
                          >
                            {openingDocId === doc.id ? (
                              <ActivityIndicator size="small" color={theme.colors.ink} />
                            ) : (
                              <>
                                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                                  View document
                                </Text>
                                <ChevronRight size={12} color={theme.colors.mute} />
                              </>
                            )}
                          </Pressable>

                          {!isVerified && canVerifyReject && (
                            <Pressable
                              variant="buttonPrimary"
                              haptic="tap"
                              hitSlopToMin48
                              onPress={() => {
                                haptics.select();
                                router.push('/(app)/approvals');
                              }}
                              style={[
                                styles.viewDocBtn,
                                {
                                  backgroundColor: theme.colors.primary,
                                  borderColor: theme.colors.primary,
                                  minHeight: 44,
                                  paddingHorizontal: 12,
                                },
                              ]}
                              accessibilityLabel="Review in Approvals"
                            >
                              <Text variant="caption" weight="bold" style={{ color: '#ffffff' }}>
                                Review in approvals →
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Staged Replacement Document Callout (100% Web Parity) */}
                        {doc.pending_replacement && (
                          <View
                            style={[
                              styles.replacementCallout,
                              {
                                backgroundColor: isDark ? 'rgba(245, 166, 35, 0.08)' : 'rgba(245, 166, 35, 0.05)',
                                borderColor: isDark ? 'rgba(245, 166, 35, 0.3)' : 'rgba(245, 166, 35, 0.25)',
                              },
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Clock size={13} color="#f59e0b" />
                                <Text variant="caption" weight="bold" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                                  Replacement Pending Review
                                </Text>
                              </View>
                              <Text variant="micro" style={{ color: theme.colors.mute }}>
                                {formatDate(doc.pending_replacement.created_at)}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              {doc.pending_replacement.thumb_signed_url ? (
                                <Image
                                  source={{ uri: doc.pending_replacement.thumb_signed_url }}
                                  style={styles.replacementThumbImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={[styles.replacementThumbPlaceholder, { backgroundColor: isDark ? '#262626' : '#f5f5f5' }]}>
                                  <FileText size={18} color="#f59e0b" />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                                  New replacement image uploaded
                                </Text>
                                <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 2 }}>
                                  Inspect and verify before approving replacement
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Pressable
                                variant="outline"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={() => handlePreviewReplacement(doc)}
                                style={[styles.replacementActionBtn, { borderColor: theme.colors.hairline }]}
                                accessibilityLabel="Preview Replacement"
                              >
                                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                                  Preview New
                                </Text>
                              </Pressable>

                              {canVerifyReject && (
                                <Pressable
                                  variant="buttonPrimary"
                                  haptic="tap"
                                  hitSlopToMin48
                                  onPress={() => {
                                    haptics.select();
                                    router.push('/(app)/approvals');
                                  }}
                                  style={[
                                    styles.replacementActionBtn,
                                    { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, minHeight: 44, paddingHorizontal: 12 },
                                  ]}
                                  accessibilityLabel="Review in Approvals"
                                >
                                  <Text variant="caption" weight="bold" style={{ color: '#ffffff' }}>
                                    Review in Approvals →
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Statutory numbers on record without a scanned file yet */}
                  {missingTypedDocs.map((item) => (
                    <View
                      key={item.code}
                      style={[
                        styles.docListItem,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                          borderStyle: 'dashed',
                        },
                      ]}
                    >
                      <View style={styles.docLeftRow}>
                        <View
                          style={[
                            styles.docThumbBox,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                              borderStyle: 'dashed',
                            },
                          ]}
                        >
                          <FileText size={18} color={theme.colors.faint} />
                          <Text variant="micro" weight="bold" style={{ color: theme.colors.faint, marginTop: 2 }}>
                            NO SCAN
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                              {item.label}
                            </Text>
                            <Badge status="inactive" customLabel="Not uploaded" />
                          </View>
                          <Text variant="micro" style={{ color: theme.colors.mute, marginTop: 2 }}>
                            Number on record · no scan uploaded
                          </Text>

                          <View
                            style={[
                              styles.docTypedValueBox,
                              { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute }}>
                                {item.typedLabel.toUpperCase()}
                              </Text>
                              <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }} numberOfLines={1}>
                                {item.typedValue}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              {item.revealable && (
                                <Pressable
                                  variant="plain"
                                  haptic="select"
                                  hitSlopToMin48
                                  onPress={() => {
                                    if (item.code === 'aadhaar') handleToggleAadhaar();
                                    else handleToggleBankAccount();
                                  }}
                                  accessibilityLabel="Reveal full number"
                                  style={{ padding: 6 }}
                                >
                                  {(item.code === 'aadhaar' ? showFullAadhaar : showFullBankAccount) ? (
                                    <EyeOff size={14} color={theme.colors.mute} />
                                  ) : (
                                    <Eye size={14} color={theme.colors.mute} />
                                  )}
                                </Pressable>
                              )}
                              <Pressable
                                variant="plain"
                                haptic="tap"
                                hitSlopToMin48
                                onPress={() =>
                                  handleCopy(
                                    item.code === 'aadhaar'
                                      ? user.aadhaar_number
                                      : item.code === 'driving_license'
                                        ? user.license_number
                                        : user.bank_account_number,
                                    item.copyLabel
                                  )
                                }
                                accessibilityLabel={`Copy ${item.copyLabel}`}
                                style={{ padding: 6 }}
                              >
                                {copiedKey === item.copyLabel ? (
                                  <Check size={14} color="#10b981" />
                                ) : (
                                  <Copy size={14} color={theme.colors.mute} />
                                )}
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={filteredDocuments.length}
                  totalCount={totalDocumentsCount}
                  label="documents"
                  hasNextPage={Boolean(hasNextDocs)}
                  isFetchingNextPage={Boolean(isFetchingNextDocs)}
                  onLoadMore={() => fetchNextDocs()}
                />
              </>
            )}

            {/* DPDP Act 2023 Compliance Notice */}
            <View style={[styles.dpdpNoticeRow, { borderTopColor: theme.colors.hairline }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Shield size={12} color={theme.colors.mute} />
                <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute }}>
                  Complies with Aadhaar Act & DPDP Act 2023
                </Text>
              </View>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                {filteredDocuments.length} files
              </Text>
            </View>
          </View>
        )}

        {/* TAB 6: Audit Trail (RBAC Guarded) */}
        {activeTab === 'audit' && canViewAudit && (
          <View
            style={[
              styles.tabPanelCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={[styles.panelHeader, { borderBottomColor: theme.colors.hairline }]}>
              <View style={styles.panelHeaderLeft}>
                <ShieldCheck size={16} color="#0284c7" />
                <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                  Profile Audit Trail
                </Text>
              </View>

              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing {filteredAuditLogs.length} of {totalAuditCount} logs
              </Text>
            </View>

            {isAuditLoading ? (
              <UserAuditSkeleton count={2} />
            ) : filteredAuditLogs.length === 0 ? (
              <EmptyState
                title="No Audit Records"
                description={
                  tabSearch
                    ? 'No audit events match your search.'
                    : 'No administrative changes or profile updates recorded.'
                }
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredAuditLogs.map((log) => (
                    <View
                      key={log.id}
                      style={[
                        styles.auditLogItem,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={styles.auditLogTopRow}>
                        <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <Text variant="micro" style={{ color: theme.colors.mute }}>
                          {formatTimeAgo(log.created_at)}
                        </Text>
                      </View>

                      <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                        By: {log.actor_name || 'System'} ({log.actor_role || 'System'})
                      </Text>

                      {log.details && (
                        <View style={[styles.auditDetailsWell, { backgroundColor: theme.colors.canvasElevated }]}>
                          <Text variant="mono" style={{ color: theme.colors.ink }}>
                            {JSON.stringify(log.details, null, 2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={filteredAuditLogs.length}
                  totalCount={totalAuditCount}
                  label="audit entries"
                  hasNextPage={Boolean(hasNextAudit)}
                  isFetchingNextPage={Boolean(isFetchingNextAudit)}
                  onLoadMore={() => fetchNextAudit()}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── 7. MODALS & CONFIRMATION DIALOGS ─── */}

      {/* Edit User Profile Modal */}
      <UserEditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={user}
        onSuccess={async (updated) => {
          if (updated) {
            setUser((prev): UserRecord | null => (prev ? ({ ...prev, ...updated, id: prev.id } as UserRecord) : null));
            if (user) onUserUpdated?.({ ...user, ...updated });
          }
          // Selective Query Optimization: Refetch only updated user row without full overview re-queries
          if (user) {
            const freshUser = await fetchUpdatedUserRecord(queryClient, user.id);
            if (freshUser) {
              setUser(freshUser);
              onUserUpdated?.(freshUser);
            }
          }
        }}
      />

      {/* Assign Supervisor Modal */}
      <AssignSupervisorModal
        visible={assignSupervisorVisible}
        onClose={() => setAssignSupervisorVisible(false)}
        user={user}
        onSuccess={async (updated) => {
          if (updated) {
            setUser((prev): UserRecord | null => (prev ? ({ ...prev, ...updated, id: prev.id } as UserRecord) : null));
            if (user) onUserUpdated?.({ ...user, ...updated });
          }
          // Selective Query Optimization: Refetch only updated user row without full overview re-queries
          if (user) {
            const freshUser = await fetchUpdatedUserRecord(queryClient, user.id);
            if (freshUser) {
              setUser(freshUser);
              onUserUpdated?.(freshUser);
            }
          }
        }}
      />

      {/* Assign Equipment Modal */}
      <AssignMachineModal
        visible={assignMachineVisible}
        onClose={() => setAssignMachineVisible(false)}
        user={user}
        userRole={currentUserRole || undefined}
        onSuccess={() => {
          refetchMachines();
          refetchAssignments();
          if (user) {
            fetchUpdatedUserRecord(queryClient, user.id);
          }
        }}
      />

      {/* Delete User Confirmation Dialog */}
      <DeleteUserConfirmDialog
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleDeleteUser}
        user={user}
        isDeleting={isDeleting}
      />

      {/* Status Toggle Confirmation Dialog */}
      <ConfirmDialog
        visible={statusConfirmVisible}
        onClose={() => setStatusConfirmVisible(false)}
        onConfirm={handleConfirmToggleStatus}
        title={user?.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
        message={`Are you sure you want to ${
          user?.status === 'active' ? 'deactivate' : 'activate'
        } ${user?.full_name || 'this user'}'s staff account?`}
        confirmText={user?.status === 'active' ? 'Deactivate' : 'Activate'}
        variant={user?.status === 'active' ? 'warning' : 'primary'}
        isLoading={isUpdatingStatus}
      />

      {/* Reset Password Confirmation Dialog */}
      <ConfirmDialog
        visible={resetPwdConfirmVisible}
        onClose={() => setResetPwdConfirmVisible(false)}
        onConfirm={handleExecuteResetPassword}
        title="Reset User Password"
        message={`Are you sure you want to reset the password for ${user?.full_name || 'this user'}? A new temporary password will be generated and displayed immediately.`}
        confirmText="Reset Password"
        variant="warning"
        isLoading={isResettingPassword}
      />

      {/* Temporary Password Result Modal (100% Web Parity) */}
      <PasswordResetModal
        visible={!!resetPasswordResult}
        onClose={() => setResetPasswordResult(null)}
        userName={resetPasswordResult?.userName || user?.full_name || ''}
        temporaryPassword={resetPasswordResult?.temporaryPassword || ''}
      />

      {/* Document Viewer Modal */}
      <MobileDocumentViewerModal
        onClose={() => setActiveViewerDoc(null)}
        document={activeViewerDoc}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  heroRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDetails: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroEmpId: {
    opacity: 0.7,
    marginTop: -2,
    marginBottom: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  empIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  statusPulseDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  heroMetadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 10,
    marginTop: 12,
    gap: 10,
  },
  heroMetaCol: {
    flex: 1,
    minWidth: '45%',
    gap: 2,
  },
  heroMetaColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroEditProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radiusNumeric.md,
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    marginTop: 12,
    minHeight: 40,
  },
  profileDetailsCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  profileDetailsHeaderTitle: {
  },
  profileDetailsBody: {
    gap: 0,
  },
  profileGroupCard: {
    padding: 14,
  },
  profileGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  profileGroupIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGroupRows: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70%',
  },
  truncateMax: {
    flexShrink: 1,
  },
  whatsappActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabStripContainer: {
    maxHeight: 48,
    marginBottom: 16,
  },
  tabStripContent: {
    gap: 6,
    paddingVertical: 2,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  tabPanelCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assignActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 36,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsList: {
    gap: 10,
  },
  machineListItem: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  machineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  machineItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  machineItemDetails: {
    gap: 4,
  },
  machineItemSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  assignmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assignmentCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  assignmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  assignmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.pill,
    minHeight: 38,
  },
  attendanceCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attendanceStatCard: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 14,
  },
  docListItem: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  docLeftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  docThumbBox: {
    width: 56,
    height: 72,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docThumbImage: {
    width: '100%',
    height: '100%',
  },
  docTypedValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 44,
  },
  replacementCallout: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
  },
  replacementThumbImage: {
    width: 48,
    height: 48,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.4)',
  },
  replacementThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replacementActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 44,
  },
  auditLogItem: {
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  auditLogTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  auditDetailsWell: {
    borderRadius: radiusNumeric.sm,
    padding: 8,
    marginTop: 4,
  },
  machineOperatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  operatorAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: radiusNumeric.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  operatorDetailRows: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  operatorDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  operatorActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
  },
  quickIconBtn: {
    width: 44,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    minHeight: 44,
  },
  tabSearchContainer: {
    paddingHorizontal: 0,
    paddingBottom: spacingNumeric.sm,
  },
  dpdpNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginBottom: 8,
  },
});
