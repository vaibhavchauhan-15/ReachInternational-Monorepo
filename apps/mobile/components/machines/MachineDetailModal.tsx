import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Badge, Button, useTheme } from '../ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Truck } from 'lucide-react-native';

export interface MachineDetailModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  machineData?: {
    id: string;
    machine_id: string;
    model: string;
    serial_number: string;
    year_of_mfg?: string;
    manufacturer?: string;
    status: string;
    health_status: string;
    hour_meter: number;
    customer_name?: string;
    client_id?: string;
    client?: {
      id: string;
      code?: string;
      company_name: string;
      contact_person?: string;
      phone?: string;
      address?: string;
      city?: string;
      district?: string;
      state?: string;
      pincode?: string;
      gstin?: string;
      pan_number?: string;
    } | null;
    supervisor_name?: string;
    operator_name?: string;
  };
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  visible,
  onClose,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  machineData = {
    id: 'mch-001',
    machine_id: 'RI-MC-0001',
    model: '8FG30',
    serial_number: 'TY8FG-99214',
    year_of_mfg: '2025',
    status: 'available',
    health_status: 'active',
    hour_meter: 1420,
    customer_name: 'Saint Gobain',
    supervisor_name: 'Rajesh Kumar',
    operator_name: 'Vikram Singh',
  },
}) => {
  const { theme } = useTheme();

  // Title: Model - Serial No
  const displayTitle =
    [machineData.model, machineData.serial_number].filter(Boolean).join(' - ') ||
    machineData.machine_id ||
    'Machine Details';

  const client = machineData.client;
  const clientCompanyName = client?.company_name || machineData.customer_name;
  const clientLocation = [client?.city, client?.district, client?.state].filter(Boolean).join(', ');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.canvas }]}>
                <Truck size={20} color={theme.colors.link} />
              </View>
              <View style={{ flex: 1, paddingRight: spacingNumeric.sm }}>
                <Text style={[styles.title, { color: theme.colors.ink }]} numberOfLines={1}>
                  {displayTitle}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  ID: {machineData.machine_id} {machineData.manufacturer ? `• ${machineData.manufacturer}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Status Chips */}
            <View style={styles.statusRow}>
              <Badge status={machineData.health_status} />
              <Badge status={machineData.status} />
            </View>

            {/* Specifications Card */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Master Specifications</Text>
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Machine ID</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.machine_id}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Model</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.model || '—'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Serial No</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.serial_number || '—'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Year of Mfg (YUM)</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.year_of_mfg || '—'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Manufacturer</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.manufacturer || '—'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Hour Meter (HMR)</Text>
                  <Text style={[styles.val, { color: theme.colors.link }]}>{machineData.hour_meter} hrs</Text>
                </View>
              </View>
            </View>

            {/* Linked Client Details (CRM) Card */}
            {clientCompanyName ? (
              <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Assigned Client Details</Text>
                </View>

                <View style={styles.grid}>
                  <View style={[styles.gridItem, { width: '100%' }]}>
                    <Text style={[styles.lbl, { color: theme.colors.mute }]}>Client Name</Text>
                    <Text style={[styles.val, { color: theme.colors.ink }]}>
                      {clientCompanyName} {client?.code ? `(${client.code})` : ''}
                    </Text>
                  </View>
                  {client?.contact_person && (
                    <View style={styles.gridItem}>
                      <Text style={[styles.lbl, { color: theme.colors.mute }]}>Contact Person</Text>
                      <Text style={[styles.val, { color: theme.colors.ink }]}>{client.contact_person}</Text>
                    </View>
                  )}
                  {client?.phone && (
                    <View style={styles.gridItem}>
                      <Text style={[styles.lbl, { color: theme.colors.mute }]}>Phone</Text>
                      <Text style={[styles.val, { color: theme.colors.link }]}>{client.phone}</Text>
                    </View>
                  )}
                  {clientLocation ? (
                    <View style={styles.gridItem}>
                      <Text style={[styles.lbl, { color: theme.colors.mute }]}>Location</Text>
                      <Text style={[styles.val, { color: theme.colors.ink }]}>{clientLocation}</Text>
                    </View>
                  ) : null}
                  {client?.gstin ? (
                    <View style={styles.gridItem}>
                      <Text style={[styles.lbl, { color: theme.colors.mute }]}>GSTIN</Text>
                      <Text style={[styles.val, { color: theme.colors.ink }]}>{client.gstin}</Text>
                    </View>
                  ) : null}
                  {client?.address && (
                    <View style={[styles.gridItem, { width: '100%' }]}>
                      <Text style={[styles.lbl, { color: theme.colors.mute }]}>Site Location</Text>
                      <Text style={[styles.val, { color: theme.colors.ink }]}>
                        {client.address} {client.pincode ? `- ${client.pincode}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {/* Personnel Assignment Card */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Assigned Personnel</Text>
              </View>

              <View style={styles.grid}>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Supervisor</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.supervisor_name || 'Unassigned'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={[styles.lbl, { color: theme.colors.mute }]}>Operator</Text>
                  <Text style={[styles.val, { color: theme.colors.ink }]}>{machineData.operator_name || 'Unassigned'}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Close" onPress={onClose} variant="outline" size="md" />
            <View style={styles.footerRight}>
              {canDelete && onDelete && (
                <Button label="Delete" onPress={onDelete} variant="danger" size="md" />
              )}
              {canEdit && onEdit && (
                <Button label="Edit Machine" onPress={onEdit} variant="primary" size="md" />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '85%',
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
    gap: spacingNumeric.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radiusNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
  },
  closeBtn: {
    padding: spacingNumeric.xs,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  sectionCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.md,
    marginTop: spacingNumeric.xs,
  },
  gridItem: {
    width: '45%',
    gap: 2,
  },
  lbl: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  val: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  footer: {
    padding: spacingNumeric.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
});
