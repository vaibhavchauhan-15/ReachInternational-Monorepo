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
  Building2,
  Edit2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export interface MobileClientCardProps {
  client: {
    id: string;
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
    status: 'active' | 'inactive';
    deleted_at?: string | null;
  };
  canManageClients?: boolean;
  searchTerm?: string;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onDelete: (client: any) => void;
}

export const MobileClientCard: React.FC<MobileClientCardProps> = ({
  client,
  canManageClients = true,
  searchTerm,
  onViewDetails,
  onEdit,
  onDelete,
}) => {
  const { theme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!client.code) return;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(client.code);
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

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderLeftColor: accentBorderColor,
        },
      ]}
    >
      {/* Top Header Row: Code Copy Pill + Status Badge */}
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
            accessibilityLabel={`Copy client code ${client.code}`}
          >
            <HighlightText
              text={client.code}
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
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>SITE LOCATION</Text>
            <HighlightText
              text={client.city || client.district || '—'}
              query={searchTerm}
              style={[styles.specValue, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#3291ff' : '#0070f3', fontWeight: '700' }}
              numberOfLines={1}
            />
          </View>

          <View style={styles.specCol}>
            <Text style={[styles.specLabel, { color: theme.colors.mute }]}>REGION / STATE</Text>
            <Text
              style={[styles.specValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {client.state || '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Touch Action Buttons Row (min 44px targets) */}
      <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.detailsBtn,
            { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.12)' : '#f0f9ff' },
          ]}
          onPress={() => onViewDetails(client)}
          activeOpacity={0.7}
        >
          <Building2 size={14} color="#0284c7" />
          <Text style={[styles.actionBtnText, { color: '#0284c7', fontWeight: '700' }]}>
            View Details
          </Text>
        </TouchableOpacity>

        {canManageClients && (
          <>
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
          </>
        )}
      </View>
    </View>
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
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  companyRow: {
    paddingVertical: 1,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
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
    fontSize: 10,
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specDivider: {
    height: 1,
    width: '100%',
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
  detailsBtn: {
    flex: 1,
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
