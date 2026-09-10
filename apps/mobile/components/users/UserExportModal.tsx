import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate, maskAadhaar, formatLicenseNumber } from '@reachinternational/utils';
import { FileSpreadsheet, FileText, Download, Check, X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { UserRecord } from './UserDetailModal';

export interface UserExportModalProps {
  visible: boolean;
  onClose: () => void;
  currentPageUsers: UserRecord[];
  totalMatchingCount: number;
  selectedUserIds: string[];
  currentPage: number;
  totalPages: number;
  activeFilterCount: number;
  onFetchAllMatchingUsers: () => Promise<UserRecord[]>;
}

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

function formatStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'pending':
      return 'Pending Approval';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  }
}

function formatSlugDateTime(): string {
  const dateObj = new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year}-${hours}-${minutes}`;
}

function generateCSV(users: UserRecord[]): string {
  const headers = [
    'S.No',
    'Full Name',
    'Email Address',
    'Mobile Number',
    'Role',
    'Supervisor',
    'Working Location',
    'Status',
    'City',
    'District',
    'State',
    'Aadhaar Number',
    'Driving Licence',
    'Joined Date',
  ];

  const escapeCSV = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = users.map((u, index) => [
    index + 1,
    u.full_name || '',
    u.email || '',
    u.phone || '',
    formatRoleName(u.role),
    u.supervisor?.full_name || '',
    u.working_location?.name || '',
    formatStatus(u.status),
    u.city || u.location || '',
    u.district || '',
    u.state || '',
    u.aadhaar_number ? maskAadhaar(u.aadhaar_number) : '',
    u.license_number ? formatLicenseNumber(u.license_number) : '',
    u.created_at ? formatDate(u.created_at) : '',
  ]);

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\r\n');
}

export const UserExportModal: React.FC<UserExportModalProps> = ({
  visible,
  onClose,
  currentPageUsers,
  totalMatchingCount,
  selectedUserIds,
  currentPage,
  totalPages,
  activeFilterCount,
  onFetchAllMatchingUsers,
}) => {
  const { theme } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [exportScope, setExportScope] = useState<'current' | 'all' | 'selected'>('current');

  const handleExecuteExport = async (scope: 'current' | 'all' | 'selected') => {
    try {
      setIsExporting(true);
      setExportScope(scope);

      let targetUsers: UserRecord[] = [];
      let filenamePrefix = 'Users-Directory';

      if (scope === 'current') {
        targetUsers = currentPageUsers;
        filenamePrefix = `Users-Page-${currentPage}`;
      } else if (scope === 'selected') {
        targetUsers = currentPageUsers.filter((u) => selectedUserIds.includes(u.id));
        filenamePrefix = 'Users-Selected';
      } else {
        targetUsers = await onFetchAllMatchingUsers();
        filenamePrefix = activeFilterCount > 0 ? 'Users-Directory-Filtered' : 'Users-Directory-All';
      }

      if (!targetUsers || targetUsers.length === 0) {
        Alert.alert('Export Empty', 'No users found in the chosen export scope.');
        return;
      }

      const csvString = generateCSV(targetUsers);
      const fileName = `${filenamePrefix}-${formatSlugDateTime()}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Write UTF-8 BOM for Excel compatibility
      await FileSystem.writeAsStringAsync(fileUri, '\uFEFF' + csvString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${targetUsers.length} Users`,
          UTI: 'public.comma-separated-values-text',
        });
        onClose();
      } else {
        Alert.alert('Sharing Unavailable', 'Native sharing is not available on this device.');
      }
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to export users directory.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCount = selectedUserIds.length;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={isExporting ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={isExporting ? undefined : onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialog,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.titleRow}>
                  <View style={[styles.iconWrap, { backgroundColor: '#10b98118' }]}>
                    <FileSpreadsheet size={18} color="#10b981" />
                  </View>
                  <View>
                    <Text style={[styles.title, { color: theme.colors.ink }]}>
                      Export Directory
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                      Generate CSV formatted report
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  disabled={isExporting}
                >
                  <X size={18} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              {/* Format Badge */}
              <View style={[styles.formatRow, { backgroundColor: theme.colors.canvas, borderBottomColor: theme.colors.hairline }]}>
                <View style={[styles.badge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                  <FileText size={13} color="#0284c7" />
                  <Text style={[styles.badgeText, { color: theme.colors.ink }]}>CSV Format (UTF-8)</Text>
                </View>
                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  Compatible with Excel & Sheets
                </Text>
              </View>

              {/* Options List */}
              <View style={styles.optionsList}>
                {/* Option 1: Current Page */}
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  onPress={() => handleExecuteExport('current')}
                  disabled={isExporting || currentPageUsers.length === 0}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: '#10b98115' }]}>
                    {isExporting && exportScope === 'current' ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : (
                      <FileSpreadsheet size={16} color="#10b981" />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>
                      Current Page
                    </Text>
                    <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                      Page {currentPage} of {totalPages || 1}
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.countBadgeText, { color: theme.colors.ink }]}>
                      {currentPageUsers.length} {currentPageUsers.length === 1 ? 'user' : 'users'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: All Matching Users */}
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  onPress={() => handleExecuteExport('all')}
                  disabled={isExporting || totalMatchingCount === 0}
                >
                  <View style={[styles.optionIconWrap, { backgroundColor: '#3b82f615' }]}>
                    {isExporting && exportScope === 'all' ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : (
                      <Download size={16} color="#3b82f6" />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>
                      All Matching Users
                    </Text>
                    <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                      {activeFilterCount > 0 ? 'Filtered dataset across all pages' : 'Entire directory across all pages'}
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                    <Text style={[styles.countBadgeText, { color: theme.colors.ink }]}>
                      {totalMatchingCount} {totalMatchingCount === 1 ? 'user' : 'users'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Option 3: Selected Users */}
                {selectedCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: '#f59e0b08',
                        borderColor: '#f59e0b33',
                      },
                    ]}
                    onPress={() => handleExecuteExport('selected')}
                    disabled={isExporting}
                  >
                    <View style={[styles.optionIconWrap, { backgroundColor: '#f59e0b18' }]}>
                      {isExporting && exportScope === 'selected' ? (
                        <ActivityIndicator size="small" color="#f59e0b" />
                      ) : (
                        <Check size={16} color="#d97706" />
                      )}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>
                        Selected Users
                      </Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                        Checked rows on current page
                      </Text>
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                      <Text style={[styles.countBadgeText, { color: '#92400e' }]}>
                        {selectedCount} {selectedCount === 1 ? 'user' : 'users'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.colors.hairline }]}
                  onPress={onClose}
                  disabled={isExporting}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.colors.ink }]}>
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.md,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: spacingNumeric.xs,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
  },
  optionsList: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  optionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 8,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
