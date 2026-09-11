import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { supabase } from '../../lib/supabase';
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
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: string;
  status: string;
  shift_time?: string | null;
  address?: string | null;
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
  created_at?: string;
}

export interface UserDetailModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  currentUserRole?: string;
  currentUserId?: string;
  onSuccess: () => void;
  onEdit?: (user: UserRecord) => void;
  onResetPassword?: (user: UserRecord) => void;
}

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'service_engineer', label: 'Service Engineer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'store_manager', label: 'Store Manager' },
  { value: 'operator', label: 'Operator' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'hr_manager', label: 'HR Manager' },
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
    case 'branch_manager':
      return {
        label: 'Manager',
        badgeBg: '#e0e7ff',
        badgeText: '#4338ca',
        badgeBorder: '#c7d2fe',
        icon: <ShieldCheck size={18} color="#4338ca" />,
      };
    case 'service_manager':
      return {
        label: 'Service Manager',
        badgeBg: '#e0f2fe',
        badgeText: '#0369a1',
        badgeBorder: '#bae6fd',
        icon: <ShieldCheck size={18} color="#0369a1" />,
      };
    case 'service_engineer':
    case 'engineer':
      return {
        label: 'Service Engineer',
        badgeBg: '#dbeafe',
        badgeText: '#1d4ed8',
        badgeBorder: '#bfdbfe',
        icon: <Shield size={18} color="#1d4ed8" />,
      };
    case 'supervisor':
      return {
        label: 'Supervisor',
        badgeBg: '#ccfbf1',
        badgeText: '#0f766e',
        badgeBorder: '#99f6e4',
        icon: <ShieldCheck size={18} color="#0f766e" />,
      };
    case 'store_manager':
      return {
        label: 'Store Manager',
        badgeBg: '#f3e8ff',
        badgeText: '#7e22ce',
        badgeBorder: '#e9d5ff',
        icon: <Shield size={18} color="#7e22ce" />,
      };
    case 'operator':
      return {
        label: 'Operator',
        badgeBg: '#fef3c7',
        badgeText: '#92400e',
        badgeBorder: '#fde68a',
        icon: <Shield size={18} color="#92400e" />,
      };
    case 'mechanic':
      return {
        label: 'Mechanic',
        badgeBg: '#ffedd5',
        badgeText: '#c2410c',
        badgeBorder: '#fed7aa',
        icon: <Shield size={18} color="#c2410c" />,
      };
    case 'hr_manager':
      return {
        label: 'HR Manager',
        badgeBg: '#d1fae5',
        badgeText: '#047857',
        badgeBorder: '#a7f3d0',
        icon: <ShieldCheck size={18} color="#047857" />,
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
  const { theme } = useTheme();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Role selector state
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // Supervisor selector state
  const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
  const [activeSupervisors, setActiveSupervisors] = useState<Array<{ id: string; full_name: string; email?: string }>>([]);

  React.useEffect(() => {
    async function loadSupervisors() {
      try {
        const { data } = await supabase.rpc('get_active_supervisors_public');
        if (data) setActiveSupervisors(data as Array<{ id: string; full_name: string; email?: string }>);
      } catch {
        // ignore
      }
    }
    if (visible) {
      loadSupervisors();
    }
  }, [visible]);

  if (!user) return null;

  const roleMeta = getRoleMeta(user.role);
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
      Linking.openURL(`mailto:${user.email}`).catch(() => {});
    }
  };

  const handlePhonePress = () => {
    if (user.phone) {
      const clean = user.phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`).catch(() => {});
    }
  };

  const handleToggleStatus = () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const actionLabel = newStatus === 'active' ? 'activate' : 'deactivate';

    Alert.alert(
      `${newStatus === 'active' ? 'Activate' : 'Deactivate'} User Account`,
      `Are you sure you want to ${actionLabel} account access for ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus === 'active' ? 'Activate' : 'Deactivate',
          style: newStatus === 'active' ? 'default' : 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { error } = await supabase
                .from('users')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', user.id);
              if (error) throw error;
              notifyUserStatusChanged(user.full_name, newStatus);
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Status Update Failed', err?.message || 'Failed to update user status.');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateRole = async (newRole: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      notifyUserUpdated(user.full_name, newRole);
      setRoleModalVisible(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Role Update Failed', err?.message || 'Failed to update user role.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSupervisor = async (newSupervisorId: string | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          supervisor_id: newSupervisorId || null,
          supervisor_ids: newSupervisorId ? [newSupervisorId] : [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      setSupervisorModalVisible(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Supervisor Update Failed', err?.message || 'Failed to update supervisor assignment.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = () => {
    Alert.alert(
      'Delete User Account',
      `Are you sure you want to permanently delete the account for ${user.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { error } = await supabase.from('users').delete().eq('id', user.id);
              if (error) throw error;
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Deletion Error', err?.message || 'Failed to delete user account.');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const assignedSupervisorName = user.supervisors && user.supervisors.length > 0
    ? user.supervisors.map((s) => s.full_name).join(', ')
    : user.supervisor?.full_name;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Mobile Drag Notch Handle */}
          <View style={[styles.notchContainer, { backgroundColor: theme.colors.canvas }]}>
            <View style={[styles.notch, { backgroundColor: theme.colors.hairline }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.roleIconContainer,
                  { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                ]}
              >
                {roleMeta.icon}
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.userName, { color: theme.colors.ink }]} numberOfLines={1}>
                  {user.full_name}
                </Text>
                <View style={styles.badgesRow}>
                  {/* Role Badge */}
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: roleMeta.badgeBg, borderColor: roleMeta.badgeBorder },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: roleMeta.badgeText }]}>
                      {roleMeta.label}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  {user.status === 'active' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                      <Text style={[styles.statusBadgeText, { color: '#047857' }]}>Active</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#94a3b8' }]} />
                      <Text style={[styles.statusBadgeText, { color: '#64748b' }]}>
                        {user.status ? user.status.toUpperCase() : 'INACTIVE'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Quick Contact Buttons Row */}
            <View style={styles.quickContactGrid}>
              <TouchableOpacity
                style={[
                  styles.quickContactBtn,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
                onPress={handleEmailPress}
                activeOpacity={0.75}
              >
                <Mail size={15} color={theme.colors.link} />
                <Text style={[styles.quickContactBtnText, { color: theme.colors.ink }]}>Email User</Text>
              </TouchableOpacity>

              {user.phone ? (
                <TouchableOpacity
                  style={[
                    styles.quickContactBtn,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                  onPress={handlePhonePress}
                  activeOpacity={0.75}
                >
                  <Phone size={15} color="#10b981" />
                  <Text style={[styles.quickContactBtnText, { color: theme.colors.ink }]}>Call Phone</Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.quickContactBtn,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, opacity: 0.5 },
                  ]}
                >
                  <Phone size={15} color={theme.colors.mute} />
                  <Text style={[styles.quickContactBtnText, { color: theme.colors.mute }]}>No Phone</Text>
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
                <Text style={[styles.detailsWellTitle, { color: theme.colors.mute }]}>ACCOUNT DETAILS</Text>
                <TouchableOpacity
                  style={styles.idCopyBtn}
                  onPress={() => copyToClipboard(user.id, 'User ID')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.idCopyText, { color: theme.colors.mute }]}>
                    ID: {user.id.slice(0, 8)}...
                  </Text>
                  {copiedField === 'User ID' ? (
                    <Check size={12} color="#10b981" />
                  ) : (
                    <Copy size={12} color={theme.colors.mute} />
                  )}
                </TouchableOpacity>
              </View>

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
                  <TouchableOpacity
                    style={styles.fieldCopyBtn}
                    onPress={() => copyToClipboard(user.email, 'Email')}
                    activeOpacity={0.7}
                  >
                    {copiedField === 'Email' ? (
                      <Check size={13} color="#10b981" />
                    ) : (
                      <Copy size={13} color={theme.colors.mute} />
                    )}
                  </TouchableOpacity>
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
                    <Text style={[styles.detailValue, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                      {user.phone}
                    </Text>
                    <TouchableOpacity
                      style={styles.fieldCopyBtn}
                      onPress={() => copyToClipboard(user.phone!, 'Phone')}
                      activeOpacity={0.7}
                    >
                      {copiedField === 'Phone' ? (
                        <Check size={13} color="#10b981" />
                      ) : (
                        <Copy size={13} color={theme.colors.mute} />
                      )}
                    </TouchableOpacity>
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
              {user.address ? (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabelWrap}>
                    <MapPin size={13} color="#d97706" />
                    <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Street Address</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: theme.colors.ink, textAlign: 'right', flex: 1 }]}>
                    {user.address}
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

              {/* Working Location / Base */}
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <Building2 size={13} color="#2563eb" />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Working Location / Base</Text>
                </View>
                <Text style={[styles.detailValue, { color: theme.colors.ink, textAlign: 'right', flex: 1 }]}>
                  {user.working_location?.name
                    ? `${user.working_location.name}${user.working_location.city ? ` (${user.working_location.city})` : ''}`
                    : '—'}
                </Text>
              </View>

              {/* Aadhaar Number */}
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWrap}>
                  <ShieldCheck size={13} color={theme.colors.link} />
                  <Text style={[styles.detailLabel, { color: theme.colors.mute }]}>Aadhaar Number</Text>
                </View>
                <View style={styles.detailValueWrap}>
                  <Text style={[styles.detailValue, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                    {user.aadhaar_number
                      ? showFullAadhaar
                        ? user.aadhaar_number
                        : maskAadhaar(user.aadhaar_number)
                      : '—'}
                  </Text>
                  {user.aadhaar_number ? (
                    <>
                      <TouchableOpacity
                        style={styles.fieldCopyBtn}
                        onPress={() => setShowFullAadhaar((prev) => !prev)}
                        activeOpacity={0.7}
                      >
                        {showFullAadhaar ? (
                          <EyeOff size={13} color={theme.colors.mute} />
                        ) : (
                          <Eye size={13} color={theme.colors.mute} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.fieldCopyBtn}
                        onPress={() => copyToClipboard(user.aadhaar_number!, 'Aadhaar')}
                        activeOpacity={0.7}
                      >
                        {copiedField === 'Aadhaar' ? (
                          <Check size={13} color="#10b981" />
                        ) : (
                          <Copy size={13} color={theme.colors.mute} />
                        )}
                      </TouchableOpacity>
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
                  <Text style={[styles.detailValue, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                    {user.license_number ? formatLicenseNumber(user.license_number) : '—'}
                  </Text>
                  {user.license_number ? (
                    <TouchableOpacity
                      style={styles.fieldCopyBtn}
                      onPress={() => copyToClipboard(user.license_number!, 'Licence')}
                      activeOpacity={0.7}
                    >
                      {copiedField === 'Licence' ? (
                        <Check size={13} color="#10b981" />
                      ) : (
                        <Copy size={13} color={theme.colors.mute} />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

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
              <Text style={[styles.managementSectionTitle, { color: theme.colors.mute }]}>
                MANAGEMENT ACTIONS
              </Text>

              {/* Change Role Selector (Super Admin) */}
              {isSuperAdmin && !isSelf && (
                <View
                  style={[
                    styles.selectorCard,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                >
                  <View style={styles.selectorLabelRow}>
                    {roleMeta.icon}
                    <Text style={[styles.selectorLabel, { color: theme.colors.ink }]}>
                      User Permission Role
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.selectorTrigger,
                      { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                    ]}
                    onPress={() => setRoleModalVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.selectorTriggerText, { color: theme.colors.ink }]}>
                      {roleMeta.label}
                    </Text>
                    <ChevronDown size={15} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Assign Supervisor Selector */}
              {isSupervisedRole(user.role) && !isSelf && (
                <View
                  style={[
                    styles.selectorCard,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                >
                  <View style={styles.selectorLabelRow}>
                    <User size={15} color={theme.colors.link} />
                    <Text style={[styles.selectorLabel, { color: theme.colors.ink }]}>
                      Assign Supervisor
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.selectorTrigger,
                      { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                    ]}
                    onPress={() => setSupervisorModalVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.selectorTriggerText, { color: assignedSupervisorName ? theme.colors.ink : theme.colors.mute }]}>
                      {assignedSupervisorName || 'No Supervisor (Unassigned)'}
                    </Text>
                    <ChevronDown size={15} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>
              )}

              {/* 2x2 Management Actions Grid */}
              <View style={styles.actionsGrid}>
                {/* 1. Edit Account Info */}
                <TouchableOpacity
                  style={[
                    styles.actionGridBtn,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                  onPress={() => {
                    onClose();
                    if (onEdit) onEdit(user);
                  }}
                  activeOpacity={0.75}
                >
                  <Edit2 size={14} color={theme.colors.link} />
                  <Text style={[styles.actionGridBtnText, { color: theme.colors.ink }]}>
                    Edit Account Info
                  </Text>
                </TouchableOpacity>

                {/* 2. Reset Password */}
                <TouchableOpacity
                  style={[
                    styles.actionGridBtn,
                    { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                  ]}
                  onPress={() => {
                    onClose();
                    if (onResetPassword) onResetPassword(user);
                  }}
                  activeOpacity={0.75}
                >
                  <KeyRound size={14} color="#d97706" />
                  <Text style={[styles.actionGridBtnText, { color: theme.colors.ink }]}>
                    Reset Password
                  </Text>
                </TouchableOpacity>

                {/* 3. Activate / Deactivate Account */}
                {!isSelf && (
                  <TouchableOpacity
                    style={[
                      styles.actionGridBtn,
                      { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                    ]}
                    onPress={handleToggleStatus}
                    activeOpacity={0.75}
                    disabled={isUpdating}
                  >
                    {user.status === 'active' ? (
                      <>
                        <UserX size={14} color="#d97706" />
                        <Text style={[styles.actionGridBtnText, { color: theme.colors.ink }]}>
                          Deactivate Account
                        </Text>
                      </>
                    ) : (
                      <>
                        <UserCheck size={14} color="#10b981" />
                        <Text style={[styles.actionGridBtnText, { color: theme.colors.ink }]}>
                          Activate Account
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* 4. Delete Account (Super Admin only) */}
                {isSuperAdmin && !isSelf && (
                  <TouchableOpacity
                    style={[
                      styles.actionGridBtn,
                      styles.deleteActionBtn,
                    ]}
                    onPress={handleDeleteUser}
                    activeOpacity={0.75}
                    disabled={isUpdating}
                  >
                    <Trash2 size={14} color="#ef4444" />
                    <Text style={[styles.actionGridBtnText, { color: '#ef4444', fontWeight: '600' }]}>
                      Delete Account
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Close Button */}
          <View style={[styles.footer, { backgroundColor: theme.colors.canvas, borderTopColor: theme.colors.hairline }]}>
            <TouchableOpacity
              style={[
                styles.closeSheetBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
              ]}
              onPress={onClose}
              activeOpacity={0.75}
            >
              <Text style={[styles.closeSheetBtnText, { color: theme.colors.ink }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Role Picker Modal */}
        <Modal visible={roleModalVisible} animationType="fade" transparent onRequestClose={() => setRoleModalVisible(false)}>
          <View style={styles.pickerModalOverlay}>
            <View style={[styles.pickerModalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.pickerModalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.pickerModalTitle, { color: theme.colors.ink }]}>Update User Role</Text>
                <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                  <X size={18} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {ALL_ROLES.map((r) => {
                  const isCurrent = user.role === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.pickerModalItem,
                        { borderBottomColor: theme.colors.hairline },
                        isCurrent && { backgroundColor: theme.colors.link + '14' },
                      ]}
                      onPress={() => handleUpdateRole(r.value)}
                    >
                      <Text style={[styles.pickerModalItemText, { color: isCurrent ? theme.colors.link : theme.colors.ink, fontWeight: isCurrent ? '700' : '500' }]}>
                        {r.label}
                      </Text>
                      {isCurrent && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Supervisor Picker Modal */}
        <Modal visible={supervisorModalVisible} animationType="fade" transparent onRequestClose={() => setSupervisorModalVisible(false)}>
          <View style={styles.pickerModalOverlay}>
            <View style={[styles.pickerModalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.pickerModalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.pickerModalTitle, { color: theme.colors.ink }]}>Select Supervisor</Text>
                <TouchableOpacity onPress={() => setSupervisorModalVisible(false)}>
                  <X size={18} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                <TouchableOpacity
                  style={[styles.pickerModalItem, { borderBottomColor: theme.colors.hairline }]}
                  onPress={() => handleUpdateSupervisor(null)}
                >
                  <Text style={[styles.pickerModalItemText, { color: theme.colors.mute }]}>
                    None (Unassigned)
                  </Text>
                  {!user.supervisor_id && <Check size={16} color={theme.colors.link} />}
                </TouchableOpacity>
                {activeSupervisors.map((s) => {
                  const isCurrent = user.supervisor_id === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.pickerModalItem,
                        { borderBottomColor: theme.colors.hairline },
                        isCurrent && { backgroundColor: theme.colors.link + '14' },
                      ]}
                      onPress={() => handleUpdateSupervisor(s.id)}
                    >
                      <View>
                        <Text style={[styles.pickerModalItemText, { color: isCurrent ? theme.colors.link : theme.colors.ink, fontWeight: isCurrent ? '700' : '500' }]}>
                          {s.full_name}
                        </Text>
                        {s.email ? <Text style={{ fontSize: 11, color: theme.colors.mute }}>{s.email}</Text> : null}
                      </View>
                      {isCurrent && <Check size={16} color={theme.colors.link} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
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
  roleIconContainer: {
    width: 42,
    height: 42,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  idCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  idCopyText: {
    fontSize: 10,
    fontFamily: 'monospace',
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
    fontSize: 12,
    fontWeight: '500',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldCopyBtn: {
    padding: 2,
  },
  relativeTimeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  managementSection: {
    gap: spacingNumeric.sm,
    paddingTop: 2,
  },
  managementSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  selectorCard: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 6,
  },
  selectorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
  },
  selectorTriggerText: {
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 12,
    fontWeight: '500',
  },
  deleteActionBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
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
    fontSize: 13,
    fontWeight: '600',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  pickerModalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  pickerModalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pickerModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  pickerModalItemText: {
    fontSize: 13,
  },
});
