import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Linking, Animated, Easing, Platform } from 'react-native';
import { Pressable } from '../../components/ui/touch/Pressable';
import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem, KPICard, KPIGrid, FilterToolbar, Text, useTypeStyle, AppModal, Switch, useToast, EmptyState, ErrorState, PermissionDeniedView, ConfirmDialog, Pagination, FilterSidebar, FilterCategoryCard, DropdownFilterSelector, type FilterOption } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Building2, MapPin, Phone, Plus, X, CheckCircle2, RefreshCw, Truck, Clock, UserCheck, History, ShieldCheck, ChevronDown, ChevronUp, Lock, Wrench, AlertCircle, Sparkles, AlertTriangle, RotateCcw } from '../../components/ui/icon';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { ClientListSkeleton, MobileClientCard, ClientModal, ClientSiteModal, ClientDetailModal } from '../../components/clients';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';
import { CLIENT_SHIFT_PRESETS, DEFAULT_CLIENT_SHIFT_PRESET_ID, getClientShiftPresetById, formatDate } from '@reachinternational/utils';
import { createTempId, reconcileRow, removeTempRow } from '../../lib/optimistic';

export type StatusFilter = 'all' | 'active' | 'inactive';

export type ClientSortOptionType =
  | 'company_name_asc'
  | 'company_name_desc'
  | 'code_asc'
  | 'code_desc'
  | 'created_at_desc'
  | 'created_at_asc';

const CLIENT_STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'All Status' },
  { id: 'active', label: 'Active', dotColor: '#10b981' },
  { id: 'inactive', label: 'Inactive', dotColor: '#f59e0b' },
];

const CLIENT_SORT_OPTIONS: FilterOption[] = [
  { id: 'company_name_asc', label: 'Company (A → Z)' },
  { id: 'company_name_desc', label: 'Company (Z → A)' },
  { id: 'code_asc', label: 'Client ID (A → Z)' },
  { id: 'code_desc', label: 'Client ID (Z → A)' },
  { id: 'created_at_desc', label: 'Newest Registered' },
  { id: 'created_at_asc', label: 'Oldest Registered' },
];

interface ClientItem {
  id: string;
  client_id?: string;
  code: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  gstin?: string;
  pan_number?: string;
  street?: string;
  Street?: string;
  address: string;
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
}

interface MobileQueryCacheEntry {
  clients: ClientItem[];
  total: number;
  timestamp: number;
}

const DEFAULT_CLIENTS_FILTERS = {
  activeFilter: 'all' as StatusFilter,
  sortBy: 'company_name_asc' as ClientSortOptionType,
};

