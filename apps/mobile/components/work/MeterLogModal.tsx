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
import {
  computeShiftTiming,
  findLatestMachineLogTimeline,
  formatTo12Hour,
  formatDate,
} from '@reachinternational/utils';

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

  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startMeter, setStartMeter] = useState('0');
  const [endMeter, setEndMeter] = useState('0');
  const [startTime, setStartTime] = useState('06:00 AM');
  const [endTime, setEndTime] = useState('02:00 PM');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [breakdownDuration, setBreakdownDuration] = useState('1h 30m');

  // 7-day past dates list (Today + past 7 days)
  const pastDates = React.useMemo(() => {
    const dates = [];
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      dates.push({
        str,
        label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`,
        subLabel: `${weekday}, ${dayNum} ${monthShort}`,
      });
    }
    return dates;
  }, []);

  // Client Selection
  const [clients, setClients] = useState<Array<{ id: string; name: string; client_name?: string; address?: string; city?: string; state?: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientModalVisible, setClientModalVisible] = useState(false);

  const [latestTimeline, setLatestTimeline] = useState<{
    latestLog: any | null;
    endDateTime: Date | null;
    formattedEndTime: string;
    formattedEndDate: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Shift duration, normal working time and overtime calculation via canonical helper
  const shiftStats = React.useMemo(() => {
    const ot = parseFloat(overtimeHours);
    return computeShiftTiming({
      logDate,
      startTime,
      endTime,
      manualOvertime: isNaN(ot) ? undefined : ot,
    });
  }, [logDate, startTime, endTime, overtimeHours]);

  // Real-time sequencing check against machine timeline
  const sequencingError = React.useMemo(() => {
    if (!latestTimeline || !latestTimeline.endDateTime || !shiftStats.isValid || !shiftStats.startDateTime) {
      return null;
    }
    const prevEndMs = latestTimeline.endDateTime.getTime();
    const currentStartMs = shiftStats.startDateTime.getTime();
    if (currentStartMs < prevEndMs) {
      return {
        isInvalid: true,
        message: `Start time (${formatTo12Hour(startTime)}) cannot precede previous log's end time (${latestTimeline.formattedEndDate} at ${latestTimeline.formattedEndTime}). Handover is allowed from ${latestTimeline.formattedEndTime} onwards.`,
        recommendedTime: latestTimeline.formattedEndTime,
        recommendedDate: latestTimeline.latestLog?.end_date || latestTimeline.latestLog?.log_date || logDate,
      };
    }
    return null;
  }, [latestTimeline, shiftStats.isValid, shiftStats.startDateTime, startTime, logDate]);

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
        .select('id, company_name, address, city, state')
        .order('company_name');
      if (data) {
        const clientItems = data.map((c: any) => ({
          id: c.id,
          name: c.company_name || c.client_name || 'Client',
          client_name: c.company_name || c.client_name,
          address: c.address,
          city: c.city,
          state: c.state,
        }));
        setClients(clientItems);
        if (clientItems.length > 0 && !selectedClientId && !location) {
          setSelectedClientId(clientItems[0].id);
          const parts = [clientItems[0].address, clientItems[0].city, clientItems[0].state].filter(Boolean);
          if (parts.length > 0) setLocation(parts.join(', '));
        }
      }
    } catch (e) {
      console.warn('Error fetching clients:', e);
    }
  };

  const fetchLatestMachineLog = async () => {
    try {
      const { data } = await supabase
        .from('machine_hour_logs')
        .select('id, machine_id, log_date, end_date, start_time, end_time, start_datetime, end_datetime, end_meter, location, client_id')
        .eq('machine_id', machineId)
        .order('log_date', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const timeline = findLatestMachineLogTimeline(data, machineId);
        setLatestTimeline(timeline);
        if (timeline.latestLog?.end_meter) {
          setStartMeter(String(timeline.latestLog.end_meter));
          setEndMeter(String(timeline.latestLog.end_meter + 8));
        }
        if (timeline.latestLog?.location) setLocation(timeline.latestLog.location);
        if (timeline.latestLog?.client_id) setSelectedClientId(timeline.latestLog.client_id);
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

    if (!shiftStats.isValid) {
      setError(shiftStats.errorMessage || 'End Date + Time must always be later than Start Date + Time.');
      return;
    }

    if (sequencingError?.isInvalid) {
      setError(sequencingError.message);
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
        overtime_hours: shiftStats.overtimeHours,
        normal_working_hours: shiftStats.normalWorkingHours,
        is_breakdown: isBreakdown,
        remarks: remarksPayload || null,
        operator_id: userId || null,
        idempotency_key: idempotencyKey,
        log_date: shiftStats.resolvedStartDate,
        end_date: shiftStats.resolvedEndDate,
        start_datetime: shiftStats.startDateTime?.toISOString(),
        end_datetime: shiftStats.endDateTime?.toISOString(),
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
            {/* Log Date Selector Strip (Today + Past 7 Days) */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink, marginBottom: 0 }]}>Log Date *</Text>
                <Text style={{ fontSize: 10, color: theme.colors.link, fontWeight: '600' }}>Allowed: 7 days window</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                {pastDates.map((item) => {
                  const isSelected = item.str === logDate;
                  return (
                    <TouchableOpacity
                      key={item.str}
                      onPress={() => setLogDate(item.str)}
                      activeOpacity={0.8}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: isSelected ? theme.colors.link : theme.colors.canvas,
                          borderColor: isSelected ? theme.colors.link : theme.colors.hairline,
                        },
                      ]}
                    >
                      <Text style={[styles.dateChipLabel, { color: isSelected ? '#ffffff' : theme.colors.ink, fontWeight: isSelected ? '700' : '600' }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.dateChipSub, { color: isSelected ? 'rgba(255,255,255,0.85)' : theme.colors.mute }]}>
                        {item.subLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

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

            {/* Shift Timing Section */}
            <View style={{ gap: 8, marginTop: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink, marginBottom: 0 }]}>Shift Timing</Text>
                {shiftStats.isValid && shiftStats.isOvernight ? (
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: '#6366f1',
                    }}>
                      🌙 Overnight · {shiftStats.durationFormatted}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Machine Timeline Context Strip */}
              {latestTimeline?.latestLog && (
                <View style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: 'rgba(14, 165, 233, 0.08)',
                  borderColor: 'rgba(14, 165, 233, 0.25)',
                  borderWidth: 1,
                  gap: 4,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} color="#0284c7" />
                    <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '500', flex: 1 }}>
                      <Text style={{ fontWeight: '700' }}>Timeline Status:</Text> Last log ended on {latestTimeline.formattedEndDate} at {latestTimeline.formattedEndTime}.
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: '#0284c7', fontWeight: '600' }}>
                    Exact handover allowed from {latestTimeline.formattedEndTime}
                  </Text>
                </View>
              )}

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Start Time *"
                    placeholder="06:00 AM"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="End Time *"
                    placeholder="02:00 PM"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>

              {/* Sequencing Error Alert */}
              {sequencingError?.isInvalid && (
                <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error, marginVertical: 2, padding: 10, gap: 8 }]}>
                  <Text style={{ color: theme.colors.error, fontSize: 11, fontWeight: '600' }}>
                    ❌ {sequencingError.message}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (sequencingError.recommendedTime) setStartTime(sequencingError.recommendedTime);
                      if (sequencingError.recommendedDate) setLogDate(sequencingError.recommendedDate);
                    }}
                    style={{
                      minHeight: 44,
                      backgroundColor: theme.colors.error,
                      borderRadius: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                      Align Start to {sequencingError.recommendedTime} (Handover)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!shiftStats.isValid && !sequencingError?.isInvalid && (
                <View style={[styles.alertBox, { backgroundColor: theme.colors.error + '1a', borderColor: theme.colors.error, marginVertical: 2 }]}>
                  <Text style={{ color: theme.colors.error, fontSize: 11, textAlign: 'center', fontWeight: '600' }}>
                    ❌ {shiftStats.errorMessage || 'Invalid shift timings.'}
                  </Text>
                </View>
              )}
            </View>

            <Input
              label="Overtime Hours (Optional)"
              placeholder="e.g. 0.0"
              value={overtimeHours}
              onChangeText={setOvertimeHours}
              keyboardType="numeric"
            />

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
              label="Submit"
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
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  dateChipLabel: {
    fontSize: 11,
  },
  dateChipSub: {
    fontSize: 9,
    marginTop: 1,
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
