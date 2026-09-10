import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { Badge, useTheme } from '../ui';
import { ScissorLiftLogoIcon } from '../branding/ReachInternationalLogo';
import { supabase } from '../../lib/supabase';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate } from '@reachinternational/utils';
import {
  ChevronLeft,
  Edit2,
  Trash2,
  Copy,
  Check,
  Clock,
  Phone,
  Mail,
  Users,
  Shield,
  Wrench,
  Building2,
  MapPin,
  ExternalLink,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react-native';
import { MachineModal } from './MachineModal';
import { DeleteMachineDialog } from './DeleteMachineDialog';
import { CustomFilterSelectorModal } from './CustomFilterSelectorModal';

export interface MachineDetailViewProps {
  machine: any;
  onBack: () => void;
  onMachineUpdated?: () => void;
  onMachineDeleted?: () => void;
  userRole?: string | null;
}

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  machine,
  onBack,
  onMachineUpdated,
  onMachineDeleted,
  userRole,
}) => {
  const { theme } = useTheme();

  const normalizedRole = (userRole || '').toLowerCase();
  const isAdminOrManager =
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedRole === 'manager' ||
    normalizedRole === 'service_manager';
  const isSupervisor = normalizedRole === 'supervisor' || normalizedRole === 'site_supervisor';
  const canEdit = isAdminOrManager || isSupervisor;
  const canDelete = isAdminOrManager;

  // Active Tab: 'overview' (Basic Info) or 'running_hours' (Running Logs)
  const [activeTab, setActiveTab] = useState<'overview' | 'running_hours'>('overview');

  // Copy states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);
  const [copiedSiteAddress, setCopiedSiteAddress] = useState(false);
  const [copiedBillingAddress, setCopiedBillingAddress] = useState(false);

  // Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Running Logs State (Lazy loaded)
  const [hourLogs, setHourLogs] = useState<any[] | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);

  // Logs Filter / Sort State
  const [logSearch, setLogSearch] = useState('');
  const [logDatePreset, setLogDatePreset] = useState<'all' | '7d' | '30d' | 'month'>('all');
  const [logOperatorFilter, setLogOperatorFilter] = useState('all');
  const [logSortBy, setLogSortBy] = useState<'date_desc' | 'date_asc' | 'hours_desc' | 'hours_asc'>('date_desc');
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const logPageSize = 10;

  // Modals for filter selectors in logs tab
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);

  // Title formatting: Model - Serial No (Screenshot 2 Match)
  const displayTitle =
    [machine.model, machine.serial_number].filter(Boolean).join(' - ') ||
    machine.machine_id ||
    'Machine Details';

  // Client data extraction
  const client = machine.client;
  const clientCompanyName = client?.company_name || machine.customer_name || '';
  const clientCode = client?.code || '';
  const clientContactPerson = client?.contact_person || '';
  const clientPhone = client?.phone || machine.customer_mobile || '';
  const clientEmail = client?.email || machine.customer_email || '';
  const clientGstin = client?.gstin || '';
  const clientPan = client?.pan_number || '';
  const clientAddress = client?.address || machine.customer_address || '';
  const clientCity = client?.city || machine.city || '';
  const clientDistrict = client?.district || '';
  const clientState = client?.state || machine.state || '';
  const clientPincode = client?.pincode || '';
  const isBillingAddressDifferent = Boolean(client?.is_billing_address_different);
  const billingAddress = client?.billing_address || '';
  const billingCity = client?.billing_city || '';
  const billingDistrict = client?.billing_district || '';
  const billingState = client?.billing_state || '';
  const billingPincode = client?.billing_pincode || '';

  const locationParts = [clientCity, clientDistrict, clientState].filter(Boolean);
  const clientLocation = locationParts.length > 0 ? Array.from(new Set(locationParts)).join(', ') : '';
  const fullSiteAddress = [clientAddress, clientLocation, clientPincode ? `PIN: ${clientPincode}` : ''].filter(Boolean).join(', ');
  const fullBillingAddress = [billingAddress, [billingCity, billingDistrict, billingState].filter(Boolean).join(', '), billingPincode ? `PIN: ${billingPincode}` : ''].filter(Boolean).join(', ');
  const hasLinkedClient = Boolean(clientCompanyName || fullSiteAddress || clientPhone);

  // Supervisors & Operators
  const supervisors = Array.isArray(machine.supervisors) && machine.supervisors.length > 0
    ? machine.supervisors.filter((s: any) => Boolean(s?.full_name))
    : machine.current_supervisor?.full_name
    ? [machine.current_supervisor]
    : [];

  const operators = Array.isArray(machine.operators) && machine.operators.length > 0
    ? machine.operators.filter((o: any) => Boolean(o?.full_name))
    : machine.current_operator?.full_name
    ? [machine.current_operator]
    : [];

  // Copy handlers
  const handleCopy = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 1800);
  };

  // Fetch Running Logs
  const fetchHourLogs = useCallback(async () => {
    if (!machine.id) return;
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const { data, error } = await supabase
        .from('machine_hour_logs')
        .select(`
          id,
          machine_id,
          operator_id,
          supervisor_id,
          client_id,
          log_date,
          start_meter,
          end_meter,
          running_hours,
          start_time,
          end_time,
          shift,
          remarks,
          created_at,
          operator:users!machine_hour_logs_operator_id_fkey(id, full_name, phone, email)
        `)
        .eq('machine_id', machine.id)
        .order('log_date', { ascending: false });

      if (error) throw error;
      setHourLogs(data || []);
      setHasLoadedLogs(true);
    } catch (err: any) {
      setLogsError(err?.message || 'Failed to load hour meter running logs.');
      setHourLogs([]);
      setHasLoadedLogs(true);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [machine.id]);

  useEffect(() => {
    if (activeTab === 'running_hours' && !hasLoadedLogs && !isLoadingLogs) {
      fetchHourLogs();
    }
  }, [activeTab, hasLoadedLogs, isLoadingLogs, fetchHourLogs]);

  // Log calculation & filtering
  const totalHoursRun = useMemo(() => {
    if (!hourLogs) return 0;
    return hourLogs.reduce((acc, log) => acc + (Number(log.running_hours) || 0), 0);
  }, [hourLogs]);

  const filteredLogs = useMemo(() => {
    if (!hourLogs) return [];
    let list = [...hourLogs];
    const q = logSearch.toLowerCase().trim();

    if (q) {
      list = list.filter((l) => {
        return (
          l.operator?.full_name?.toLowerCase().includes(q) ||
          l.remarks?.toLowerCase().includes(q) ||
          l.log_date?.includes(q) ||
          String(l.start_meter).includes(q) ||
          String(l.end_meter).includes(q)
        );
      });
    }

    if (logOperatorFilter !== 'all') {
      list = list.filter((l) => l.operator_id === logOperatorFilter || l.operator?.id === logOperatorFilter);
    }

    // Date preset filter
    if (logDatePreset !== 'all') {
      const now = new Date();
      if (logDatePreset === '7d') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter((l) => new Date(l.log_date) >= d7);
      } else if (logDatePreset === '30d') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        list = list.filter((l) => new Date(l.log_date) >= d30);
      } else if (logDatePreset === 'month') {
        const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        list = list.filter((l) => l.log_date?.startsWith(curMonth));
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (logSortBy === 'date_desc') return new Date(b.log_date).getTime() - new Date(a.log_date).getTime();
      if (logSortBy === 'date_asc') return new Date(a.log_date).getTime() - new Date(b.log_date).getTime();
      if (logSortBy === 'hours_desc') return (Number(b.running_hours) || 0) - (Number(a.running_hours) || 0);
      if (logSortBy === 'hours_asc') return (Number(a.running_hours) || 0) - (Number(b.running_hours) || 0);
      return 0;
    });

    return list;
  }, [hourLogs, logSearch, logOperatorFilter, logDatePreset, logSortBy]);

  const totalLogPages = Math.ceil(filteredLogs.length / logPageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return filteredLogs.slice(start, start + logPageSize);
  }, [filteredLogs, logPage]);

  // Delete Action
  const handleDeleteMachine = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('machines').delete().eq('id', machine.id);
      if (error) throw error;
      setDeleteDialogVisible(false);
      if (onMachineDeleted) onMachineDeleted();
      onBack();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete machine');
    } finally {
      setIsDeleting(false);
    }
  };

  // Dial / WhatsApp / Maps handlers
  const handleCall = (phoneNum?: string) => {
    if (!phoneNum) return;
    const clean = phoneNum.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`);
  };

  const handleEmail = (emailAddr?: string) => {
    if (!emailAddr) return;
    Linking.openURL(`mailto:${emailAddr}`);
  };

  const handleWhatsApp = (phoneNum?: string) => {
    if (!phoneNum) return;
    const clean = phoneNum.replace(/[^0-9]/g, '');
    const msg = `Hello, regarding machine ${displayTitle} (${machine.machine_id}).`;
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
  };

  const handleOpenMap = () => {
    if (!fullSiteAddress) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(fullSiteAddress)}`,
      android: `geo:0,0?q=${encodeURIComponent(fullSiteAddress)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullSiteAddress)}`,
    });
    if (url) Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Back Navigation Bar (Screenshot 2 Match) */}
      <View style={[styles.navBar, { borderBottomColor: theme.colors.hairline }]}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={styles.backBtn}
        >
          <ChevronLeft size={16} color={theme.colors.mute} />
          <Text style={[styles.backBtnText, { color: theme.colors.mute }]}>
            Back to Machines
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BANNER CARD (Screenshot 2 Match) */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          <View style={styles.heroMainRow}>
            {/* Scissor Lift Logo Icon in Dark Squircle */}
            <View style={styles.scissorSquircle}>
              <ScissorLiftLogoIcon size={22} color="#0ea5e9" />
            </View>

            {/* Title & Status Badges */}
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.heroTitle, { color: theme.colors.ink }]} numberOfLines={2}>
                {displayTitle}
              </Text>

              <View style={styles.heroBadgeRow}>
                {machine.health_status === 'breakdown' && (
                  <Badge status="breakdown" customLabel="Breakdown" />
                )}
                {machine.health_status === 'under_maintenance' && (
                  <Badge status="under_maintenance" customLabel="Maintenance" />
                )}
                {machine.health_status === 'spare' && (
                  <Badge status="spare" customLabel="Spare" />
                )}
                {(!machine.health_status || machine.health_status === 'active') && (
                  <Badge status="active" customLabel="Active" />
                )}

                <Badge
                  status={machine.status === 'rented' ? 'in_transit' : 'available'}
                  customLabel={machine.status === 'rented' ? 'On Rent' : 'Available'}
                />
              </View>
            </View>

            {/* Action Buttons: Edit & Red Delete (Screenshot 2 Match) */}
            <View style={styles.heroActionBtns}>
              {canEdit && (
                <TouchableOpacity
                  onPress={() => setEditModalVisible(true)}
                  style={[
                    styles.circleEditBtn,
                    {
                      backgroundColor: theme.colors.canvas,
                      borderColor: theme.colors.hairline,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Edit2 size={15} color={theme.colors.ink} />
                </TouchableOpacity>
              )}

              {canDelete && (
                <TouchableOpacity
                  onPress={() => setDeleteDialogVisible(true)}
                  style={styles.circleDeleteBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* SEGMENTED TAB TOGGLE (Screenshot 2 Match) */}
        <View style={[styles.tabBarWrap, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}
            style={[
              styles.tabPill,
              activeTab === 'overview' && [
                styles.tabPillActive,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color: activeTab === 'overview' ? theme.colors.link : theme.colors.mute,
                  fontWeight: activeTab === 'overview' ? '700' : '500',
                },
              ]}
            >
              Basic Info
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('running_hours')}
            activeOpacity={0.7}
            style={[
              styles.tabPill,
              activeTab === 'running_hours' && [
                styles.tabPillActive,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ],
            ]}
          >
            <Text
              style={[
                styles.tabPillText,
                {
                  color: activeTab === 'running_hours' ? theme.colors.link : theme.colors.mute,
                  fontWeight: activeTab === 'running_hours' ? '700' : '500',
                },
              ]}
            >
              Running Logs
            </Text>
            {hasLoadedLogs && hourLogs && hourLogs.length > 0 && (
              <View style={[styles.tabCountPill, { backgroundColor: theme.colors.link + '18' }]}>
                <Text style={[styles.tabCountText, { color: theme.colors.link }]}>
                  {hourLogs.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* TAB 1: BASIC INFO & CLIENT DETAILS (Screenshot 2 Match) */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentArea}>
            {/* 1. Basic Info Specs Grid Card (Screenshot 2 Match) */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                  Basic Info
                </Text>
                <Badge
                  status={machine.status === 'rented' ? 'in_transit' : 'available'}
                  customLabel={machine.status === 'rented' ? '• ON RENT' : '• AVAILABLE'}
                />
              </View>

              <View style={styles.specsGrid}>
                {/* Machine ID */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                      MACHINE ID
                    </Text>
                    <TouchableOpacity onPress={() => handleCopy(setCopiedId)}>
                      {copiedId ? (
                        <Check size={11} color={theme.colors.success} strokeWidth={2.5} />
                      ) : (
                        <Copy size={11} color={theme.colors.mute} />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                    {machine.machine_id}
                  </Text>
                </View>

                {/* Model */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>MODEL</Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.model || '—'}
                  </Text>
                </View>

                {/* Serial No */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SERIAL NO</Text>
                  <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.serial_number || '—'}
                  </Text>
                </View>

                {/* Year of Mfg */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    YEAR OF MFG (YUM)
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                    {machine.year_of_mfg || '—'}
                  </Text>
                </View>

                {/* Manufacturer */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    MANUFACTURER
                  </Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {machine.manufacturer || '—'}
                  </Text>
                </View>

                {/* Hour Meter (HMR) in bold blue */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    HOUR METER (HMR)
                  </Text>
                  <Text style={[styles.specBoxValueHmr, { color: theme.colors.link }]}>
                    {machine.hour_meter ?? 0} hrs
                  </Text>
                </View>

                {/* Supervisors */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SUPERVISORS</Text>
                    {supervisors.length > 0 && (
                      <Text style={styles.specCountBadge}>{supervisors.length}</Text>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {supervisors.length > 0 ? supervisors[0].full_name : '—'}
                  </Text>
                </View>

                {/* Operators */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={styles.specBoxHeader}>
                    <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>OPERATORS</Text>
                    {operators.length > 0 && (
                      <Text style={[styles.specCountBadge, { color: '#f59e0b' }]}>
                        {operators.length} (24h)
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]} numberOfLines={1}>
                    {operators.length > 0 ? operators[0].full_name : '—'}
                  </Text>
                </View>

                {/* Health Status */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>HEALTH STATUS</Text>
                  <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                    {machine.health_status === 'breakdown'
                      ? 'Breakdown'
                      : machine.health_status === 'under_maintenance'
                      ? 'Under Maintenance'
                      : machine.health_status === 'spare'
                      ? 'Spare'
                      : 'Active'}
                  </Text>
                </View>

                {/* Rental Fleet Status */}
                <View style={[styles.specBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>
                    RENTAL FLEET STATUS
                  </Text>
                  <Text style={[styles.specBoxValueRental, { color: theme.colors.link }]}>
                    {machine.status === 'rented' ? 'On Rent' : 'Available'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Assigned Shift Personnel (24h Fleet Coverage) (Screenshot 2 Match) */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.cardHeaderLeft}>
                  <Users size={16} color={theme.colors.link} />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Assigned Shift Personnel (24h Fleet Coverage)
                  </Text>
                </View>

                {canEdit && (
                  <TouchableOpacity
                    onPress={() => setEditModalVisible(true)}
                    style={styles.manageStaffBtn}
                  >
                    <Edit2 size={12} color={theme.colors.link} />
                    <Text style={[styles.manageStaffText, { color: theme.colors.link }]}>
                      Manage Staff
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.personnelSectionBody}>
                {/* Supervisors Panel */}
                <View style={[styles.personnelSubBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Shield size={14} color="#10b981" />
                      <Text style={[styles.personnelSubTitle, { color: theme.colors.ink }]}>
                        Supervisors ({supervisors.length})
                      </Text>
                    </View>
                    <View style={styles.oversightBadge}>
                      <Text style={styles.oversightBadgeText}>Oversight & Verification</Text>
                    </View>
                  </View>

                  {supervisors.length === 0 ? (
                    <Text style={[styles.noStaffText, { color: theme.colors.mute }]}>
                      No supervisors assigned to this machine.
                    </Text>
                  ) : (
                    supervisors.map((s: any, idx: number) => (
                      <View
                        key={s.id || idx}
                        style={[
                          styles.personnelRowCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.personnelRowLeft}>
                          <View style={styles.personnelNameShiftRow}>
                            <Text style={[styles.staffName, { color: theme.colors.ink }]}>
                              {s.full_name}
                            </Text>
                            <Text style={[styles.staffShiftTag, { color: theme.colors.mute }]}>
                              Shift {idx + 1}
                            </Text>
                          </View>

                          <View style={styles.clockRow}>
                            <Clock size={11} color="#10b981" />
                            <Text style={styles.clockTimeText}>
                              {s.shift_time || '09:30:00 - 06:30 PM'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.personnelActionIcons}>
                          {s.phone && (
                            <TouchableOpacity
                              onPress={() => handleCall(s.phone)}
                              style={[styles.staffContactBtn, { borderColor: theme.colors.hairline }]}
                            >
                              <Phone size={12} color={theme.colors.mute} />
                            </TouchableOpacity>
                          )}
                          {s.email && (
                            <TouchableOpacity
                              onPress={() => handleEmail(s.email)}
                              style={[styles.staffContactBtn, { borderColor: theme.colors.hairline }]}
                            >
                              <Mail size={12} color={theme.colors.mute} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Operators Panel */}
                <View style={[styles.personnelSubBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <View style={[styles.personnelSubHeader, { borderBottomColor: theme.colors.hairline }]}>
                    <View style={styles.personnelSubHeaderLeft}>
                      <Wrench size={14} color="#f59e0b" />
                      <Text style={[styles.personnelSubTitle, { color: theme.colors.ink }]}>
                        Operators ({operators.length})
                      </Text>
                    </View>
                    <View style={[styles.oversightBadge, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b35' }]}>
                      <Text style={[styles.oversightBadgeText, { color: '#f59e0b' }]}>
                        Hour Logging & Operations
                      </Text>
                    </View>
                  </View>

                  {operators.length === 0 ? (
                    <Text style={[styles.noStaffText, { color: theme.colors.mute }]}>
                      No operators assigned. Assign operators to enable 24h shift logging.
                    </Text>
                  ) : (
                    operators.map((o: any, idx: number) => (
                      <View
                        key={o.id || idx}
                        style={[
                          styles.personnelRowCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.personnelRowLeft}>
                          <View style={styles.personnelNameShiftRow}>
                            <Text style={[styles.staffName, { color: theme.colors.ink }]}>
                              {o.full_name}
                            </Text>
                            <Text style={[styles.staffShiftTag, { color: '#f59e0b' }]}>
                              Shift {idx + 1}
                            </Text>
                          </View>

                          <View style={styles.clockRow}>
                            <Clock size={11} color="#10b981" />
                            <Text style={styles.clockTimeText}>
                              {o.shift_time || '24h Rotating Shift'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.personnelActionIcons}>
                          {o.phone && (
                            <TouchableOpacity
                              onPress={() => handleCall(o.phone)}
                              style={[styles.staffContactBtn, { borderColor: theme.colors.hairline }]}
                            >
                              <Phone size={12} color={theme.colors.mute} />
                            </TouchableOpacity>
                          )}
                          {o.email && (
                            <TouchableOpacity
                              onPress={() => handleEmail(o.email)}
                              style={[styles.staffContactBtn, { borderColor: theme.colors.hairline }]}
                            >
                              <Mail size={12} color={theme.colors.mute} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>

            {/* 3. Assigned Client Details Card */}
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <View style={styles.cardHeaderLeft}>
                  <Building2 size={16} color={theme.colors.link} />
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                    Assigned Client Details
                  </Text>
                  {clientCode ? (
                    <View style={styles.clientCodePill}>
                      <Text style={styles.clientCodePillText}>{clientCode}</Text>
                    </View>
                  ) : null}
                </View>

                <Badge
                  status={machine.status === 'rented' ? 'in_transit' : 'available'}
                  customLabel={machine.status === 'rented' ? 'On Rent Active' : 'Site Deployed'}
                />
              </View>

              {hasLinkedClient ? (
                <View style={styles.clientDetailsBody}>
                  <View style={styles.clientGrid}>
                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CLIENT NAME</Text>
                      <Text style={[styles.clientNameValue, { color: theme.colors.ink }]}>
                        {clientCompanyName}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT PERSON</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientContactPerson || '—'}
                      </Text>
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CONTACT MOBILE</Text>
                      {clientPhone ? (
                        <TouchableOpacity onPress={() => handleCall(clientPhone)}>
                          <Text style={[styles.clickableLinkText, { color: theme.colors.link }]}>
                            {clientPhone}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.specBoxValue, { color: theme.colors.mute }]}>—</Text>
                      )}
                    </View>

                    <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>CITY & STATE</Text>
                      <Text style={[styles.specBoxValue, { color: theme.colors.ink }]}>
                        {clientLocation || '—'}
                      </Text>
                    </View>

                    {clientGstin ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>GSTIN</Text>
                          <TouchableOpacity onPress={() => handleCopy(setCopiedGstin)}>
                            {copiedGstin ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                          {clientGstin}
                        </Text>
                      </View>
                    ) : null}

                    {clientPan ? (
                      <View style={[styles.clientFieldBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                        <View style={styles.specBoxHeader}>
                          <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>PAN NUMBER</Text>
                          <TouchableOpacity onPress={() => handleCopy(setCopiedPan)}>
                            {copiedPan ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.specBoxValueMono, { color: theme.colors.ink }]}>
                          {clientPan}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Site Location Box */}
                  {fullSiteAddress ? (
                    <View style={[styles.addressBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.specBoxHeader}>
                        <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>SITE LOCATION</Text>
                        <TouchableOpacity onPress={() => handleCopy(setCopiedSiteAddress)}>
                          {copiedSiteAddress ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.addressText, { color: theme.colors.ink }]}>
                        {fullSiteAddress}
                      </Text>
                    </View>
                  ) : null}

                  {/* Billing Address (if separate) */}
                  {isBillingAddressDifferent && fullBillingAddress ? (
                    <View style={[styles.addressBox, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <View style={styles.specBoxHeader}>
                        <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>BILLING ADDRESS</Text>
                        <TouchableOpacity onPress={() => handleCopy(setCopiedBillingAddress)}>
                          {copiedBillingAddress ? <Check size={11} color={theme.colors.success} /> : <Copy size={11} color={theme.colors.mute} />}
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.addressText, { color: theme.colors.ink }]}>
                        {fullBillingAddress}
                      </Text>
                    </View>
                  ) : null}

                  {/* Quick Action Touch Buttons (Call, WhatsApp, Map) */}
                  <View style={styles.quickTouchRow}>
                    {clientPhone ? (
                      <TouchableOpacity
                        onPress={() => handleCall(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#10b98118', borderColor: '#10b98135' }]}
                        activeOpacity={0.7}
                      >
                        <Phone size={14} color="#10b981" />
                        <Text style={[styles.touchActionText, { color: '#10b981' }]}>Call</Text>
                      </TouchableOpacity>
                    ) : null}

                    {clientPhone ? (
                      <TouchableOpacity
                        onPress={() => handleWhatsApp(clientPhone)}
                        style={[styles.touchActionBtn, { backgroundColor: '#22c55e18', borderColor: '#22c55e35' }]}
                        activeOpacity={0.7}
                      >
                        <MessageSquare size={14} color="#22c55e" />
                        <Text style={[styles.touchActionText, { color: '#22c55e' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    ) : null}

                    {fullSiteAddress ? (
                      <TouchableOpacity
                        onPress={handleOpenMap}
                        style={[styles.touchActionBtn, { backgroundColor: '#0ea5e918', borderColor: '#0ea5e935' }]}
                        activeOpacity={0.7}
                      >
                        <MapPin size={14} color="#0ea5e9" />
                        <Text style={[styles.touchActionText, { color: '#0ea5e9' }]}>Map Location</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.noClientBox}>
                  <Building2 size={24} color={theme.colors.mute} />
                  <Text style={[styles.noClientTitle, { color: theme.colors.ink }]}>No Client Assigned</Text>
                  <Text style={[styles.noClientSub, { color: theme.colors.mute }]}>
                    This machine is currently available in the fleet inventory and has not been leased to a client account.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: RUNNING LOGS (Hours Meter Logs) */}
        {activeTab === 'running_hours' && (
          <View style={styles.tabContentArea}>
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              {/* Header with Title and Total Hours Run Badge */}
              <View style={[styles.cardHeader, { borderBottomColor: theme.colors.hairline }]}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.ink }]}>
                  Hours Meter Logs
                </Text>
                {hasLoadedLogs && hourLogs && hourLogs.length > 0 && (
                  <View style={[styles.totalHoursBadge, { backgroundColor: theme.colors.link + '18', borderColor: theme.colors.link + '35' }]}>
                    <Text style={[styles.totalHoursText, { color: theme.colors.link }]}>
                      +{totalHoursRun} hrs Run
                    </Text>
                  </View>
                )}
              </View>

              {/* Loading State */}
              {isLoadingLogs && (
                <View style={styles.loadingLogsWrap}>
                  <ActivityIndicator size="small" color={theme.colors.link} />
                  <Text style={[styles.loadingLogsText, { color: theme.colors.mute }]}>
                    Loading running meter history...
                  </Text>
                </View>
              )}

              {/* Error State */}
              {!isLoadingLogs && logsError && (
                <View style={[styles.logsErrorBox, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
                  <AlertCircle size={15} color="#ef4444" />
                  <Text style={styles.logsErrorText}>{logsError}</Text>
                  <TouchableOpacity onPress={fetchHourLogs} style={styles.retryBtn}>
                    <Text style={[styles.retryBtnText, { color: theme.colors.link }]}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Empty State (No logs ever recorded) */}
              {!isLoadingLogs && !logsError && hasLoadedLogs && (!hourLogs || hourLogs.length === 0) && (
                <View style={styles.emptyLogsWrap}>
                  <Clock size={28} color={theme.colors.mute} />
                  <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink }]}>
                    No Running Meter Logs Logged
                  </Text>
                  <Text style={[styles.emptyLogsSub, { color: theme.colors.mute }]}>
                    Daily hour meter logbook entries recorded by machine operators will appear here.
                  </Text>
                </View>
              )}

              {/* Filter & Data Feed */}
              {!isLoadingLogs && !logsError && hourLogs && hourLogs.length > 0 && (
                <View style={styles.logsBody}>
                  {/* Search Bar & Filter Toggle */}
                  <View style={[styles.logSearchRow, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                    <Search size={14} color={theme.colors.mute} />
                    <TextInput
                      style={[styles.logSearchInput, { color: theme.colors.ink }]}
                      placeholder="Search logs by operator, date, meter..."
                      placeholderTextColor={theme.colors.mute}
                      value={logSearch}
                      onChangeText={(t) => {
                        setLogSearch(t);
                        setLogPage(1);
                      }}
                    />
                    {logSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setLogSearch('')}>
                        <X size={14} color={theme.colors.mute} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setShowFilterSort((prev) => !prev)}
                      style={[
                        styles.filterToggleBtn,
                        showFilterSort && { backgroundColor: theme.colors.link + '18' },
                      ]}
                    >
                      <SlidersHorizontal size={14} color={showFilterSort ? theme.colors.link : theme.colors.mute} />
                    </TouchableOpacity>
                  </View>

                  {/* Expandable Filter / Sort Bar */}
                  {showFilterSort && (
                    <View style={[styles.expandableFilters, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      {/* Date Preset Selector */}
                      <TouchableOpacity
                        onPress={() => setDateModalOpen(true)}
                        style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                          Date: {logDatePreset === 'all' ? 'All' : logDatePreset === '7d' ? '7 Days' : logDatePreset === '30d' ? '30 Days' : 'This Month'}
                        </Text>
                        <ChevronDown size={12} color={theme.colors.mute} />
                      </TouchableOpacity>

                      {/* Sort Selector */}
                      <TouchableOpacity
                        onPress={() => setSortModalOpen(true)}
                        style={[styles.filterTriggerChip, { borderColor: theme.colors.hairline }]}
                      >
                        <Text style={[styles.filterChipText, { color: theme.colors.ink }]}>
                          Sort: {logSortBy === 'date_desc' ? 'Newest' : logSortBy === 'date_asc' ? 'Oldest' : logSortBy === 'hours_desc' ? 'High Hours' : 'Low Hours'}
                        </Text>
                        <ChevronDown size={12} color={theme.colors.mute} />
                      </TouchableOpacity>

                      {/* Clear Filters */}
                      {(logSearch || logDatePreset !== 'all' || logSortBy !== 'date_desc') && (
                        <TouchableOpacity
                          onPress={() => {
                            setLogSearch('');
                            setLogDatePreset('all');
                            setLogSortBy('date_desc');
                            setLogPage(1);
                          }}
                        >
                          <Text style={[styles.resetFilterText, { color: theme.colors.error }]}>Reset</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Log Cards List */}
                  {paginatedLogs.length === 0 ? (
                    <View style={styles.emptyLogsWrap}>
                      <Text style={[styles.emptyLogsTitle, { color: theme.colors.ink }]}>
                        No logs match your filter criteria
                      </Text>
                    </View>
                  ) : (
                    paginatedLogs.map((log: any) => (
                      <View
                        key={log.id}
                        style={[
                          styles.logCard,
                          {
                            backgroundColor: theme.colors.canvas,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={styles.logCardTopRow}>
                          <Text style={[styles.logDateText, { color: theme.colors.ink }]}>
                            {formatDate(log.log_date)}
                          </Text>
                          <View style={[styles.logOperatorBadge, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                            <Text style={[styles.logOperatorName, { color: theme.colors.ink }]}>
                              {log.operator?.full_name || 'Operator'}
                            </Text>
                          </View>
                        </View>

                        {/* Meter Box */}
                        <View style={[styles.logMeterBox, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }]}>
                          <View>
                            <Text style={[styles.specBoxLabel, { color: theme.colors.mute }]}>METER READING</Text>
                            <Text style={[styles.logMeterNumbers, { color: theme.colors.ink }]}>
                              {log.start_meter || 0} → {log.end_meter || 0}
                            </Text>
                          </View>
                          <View style={styles.runningHoursBadge}>
                            <Text style={styles.runningHoursBadgeText}>
                              +{log.running_hours || 0} hrs
                            </Text>
                          </View>
                        </View>

                        {/* Shift & Remarks */}
                        {log.remarks ? (
                          <Text style={[styles.logRemarksText, { color: theme.colors.mute }]} numberOfLines={2}>
                            &ldquo;{log.remarks}&rdquo;
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}

                  {/* Pagination Controls */}
                  {totalLogPages > 1 && (
                    <View style={[styles.paginationRow, { borderTopColor: theme.colors.hairline }]}>
                      <TouchableOpacity
                        onPress={() => setLogPage((p) => Math.max(1, p - 1))}
                        disabled={logPage === 1}
                        style={[styles.pageBtn, { borderColor: theme.colors.hairline }, logPage === 1 && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Prev</Text>
                      </TouchableOpacity>

                      <Text style={[styles.pageIndicatorText, { color: theme.colors.mute }]}>
                        Page {logPage} of {totalLogPages}
                      </Text>

                      <TouchableOpacity
                        onPress={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                        disabled={logPage === totalLogPages}
                        style={[styles.pageBtn, { borderColor: theme.colors.hairline }, logPage === totalLogPages && { opacity: 0.4 }]}
                      >
                        <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Machine Modal */}
      <MachineModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        machineToEdit={machine}
        onSuccess={() => {
          if (onMachineUpdated) onMachineUpdated();
        }}
        userRole={userRole}
      />

      {/* Delete Machine Dialog */}
      <DeleteMachineDialog
        visible={deleteDialogVisible}
        onClose={() => setDeleteDialogVisible(false)}
        onConfirm={handleDeleteMachine}
        machineId={machine.machine_id}
        model={machine.model}
        isLoading={isDeleting}
      />

      {/* Filter Modals for Running Logs */}
      <CustomFilterSelectorModal
        visible={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title="Filter by Date Range"
        options={[
          { id: 'all', label: 'All Dates' },
          { id: '7d', label: 'Last 7 Days' },
          { id: '30d', label: 'Last 30 Days' },
          { id: 'month', label: 'This Month' },
        ]}
        selectedValue={logDatePreset}
        onSelect={(val) => {
          setLogDatePreset(val as any);
          setLogPage(1);
        }}
      />

      <CustomFilterSelectorModal
        visible={sortModalOpen}
        onClose={() => setSortModalOpen(false)}
        title="Sort Logs By"
        options={[
          { id: 'date_desc', label: 'Date: Newest First' },
          { id: 'date_asc', label: 'Date: Oldest First' },
          { id: 'hours_desc', label: 'Hours: High to Low' },
          { id: 'hours_asc', label: 'Hours: Low to High' },
        ]}
        selectedValue={logSortBy}
        onSelect={(val) => {
          setLogSortBy(val as any);
          setLogPage(1);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    minHeight: 36,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  scissorSquircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  heroActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarWrap: {
    flexDirection: 'row',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
  },
  tabPillActive: {
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabPillText: {
    fontSize: 13,
  },
  tabCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tabContentArea: {
    gap: spacingNumeric.md,
  },
  contentCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: spacingNumeric.xs,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  clientCodePill: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e935',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  clientCodePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  manageStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageStaffText: {
    fontSize: 12,
    fontWeight: '600',
  },
  specsGrid: {
    padding: spacingNumeric.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  specBox: {
    width: '48%',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  specBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  specBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  specCountBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
  },
  specBoxValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  specBoxValueMono: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specBoxValueHmr: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specBoxValueRental: {
    fontSize: 12,
    fontWeight: '700',
  },
  personnelSectionBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  personnelSubBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  personnelSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  personnelSubHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personnelSubTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  oversightBadge: {
    backgroundColor: '#10b98115',
    borderColor: '#10b98135',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  oversightBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10b981',
  },
  noStaffText: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center',
  },
  personnelRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  personnelRowLeft: {
    flex: 1,
    gap: 2,
  },
  personnelNameShiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    fontSize: 12,
    fontWeight: '700',
  },
  staffShiftTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  clockTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  personnelActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffContactBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientDetailsBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  clientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  clientFieldBox: {
    width: '48%',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  clientNameValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  clickableLinkText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  addressBox: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 2,
  },
  addressText: {
    fontSize: 12,
    lineHeight: 16,
  },
  quickTouchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
    marginTop: 4,
  },
  touchActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    minHeight: 44,
  },
  touchActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noClientBox: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  noClientTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noClientSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  totalHoursBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  totalHoursText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 8,
  },
  loadingLogsText: {
    fontSize: 12,
  },
  logsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacingNumeric.md,
    margin: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  logsErrorText: {
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyLogsWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyLogsTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyLogsSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  logsBody: {
    padding: spacingNumeric.md,
    gap: spacingNumeric.sm,
  },
  logSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    height: 40,
    gap: spacingNumeric.xs,
  },
  logSearchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  filterToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandableFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    flexWrap: 'wrap',
  },
  filterTriggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  logCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm,
    gap: 6,
  },
  logCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logDateText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logOperatorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  logOperatorName: {
    fontSize: 10,
    fontWeight: '600',
  },
  logMeterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  logMeterNumbers: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  runningHoursBadge: {
    backgroundColor: '#0ea5e918',
    borderColor: '#0ea5e935',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  runningHoursBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0ea5e9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logRemarksText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  pageBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pageIndicatorText: {
    fontSize: 11,
  },
});
