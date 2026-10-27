import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  Dimensions,
  ActivityIndicator,
  Image,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import { useTheme, MobileHeader , Text, useToast, ConfirmDialog } from '../../../components/ui';
import { Pressable } from '../../../components/ui/touch/Pressable';
import {
  toProfileView,
  type ProfileViewModel,
  type ProfileSection,
  type ProfileRow,
  formatDate,
} from '@reachinternational/utils';
import { supabase } from '../../../lib/supabase';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Briefcase,
  CreditCard,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  MapPin,
  Phone,
  User,
  Edit,
  ExternalLink,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Upload,
  AlertTriangle,
  XCircle,
  FileText,
  ImageIcon,
  Download,
} from '../../../components/ui/icon';
import {
  pickIdentityDocument,
  uploadUserDocumentDirect,
  deleteUserDocument,
  fetchUserDocuments,
  type UserDocumentInfo,
} from '../../../lib/documents';
import { EditProfileModal } from '../../../components/profile/EditProfileModal';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../../../components/documents/MobileDocumentViewerModal';
import { notifyProfileRequestCancelled } from '../../../lib/notifications';
import { haptics } from '../../../lib/haptics';
import { sanitizeDatabaseError } from '@reachinternational/utils';

// ─── Section Icon Mapping ───────────────────────────────────────────
const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  briefcase: Briefcase,
  'credit-card': CreditCard,
  building: Building2,
  shield: ShieldCheck,
  'map-pin': MapPin,
  phone: Phone,
  user: User,
};

// ─── Theme-Aware 100% Solid Opacity Role Badge Config ──────────────
function getRoleBadgeConfig(roleKey: string, isDark: boolean) {
  const r = (roleKey || 'operator').toLowerCase();
  switch (r) {
    case 'super_admin':
      return {
        label: 'Super Admin',
        bg: isDark ? '#450a0a' : '#fef2f2',
        text: isDark ? '#fca5a5' : '#b91c1c',
        border: isDark ? '#991b1b' : '#fecaca',
        icon: ShieldAlert,
      };
    case 'admin':
      return {
        label: 'Admin',
        bg: isDark ? '#422006' : '#fefce8',
        text: isDark ? '#fef08a' : '#a16207',
        border: isDark ? '#854d0e' : '#fde047',
        icon: ShieldCheck,
      };
    case 'manager':
      return {
        label: 'Manager',
        bg: isDark ? '#1e1b4b' : '#eef2ff',
        text: isDark ? '#c7d2fe' : '#4338ca',
        border: isDark ? '#4338ca' : '#c7d2fe',
        icon: Shield,
      };
    case 'supervisor':
      return {
        label: 'Supervisor',
        bg: isDark ? '#042f2e' : '#f0fdfa',
        text: isDark ? '#99f6e4' : '#0f766e',
        border: isDark ? '#0f766e' : '#99f6e4',
        icon: Shield,
      };
    case 'hr':
      return {
        label: 'HR',
        bg: isDark ? '#064e3b' : '#ecfdf5',
        text: isDark ? '#a7f3d0' : '#047857',
        border: isDark ? '#047857' : '#a7f3d0',
        icon: Shield,
      };
    case 'operator':
    default:
      return {
        label: (roleKey || 'Operator').replace('_', ' '),
        bg: isDark ? '#451a03' : '#fffbeb',
        text: isDark ? '#fde68a' : '#b45309',
        border: isDark ? '#78350f' : '#fde68a',
        icon: Shield,
      };
  }
}

// ─── Theme-Aware 100% Solid Opacity Status Badge Config ────────────
function getStatusBadgeConfig(status: string, isDark: boolean) {
  const s = (status || 'active').toLowerCase();
  switch (s) {
    case 'active':
    case 'completed':
    case 'verified':
    case '100% complete':
      return {
        label: (status || 'ACTIVE').toUpperCase(),
        bg: isDark ? '#064e3b' : '#ecfdf5',
        border: isDark ? '#047857' : '#a7f3d0',
        text: isDark ? '#a7f3d0' : '#065f46',
        dot: isDark ? '#34d399' : '#10b981',
      };
    case 'pending':
    case 'incomplete':
    case 'warning':
      return {
        label: (status || 'PENDING').toUpperCase(),
        bg: isDark ? '#451a03' : '#fffbeb',
        border: isDark ? '#78350f' : '#fde68a',
        text: isDark ? '#fde68a' : '#92400e',
        dot: isDark ? '#fbbf24' : '#f59e0b',
      };
    case 'inactive':
    default:
      return {
        label: (status || 'INACTIVE').toUpperCase(),
        bg: isDark ? '#27272a' : '#f4f4f5',
        border: isDark ? '#3f3f46' : '#d4d4d8',
        text: isDark ? '#d4d4d8' : '#3f3f46',
        dot: isDark ? '#a1a1aa' : '#71717a',
      };
  }
}

const DEFAULT_DOC_TYPES = [
  { code: 'aadhaar', label: 'Aadhaar Card' },
  { code: 'driving_license', label: 'Driving Licence' },
  { code: 'bank_document', label: 'Bank Passbook / Cheque' },
];

export interface ProfileScreenProps {
  onPressBack?: () => void;
  backRoute?: string;
}

