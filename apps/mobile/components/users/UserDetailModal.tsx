import React, { useState, useMemo, useRef } from 'react';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { showToast, SearchableSelect, type SelectOption } from '../ui';
import { useTheme } from '../ui/ThemeProvider';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { DeleteUserConfirmDialog } from './DeleteUserConfirmDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  formatDate,
  formatTimeAgo,
  maskAadhaar,
  formatLicenseNumber,
} from '@reachinternational/utils';
import { isSupervisedRole } from '@reachinternational/permissions';
import { notifyUserStatusChanged, notifyUserUpdated } from '../../lib/notifications';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../documents/MobileDocumentViewerModal';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
  Copy,
  Check,
  Clock,
  Building2,
  Calendar,
  Eye,
  EyeOff,
  Edit2,
  ChevronDown,
  FileText,
  AlertTriangle,
} from '../ui/icon';
import * as Clipboard from 'expo-clipboard';

export interface UserRecord {
  id: string;
  employee_id?: string | null;
  email?: string | null;
  full_name: string;
  phone?: string | null;
  role: string;
  status: string;
  shift_time?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  street?: string | null;
  address?: string | null;
  monthly_salary?: number | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  state_id?: number | null;
  location?: string | null;
  aadhaar_number?: string | null;
  license_number?: string | null;
  supervisor_id?: string | null;
  supervisor_ids?: string[] | null;
  supervisor?: {
    id: string;
    full_name: string;
    email?: string | null;
  } | null;
  supervisors?: Array<{
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
  }>;
  working_location_id?: string | null;
  working_location?: {
    id: string;
    name: string;
    type?: string;
    city?: string | null;
  } | null;
  assigned_machines?: Array<{
    id: string;
    machine_id: string;
    model?: string | null;
  }>;
  created_at?: string;
}

export interface UserDetailModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  currentUserRole?: string;
  currentUserId?: string;
  onSuccess: (updatedUser?: any) => void;
  onEdit?: (user: UserRecord) => void;
  onResetPassword?: (user: UserRecord) => void;
}

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'hr', label: 'HR' },
  { value: 'operator', label: 'Operator' },
];

function getRoleMeta(role: string) {
  switch (role) {
    case 'super_admin':
      return {
        label: 'Super Admin',
        badgeBg: '#fee2e2',
        badgeText: '#b91c1c',
        badgeBorder: '#fca5a5',
        icon: <ShieldAlert size={18} color="#b91c1c" />,
      };
    case 'admin':
      return {
        label: 'Admin',
        badgeBg: '#fef3c7',
        badgeText: '#b45309',
        badgeBorder: '#fde68a',
        icon: <ShieldCheck size={18} color="#b45309" />,
      };
    case 'manager':
      return {
        label: 'Manager',
        badgeBg: '#e0e7ff',
        badgeText: '#4338ca',
        badgeBorder: '#c7d2fe',
        icon: <ShieldCheck size={18} color="#4338ca" />,
      };
    case 'supervisor':
      return {
        label: 'Supervisor',
        badgeBg: '#ccfbf1',
        badgeText: '#0f766e',
        badgeBorder: '#99f6e4',
        icon: <ShieldCheck size={18} color="#0f766e" />,
      };
    case 'hr':
      return {
        label: 'HR',
        badgeBg: '#d1fae5',
        badgeText: '#047857',
        badgeBorder: '#a7f3d0',
        icon: <ShieldCheck size={18} color="#047857" />,
      };
    case 'operator':
      return {
        label: 'Operator',
        badgeBg: '#fef3c7',
        badgeText: '#92400e',
        badgeBorder: '#fde68a',
        icon: <Shield size={18} color="#92400e" />,
      };
    default:
      return {
        label: role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'User',
        badgeBg: '#f1f5f9',
        badgeText: '#475569',
        badgeBorder: '#cbd5e1',
        icon: <Shield size={18} color="#64748b" />,
      };
  }
}

