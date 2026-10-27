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
  KPICard,
  KPIGrid,
  AppRefreshControl,
  EmptyState,
  showToast,
} from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  formatDate,
  formatTimeAgo,
  maskAadhaar,
  formatLicenseNumber,
  getUserInitials,
} from '@reachinternational/utils';
import { useQueryClient } from '@tanstack/react-query';
import { RunningLogShiftCard } from '../operations/RunningLogShiftCard';
import { DeleteUserConfirmDialog } from './DeleteUserConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { UserEditModal } from './UserEditModal';
import { AssignSupervisorModal } from './AssignSupervisorModal';
import { AssignMachineModal } from './AssignMachineModal';
import { PasswordResetModal } from './PasswordResetModal';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../documents/MobileDocumentViewerModal';
import {
  useUserDetailOverview,
  useUserDetailMachinesInfinite,
  useUserDetailRunningLogsInfinite,
  useUserDetailAssignmentsInfinite,
  useUserDetailAttendanceInfinite,
  useUserDetailDocumentsInfinite,
  useUserDetailAuditLogsInfinite,
  resetUserPasswordMobile,
  fetchUpdatedUserRecord,
  type UserMachineItem,
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
  X,
  ChevronRight,
  MoreVertical,
  Plus,
  Shield,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
} from '../ui/icon';

export type UserDetailTabKey = 'machines' | 'logs' | 'assignments' | 'attendance' | 'documents' | 'audit';

