import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { useTheme, MobileHeader } from '../../components/ui';
import {
  toProfileView,
  type ProfileViewModel,
  type ProfileSection,
  type ProfileRow,
  formatDate,
} from '@reachinternational/utils';
import { supabase } from '../../lib/supabase';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
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
  Image as ImageIcon,
} from 'lucide-react-native';
import {
  pickIdentityDocument,
  uploadUserDocumentDirect,
  deleteUserDocument,
  fetchUserDocuments,
  type UserDocumentInfo,
} from '../../lib/documents';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import {
  MobileDocumentViewerModal,
  type MobileViewerDoc,
} from '../../components/documents/MobileDocumentViewerModal';
import { notifyProfileRequestCancelled } from '../../lib/notifications';

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

// ─── Role Configuration (Matches Web Geist Color Scheme) ───────────
const ROLE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  super_admin: {
    label: 'Super Admin',
    bg: 'rgba(239, 68, 68, 0.1)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.25)',
    icon: ShieldAlert,
  },
  admin: {
    label: 'Admin',
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#d97706',
    border: 'rgba(245, 158, 11, 0.25)',
    icon: ShieldCheck,
  },
  manager: {
    label: 'Manager',
    bg: 'rgba(99, 102, 241, 0.1)',
    text: '#6366f1',
    border: 'rgba(99, 102, 241, 0.25)',
    icon: Shield,
  },
  supervisor: {
    label: 'Supervisor',
    bg: 'rgba(20, 184, 166, 0.1)',
    text: '#0d9488',
    border: 'rgba(20, 184, 166, 0.25)',
    icon: Shield,
  },
  hr: {
    label: 'HR',
    bg: 'rgba(236, 72, 153, 0.1)',
    text: '#db2777',
    border: 'rgba(236, 72, 153, 0.25)',
    icon: Shield,
  },
  operator: {
    label: 'Operator',
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#059669',
    border: 'rgba(16, 185, 129, 0.25)',
    icon: Shield,
  },
};

const DEFAULT_DOC_TYPES = [
  { code: 'aadhaar', label: 'Aadhaar Card' },
  { code: 'driving_license', label: 'Driving Licence' },
  { code: 'bank_document', label: 'Bank Passbook / Cheque' },
];

