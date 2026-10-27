/**
 * ReachInternational Mobile — Client Contextual Actions Modal
 * Clean, touch-ergonomic action sheet for 3-dot contextual menu on client cards.
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AppModal, Text, useTheme } from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';
import {
  Building2,
  Edit2,
  MapPin,
  Copy,
  Trash2,
  UserPlus,
  Settings,
  X,
} from '../ui/icon';

export interface ClientActionsModalProps {
  visible: boolean;
  client: any | null;
  onClose: () => void;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onAddSite?: (client: any) => void;
  onAssignSupervisor?: (client: any) => void;
  onAssignMachine?: (client: any) => void;
  onCopyId: (client: any) => void;
  onDelete: (client: any) => void;
  canManageClients?: boolean;
}

export const ClientActionsModal: React.FC<ClientActionsModalProps> = ({
  visible,
  client,
  onClose,
  onViewDetails,
  onEdit,
  onAddSite,
  onAssignSupervisor,
  onAssignMachine,
  onCopyId,
  onDelete,
  canManageClients = true,
}) => {
  const { theme, isDark } = useTheme();

  if (!client) return null;

  const displayId = client.client_id || client.code;

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
    >
      <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
        <View style={styles.headerInfoCol}>
          <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }} numberOfLines={1}>
            {client.company_name}
          </Text>
          <Text variant="caption" style={{ color: theme.colors.mute }} numberOfLines={1}>
            {displayId ? `Client Account • ${displayId}` : 'Client Account'}
          </Text>
        </View>
        <Pressable
          variant="buttonGhost"
          hitSlopToMin48
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Close actions"
        >
          <X size={18} color={theme.colors.mute} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Action 1: View Details */}
        <Pressable
          variant="card"
          hitSlopToMin48
          onPress={() => {
            haptics.select();
            onClose();
            onViewDetails(client);
          }}
          style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
          accessibilityLabel={`View full details for ${client.company_name}`}
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe' },
            ]}
          >
            <Building2 size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
          </View>
          <View style={styles.actionTextCol}>
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
              View Client Profile & Fleet
            </Text>
            <Text variant="micro" style={{ color: theme.colors.mute }}>
              Inspect machinery, operational sites, shift codes, and logs
            </Text>
          </View>
        </Pressable>

        {/* Action 2: Assign Supervisor */}
        {onAssignSupervisor && canManageClients && (
          <Pressable
            variant="card"
            hitSlopToMin48
            onPress={() => {
              haptics.select();
              onClose();
              onAssignSupervisor(client);
            }}
            style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
            accessibilityLabel={`Assign supervisor to ${client.company_name}`}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' },
              ]}
            >
              <UserPlus size={16} color="#10b981" />
            </View>
            <View style={styles.actionTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                Assign Supervisor
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                Allocate site supervisors to coordinate operations
              </Text>
            </View>
          </Pressable>
        )}

        {/* Action 3: Assign Machine */}
        {onAssignMachine && canManageClients && (
          <Pressable
            variant="card"
            hitSlopToMin48
            onPress={() => {
              haptics.select();
              onClose();
              onAssignMachine(client);
            }}
            style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
            accessibilityLabel={`Assign machine to ${client.company_name}`}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' },
              ]}
            >
              <Settings size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <View style={styles.actionTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                Assign Machine
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                Deploy active fleet machinery to client sites
              </Text>
            </View>
          </Pressable>
        )}

        {/* Action 4: Edit Client */}
        {canManageClients && (
          <Pressable
            variant="card"
            hitSlopToMin48
            onPress={() => {
              haptics.select();
              onClose();
              onEdit(client);
            }}
            style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
            accessibilityLabel={`Edit details for ${client.company_name}`}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' },
              ]}
            >
              <Edit2 size={16} color={isDark ? '#fbbf24' : '#d97706'} />
            </View>
            <View style={styles.actionTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                Edit Client Information
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                Update address, contacts, tax numbers, and allowance
              </Text>
            </View>
          </Pressable>
        )}

        {/* Action 5: Add Site */}
        {canManageClients && onAddSite && (
          <Pressable
            variant="card"
            hitSlopToMin48
            onPress={() => {
              haptics.select();
              onClose();
              onAddSite(client);
            }}
            style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
            accessibilityLabel={`Add site for ${client.company_name}`}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' },
              ]}
            >
              <MapPin size={16} color="#10b981" />
            </View>
            <View style={styles.actionTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
                Add Operational Site
              </Text>
              <Text variant="micro" style={{ color: theme.colors.mute }}>
                Register a new deployment branch, yard, or project site
              </Text>
            </View>
          </Pressable>
        )}

        {/* Action 6: Copy Client ID */}
        <Pressable
          variant="card"
          hitSlopToMin48
          onPress={() => {
            haptics.tap();
            onClose();
            onCopyId(client);
          }}
          style={[styles.actionRow, { borderColor: theme.colors.hairline }]}
          accessibilityLabel="Copy client identifier"
        >
          <View
            style={[
              styles.iconBox,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f3f4f6' },
            ]}
          >
            <Copy size={16} color={theme.colors.mute} />
          </View>
          <View style={styles.actionTextCol}>
            <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
              Copy Client Identifier
            </Text>
            <Text variant="micro" style={{ color: theme.colors.mute }}>
              Copy {displayId} to clipboard
            </Text>
          </View>
        </Pressable>

        {/* Action 7: Soft Delete / Archive */}
        {canManageClients && (
          <Pressable
            variant="card"
            hitSlopToMin48
            onPress={() => {
              haptics.warning();
              onClose();
              onDelete(client);
            }}
            style={[
              styles.actionRow,
              {
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
              },
            ]}
            accessibilityLabel={`Archive ${client.company_name}`}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' },
              ]}
            >
              <Trash2 size={16} color="#ef4444" />
            </View>
            <View style={styles.actionTextCol}>
              <Text variant="caption" weight="semibold" style={{ color: '#ef4444' }}>
                Archive Client Account
              </Text>
              <Text variant="micro" style={{ color: isDark ? '#fca5a5' : '#b91c1c' }}>
                Soft delete account while keeping historical logs intact
              </Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerInfoCol: {
    flex: 1,
    gap: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radiusNumeric.sm,
  },
  contentContainer: {
    paddingVertical: spacingNumeric.xs,
    gap: spacingNumeric.xs + 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 48,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    gap: 2,
  },
});
