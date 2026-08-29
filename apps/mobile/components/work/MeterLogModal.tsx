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
  Switch,
} from 'react-native';
import { Button, Input, useTheme } from '../ui';
import { supabase } from '../../lib/supabase';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { X, Check, ChevronDown, Clock, AlertTriangle } from 'lucide-react-native';
import { validateMobileClipboardInput } from '../../lib/security/clipboard';
import { HmrSchema } from '@reachinternational/validation';

export interface MeterLogModalProps {
  visible: boolean;
  onClose: () => void;
  machineId?: string;
  machineCode?: string;
  model?: string;
  serialNumber?: string;
  onSubmit?: (log?: any) => void;
}

export const MeterLogModal: React.FC<MeterLogModalProps> = ({
  visible,
  onClose,
  machineId = '',
  machineCode = '',
  model = '',
  serialNumber = '',
  onSubmit,
}) => {
  const { theme } = useTheme();

  const [startMeter, setStartMeter] = useState('0');
  const [endMeter, setEndMeter] = useState('0');
  const [startTime, setStartTime] = useState('08:00 AM');
  const [endTime, setEndTime] = useState('05:00 PM');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [breakdownDuration, setBreakdownDuration] = useState('1h 30m');

  // Client Selection
  const [clients, setClients] = useState<Array<{ id: string; name: string; client_name?: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Shift normal working time and overtime calculation
  const shiftStats = React.useMemo(() => {
    const parseMins = (t: string) => {
      const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (match[3] === 'PM' && h < 12) h += 12;
      if (match[3] === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    const s = parseMins(startTime);
    const e = parseMins(endTime);
    if (s === null || e === null) {
      return { duration: 9, normal: 8, ot: parseFloat(overtimeHours) || 0 };
    }
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    const dur = Math.round((diff / 60) * 10) / 10;
    const ot = parseFloat(overtimeHours) || (dur > 9 ? Math.round((dur - 9) * 10) / 10 : 0);
    const normal = Math.max(0, Math.round((dur - ot - 1.0) * 10) / 10);
    return { duration: dur, normal, ot };
  }, [startTime, endTime, overtimeHours]);

  useEffect(() => {
    if (visible) {
      fetchClients();
      setError('');
      setSuccess('');
      if (machineId) {
        fetchLatestMachineLog();
      }
    }
  }, [visible, machineId]);

  const fetchClients = async () => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, client_name, address, city, state')
        .order('client_name');
      if (data) {
        setClients(data.map((c: any) => ({
          id: c.id,
          name: c.client_name || 'Client',
          client_name: c.client_name,
          address: c.address,
          city: c.city,
          state: c.state,
        })));
      }
    } catch (e) {
      console.warn('Error fetching clients:', e);
    }
  };

  const fetchLatestMachineLog = async () => {
    try {
      const { data } = await supabase
        .from('machine_hour_logs')
        .select('end_meter, location, client_id')
        .eq('machine_id', machineId)
        .order('log_date', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        if (data.end_meter) {
          setStartMeter(String(data.end_meter));
          setEndMeter(String(data.end_meter + 8));
        }
        if (data.location) setLocation(data.location);
        if (data.client_id) setSelectedClientId(data.client_id);
      }
    } catch (e) {
      // Ignore if no prior log
    }
  };

  const handleSelectClient = (c: { id: string; name: string; address?: string; city?: string; state?: string }) => {
    setSelectedClientId(c.id);
    const locParts = [c.address, c.city, c.state].filter(Boolean);
    if (locParts.length > 0) {
      setLocation(locParts.join(', '));
    }
    setClientModalVisible(false);
  };

  const handleStartMeterChange = (val: string) => {
    const res = validateMobileClipboardInput(val, HmrSchema);
    if (!res.success && val.trim() !== '') {
      setError(res.error || 'Invalid start meter reading.');
    } else {
      setError('');
    }
    setStartMeter(res.sanitizedValue);
  };

  const handleEndMeterChange = (val: string) => {
    const res = validateMobileClipboardInput(val, HmrSchema);
    if (!res.success && val.trim() !== '') {
      setError(res.error || 'Invalid end meter reading.');
    } else {
      setError('');
    }
    setEndMeter(res.sanitizedValue);
  };

  const startVal = parseFloat(startMeter) || 0;
  const endVal = parseFloat(endMeter) || 0;
  const runningHours = Math.max(0, endVal - startVal);

  const handleSubmit = async () => {
    if (endVal < startVal) {
      setError('End meter reading cannot be less than start meter.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      let remarksPayload = remarks.trim();
      if (isBreakdown && breakdownDuration.trim()) {
        remarksPayload = `[Breakdown Duration: ${breakdownDuration.trim()}] ${remarksPayload}`.trim();
      }

      const idempotencyKey = `ihl_m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const payload: any = {
        machine_id: machineId || null,
        client_id: selectedClientId || null,
        location: location.trim() || null,
        start_meter: startVal,
        end_meter: endVal,
        running_hours: runningHours,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        overtime_hours: shiftStats.ot,
        normal_working_hours: shiftStats.normal,
        is_breakdown: isBreakdown,
        remarks: remarksPayload || null,
        operator_id: userId || null,
        idempotency_key: idempotencyKey,
        log_date: new Date().toISOString().split('T')[0],
      };

      const { error: insertErr } = await supabase
        .from('machine_hour_logs')
        .insert([payload]);

      if (insertErr) throw insertErr;

      // Update machine hour_meter
      if (machineId && endVal > 0) {
        await supabase
          .from('machines')
          .update({
            hour_meter: endVal,
            health_status: isBreakdown ? 'breakdown' : 'active',
          })
          .eq('id', machineId);
      }

      setSuccess('Daily machine log recorded successfully!');
      setTimeout(() => {
        if (onSubmit) onSubmit();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit meter log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClientObj = clients.find((c) => c.id === selectedClientId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.canvas }]}>
                <Clock size={18} color={theme.colors.link} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.ink }]}>
                  Log Machine Running Hours
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                  {model || machineCode} {serialNumber ? `• S/N: ${serialNumber}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.mute} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error }]}>
              <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontWeight: '500' }}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={[styles.alertBox, { backgroundColor: theme.colors.success + '1a', borderColor: theme.colors.success }]}>
              <Text style={{ color: theme.colors.success, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>{success}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} contentContainerStyle={{ gap: spacingNumeric.xs }} showsVerticalScrollIndicator={false}>
            {/* Client Selector Trigger */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Client / Customer Site</Text>
              <TouchableOpacity
                onPress={() => setClientModalVisible(true)}
                activeOpacity={0.8}
                style={[
                  styles.clientSelectTrigger,
                  { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline },
                ]}
              >
                <Text style={[styles.clientSelectText, { color: selectedClientObj ? theme.colors.ink : theme.colors.mute }]}>
                  {selectedClientObj ? selectedClientObj.name : 'Select assigned client...'}
                </Text>
                <ChevronDown size={16} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <Input
              label="Site Location / Address"
              placeholder="e.g. Jhajjar, Haryana"
              value={location}
              onChangeText={setLocation}
            />

            {/* Meter Inputs */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Meter (hrs) *"
                  value={startMeter}
                  onChangeText={handleStartMeterChange}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Meter (hrs) *"
                  value={endMeter}
                  onChangeText={handleEndMeterChange}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Calculated Running Hours Box */}
            <View style={[styles.calcBox, { backgroundColor: theme.colors.hairlineSoft, borderColor: theme.colors.hairline }]}>
              <Text style={[styles.calcLabel, { color: theme.colors.mute }]}>Calculated Running Hours:</Text>
              <Text style={[styles.calcValue, { color: theme.colors.link }]}>{runningHours.toFixed(1)} hrs</Text>
            </View>

            {/* Shift Times */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Shift Start Time"
                  placeholder="08:00 AM"
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Shift End Time"
                  placeholder="05:00 PM"
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>

            <Input
              label="Overtime Hours (Optional)"
              placeholder="e.g. 0.0"
              value={overtimeHours}
              onChangeText={setOvertimeHours}
              keyboardType="numeric"
            />

            {/* Shift Breakdown Box */}
            <View style={[styles.calcBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline, padding: spacingNumeric.sm }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: theme.colors.mute }}>Shift Duration:</Text>
                <Text style={{ fontSize: 11, fontFamily: 'GeistMono_700Bold', color: theme.colors.ink }}>{shiftStats.duration} hrs (1h break)</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: theme.colors.link, fontWeight: '700' }}>Normal Working Time:</Text>
                <Text style={{ fontSize: 11, fontFamily: 'GeistMono_700Bold', color: theme.colors.link }}>{shiftStats.normal} hrs (excl. OT)</Text>
              </View>
            </View>

            {/* Breakdown Toggle */}
            <View style={[styles.breakdownRow, { backgroundColor: theme.colors.canvas, borderColor: isBreakdown ? theme.colors.error : theme.colors.hairline }]}>
              <View style={styles.breakdownLeft}>
                <AlertTriangle size={16} color={isBreakdown ? theme.colors.error : theme.colors.mute} />
                <View>
                  <Text style={[styles.breakdownTitle, { color: theme.colors.ink }]}>Equipment Breakdown</Text>
                  <Text style={[styles.breakdownDesc, { color: theme.colors.mute }]}>Did any machine stoppage occur?</Text>
                </View>
              </View>
              <Switch
                value={isBreakdown}
                onValueChange={setIsBreakdown}
                trackColor={{ false: theme.colors.hairline, true: theme.colors.error }}
              />
            </View>

            {isBreakdown && (
              <Input
                label="Breakdown Duration (e.g. 1h 30m) *"
                placeholder="1h 30m"
                value={breakdownDuration}
                onChangeText={setBreakdownDuration}
              />
            )}

            <Input
              label="Operational Remarks"
              placeholder="e.g. Normal shift operation at site"
              value={remarks}
              onChangeText={setRemarks}
              multiline
            />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
            <Button label="Cancel" onPress={onClose} variant="outline" size="md" />
            <Button
              label="Submit Daily Log"
              onPress={handleSubmit}
              isLoading={isSubmitting}
              variant="primary"
              size="md"
            />
          </View>
        </View>

        {/* Client Selection Modal */}
        <Modal visible={clientModalVisible} animationType="slide" transparent onRequestClose={() => setClientModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Select Customer / Client</Text>
                <TouchableOpacity onPress={() => setClientModalVisible(false)} style={styles.closeBtn}>
                  <X size={18} color={theme.colors.ink} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalListScroll} showsVerticalScrollIndicator={false}>
                {clients.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => handleSelectClient(c)}
                    style={[
                      styles.clientItemRow,
                      { borderBottomColor: theme.colors.hairline },
                      selectedClientId === c.id && { backgroundColor: theme.colors.link + '12' },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clientItemName, { color: selectedClientId === c.id ? theme.colors.link : theme.colors.ink, fontWeight: selectedClientId === c.id ? '700' : '600' }]}>
                        {c.name}
                      </Text>
                      <Text style={[styles.clientItemLoc, { color: theme.colors.mute }]}>
                        {[c.address, c.city, c.state].filter(Boolean).join(', ') || 'No address logged'}
                      </Text>
                    </View>
                    {selectedClientId === c.id && <Check size={18} color={theme.colors.link} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  modalContent: {
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
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radiusNumeric.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  alertBox: {
    padding: spacingNumeric.sm,
    marginHorizontal: spacingNumeric.lg,
    marginTop: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  formScroll: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
  },
  inputGroup: {
    marginBottom: spacingNumeric.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  clientSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  clientSelectText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  calcBox: {
    padding: 10,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calcLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  calcValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    marginVertical: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
    borderTopWidth: 1,
    maxHeight: '75%',
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
  modalListScroll: {
    paddingHorizontal: spacingNumeric.md,
  },
  clientItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 6,
  },
  clientItemName: {
    fontSize: 14,
  },
  clientItemLoc: {
    fontSize: 11,
    marginTop: 2,
  },
});