export interface UserDetailViewProps {
  user: UserRecord;
  onBack: () => void;
  currentUserRole?: string;
  currentUserId?: string;
  onUserUpdated?: (updatedUser?: any) => void;
  onUserDeleted?: () => void;
  initialTab?: UserDetailTabKey;
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
  onBack,
  currentUserRole = 'super_admin',
  currentUserId,
  onUserUpdated,
  onUserDeleted,
  initialTab = 'machines',
}) => {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 641 && windowWidth <= 1023;
  const isDesktop = windowWidth >= 1024;

  const [user, setUser] = useState<UserRecord>(initialUser);
  const [activeTab, setActiveTab] = useState<UserDetailTabKey>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Lazy tab navigation states: track which tabs have been navigated to
  const [visitedTabs, setVisitedTabs] = useState<Record<UserDetailTabKey, boolean>>({
    machines: initialTab === 'machines',
    logs: initialTab === 'logs',
    assignments: initialTab === 'assignments',
    attendance: initialTab === 'attendance',
    documents: initialTab === 'documents',
    audit: initialTab === 'audit',
  });

  const handleTabChange = useCallback((newTab: string) => {
    const tabKey = newTab as UserDetailTabKey;
    setActiveTab(tabKey);
    setVisitedTabs((prev) => ({ ...prev, [tabKey]: true }));
    haptics.select();
  }, []);

  // 1. Overview Hook: Loads User Details, KPIs, Supervisor
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useUserDetailOverview(user.id);

  // Synchronize user from overview if refreshed
  React.useEffect(() => {
    if (overviewData?.user) {
      setUser((prev) => ({ ...prev, ...overviewData.user }));
    }
  }, [overviewData?.user]);

  // 2. Tab Hooks: Strictly Lazy Loaded on Tab Activation with Infinite Pagination!
  const {
    data: machinesInfiniteData,
    isLoading: isMachinesLoading,
    isFetchingNextPage: isFetchingNextMachines,
    hasNextPage: hasNextMachines,
    fetchNextPage: fetchNextMachines,
    refetch: refetchMachines,
  } = useUserDetailMachinesInfinite(user.id, visitedTabs.machines, 20);

  const machines = useMemo(() => {
    return machinesInfiniteData?.pages.flatMap((p) => p.machines) || [];
  }, [machinesInfiniteData?.pages]);
  const totalMachinesCount = machinesInfiniteData?.pages[0]?.totalCount ?? machines.length;

  const {
    data: logsInfiniteData,
    isLoading: isLogsLoading,
    isFetchingNextPage: isFetchingNextLogs,
    hasNextPage: hasNextLogs,
    fetchNextPage: fetchNextLogs,
    refetch: refetchLogs,
  } = useUserDetailRunningLogsInfinite(user.id, visitedTabs.logs, 20);

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
  } = useUserDetailAssignmentsInfinite(user.id, visitedTabs.assignments, 20);

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
  } = useUserDetailAttendanceInfinite(user.id, visitedTabs.attendance, 20);

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
  } = useUserDetailDocumentsInfinite(user.id, visitedTabs.documents, 20);

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
  const isSelf = currentUserId === user.id;

  const canManageUsers = isSuperAdmin || isAdmin || isManager || isHr;
  const canEditUsers = canManageUsers;
  const canDeleteUsers = (isSuperAdmin || isAdmin) && !isSelf;
  const canActivateUsers = (isSuperAdmin || isAdmin || isHr) && !isSelf;
  const canAssignSupervisorUsers = canManageUsers;
  const canAssignMachineUsers = (canManageUsers || isSupervisor) && user.role === 'operator';
  const canResetPwdUsers = canManageUsers;
  const canViewSalary = canManageUsers || isSelf;
  const canRevealDocs = isSuperAdmin || isAdmin || isHr || isSelf;
  const canViewAudit = canManageUsers;

  const {
    data: auditInfiniteData,
    isLoading: isAuditLoading,
    isFetchingNextPage: isFetchingNextAudit,
    hasNextPage: hasNextAudit,
    fetchNextPage: fetchNextAudit,
    refetch: refetchAudit,
  } = useUserDetailAuditLogsInfinite(user.id, visitedTabs.audit && canViewAudit, 20);

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
        const cleanPath = doc.storage_path.replace(/^\/+/, '');
        const { data: signedData, error: signErr } = await supabase.storage
          .from('user_files')
          .createSignedUrl(cleanPath, 3600);

        if (signErr) {
          showToast('error', 'Unable to retrieve document from storage');
          return;
        }
        targetUrl = signedData?.signedUrl || null;
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
        fileName: doc.storage_path.split('/').pop() || doc.document_type_code,
      });
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to open document');
    } finally {
      setOpeningDocId(null);
    }
  }, [openingDocId]);

  // Administrative Password Reset Trigger (Web Parity)
  const handleExecuteResetPassword = useCallback(async () => {
    if (isResettingPassword) return;
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
          userName: res.userName || user.full_name,
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
  }, [isResettingPassword, user.id, user.full_name]);

  // Status Toggle
  const handleToggleStatus = useCallback(() => {
    if (isSelf) {
      showToast('error', 'You cannot change your own account status.');
      return;
    }
    if (normalizedRole === 'admin' && user.role === 'super_admin') {
      showToast('error', 'Only Super Admins can modify Super Admin accounts.');
      return;
    }
    setStatusConfirmVisible(true);
  }, [isSelf, normalizedRole, user.role]);

  const handleConfirmToggleStatus = useCallback(async () => {
    if (statusSubmittingRef.current || isUpdatingStatus) return;
    statusSubmittingRef.current = true;
    setIsUpdatingStatus(true);
    setStatusConfirmVisible(false);

    const prevStatus = user.status;
    const targetStatus = prevStatus === 'active' ? 'inactive' : 'active';
    setUser((prev) => ({ ...prev, status: targetStatus }));

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('toggle_user_status_atomic', {
        p_target_user_id: user.id,
      });

      if (rpcErr || (rpcRes && rpcRes.success === false)) {
        setUser((prev) => ({ ...prev, status: prevStatus }));
        haptics.reject();
        showToast('error', 'Failed to update user status');
        return;
      }

      const updatedStatus = rpcRes?.status || targetStatus;
      setUser((prev) => ({ ...prev, status: updatedStatus }));
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
      setUser((prev) => ({ ...prev, status: prevStatus }));
      haptics.reject();
      showToast('error', 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
      statusSubmittingRef.current = false;
    }
  }, [isUpdatingStatus, user, onUserUpdated, queryClient]);

  // Delete User Trigger
  const handleDeleteUser = useCallback(async () => {
    if (deleteSubmittingRef.current || isDeleting) return;
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
  }, [isDeleting, user.id, onUserUpdated, onUserDeleted, onBack]);

  // Communication Handlers
  const cleanPhone = (user.phone || '').replace(/[^0-9+]/g, '');
  const whatsappUrl = cleanPhone
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
    if (user.email) {
      Linking.openURL(`mailto:${user.email}`);
    } else {
      showToast('error', 'No email address registered for this user');
    }
  }, [user.email]);

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

    if (canActivateUsers) {
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
    user.status,
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
      {
        id: 'logs',
        label: 'Running Logs',
        icon: Clock,
        count: totalLogsCount || 0,
      },
      {
        id: 'assignments',
        label: 'Assignments',
        icon: UserCheck,
        count: totalAssignmentsCount || 0,
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: Calendar,
        count: attendanceData.totalActiveWorkDays || kpis.totalDaysWorked || 0,
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: FileText,
        count: totalDocumentsCount || kpis.documentsCount || 0,
      },
    ];

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
    totalMachinesCount,
    kpis.assignedMachinesCount,
    totalLogsCount,
    totalAssignmentsCount,
    attendanceData.totalActiveWorkDays,
    kpis.totalDaysWorked,
    totalDocumentsCount,
    kpis.documentsCount,
    canViewAudit,
    totalAuditCount,
  ]);

  const filteredMachines = machines;
  const filteredLogs = runningLogs;
  const filteredAssignments = assignments;
  const filteredAuditLogs = auditLogs;

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

          <View style={styles.heroMainRow}>
            {/* Initials Avatar Box (100% Black & White, Dark & Light Optimized) */}
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

            {/* Title & Metadata Details */}
            <View style={styles.heroDetails}>
              <Text variant="heading" weight="bold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                {user.full_name}
              </Text>

              {/* Small, low opacity Employee ID directly below the user name (no copy icon) */}
              <Text
                variant="caption"
                weight="medium"
                style={[styles.heroEmpId, { color: theme.colors.mute }]}
              >
                {user.employee_id || `EMP-${user.id.slice(0, 4).toUpperCase()}`}
              </Text>

              {/* Badges Row */}
              <View style={styles.heroBadgeRow}>
                <Badge role={user.role} />

                <Badge
                  status={user.status}
                  dot
                  customLabel={user.status === 'active' ? 'Active' : 'Inactive'}
                />

                {shiftDisplay !== '—' && (
                  <View style={styles.heroSecondaryItem}>
                    <Clock size={12} color="#f59e0b" />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>
                      {shiftDisplay}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. 4-CARD HIGH-DENSITY METADATA GRID ─── */}
        <View style={styles.metadataGrid}>
          {/* Card 1: Contact Information */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                width: isDesktop ? '24%' : isTablet ? '48.5%' : '100%',
              },
            ]}
          >
            <View style={[styles.infoCardHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Mail size={14} color="#0284c7" />
              <Text variant="label" weight="bold" style={[styles.infoCardTitle, { color: theme.colors.mute }]}>
                CONTACT INFORMATION
              </Text>
            </View>

            <View style={styles.infoCardBody}>
              {/* Email */}
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Email</Text>
                <View style={styles.infoValueRow}>
                  <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                    {user.email || '—'}
                  </Text>
                  {user.email ? (
                    <Pressable
                      variant="plain"
                      haptic="tap"
                      hitSlopToMin48
                      onPress={() => handleCopy(user.email, 'Email')}
                    >
                      {copiedKey === 'Email' ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} color={theme.colors.mute} />
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Phone */}
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Phone</Text>
                <View style={styles.infoValueRow}>
                  <Text variant="mono" weight="semibold" style={{ color: theme.colors.ink }}>
                    {user.phone || '—'}
                  </Text>
                  {user.phone ? (
                    <Pressable
                      variant="plain"
                      haptic="tap"
                      hitSlopToMin48
                      onPress={() => handleCopy(user.phone, 'Phone')}
                    >
                      {copiedKey === 'Phone' ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} color={theme.colors.mute} />
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* WhatsApp */}
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>WhatsApp</Text>
                {whatsappUrl ? (
                  <Pressable variant="plain" haptic="tap" hitSlopToMin48 onPress={handleWhatsapp}>
                    <View style={styles.whatsappActionRow}>
                      <WhatsAppIcon size={13} color="#10b981" />
                      <Text variant="caption" weight="bold" style={{ color: '#10b981' }}>
                        Chat Direct
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Text variant="caption" style={{ color: theme.colors.mute }}>—</Text>
                )}
              </View>
            </View>
          </View>

          {/* Card 2: Employment Details */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                width: isDesktop ? '24%' : isTablet ? '48.5%' : '100%',
              },
            ]}
          >
            <View style={[styles.infoCardHeader, { borderBottomColor: theme.colors.hairline }]}>
              <User size={14} color="#0d9488" />
              <Text variant="label" weight="bold" style={[styles.infoCardTitle, { color: theme.colors.mute }]}>
                EMPLOYMENT DETAILS
              </Text>
            </View>

            <View style={styles.infoCardBody}>
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Employee ID</Text>
                <View style={styles.infoValueRow}>
                  <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                    {user.employee_id || `EMP-${user.id.slice(0, 4).toUpperCase()}`}
                  </Text>
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
                    accessibilityLabel="Copy Employee ID"
                  >
                    {copiedKey === 'Employee ID' ? (
                      <Check size={12} color="#10b981" />
                    ) : (
                      <Copy size={12} color={theme.colors.mute} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Joining Date</Text>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {formatDate((user as any).doj || user.created_at)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Supervisor</Text>
                <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                  {supervisorDisplay}
                </Text>
              </View>
            </View>
          </View>

          {/* Card 3: Shift & Compensation */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                width: isDesktop ? '24%' : isTablet ? '48.5%' : '100%',
              },
            ]}
          >
            <View style={[styles.infoCardHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Clock size={14} color="#f59e0b" />
              <Text variant="label" weight="bold" style={[styles.infoCardTitle, { color: theme.colors.mute }]}>
                SHIFT & COMPENSATION
              </Text>
            </View>

            <View style={styles.infoCardBody}>
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Shift Hours</Text>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {shiftDisplay}
                </Text>
              </View>

              {canViewSalary && user.monthly_salary != null && Number(user.monthly_salary) > 0 && (
                <View style={styles.infoRow}>
                  <Text variant="caption" style={{ color: theme.colors.mute }}>Monthly Salary</Text>
                  <Text variant="mono" weight="bold" style={{ color: '#10b981' }}>
                    ₹{Number(user.monthly_salary).toLocaleString('en-IN')} / mo
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>PL Leave Quota</Text>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {(user as any).total_pl_quota != null
                    ? `${(user as any).total_pl_quota - ((user as any).pl_used_as_on_date || 0)} / ${(user as any).total_pl_quota} days`
                    : '12 / 12 days'}
                </Text>
              </View>
            </View>
          </View>

          {/* Card 4: Location & Address */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                width: isDesktop ? '24%' : isTablet ? '48.5%' : '100%',
              },
            ]}
          >
            <View style={[styles.infoCardHeader, { borderBottomColor: theme.colors.hairline }]}>
              <MapPin size={14} color="#e11d48" />
              <Text variant="label" weight="bold" style={[styles.infoCardTitle, { color: theme.colors.mute }]}>
                LOCATION & ADDRESS
              </Text>
            </View>

            <View style={styles.infoCardBody}>
              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>City / District</Text>
                <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                  {user.city && user.district ? `${user.city}, ${user.district}` : user.city || user.district || '—'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>State</Text>
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {user.state || '—'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text variant="caption" style={{ color: theme.colors.mute }}>Street</Text>
                <Text variant="caption" weight="semibold" numberOfLines={1} style={[styles.truncateMax, { color: theme.colors.ink }]}>
                  {user.street || user.address || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 4. 4-CARD KPI METRICS STRIP ─── */}
        <View style={styles.kpiContainer}>
          <KPIGrid columns={4}>
            <KPICard
              label="Assigned Fleet"
              value={kpis.assignedMachinesCount}
              icon={Truck}
              variant="default"
              isLoading={isOverviewLoading}
            />

            <KPICard
              label="Running Hours"
              value={`${kpis.totalRunningHours} h`}
              icon={Clock}
              variant="success"
              isLoading={isOverviewLoading}
            />

            <KPICard
              label="Work Days"
              value={`${kpis.totalDaysWorked} days`}
              icon={Calendar}
              variant="warning"
              isLoading={isOverviewLoading}
            />

            <KPICard
              label="KYC Documents"
              value={`${kpis.documentsCount} files`}
              icon={FileText}
              variant="default"
              isLoading={isOverviewLoading}
            />
          </KPIGrid>
        </View>

        {/* ─── 5. HORIZONTAL TAB STRIP (CHIPS) ─── */}
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
                  Assigned Fleet
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
                description="No machinery currently assigned to this user."
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {filteredMachines.map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.machineListItem,
                        {
                          backgroundColor: theme.colors.canvas,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={styles.machineItemHeader}>
                        <View style={styles.machineItemHeaderLeft}>
                          <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                            {m.machine_id}
                          </Text>
                          <Badge
                            status={m.status === 'rented' ? 'rented' : 'available'}
                            customLabel={m.status === 'rented' ? 'Rented' : 'Available'}
                          />
                        </View>

                        <Pressable
                          variant="plain"
                          haptic="tap"
                          hitSlopToMin48
                          onPress={() => {
                            showToast('info', `Inspecting ${m.machine_id}`);
                          }}
                          style={styles.inspectBtn}
                        >
                          <Text variant="caption" weight="bold" style={{ color: theme.colors.link }}>
                            Inspect
                          </Text>
                          <ExternalLink size={12} color={theme.colors.link} />
                        </Pressable>
                      </View>

                      <View style={styles.machineItemDetails}>
                        <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                          {m.machine_name} {m.model ? `· ${m.model}` : ''}
                        </Text>

                        <View style={styles.machineItemSpecsRow}>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
                            S/N: {m.serial_number || '—'}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
                            MFR: {m.manufacturer || '—'}
                          </Text>
                          <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                            {m.hour_meter != null ? `${m.hour_meter} h` : '—'}
                          </Text>
                        </View>
                      </View>
                    </View>
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

        {/* TAB 2: Shift Running Logs */}
        {activeTab === 'logs' && (
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
                description="No telemetry running logs recorded for this operator."
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
        {activeTab === 'assignments' && (
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
                description="No past or active machine assignments recorded."
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

        {/* TAB 4: Attendance & Timesheet Ledger */}
        {activeTab === 'attendance' && (
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
                  Identity & Compliance Documents
                </Text>
              </View>

              <Text variant="caption" style={{ color: theme.colors.mute }}>
                Showing {documents.length} of {totalDocumentsCount} verified files
              </Text>
            </View>

            {isDocumentsLoading ? (
              <UserDocumentsSkeleton count={2} />
            ) : documents.length === 0 ? (
              <EmptyState
                title="No Identity Documents"
                description="No statutory identity or compliance documents have been verified for this account."
              />
            ) : (
              <>
                <View style={styles.cardsList}>
                  {documents.map((doc) => (
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
                        <View style={[styles.docIconBox, { backgroundColor: theme.colors.canvasElevated }]}>
                          <FileText size={16} color="#0d9488" />
                        </View>
                        <View>
                          <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                            {doc.type_label || doc.document_type_code.replace(/_/g, ' ').toUpperCase()}
                          </Text>
                          <Text variant="micro" style={{ color: theme.colors.mute }}>
                            Uploaded {formatDate(doc.created_at)}
                          </Text>
                        </View>
                      </View>

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
                              View Document
                            </Text>
                            <ChevronRight size={12} color={theme.colors.mute} />
                          </>
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>

                <TabPaginationFooter
                  currentCount={documents.length}
                  totalCount={totalDocumentsCount}
                  label="documents"
                  hasNextPage={Boolean(hasNextDocs)}
                  isFetchingNextPage={Boolean(isFetchingNextDocs)}
                  onLoadMore={() => fetchNextDocs()}
                />
              </>
            )}
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
                description="No administrative changes or profile updates recorded."
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
            setUser((prev) => ({ ...prev, ...updated }));
            onUserUpdated?.({ ...user, ...updated });
          }
          // Selective Query Optimization: Refetch only updated user row without full overview re-queries
          const freshUser = await fetchUpdatedUserRecord(queryClient, user.id);
          if (freshUser) {
            setUser(freshUser);
            onUserUpdated?.(freshUser);
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
            setUser((prev) => ({ ...prev, ...updated }));
            onUserUpdated?.({ ...user, ...updated });
          }
          // Selective Query Optimization: Refetch only updated user row without full overview re-queries
          const freshUser = await fetchUpdatedUserRecord(queryClient, user.id);
          if (freshUser) {
            setUser(freshUser);
            onUserUpdated?.(freshUser);
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
          fetchUpdatedUserRecord(queryClient, user.id);
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
        title={user.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
        message={`Are you sure you want to ${
          user.status === 'active' ? 'deactivate' : 'activate'
        } ${user.full_name}'s staff account?`}
        confirmText={user.status === 'active' ? 'Deactivate' : 'Activate'}
        variant={user.status === 'active' ? 'warning' : 'primary'}
        isLoading={isUpdatingStatus}
      />

      {/* Reset Password Confirmation Dialog */}
      <ConfirmDialog
        visible={resetPwdConfirmVisible}
        onClose={() => setResetPwdConfirmVisible(false)}
        onConfirm={handleExecuteResetPassword}
        title="Reset User Password"
        message={`Are you sure you want to reset the password for ${user.full_name}? A new temporary password will be generated and displayed immediately.`}
        confirmText="Reset Password"
        variant="warning"
        isLoading={isResettingPassword}
      />

      {/* Temporary Password Result Modal (100% Web Parity) */}
      <PasswordResetModal
        visible={!!resetPasswordResult}
        onClose={() => setResetPasswordResult(null)}
        userName={resetPasswordResult?.userName || user.full_name}
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
  heroSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  heroSecondaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editProfileBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 36,
    zIndex: 10,
  },
  heroDetailsWithEdit: {
    paddingRight: 110,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 14,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  infoCardTitle: {
  },
  infoCardBody: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoValueRow: {
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
  kpiContainer: {
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    padding: 12,
  },
  docLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radiusNumeric.pill,
    borderWidth: 1,
    minHeight: 40,
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
});
