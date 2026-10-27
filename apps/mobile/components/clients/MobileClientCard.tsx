import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme, HighlightText, Text } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  FileText,
  User,
  Phone,
  MapPin,
  Clock,
  UserPlus,
  Settings,
  MoreVertical,
} from '../ui/icon';
import { haptics } from '../../lib/haptics';

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
  onAssignSupervisor?: (client: any) => void;
  onAssignMachine?: (client: any) => void;
  onOpenActions?: (client: any) => void;
}

export const MobileClientCard: React.FC<MobileClientCardProps> = ({
  client,
  canManageClients = true,
  searchTerm,
  onViewDetails,
  onEdit,
  onDelete,
  onAddSite,
  onAssignSupervisor,
  onAssignMachine,
  onOpenActions,
}: MobileClientCardProps) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isUltraNarrow = width < 340;

  const displayId = client.client_id || client.code;

  const isSoftDeleted = Boolean(client.deleted_at);
  const isActive = client.status === 'active' && !isSoftDeleted;

  // Format maintenance allowance
  const allowanceMin = client.maintenance_allowance_minutes ?? 0;
  const allowanceH = Math.floor(allowanceMin / 60);
  const allowanceM = allowanceMin % 60;
  const allowanceLabel =
    allowanceMin > 0
      ? `${allowanceH > 0 ? `${allowanceH}h` : ''}${allowanceH > 0 && allowanceM > 0 ? ' ' : ''}${allowanceM > 0 ? `${allowanceM}m` : ''}`
      : '0h';

  // Format site count & summary string
  const sitesList = Array.isArray(client.client_sites) ? client.client_sites : [];
  const siteCount = client.site_count ?? sitesList.length;
  const siteNames = sitesList
    .map((s) => s.site_name || s.city)
    .filter(Boolean)
    .slice(0, 2);
  const sitesSummary =
    siteNames.length > 0
      ? siteNames.join(' · ')
      : client.city || client.state || '—';

  const handleCardPress = () => {
    haptics.select();
    onViewDetails(client);
  };

  const handleAssignSupervisorPress = (e?: any) => {
    e?.stopPropagation?.();
    haptics.select();
    if (onAssignSupervisor) {
      onAssignSupervisor(client);
    } else {
      onViewDetails(client);
    }
  };

  const handleAssignMachinePress = (e?: any) => {
    e?.stopPropagation?.();
    haptics.select();
    if (onAssignMachine) {
      onAssignMachine(client);
    } else {
      onViewDetails(client);
    }
  };

  const handleThreeDotPress = (e?: any) => {
    e?.stopPropagation?.();
    haptics.select();
    if (onOpenActions) {
      onOpenActions(client);
    } else {
      onEdit(client);
    }
  };

  return (
    <Pressable
      variant="card"
      haptic={false}
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={`Client ${client.company_name}, ID ${displayId}`}
      style={(state) => [
        styles.card,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        state.pressed && {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : 'rgba(0, 0, 0, 0.02)',
        },
        Platform.OS === 'web' && ({
          cursor: 'pointer',
          transition: 'background-color 150ms ease, opacity 150ms ease, transform 150ms ease',
        } as any),
      ]}
    >
      {/* 1. Header: Client Name, ID and Status on the same compact header area */}
      <View style={styles.headerArea}>
        <View style={styles.headerLeft}>
          <HighlightText
            text={client.company_name}
            query={searchTerm}
            variant="subheading"
            weight="bold"
            style={{ color: theme.colors.ink }}
            matchStyle={{ color: isDark ? '#38bdf8' : '#0284c7' }}
            numberOfLines={1}
          />
          {Boolean(displayId) && (
            <Text
              variant="caption"
              weight="medium"
              style={{ color: theme.colors.mute }}
              numberOfLines={1}
            >
              {displayId}
            </Text>
          )}
        </View>

        {/* Compact Status Pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: isSoftDeleted
                ? (isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)')
                : isActive
                ? (isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)')
                : (isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)'),
              borderColor: isSoftDeleted
                ? (isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)')
                : isActive
                ? (isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)')
                : (isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'),
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isSoftDeleted
                  ? '#ef4444'
                  : isActive
                  ? '#10b981'
                  : '#f59e0b',
              },
            ]}
          />
          <Text
            variant="micro"
            weight="semibold"
            style={{
              color: isSoftDeleted
                ? '#ef4444'
                : isActive
                ? '#10b981'
                : '#f59e0b',
            }}
          >
            {isSoftDeleted ? 'Soft Deleted' : isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* 2. Details: 2-Column Grid (12-16dp padding, 12-16dp vertical gaps, zero oversized dividers) */}
      <View
        style={[
          styles.detailsWell,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.02)'
              : 'rgba(0, 0, 0, 0.015)',
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Row 1: GST | PAN */}
        <View style={[styles.gridRow, isUltraNarrow && styles.gridRowStacked]}>
          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <FileText size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                GST
              </Text>
            </View>
            <Text
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {client.gstin || '—'}
            </Text>
          </View>

          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <FileText size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                PAN
              </Text>
            </View>
            <Text
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {client.pan_number || '—'}
            </Text>
          </View>
        </View>

        {/* Row 2: Contact Person | Contact Number */}
        <View style={[styles.gridRow, isUltraNarrow && styles.gridRowStacked]}>
          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <User size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                Contact Person
              </Text>
            </View>
            <HighlightText
              text={client.contact_person || '—'}
              query={searchTerm}
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              matchStyle={{ color: isDark ? '#38bdf8' : '#0284c7' }}
              numberOfLines={1}
            />
          </View>

          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <Phone size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                Contact Number
              </Text>
            </View>
            <Text
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {client.phone || '—'}
            </Text>
          </View>
        </View>

        {/* Row 3: Sites | Maintenance Allowance */}
        <View style={[styles.gridRow, isUltraNarrow && styles.gridRowStacked]}>
          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <MapPin size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                Sites{siteCount > 0 ? ` · ${siteCount}` : ''}
              </Text>
            </View>
            <Text
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {sitesSummary}
            </Text>
          </View>

          <View style={styles.gridCol}>
            <View style={styles.fieldLabelRow}>
              <Clock size={13} color={theme.colors.mute} />
              <Text variant="micro" weight="medium" style={{ color: theme.colors.mute }}>
                Maintenance allowance
              </Text>
            </View>
            <Text
              variant="caption"
              weight="semibold"
              style={[styles.fieldValue, { color: theme.colors.ink }]}
              numberOfLines={1}
            >
              {allowanceLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Actions: Keep Assign Supervisor and Assign Machine side by side, with 3-dot menu in compact square */}
      <View style={styles.actionsRow}>
        {/* Assign Supervisor */}
        <Pressable
          variant="buttonOutline"
          hitSlopToMin48
          onPress={handleAssignSupervisorPress}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
          accessibilityLabel={`Assign supervisor for ${client.company_name}`}
        >
          <UserPlus size={15} color={isDark ? '#38bdf8' : '#0284c7'} />
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: theme.colors.ink }}
            numberOfLines={1}
          >
            Assign Supervisor
          </Text>
        </Pressable>

        {/* Assign Machine */}
        <Pressable
          variant="buttonOutline"
          hitSlopToMin48
          onPress={handleAssignMachinePress}
          style={[
            styles.actionButton,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
          accessibilityLabel={`Assign machine for ${client.company_name}`}
        >
          <Settings size={15} color={isDark ? '#38bdf8' : '#0284c7'} />
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: theme.colors.ink }}
            numberOfLines={1}
          >
            Assign Machine
          </Text>
        </Pressable>

        {/* Three-Dot Menu (Compact Square Button) */}
        <Pressable
          variant="buttonOutline"
          hitSlopToMin48
          onPress={handleThreeDotPress}
          style={[
            styles.threeDotButton,
            {
              backgroundColor: theme.colors.canvas,
              borderColor: theme.colors.hairline,
            },
          ]}
          accessibilityLabel={`More actions for ${client.company_name}`}
        >
          <MoreVertical size={16} color={theme.colors.ink} />
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  headerArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detailsWell: {
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridRowStacked: {
    flexDirection: 'column',
    gap: 8,
  },
  gridCol: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fieldValue: {
    paddingLeft: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  threeDotButton: {
    width: 44,
    minWidth: 44,
    height: 44,
    minHeight: 44,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