// In-memory cache for static reference data to eliminate repeated queries across profile visits
let cachedDocumentTypes: { code: string; label: string }[] | null = null;

export default function ProfileScreen({ onPressBack, backRoute }: ProfileScreenProps = {}) {
  const { user, role, refreshSession, userProfile: authProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    if (onPressBack) {
      onPressBack();
      return;
    }
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
    if (backRoute) {
      router.replace(backRoute as any);
      return;
    }
    router.replace('/dashboard' as any);
  }, [onPressBack, backRoute, router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!backRoute && !onPressBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [backRoute, onPressBack, handleBack]);

  const { edit } = useLocalSearchParams<{ edit?: string }>();

  // Screen width for responsive 1-col mobile vs 2-col tablet/desktop
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return Dimensions.get('window').width;
  });

  useEffect(() => {
    if (edit === 'true' || edit === '1') {
      setEditModalVisible(true);
    }
  }, [edit]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleResize = () => setScreenWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    const sub = Dimensions.addEventListener('change', ({ window: w }) => {
      setScreenWidth(w.width);
    });
    return () => sub.remove();
  }, []);

  const isWide = screenWidth >= 640;

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [dbUser, setDbUser] = useState<any>(authProfile || null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isCancellingRequest, setIsCancellingRequest] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ doc: UserDocumentInfo; label: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [userDocuments, setUserDocuments] = useState<UserDocumentInfo[]>([]);
  const [documentTypes, setDocumentTypes] = useState<{ code: string; label: string }[]>(DEFAULT_DOC_TYPES);
  const [assignedMachines, setAssignedMachines] = useState<any[]>([]);

  // Document UI state
  const [replacingCode, setReplacingCode] = useState<string | null>(null);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);
  const [activeViewerDoc, setActiveViewerDoc] = useState<MobileViewerDoc | null>(null);
  const handleCloseViewer = useCallback(() => setActiveViewerDoc(null), []);

  // Fetch full user profile data
  const fetchProfileData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [userRes, reqRes, docRes, machineRes, docTypeRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, employee_id, full_name, phone, role, status, complete_profile, shift_start_time, shift_end_time, city, district, state, state_id, street, aadhaar_number, license_number, email, supervisor_id, monthly_salary, daily_rate, ot_hourly_rate, doj, created_at, updated_at, bank_account_number, bank_ifsc_code, total_pl_quota, pl_used_as_on_date, supervisor:users!supervisor_id(full_name)')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('profile_change_requests')
          .select('id, user_id, requester_role, current_data, requested_data, target_approver_role, status, created_at')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .maybeSingle(),
        fetchUserDocuments(user.id),
        supabase
          .from('machines')
          .select('id, machine_id, machine_name, model, status')
          .or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}},current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`)
          .order('machine_id'),
        cachedDocumentTypes
          ? Promise.resolve({ data: cachedDocumentTypes, error: null })
          : supabase
              .from('user_document_types')
              .select('code, label')
              .not('code', 'in', '("profile_photo","bank_passbook")')
              .order('code'),
      ]);

      if (userRes.data) {
        setDbUser({
          ...userRes.data,
          address: userRes.data.street || null,
        });
      }
      setPendingRequest(reqRes.data || null);
      setUserDocuments(docRes || []);
      setAssignedMachines(machineRes.data || []);
      if (docTypeRes.data && docTypeRes.data.length > 0) {
        cachedDocumentTypes = docTypeRes.data;
        setDocumentTypes(docTypeRes.data);
      }
    } catch (err) {
      console.warn('[ProfileScreen] Error fetching profile record:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfileData();
    if (refreshSession) refreshSession();
    setRefreshing(false);
  }, [fetchProfileData, refreshSession]);

  // Fully functional copy helper with Web + Native clipboard, haptics, toast, and checkmark feedback
  const handleCopy = useCallback(async (text: string, label: string) => {
    if (!text) return;
    try {
      haptics.select();
      let copied = false;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(text);
        copied = true;
      }
      if (copied) {
        haptics.confirm();
        setCopiedField(label);
        toast('success', 'Copied to Clipboard', `${label} copied.`);
        setTimeout(() => setCopiedField(null), 2000);
      }
    } catch {
      toast('error', 'Copy Failed', `Could not copy ${label.toLowerCase()} to clipboard.`);
    }
  }, [toast]);

  // Withdraw pending change request
  const handleCancelPendingRequest = () => {
    if (!pendingRequest?.id) return;
    haptics.warning();
    setShowWithdrawConfirm(true);
  };

  const handleConfirmWithdrawRequest = async () => {
    if (!pendingRequest?.id) return;
    const prevReq = pendingRequest;
    setPendingRequest(null);
    setIsCancellingRequest(true);
    try {
      const { error } = await supabase
        .from('profile_change_requests')
        .delete()
        .eq('id', prevReq.id);
      if (error) {
        setPendingRequest(prevReq);
        throw error;
      }
      haptics.confirm();
      notifyProfileRequestCancelled();
      toast('success', 'Request Withdrawn', 'Your profile change request has been cancelled.');
      setShowWithdrawConfirm(false);
      await fetchProfileData();
    } catch (err: any) {
      setPendingRequest(prevReq);
      haptics.reject();
      toast('error', 'Withdraw Failed', sanitizeDatabaseError(err, 'Failed to cancel the change request.').message);
    } finally {
      setIsCancellingRequest(false);
    }
  };

  // Document upload handler
  const handleUploadDocument = async (docTypeCode: string) => {
    if (!user?.id) return;
    try {
      haptics.select();
      const picked = await pickIdentityDocument();
      if (!picked) return;

      setUploadingCode(docTypeCode);
      const res = await uploadUserDocumentDirect({
        userId: user.id,
        documentTypeCode: docTypeCode,
        doc: picked,
      });

      if (!res.success) {
        haptics.reject();
        toast('error', 'Upload Failed', sanitizeDatabaseError(res.error, 'Failed to upload document.').message);
      } else {
        haptics.confirm();
        toast('success', 'Document Uploaded', 'Document attached successfully.');
        setReplacingCode(null);
        // Optimistically update document list immediately with newly signed URL
        if (res.path) {
          const optimisticDoc: UserDocumentInfo = {
            id: `temp_${Date.now()}`,
            user_id: user.id,
            document_type_code: docTypeCode,
            storage_path: res.path,
            mime_type: picked.mimeType,
            file_size_bytes: picked.size,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            signed_url: res.signedUrl || picked.uri,
          };
          setUserDocuments((prev) => [
            ...prev.filter((d) => d.document_type_code !== docTypeCode),
            optimisticDoc,
          ]);
        }
        // Background refresh to guarantee canonical database state
        void fetchUserDocuments(user.id).then((docs) => {
          if (docs && docs.length > 0) setUserDocuments(docs);
        }).catch(() => {});
      }
    } catch (err: any) {
      toast('error', 'Upload Error', sanitizeDatabaseError(err, 'Failed to select document.').message);
    } finally {
      setUploadingCode(null);
    }
  };

  // Document delete handler
  const handleDeleteDocument = (doc: UserDocumentInfo, label: string) => {
    if (!user?.id) return;
    haptics.warning();
    setDocToDelete({ doc, label });
  };

  const handleConfirmDeleteDocument = async () => {
    if (!user?.id || !docToDelete) return;
    const { doc, label } = docToDelete;
    setIsDeletingDoc(true);

    // Optimistically remove from UI immediately so user sees the slot reset to upload dropzone
    const previousDocs = userDocuments;
    setUserDocuments((prev) => prev.filter((d) => d.document_type_code !== doc.document_type_code));
    setReplacingCode((prev) => (prev === doc.document_type_code ? null : prev));

    try {
      const res = await deleteUserDocument(user.id, doc.document_type_code, doc.storage_path);
      if (!res.success) {
        // Roll back optimistic update if deletion failed
        setUserDocuments(previousDocs);
        haptics.reject();
        toast('error', 'Delete Failed', sanitizeDatabaseError(res.error, 'Could not delete document.').message);
      } else {
        haptics.confirm();
        toast('success', 'Document Removed', `${label} removed successfully.`);
        setDocToDelete(null);
        // Background refresh to guarantee canonical database state without blocking UI
        void fetchUserDocuments(user.id).then(setUserDocuments).catch(() => {});
      }
    } catch (err: any) {
      setUserDocuments(previousDocs);
      haptics.reject();
      toast('error', 'Delete Error', sanitizeDatabaseError(err, 'Failed to remove document.').message);
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Build authoritative profile view model
  const mergedUserData = useMemo(() => {
    const raw = dbUser || authProfile || {};
    return {
      ...raw,
      assigned_machines: assignedMachines,
    };
  }, [dbUser, authProfile, assignedMachines]);

  const view: ProfileViewModel = useMemo(() => {
    return toProfileView(mergedUserData);
  }, [mergedUserData]);

  // Role & status metadata with 100% solid opacity
  const userRoleKey = mergedUserData.role || role || 'operator';
  const roleBadge = useMemo(() => getRoleBadgeConfig(userRoleKey, isDark), [userRoleKey, isDark]);
  const RoleIcon = roleBadge.icon;
  const statusBadge = useMemo(() => getStatusBadgeConfig(view.status || 'ACTIVE', isDark), [view.status, isDark]);

  // Clean raw aadhaar for eye toggle
  const rawAadhaar = mergedUserData.aadhaar_number;
  const cleanAadhaar = rawAadhaar ? String(rawAadhaar).replace(/[\s\-]/g, '') : '';
  const formattedFullAadhaar = cleanAadhaar
    ? cleanAadhaar.length >= 12
      ? `${cleanAadhaar.slice(0, 4)} ${cleanAadhaar.slice(4, 8)} ${cleanAadhaar.slice(8, 12)}`
      : cleanAadhaar
    : 'Not Provided';
  const maskedAadhaar = cleanAadhaar
    ? cleanAadhaar.length >= 12
      ? `XXXX-XXXX-${cleanAadhaar.slice(-4)}`
      : cleanAadhaar
    : 'Not Provided';

  // Open document smoothly with fresh signed URL fallback
  const handleOpenDocument = useCallback(async (doc: UserDocumentInfo, label: string) => {
    try {
      haptics.select();
      let url = doc.signed_url;
      if (!url && doc.storage_path) {
        const { data: signedData } = await supabase.storage
          .from('user_files')
          .createSignedUrl(doc.storage_path, 3600);
        url = signedData?.signedUrl || null;
      }
      if (!url) {
        toast('warning', 'File Unavailable', `The file for ${label} could not be found in storage. Please upload or replace it.`);
        return;
      }
      setActiveViewerDoc({
        title: label,
        url: url,
        uri: url,
        mimeType: doc.mime_type,
        fileSizeBytes: doc.file_size_bytes,
        fileName: doc.storage_path.split('/').pop(),
      });
    } catch (err: any) {
      toast('error', 'Open Failed', sanitizeDatabaseError(err, 'Could not open document.').message);
    }
  }, [toast]);

  // Export / Download profile summary as text file
  const handleDownloadProfile = useCallback(async () => {
    try {
      haptics.select();
      const profileText = [
        `REACH INTERNATIONAL - EMPLOYEE PROFILE`,
        `=======================================`,
        `Name: ${view.name || 'N/A'}`,
        `Employee ID: ${mergedUserData?.employee_id || 'N/A'}`,
        `Email: ${view.email || 'N/A'}`,
        `Role: ${(mergedUserData?.role || role || 'Operator').toUpperCase()}`,
        `Status: ${(view.status || 'ACTIVE').toUpperCase()}`,
        `Phone: ${mergedUserData?.phone || 'N/A'}`,
        `Shift: ${view.shiftTimingDisplay || 'N/A'}`,
        `Supervisor: ${mergedUserData?.supervisor?.full_name || 'N/A'}`,
        `Aadhaar: ${cleanAadhaar ? (showFullAadhaar ? formattedFullAadhaar : maskedAadhaar) : 'Not Provided'}`,
        `Driving Licence: ${mergedUserData?.license_number || 'Not Provided'}`,
        `Bank Account: ${mergedUserData?.bank_account_number || 'Not Configured'}`,
        `Bank IFSC: ${mergedUserData?.bank_ifsc_code || 'Not Configured'}`,
        `Monthly Base Salary: ${mergedUserData?.monthly_salary ? `₹${Number(mergedUserData.monthly_salary).toLocaleString('en-IN')}` : 'N/A'}`,
        `Exported At: ${new Date().toLocaleString('en-IN')}`,
      ].join('\n');

      if (Platform.OS === 'web') {
        const blob = new Blob([profileText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Profile_${(view.name || 'User').replace(/\s+/g, '_')}_${mergedUserData?.employee_id || 'Summary'}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast('success', 'Profile Downloaded', 'Profile summary saved to downloads.');
      } else {
        if (FileSystem.cacheDirectory) {
          const fileUri = `${FileSystem.cacheDirectory}profile_summary.txt`;
          await FileSystem.writeAsStringAsync(fileUri, profileText);
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri);
          } else {
            toast('success', 'Profile Exported', 'Profile summary generated.');
          }
        }
      }
    } catch (err: any) {
      toast('error', 'Download Failed', sanitizeDatabaseError(err, 'Failed to download profile summary.').message);
    }
  }, [view, mergedUserData, role, cleanAadhaar, showFullAadhaar, formattedFullAadhaar, maskedAadhaar, toast]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header: Back arrow + Profile Title + Download Icon in Header + Search Quick Access Icon */}
      <MobileHeader
        title="Profile"
        showBack={true}
        backRoute={backRoute}
        onPressBack={handleBack}
        showQuickAccess={true}
        rightAction={
          <Pressable
            variant="iconButton"
            hitSlopToMin48
            style={[
              styles.headerDownloadBtn,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
            onPress={handleDownloadProfile}
            accessibilityLabel="Download profile summary"
          >
            <Download size={17} color={theme.colors.ink} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            backgroundColor: theme.colors.canvas,
            paddingBottom: Math.max(insets.bottom, 16) + 100,
          },
        ]}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.link} />
        }
      >
        <View style={styles.containerInner}>
          {/* ─── Profile Header Card ─── */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <View style={styles.headerCardContent}>
              <View style={styles.userInfoRow}>
                {/* 56x56 Initial Letter Avatar */}
                <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                  <Text variant="title" weight="bold" style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                    {view.name ? view.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>

                {/* Name, EMP ID, Email, Role & Status Pills */}
                <View style={styles.userDetails}>
                  <View style={styles.userNameRow}>
                    <Text variant="title" weight="bold" style={[styles.userName, { color: theme.colors.ink }]} numberOfLines={1}>
                      {view.name}
                    </Text>
                    {Boolean(mergedUserData?.employee_id) && (
                      <Pressable
                        variant="ghost"
                        hitSlopToMin48
                        style={[
                          styles.empBadge,
                          {
                            backgroundColor: isDark ? '#262626' : '#f4f4f5',
                            borderColor: isDark ? '#383838' : '#e4e4e7',
                          },
                        ]}
                        onPress={() => handleCopy(mergedUserData.employee_id, 'Employee ID')}
                        accessibilityLabel={`Copy Employee ID ${mergedUserData.employee_id}`}
                      >
                        <Text variant="micro" weight="semibold" style={{ color: theme.colors.ink }}>
                          {mergedUserData.employee_id}
                        </Text>
                        {copiedField === 'Employee ID' ? (
                          <Check size={11} color="#10b981" />
                        ) : (
                          <Copy size={11} color={theme.colors.mute} />
                        )}
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.userEmailRow}>
                    <Text
                      variant="caption"
                      style={[styles.userEmail, { color: theme.colors.mute }]}
                      numberOfLines={1}
                      selectable
                    >
                      {view.email}
                    </Text>
                    {Boolean(view.email) && (
                      <Pressable
                        variant="iconButton"
                        hitSlopToMin48
                        style={styles.headerCopyBtn}
                        onPress={() => handleCopy(view.email, 'Email')}
                        accessibilityLabel="Copy Email"
                      >
                        {copiedField === 'Email' ? (
                          <Check size={12} color="#10b981" />
                        ) : (
                          <Copy size={12} color={theme.colors.mute} />
                        )}
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.badgesRow}>
                    {/* Role Badge (100% Solid Opacity) */}
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: roleBadge.bg,
                          borderColor: roleBadge.border,
                        },
                      ]}
                    >
                      <RoleIcon size={12} color={roleBadge.text} />
                      <Text variant="micro" weight="semibold" style={[styles.roleBadgeText, { color: roleBadge.text }]}>
                        {roleBadge.label}
                      </Text>
                    </View>

                    {/* Status Badge (100% Solid Opacity) */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusBadge.bg,
                          borderColor: statusBadge.border,
                        },
                      ]}
                    >
                      <View style={[styles.activeDot, { backgroundColor: statusBadge.dot }]} />
                      <Text variant="micro" weight="semibold" style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                        {statusBadge.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Edit Profile Button (100% Solid Opacity) */}
              <Pressable
                variant="buttonSecondary"
                hitSlopToMin48
                style={[
                  styles.editProfileBtn,
                  {
                    borderColor: isDark ? '#383838' : '#e4e4e7',
                    backgroundColor: isDark ? '#262626' : '#ffffff',
                  },
                ]}
                onPress={() => router.push('/profile/edit' as any)}
                accessibilityLabel="Edit Profile"
              >
                <Edit size={14} color={isDark ? '#0ea5e9' : '#0284c7'} />
                <Text variant="label" weight="semibold" style={[styles.editProfileBtnText, { color: isDark ? '#fafafa' : '#171717' }]}>
                  Edit Profile
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ─── Pending Request Review Banner (if any) ─── */}
          {pendingRequest && (
            <View
              style={[
                styles.pendingBanner,
                {
                  backgroundColor: isDark ? '#291804' : '#fffbeb',
                  borderColor: isDark ? '#78350f' : '#fde68a',
                },
              ]}
            >
              <View style={styles.pendingHeader}>
                <View style={styles.pendingTitleGroup}>
                  <AlertTriangle size={15} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text variant="label" weight="semibold" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                    Pending Profile Review
                  </Text>
                </View>
                <View
                  style={[
                    styles.pendingPill,
                    {
                      backgroundColor: isDark ? '#451a03' : '#fef3c7',
                      borderColor: isDark ? '#92400e' : '#fcd34d',
                    },
                  ]}
                >
                  <Text variant="micro" weight="bold" style={{ color: isDark ? '#fde68a' : '#92400e' }}>
                    PENDING
                  </Text>
                </View>
              </View>
              <Text variant="caption" style={[styles.pendingDesc, { color: theme.colors.mute }]}>
                A profile change request submitted on{' '}
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {formatDate(pendingRequest.created_at)}
                </Text>{' '}
                is currently under review by{' '}
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                  {pendingRequest.target_approver_role === 'super_admin'
                    ? 'Super Administrator'
                    : 'Administrator / Manager'}
                </Text>
                . New edits will overwrite this pending submission.
              </Text>
              <Pressable
                variant="buttonGhost"
                hitSlopToMin48
                style={[
                  styles.cancelRequestBtn,
                  {
                    backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                    borderColor: isDark ? '#991b1b' : '#fecaca',
                  },
                ]}
                onPress={handleCancelPendingRequest}
                disabled={isCancellingRequest}
                accessibilityLabel="Withdraw Request"
              >
                <XCircle size={13} color={isDark ? '#fca5a5' : '#dc2626'} />
                <Text variant="caption" weight="medium" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                  {isCancellingRequest ? 'Cancelling...' : 'Withdraw Request'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ─── Detail Sections Responsive Grid (1 col on mobile, 2 col on tablet/desktop) ─── */}
          <View style={[styles.sectionsGrid, isWide && styles.sectionsGridWide]}>
            {view.sections.map((section: ProfileSection) => {
              const SectionIcon = SECTION_ICONS[section.iconName] || User;

              return (
                <View
                  key={section.title}
                  style={[
                    styles.sectionCard,
                    isWide && styles.sectionCardHalf,
                    {
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                >
                  {/* Section Header: Sky blue icon + Uppercase tracking-wider title */}
                  <View style={[styles.sectionHeader, { borderColor: theme.colors.hairline }]}>
                    <SectionIcon size={15} color="#0284c7" />
                    <Text
                      variant="micro"
                      weight="bold"
                      style={[styles.sectionTitle, { color: theme.colors.mute }]}
                    >
                      {section.title}
                    </Text>
                  </View>

                  {/* Section Rows with Hairline Separators */}
                  <View style={styles.sectionBody}>
                    {section.rows.map((row: ProfileRow, rIdx: number) => {
                      const isAadhaar = row.label === 'Aadhaar';
                      const isLast = rIdx === section.rows.length - 1;
                      const badgeStatus = row.badge ? getStatusBadgeConfig(row.badge.label, isDark) : null;

                      return (
                        <View key={row.label} style={styles.rowWrap}>
                          <View style={styles.rowContent}>
                            {/* Label */}
                            <Text
                              variant="caption"
                              weight="medium"
                              style={[
                                styles.rowLabel,
                                { color: theme.colors.mute },
                              ]}
                            >
                              {row.label}
                            </Text>

                            {/* Value / Badges / Actions */}
                            <View style={styles.rowValueArea}>
                              {isAadhaar ? (
                                <View style={styles.aadhaarArea}>
                                  <Text
                                    variant={row.isMonospace ? 'mono' : 'caption'}
                                    weight="semibold"
                                    style={[
                                      styles.rowValue,
                                      { color: theme.colors.ink },
                                    ]}
                                    selectable
                                  >
                                    {showFullAadhaar ? formattedFullAadhaar : maskedAadhaar}
                                  </Text>
                                  {Boolean(cleanAadhaar) && (
                                    <View style={styles.inlineActions}>
                                      <Pressable
                                        variant="iconButton"
                                        hitSlopToMin48
                                        style={styles.iconActionBtn}
                                        onPress={() => setShowFullAadhaar((prev) => !prev)}
                                        accessibilityLabel={
                                          showFullAadhaar ? 'Hide Aadhaar number' : 'Reveal Aadhaar number'
                                        }
                                      >
                                        {showFullAadhaar ? (
                                          <EyeOff size={14} color={theme.colors.mute} />
                                        ) : (
                                          <Eye size={14} color={theme.colors.mute} />
                                        )}
                                      </Pressable>
                                      <Pressable
                                        variant="iconButton"
                                        hitSlopToMin48
                                        style={styles.iconActionBtn}
                                        onPress={() => handleCopy(cleanAadhaar, 'Aadhaar')}
                                        accessibilityLabel="Copy Aadhaar"
                                      >
                                        {copiedField === 'Aadhaar' ? (
                                          <Check size={14} color="#10b981" />
                                        ) : (
                                          <Copy size={14} color={theme.colors.mute} />
                                        )}
                                      </Pressable>
                                    </View>
                                  )}
                                </View>
                              ) : row.href ? (
                                <Pressable
                                  variant="buttonGhost"
                                  hitSlopToMin48
                                  style={styles.linkArea}
                                  onPress={() => router.push(row.href as any)}
                                >
                                  <Text variant="caption" weight="semibold" style={[styles.rowLink, { color: '#0284c7' }]}>
                                    {row.value}
                                  </Text>
                                  <ExternalLink size={12} color="#0284c7" />
                                </Pressable>
                              ) : row.badge && badgeStatus ? (
                                <View style={styles.badgeArea}>
                                  <View
                                    style={[
                                      styles.statusPill,
                                      {
                                        backgroundColor: badgeStatus.bg,
                                        borderColor: badgeStatus.border,
                                      },
                                    ]}
                                  >
                                    <View style={[styles.activeDot, { backgroundColor: badgeStatus.dot }]} />
                                    <Text
                                      variant="micro"
                                      weight="semibold"
                                      style={[
                                        styles.statusPillText,
                                        { color: badgeStatus.text },
                                      ]}
                                    >
                                      {badgeStatus.label}
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={styles.valueWithCopyArea}>
                                  <Text
                                    variant={row.isMonospace ? 'mono' : 'caption'}
                                    weight="semibold"
                                    style={[
                                      styles.rowValue,
                                      { color: theme.colors.ink },
                                    ]}
                                    selectable
                                  >
                                    {row.value}
                                  </Text>
                                  {row.copyable && row.copyValue && (
                                    <Pressable
                                      variant="iconButton"
                                      hitSlopToMin48
                                      style={styles.iconActionBtn}
                                      onPress={() => handleCopy(row.copyValue!, row.label)}
                                      accessibilityLabel={`Copy ${row.label}`}
                                    >
                                      {copiedField === row.label ? (
                                        <Check size={14} color="#10b981" />
                                      ) : (
                                        <Copy size={14} color={theme.colors.mute} />
                                      )}
                                    </Pressable>
                                  )}
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Hairline Divider Between Rows */}
                          {!isLast && (
                            <View
                              style={[
                                styles.rowDivider,
                                { backgroundColor: theme.colors.hairline },
                              ]}
                            />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          {/* ─── Identity & Banking Documents Section ─── */}
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {/* Header: Title */}
            <View style={styles.docSectionHeader}>
              <Text
                variant="micro"
                weight="bold"
                style={[styles.sectionTitle, { color: theme.colors.mute }]}
              >
                IDENTITY & BANKING DOCUMENTS
              </Text>
            </View>

            {/* Document Slots Responsive Grid */}
            <View style={[styles.docGrid, isWide && styles.docGridWide]}>
              {documentTypes.map((docType) => {
                const existing = userDocuments.find(
                  (d) => d.document_type_code === docType.code
                );
                const isReplacing = replacingCode === docType.code;
                const isUploading = uploadingCode === docType.code;

                // Format badge icon helper
                const mime = (existing?.mime_type || '').toLowerCase();
                const path = (existing?.storage_path || '').toLowerCase();
                const isPdf = mime.includes('pdf') || path.endsWith('.pdf');
                const isPng = mime.includes('png') || path.endsWith('.png');
                const isJpg = mime.includes('jpg') || mime.includes('jpeg') || path.endsWith('.jpg') || path.endsWith('.jpeg');
                const isWebp = mime.includes('webp') || path.endsWith('.webp');
                const isImage = isPng || isJpg || isWebp || mime.startsWith('image/');

                return (
                  <View
                    key={docType.code}
                    style={[
                      styles.docSlotCard,
                      isWide && styles.docSlotCardHalf,
                      {
                        backgroundColor: theme.colors.canvas,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    {/* Slot Header Row */}
                    <View style={styles.docSlotHeaderRow}>
                      <Text variant="label" weight="semibold" style={[styles.docSlotTitle, { color: theme.colors.ink }]}>
                        {docType.label}
                      </Text>
                      {existing && !isReplacing && (
                        <View
                          style={[
                            styles.uploadedBadgeSmall,
                            {
                              backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
                              borderColor: isDark ? '#047857' : '#a7f3d0',
                            },
                          ]}
                        >
                          <Text
                            variant="micro"
                            weight="semibold"
                            style={{ color: isDark ? '#a7f3d0' : '#065f46' }}
                          >
                            Uploaded
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 1. Existing Document View (Click to preview, Replace, Delete) */}
                    {existing && !isReplacing ? (
                      <View
                        style={[
                          styles.existingDocCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        {/* Left: Thumbnail/Icon + Details (Clickable Preview) */}
                        <Pressable
                          variant="ghost"
                          style={styles.existingDocLeft}
                          onPress={() => handleOpenDocument(existing, docType.label)}
                          accessibilityLabel={`Preview ${docType.label}`}
                        >
                          {isImage && existing.signed_url ? (
                            <Image
                              source={{ uri: existing.signed_url }}
                              style={styles.docThumbImage}
                              resizeMode="cover"
                              fadeDuration={0}
                            />
                          ) : isPdf ? (
                            <View
                              style={[
                                styles.formatBadgeSquare,
                                {
                                  backgroundColor: isDark ? '#262626' : '#f4f4f5',
                                  borderColor: theme.colors.hairline,
                                },
                              ]}
                            >
                              <FileText size={18} color="#e11d48" />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.formatBadgeSquare,
                                {
                                  backgroundColor: isDark ? '#262626' : '#f4f4f5',
                                  borderColor: theme.colors.hairline,
                                },
                              ]}
                            >
                              <FileText size={18} color={theme.colors.mute} />
                            </View>
                          )}

                          <View style={styles.existingDocDetails}>
                            <Text
                              variant="caption"
                              weight="semibold"
                              style={[styles.existingDocFileName, { color: theme.colors.ink }]}
                              numberOfLines={1}
                            >
                              {existing.storage_path.split('/').pop() || docType.label}
                            </Text>
                            <Text
                              variant="micro"
                              style={[styles.existingDocMeta, { color: theme.colors.mute }]}
                              numberOfLines={1}
                            >
                              {isPdf ? 'PDF' : isImage ? (path.split('.').pop()?.toUpperCase() || 'IMAGE') : 'DOC'}
                              {existing.file_size_bytes ? ` • ${(Number(existing.file_size_bytes) / 1024).toFixed(0)} KB` : ''}
                            </Text>
                          </View>
                        </Pressable>

                        {/* Right: Replace + Delete Actions (100% Solid Opacity) */}
                        <View style={styles.existingDocRight}>
                          <Pressable
                            variant="buttonSecondary"
                            hitSlopToMin48
                            style={[
                              styles.docActionBtn,
                              {
                                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                                borderColor: isDark ? '#383838' : '#e4e4e7',
                              },
                            ]}
                            onPress={() => setReplacingCode(docType.code)}
                            accessibilityLabel={`Replace ${docType.label}`}
                          >
                            <RefreshCw size={12} color={theme.colors.mute} />
                            <Text
                              variant="micro"
                              weight="medium"
                              style={[styles.docActionBtnText, { color: isDark ? '#fafafa' : '#171717' }]}
                            >
                              Replace
                            </Text>
                          </Pressable>

                          <Pressable
                            variant="iconButton"
                            hitSlopToMin48
                            style={[
                              styles.docDeleteBtn,
                              {
                                backgroundColor: isDark ? '#450a0a' : '#fef2f2',
                                borderColor: isDark ? '#991b1b' : '#fecaca',
                              },
                            ]}
                            onPress={() => handleDeleteDocument(existing, docType.label)}
                            accessibilityLabel={`Delete ${docType.label}`}
                          >
                            <Trash2 size={13} color={isDark ? '#fca5a5' : '#dc2626'} />
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      /* 2. Upload Dropzone (When not uploaded or replacing) */
                      <View style={styles.dropzoneWrap}>
                        <Pressable
                          variant="card"
                          style={[
                            styles.dropzone,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                          onPress={() => handleUploadDocument(docType.code)}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <View style={styles.uploadingBox}>
                              <ActivityIndicator size="small" color={theme.colors.link} />
                              <Text variant="caption" style={[styles.dropzoneHint, { color: theme.colors.mute }]}>
                                Uploading document...
                              </Text>
                            </View>
                          ) : (
                            <>
                              <View style={styles.dropzoneRow}>
                                <Upload size={14} color={theme.colors.mute} />
                                <Text
                                  variant="caption"
                                  weight="medium"
                                  style={[styles.dropzoneTitle, { color: theme.colors.mute }]}
                                >
                                  {isReplacing ? 'Select replacement file' : 'Choose file to upload'}
                                </Text>
                              </View>
                              <Text variant="micro" style={[styles.dropzoneHint, { color: theme.colors.mute }]}>
                                PDF, PNG, JPG, WEBP, or DOC
                              </Text>
                            </>
                          )}
                        </Pressable>

                        {/* Cancel replacement option */}
                        {isReplacing && (
                          <Pressable
                            variant="buttonGhost"
                            hitSlopToMin48
                            style={styles.cancelReplaceBtn}
                            onPress={() => setReplacingCode(null)}
                            accessibilityLabel="Cancel replacement"
                          >
                            <Text variant="micro" style={[styles.cancelReplaceText, { color: theme.colors.mute }]}>
                              Cancel
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile & Shift Times Modal */}
      <EditProfileModal
        visible={editModalVisible}
        currentUser={dbUser || authProfile}
        onClose={() => setEditModalVisible(false)}
        onSuccess={(submittedReq?: any) => {
          if (submittedReq) {
            setPendingRequest({
              id: `tmp_req_${Date.now()}`,
              status: 'pending',
              created_at: new Date().toISOString(),
              target_approver_role: submittedReq.target_approver_role,
              requested_data: submittedReq.requested_data,
            });
          }
          fetchProfileData();
          if (refreshSession) refreshSession();
        }}
      />

      {/* In-App Document Viewer Modal */}
      <MobileDocumentViewerModal
        document={activeViewerDoc}
        onClose={handleCloseViewer}
      />

      <ConfirmDialog
        visible={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        onConfirm={handleConfirmDeleteDocument}
        title={`Remove ${docToDelete?.label || 'Document'}?`}
        message="Are you sure you want to remove this document? This action cannot be undone."
        confirmText="Remove Document"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingDoc}
      />

      <ConfirmDialog
        visible={showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(false)}
        onConfirm={handleConfirmWithdrawRequest}
        title="Withdraw Profile Change Request"
        message="Are you sure you want to withdraw this change request? It will be permanently removed."
        confirmText="Withdraw Request"
        cancelText="Keep Request"
        variant="danger"
        isLoading={isCancellingRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  containerInner: {
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    gap: 20,
  },

  // ─── Profile Header Card ──────────────────────────────────────────
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerCardContent: {
    gap: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLetter: {},
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userName: {
    flexShrink: 1,
  },
  empBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  empBadgeText: {},
  userEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  userEmail: {
    flexShrink: 1,
  },
  headerCopyBtn: {
    padding: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
    minWidth: 24,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: {
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {},
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
  },
  editProfileBtnText: {},

  // ─── Pending Request Review Banner ────────────────────────────────
  pendingBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingTitle: {},
  pendingPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pendingPillText: {},
  pendingDesc: {},
  cancelRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
    minHeight: 32,
  },
  cancelRequestText: {},

  // ─── Responsive Sections Grid ─────────────────────────────────────
  sectionsGrid: {
    gap: 20,
  },
  sectionsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 20,
        } as any)
      : {}),
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionCardHalf: {
    ...(Platform.OS !== 'web' ? { width: '48.5%' } : {}),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  sectionBody: {
    width: '100%',
  },
  headerDownloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowWrap: {
    width: '100%',
  },
  rowContent: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 38,
  },
  rowLabel: {
    flexShrink: 0,
    maxWidth: '46%',
  },
  rowValueArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  monoText: {},
  rowDivider: {
    height: 1,
    width: '100%',
  },

  // Aadhaar, Link, Badge & Copy row elements
  aadhaarArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 28,
  },
  linkArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowLink: {
    textDecorationLine: 'underline',
  },
  badgeArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    textTransform: 'uppercase',
  },
  valueWithCopyArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
  },

  // ─── Identity & Banking Documents Section ─────────────────────────
  docSectionHeader: {
    marginBottom: 14,
    gap: 3,
  },
  docSectionSubtitle: {},
  docGrid: {
    gap: 12,
  },
  docGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 14,
        } as any)
      : {}),
  },
  docSlotCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  docSlotCardHalf: {
    ...(Platform.OS !== 'web' ? { width: '48.5%' } : {}),
  },
  docSlotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docSlotTitle: {},
  uploadedBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  uploadedBadgeSmallText: {},
  docThumbImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  formatBadgeSquare: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  formatBadgeSquareText: {},
  existingDocDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  existingDocFileName: {},
  existingDocMeta: {},
  existingDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 52,
  },
  existingDocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  existingDocRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  docActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
  },
  docActionBtnText: {},
  docDeleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  dropzoneWrap: {
    gap: 6,
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 64,
  },
  dropzoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropzoneTitle: {},
  dropzoneHint: {},
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelReplaceBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  cancelReplaceText: {
    textDecorationLine: 'underline',
  },
});
