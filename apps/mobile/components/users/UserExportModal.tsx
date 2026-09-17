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
import { formatDate, formatAadhaar, formatLicenseNumber } from '@reachinternational/utils';
import { FileSpreadsheet, X, FileText, Download, Check } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { notifyUserExported } from '../../lib/notifications';
import {
  buildPdfHtmlHeader,
  buildPdfHtmlKpiStrip,
  buildPdfHtmlSignatureBlock,
  buildPdfHtmlWrapper,
} from '../../lib/pdf-html-templates';
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

export function formatMergedAddress(u: UserRecord): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  const addPart = (val?: string | null) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'null') return;
    const normalized = trimmed.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      parts.push(trimmed);
    }
  };

  addPart(u.address);
  addPart(u.city || u.location);
  addPart(u.district);
  addPart(u.state);

  return parts.length > 0 ? parts.join(', ') : '—';
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
    'Address',
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
    formatMergedAddress(u) === '—' ? '' : formatMergedAddress(u),
    u.aadhaar_number ? formatAadhaar(u.aadhaar_number) : '',
    u.license_number ? formatLicenseNumber(u.license_number) : '',
    u.created_at ? formatDate(u.created_at) : '',
  ]);

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\r\n');
}

function generateReportHtml(users: UserRecord[], scopeLabel: string): string {
  const dateObj = new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const displayDateTime = `${day}-${month}-${year} ${hours}:${minutes}`;

  let activeCount = 0;
  let pendingCount = 0;
  let inactiveCount = 0;

  users.forEach((u) => {
    if (u.status === 'active') activeCount++;
    else if (u.status === 'pending') pendingCount++;
    else if (u.status === 'inactive') inactiveCount++;
  });

  const headerHtml = buildPdfHtmlHeader({
    title: 'USER &amp; EMPLOYEE DIRECTORY REPORT',
    subtitle: 'Official Personnel Registry, Contact Information &amp; KYC Verification Records',
    metaItems: [
      { label: 'Report Scope', value: scopeLabel },
      { label: 'Total Users', value: `${users.length} Users` },
      { label: 'Export Date', value: displayDateTime },
      { label: 'Authorized By', value: 'Operations &amp; HR' },
    ],
  });

  const kpiStripHtml = buildPdfHtmlKpiStrip([
    { label: 'Total Users', value: `${users.length}` },
    { label: 'Active Accounts', value: `${activeCount}`, color: '#059669' },
    { label: 'Pending Approval', value: `${pendingCount}`, color: '#d97706' },
    { label: 'Inactive Accounts', value: `${inactiveCount}`, color: '#dc2626' },
  ]);

  const rowsHtml = users
    .map((u, index) => {
      const isEven = index % 2 === 0;
      const rowBg = isEven ? '#ffffff' : '#f9fafb';
      const statusText = formatStatus(u.status);
      const statusColor =
        u.status === 'active'
          ? '#059669'
          : u.status === 'pending'
          ? '#d97706'
          : '#dc2626';

      return `
        <tr style="background-color: ${rowBg};">
          <td style="width: 3%; font-family: monospace; font-size: 8px;">${index + 1}</td>
          <td style="width: 13%; text-align: left; font-weight: 600; font-size: 8.5px;">${u.full_name || '—'}</td>
          <td style="width: 14%; text-align: left; font-size: 8px; word-break: break-all;">${u.email || '—'}</td>
          <td style="width: 9%; font-family: monospace; font-size: 8px;">${u.phone || '—'}</td>
          <td style="width: 8%; font-size: 8px; font-weight: 600;">${formatRoleName(u.role)}</td>
          <td style="width: 8%; font-size: 8px;">${u.supervisor?.full_name || '—'}</td>
          <td style="width: 8%; font-size: 8px;">${u.working_location?.name || '—'}</td>
          <td style="width: 6%; font-weight: bold; font-size: 8px; color: ${statusColor};">${statusText}</td>
          <td style="width: 13%; text-align: left; font-size: 7.5px; line-height: 1.2;">${formatMergedAddress(u)}</td>
          <td style="width: 8%; font-family: monospace; font-size: 8px;">${u.aadhaar_number ? formatAadhaar(u.aadhaar_number) : '—'}</td>
          <td style="width: 7%; font-family: monospace; font-size: 8px;">${u.license_number ? formatLicenseNumber(u.license_number) : '—'}</td>
          <td style="width: 6%; font-family: monospace; font-size: 8px;">${u.created_at ? formatDate(u.created_at) : '—'}</td>
        </tr>
      `;
    })
    .join('\n');

  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th style="width: 3%;">S.N</th>
          <th style="width: 13%; text-align: left;">FULL NAME</th>
          <th style="width: 14%; text-align: left;">EMAIL ADDRESS</th>
          <th style="width: 9%;">MOBILE</th>
          <th style="width: 8%;">ROLE</th>
          <th style="width: 8%;">SUPERVISOR</th>
          <th style="width: 8%;">LOCATION</th>
          <th style="width: 6%;">STATUS</th>
          <th style="width: 13%; text-align: left;">ADDRESS</th>
          <th style="width: 8%;">AADHAAR</th>
          <th style="width: 7%;">LICENCE</th>
          <th style="width: 6%;">JOINED</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  const signaturesHtml = buildPdfHtmlSignatureBlock([
    {
      title: 'Prepared By',
      name: 'HR &amp; ADMINISTRATION',
      subtitle: '(Personnel Registry)',
    },
    {
      title: 'Site Verification',
      name: 'OPERATIONS SUPERVISOR',
      subtitle: '(Field Deployment)',
    },
    {
      title: 'Verified &amp; Approved By',
      name: 'REACH INTERNATIONAL',
      subtitle: '(Executive Management)',
    },
  ]);

  return buildPdfHtmlWrapper({
    title: 'USER & EMPLOYEE DIRECTORY REPORT',
    bodyContent: `${headerHtml}\n${kpiStripHtml}\n${tableHtml}\n${signaturesHtml}`,
    orientation: 'landscape',
  });
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
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportScope, setExportScope] = useState<'current' | 'all' | 'selected'>('current');

  const handleExecuteExport = async (scope: 'current' | 'all' | 'selected') => {
    try {
      setIsExporting(true);
      setExportScope(scope);

      let targetUsers: UserRecord[] = [];
      let filenamePrefix = 'Users-Directory';
      let scopeLabel = 'Full Directory';

      if (scope === 'current') {
        targetUsers = currentPageUsers;
        filenamePrefix = `Users-Page-${currentPage}`;
        scopeLabel = `Page ${currentPage} of ${totalPages || 1}`;
      } else if (scope === 'selected') {
        targetUsers = currentPageUsers.filter((u) => selectedUserIds.includes(u.id));
        filenamePrefix = 'Users-Selected';
        scopeLabel = `Selected Users (${targetUsers.length})`;
      } else {
        targetUsers = await onFetchAllMatchingUsers();
        filenamePrefix = activeFilterCount > 0 ? 'Users-Directory-Filtered' : 'Users-Directory-All';
        scopeLabel = activeFilterCount > 0 ? 'Filtered Dataset' : 'Full Directory';
      }

      if (!targetUsers || targetUsers.length === 0) {
        Alert.alert('Export Empty', 'No users found in the chosen export scope.');
        return;
      }

      if (exportFormat === 'csv') {
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
            dialogTitle: `Export ${targetUsers.length} Users (CSV)`,
            UTI: 'public.comma-separated-values-text',
          });
          notifyUserExported('csv', targetUsers.length);
          onClose();
        } else {
          notifyUserExported('csv', targetUsers.length);
          Alert.alert('Sharing Unavailable', 'Native sharing is not available on this device.');
        }
      } else {
        // PDF Export via expo-print and native sharing
        const html = generateReportHtml(targetUsers, scopeLabel);
        const { uri } = await Print.printToFileAsync({
          html,
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
        });

        notifyUserExported('pdf', targetUsers.length);
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Export ${targetUsers.length} Users (PDF)`,
            UTI: 'com.adobe.pdf',
          });
          onClose();
        } else {
          Alert.alert('PDF Generated', `Report saved to: ${uri}`);
        }
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
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor:
                          exportFormat === 'csv' ? '#0284c718' : '#e11d4818',
                      },
                    ]}
                  >
                    {exportFormat === 'csv' ? (
                      <FileSpreadsheet size={18} color="#0284c7" />
                    ) : (
                      <FileText size={18} color="#e11d48" />
                    )}
                  </View>
                  <View>
                    <Text style={[styles.title, { color: theme.colors.ink }]}>
                      Export Directory
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                      {exportFormat === 'csv'
                        ? 'Generate clean CSV spreadsheet'
                        : 'Generate landscape A4 PDF report'}
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

              {/* Format Selector Toggle (CSV / PDF) */}
              <View
                style={[
                  styles.formatRow,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderBottomColor: theme.colors.hairline,
                  },
                ]}
              >
                <View style={styles.formatToggleContainer}>
                  <TouchableOpacity
                    onPress={() => setExportFormat('csv')}
                    disabled={isExporting}
                    style={[
                      styles.formatToggleBtn,
                      exportFormat === 'csv' && {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <FileSpreadsheet
                      size={13}
                      color={exportFormat === 'csv' ? '#0284c7' : theme.colors.mute}
                    />
                    <Text
                      style={[
                        styles.formatToggleText,
                        {
                          color:
                            exportFormat === 'csv'
                              ? theme.colors.ink
                              : theme.colors.mute,
                          fontWeight: exportFormat === 'csv' ? '700' : '500',
                        },
                      ]}
                    >
                      CSV (.csv)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setExportFormat('pdf')}
                    disabled={isExporting}
                    style={[
                      styles.formatToggleBtn,
                      exportFormat === 'pdf' && {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <FileText
                      size={13}
                      color={exportFormat === 'pdf' ? '#e11d48' : theme.colors.mute}
                    />
                    <Text
                      style={[
                        styles.formatToggleText,
                        {
                          color:
                            exportFormat === 'pdf'
                              ? theme.colors.ink
                              : theme.colors.mute,
                          fontWeight: exportFormat === 'pdf' ? '700' : '500',
                        },
                      ]}
                    >
                      PDF (.pdf)
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.metaText, { color: theme.colors.mute }]}>
                  {exportFormat === 'csv' ? 'Excel / Sheets' : 'Print / Save'}
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
                  <View
                    style={[
                      styles.optionIconWrap,
                      {
                        backgroundColor:
                          exportFormat === 'csv' ? '#0284c715' : '#e11d4815',
                      },
                    ]}
                  >
                    {isExporting && exportScope === 'current' ? (
                      <ActivityIndicator
                        size="small"
                        color={exportFormat === 'csv' ? '#0284c7' : '#e11d48'}
                      />
                    ) : exportFormat === 'csv' ? (
                      <FileSpreadsheet size={16} color="#0284c7" />
                    ) : (
                      <FileText size={16} color="#e11d48" />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>
                      Current Page Only
                    </Text>
                    <Text style={[styles.optionDesc, { color: theme.colors.mute }]}>
                      Page {currentPage} of {totalPages || 1}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.countBadgeText, { color: theme.colors.ink }]}>
                      {currentPageUsers.length}{' '}
                      {currentPageUsers.length === 1 ? 'user' : 'users'}
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
                  <View
                    style={[
                      styles.optionIconWrap,
                      { backgroundColor: '#3b82f615' },
                    ]}
                  >
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
                      {activeFilterCount > 0
                        ? 'Filtered dataset across all pages'
                        : 'Entire directory across all pages'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.countBadgeText, { color: theme.colors.ink }]}>
                      {totalMatchingCount}{' '}
                      {totalMatchingCount === 1 ? 'user' : 'users'}
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
                  >
                    <View
                      style={[
                        styles.optionIconWrap,
                        { backgroundColor: '#f59e0b18' },
                      ]}
                    >
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
                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
                      ]}
                    >
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
  formatToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 2,
    borderRadius: radiusNumeric.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  formatToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm - 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  formatToggleText: {
    fontSize: 11,
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
