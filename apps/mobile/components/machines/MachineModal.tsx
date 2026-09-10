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
  ActivityIndicator,
} from 'react-native';
import { Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { X, ChevronDown, AlertCircle, Check } from 'lucide-react-native';
import { MultiUserSelectModal, type SelectableUser } from './MultiUserSelectModal';
import { ClientSelectModal, type SelectableClient } from './ClientSelectModal';
import { CustomFilterSelectorModal, type FilterOption } from './CustomFilterSelectorModal';

export interface MachineModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machineToEdit?: any | null;
  userRole?: string | null;
}

const HEALTH_OPTIONS: FilterOption[] = [
  { id: 'active', label: 'Active', dotColor: '#10b981' },
  { id: 'spare', label: 'Spare', dotColor: '#06b6d4' },
  { id: 'under_maintenance', label: 'Under Maintenance', dotColor: '#f59e0b' },
  { id: 'breakdown', label: 'Breakdown', dotColor: '#ef4444' },
];

const RENTAL_OPTIONS: FilterOption[] = [
  { id: 'available', label: 'Available', dotColor: '#10b981' },
  { id: 'rented', label: 'Rented', dotColor: '#0ea5e9' },
];

export const MachineModal: React.FC<MachineModalProps> = ({
  visible,
  onClose,
  onSuccess,
  machineToEdit,
  userRole,
}) => {
  const { theme } = useTheme();

  const normalizedRole = (userRole || '').toLowerCase();
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const isEdit = Boolean(machineToEdit);

  // Form state
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [yearOfMfg, setYearOfMfg] = useState('');
  const [hourMeter, setHourMeter] = useState('0');
  const [healthStatus, setHealthStatus] = useState<string>('active');
  const [rentalStatus, setRentalStatus] = useState<string>('available');

  // Personnel assignments
  const [supervisorIds, setSupervisorIds] = useState<string[]>([]);
  const [operatorIds, setOperatorIds] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<SelectableClient | null>(null);

  // Available data lists from Supabase
  const [supervisorsList, setSupervisorsList] = useState<SelectableUser[]>([]);
  const [operatorsList, setOperatorsList] = useState<SelectableUser[]>([]);
  const [clientsList, setClientsList] = useState<SelectableClient[]>([]);

  // Sub-modals
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [rentalModalOpen, setRentalModalOpen] = useState(false);

  // Errors & loading
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (machineToEdit) {
        setModel(machineToEdit.model || '');
        setSerialNumber(machineToEdit.serial_number || '');
        setManufacturer(machineToEdit.manufacturer || '');
        setYearOfMfg(machineToEdit.year_of_mfg || '');
        setHourMeter(String(machineToEdit.hour_meter ?? 0));
        setHealthStatus(machineToEdit.health_status || 'active');
        setRentalStatus(machineToEdit.status || 'available');

        // Extract supervisor IDs
        const sups = Array.isArray(machineToEdit.supervisor_ids) && machineToEdit.supervisor_ids.length > 0
          ? machineToEdit.supervisor_ids
          : machineToEdit.current_supervisor_id || machineToEdit.supervisor_id
          ? [machineToEdit.current_supervisor_id || machineToEdit.supervisor_id]
          : [];
        setSupervisorIds(sups);

        // Extract operator IDs
        const ops = Array.isArray(machineToEdit.operator_ids) && machineToEdit.operator_ids.length > 0
          ? machineToEdit.operator_ids
          : machineToEdit.current_operator_id || machineToEdit.operator_id
          ? [machineToEdit.current_operator_id || machineToEdit.operator_id]
          : [];
        setOperatorIds(ops);

        // Extract client
        if (machineToEdit.client) {
          setSelectedClient(machineToEdit.client);
        } else if (machineToEdit.client_id) {
          setSelectedClient({
            id: machineToEdit.client_id,
            company_name: machineToEdit.customer_name || 'Assigned Client',
          });
        } else {
          setSelectedClient(null);
        }
      } else {
        setModel('');
        setSerialNumber('');
        setManufacturer('');
        setYearOfMfg(new Date().getFullYear().toString());
        setHourMeter('0');
        setHealthStatus('active');
        setRentalStatus('available');
        setSupervisorIds([]);
        setOperatorIds([]);
        setSelectedClient(null);
      }
      setFieldErrors({});
      setFormError('');
      fetchDropdownOptions();
    }
  }, [visible, machineToEdit]);

  const fetchDropdownOptions = async () => {
    try {
      const [supsRes, opsRes, clientsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, phone, email, shift_time')
          .in('role', ['supervisor', 'manager', 'service_manager', 'admin', 'super_admin'])
          .eq('status', 'active')
          .order('full_name', { ascending: true }),
        supabase
          .from('users')
          .select('id, full_name, phone, email, shift_time')
          .eq('role', 'operator')
          .eq('status', 'active')
          .order('full_name', { ascending: true }),
        supabase
          .from('clients')
          .select('id, code, company_name, contact_person, phone, city, district, state, address')
          .is('deleted_at', null)
          .order('company_name', { ascending: true }),
      ]);

      if (supsRes.data) setSupervisorsList(supsRes.data);
      if (opsRes.data) setOperatorsList(opsRes.data);
      if (clientsRes.data) setClientsList(clientsRes.data);
    } catch (e) {
      console.warn('Error fetching machine dropdown options:', e);
    }
  };

  const handleRemoveSupervisor = (id: string) => {
    setSupervisorIds((prev) => prev.filter((item) => item !== id));
  };

  const handleRemoveOperator = (id: string) => {
    setOperatorIds((prev) => prev.filter((item) => item !== id));
  };

  const handleSave = async () => {
    setFieldErrors({});
    setFormError('');

    const errors: Record<string, string> = {};
    const cleanModel = model.trim();
    const cleanSerial = serialNumber.trim();
    const cleanYum = yearOfMfg.trim();
    const cleanMfr = manufacturer.trim();

    if (!isSupervisor) {
      if (!cleanModel) errors.model = 'Model is mandatory.';
      if (!cleanSerial) errors.serial_number = 'Serial number is mandatory.';
      if (!cleanYum) errors.year_of_mfg = 'Year of manufacture is mandatory.';
      if (!cleanMfr) errors.manufacturer = 'Manufacturer is mandatory.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please complete all mandatory machine specification fields.');
      return;
    }

    setIsSaving(true);
    try {
      if (!isSupervisor) {
        // Uniqueness check for Serial Number
        let duplicateQuery = supabase
          .from('machines')
          .select('id, machine_id, serial_number')
          .ilike('serial_number', cleanSerial);

        if (machineToEdit?.id) {
          duplicateQuery = duplicateQuery.neq('id', machineToEdit.id);
        }

        const { data: existingSerial } = await duplicateQuery.limit(1);
        if (existingSerial && existingSerial.length > 0) {
          const matchCode = existingSerial[0].machine_id || 'existing machine';
          setFieldErrors({
            serial_number: `Serial number already registered to machine ${matchCode}.`,
          });
          setFormError(`A machine with Serial Number "${cleanSerial}" already exists (${matchCode}).`);
          setIsSaving(false);
          return;
        }
      }

      const numericHmr = parseFloat(hourMeter) || 0;

      if (isSupervisor && machineToEdit?.id) {
        // Supervisor limited update payload
        const supervisorPayload: any = {
          hour_meter: numericHmr,
          status: rentalStatus,
          health_status: healthStatus,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: rentalStatus === 'rented' ? selectedClient?.id || null : null,
          customer_name: rentalStatus === 'rented' ? selectedClient?.company_name || null : null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('machines')
          .update(supervisorPayload)
          .eq('id', machineToEdit.id);

        if (error) throw error;
      } else {
        // Full Manager/Admin payload
        const payload: any = {
          model: cleanModel,
          serial_number: cleanSerial,
          manufacturer: cleanMfr || null,
          year_of_mfg: cleanYum || null,
          hour_meter: numericHmr,
          status: rentalStatus,
          health_status: healthStatus,
          supervisor_ids: supervisorIds,
          current_supervisor_id: supervisorIds[0] || null,
          operator_ids: operatorIds,
          current_operator_id: operatorIds[0] || null,
          client_id: rentalStatus === 'rented' ? selectedClient?.id || null : null,
          customer_name: rentalStatus === 'rented' ? selectedClient?.company_name || null : null,
          updated_at: new Date().toISOString(),
        };

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
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save machine details.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const modalTitle = isSupervisor
    ? `Update Status (${machineToEdit?.machine_id || ''})`
    : isEdit
    ? `Edit Machine (${machineToEdit?.machine_id || ''})`
    : 'Register New Machine';

  const selectedSupervisors = supervisorIds
    .map((id) => supervisorsList.find((s) => s.id === id))
    .filter(Boolean) as SelectableUser[];

  const selectedOperators = operatorIds
    .map((id) => operatorsList.find((o) => o.id === id))
    .filter(Boolean) as SelectableUser[];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.canvasElevated }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <Text style={[styles.title, { color: theme.colors.ink }]}>{modalTitle}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {/* Form Error Banner */}
          {formError ? (
            <View style={[styles.errorBanner, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
              <AlertCircle size={15} color="#ef4444" style={{ marginTop: 1 }} />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 0: MACHINE INFO (Shown for Add Machine or when specs editable) */}
            {!isSupervisor && (
              <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                  <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
                    MACHINE INFO
                  </Text>
                </View>

                <View style={styles.sectionFields}>
                  <Input
                    label="Model *"
                    placeholder="e.g. 50B-9 / CAT-320 / S3246"
                    value={model}
                    onChangeText={setModel}
                    error={fieldErrors.model}
                    editable={!isSaving}
                  />

                  <Input
                    label="Serial Number *"
                    placeholder="e.g. HHKHB303EF00000877"
                    value={serialNumber}
                    onChangeText={setSerialNumber}
                    error={fieldErrors.serial_number}
                    editable={!isSaving}
                  />

                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Year of Mfg (YUM) *"
                        placeholder="2024"
                        value={yearOfMfg}
                        onChangeText={setYearOfMfg}
                        error={fieldErrors.year_of_mfg}
                        keyboardType="numeric"
                        editable={!isSaving}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Manufacturer *"
                        placeholder="e.g. HYUNDAI / TOYOTA"
                        value={manufacturer}
                        onChangeText={setManufacturer}
                        error={fieldErrors.manufacturer}
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 1: METER READINGS & PERSONNEL ASSIGNMENT (Screenshot 1 Match) */}
            <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
                  METER READINGS & PERSONNEL ASSIGNMENT
                </Text>
              </View>

              <View style={styles.sectionFields}>
                {/* Hour Meter Reading */}
                <Input
                  label="Hour Meter Reading (HMR)"
                  placeholder="0"
                  value={hourMeter}
                  onChangeText={setHourMeter}
                  keyboardType="numeric"
                  editable={!isSaving}
                />

                {/* Assigned Supervisors */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                      Assigned Supervisors (Multi-Shift Oversight)
                    </Text>
                    <Text style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                      {supervisorIds.length} assigned
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSupervisorModalOpen(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.multiSelectTrigger,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.selectedPillsWrap}>
                      {selectedSupervisors.length === 0 ? (
                        <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
                          Search & assign supervisors...
                        </Text>
                      ) : (
                        selectedSupervisors.map((s) => (
                          <View
                            key={s.id}
                            style={[
                              styles.userChip,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Text style={[styles.userChipText, { color: theme.colors.ink }]}>
                              {s.full_name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemoveSupervisor(s.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <X size={11} color={theme.colors.mute} />
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>

                    <View style={styles.triggerRightActions}>
                      {supervisorIds.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setSupervisorIds([])}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={[styles.clearBtnText, { color: theme.colors.mute }]}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                      <ChevronDown size={14} color={theme.colors.mute} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Assigned Operators */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                      Assigned Operators (24h Shift Execution)
                    </Text>
                    <Text style={[styles.assignedCountText, { color: theme.colors.mute }]}>
                      {operatorIds.length} assigned
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setOperatorModalOpen(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.multiSelectTrigger,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.selectedPillsWrap}>
                      {selectedOperators.length === 0 ? (
                        <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
                          Search & assign operators...
                        </Text>
                      ) : (
                        selectedOperators.map((o) => (
                          <View
                            key={o.id}
                            style={[
                              styles.userChip,
                              {
                                backgroundColor: theme.colors.canvas,
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Text style={[styles.userChipText, { color: theme.colors.ink }]}>
                              {o.full_name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleRemoveOperator(o.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <X size={11} color={theme.colors.mute} />
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>

                    <View style={styles.triggerRightActions}>
                      {operatorIds.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setOperatorIds([])}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={[styles.clearBtnText, { color: theme.colors.mute }]}>
                            Clear
                          </Text>
                        </TouchableOpacity>
                      )}
                      <ChevronDown size={14} color={theme.colors.mute} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* SECTION 2: STATUS & HEALTH TRACKING (Screenshot 1 Match) */}
            <View style={[styles.sectionBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
              <View style={[styles.sectionTitleRow, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.sectionHeaderTitle, { color: theme.colors.ink }]}>
                  STATUS & HEALTH TRACKING
                </Text>
              </View>

              <View style={styles.sectionFields}>
                {/* Health Status Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Health Status</Text>
                  <TouchableOpacity
                    onPress={() => setHealthModalOpen(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.singleSelectTrigger,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.selectLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              healthStatus === 'active'
                                ? '#10b981'
                                : healthStatus === 'spare'
                                ? '#06b6d4'
                                : healthStatus === 'under_maintenance'
                                ? '#f59e0b'
                                : '#ef4444',
                          },
                        ]}
                      />
                      <Text style={[styles.selectValueText, { color: theme.colors.ink }]}>
                        {healthStatus === 'active'
                          ? 'Active'
                          : healthStatus === 'spare'
                          ? 'Spare'
                          : healthStatus === 'under_maintenance'
                          ? 'Under Maintenance'
                          : 'Breakdown'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>

                {/* Rental Status Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Rental Status</Text>
                  <TouchableOpacity
                    onPress={() => setRentalModalOpen(true)}
                    activeOpacity={0.7}
                    style={[
                      styles.singleSelectTrigger,
                      {
                        backgroundColor: theme.colors.canvasElevated,
                        borderColor: theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.selectLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              rentalStatus === 'available' ? '#10b981' : '#0ea5e9',
                          },
                        ]}
                      />
                      <Text style={[styles.selectValueText, { color: theme.colors.ink }]}>
                        {rentalStatus === 'available' ? 'Available' : 'Rented'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>

                {/* Assigned Client (shown when rental status is 'rented') */}
                {rentalStatus === 'rented' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>
                      Assigned Client
                    </Text>
                    <TouchableOpacity
                      onPress={() => setClientModalOpen(true)}
                      activeOpacity={0.7}
                      style={[
                        styles.singleSelectTrigger,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={styles.selectLeft}>
                        {selectedClient ? (
                          <View style={styles.clientChipRow}>
                            <Text style={[styles.clientNameText, { color: theme.colors.ink }]}>
                              {selectedClient.company_name}
                            </Text>
                            {selectedClient.code && (
                              <View style={styles.clientCodeBadge}>
                                <Text style={styles.clientCodeText}>
                                  {selectedClient.code}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text style={[styles.placeholderText, { color: theme.colors.mute }]}>
                            Select assigned client...
                          </Text>
                        )}
                      </View>

                      <View style={styles.triggerRightActions}>
                        {selectedClient && (
                          <TouchableOpacity
                            onPress={() => setSelectedClient(null)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <X size={14} color={theme.colors.mute} />
                          </TouchableOpacity>
                        )}
                        <ChevronDown size={14} color={theme.colors.mute} />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom Actions (Screenshot 1 Match) */}
            <View style={styles.bottomButtonsWrap}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryActionBtnText, { color: theme.colors.onPrimary }]}>
                    {isSupervisor ? 'Save Updates' : isEdit ? 'Update Machine' : 'Register Machine'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                disabled={isSaving}
                style={[
                  styles.cancelActionBtn,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelActionBtnText, { color: theme.colors.ink }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Sub-Modals */}
          <MultiUserSelectModal
            visible={supervisorModalOpen}
            onClose={() => setSupervisorModalOpen(false)}
            title="Assigned Supervisors (Multi-Shift)"
            users={supervisorsList}
            selectedIds={supervisorIds}
            onConfirm={setSupervisorIds}
            roleLabel="supervisors"
          />

          <MultiUserSelectModal
            visible={operatorModalOpen}
            onClose={() => setOperatorModalOpen(false)}
            title="Assigned Operators (24h Shifts)"
            users={operatorsList}
            selectedIds={operatorIds}
            onConfirm={setOperatorIds}
            roleLabel="operators"
          />

          <ClientSelectModal
            visible={clientModalOpen}
            onClose={() => setClientModalOpen(false)}
            clients={clientsList}
            selectedClientId={selectedClient?.id}
            onSelect={setSelectedClient}
          />

          <CustomFilterSelectorModal
            visible={healthModalOpen}
            onClose={() => setHealthModalOpen(false)}
            title="Select Health Status"
            options={HEALTH_OPTIONS}
            selectedValue={healthStatus}
            onSelect={(val) => {
              setHealthStatus(val);
              if (val === 'spare' && rentalStatus !== 'rented') {
                setRentalStatus('rented');
              }
            }}
          />

          <CustomFilterSelectorModal
            visible={rentalModalOpen}
            onClose={() => setRentalModalOpen(false)}
            title="Select Rental Status"
            options={RENTAL_OPTIONS}
            selectedValue={rentalStatus}
            onSelect={(val) => {
              setRentalStatus(val);
              if (val === 'available') {
                setSelectedClient(null);
              }
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacingNumeric.xs,
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },
  body: {
    flexGrow: 1,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
    paddingBottom: spacingNumeric['2xl'],
  },
  sectionBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitleRow: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionFields: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
  },
  fieldGroup: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  assignedCountText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  multiSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    paddingVertical: 8,
    minHeight: 44,
  },
  selectedPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
    marginRight: spacingNumeric.xs,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  userChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  triggerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: 12,
  },
  singleSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.md,
    height: 44,
  },
  selectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectValueText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clientChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    flex: 1,
  },
  clientNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clientCodeBadge: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e940',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  clientCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bottomButtonsWrap: {
    gap: spacingNumeric.sm,
    marginTop: spacingNumeric.xs,
  },
  primaryActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radiusNumeric.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelActionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
