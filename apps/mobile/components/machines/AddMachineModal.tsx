import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Plus, Wrench, Check } from 'lucide-react-native';

export interface AddMachineModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machineToEdit?: any | null;
}

export const AddMachineModal: React.FC<AddMachineModalProps> = ({
  visible,
  onClose,
  onSuccess,
  machineToEdit,
}) => {
  const { theme } = useTheme();

  const [machineId, setMachineId] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [yearOfMfg, setYearOfMfg] = useState('');
  const [hourMeter, setHourMeter] = useState('0');
  const [status, setStatus] = useState<'available' | 'rented'>('available');
  const [healthStatus, setHealthStatus] = useState<'active' | 'under_maintenance' | 'breakdown'>('active');
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState<string | null>(null);

  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string }>>([]);
  const [operators, setOperators] = useState<Array<{ id: string; full_name: string }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (visible) {
      if (machineToEdit) {
        setMachineId(machineToEdit.machine_id || '');
        setModel(machineToEdit.model || '');
        setSerialNumber(machineToEdit.serial_number || '');
        setManufacturer(machineToEdit.manufacturer || '');
        setYearOfMfg(machineToEdit.year_of_mfg || '');
        setHourMeter(String(machineToEdit.hour_meter ?? 0));
        setStatus(machineToEdit.status || 'available');
        setHealthStatus(machineToEdit.health_status || 'active');
        setSupervisorId(machineToEdit.supervisor_id || null);
        setOperatorId(machineToEdit.operator_id || null);
      } else {
        setMachineId('');
        setModel('');
        setSerialNumber('');
        setManufacturer('');
        setYearOfMfg(new Date().getFullYear().toString());
        setHourMeter('0');
        setStatus('available');
        setHealthStatus('active');
        setSupervisorId(null);
        setOperatorId(null);
      }
      setErrorMessage('');
      fetchStaff();
    }
  }, [visible, machineToEdit]);

  const fetchStaff = async () => {
    try {
      const { data: sups } = await supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['supervisor', 'service_manager', 'admin', 'super_admin'])
        .eq('status', 'active');
      if (sups) setSupervisors(sups);

      const { data: ops } = await supabase
        .from('users')
        .select('id, full_name')
        .in('role', ['operator', 'service_engineer', 'mechanic'])
        .eq('status', 'active');
      if (ops) setOperators(ops);
    } catch (e) {
      console.warn('Error fetching staff in modal:', e);
    }
  };

  const handleSave = async () => {
    setErrorMessage('');
    if (!model.trim()) {
      setErrorMessage('Machine Model is required (e.g. 50B-9 or 8FG30).');
      return;
    }
    if (!serialNumber.trim()) {
      setErrorMessage('Serial Number is required.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        model: model.trim(),
        serial_number: serialNumber.trim(),
        manufacturer: manufacturer.trim() || null,
        year_of_mfg: yearOfMfg.trim() || null,
        hour_meter: parseFloat(hourMeter) || 0,
        status,
        health_status: healthStatus,
        supervisor_id: supervisorId || null,
        operator_id: operatorId || null,
      };

      if (machineId.trim()) {
        payload.machine_id = machineId.trim();
      }

      if (machineToEdit?.id) {
        const { error } = await supabase
          .from('machines')
          .update(payload)
          .eq('id', machineToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save machine. Please check required fields.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.canvas }]}>
                <Wrench size={18} color={theme.colors.link} />
              </View>
              <Text style={[styles.title, { color: theme.colors.ink }]}>
                {machineToEdit ? 'Edit Machine' : 'Add New Machine'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {errorMessage ? (
            <View style={[styles.alertContainer, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={[styles.alertText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Input
              label="Model Name *"
              placeholder="e.g. 50B-9 or 8FG30"
              value={model}
              onChangeText={setModel}
            />

            <Input
              label="Serial Number *"
              placeholder="e.g. HHKHB303EF0000877"
              value={serialNumber}
              onChangeText={setSerialNumber}
            />

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Manufacturer"
                  placeholder="e.g. Hyundai / Toyota"
                  value={manufacturer}
                  onChangeText={setManufacturer}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Year of Mfg"
                  placeholder="2025"
                  value={yearOfMfg}
                  onChangeText={setYearOfMfg}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Input
              label="Hour Meter Reading (HMR hrs)"
              placeholder="0"
              value={hourMeter}
              onChangeText={setHourMeter}
              keyboardType="numeric"
            />

            {/* Status Pills */}
            <View style={styles.sectionGroup}>
              <Text style={[styles.groupLabel, { color: theme.colors.ink }]}>Rental Status</Text>
              <View style={styles.pillRow}>
                {(['available', 'rented'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[
                      styles.pillOption,
                      { borderColor: status === s ? theme.colors.link : theme.colors.hairline },
                      status === s && { backgroundColor: theme.colors.link + '15' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: status === s ? theme.colors.link : theme.colors.body },
                        status === s && { fontWeight: '700' },
                      ]}
                    >
                      {s === 'available' ? 'Available' : 'Rented'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Health Status Pills */}
            <View style={styles.sectionGroup}>
              <Text style={[styles.groupLabel, { color: theme.colors.ink }]}>Equipment Health</Text>
              <View style={styles.pillRow}>
                {(['active', 'under_maintenance', 'breakdown'] as const).map((h) => (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setHealthStatus(h)}
                    style={[
                      styles.pillOption,
                      { borderColor: healthStatus === h ? theme.colors.link : theme.colors.hairline },
                      healthStatus === h && { backgroundColor: theme.colors.link + '15' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: healthStatus === h ? theme.colors.link : theme.colors.body },
                        healthStatus === h && { fontWeight: '700' },
                      ]}
                    >
                      {h === 'active' ? 'Active' : h === 'under_maintenance' ? 'Maintenance' : 'Breakdown'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" />
            <Button
              label={machineToEdit ? 'Save Changes' : 'Create Machine'}
              onPress={handleSave}
              isLoading={isLoading}
              variant="primary"
              size="md"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  alertContainer: {
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  alertText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionGroup: {
    marginBottom: spacingNumeric.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: spacingNumeric.lg,
    borderTopWidth: 1,
  },
});