export default function ClientsScreen() {
  const { theme, isDark } = useTheme();
  const { toast } = useToast();
  const { role } = useAuth();
  const router = useRouter();

  const normalizedRole = (role || '').toLowerCase();
  const canAccessClients = ['super_admin', 'admin', 'manager'].includes(normalizedRole);

  if (role && !canAccessClients) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader title="Client Accounts" showBack={false} />
        <PermissionDeniedView
          featureName="Client Management"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager']}
        />
      </View>
    );
  }

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState<boolean>(false);
  // Persistent search, filters, and sorting (auto-resets page to 1 on initial mount)
  const {
    search: debouncedSearch,
    inputValue: search,
    setSearch,
    page,
    setPage,
    filters,
    setFilter,
    resetFilters: resetListFilters,
    isDebouncing: isSearching,
  } = usePersistentListState<{
    activeFilter: StatusFilter;
    sortBy: ClientSortOptionType;
  }>({
    storageKey: 'reach_filters_clients',
    defaultSearch: '',
    defaultFilters: DEFAULT_CLIENTS_FILTERS,
    debounceMs: 300,
  });

  const activeFilter = filters.activeFilter;
  const sortBy = filters.sortBy;

  const setActiveFilter = useCallback(
    (val: StatusFilter) => {
      setFilter('activeFilter', val);
      setPage(1);
    },
    [setFilter, setPage]
  );

  const setSortBy = useCallback(
    (val: ClientSortOptionType) => {
      setFilter('sortBy', val);
      setPage(1);
    },
    [setFilter, setPage]
  );

  const [refreshing, setRefreshing] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 25 | 50 | 100>(10);
  const querySeqRef = React.useRef(0);
  const mobileQueryCacheRef = React.useRef<Map<string, MobileQueryCacheEntry>>(new Map());

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilter !== 'all') count++;
    if (debouncedSearch.trim() !== '') count++;
    if (sortBy !== 'company_name_asc') count++;
    return count;
  }, [activeFilter, debouncedSearch, sortBy]);

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const handleResetAllFilters = useCallback(() => {
    haptics.success();
    resetListFilters();
  }, [resetListFilters]);

  // Client Modal Form State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [isBillingAddressDifferent, setIsBillingAddressDifferent] = useState(false);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingDistrict, setBillingDistrict] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');
  const [allowanceHours, setAllowanceHours] = useState('0');
  const [allowanceMinutes, setAllowanceMinutes] = useState('0');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_CLIENT_SHIFT_PRESET_ID);

  // Site Modal Form State
  const [siteModalVisible, setSiteModalVisible] = useState(false);
  const [siteTargetClientId, setSiteTargetClientId] = useState<string | null>(null);
  const [siteFormName, setSiteFormName] = useState('');
  const [siteFormStreet, setSiteFormStreet] = useState('');
  const [siteFormCity, setSiteFormCity] = useState('');
  const [siteFormDistrict, setSiteFormDistrict] = useState('');
  const [siteFormStateId, setSiteFormStateId] = useState<number>(27);
  const [siteFormPincode, setSiteFormPincode] = useState('');
  const [isSavingSite, setIsSavingSite] = useState(false);

  // C11 Client Detail State & In-Memory Session Cache
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailClient, setSelectedDetailClient] = useState<ClientItem | null>(null);
  type MobileDetailTab = 'machines' | 'sites' | 'logs' | 'assignments' | 'history' | 'audit';
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileDetailTab | null>(null);
  const [mobileLocationExpanded, setMobileLocationExpanded] = useState(false);
  const [mobileLocationLoading, setMobileLocationLoading] = useState(false);
  const [mobileLocationData, setMobileLocationData] = useState<{ site_address: string; billing_address: string; is_different: boolean } | null>(null);

  const [mobileTabLoading, setMobileTabLoading] = useState<string | null>(null);
  const [mobileMachines, setMobileMachines] = useState<any[]>([]);
  const [mobileSites, setMobileSites] = useState<any[]>([]);
  const [mobileLogs, setMobileLogs] = useState<any[]>([]);
  const [mobileAssignments, setMobileAssignments] = useState<any[]>([]);
  const [mobileHistory, setMobileHistory] = useState<any[]>([]);
  const [mobileAudits, setMobileAudits] = useState<any[]>([]);

  const mobileDetailCacheRef = React.useRef<Map<string, any>>(new Map());


  const [kpis, setKpis] = useState<{
    total: number;
    active: number;
    inactive: number;
    cities: number;
    locationsCovered: number;
  }>({
    total: 0,
    active: 0,
    inactive: 0,
    cities: 0,
    locationsCovered: 0,
  });


  const getMobileCacheKey = useCallback(
    (status: StatusFilter, query: string, sortOption: ClientSortOptionType, pageNum: number, sizeNum: number = 10) =>
      `status=${status}&search=${(query || '').trim().toLowerCase()}&sort=${sortOption}&page=${pageNum}&pageSize=${sizeNum}`,
    []
  );

  const fetchKPIs = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_clients_directory_summary');
      if (!error && data) {
        setKpis({
          total: Number(data.total) || 0,
          active: Number(data.active) || 0,
          inactive: Number(data.inactive) || 0,
          cities: Number(data.cities) || 0,
          locationsCovered: Number(data.locationsCovered ?? data.cities) || 0,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch client directory KPI summary on mobile:', err);
    }
  }, []);

  const fetchClients = useCallback(
    async (
      searchQuery: string,
      statusFilter: StatusFilter,
      sortOption: ClientSortOptionType,
      pageNum: number,
      sizeNum: number = pageSize
    ) => {
      const cacheKey = getMobileCacheKey(statusFilter, searchQuery, sortOption, pageNum, sizeNum);

      // 1. Check in-memory cache (60s TTL) -> 0ms cache hit
      const cached = mobileQueryCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 60000) {
        setClients(cached.clients);
        setTotalCount(cached.total);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. C9 Detection: If clicking Active and existing list query already has status=active
      if (statusFilter === 'active' && !searchQuery) {
        const allKey = getMobileCacheKey('all', '', sortOption, 1, sizeNum);
        const cachedAll = mobileQueryCacheRef.current.get(allKey);
        if (cachedAll && kpis.total === kpis.active) {
          mobileQueryCacheRef.current.set(cacheKey, {
            clients: cachedAll.clients,
            total: kpis.active,
            timestamp: Date.now(),
          });
          setClients(cachedAll.clients);
          setTotalCount(kpis.active);
          setIsLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // 3. C9 Detection: If clicking Inactive and kpis.inactive === 0 (with no search)
      if (statusFilter === 'inactive' && kpis.inactive === 0 && !searchQuery) {
        mobileQueryCacheRef.current.set(cacheKey, {
          clients: [],
          total: 0,
          timestamp: Date.now(),
        });
        setClients([]);
        setTotalCount(0);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }

      const seq = ++querySeqRef.current;
      try {
        setIsLoading(true);
        setFetchError(null);
        // C10 Lean projection: strictly returns CODE, COMPANY & TAX, CONTACT PERSON, PHONE, SITE LOCATION, STATUS
        // Absolutely zero relations (machines, logs, assignments, audits)
        const CLIENT_PROJECTION =
          'id, client_id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, status, deleted_at, maintenance_allowance_minutes, client_sites(id, site_code, site_name, city, status)';

        let dbQuery = supabase
          .from('clients')
          .select(CLIENT_PROJECTION, { count: 'exact' });

        // Status filter
        if (statusFilter === 'active') {
          dbQuery = dbQuery.eq('status', 'active').is('deleted_at', null);
        } else if (statusFilter === 'inactive') {
          dbQuery = dbQuery.or('status.eq.inactive,deleted_at.not.is.null');
        }

        // Server-side full-text search across all 9 indexed dimensions
        const s = (searchQuery || '').trim().replace(/[,()"\\]/g, '');
        if (s) {
          dbQuery = dbQuery.or(
            `company_name.ilike.%${s}%,client_id.ilike.%${s}%,code.ilike.%${s}%,gstin.ilike.%${s}%,pan_number.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,district.ilike.%${s}%,state.ilike.%${s}%`
          );
        }

        const from = (pageNum - 1) * sizeNum;
        const to = from + sizeNum - 1;

        let orderCol = 'company_name';
        let ascending = true;

        if (sortOption === 'company_name_desc') {
          orderCol = 'company_name';
          ascending = false;
        } else if (sortOption === 'code_asc') {
          orderCol = 'code';
          ascending = true;
        } else if (sortOption === 'code_desc') {
          orderCol = 'code';
          ascending = false;
        } else if (sortOption === 'created_at_desc') {
          orderCol = 'created_at';
          ascending = false;
        } else if (sortOption === 'created_at_asc') {
          orderCol = 'created_at';
          ascending = true;
        }

        dbQuery = dbQuery.order(orderCol, { ascending }).range(from, to);

        const { data, count, error } = await dbQuery;

        // Discard stale responses if newer query fired
        if (seq !== querySeqRef.current) return;

        if (error) throw error;
        if (data && data.length > 0) {
          // Defensive deduplication by client ID and normalized company name
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          const clientData: ClientItem[] = [];

          for (const item of (data as any[])) {
            if (!item || !item.id) continue;
            const normName = (item.company_name || '').trim().toLowerCase();
            if (seenIds.has(item.id) || (normName && seenNames.has(normName))) continue;
            seenIds.add(item.id);
            if (normName) seenNames.add(normName);

            const sites = Array.isArray(item.client_sites) ? item.client_sites : [];
            clientData.push({
              ...item,
              client_sites: sites,
              site_count: sites.length,
            });
          }

          const finalCount = count ?? clientData.length;
          mobileQueryCacheRef.current.set(cacheKey, {
            clients: clientData,
            total: finalCount,
            timestamp: Date.now(),
          });
          setClients(clientData);
          setTotalCount(finalCount);
        } else if (count === 0 || !data || data.length === 0) {
          mobileQueryCacheRef.current.set(cacheKey, {
            clients: [],
            total: 0,
            timestamp: Date.now(),
          });
          setClients([]);
          setTotalCount(0);
        }
      } catch (err: any) {
        if (seq !== querySeqRef.current) return;
        console.warn('Clients server query error:', err);
        setFetchError(err instanceof Error ? err : new Error(err?.message || 'Failed to fetch client records.'));
        setClients([]);
        setTotalCount(0);
      } finally {
        if (seq === querySeqRef.current) {
          setIsLoading(false);
          setRefreshing(false);
        }
      }
    },
    [getMobileCacheKey, pageSize, kpis.total, kpis.active, kpis.inactive]
  );

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    fetchClients(debouncedSearch, activeFilter, sortBy, page, pageSize);
  }, [debouncedSearch, activeFilter, sortBy, page, pageSize, fetchClients]);

  const onRefresh = () => {
    mobileQueryCacheRef.current.clear();
    setRefreshing(true);
    fetchKPIs();
    fetchClients(debouncedSearch, activeFilter, sortBy, page, pageSize);
  };

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const handleFilterChange = (filter: StatusFilter) => {
    if (filter === activeFilter) return;
    setActiveFilter(filter);
    setPage(1);
  };

  const totalFiltered = totalCount;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedClients = clients;

  const handleOpenAdd = () => {
    setEditingClient(null);
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setGstin('');
    setPanNumber('');
    setAddress('');
    setCity('');
    setDistrict('');
    setStateName('');
    setPincode('');
    setIsBillingAddressDifferent(false);
    setBillingAddress('');
    setBillingCity('');
    setBillingDistrict('');
    setBillingState('');
    setBillingPincode('');
    setAllowanceHours('0');
    setAllowanceMinutes('0');
    setSelectedPresetId(DEFAULT_CLIENT_SHIFT_PRESET_ID);
    setModalVisible(true);
  };

  const handleOpenEdit = (client: ClientItem) => {
    setEditingClient(client);
    setCompanyName(client.company_name);
    setContactPerson(client.contact_person || '');
    setPhone(client.phone || '');
    setGstin(client.gstin || '');
    setPanNumber(client.pan_number || '');
    setAddress(client.street || client.address || '');
    setCity(client.city || '');
    setDistrict(client.district || '');
    setStateName(client.state || '');
    setPincode(client.pincode || '');
    setIsBillingAddressDifferent(Boolean(client.is_billing_address_different));
    setBillingAddress(client.billing_address || '');
    setBillingCity(client.billing_city || '');
    setBillingDistrict(client.billing_district || '');
    setBillingState(client.billing_state || '');
    setBillingPincode(client.billing_pincode || '');
    const totalMin = client.maintenance_allowance_minutes ?? 0;
    setAllowanceHours(String(Math.floor(totalMin / 60)));
    setAllowanceMinutes(String(totalMin % 60));
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!companyName.trim()) {
      toast('warning', 'Validation Error', 'Please enter a valid company name.');
      return;
    }

    const normEntered = companyName.trim().toLowerCase();
    const isDuplicate = clients.some(
      (c) => c.company_name.trim().toLowerCase() === normEntered && (!editingClient || c.id !== editingClient.id)
    );
    if (isDuplicate) {
      toast(
        'warning',
        'Duplicate Client',
        `A client named "${companyName.trim()}" already exists. Each client company can only be registered once.`
      );
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
      toast('warning', 'Validation Error', 'Address, City, and State are required fields.');
      return;
    }

    const streetVal = address.trim();
    const fullUnifiedAddress = [streetVal, city.trim(), district.trim(), stateName.trim(), pincode.trim()]
      .filter(Boolean)
      .join(', ');

    const parsedAllowanceMin = Math.max(0, (parseInt(allowanceHours, 10) || 0) * 60 + (parseInt(allowanceMinutes, 10) || 0));

    if (editingClient) {
      const prevClients = clients;
      const updatedClient: ClientItem = {
        ...editingClient,
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan_number: panNumber.trim().toUpperCase(),
        street: streetVal,
        address: fullUnifiedAddress || streetVal,
        city: city.trim(),
        district: district.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        is_billing_address_different: isBillingAddressDifferent,
        billing_address: isBillingAddressDifferent ? billingAddress.trim() : undefined,
        billing_city: isBillingAddressDifferent ? billingCity.trim() : undefined,
        billing_district: isBillingAddressDifferent ? billingDistrict.trim() : undefined,
        billing_state: isBillingAddressDifferent ? billingState.trim() : undefined,
        billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : undefined,
        maintenance_allowance_minutes: parsedAllowanceMin,
      };
      setClients((prev) => prev.map((c) => (c.id === editingClient.id ? updatedClient : c)));
      mobileQueryCacheRef.current.clear();
      setModalVisible(false);
      toast('success', 'Client Updated', `Details for ${companyName.trim()} have been saved.`);

      (async () => {
        try {
          const updatePayload: any = {
            company_name: companyName.trim(),
            contact_person: contactPerson.trim() || null,
            phone: phone.trim() || null,
            gstin: gstin.trim().toUpperCase() || null,
            pan_number: panNumber.trim().toUpperCase() || null,
            street: streetVal,
            city: city.trim(),
            district: district.trim() || null,
            state: stateName.trim(),
            pincode: pincode.trim() || null,
            is_billing_address_different: isBillingAddressDifferent,
            billing_address: isBillingAddressDifferent ? billingAddress.trim() : null,
            billing_city: isBillingAddressDifferent ? billingCity.trim() : null,
            billing_district: isBillingAddressDifferent ? billingDistrict.trim() : null,
            billing_state: isBillingAddressDifferent ? billingState.trim() : null,
            billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : null,
            maintenance_allowance_minutes: parsedAllowanceMin,
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabase.from('clients').update(updatePayload).eq('id', editingClient.id);
          if (error) throw error;
        } catch (err: any) {
          setClients(prevClients);
          toast('error', 'Update Failed', err?.message || 'Failed to update client on server.');
        }
      })();
    } else {
      const tempId = createTempId('cli');
      const nextNum = clients.length + 1;
      const code = `CLI-${nextNum.toString().padStart(4, '0')}`;
      const newClient: ClientItem = {
        id: tempId,
        client_id: code,
        code,
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan_number: panNumber.trim().toUpperCase(),
        street: streetVal,
        address: fullUnifiedAddress || streetVal,
        city: city.trim(),
        district: district.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        is_billing_address_different: isBillingAddressDifferent,
        billing_address: isBillingAddressDifferent ? billingAddress.trim() : undefined,
        billing_city: isBillingAddressDifferent ? billingCity.trim() : undefined,
        billing_district: isBillingAddressDifferent ? billingDistrict.trim() : undefined,
        billing_state: isBillingAddressDifferent ? billingState.trim() : undefined,
        billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : undefined,
        maintenance_allowance_minutes: parsedAllowanceMin,
        status: 'active',
      };
      setClients([newClient, ...clients]);
      mobileQueryCacheRef.current.clear();
      setModalVisible(false);
      toast('success', 'Client Registered', `Client ${companyName.trim()} registered successfully.`);

      (async () => {
        try {
          const insertPayload: any = {
            code,
            company_name: companyName.trim(),
            contact_person: contactPerson.trim() || null,
            phone: phone.trim() || null,
            gstin: gstin.trim().toUpperCase() || null,
            pan_number: panNumber.trim().toUpperCase() || null,
            street: streetVal,
            city: city.trim(),
            district: district.trim() || null,
            state: stateName.trim(),
            pincode: pincode.trim() || null,
            is_billing_address_different: isBillingAddressDifferent,
            billing_address: isBillingAddressDifferent ? billingAddress.trim() : null,
            billing_city: isBillingAddressDifferent ? billingCity.trim() : null,
            billing_district: isBillingAddressDifferent ? billingDistrict.trim() : null,
            billing_state: isBillingAddressDifferent ? billingState.trim() : null,
            billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : null,
            maintenance_allowance_minutes: parsedAllowanceMin,
          };
          const { data, error } = await supabase.from('clients').insert(insertPayload).select().single();
          if (error) throw error;
          if (data) {
            setClients((current) => reconcileRow(current, tempId, data as any));
            if (selectedPresetId && selectedPresetId !== 'none') {
              const preset = getClientShiftPresetById(selectedPresetId);
              if (preset && preset.shifts.length > 0) {
                const shiftRecords = preset.shifts.map((s) => ({
                  client_id: data.id,
                  code: s.code,
                  name: s.name,
                  start_time: s.startTime,
                  end_time: s.endTime,
                  scheduled_minutes: s.scheduledMinutes,
                  normal_minutes: s.normalMinutes,
                  crosses_midnight: s.crossesMidnight,
                  display_order: s.displayOrder,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                }));
                await supabase.from('client_shift_codes').insert(shiftRecords);
              }
            }
          }
        } catch (err: any) {
          setClients((current) => removeTempRow(current, tempId));
          toast('error', 'Registration Failed', err?.message || 'Failed to save new client to server.');
        }
      })();
    }
  };

  const handleOpenAddSite = (targetClientId?: string) => {
    setSiteTargetClientId(targetClientId || selectedDetailClient?.id || null);
    setSiteFormName('');
    setSiteFormStreet('');
    setSiteFormCity('');
    setSiteFormDistrict('');
    setSiteFormStateId(27);
    setSiteFormPincode('');
    setSiteModalVisible(true);
  };

  const handleSaveSite = async () => {
    const cId = siteTargetClientId || selectedDetailClient?.id;
    if (!cId) {
      toast('warning', 'Validation Error', 'Please select a client.');
      return;
    }
    if (!siteFormName.trim()) {
      toast('warning', 'Validation Error', 'Site name is required.');
      return;
    }
    if (!siteFormStreet.trim()) {
      toast('warning', 'Validation Error', 'Street / Area is required.');
      return;
    }
    if (!siteFormCity.trim()) {
      toast('warning', 'Validation Error', 'City / Town is required.');
      return;
    }
    if (!siteFormDistrict.trim()) {
      toast('warning', 'Validation Error', 'District is required.');
      return;
    }
    if (!siteFormPincode.trim() || siteFormPincode.length !== 6) {
      toast('warning', 'Validation Error', 'A valid 6-digit pincode is required.');
      return;
    }

    setIsSavingSite(true);
    try {
      const { data, error } = await supabase
        .from('client_sites')
        .insert({
          client_id: cId,
          site_name: siteFormName.trim(),
          street: siteFormStreet.trim(),
          city: siteFormCity.trim(),
          district: siteFormDistrict.trim(),
          state_id: siteFormStateId,
          pincode: siteFormPincode.trim(),
        })
        .select('id, site_code, site_name, street, city, district, state_id, pincode, status')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast('warning', 'Duplicate Site', 'A site with this address or name already exists for this client.');
        } else {
          toast('error', 'Error', error.message || 'Failed to create site.');
        }
        return;
      }

      toast('success', 'Site Created', `Site "${siteFormName}" created successfully (${data.site_code}).`);
      setSiteModalVisible(false);
      if (cId) {
        mobileDetailCacheRef.current.delete(`${cId}:sites`);
        if (selectedDetailClient?.id === cId) {
          handleMobileTabChange('sites');
        }
      }
    } catch (err: any) {
      toast('error', 'Error', err.message || 'Failed to create site.');
    } finally {
      setIsSavingSite(false);
    }
  };

  const handleSoftDelete = (client: ClientItem) => {
    haptics.warning();
    setClientToDelete(client);
  };

  const handleConfirmSoftDelete = async () => {
    if (!clientToDelete) return;
    const client = clientToDelete;
    setIsDeletingClient(true);
    const prevClients = clients;
    mobileQueryCacheRef.current.clear();
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, status: 'inactive', deleted_at: new Date().toISOString() } : c))
    );
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: 'inactive', deleted_at: new Date().toISOString() })
        .eq('id', client.id);
      if (error) {
        setClients(prevClients);
        haptics.reject();
        toast('error', 'Error', error.message || 'Failed to soft delete client.');
      } else {
        haptics.confirm();
        toast('success', 'Client Archived', `"${client.company_name}" has been soft deleted.`);
        setClientToDelete(null);
      }
    } catch (err: any) {
      setClients(prevClients);
      haptics.reject();
      toast('error', 'Error', err?.message || 'Failed to soft delete client.');
    } finally {
      setIsDeletingClient(false);
    }
  };

  // C11 Client Detail Handlers
  const handleOpenDetail = useCallback((client: ClientItem) => {
    setSelectedDetailClient(client);
    setMobileActiveTab(null);
    setMobileLocationExpanded(false);
    setMobileLocationData(null);
    setMobileMachines([]);
    setMobileLogs([]);
    setMobileAssignments([]);
    setMobileHistory([]);
    setMobileAudits([]);
    setMobileTabLoading(null);
    setDetailModalVisible(true);
  }, []);

  const handleToggleMobileLocation = useCallback(async () => {
    if (!selectedDetailClient?.id) return;
    const next = !mobileLocationExpanded;
    setMobileLocationExpanded(next);

    if (next && !mobileLocationData) {
      const cacheKey = `${selectedDetailClient.id}:location`;
      const cached = mobileDetailCacheRef.current.get(cacheKey);
      if (cached) {
        setMobileLocationData(cached);
        return;
      }
      try {
        setMobileLocationLoading(true);
        const { data } = await supabase
          .from('clients')
          .select('street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode')
          .eq('id', selectedDetailClient.id)
          .single();
        if (data) {
          const street = (data.street || '').trim();
          const site = [street, data.city, data.district, data.state, data.pincode].filter(Boolean).join(', ');
          const billing = data.is_billing_address_different
            ? [data.billing_address, data.billing_city, data.billing_district, data.billing_state, data.billing_pincode].filter(Boolean).join(', ')
            : site;
          const loc = {
            site_address: site || '—',
            billing_address: billing || 'Same as site location',
            is_different: !!data.is_billing_address_different,
          };
          setMobileLocationData(loc);
          mobileDetailCacheRef.current.set(cacheKey, loc);
        }
      } catch (e) {
        console.warn('Failed to fetch mobile client location on demand:', e);
      } finally {
        setMobileLocationLoading(false);
      }
    }
  }, [selectedDetailClient?.id, mobileLocationExpanded, mobileLocationData]);

  const handleMobileTabChange = useCallback(
    async (tab: 'machines' | 'sites' | 'logs' | 'assignments' | 'history' | 'audit') => {
      setMobileActiveTab(tab);
      if (!selectedDetailClient?.id) return;

      const clientId = selectedDetailClient.id;
      const cacheKey = `${clientId}:${tab}`;
      const cached = mobileDetailCacheRef.current.get(cacheKey);
      if (cached) {
        if (tab === 'machines') setMobileMachines(cached);
        if (tab === 'sites') setMobileSites(cached);
        if (tab === 'logs') setMobileLogs(cached);
        if (tab === 'assignments') setMobileAssignments(cached);
        if (tab === 'history') setMobileHistory(cached);
        if (tab === 'audit') setMobileAudits(cached);
        return;
      }

      setMobileTabLoading(tab);
      try {
        if (tab === 'machines') {
          const { data } = await supabase
            .from('machines')
            .select('id, machine_id, model, status, health_status, serial_number')
            .eq('client_id', clientId)
            .order('machine_id', { ascending: true });
          const res = data || [];
          setMobileMachines(res);
          mobileDetailCacheRef.current.set(cacheKey, res);
        } else if (tab === 'sites') {
          const { data } = await supabase
            .from('client_sites')
            .select('id, site_code, site_name, street, city, district, state_id, pincode, status, states!inner(name)')
            .eq('client_id', clientId)
            .order('site_code', { ascending: true });
          const res = (data || []).map((r: any) => ({
            ...r,
            state_name: r.states?.name || '',
          }));
          setMobileSites(res);
          mobileDetailCacheRef.current.set(cacheKey, res);
        } else if (tab === 'logs') {
          const { data } = await supabase
            .from('machine_hour_logs')
            .select('id, log_date, start_meter, end_meter, running_hours, shift, is_breakdown, machines!inner(machine_id, model), users!operator_id(full_name)')
            .eq('client_id', clientId)
            .order('log_date', { ascending: false })
            .limit(20);
          const res = (data || []).map((l: any) => ({
            id: l.id,
            log_date: l.log_date,
            running_hours: l.running_hours,
            start_meter: l.start_meter,
            end_meter: l.end_meter,
            is_breakdown: !!l.is_breakdown,
            machine_code: Array.isArray(l.machines) ? l.machines[0]?.machine_id : l.machines?.machine_id || '—',
            operator_name: Array.isArray(l.users) ? l.users[0]?.full_name : l.users?.full_name || '—',
          }));
          setMobileLogs(res);
          mobileDetailCacheRef.current.set(cacheKey, res);
        } else if (tab === 'assignments') {
          const [assignmentsRes, shiftsRes] = await Promise.all([
            supabase
              .from('operator_machine_assignments')
              .select('id, shift_code, shift_start_time, shift_end_time, is_active, machines!inner(machine_id, model, client_id), users!operator_id(full_name, phone)')
              .eq('machines.client_id', clientId)
              .order('is_active', { ascending: false }),
            supabase
              .from('client_shift_codes')
              .select('code, name, start_time, end_time')
              .eq('client_id', clientId),
          ]);
          const shiftsMap = new Map((shiftsRes.data || []).map((s: any) => [String(s.code).toUpperCase(), s]));
          const res = (assignmentsRes.data || []).map((a: any) => {
            const sc = a.shift_code ? shiftsMap.get(String(a.shift_code).toUpperCase()) : null;
            const shiftName = sc?.name || (a.shift_code ? `Shift ${a.shift_code}` : '');
            const timing = a.shift_start_time && a.shift_end_time
              ? `${String(a.shift_start_time).slice(0, 5)} - ${String(a.shift_end_time).slice(0, 5)}`
              : '';
            return {
              id: a.id,
              shift: timing || '08:00 - 16:00',
              shift_code: a.shift_code || null,
              shift_name: shiftName,
              is_active: !!a.is_active,
              machine_code: Array.isArray(a.machines) ? a.machines[0]?.machine_id : a.machines?.machine_id || '—',
              operator_name: Array.isArray(a.users) ? a.users[0]?.full_name : a.users?.full_name || '—',
              operator_phone: Array.isArray(a.users) ? a.users[0]?.phone : a.users?.phone || '',
            };
          });
          setMobileAssignments(res);
          mobileDetailCacheRef.current.set(cacheKey, res);
        } else if (tab === 'history') {
          const [cRes, mRes] = await Promise.all([
            supabase.from('clients').select('created_at, code').eq('id', clientId).single(),
            supabase.from('machines').select('machine_id, created_at').eq('client_id', clientId),
          ]);
          const events: Array<{ id: string; title: string; desc: string; date: string }> = [];
          if (cRes.data?.created_at) {
            events.push({
              id: 'c-created',
              title: 'Account Registered',
              desc: `Client created under code ${cRes.data.code}`,
              date: cRes.data.created_at,
            });
          }
          if (mRes.data && mRes.data.length > 0) {
            events.push({
              id: 'm-deployed',
              title: 'Fleet Deployed',
              desc: `${mRes.data.length} equipment units allocated to account`,
              date: mRes.data[0]?.created_at || new Date().toISOString(),
            });
          }
          setMobileHistory(events);
          mobileDetailCacheRef.current.set(cacheKey, events);
        } else if (tab === 'audit') {
          const { data } = await supabase
            .from('audit_logs')
            .select('id, action, actor_name, severity, created_at')
            .or(`entity_id.eq.${clientId},details->>clientId.eq.${clientId}`)
            .order('created_at', { ascending: false })
            .limit(20);
          const res = data || [];
          setMobileAudits(res);
          mobileDetailCacheRef.current.set(cacheKey, res);
        }
      } catch (e) {
        console.warn('Failed to load mobile client tab data:', e);
      } finally {
        setMobileTabLoading(null);
      }
    },
    [selectedDetailClient?.id]
  );

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    list.push({
      id: 'add-client',
      label: 'Add New Client',
      icon: <Plus size={16} color={theme.colors.ink} />,
      onPress: () => handleOpenAdd(),
    });

    list.push({
      id: 'refresh-clients',
      label: 'Refresh Client Directory',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => onRefresh(),
    });

    return list;
  }, [theme.colors.ink, onRefresh]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [3-Dot Actions] */}
      <MobileHeader
        title="Client Directory"
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle={isDark ? 'white' : 'black'}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0070f3" />}
      >
        {/* Interactive 4-Card KPI Metric Grid */}
        <KPIGrid columns={4}>
          <KPICard
            label="Total Accounts"
            value={kpis.total}
            icon={Building2}
            variant="default"
            active={activeFilter === 'all'}
            onPress={() => handleFilterChange('all')}
          />

          <KPICard
            label="Active Accounts"
            value={kpis.active}
            icon={CheckCircle2}
            variant="success"
            active={activeFilter === 'active'}
            onPress={() => handleFilterChange(activeFilter === 'active' ? 'all' : 'active')}
          />

          <KPICard
            label="Inactive / Churn"
            value={kpis.inactive}
            icon={AlertTriangle}
            variant={kpis.inactive > 0 ? 'warning' : 'default'}
            active={activeFilter === 'inactive'}
            onPress={() => handleFilterChange(activeFilter === 'inactive' ? 'all' : 'inactive')}
          />

          <KPICard
            label="Active Cities"
            value={kpis.locationsCovered || kpis.cities}
            icon={MapPin}
            variant="info"
            onPress={() => handleFilterChange('all')}
          />
        </KPIGrid>

        {/* Canonical Reusable FilterToolbar & Search Architecture */}
        <FilterToolbar
          searchQuery={search}
          onSearchChange={handleSearchChange}
          placeholder="Search company, code, GST, PAN, city, state..."
          searchVariant="pill"
          isLoading={isSearching}
          showFilterToggle={true}
          isFilterOpen={filterPanelOpen}
          onToggleFilter={() => {
            haptics.select();
            setFilterPanelOpen((prev) => !prev);
          }}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetAllFilters}
          style={{ marginBottom: spacingNumeric.md }}
        >
          {/* Active Filter Chips Row */}
          {activeFilterCount > 0 && (
            <View style={[styles.activeBadgesRow, { borderTopColor: theme.colors.hairline }]}>
              <Text style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
                Active Filters:
              </Text>

              {debouncedSearch.trim() !== '' && (
                <Pressable
                  variant="chip"
                  haptic="select"
                  onPress={() => handleSearchChange('')}
                  style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.badgeChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                    Search: "{debouncedSearch}"
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </Pressable>
              )}

              {activeFilter !== 'all' && (
                <Pressable
                  variant="chip"
                  haptic="select"
                  onPress={() => handleFilterChange('all')}
                  style={[
                    styles.badgeChip,
                    {
                      backgroundColor:
                        activeFilter === 'active'
                          ? isDark ? '#064e3b26' : '#ecfdf5'
                          : isDark ? '#78350f26' : '#fffbeb',
                      borderColor: activeFilter === 'active' ? '#10b98133' : '#f59e0b33',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeChipText,
                      { color: activeFilter === 'active' ? '#059669' : '#d97706' },
                    ]}
                  >
                    Status: {CLIENT_STATUS_FILTER_OPTIONS.find((s) => s.id === activeFilter)?.label || activeFilter}
                  </Text>
                  <X size={12} color={activeFilter === 'active' ? '#059669' : '#d97706'} />
                </Pressable>
              )}

              {sortBy !== 'company_name_asc' && (
                <Pressable
                  variant="chip"
                  haptic="select"
                  onPress={() => setSortBy('company_name_asc')}
                  style={[styles.badgeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}
                >
                  <Text style={[styles.badgeChipText, { color: theme.colors.ink }]}>
                    Sort: {CLIENT_SORT_OPTIONS.find((s) => s.id === sortBy)?.label || sortBy}
                  </Text>
                  <X size={12} color={theme.colors.mute} />
                </Pressable>
              )}

              <Pressable variant="buttonGhost" hitSlopToMin48 onPress={handleResetAllFilters} style={styles.resetAllLink}>
                <RotateCcw size={11} color={theme.colors.link} />
                <Text style={[styles.resetAllLinkText, { color: theme.colors.link }]}>
                  Reset all
                </Text>
              </Pressable>
            </View>
          )}
        </FilterToolbar>

        {/* Canonical Reusable FilterSidebar Drawer */}
        <FilterSidebar
          visible={filterPanelOpen}
          onClose={() => setFilterPanelOpen(false)}
          title="Filters & Sorting"
          activeFilterCount={activeFilterCount}
          onResetAll={handleResetAllFilters}
          applyText={`Show ${totalFiltered} ${totalFiltered === 1 ? 'Client' : 'Clients'}`}
          onApply={() => setFilterPanelOpen(false)}
          testID="client-filter-sidebar"
        >
          {/* Category 1: Status */}
          <FilterCategoryCard
            title="Client Status"
            isFiltered={activeFilter !== 'all'}
            testID="category-client-status"
          >
            <DropdownFilterSelector
              label="Client Status"
              value={activeFilter}
              options={CLIENT_STATUS_FILTER_OPTIONS}
              onChange={(val) => handleFilterChange(val as StatusFilter)}
              minMenuWidth={280}
            />
          </FilterCategoryCard>

          {/* Category 2: Sorting Order */}
          <FilterCategoryCard
            title="Sort By"
            isFiltered={sortBy !== 'company_name_asc'}
            badgeLabel="Custom"
            testID="category-client-sorting"
          >
            <DropdownFilterSelector
              label="Sort By"
              value={sortBy}
              options={CLIENT_SORT_OPTIONS}
              onChange={(val) => {
                setSortBy(val as ClientSortOptionType);
                setPage(1);
              }}
              minMenuWidth={280}
            />
          </FilterCategoryCard>
        </FilterSidebar>

        {/* Client Cards List */}
        <View style={styles.listContainer}>
          {isLoading || isSearching ? (
            <ClientListSkeleton count={4} />
          ) : fetchError ? (
            <ErrorState
              error={fetchError}
              onRetry={onRefresh}
              retryLabel="Retry Loading Clients"
            />
          ) : paginatedClients.length === 0 ? (
            debouncedSearch.trim() ? (
              <EmptyState
                variant="no-results"
                title="No Clients Found"
                description={`No client records matched "${debouncedSearch.trim()}".`}
                actionLabel="Clear Search"
                onAction={() => handleSearchChange('')}
              />
            ) : activeFilter !== 'all' ? (
              <EmptyState
                variant="filtered"
                title="No Matching Clients"
                description="No clients found matching the selected status filter."
                actionLabel="Show All Clients"
                onAction={() => handleFilterChange('all')}
              />
            ) : (
              <EmptyState
                title="No Clients Registered"
                description="No clients are currently registered in your organization."
                actionLabel="Refresh Directory"
                onAction={() => {
                  void onRefresh();
                }}
              />
            )
          ) : (
            paginatedClients.map((item) => (
              <MobileClientCard
                key={item.id}
                client={item}
                canManageClients={true}
                searchTerm={debouncedSearch}
                onViewDetails={handleOpenDetail}
                onEdit={handleOpenEdit}
                onDelete={handleSoftDelete}
                onAddSite={(c) => handleOpenAddSite(c.id)}
              />
            ))
          )}
        </View>

        {/* Canonical Server-Side Pagination & Page Size Selector */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalCount={totalFiltered}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize as 10 | 25 | 50 | 100);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </ScrollView>

      {/* Add / Edit Client Modal */}
      <ClientModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingClient={editingClient}
        companyName={companyName}
        setCompanyName={setCompanyName}
        contactPerson={contactPerson}
        setContactPerson={setContactPerson}
        phone={phone}
        setPhone={setPhone}
        gstin={gstin}
        setGstin={setGstin}
        panNumber={panNumber}
        setPanNumber={setPanNumber}
        address={address}
        setAddress={setAddress}
        city={city}
        setCity={setCity}
        district={district}
        setDistrict={setDistrict}
        stateName={stateName}
        setStateName={setStateName}
        pincode={pincode}
        setPincode={setPincode}
        isBillingAddressDifferent={isBillingAddressDifferent}
        setIsBillingAddressDifferent={setIsBillingAddressDifferent}
        billingAddress={billingAddress}
        setBillingAddress={setBillingAddress}
        billingCity={billingCity}
        setBillingCity={setBillingCity}
        billingDistrict={billingDistrict}
        setBillingDistrict={setBillingDistrict}
        billingState={billingState}
        setBillingState={setBillingState}
        billingPincode={billingPincode}
        setBillingPincode={setBillingPincode}
        allowanceHours={allowanceHours}
        setAllowanceHours={setAllowanceHours}
        allowanceMinutes={allowanceMinutes}
        setAllowanceMinutes={setAllowanceMinutes}
        selectedPresetId={selectedPresetId}
        setSelectedPresetId={setSelectedPresetId}
        onSave={handleSave}
      />

      {/* Client Detail Modal */}
      <ClientDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        client={selectedDetailClient}
        mobileLocationExpanded={mobileLocationExpanded}
        mobileLocationLoading={mobileLocationLoading}
        mobileLocationData={mobileLocationData}
        onToggleMobileLocation={handleToggleMobileLocation}
        mobileActiveTab={mobileActiveTab}
        mobileTabLoading={mobileTabLoading}
        onMobileTabChange={handleMobileTabChange}
        mobileMachines={mobileMachines}
        mobileSites={mobileSites}
        mobileLogs={mobileLogs}
        mobileAssignments={mobileAssignments}
        mobileHistory={mobileHistory}
        mobileAudits={mobileAudits}
        onOpenAddSite={handleOpenAddSite}
        onOpenEdit={handleOpenEdit}
      />

      {/* Add Client Site Modal */}
      <ClientSiteModal
        visible={siteModalVisible}
        onClose={() => setSiteModalVisible(false)}
        siteTargetClientId={siteTargetClientId}
        targetClientName={
          siteTargetClientId
            ? (clients.find((c) => c.id === siteTargetClientId)?.company_name || 'Existing Client')
            : undefined
        }
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

      <ConfirmDialog
        visible={Boolean(clientToDelete)}
        onClose={() => setClientToDelete(null)}
        onConfirm={handleConfirmSoftDelete}
        title={`Soft Delete "${clientToDelete?.company_name || 'Client'}"?`}
        message={`Are you sure you want to archive "${clientToDelete?.company_name || 'this client'}"? Historical logs will remain 100% intact.`}
        confirmText="Soft Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacingNumeric.md },
  activeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1 },
  activeBadgesHeader: {
    marginRight: 2 },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radiusNumeric.full,
    borderWidth: 1 },
  badgeChipText: {
    },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4 },
  resetAllLinkText: {
    },
  listContainer: { gap: spacingNumeric.sm },
  emptyCard: { padding: spacingNumeric.lg, alignItems: 'center' },
  emptyText: { },
  codeText: {
    },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacingNumeric.md },
  modalContent: { borderRadius: radiusNumeric.lg, padding: spacingNumeric.md, gap: spacingNumeric.sm, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { },
  formSection: { marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  sectionTitle: { textTransform: 'uppercase', marginBottom: 8 },
  formGroup: { marginBottom: 8 },
  rowInputs: { flexDirection: 'row', gap: 8 },
  fieldLabel: { marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: radiusNumeric.sm, paddingHorizontal: 10, paddingVertical: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 4 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1 },
  pageBtnText: { },
  pageIndicator: { fontVariant: ['tabular-nums'] },
  pageSizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 20 },
  pageSizeLabel: { },
  pageSizeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, minHeight: 32, justifyContent: 'center', alignItems: 'center' },
  pageSizeChipText: { },
  detailTabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radiusNumeric.full, borderWidth: 1, minHeight: 44 },
  detailTabChipText: { },
  detailSectionCard: { borderWidth: 1, borderRadius: radiusNumeric.sm, padding: 10 },
  detailCardTitle: { textTransform: 'uppercase' },
  detailTextSmall: { },
  detailItemCard: { borderWidth: 1, borderRadius: radiusNumeric.sm, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 } });