function formatRoleName(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'hr':
      return 'HR';
    case 'operator':
      return 'Operator';
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
      return '#6366f1';
    case 'supervisor':
      return '#0d9488';
    case 'hr':
      return '#059669';
    case 'operator':
      return '#d97706';
    default:
      return '#64748b';
  }
}

const ROLE_SELECT_OPTIONS: SelectOption[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full system and database access' },
  { value: 'admin', label: 'Admin', description: 'System administration and user management' },
  { value: 'manager', label: 'Manager', description: 'Operational oversight and report approval' },
  { value: 'supervisor', label: 'Supervisor', description: 'Team management and shift monitoring' },
  { value: 'hr', label: 'HR', description: 'Human resources and employee documentation' },
  { value: 'operator', label: 'Operator', description: 'Shift operations and machine telemetry' },
];

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  onClose,
  user,
  currentUserRole = 'super_admin',
  currentUserId,
  onSuccess,
  onEdit,
  onResetPassword,
}) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Role selector state
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // Supervisor selector state
  const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
  const [activeSupervisors, setActiveSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [viewerDoc, setViewerDoc] = useState<MobileViewerDoc | null>(null);

  // Status toggle confirmation state
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const statusSubmittingRef = useRef(false);

  // Delete user confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteSubmittingRef = useRef(false);

  // General action error message state
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setActionErrorMessage(null);
  }, [visible, user?.id]);

  React.useEffect(() => {
    async function loadSupervisors() {
      try {
        const { data } = await supabase.rpc('get_active_supervisors_public');
        if (data) setActiveSupervisors(data as Array<{ id: string; full_name: string; email?: string }>);
      } catch {
        // ignore
      }
    }

    async function loadDocuments() {
      if (!user?.id) {
        setUserDocuments([]);
        return;
      }
      const isStaff = currentUserRole === 'super_admin' || currentUserRole === 'admin' || currentUserRole === 'hr';
      if (!isStaff) return;
      try {
        const { data: docs } = await supabase
          .from('user_documents')
          .select('id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, created_at, updated_at')
          .eq('user_id', user.id);

        if (docs && docs.length > 0) {
          const withUrls = await Promise.all(
            docs.map(async (doc: any) => {
              const { data: urlData } = await supabase.storage
                .from('user_files')
                .createSignedUrl(doc.storage_path, 300);
              return { ...doc, signed_url: urlData?.signedUrl || null };
            })
          );
          setUserDocuments(withUrls);
        } else {
          setUserDocuments([]);
        }
      } catch {
        setUserDocuments([]);
      }
    }

    if (visible) {
      loadSupervisors();
      loadDocuments();
    }
  }, [visible, user?.id, currentUserRole]);

  // Supervisor selection options (always defined unconditionally to obey Rules of Hooks)
  const supervisorSelectOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'None (Unassigned)', description: 'No direct supervisor' },
    ...activeSupervisors.map((s) => ({
      value: s.id,
      label: s.full_name,
      description: s.email || undefined,
    })),
  ], [activeSupervisors]);

  // When no user is provided (all hooks have completed)
  if (!user) {
    if (!visible) return null;
    return (
      <AppModal
        visible={visible}
        onClose={onClose}
        variant={isDesktop ? 'center' : 'fullscreen'}
        panelStyle={
          isDesktop
            ? {
                maxWidth: 480,
                width: '100%',
                padding: 0,
                borderRadius: radiusNumeric.lg,
                overflow: 'hidden',
              }
            : undefined
        }
        testID="user-detail-modal-error"
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated, flex: 1, width: '100%' }]}>
          <View style={[styles.notchContainer, { backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.notch, { backgroundColor: theme.colors.hairline }]} />
          </View>
          <View style={[styles.header, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <Text variant="heading" style={[styles.userName, { color: theme.colors.ink }]}>
                User Details
              </Text>
            </View>
            <Touchable preset="icon" onPress={onClose} style={styles.closeBtn} testID="user-detail-error-close">
              <X size={20} color={theme.colors.mute} />
            </Touchable>
          </View>
          <View style={styles.errorStateContainer}>
            <View style={[styles.errorIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}>
              <AlertTriangle size={32} color={theme.colors.error} />
            </View>
            <Text variant="heading" style={[styles.errorStateTitle, { color: theme.colors.ink }]}>
              User Not Found
            </Text>
            <Text variant="caption" style={[styles.errorStateMessage, { color: theme.colors.mute }]}>
              Unable to load staff profile details. The record could not be found or was removed.
            </Text>
            <Touchable
              preset="button"
              style={[styles.errorStateBtn, { backgroundColor: theme.colors.ink }]}
              onPress={onClose}
            >
              <Text variant="label" style={{ color: theme.colors.canvas }}>Close</Text>
            </Touchable>
          </View>
        </View>
      </AppModal>
    );
  }

  // Derived role information (guaranteed non-null)
  const roleName = formatRoleName(user.role);
  const roleAccent = getRoleAccentColor(user.role);
  const isSuperAdmin = currentUserRole === 'super_admin';
  const isSelf = currentUserId === user.id;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      // Fallback
    }
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEmailPress = () => {
    if (user.email) {
      Linking.openURL(`mailto:${user.email}`).catch(() => { });
    }
  };

  const handlePhonePress = () => {
    if (user.phone) {
      const clean = user.phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`).catch(() => { });
    }
  };

  const handleToggleStatus = () => {
    setShowStatusConfirm(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (statusSubmittingRef.current || isUpdatingStatus) return;
    statusSubmittingRef.current = true;
    setIsUpdatingStatus(true);
    haptics.select();

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('toggle_user_status_atomic', {
        p_target_user_id: user.id,
      });

      if (rpcErr) {
        haptics.reject();
        const msg = rpcErr.message || 'Failed to update user status.';
        setActionErrorMessage(msg);
        showToast('error', 'Status Update Failed', msg);
        return;
      }

      if (rpcRes && rpcRes.success === false) {
        haptics.reject();
        const msg = rpcRes.error || 'Failed to update user status.';
        setActionErrorMessage(msg);
        showToast('error', 'Status Update Failed', msg);
        return;
      }

      const updatedStatus = rpcRes?.status || (user.status === 'active' ? 'inactive' : 'active');
      const updatedUser = {
        ...user,
        status: updatedStatus,
        assigned_machines: updatedStatus === 'inactive' ? [] : user.assigned_machines,
      };

      haptics.confirm();
      notifyUserStatusChanged(user.full_name, updatedStatus);
      showToast(
        'success',
        updatedStatus === 'active' ? 'Account Activated' : 'Account Deactivated',
        rpcRes?.message || `${user.full_name}'s account is now ${updatedStatus}.`
      );

      setShowStatusConfirm(false);
      onSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      haptics.reject();
      const msg = err?.message || 'Failed to update user status.';
      setActionErrorMessage(msg);
      showToast('error', 'Status Update Failed', msg);
    } finally {
      setIsUpdatingStatus(false);
      statusSubmittingRef.current = false;
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    setIsUpdating(true);
    setActionErrorMessage(null);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      notifyUserUpdated(user.full_name, newRole);
      showToast('success', 'Role Updated', `Updated ${user.full_name}'s role.`);
      onSuccess({ ...user, role: newRole });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update user role.';
      setActionErrorMessage(msg);
      showToast('error', 'Role Update Failed', msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSupervisor = async (newSupervisorId: string | null) => {
    setIsUpdating(true);
    setActionErrorMessage(null);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          supervisor_id: newSupervisorId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;

      if (newSupervisorId) {
        try {
          await supabase
            .from('user_supervisors')
            .upsert({ user_id: user.id, supervisor_id: newSupervisorId }, { onConflict: 'user_id,supervisor_id' });
        } catch {
          // ignore junction fallback
        }
      }

      const assignedSup = newSupervisorId ? activeSupervisors.find((s: { id: string }) => s.id === newSupervisorId) : null;
      showToast('success', 'Supervisor Updated', 'Supervisor assignment updated.');
      onSuccess({
        ...user,
        supervisor_id: newSupervisorId || null,
        supervisor: assignedSup
          ? {
              id: assignedSup.id,
              full_name: assignedSup.full_name,
              email: assignedSup.email || null,
            }
          : null,
        supervisors: assignedSup
          ? [
              {
                id: assignedSup.id,
                full_name: assignedSup.full_name,
                email: assignedSup.email || null,
              },
            ]
          : [],
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update supervisor assignment.';
      setActionErrorMessage(msg);
      showToast('error', 'Supervisor Update Failed', msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUserClick = () => {
    setDeleteErrorMessage(null);
    setShowDeleteConfirm(true);
  };

  const handleExecuteDelete = async () => {
    if (deleteSubmittingRef.current || isDeleting) return;
    deleteSubmittingRef.current = true;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      const { data, error } = await supabase.rpc('delete_or_deactivate_user_atomic', {
        p_target_user_id: user.id,
      });
      if (error) throw error;
      const msg = data?.message || (data?.action === 'deactivated' ? `Account for ${user.full_name} has been safely deactivated.` : `User ${user.full_name} has been deleted.`);
      showToast('success', data?.action === 'deactivated' ? 'Account Deactivated' : 'User Deleted', msg);
      setShowDeleteConfirm(false);
      onSuccess({ deleted: true, id: user.id });
      onClose();
    } catch (err: any) {
      setDeleteErrorMessage(err?.message || 'Failed to delete user account.');
      showToast('error', 'Deletion Error', err?.message || 'Failed to delete user account.');
    } finally {
      setIsDeleting(false);
      deleteSubmittingRef.current = false;
    }
  };

  const assignedSupervisorName = user?.supervisors && user.supervisors.length > 0
    ? user.supervisors.map((s) => s.full_name).join(', ')
    : user?.supervisor?.full_name;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'fullscreen'}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 640,
              width: '100%',
              height: '85%',
              maxHeight: 740,
              padding: 0,
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : undefined
      }
      testID="user-detail-modal"
    >
      <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated, flex: 1, width: '100%' }]}>
        {/* Mobile Drag Notch Handle */}
        <View style={[styles.notchContainer, { backgroundColor: theme.colors.canvas }]}>
          <View style={[styles.notch, { backgroundColor: theme.colors.hairline }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTextWrap}>
              <Text variant="heading" style={[styles.userName, { color: theme.colors.ink, flexShrink: 1 }]} numberOfLines={1}>
                {user.full_name}
              </Text>
              <View style={styles.badgesRow}>
                {/* Role Badge */}
                <Badge
                  role={user.role}
                  label={roleName}
                  size="md"
                />

                {/* Status Badge */}
                <Badge
                  status={user.status}
                  dot
                  label={user.status === 'active' ? 'Active' : (user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1).toLowerCase() : 'Inactive')}
                  size="md"
                />
              </View>
            </View>
          </View>

          <Touchable preset="icon" onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={theme.colors.mute} />
          </Touchable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {actionErrorMessage && (
            <View
              style={[
                styles.inlineErrorBanner,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : '#fef2f2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
                },
              ]}
            >
              <AlertTriangle size={15} color={theme.colors.error} />
              <Text variant="caption" style={[styles.inlineErrorText, { color: theme.colors.error }]}>
                {actionErrorMessage}
              </Text>
              <Touchable preset="icon" onPress={() => setActionErrorMessage(null)}>
                <X size={14} color={theme.colors.error} />
              </Touchable>
            </View>
          )}

          {/* Quick Contact Buttons Row */}
          <View style={styles.quickContactGrid}>
            <Touchable
              preset="button"
              style={[
                styles.quickContactBtn,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
              onPress={handleEmailPress}
            >
              <Mail size={15} color={theme.colors.link} />
              <Text variant="label" style={{ color: theme.colors.ink }}>Email User</Text>
            </Touchable>

            {user.phone ? (
              <Touchable
                preset="button"
                style={[
                  styles.quickContactBtn,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
                onPress={handlePhonePress}
              >
                <Phone size={15} color="#10b981" />
                <Text variant="label" style={{ color: theme.colors.ink }}>Call Phone</Text>
              </Touchable>
            ) : (
              <View
                style={[
                  styles.quickContactBtn,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, opacity: 0.5 },
                ]}
              >
                <Phone size={15} color={theme.colors.mute} />
                <Text variant="label" style={{ color: theme.colors.mute }}>No Phone</Text>
              </View>
            )}
          </View>

          {/* ACCOUNT DETAILS Well */}
          <View
            style={[
              styles.detailsWell,
              { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
            ]}
          >
            <View style={[styles.detailsWellHeader, { borderBottomColor: theme.colors.hairline }]}>
              <Text variant="caption" style={[styles.detailsWellTitle, { color: theme.colors.mute }]}>ACCOUNT DETAILS</Text>
            </View>

            {/* Employee ID */}
            {user.employee_id ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <CreditCard size={13} color={theme.colors.mute} />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Employee ID</Text>
                </View>
                <View style={styles.detailValueWrap}>
                  <Text variant="mono" style={[styles.detailValue, { color: theme.colors.ink }]}>
                    {user.employee_id}
                  </Text>
                  <Touchable
                    preset="icon"
                    style={styles.fieldCopyBtn}
                    onPress={() => copyToClipboard(user.employee_id!, 'Employee ID')}
                  >
                    {copiedField === 'Employee ID' ? (
                      <Check size={13} color="#10b981" />
                    ) : (
                      <Copy size={13} color={theme.colors.mute} />
                    )}
                  </Touchable>
                </View>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <Mail size={13} color={theme.colors.mute} />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Email</Text>
              </View>
              <View style={styles.detailValueWrap}>
                <Text style={[styles.detailValue, { color: theme.colors.ink }]} numberOfLines={1}>
                  {user.email}
                </Text>
                <Touchable
                  preset="icon"
                  style={styles.fieldCopyBtn}
                  onPress={() => copyToClipboard(user.email || '', 'Email')}
                >
                  {copiedField === 'Email' ? (
                    <Check size={13} color="#10b981" />
                  ) : (
                    <Copy size={13} color={theme.colors.mute} />
                  )}
                </Touchable>
              </View>
            </View>

            {/* Phone */}
            {user.phone ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Phone size={13} color={theme.colors.mute} />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Phone</Text>
                </View>
                <View style={styles.detailValueWrap}>
                  <Text variant="mono" style={[styles.detailValue, { color: theme.colors.ink, }]}>
                    {user.phone}
                  </Text>
                  <Touchable
                    preset="icon"
                    style={styles.fieldCopyBtn}
                    onPress={() => copyToClipboard(user.phone!, 'Phone')}
                  >
                    {copiedField === 'Phone' ? (
                      <Check size={13} color="#10b981" />
                    ) : (
                      <Copy size={13} color={theme.colors.mute} />
                    )}
                  </Touchable>
                </View>
              </View>
            ) : null}

            {/* Shift Timing */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <Clock size={13} color="#0284c7" />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Shift Timing</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.ink }]}>
                {user.shift_time || 'Standard / Day Shift'}
              </Text>
            </View>

            {/* Street Address */}
            {(user.street || user.address) ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <MapPin size={13} color="#d97706" />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Street Address</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.colors.ink, textAlign: 'right', flex: 1 }]}>
                  {user.street || user.address}
                </Text>
              </View>
            ) : null}

            {/* Monthly Salary */}
            {user.monthly_salary != null && Number(user.monthly_salary) > 0 ? (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <CreditCard size={13} color="#10b981" />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Monthly Salary</Text>
                </View>
                <Text style={[styles.detailValue, { color: '#10b981', }]}>
                  ₹{Number(user.monthly_salary).toLocaleString('en-IN')} / mo
                </Text>
              </View>
            ) : null}

            {/* City / District */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <MapPin size={13} color="#10b981" />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>City / District</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.ink }]}>
                {user.city && user.district
                  ? `${user.city}, ${user.district}`
                  : user.city || user.district || '—'}
              </Text>
            </View>

            {/* State */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <MapPin size={13} color="#10b981" />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>State</Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.ink }]}>
                {user.state || '—'}
              </Text>
            </View>

            {/* Assigned Supervisor */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <User size={13} color="#0d9488" />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>
                  {user.supervisors && user.supervisors.length > 1 ? 'Assigned Supervisors' : 'Assigned Supervisor'}
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.ink, textAlign: 'right', flex: 1 }]} numberOfLines={2}>
                {assignedSupervisorName || '—'}
              </Text>
            </View>


            {/* Aadhaar Number */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <ShieldCheck size={13} color={theme.colors.link} />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Aadhaar Number</Text>
              </View>
              <View style={styles.detailValueWrap}>
                <Text variant="mono" style={[styles.detailValue, { color: theme.colors.ink, }]}>
                  {user.aadhaar_number
                    ? showFullAadhaar
                      ? user.aadhaar_number
                      : maskAadhaar(user.aadhaar_number)
                    : '—'}
                </Text>
                {user.aadhaar_number ? (
                  <>
                    <Touchable
                      preset="icon"
                      style={styles.fieldCopyBtn}
                      onPress={() => setShowFullAadhaar((prev) => !prev)}
                    >
                      {showFullAadhaar ? (
                        <EyeOff size={13} color={theme.colors.mute} />
                      ) : (
                        <Eye size={13} color={theme.colors.mute} />
                      )}
                    </Touchable>
                    <Touchable
                      preset="icon"
                      style={styles.fieldCopyBtn}
                      onPress={() => copyToClipboard(user.aadhaar_number!, 'Aadhaar')}
                    >
                      {copiedField === 'Aadhaar' ? (
                        <Check size={13} color="#10b981" />
                      ) : (
                        <Copy size={13} color={theme.colors.mute} />
                      )}
                    </Touchable>
                  </>
                ) : null}
              </View>
            </View>

            {/* Driving Licence Number */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabelWrap}>
                <CreditCard size={13} color={theme.colors.link} />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Licence Number</Text>
              </View>
              <View style={styles.detailValueWrap}>
                <Text variant="mono" style={[styles.detailValue, { color: theme.colors.ink, }]}>
                  {user.license_number ? formatLicenseNumber(user.license_number) : '—'}
                </Text>
                {user.license_number ? (
                  <Touchable
                    preset="icon"
                    style={styles.fieldCopyBtn}
                    onPress={() => copyToClipboard(user.license_number!, 'Licence')}
                  >
                    {copiedField === 'Licence' ? (
                      <Check size={13} color="#10b981" />
                    ) : (
                      <Copy size={13} color={theme.colors.mute} />
                    )}
                  </Touchable>
                ) : null}
              </View>
            </View>

            {/* Identity Documents (Staff View) */}
            {userDocuments.length > 0 && (
              <View style={{ marginVertical: 8, paddingVertical: 4 }}>
                <Text style={[styles.sectionEyebrow, { color: theme.colors.mute, marginBottom: 8 }]}>
                  IDENTITY DOCUMENTS
                </Text>
                {userDocuments.map((doc) => {
                  const label = doc.document_type_code === 'aadhaar' ? 'Aadhaar Card' : 'Driving Licence';
                  return (
                    <View key={doc.id} style={styles.documentItemRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <FileText size={15} color={theme.colors.link} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.docName, { color: theme.colors.ink }]}>{label}</Text>
                          <Text style={[styles.docMeta, { color: theme.colors.mute }]}>
                            {doc.mime_type?.split('/')[1]?.toUpperCase()} · {(doc.file_size_bytes / 1024).toFixed(0)} KB
                          </Text>
                        </View>
                      </View>
                      {doc.signed_url ? (
                        <Touchable
                          preset="button"
                          style={[
                            styles.viewDocBtn,
                            {
                              backgroundColor: theme.colors.link + '15',
                              borderColor: theme.colors.link + '40',
                            },
                          ]}
                          onPress={() =>
                            setViewerDoc({
                              id: doc.id,
                              title: label,
                              url: doc.signed_url,
                              mimeType: doc.mime_type || 'application/octet-stream',
                              fileSize: doc.file_size_bytes,
                              fileSizeBytes: doc.file_size_bytes,
                              updatedAt: doc.updated_at || doc.created_at,
                            })
                          }
                        >
                          <Text style={[styles.viewDocBtnText, { color: theme.colors.link }]}>View</Text>
                          <Eye size={12} color={theme.colors.link} />
                        </Touchable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Registered Date & Relative Time */}
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <View style={styles.detailLabelWrap}>
                <Calendar size={13} color={theme.colors.mute} />
                <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Registered Date</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.detailValue, { color: theme.colors.ink }]}>
                  {user.created_at ? formatDate(user.created_at) : '—'}
                </Text>
                {user.created_at ? (
                  <Text style={[styles.relativeTimeText, { color: theme.colors.mute }]}>
                    ({formatTimeAgo(user.created_at)})
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* MANAGEMENT ACTIONS Well */}
          <View style={styles.managementSection}>
            <Text variant="caption" style={[styles.managementSectionTitle, { color: theme.colors.mute }]}>
              MANAGEMENT ACTIONS
            </Text>

            {/* Change Role Selector (Super Admin) */}
            {isSuperAdmin && !isSelf && (
              <View style={{ marginBottom: spacingNumeric.xs }}>
                <SearchableSelect
                  label="User Permission Role"
                  options={ROLE_SELECT_OPTIONS}
                  value={user.role}
                  onChange={(newRole) => {
                    if (newRole && newRole !== user.role) {
                      handleUpdateRole(newRole);
                    }
                  }}
                  searchable={false}
                  disabled={isUpdating}
                />
              </View>
            )}

            {/* Assign Supervisor Selector */}
            {isSupervisedRole(user.role) && !isSelf && (
              <View style={{ marginBottom: spacingNumeric.xs }}>
                <SearchableSelect
                  label="Assign Supervisor"
                  options={supervisorSelectOptions}
                  value={user.supervisor_id || ''}
                  onChange={(newSupervisorId) => {
                    handleUpdateSupervisor(newSupervisorId || null);
                  }}
                  placeholder="Select supervisor..."
                  searchable={true}
                  disabled={isUpdating}
                />
              </View>
            )}

            {/* 2x2 Management Actions Grid */}
            <View style={styles.actionsGrid}>
              {/* 1. Edit Account Info */}
              <Touchable
                preset="button"
                style={[
                  styles.actionGridBtn,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
                onPress={() => {
                  onClose();
                  if (onEdit) onEdit(user);
                }}
              >
                <Edit2 size={15} color={theme.colors.link} />
                <Text variant="label" style={{ color: theme.colors.ink }}>
                  Edit Account Info
                </Text>
              </Touchable>

              {/* 2. Reset Password */}
              <Touchable
                preset="button"
                style={[
                  styles.actionGridBtn,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
                  },
                ]}
                onPress={() => {
                  onClose();
                  if (onResetPassword) onResetPassword(user);
                }}
              >
                <KeyRound size={15} color="#f59e0b" />
                <Text variant="label" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                  Reset Password
                </Text>
              </Touchable>

              {/* 3. Activate / Deactivate Account */}
              {!isSelf && !(currentUserRole === 'admin' && user.role === 'super_admin') && (
                <Touchable
                  preset="button"
                  style={[
                    styles.actionGridBtn,
                    user.status === 'active'
                      ? {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                          borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                        }
                      : {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                        },
                  ]}
                  onPress={handleToggleStatus}
                  disabled={isUpdating || isUpdatingStatus}
                >
                  {user.status === 'active' ? (
                    <>
                      <UserX size={15} color={theme.colors.error} />
                      <Text variant="label" style={{ color: theme.colors.error }}>
                        Deactivate Account
                      </Text>
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} color="#10b981" />
                      <Text variant="label" style={{ color: isDark ? '#34d399' : '#059669' }}>
                        Activate Account
                      </Text>
                    </>
                  )}
                </Touchable>
              )}

              {/* 4. Delete Account (Super Admin only) */}
              {isSuperAdmin && !isSelf && (
                <Touchable
                  preset="button"
                  style={[
                    styles.actionGridBtn,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.08)',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                    },
                  ]}
                  onPress={handleDeleteUserClick}
                  disabled={isUpdating}
                >
                  <Trash2 size={15} color={theme.colors.error} />
                  <Text variant="label" style={{ color: theme.colors.error }}>
                    Delete Account
                  </Text>
                </Touchable>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer Close Button */}
        <View style={[styles.footer, { backgroundColor: theme.colors.canvas, borderTopColor: theme.colors.hairline }]}>
          <Touchable
            preset="button"
            style={[
              styles.closeSheetBtn,
              { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
            ]}
            onPress={onClose}
          >
            <Text variant="label" style={{ color: theme.colors.ink }}>Close</Text>
          </Touchable>
        </View>
      </View>

      {/* In-App Mobile Document Viewer Modal */}
      <MobileDocumentViewerModal
        document={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />

      {/* Delete User Confirmation Dialog */}
      <DeleteUserConfirmDialog
        visible={showDeleteConfirm}
        user={user}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteErrorMessage(null);
        }}
        onConfirm={handleExecuteDelete}
        isDeleting={isDeleting}
        errorMessage={deleteErrorMessage}
      />

      {/* Activate / Deactivate Confirmation Dialog */}
      <ConfirmDialog
        visible={showStatusConfirm}
        onClose={() => {
          if (!isUpdatingStatus) setShowStatusConfirm(false);
        }}
        onConfirm={handleConfirmToggleStatus}
        title={user.status === 'active' ? 'Deactivate User Account' : 'Activate User Account'}
        message={
          user.status === 'active'
            ? `Are you sure you want to deactivate ${user.full_name}? The user will immediately lose access to the system and cannot log in. Any active machinery assignments will be ended to prevent scheduling conflicts, but all historical shift logs, attendance records, and data will remain preserved.`
            : `Are you sure you want to activate ${user.full_name}? The user will regain system login access, be able to operate machinery, and be eligible for shift assignments.`
        }
        confirmText={user.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
        cancelText="Cancel"
        variant={user.status === 'active' ? 'danger' : 'primary'}
        icon={
          user.status === 'active' ? (
            <UserX size={22} color={theme.colors.error} />
          ) : (
            <UserCheck size={22} color="#10b981" />
          )
        }
        isLoading={isUpdatingStatus}
      />
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderRadius: radiusNumeric.lg,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  notchContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  notch: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    flex: 1,
    marginRight: spacingNumeric.sm,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  userName: {
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipBadge: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  quickContactGrid: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  quickContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  quickContactBtnText: {
  },
  detailsWell: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: 10,
  },
  detailsWellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  detailsWellTitle: {
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
  },
  fieldCopyBtn: {
    padding: 2,
  },
  relativeTimeText: {
    marginTop: 1,
  },
  managementSection: {
    gap: spacingNumeric.sm,
    paddingTop: 2,
  },
  managementSectionTitle: {
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.xs,
  },
  actionGridBtn: {
    flexBasis: '48.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
  },
  actionGridBtnText: {
  },
  footer: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderTopWidth: 1,
  },
  closeSheetBtn: {
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSheetBtnText: {
  },
  sectionEyebrow: {
    marginBottom: spacingNumeric.xs,
  },
  documentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(150, 150, 150, 0.06)',
    marginBottom: 6,
  },
  docName: {
  },
  docMeta: {
    marginTop: 1,
  },
  viewDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    minHeight: 32,
  },
  viewDocBtnText: {
  },
  errorStateContainer: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flex: 1,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorStateTitle: {
    textAlign: 'center',
  },
  errorStateMessage: {
    textAlign: 'center',
    maxWidth: 280,
  },
  errorStateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radiusNumeric.md,
    marginTop: 8,
  },
  inlineErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  inlineErrorText: {
    flex: 1,
  },
});
