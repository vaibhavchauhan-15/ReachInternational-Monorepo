import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Badge,
  useTheme,
  MobileHeader,
  Text,
  Button,
  useToast,
  EmptyState,
  Card,
  AppRefreshControl,
  ConfirmDialog,
  type HeaderActionItem,
} from '../ui';
import { Pressable } from '../ui/touch/Pressable';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { formatDate, getUserInitials } from '@reachinternational/utils';
import { haptics } from '../../lib/haptics';
import {
  Wrench,
  AlertCircle,
  Phone,
  Mail,
  Truck,
  MapPin,
  Clock,
  UserCheck,
  History,
  ShieldCheck,
  Copy,
  Check,
  Edit2,
  RefreshCw,
  Calendar,
  UserPlus,
  Trash2,
} from '../ui/icon';
import {
  useClientDetailData,
  type ClientDetailTabKey,
} from '../../lib/hooks/useClientDetailData';
import { ClientDetailSkeleton } from './ClientDetailSkeleton';
import { ClientModal } from './ClientModal';
import { ClientSiteModal } from './ClientSiteModal';
import { AssignClientSupervisorModal } from './AssignClientSupervisorModal';

export interface ClientDetailViewProps {
  id: string;
  onBack: () => void;
  canManageClients?: boolean;
  initialTab?: ClientDetailTabKey;
  initialAction?: string;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  id,
  onBack,
  canManageClients = true,
  initialTab = 'machines',
  initialAction,
}) => {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;

  // Active Tab State
  const [activeTab, setActiveTab] = useState<ClientDetailTabKey>(initialTab);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit Client Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formPanNumber, setFormPanNumber] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formDistrict, setFormDistrict] = useState('');
  const [formStateName, setFormStateName] = useState('Maharashtra');
  const [formPincode, setFormPincode] = useState('');
  const [formIsBillingDiff, setFormIsBillingDiff] = useState(false);
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formBillingCity, setFormBillingCity] = useState('');
  const [formBillingDistrict, setFormBillingDistrict] = useState('');
  const [formBillingState, setFormBillingState] = useState('');
  const [formBillingPincode, setFormBillingPincode] = useState('');
  const [formAllowanceHours, setFormAllowanceHours] = useState('0');
  const [formAllowanceMinutes, setFormAllowanceMinutes] = useState('0');
  const [formPresetId, setFormPresetId] = useState('none');

  // Add Site Modal state
  const [addSiteVisible, setAddSiteVisible] = useState(false);
  const [siteFormName, setSiteFormName] = useState('');
  const [siteFormStreet, setSiteFormStreet] = useState('');
  const [siteFormCity, setSiteFormCity] = useState('');
  const [siteFormDistrict, setSiteFormDistrict] = useState('');
  const [siteFormPincode, setSiteFormPincode] = useState('');
  const [isSavingSite, setIsSavingSite] = useState(false);

  // Assign Client Supervisor Modal state
  const [assignSupervisorModalVisible, setAssignSupervisorModalVisible] = useState(false);
  const [supervisorToRemove, setSupervisorToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isRemovingSupervisor, setIsRemovingSupervisor] = useState(false);

  // Pull server data via TanStack Query
  const {
    client,
    kpis,
    isLoading,
    isFetching,
    isError,
    refetchAll,
    // Tab Data
    machines,
    isMachinesLoading,
    sites,
    isSitesLoading,
    runningLogs,
    isLogsLoading,
    assignments,
    isAssignmentsLoading,
    supervisors,
    isSupervisorsLoading,
    shiftCodes,
    isShiftsLoading,
    history,
    isHistoryLoading,
    audits,
    isAuditLoading,
    // Mutations
    updateClient,
    addSite,
    removeSupervisor,
  } = useClientDetailData(id, activeTab);

  // Trigger supervisor assignment workflow directly if routed via action=assign-supervisor
  useEffect(() => {
    if (initialAction === 'assign-supervisor' && canManageClients && client) {
      setAssignSupervisorModalVisible(true);
      setActiveTab('assignments');
    }
  }, [initialAction, canManageClients, Boolean(client)]);

  // Copy Client Code handler
  const handleCopyCode = useCallback(async () => {
    const code = client?.client_id || client?.code || id;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(code);
      }
      haptics.tap();
      setCopiedCode(true);
      toast('success', 'Copied to Clipboard', `Client identifier ${code} copied.`);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Graceful fallback
    }
  }, [client, id, toast]);

  // Open Edit Client Modal
  const handleOpenEdit = useCallback(() => {
    if (!client) return;
    setFormCompanyName(client.company_name || '');
    setFormContactPerson(client.contact_person || '');
    setFormPhone(client.phone || '');
    setFormGstin(client.gstin || '');
    setFormPanNumber(client.pan_number || '');
    setFormAddress(client.street || client.address || '');
    setFormCity(client.city || '');
    setFormDistrict(client.district || '');
    setFormStateName(client.state || 'Maharashtra');
    setFormPincode(client.pincode || '');
    setFormIsBillingDiff(Boolean(client.is_billing_address_different));
    setFormBillingAddress(client.billing_address || '');
    setFormBillingCity(client.billing_city || '');
    setFormBillingDistrict(client.billing_district || '');
    setFormBillingState(client.billing_state || '');
    setFormBillingPincode(client.billing_pincode || '');
    const allowanceMin = client.maintenance_allowance_minutes || 0;
    setFormAllowanceHours(String(Math.floor(allowanceMin / 60)));
    setFormAllowanceMinutes(String(allowanceMin % 60));
    setFormPresetId(allowanceMin > 0 ? 'custom' : 'none');
    setEditModalVisible(true);
  }, [client]);

  // Save Edit Client Mutation
  const handleSaveClient = useCallback(async () => {
    if (!client) return;
    if (!formCompanyName.trim()) {
      toast('warning', 'Validation Error', 'Company name is required.');
      return;
    }
    try {
      const totalMinutes = (parseInt(formAllowanceHours, 10) || 0) * 60 + (parseInt(formAllowanceMinutes, 10) || 0);
      await updateClient({
        company_name: formCompanyName.trim(),
        contact_person: formContactPerson.trim() || null,
        phone: formPhone.trim() || null,
        gstin: formGstin.trim() || null,
        pan_number: formPanNumber.trim() || null,
        street: formAddress.trim() || null,
        city: formCity.trim() || null,
        district: formDistrict.trim() || null,
        state: formStateName.trim() || null,
        pincode: formPincode.trim() || null,
        is_billing_address_different: formIsBillingDiff,
        billing_address: formIsBillingDiff ? formBillingAddress.trim() : null,
        billing_city: formIsBillingDiff ? formBillingCity.trim() : null,
        billing_district: formIsBillingDiff ? formBillingDistrict.trim() : null,
        billing_state: formIsBillingDiff ? formBillingState.trim() : null,
        billing_pincode: formIsBillingDiff ? formBillingPincode.trim() : null,
        maintenance_allowance_minutes: totalMinutes,
      });
      setEditModalVisible(false);
      toast('success', 'Client Updated', 'Client account updated successfully.');
    } catch (err: any) {
      toast('error', 'Update Failed', err.message || 'Unable to update client record.');
    }
  }, [
    client,
    formCompanyName,
    formContactPerson,
    formPhone,
    formGstin,
    formPanNumber,
    formAddress,
    formCity,
    formDistrict,
    formStateName,
    formPincode,
    formIsBillingDiff,
    formBillingAddress,
    formBillingCity,
    formBillingDistrict,
    formBillingState,
    formBillingPincode,
    formAllowanceHours,
    formAllowanceMinutes,
    updateClient,
    toast,
  ]);

  // Open Add Site Modal
  const handleOpenAddSite = useCallback(() => {
    setSiteFormName('');
    setSiteFormStreet('');
    setSiteFormCity(client?.city || '');
    setSiteFormDistrict(client?.district || '');
    setSiteFormPincode(client?.pincode || '');
    setAddSiteVisible(true);
  }, [client]);

  // Save Add Site Mutation
  const handleSaveSite = useCallback(async () => {
    if (!client) return;
    if (!siteFormName.trim() || !siteFormCity.trim()) {
      toast('warning', 'Validation Error', 'Site name and city are required.');
      return;
    }
    try {
      setIsSavingSite(true);
      await addSite({
        site_name: siteFormName.trim(),
        street: siteFormStreet.trim() || undefined,
        city: siteFormCity.trim(),
        district: siteFormDistrict.trim() || undefined,
        state_id: 27, // Default Maharashtra
        pincode: siteFormPincode.trim() || undefined,
      });
      setAddSiteVisible(false);
      toast('success', 'Site Added', `Operational site "${siteFormName}" registered.`);
    } catch (err: any) {
      toast('error', 'Failed to Add Site', err.message || 'Unable to create operational site.');
    } finally {
      setIsSavingSite(false);
    }
  }, [client, siteFormName, siteFormStreet, siteFormCity, siteFormDistrict, siteFormPincode, addSite, toast]);

  // Remove Client Supervisor Handler
  const handleConfirmRemoveSupervisor = useCallback(async () => {
    if (!supervisorToRemove || !client) return;
    try {
      setIsRemovingSupervisor(true);
      await removeSupervisor({ supervisorId: supervisorToRemove.id });
      haptics.confirm();
      toast('success', 'Supervisor Removed', `Removed ${supervisorToRemove.name} from client supervisors.`);
      setSupervisorToRemove(null);
      refetchAll();
    } catch (err: any) {
      haptics.reject();
      toast('error', 'Removal Failed', err.message || 'Unable to remove client supervisor.');
    } finally {
      setIsRemovingSupervisor(false);
    }
  }, [supervisorToRemove, client, removeSupervisor, toast, refetchAll]);

  // Header Actions
  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const acts: HeaderActionItem[] = [
      {
        id: 'copy-client-code',
        label: copiedCode ? 'Copied' : 'Copy ID',
        icon: copiedCode ? <Check size={14} color={theme.colors.success} strokeWidth={2.5} /> : <Copy size={14} color={theme.colors.mute} />,
        onPress: handleCopyCode,
      },
      {
        id: 'refresh-client',
        label: 'Refresh',
        icon: <RefreshCw size={14} color={theme.colors.mute} />,
        onPress: () => {
          haptics.tap();
          refetchAll();
        },
      },
    ];

    if (canManageClients && client) {
      acts.unshift({
        id: 'assign-supervisor',
        label: 'Assign Supervisor',
        icon: <UserPlus size={14} color={theme.colors.primary} />,
        onPress: () => {
          haptics.select();
          setActiveTab('assignments');
          setAssignSupervisorModalVisible(true);
        },
      });
      acts.unshift({
        id: 'edit-client',
        label: 'Edit',
        icon: <Edit2 size={14} color={theme.colors.primary} />,
        onPress: handleOpenEdit,
      });
    }

    return acts;
  }, [copiedCode, theme, handleCopyCode, refetchAll, canManageClients, client, handleOpenEdit, setActiveTab, setAssignSupervisorModalVisible]);

  // Allowance Format Calculation
  const allowanceLabel = useMemo(() => {
    const min = client?.maintenance_allowance_minutes ?? 0;
    if (min <= 0) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h > 0 ? `${h}h` : ''}${h > 0 && m > 0 ? ' ' : ''}${m > 0 ? `${m}m` : ''}/MO`;
  }, [client?.maintenance_allowance_minutes]);

  // Soft-deleted check
  const isSoftDeleted = Boolean(client?.deleted_at);

  // If loading and no client yet, show skeleton immediately
  if (isLoading && !client) {
    return (
      <View style={[styles.screenContainer, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="Client Profile"
          showBack={true}
          onPressBack={onBack}
          actions={headerActions}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.responsiveShell, { maxWidth: isTablet ? 896 : '100%' }]}>
            <ClientDetailSkeleton />
          </View>
        </ScrollView>
      </View>
    );
  }

  // Error State or Not Found
  if (isError || !client) {
    return (
      <View style={[styles.screenContainer, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="Client Not Found"
          showBack={true}
          onPressBack={onBack}
        />
        <View style={styles.errorCentered}>
          <EmptyState
            title="Client Account Not Found"
            description="The requested client identifier does not exist, has been removed, or you do not have permission to view it."
            action={{
              label: 'Back to Client Directory',
              onPress: onBack,
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.colors.canvas }]}>
      {/* 1. Universal Mobile Header */}
      <MobileHeader
        title={client.company_name}
        showBack={true}
        onPressBack={onBack}
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={isFetching}
            onRefresh={refetchAll}
          />
        }
      >
        <View style={[styles.responsiveShell, { maxWidth: isTablet ? 896 : '100%' }]}>
          {/* 2. Client Identity & Hero Card */}
          <Card
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                borderLeftColor: isSoftDeleted
                  ? '#ef4444'
                  : client.status === 'active'
                  ? '#10b981'
                  : '#f59e0b',
              },
            ]}
          >
            {/* Top row: Client Code pill + Status badge + Allowance badge */}
            <View style={styles.heroTopRow}>
              <Pressable
                variant="buttonGhost"
                hitSlopToMin48
                onPress={handleCopyCode}
                style={[
                  styles.codeCopyPill,
                  {
                    backgroundColor: theme.colors.canvas,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                accessibilityLabel={`Copy client ID ${client.client_id || client.code}`}
              >
                <Text variant="mono" weight="bold" style={{ color: theme.colors.primary }}>
                  {client.client_id || client.code}
                </Text>
                {copiedCode ? (
                  <Check size={12} color={theme.colors.success} strokeWidth={2.5} />
                ) : (
                  <Copy size={12} color={theme.colors.mute} />
                )}
              </Pressable>

              <Badge
                status={isSoftDeleted ? 'inactive' : client.status}
                customLabel={isSoftDeleted ? 'SOFT DELETED' : client.status.toUpperCase()}
              />

              {allowanceLabel ? (
                <View
                  style={[
                    styles.allowancePill,
                    {
                      backgroundColor: isDark ? '#451a03' : '#fef3c7',
                      borderColor: isDark ? '#78350f' : '#fcd34d',
                    },
                  ]}
                >
                  <Wrench size={11} color={isDark ? '#fbbf24' : '#d97706'} />
                  <Text variant="micro" weight="semibold" style={{ color: isDark ? '#fde68a' : '#92400e' }}>
                    MAINT: {allowanceLabel}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.allowancePill,
                    {
                      backgroundColor: isDark ? '#4c0519' : '#fee2e2',
                      borderColor: isDark ? '#881337' : '#fca5a5',
                    },
                  ]}
                >
                  <AlertCircle size={11} color="#dc2626" />
                  <Text variant="micro" weight="semibold" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                    MAINT: NOT ALLOWED
                  </Text>
                </View>
              )}
            </View>

            {/* Company Name */}
            <View style={{ marginTop: spacingNumeric.sm }}>
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink }}>
                {client.company_name}
              </Text>
              <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                Registered {formatDate(client.created_at)}
              </Text>
            </View>
          </Card>

          {/* 3. Key Operational Metrics (4-item responsive grid) */}
          <View style={styles.kpiGrid}>
            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.kpiCardHeader}>
                <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Deployed Fleet
                </Text>
                <Truck size={14} color={theme.colors.primary} />
              </View>
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginTop: 4 }}>
                {kpis?.fleetCount ?? 0}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.kpiCardHeader}>
                <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Work Sites
                </Text>
                <MapPin size={14} color="#059669" />
              </View>
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginTop: 4 }}>
                {kpis?.sitesCount ?? 0}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.kpiCardHeader}>
                <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Workforce
                </Text>
                <UserCheck size={14} color="#7e22ce" />
              </View>
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginTop: 4 }}>
                {kpis?.activeAssignmentsCount ?? 0}
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <View style={styles.kpiCardHeader}>
                <Text variant="micro" weight="semibold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                  Running Hours
                </Text>
                <Clock size={14} color="#d97706" />
              </View>
              <Text variant="heading" weight="bold" style={{ color: theme.colors.ink, marginTop: 4 }}>
                {kpis?.totalRunningHours ?? 0} hrs
              </Text>
            </View>
          </View>

          {/* 4. Contact & Identity Information Sections */}
          <View style={styles.sectionRow}>
            {/* Primary Contact Card */}
            <Card
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="micro" weight="semibold" style={{ color: theme.colors.primary, textTransform: 'uppercase' }}>
                Primary Contact
              </Text>
              <View style={{ marginTop: 6, gap: 6 }}>
                <View>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>Contact Person</Text>
                  <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                    {client.contact_person || '—'}
                  </Text>
                </View>

                {Boolean(client.phone) && (
                  <Pressable
                    variant="buttonGhost"
                    hitSlopToMin48
                    onPress={() => Linking.openURL(`tel:${client.phone}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Phone size={13} color={theme.colors.primary} />
                    <Text variant="mono" weight="semibold" style={{ color: theme.colors.primary }}>
                      {client.phone}
                    </Text>
                  </Pressable>
                )}

                {Boolean(client.email) && (
                  <Pressable
                    variant="buttonGhost"
                    hitSlopToMin48
                    onPress={() => Linking.openURL(`mailto:${client.email}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Mail size={13} color={theme.colors.primary} />
                    <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }}>
                      {client.email}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>

            {/* Tax & Statutory Identifiers Card */}
            <Card
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="micro" weight="semibold" style={{ color: isDark ? '#c084fc' : '#7e22ce', textTransform: 'uppercase' }}>
                Tax & Statutory Identifiers
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>GSTIN</Text>
                  <Text variant="mono" weight="semibold" style={{ color: theme.colors.ink, marginTop: 2 }}>
                    {client.gstin || 'Not Registered'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>PAN</Text>
                  <Text variant="mono" weight="semibold" style={{ color: theme.colors.ink, marginTop: 2 }}>
                    {client.pan_number || '—'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Operational & Billing Addresses Card */}
            <Card
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="micro" weight="semibold" style={{ color: '#059669', textTransform: 'uppercase' }}>
                Operational & Billing Addresses
              </Text>
              <View style={{ marginTop: 8, gap: 8 }}>
                <View>
                  <Text variant="micro" style={{ color: theme.colors.mute }}>Operational Site Address</Text>
                  <Text variant="body" weight="medium" style={{ color: theme.colors.ink, marginTop: 2 }}>
                    {[client.street || client.address, client.city, client.district, client.state, client.pincode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </Text>
                </View>

                {client.is_billing_address_different ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.hairline, paddingTop: 6 }}>
                    <Text variant="micro" style={{ color: theme.colors.mute }}>Billing Address</Text>
                    <Text variant="body" weight="medium" style={{ color: theme.colors.ink, marginTop: 2 }}>
                      {[client.billing_address, client.billing_city, client.billing_district, client.billing_state, client.billing_pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" style={{ color: theme.colors.mute }}>
                    Billing address is identical to operational address.
                  </Text>
                )}
              </View>
            </Card>
          </View>

          {/* 5. Horizontal Tab Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabStripContent}
            style={styles.tabStripContainer}
          >
            {(
              [
                { id: 'machines', label: 'Machines', icon: Truck, count: machines.length || kpis?.fleetCount || 0 },
                { id: 'sites', label: 'Sites', icon: MapPin, count: sites.length || kpis?.sitesCount || 0 },
                { id: 'logs', label: 'Running Logs', icon: Clock, count: runningLogs.length || kpis?.runningLogsCount || 0 },
                { id: 'assignments', label: 'Assignments', icon: UserCheck, count: (supervisors.length + assignments.length) || kpis?.activeAssignmentsCount || 0 },
                { id: 'shifts', label: 'Shifts', icon: Calendar, count: shiftCodes.length },
                { id: 'history', label: 'History', icon: History, count: history.length },
                { id: 'audit', label: 'Audit', icon: ShieldCheck, count: audits.length },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              const IconComponent = tab.icon;
              return (
                <Pressable
                  key={tab.id}
                  variant="chip"
                  haptic="select"
                  onPress={() => {
                    haptics.select();
                    setActiveTab(tab.id);
                  }}
                  style={[
                    styles.tabChip,
                    {
                      backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                      borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                      minHeight: 44,
                    },
                  ]}
                >
                  <IconComponent size={13} color={isActive ? '#ffffff' : theme.colors.mute} />
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={{ color: isActive ? '#ffffff' : theme.colors.ink }}
                  >
                    {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 6. Active Tab Content Panels */}
          <View style={styles.tabContentPanel}>
            {/* TAB: MACHINES */}
            {activeTab === 'machines' && (
              <View style={styles.tabSection}>
                {isMachinesLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading client machines...</Text>
                  </View>
                ) : machines.length === 0 ? (
                  <EmptyState
                    title="No Equipment Assigned"
                    description="There are currently no industrial machinery units assigned to this client."
                  />
                ) : (
                  machines.map((m) => (
                    <Card
                      key={m.id}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="mono" weight="bold" style={{ color: theme.colors.primary }}>
                          {m.machine_id}
                        </Text>
                        <Text variant="body" weight="semibold" style={{ color: theme.colors.ink, marginTop: 2 }}>
                          {m.model}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                          SN: {m.serial_number || '—'} {m.hour_meter !== null ? `• ${m.hour_meter} hrs` : ''}
                        </Text>
                      </View>
                      <Badge
                        status={m.status === 'rented' || m.status === 'active' ? 'active' : 'inactive'}
                        customLabel={m.status.toUpperCase()}
                      />
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: SITES */}
            {activeTab === 'sites' && (
              <View style={styles.tabSection}>
                <View style={styles.tabActionHeader}>
                  <Text variant="caption" weight="semibold" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                    Operational Sites ({sites.length})
                  </Text>
                  {canManageClients && (
                    <Button
                      label="Add Site"
                      variant="primary"
                      onPress={handleOpenAddSite}
                      style={{ minHeight: 36, paddingHorizontal: 12 }}
                    />
                  )}
                </View>

                {isSitesLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading operational sites...</Text>
                  </View>
                ) : sites.length === 0 ? (
                  <EmptyState
                    title="No Operational Sites"
                    description="No project or operational sites have been registered for this client."
                    action={
                      canManageClients
                        ? {
                            label: 'Add First Site',
                            onPress: handleOpenAddSite,
                          }
                        : undefined
                    }
                  />
                ) : (
                  sites.map((s) => (
                    <Card
                      key={s.id}
                      style={[
                        styles.itemCardColumn,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Text variant="mono" weight="bold" style={{ color: theme.colors.primary }}>
                          {s.site_code}
                        </Text>
                        <Badge
                          status={s.status === 'active' ? 'active' : 'inactive'}
                          customLabel={s.status.toUpperCase()}
                        />
                      </View>
                      <Text variant="body" weight="semibold" style={{ color: theme.colors.ink, marginTop: 4 }}>
                        {s.site_name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <MapPin size={12} color={theme.colors.mute} />
                        <Text variant="caption" style={{ color: theme.colors.mute, flexShrink: 1 }}>
                          {[s.street, s.city, s.district, s.state_name, s.pincode].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: RUNNING LOGS */}
            {activeTab === 'logs' && (
              <View style={styles.tabSection}>
                {isLogsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading shift running logs...</Text>
                  </View>
                ) : runningLogs.length === 0 ? (
                  <EmptyState
                    title="No Running Logs Recorded"
                    description="No machinery operation or shift meter logs found for this client."
                  />
                ) : (
                  runningLogs.map((l) => (
                    <Card
                      key={l.id}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text variant="mono" weight="bold" style={{ color: theme.colors.ink }}>
                            {l.machine_code}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>•</Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>{l.log_date}</Text>
                          {l.is_breakdown && (
                            <Badge status="inactive" customLabel="BREAKDOWN" />
                          )}
                        </View>
                        <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                          Operator: {l.operator_name} {l.shift ? `• Shift ${l.shift}` : ''}
                        </Text>
                      </View>
                      <Text variant="mono" weight="bold" style={{ color: '#059669' }}>
                        {l.running_hours} hrs
                      </Text>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: ASSIGNMENTS */}
            {activeTab === 'assignments' && (
              <View style={styles.tabSection}>
                {/* 1. Assigned Client Supervisors Section */}
                <View style={styles.assignmentSection}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionTitleRow}>
                        <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }}>
                          Assigned Client Supervisors
                        </Text>
                        <Badge
                          variant="outline"
                          customLabel={String(supervisors.length)}
                        />
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                        Supervisors holding inherited operational oversight over this client&apos;s fleet
                      </Text>
                    </View>

                    {canManageClients && (
                      <Button
                        variant="primary"
                        label="Assign Supervisor"
                        icon={<UserPlus size={14} color="#ffffff" />}
                        onPress={() => setAssignSupervisorModalVisible(true)}
                        style={styles.assignSupBtn}
                      />
                    )}
                  </View>

                  {isSupervisorsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading assigned supervisors...</Text>
                    </View>
                  ) : supervisors.length === 0 ? (
                    <View style={[styles.emptySupCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                      <UserCheck size={32} color={theme.colors.mute} />
                      <Text variant="body" weight="semibold" style={{ color: theme.colors.ink, textAlign: 'center' }}>
                        No Supervisors Assigned to This Client
                      </Text>
                      <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center', maxWidth: 360 }}>
                        Assigning a supervisor grants them inherited operational access over all machines and operator logs deployed under this client account.
                      </Text>
                      {canManageClients && (
                        <Button
                          variant="primary"
                          label="Assign First Supervisor"
                          icon={<UserPlus size={14} color="#ffffff" />}
                          onPress={() => setAssignSupervisorModalVisible(true)}
                          style={{ marginTop: spacingNumeric.xs }}
                        />
                      )}
                    </View>
                  ) : (
                    supervisors.map((s) => {
                      const initials = getUserInitials(s.supervisor_name);
                      return (
                        <Card
                          key={s.id}
                          style={[
                            styles.supervisorCard,
                            {
                              backgroundColor: theme.colors.canvasElevated,
                              borderColor: theme.colors.hairline,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.supervisorAvatar,
                              {
                                backgroundColor: isDark ? '#ffffff' : '#171717',
                                borderColor: theme.colors.hairline,
                              },
                            ]}
                          >
                            <Text
                              variant="body"
                              weight="bold"
                              style={{ color: isDark ? '#171717' : '#ffffff' }}
                            >
                              {initials}
                            </Text>
                          </View>

                          <View style={styles.supervisorInfoCol}>
                            <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                              {s.supervisor_name}
                            </Text>

                            <View style={styles.supervisorContactsRow}>
                              {Boolean(s.supervisor_phone) && (
                                <Pressable
                                  variant="buttonGhost"
                                  hitSlopToMin48
                                  onPress={() => Linking.openURL(`tel:${s.supervisor_phone}`)}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
                                >
                                  <Phone size={12} color={theme.colors.primary} />
                                  <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }}>
                                    {s.supervisor_phone}
                                  </Text>
                                </Pressable>
                              )}
                              {Boolean(s.supervisor_email) && (
                                <Pressable
                                  variant="buttonGhost"
                                  hitSlopToMin48
                                  onPress={() => Linking.openURL(`mailto:${s.supervisor_email}`)}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
                                >
                                  <Mail size={12} color={theme.colors.primary} />
                                  <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }} numberOfLines={1}>
                                    {s.supervisor_email}
                                  </Text>
                                </Pressable>
                              )}
                            </View>

                            <Text variant="micro" style={{ color: theme.colors.mute }}>
                              Assigned {formatDate(s.assigned_at)}
                            </Text>
                          </View>

                          <View style={styles.supervisorActionsCol}>
                            <Badge
                              status="active"
                              customLabel="INHERITED"
                            />
                            {canManageClients && (
                              <Pressable
                                variant="buttonGhost"
                                hitSlopToMin48
                                onPress={() => {
                                  haptics.select();
                                  setSupervisorToRemove({ id: s.supervisor_id, name: s.supervisor_name });
                                }}
                                style={styles.removeSupBtn}
                                accessibilityLabel={`Remove ${s.supervisor_name} from this client`}
                              >
                                <Trash2 size={16} color="#ef4444" />
                              </Pressable>
                            )}
                          </View>
                        </Card>
                      );
                    })
                  )}
                </View>

                {/* 2. Workforce & Equipment Deployments Section */}
                <View style={[styles.assignmentSection, { marginTop: spacingNumeric.lg }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionTitleRow}>
                        <Text variant="subheading" weight="bold" style={{ color: theme.colors.ink }}>
                          {'Equipment & Operator Deployments'}
                        </Text>
                        <Badge
                          variant="outline"
                          customLabel={String(assignments.length)}
                        />
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                        Active machinery operators and shift assignments deployed under this client
                      </Text>
                    </View>
                  </View>

                  {isAssignmentsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading workforce assignments...</Text>
                    </View>
                  ) : assignments.length === 0 ? (
                    <EmptyState
                      title="No Active Equipment Deployments"
                      description="No machinery operators are currently assigned to machinery under this client account."
                    />
                  ) : (
                    assignments.map((a) => (
                      <Card
                        key={a.id}
                        style={[
                          styles.itemCard,
                          {
                            backgroundColor: theme.colors.canvasElevated,
                            borderColor: theme.colors.hairline,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                            {a.operator_name}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                            {a.machine_code} • {a.shift_name}
                          </Text>
                          {Boolean(a.shift_start_time && a.shift_end_time) && (
                            <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 1 }}>
                              Timing: {a.shift_start_time?.slice(0, 5)} - {a.shift_end_time?.slice(0, 5)}
                            </Text>
                          )}
                        </View>
                        <Badge
                          status={a.is_active ? 'active' : 'inactive'}
                          customLabel={a.is_active ? 'ACTIVE' : 'ENDED'}
                        />
                      </Card>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* TAB: SHIFTS */}
            {activeTab === 'shifts' && (
              <View style={styles.tabSection}>
                {isShiftsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading client shift presets...</Text>
                  </View>
                ) : shiftCodes.length === 0 ? (
                  <EmptyState
                    title="Standard Shift Rules Active"
                    description="This client uses the standard organization shift rules (8-hour standard shifts)."
                  />
                ) : (
                  shiftCodes.map((sc) => (
                    <Card
                      key={sc.id}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text variant="mono" weight="bold" style={{ color: theme.colors.primary }}>
                            {sc.code}
                          </Text>
                          <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                            {sc.name}
                          </Text>
                        </View>
                        <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                          Operating Window: {sc.start_time?.slice(0, 5)} - {sc.end_time?.slice(0, 5)}
                        </Text>
                        {sc.ot_threshold_minutes > 0 && (
                          <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 1 }}>
                            OT Threshold: {Math.floor(sc.ot_threshold_minutes / 60)} hrs
                          </Text>
                        )}
                      </View>
                      <Badge
                        status={sc.is_active ? 'active' : 'inactive'}
                        customLabel={sc.is_active ? 'ACTIVE' : 'DISABLED'}
                      />
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: HISTORY */}
            {activeTab === 'history' && (
              <View style={styles.tabSection}>
                {isHistoryLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading timeline history...</Text>
                  </View>
                ) : history.length === 0 ? (
                  <EmptyState
                    title="Zero Milestone Events"
                    description="No timeline history records logged for this account."
                  />
                ) : (
                  history.map((h) => (
                    <Card
                      key={h.id}
                      style={[
                        styles.itemCardColumn,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Text variant="body" weight="semibold" style={{ color: theme.colors.ink }}>
                          {h.title}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>
                          {formatDate(h.date)}
                        </Text>
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 4 }}>
                        {h.desc}
                      </Text>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && (
              <View style={styles.tabSection}>
                {isAuditLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text variant="caption" style={{ color: theme.colors.mute }}>Loading audit trail entries...</Text>
                  </View>
                ) : audits.length === 0 ? (
                  <EmptyState
                    title="Zero Audit Events"
                    description="No audit events recorded for this client record."
                  />
                ) : (
                  audits.map((a) => (
                    <Card
                      key={a.id}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: theme.colors.canvasElevated,
                          borderColor: theme.colors.hairline,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text variant="mono" weight="bold" style={{ color: theme.colors.primary }}>
                          {a.action}
                        </Text>
                        <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                          Actor: {a.actor_name || 'System'} {a.actor_role ? `(${a.actor_role})` : ''}
                        </Text>
                      </View>
                      <Text variant="caption" style={{ color: theme.colors.mute }}>
                        {formatDate(a.created_at)}
                      </Text>
                    </Card>
                  ))
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit Client Modal */}
      {client && (
        <ClientModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          editingClient={client as any}
          companyName={formCompanyName}
          setCompanyName={setFormCompanyName}
          contactPerson={formContactPerson}
          setContactPerson={setFormContactPerson}
          phone={formPhone}
          setPhone={setFormPhone}
          gstin={formGstin}
          setGstin={setFormGstin}
          panNumber={formPanNumber}
          setPanNumber={setFormPanNumber}
          address={formAddress}
          setAddress={setFormAddress}
          city={formCity}
          setCity={setFormCity}
          district={formDistrict}
          setDistrict={setFormDistrict}
          stateName={formStateName}
          setStateName={setFormStateName}
          pincode={formPincode}
          setPincode={setFormPincode}
          isBillingAddressDifferent={formIsBillingDiff}
          setIsBillingAddressDifferent={setFormIsBillingDiff}
          billingAddress={formBillingAddress}
          setBillingAddress={setFormBillingAddress}
          billingCity={formBillingCity}
          setBillingCity={setFormBillingCity}
          billingDistrict={formBillingDistrict}
          setBillingDistrict={setFormBillingDistrict}
          billingState={formBillingState}
          setBillingState={setFormBillingState}
          billingPincode={formBillingPincode}
          setBillingPincode={setFormBillingPincode}
          allowanceHours={formAllowanceHours}
          setAllowanceHours={setFormAllowanceHours}
          allowanceMinutes={formAllowanceMinutes}
          setAllowanceMinutes={setFormAllowanceMinutes}
          selectedPresetId={formPresetId}
          setSelectedPresetId={setFormPresetId}
          onSave={handleSaveClient}
        />
      )}

      {/* Add Client Site Modal */}
      {client && (
        <ClientSiteModal
          visible={addSiteVisible}
          onClose={() => setAddSiteVisible(false)}
          siteTargetClientId={client.id}
          targetClientName={client.company_name}
          siteFormName={siteFormName}
          setSiteFormName={setSiteFormName}
          siteFormStreet={siteFormStreet}
          setSiteFormStreet={setSiteFormStreet}
          siteFormCity={siteFormCity}
          setSiteFormCity={setSiteFormCity}
          siteFormDistrict={siteFormDistrict}
          setSiteFormDistrict={setSiteFormDistrict}
          siteFormPincode={siteFormPincode}
          setSiteFormPincode={setSiteFormPincode}
          onSaveSite={handleSaveSite}
          isSavingSite={isSavingSite}
        />
      )}

      {/* Assign Client Supervisor Modal */}
      {client && (
        <AssignClientSupervisorModal
          visible={assignSupervisorModalVisible}
          clientId={client.id}
          clientName={client.company_name}
          onClose={() => setAssignSupervisorModalVisible(false)}
          onSuccess={() => {
            refetchAll();
          }}
        />
      )}

      {/* Remove Supervisor Confirmation Dialog */}
      {client && (
        <ConfirmDialog
          visible={Boolean(supervisorToRemove)}
          title="Remove Client Supervisor"
          message={`Are you sure you want to remove ${supervisorToRemove?.name || 'this supervisor'} from ${client.company_name}? They will lose inherited access over this client's fleet and operations.`}
          confirmText="Remove Supervisor"
          cancelText="Cancel"
          variant="danger"
          isLoading={isRemovingSupervisor}
          onClose={() => setSupervisorToRemove(null)}
          onConfirm={handleConfirmRemoveSupervisor}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacingNumeric['3xl'],
  },
  responsiveShell: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.md,
    gap: spacingNumeric.md,
  },
  heroCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  codeCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  allowancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.xs,
    borderWidth: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingNumeric.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionRow: {
    gap: spacingNumeric.sm,
  },
  infoCard: {
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  tabStripContainer: {
    maxHeight: 48,
    marginTop: 2,
  },
  tabStripContent: {
    gap: 6,
    paddingVertical: 2,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  tabContentPanel: {
    marginTop: 4,
  },
  tabSection: {
    gap: spacingNumeric.sm,
  },
  tabActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  itemCardColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  errorCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacingNumeric.xl,
  },
  assignmentSection: {
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.xs,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs + 2,
  },
  assignSupBtn: {
    minHeight: 44,
    paddingHorizontal: spacingNumeric.md,
  },
  supervisorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    gap: spacingNumeric.sm,
  },
  supervisorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supervisorInfoCol: {
    flex: 1,
    gap: 2,
  },
  supervisorContactsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.md,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  supervisorActionsCol: {
    alignItems: 'flex-end',
    gap: spacingNumeric.xs,
  },
  removeSupBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radiusNumeric.sm,
  },
  emptySupCard: {
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.sm,
  },
});
