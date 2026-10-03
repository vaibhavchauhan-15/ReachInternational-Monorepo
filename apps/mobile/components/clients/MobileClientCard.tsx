import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Badge, useTheme, HighlightText } from '../ui';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Edit2,
  Trash2,
  Copy,
  Check,
  Wrench,
  MapPin,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export interface MobileClientCardProps {
  client: {
    id: string;
    client_id?: string;
    code: string;
    company_name: string;
    contact_person?: string;
    phone?: string;
    gstin?: string;
    pan_number?: string;
    street?: string;
    address?: string;
    city: string;
    district?: string;
    state: string;
    pincode?: string;
    is_billing_address_different?: boolean;
    billing_address?: string;
    billing_city?: string;
    billing_district?: string;
    billing_state?: string;
    billing_pincode?: string;
    /** Monthly maintenance allowance in minutes per machine. 0 = no allowance. */
    maintenance_allowance_minutes?: number;
    status: 'active' | 'inactive';
    deleted_at?: string | null;
    client_sites?: { id: string; site_code: string; site_name: string; city: string; status: string }[];
    site_count?: number;
  };
  canManageClients?: boolean;
  searchTerm?: string;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onDelete: (client: any) => void;
  onAddSite?: (client: any) => void;
}

export const MobileClientCard: React.FC<MobileClientCardProps> = ({
  client,
  canManageClients = true,
  searchTerm,
  onViewDetails,
  onEdit,
  onDelete,
  onAddSite,
}: MobileClientCardProps) => {
  const { theme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const displayId = client.client_id || client.code;

  const handleCopyCode = async () => {
    if (!displayId) return;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(displayId);
      }
    } catch {
      // Graceful fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isSoftDeleted = Boolean(client.deleted_at);
  const isActive = client.status === 'active' && !isSoftDeleted;
  const accentBorderColor = isSoftDeleted
    ? '#ef4444'
    : isActive
    ? '#10b981'
    : '#f59e0b';

  // Format maintenance allowance for display
  const allowanceMin = client.maintenance_allowance_minutes ?? 0;
  const allowanceH = Math.floor(allowanceMin / 60);
  const allowanceM = allowanceMin % 60;
  const allowanceLabel = allowanceMin > 0
    ? `${allowanceH > 0 ? `${allowanceH}h` : ''}${allowanceH > 0 && allowanceM > 0 ? ' ' : ''}${allowanceM > 0 ? `${allowanceM}m` : ''}`
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onViewDetails(client)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: accentBorderColor,
        },
      ]}
    >
      {/* Top Header Row: Client ID Copy Pill + Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={handleCopyCode}
            activeOpacity={0.7}
            style={[
              styles.codeBtn,
              {
                backgroundColor: theme.colors.canvas,
                borderColor: theme.colors.hairline,
              },
            ]}
            accessibilityLabel={`Copy client ID ${displayId}`}
          >
            <HighlightText
              text={displayId}
              query={searchTerm}
              style={[styles.codeText, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
            />
            {copied ? (
              <Check size={12} color={theme.colors.success} strokeWidth={2.5} />
            ) : (
              <Copy size={12} color={theme.colors.mute} />
            )}
          </TouchableOpacity>
        </View>

        <Badge
          status={isSoftDeleted ? 'inactive' : client.status}
          customLabel={isSoftDeleted ? 'SOFT DELETED' : client.status.toUpperCase()}
        />
      </View>

      {/* Company Name Row */}
      <TouchableOpacity
        onPress={() => onViewDetails(client)}
        activeOpacity={0.7}
        style={styles.companyRow}
      >
        <HighlightText
          text={client.company_name}
          query={searchTerm}
          style={[styles.companyName, { color: theme.colors.ink }]}
          matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
          numberOfLines={2}
        />
      </TouchableOpacity>

      {/* Tax Badges (GSTIN / PAN) */}
      {(client.gstin || client.pan_number) && (
        <View style={styles.tagRow}>
          {client.gstin && (
            <View style={[styles.taxBadge, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff', borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : '#d8b4fe' }]}>
              <Text style={[styles.taxBadgeText, { color: isDark ? '#c084fc' : '#7e22ce' }]}>
                GST: {client.gstin}
              </Text>
            </View>
          )}
          {client.pan_number && (
            <View style={[styles.taxBadge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe', borderColor: isDark ? 'rgba(14, 165, 233, 0.3)' : '#bae6fd' }]}>
              <Text style={[styles.taxBadgeText, { color: isDark ? '#38bdf8' : '#0369a1' }]}>
                PAN: {client.pan_number}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Inset Specs Well (2x2 Grid) */}
      <View
        style={[
          styles.specsWell,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.specGridRow}>
          <View style={styles.specCol}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>CONTACT PERSON</Text>
            <HighlightText
              text={client.contact_person || '—'}
              query={searchTerm}
              style={[styles.specValue, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
              numberOfLines={1}
            />
          </View>

          <View style={styles.specCol}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>PHONE NUMBER</Text>
            <Text
              style={[styles.specValue, styles.monoText, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {client.phone || '—'}
            </Text>
          </View>
        </View>

        <View style={[styles.specDivider, { backgroundColor: theme.colors.hairline }]} />

        <View style={styles.specGridRow}>
          <View style={styles.specCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.specLabel, { color: theme.colors.mute }]}>SITE LOCATION</Text>
              {Boolean(client.site_count && client.site_count > 1) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(14, 165, 233, 0.3)' : '#bae6fd' }}>
                  <MapPin size={9} color={isDark ? '#38bdf8' : '#0284c7'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#38bdf8' : '#0284c7' }}>
                    {client.site_count} Sites
                  </Text>
                </View>
              )}
            </View>
            <HighlightText
              text={client.city || client.district || client.address || '—'}
              query={searchTerm}
              style={[styles.specValue, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
              numberOfLines={1}
            />
          </View>
        </View>

        {/* Monthly Maintenance Allowance row */}
        <View style={[styles.specDivider, { backgroundColor: theme.colors.hairline }]} />
        <View style={styles.specGridRow}>
          <View style={[styles.specCol, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
            <Wrench size={13} color={allowanceLabel ? (isDark ? '#fbbf24' : '#d97706') : '#ef4444'} />
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>MAINT. ALLOWANCE</Text>
          </View>
          {allowanceLabel ? (
            <View style={[styles.allowanceBadge, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7', borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d' }]}>
              <Text style={[styles.taxBadgeText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
                {allowanceLabel}
              </Text>
            </View>
          ) : (
            <View style={[styles.allowanceBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fff1f2', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecdd3' }]}>
              <Text style={[styles.taxBadgeText, { color: '#e11d48' }]}>
                Not Allowed
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Touch Action Buttons Row (min 44px targets) */}
      {canManageClients && (
        <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.iconActionBtn,
              { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
            ]}
            onPress={() => onEdit(client)}
            activeOpacity={0.7}
            accessibilityLabel={`Edit ${client.company_name}`}
          >
            <Edit2 size={14} color={theme.colors.ink} />
            <Text style={[styles.actionBtnText, { color: theme.colors.ink }]}>Edit</Text>
          </TouchableOpacity>

          {onAddSite && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.iconActionBtn,
                { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
              ]}
              onPress={() => onAddSite(client)}
              activeOpacity={0.7}
              accessibilityLabel={`Add Site to ${client.company_name}`}
            >
              <MapPin size={14} color="#10b981" />
              <Text style={[styles.actionBtnText, { color: theme.colors.ink }]}>Add Site</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.iconActionBtn,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fff1f2' },
            ]}
            onPress={() => onDelete(client)}
            activeOpacity={0.7}
            accessibilityLabel={`Delete ${client.company_name}`}
          >
            <Trash2 size={14} color="#e11d48" />
            <Text style={[styles.actionBtnText, { color: '#e11d48' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacingNumeric.sm + 2,
    gap: spacingNumeric.xs + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  codeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  companyRow: {
    paddingVertical: 1,
  },
  companyName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  taxBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  taxBadgeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  specsWell: {
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 8,
    marginTop: 2,
  },
  specGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  specCol: {
    flex: 1,
    gap: 2,
  },
  specLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specDivider: {
    height: 1,
    width: '100%',
  },
  allowanceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 2,
  },
  actionBtn: {
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  iconActionBtn: {
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
