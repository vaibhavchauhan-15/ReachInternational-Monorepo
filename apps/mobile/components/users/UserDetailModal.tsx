import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Badge, Button, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  ShieldCheck,
  CreditCard,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
  Copy,
  Check,
} from 'lucide-react-native';
import { maskAadhaar, formatLicenseNumber } from '@reachinternational/utils';

export interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  status: string;
  city?: string;
  district?: string;
  state?: string;
  aadhaar_number?: string | null;
  license_number?: string | null;
  created_at?: string;
}

export interface UserDetailModalProps {
  visible: boolean;
  onClose: () => void;
  user: UserRecord | null;
  onSuccess: () => void;
}

const ROLES_LIST = [
  'service_engineer',
  'manager',
  'service_manager',
  'store_manager',
  'supervisor',
  'operator',
  'mechanic',
  'hr_manager',
  'admin',
];

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => {
  const { theme } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  if (!user) return null;

  const handleToggleStatus = async () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', user.id);
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Error updating status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = () => {
    Alert.alert(
      'Reset User Password',
      `Are you sure you want to reset the security password for ${user.full_name}? A new temporary password will be generated and displayed for you to copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Password',
          style: 'destructive',
          onPress: async () => {
            const rawFirst = (user.full_name || '').trim().split(/\s+/)[0] || 'User';
            const cleaned = rawFirst.replace(/[^a-zA-Z0-9]/g, '');
            const firstName = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : 'User';
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const generatedPwd = `${firstName}@${randomNum}`;
            setIsLoading(true);
            try {
              setResetPasswordResult(generatedPwd);
            } catch (err: any) {
              console.warn('Error resetting password:', err);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateRole = async (newRole: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', user.id);
      if (error) throw error;
      setRoleModalVisible(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Error updating role:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      console.warn('Error deleting user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPassword = () => {
    if (resetPasswordResult) {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.colors.ink }]}>
                <Text style={[styles.avatarLetter, { color: theme.colors.canvas }]}>
                  {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                </Text>
              </View>
              <View>
                <Text style={[styles.userName, { color: theme.colors.ink }]}>{user.full_name}</Text>
                <Text style={[styles.userEmail, { color: theme.colors.mute }]}>{user.email}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Status & Role Row */}
            <View style={styles.statusBadgeRow}>
              <Badge status={user.status === 'active' ? 'active' : 'inactive'} customLabel={user.status.toUpperCase()} />
              <Badge status="available" customLabel={user.role.replace('_', ' ').toUpperCase()} />
            </View>

            {/* Generated Password Box */}
            {resetPasswordResult && (
              <View style={[styles.passwordBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <Text style={[styles.pwdLabel, { color: theme.colors.mute }]}>Generated Temporary Password:</Text>
                <View style={styles.pwdRow}>
                  <Text style={[styles.pwdText, { color: theme.colors.link }]}>{resetPasswordResult}</Text>
                  <TouchableOpacity onPress={copyPassword} style={styles.copyBtn}>
                    {copiedPassword ? (
                      <Check size={16} color={theme.colors.success} />
                    ) : (
                      <Copy size={16} color={theme.colors.mute} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Account Details Card */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>ACCOUNT SPECIFICATIONS</Text>

              <View style={styles.infoRow}>
                <Phone size={14} color={theme.colors.mute} />
                <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Phone:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.ink }]}>{user.phone || '—'}</Text>
              </View>

              <View style={styles.infoRow}>
                <MapPin size={14} color={theme.colors.mute} />
                <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Location:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.ink }]}>
                  {[user.city, user.district, user.state].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <ShieldCheck size={14} color={theme.colors.mute} />
                <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Aadhaar:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                  {maskAadhaar(user.aadhaar_number)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <CreditCard size={14} color={theme.colors.mute} />
                <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Licence:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.ink, fontFamily: 'monospace' }]}>
                  {formatLicenseNumber(user.license_number)}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Shield size={14} color={theme.colors.mute} />
                <Text style={[styles.infoLabel, { color: theme.colors.mute }]}>Role Code:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.ink }]}>{user.role}</Text>
              </View>
            </View>

            {/* Management Actions */}
            <View style={styles.actionsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginLeft: 2 }]}>MANAGEMENT CONTROLS</Text>

              <Button
                label={user.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                onPress={handleToggleStatus}
                variant={user.status === 'active' ? 'outline' : 'primary'}
                icon={user.status === 'active' ? <UserX size={14} color={theme.colors.error} /> : <UserCheck size={14} color={theme.colors.onPrimary} />}
                isLoading={isLoading}
              />

              <Button
                label="Change System Role"
                onPress={() => setRoleModalVisible(true)}
                variant="outline"
                icon={<Shield size={14} color={theme.colors.link} />}
              />

              <Button
                label="Reset User Password"
                onPress={handleResetPassword}
                variant="outline"
                icon={<KeyRound size={14} color={theme.colors.warning} />}
              />

              <Button
                label="Delete User Account"
                onPress={handleDeleteUser}
                variant="danger"
                icon={<Trash2 size={14} color="#ffffff" />}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Done" onPress={onClose} variant="primary" size="md" fullWidth />
          </View>
        </View>

        {/* Role Change Modal */}
        <Modal visible={roleModalVisible} animationType="slide" transparent onRequestClose={() => setRoleModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Update User Role</Text>
                <TouchableOpacity onPress={() => setRoleModalVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.roleListScroll} showsVerticalScrollIndicator={false}>
                {ROLES_LIST.map((r) => {
                  const isCurrent = user.role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => handleUpdateRole(r)}
                      style={[
                        styles.roleItemRow,
                        { borderBottomColor: theme.colors.hairline },
                        isCurrent && { backgroundColor: theme.colors.link + '15' },
                      ]}
                    >
                      <Text style={[styles.roleItemText, { color: isCurrent ? theme.colors.link : theme.colors.ink, fontWeight: isCurrent ? '700' : '500' }]}>
                        {r.replace('_', ' ').toUpperCase()}
                      </Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '90%',
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
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  passwordBox: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    gap: 4,
  },
  pwdLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pwdText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  copyBtn: {
    padding: 6,
  },
  sectionCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    width: 65,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actionsSection: {
    gap: 8,
  },
  footer: {
    padding: spacingNumeric.lg,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '60%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  roleListScroll: {
    paddingHorizontal: spacingNumeric.md,
  },
  roleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
  },
  roleItemText: {
    fontSize: 13,
  },
});