export default function ProfileScreen() {
  const { user, role, refreshSession, userProfile: authProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();

  // Screen width for responsive 1-col mobile vs 2-col tablet/desktop
  const [screenWidth, setScreenWidth] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return Dimensions.get('window').width;
  });

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
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [userDocuments, setUserDocuments] = useState<UserDocumentInfo[]>([]);
  const [documentTypes, setDocumentTypes] = useState<{ code: string; label: string }[]>(DEFAULT_DOC_TYPES);
  const [assignedMachines, setAssignedMachines] = useState<any[]>([]);

  // Document UI state
  const [replacingCode, setReplacingCode] = useState<string | null>(null);
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);
  const [activeViewerDoc, setActiveViewerDoc] = useState<MobileViewerDoc | null>(null);

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
        supabase
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

  // Copy helper with 2-second checkmark feedback
  const handleCopy = async (text: string, label: string) => {
    try {
      Haptics.selectionAsync().catch(() => {});
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(text);
      }
    } catch {
      // Fallback
    }
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Withdraw pending change request
  const handleCancelPendingRequest = () => {
    if (!pendingRequest?.id) return;
    const executeWithdraw = async () => {
      setIsCancellingRequest(true);
      try {
        const { error } = await supabase
          .from('profile_change_requests')
          .delete()
          .eq('id', pendingRequest.id);
        if (error) throw error;
        notifyProfileRequestCancelled();
        Alert.alert('Request Withdrawn', 'Your profile change request has been cancelled.');
        await fetchProfileData();
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to cancel the change request.');
      } finally {
        setIsCancellingRequest(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Withdraw Profile Change Request?\n\nThis will remove your pending submission.')) {
        executeWithdraw();
      }
    } else {
      Alert.alert(
        'Withdraw Profile Change Request',
        'Are you sure you want to withdraw this change request? It will be permanently removed.',
        [
          { text: 'Keep Request', style: 'cancel' },
          { text: 'Withdraw', style: 'destructive', onPress: executeWithdraw },
        ]
      );
    }
  };

  // Document upload handler
  const handleUploadDocument = async (docTypeCode: string) => {
    if (!user?.id) return;
    try {
      Haptics.selectionAsync().catch(() => {});
      const picked = await pickIdentityDocument();
      if (!picked) return;

      setUploadingCode(docTypeCode);
      const res = await uploadUserDocumentDirect({
        userId: user.id,
        documentTypeCode: docTypeCode,
        doc: picked,
      });

      if (!res.success) {
        Alert.alert('Upload Failed', res.error || 'Failed to upload document.');
      } else {
        setReplacingCode(null);
        await fetchProfileData();
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to select document.');
    } finally {
      setUploadingCode(null);
    }
  };

  // Document delete handler
  const handleDeleteDocument = (doc: UserDocumentInfo, label: string) => {
    if (!user?.id) return;
    const executeDelete = async () => {
      try {
        const res = await deleteUserDocument(user.id, doc.document_type_code, doc.storage_path);
        if (!res.success) {
          Alert.alert('Delete Failed', res.error || 'Could not delete document.');
        } else {
          await fetchProfileData();
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to remove document.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${label}?\n\nAre you sure you want to remove this document?`)) {
        executeDelete();
      }
    } else {
      Alert.alert(
        `Delete ${label}`,
        'Are you sure you want to remove this document?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: executeDelete },
        ]
      );
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

  // Role metadata
  const userRoleKey = mergedUserData.role || role || 'operator';
  const roleMeta = ROLE_CONFIG[userRoleKey] || {
    label: (userRoleKey || 'Operator').replace('_', ' '),
    bg: 'rgba(150, 150, 150, 0.1)',
    text: theme.colors.mute,
    border: 'rgba(150, 150, 150, 0.2)',
    icon: User,
  };
  const RoleIcon = roleMeta.icon;

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Header: Back arrow + Profile Title + Search Quick Access Icon */}
      <MobileHeader
        title="Profile"
        showBack={true}
        showLogo={false}
        showMoreMenu={false}
        showQuickAccess={true}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.canvas }]}
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
                  <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                    {view.name ? view.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>

                {/* Name, EMP ID, Email, Role & Status Pills */}
                <View style={styles.userDetails}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: theme.colors.ink }]} numberOfLines={1}>
                      {view.name}
                    </Text>
                    {Boolean(mergedUserData?.employee_id) && (
                      <View
                        style={[
                          styles.empBadge,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <Text style={[styles.empBadgeText, { color: theme.colors.mute }]}>
                          {mergedUserData.employee_id}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text
                    style={[styles.userEmail, { color: theme.colors.mute }]}
                    numberOfLines={2}
                    selectable
                  >
                    {view.email}
                  </Text>

                  <View style={styles.badgesRow}>
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor: roleMeta.bg,
                          borderColor: roleMeta.border,
                        },
                      ]}
                    >
                      <RoleIcon size={12} color={roleMeta.text} />
                      <Text style={[styles.roleBadgeText, { color: roleMeta.text }]}>
                        {roleMeta.label}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          borderColor: 'rgba(16, 185, 129, 0.25)',
                        },
                      ]}
                    >
                      <View style={styles.activeDot} />
                      <Text style={[styles.statusBadgeText, { color: '#059669' }]}>
                        {(view.status || 'ACTIVE').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Edit Profile Button */}
              <TouchableOpacity
                style={[
                  styles.editProfileBtn,
                  {
                    borderColor: theme.colors.hairline,
                    backgroundColor: theme.colors.canvas,
                  },
                ]}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Edit Profile"
              >
                <Edit size={14} color={theme.colors.link} />
                <Text style={[styles.editProfileBtnText, { color: theme.colors.ink }]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── Pending Request Review Banner (if any) ─── */}
          {pendingRequest && (
            <View
              style={[
                styles.pendingBanner,
                {
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                },
              ]}
            >
              <View style={styles.pendingHeader}>
                <View style={styles.pendingTitleGroup}>
                  <AlertTriangle size={15} color="#d97706" />
                  <Text style={styles.pendingTitle}>Pending Profile Review</Text>
                </View>
                <View
                  style={[
                    styles.pendingPill,
                    {
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                    },
                  ]}
                >
                  <Text style={styles.pendingPillText}>PENDING</Text>
                </View>
              </View>
              <Text style={[styles.pendingDesc, { color: theme.colors.mute }]}>
                A profile change request submitted on{' '}
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                  {formatDate(pendingRequest.created_at)}
                </Text>{' '}
                is currently under review by{' '}
                <Text style={{ fontWeight: '700', color: theme.colors.ink }}>
                  {pendingRequest.target_approver_role === 'super_admin'
                    ? 'Super Administrator'
                    : 'Administrator / Manager'}
                </Text>
                . New edits will overwrite this pending submission.
              </Text>
              <TouchableOpacity
                style={styles.cancelRequestBtn}
                onPress={handleCancelPendingRequest}
                disabled={isCancellingRequest}
                activeOpacity={0.7}
              >
                <XCircle size={13} color="#dc2626" />
                <Text style={styles.cancelRequestText}>
                  {isCancellingRequest ? 'Cancelling...' : 'Withdraw Request'}
                </Text>
              </TouchableOpacity>
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
                    <SectionIcon size={16} color="#0284c7" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>
                      {section.title}
                    </Text>
                  </View>

                  {/* Section Rows with Hairline Separators */}
                  <View style={styles.sectionBody}>
                    {section.rows.map((row: ProfileRow, rIdx: number) => {
                      const isAadhaar = row.label === 'Aadhaar';
                      const isLast = rIdx === section.rows.length - 1;

                      return (
                        <View key={row.label} style={styles.rowWrap}>
                          <View
                            style={[
                              styles.rowContent,
                              isWide ? styles.rowContentWide : styles.rowContentMobile,
                            ]}
                          >
                            {/* Label */}
                            <Text
                              style={[
                                styles.rowLabel,
                                isWide && styles.rowLabelWide,
                                { color: theme.colors.mute },
                              ]}
                            >
                              {row.label}
                            </Text>

                            {/* Value / Badges / Actions */}
                            <View
                              style={[
                                styles.rowValueArea,
                                isWide ? styles.rowValueAreaWide : styles.rowValueAreaMobile,
                              ]}
                            >
                              {isAadhaar ? (
                                <View style={styles.aadhaarArea}>
                                  <Text
                                    style={[
                                      styles.rowValue,
                                      styles.monoText,
                                      { color: theme.colors.ink },
                                    ]}
                                    selectable
                                  >
                                    {showFullAadhaar ? formattedFullAadhaar : maskedAadhaar}
                                  </Text>
                                  {Boolean(cleanAadhaar) && (
                                    <View style={styles.inlineActions}>
                                      <TouchableOpacity
                                        style={styles.iconActionBtn}
                                        onPress={() => setShowFullAadhaar((prev) => !prev)}
                                        activeOpacity={0.7}
                                        accessibilityLabel={
                                          showFullAadhaar ? 'Hide Aadhaar number' : 'Reveal Aadhaar number'
                                        }
                                      >
                                        {showFullAadhaar ? (
                                          <EyeOff size={14} color={theme.colors.mute} />
                                        ) : (
                                          <Eye size={14} color={theme.colors.mute} />
                                        )}
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.iconActionBtn}
                                        onPress={() => handleCopy(cleanAadhaar, 'Aadhaar')}
                                        activeOpacity={0.7}
                                        accessibilityLabel="Copy Aadhaar"
                                      >
                                        {copiedField === 'Aadhaar' ? (
                                          <Check size={14} color="#10b981" />
                                        ) : (
                                          <Copy size={14} color={theme.colors.mute} />
                                        )}
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              ) : row.href ? (
                                <TouchableOpacity
                                  style={styles.linkArea}
                                  onPress={() => router.push(row.href as any)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={[styles.rowLink, { color: '#0284c7' }]}>
                                    {row.value}
                                  </Text>
                                  <ExternalLink size={12} color="#0284c7" />
                                </TouchableOpacity>
                              ) : row.badge ? (
                                <View style={styles.badgeArea}>
                                  <View
                                    style={[
                                      styles.statusPill,
                                      {
                                        backgroundColor:
                                          row.badge.variant === 'warning'
                                            ? 'rgba(245, 158, 11, 0.1)'
                                            : 'rgba(16, 185, 129, 0.1)',
                                        borderColor:
                                          row.badge.variant === 'warning'
                                            ? 'rgba(245, 158, 11, 0.25)'
                                            : 'rgba(16, 185, 129, 0.25)',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusPillText,
                                        {
                                          color:
                                            row.badge.variant === 'warning'
                                              ? '#d97706'
                                              : '#059669',
                                        },
                                      ]}
                                    >
                                      {row.badge.label}
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={styles.valueWithCopyArea}>
                                  <Text
                                    style={[
                                      styles.rowValue,
                                      row.isMonospace && styles.monoText,
                                      { color: theme.colors.ink },
                                    ]}
                                    selectable
                                  >
                                    {row.value}
                                  </Text>
                                  {row.copyable && row.copyValue && (
                                    <TouchableOpacity
                                      style={styles.iconActionBtn}
                                      onPress={() => handleCopy(row.copyValue!, row.label)}
                                      activeOpacity={0.7}
                                      accessibilityLabel={`Copy ${row.label}`}
                                    >
                                      {copiedField === row.label ? (
                                        <Check size={14} color="#10b981" />
                                      ) : (
                                        <Copy size={14} color={theme.colors.mute} />
                                      )}
                                    </TouchableOpacity>
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
            {/* Header: Title + Subtitle */}
            <View style={styles.docSectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>
                IDENTITY & BANKING DOCUMENTS
              </Text>
              <Text style={[styles.docSectionSubtitle, { color: theme.colors.mute }]}>
                Upload Aadhaar, Driving Licence, and Bank Passbook / Cheque for verification.
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
                    {/* Slot Title */}
                    <Text style={[styles.docSlotTitle, { color: theme.colors.ink }]}>
                      {docType.label}
                    </Text>

                    {/* 1. Existing Document View (Click to preview, Replace, Delete) */}
                    {existing && !isReplacing ? (
                      <TouchableOpacity
                        style={[
                          styles.existingDocCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                        onPress={() => {
                          setActiveViewerDoc({
                            title: docType.label,
                            url: existing.signed_url || undefined,
                            uri: existing.signed_url || undefined,
                            mimeType: existing.mime_type,
                            fileSizeBytes: existing.file_size_bytes,
                            fileName: existing.storage_path.split('/').pop(),
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        {/* Left: Format Pill + Uploaded Badge */}
                        <View style={styles.existingDocLeft}>
                          {/* File format icon */}
                          <View
                            style={[
                              styles.formatBadge,
                              isPdf
                                ? styles.formatBadgePdf
                                : isPng
                                ? styles.formatBadgePng
                                : isJpg
                                ? styles.formatBadgeJpg
                                : isWebp
                                ? styles.formatBadgeWebp
                                : styles.formatBadgeGeneric,
                            ]}
                          >
                            {isPdf ? (
                              <FileText size={12} color="#e11d48" />
                            ) : (
                              <ImageIcon size={12} color="#0284c7" />
                            )}
                            <Text
                              style={[
                                styles.formatBadgeText,
                                {
                                  color: isPdf
                                    ? '#e11d48'
                                    : isPng
                                    ? '#059669'
                                    : isJpg
                                    ? '#0284c7'
                                    : isWebp
                                    ? '#d97706'
                                    : theme.colors.ink,
                                },
                              ]}
                            >
                              {isPdf ? 'PDF' : isPng ? 'PNG' : isJpg ? 'JPG' : isWebp ? 'WEBP' : 'DOC'}
                            </Text>
                          </View>

                          {/* Uploaded badge */}
                          <View style={styles.uploadedBadge}>
                            <Check size={11} color="#059669" />
                            <Text style={styles.uploadedBadgeText}>Uploaded</Text>
                          </View>
                        </View>

                        {/* Right: Replace + Delete Actions */}
                        <View style={styles.existingDocRight}>
                          <TouchableOpacity
                            style={[
                              styles.docActionBtn,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setReplacingCode(docType.code);
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel={`Replace ${docType.label}`}
                          >
                            <RefreshCw size={13} color={theme.colors.mute} />
                            <Text style={[styles.docActionBtnText, { color: theme.colors.ink }]}>
                              Replace
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.docDeleteBtn,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleDeleteDocument(existing, docType.label);
                            }}
                            activeOpacity={0.7}
                            accessibilityLabel={`Delete ${docType.label}`}
                          >
                            <Trash2 size={13} color="#dc2626" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      /* 2. Upload Dropzone (When not uploaded or replacing) */
                      <View style={styles.dropzoneWrap}>
                        <TouchableOpacity
                          style={[
                            styles.dropzone,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                          onPress={() => handleUploadDocument(docType.code)}
                          disabled={isUploading}
                          activeOpacity={0.7}
                        >
                          {isUploading ? (
                            <View style={styles.uploadingBox}>
                              <ActivityIndicator size="small" color={theme.colors.link} />
                              <Text style={[styles.dropzoneHint, { color: theme.colors.mute }]}>
                                Uploading document...
                              </Text>
                            </View>
                          ) : (
                            <>
                              <View style={styles.dropzoneRow}>
                                <Upload size={14} color={theme.colors.mute} />
                                <Text style={[styles.dropzoneTitle, { color: theme.colors.mute }]}>
                                  {isReplacing ? 'Select replacement file' : 'Choose file to upload'}
                                </Text>
                              </View>
                              <Text style={[styles.dropzoneHint, { color: theme.colors.mute }]}>
                                PDF, PNG, JPG, WEBP, or DOC
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* Cancel replacement option */}
                        {isReplacing && (
                          <TouchableOpacity
                            style={styles.cancelReplaceBtn}
                            onPress={() => setReplacingCode(null)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.cancelReplaceText, { color: theme.colors.mute }]}>
                              Cancel
                            </Text>
                          </TouchableOpacity>
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
        onSuccess={() => {
          fetchProfileData();
          if (refreshSession) refreshSession();
        }}
      />

      {/* In-App Document Viewer Modal */}
      <MobileDocumentViewerModal
        document={activeViewerDoc}
        onClose={() => setActiveViewerDoc(null)}
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
  avatarLetter: {
    fontSize: 22,
    fontWeight: '800',
  },
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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  empBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  empBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
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
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
  },
  editProfileBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },

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
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d97706',
  },
  pendingPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  pendingDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  cancelRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    marginTop: 2,
    minHeight: 32,
  },
  cancelRequestText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },

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
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionBody: {
    width: '100%',
  },
  rowWrap: {
    width: '100%',
  },
  rowContent: {
    paddingVertical: 10,
  },
  rowContentMobile: {
    flexDirection: 'column',
    gap: 3,
  },
  rowContentWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowLabelWide: {
    width: '35%',
    flexShrink: 0,
  },
  rowValueArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValueAreaMobile: {
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowValueAreaWide: {
    width: '65%',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.2,
  },
  rowDivider: {
    height: 1,
    width: '100%',
  },

  // Aadhaar, Link, Badge & Copy row elements
  aadhaarArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
    minHeight: 30,
    minWidth: 30,
  },
  linkArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowLink: {
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  badgeArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueWithCopyArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },

  // ─── Identity & Banking Documents Section ─────────────────────────
  docSectionHeader: {
    marginBottom: 14,
    gap: 3,
  },
  docSectionSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
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
  docSlotTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
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
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  formatBadgePdf: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  formatBadgePng: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  formatBadgeJpg: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  formatBadgeWebp: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  formatBadgeGeneric: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderColor: 'rgba(150, 150, 150, 0.25)',
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  uploadedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
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
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 34,
  },
  docActionBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  docDeleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 34,
    minWidth: 34,
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
  dropzoneTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropzoneHint: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
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
    fontSize: 11,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
