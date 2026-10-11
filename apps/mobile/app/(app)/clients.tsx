import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator, Linking, Animated, Easing, Platform } from 'react-native';
import { Pressable } from '../../components/ui/touch/Pressable';
import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem, KPICard, KPIGrid, FilterToolbar, Text, useTypeStyle, AppModal, Switch, useToast } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Building2, MapPin, Phone, Mail, Plus, Edit2, Trash2, X, CheckCircle2, ShieldAlert, ReceiptText, RefreshCw, Truck, Clock, UserCheck, History, ShieldCheck, ChevronDown, ChevronUp, Lock, Wrench, AlertCircle, Sparkles, AlertTriangle, SlidersHorizontal, RotateCcw } from '../../components/ui/icon';
import { haptics } from '../../lib/haptics';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { ClientListSkeleton, MobileClientCard } from '../../components/clients';
import { DropdownFilterSelector, type FilterOption } from '../../components/machines';
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

const INITIAL_CLIENTS: ClientItem[] = [
  {
    id: 'cli-001',
    code: 'CLI-0001',
    company_name: 'Metro Construction Corp',
    contact_person: 'Rajesh Sharma',
    phone: '+91 98765 43210',
    gstin: '07AAAAA0000A1Z5',
    pan_number: 'ABCDE1234F',
    address: 'Plot 12, Industrial Area Phase 2',
    city: 'Delhi',
    district: 'New Delhi',
    state: 'Delhi',
    status: 'active',
  },
  {
    id: 'cli-002',
    code: 'CLI-0002',
    company_name: 'ABC Infrastructure Ltd',
    contact_person: 'Suresh Kumar',
    phone: '+91 98123 45678',
    gstin: '06BBBBB0000B1Z6',
    address: 'Sector 34, Cyber City Phase 1',
    city: 'Gurgaon',
    district: 'Gurugram',
    state: 'Haryana',
    status: 'active',
  },
  {
    id: 'cli-003',
    code: 'CLI-0003',
    company_name: 'Global Logistics Hub',
    contact_person: 'Anil Patel',
    phone: '+91 99887 76655',
    address: 'Plot 9, Logistics Park, Ecotech 3',
    city: 'Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    status: 'inactive',
  },
];

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

  useEffect(() => {
    if (role && !canAccessClients) {
      router.replace('/dashboard');
    }
  }, [role, canAccessClients, router]);

  if (role && !canAccessClients) {
    return null;
  }

  const [clients, setClients] = useState<ClientItem[]>(INITIAL_CLIENTS);
  const [totalCount, setTotalCount] = useState<number>(INITIAL_CLIENTS.length);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [panelContentHeight, setPanelContentHeight] = useState(0);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.timing(filterAnim, {
      toValue: filterPanelOpen ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [filterPanelOpen, filterAnim]);

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
    total: INITIAL_CLIENTS.length,
    active: INITIAL_CLIENTS.filter((c) => c.status === 'active').length,
    inactive: INITIAL_CLIENTS.filter((c) => c.status === 'inactive').length,
    cities: 3,
    locationsCovered: 3,
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
      } catch (err) {
        if (seq !== querySeqRef.current) return;
        console.warn('Clients server query error, falling back to mock:', err);
        setClients(INITIAL_CLIENTS);
        setTotalCount(INITIAL_CLIENTS.length);
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
    Alert.alert(
      'Soft Delete Client?',
      `Are you sure you want to soft delete "${client.company_name}"? Historical logs will remain 100% intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Soft Delete',
          style: 'destructive',
          onPress: async () => {
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
                toast('error', 'Error', error.message || 'Failed to soft delete client.');
              } else {
                toast('success', 'Client Archived', `"${client.company_name}" has been soft deleted.`);
              }
            } catch (err: any) {
              setClients(prevClients);
              toast('error', 'Error', err?.message || 'Failed to soft delete client.');
            }
          },
        },
      ]
    );
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
          {/* Collapsible Filter Selectors Drawer */}
          {isWeb ? (
            <div
              style={{
                display: 'grid',
                gridTemplateRows: filterPanelOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden' }}
            >
              <div style={{ minHeight: 0 }}>
                <View style={[styles.filterPanelContent, { borderTopColor: theme.colors.hairline }]}>
                  <View style={styles.filterSelectorsGrid}>
                    <View style={styles.selectorCol}>
                      <DropdownFilterSelector
                        label="Status"
                        value={activeFilter}
                        options={CLIENT_STATUS_FILTER_OPTIONS}
                        onChange={(val) => handleFilterChange(val as StatusFilter)}
                        minMenuWidth={160}
                      />
                    </View>
                    <View style={styles.selectorCol}>
                      <DropdownFilterSelector
                        label="Sort By"
                        value={sortBy}
                        options={CLIENT_SORT_OPTIONS}
                        onChange={(val) => {
                          setSortBy(val as ClientSortOptionType);
                          setPage(1);
                        }}
                        align="right"
                        minMenuWidth={200}
                      />
                    </View>
                  </View>
                </View>
              </div>
            </div>
          ) : (
            <Animated.View
              style={[
                styles.filterPanelAnimatedContainer,
                {
                  maxHeight: filterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(panelContentHeight, 150)],
                  }),
                  opacity: filterAnim,
                },
              ]}
            >
              <View
                onLayout={(e) => setPanelContentHeight(e.nativeEvent.layout.height)}
                style={[styles.filterPanelContent, { borderTopColor: theme.colors.hairline }]}
              >
                <View style={styles.filterSelectorsGrid}>
                  <View style={styles.selectorCol}>
                    <DropdownFilterSelector
                      label="Status"
                      value={activeFilter}
                      options={CLIENT_STATUS_FILTER_OPTIONS}
                      onChange={(val) => handleFilterChange(val as StatusFilter)}
                      minMenuWidth={160}
                    />
                  </View>
                  <View style={styles.selectorCol}>
                    <DropdownFilterSelector
                      label="Sort By"
                      value={sortBy}
                      options={CLIENT_SORT_OPTIONS}
                      onChange={(val) => {
                        setSortBy(val as ClientSortOptionType);
                        setPage(1);
                      }}
                      align="right"
                      minMenuWidth={200}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

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

        {/* Client Cards List */}
        <View style={styles.listContainer}>
          {isLoading || isSearching ? (
            <ClientListSkeleton count={4} />
          ) : paginatedClients.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Building2 size={32} color={theme.colors.mute} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyText, { color: theme.colors.mute }]}>No client records found.</Text>
            </Card>
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <Pressable
              variant="buttonSecondary"
              style={[
                styles.pageBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                page === 1 && { opacity: 0.5 },
              ]}
              disabled={page === 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Previous</Text>
            </Pressable>

            <Text style={[styles.pageIndicator, { color: theme.colors.ink }]}>
              Page {page} of {totalPages}
            </Text>

            <Pressable
              variant="buttonSecondary"
              style={[
                styles.pageBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                page === totalPages && { opacity: 0.5 },
              ]}
              disabled={page === totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Next</Text>
            </Pressable>
          </View>
        )}

        {/* Server-Side Page Size Selector (10, 25, 50, 100) */}
        {totalFiltered > 0 && (
          <View style={styles.pageSizeRow}>
            <Text style={[styles.pageSizeLabel, { color: theme.colors.mute }]}>Rows per page:</Text>
            {([10, 25, 50, 100] as const).map((opt) => (
              <Pressable
                key={opt}
                variant="chip"
                haptic="select"
                style={[
                  styles.pageSizeChip,
                  {
                    backgroundColor: pageSize === opt ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                onPress={() => {
                  if (pageSize !== opt) {
                    setPageSize(opt);
                    setPage(1);
                  }
                }}
              >
                <Text
                  style={[
                    styles.pageSizeChipText,
                    { color: pageSize === opt ? '#ffffff' : theme.colors.ink },
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Client Modal */}
      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                {editingClient ? `Edit (${editingClient.client_id || editingClient.code})` : 'Add New Client'}
              </Text>
              <Pressable variant="iconButton" hitSlopToMin48 onPress={() => setModalVisible(false)} accessibilityLabel="Close modal">
                <X size={20} color={theme.colors.mute} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>Company & Tax Details</Text>
                
                {editingClient && (
                  <View style={styles.formGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.ink, marginBottom: 0 }]}>Client ID</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.canvas, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.hairline }}>
                        <Lock size={10} color="#f59e0b" />
                        <Text variant="mono" style={{ color: theme.colors.mute }}>Permanent</Text>
                      </View>
                    </View>
                    <Input
                      value={editingClient.client_id || editingClient.code}
                      editable={false}
                      style={[styles.modalInput, useTypeStyle('mono'), { borderColor: theme.colors.hairline, color: theme.colors.mute, backgroundColor: theme.colors.canvas }]}
                    />
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Company Name *</Text>
                  <Input
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="e.g. Pushpa Infracon Pvt Ltd"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Contact Person</Text>
                  <Input
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    placeholder="e.g. Rajesh Sharma"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Phone Number</Text>
                  <Input
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g. +91 98765 43210"
                    placeholderTextColor={theme.colors.mute}
                    keyboardType="phone-pad"
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>GSTIN Number</Text>
                    <Input
                      value={gstin}
                      onChangeText={(t: string) => setGstin(t.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      placeholderTextColor={theme.colors.mute}
                      autoCapitalize="characters"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>PAN Number</Text>
                    <Input
                      value={panNumber}
                      onChangeText={(t: string) => setPanNumber(t.toUpperCase())}
                      placeholder="ABCDE1234F"
                      placeholderTextColor={theme.colors.mute}
                      autoCapitalize="characters"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginBottom: 8 }]}>Site Location</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Street / Area *</Text>
                  <Input
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>City / Town / Village *</Text>
                    <Input
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>District</Text>
                    <Input
                      value={district}
                      onChangeText={setDistrict}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>State *</Text>
                    <Input
                      value={stateName}
                      onChangeText={setStateName}
                      placeholder="e.g. Maharashtra"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Pincode</Text>
                    <Input
                      value={pincode}
                      onChangeText={setPincode}
                      placeholder="411001"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      maxLength={6}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginBottom: 0 }]}>Billing Address</Text>
                  <View style={styles.switchWrapper}>
                    <Text style={[styles.switchLabel, { color: theme.colors.ink }]}>Different Address</Text>
                    <Switch
                      value={isBillingAddressDifferent}
                      onValueChange={setIsBillingAddressDifferent}
                      trackColor={{ false: theme.colors.hairline, true: theme.colors.primary }}
                    />
                  </View>
                </View>

                {isBillingAddressDifferent && (
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.formGroup}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing Street / Area</Text>
                      <Input
                        value={billingAddress}
                        onChangeText={setBillingAddress}
                        placeholder="e.g. Corporate HQ, 5th Floor, Tower B, Cyber City"
                        placeholderTextColor={theme.colors.mute}
                        style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                      />
                    </View>

                    <View style={styles.rowInputs}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing City / Town / Village</Text>
                        <Input
                          value={billingCity}
                          onChangeText={setBillingCity}
                          placeholder="e.g. Gurugram"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing District</Text>
                        <Input
                          value={billingDistrict}
                          onChangeText={setBillingDistrict}
                          placeholder="e.g. Gurugram"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>
                    </View>

                    <View style={styles.rowInputs}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing State</Text>
                        <Input
                          value={billingState}
                          onChangeText={setBillingState}
                          placeholder="e.g. Haryana"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing Pincode</Text>
                        <Input
                          value={billingPincode}
                          onChangeText={setBillingPincode}
                          placeholder="122002"
                          placeholderTextColor={theme.colors.mute}
                          keyboardType="numeric"
                          maxLength={6}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Section 4: Monthly Maintenance Allowance */}
              <View style={styles.formSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Wrench size={14} color="#d97706" />
                    <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginBottom: 0 }]}>Monthly Maintenance Allowance</Text>
                  </View>
                  {(parseInt(allowanceHours, 10) > 0 || parseInt(allowanceMinutes, 10) > 0) && (
                    <View style={{ backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d' }}>
                      <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                        {parseInt(allowanceHours, 10) > 0 ? `${allowanceHours}h ` : ''}{parseInt(allowanceMinutes, 10) > 0 ? `${allowanceMinutes}m` : ''} / mo
                      </Text>
                    </View>
                  )}
                </View>

                <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 8 }}>
                  Breakdowns up to this monthly limit per machine are classified as Maintenance instead of B/D. Leave at 0 for no allowance.
                </Text>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Allowance Hours</Text>
                    <Input
                      value={allowanceHours}
                      onChangeText={setAllowanceHours}
                      placeholder="0"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Allowance Minutes</Text>
                    <Input
                      value={allowanceMinutes}
                      onChangeText={setAllowanceMinutes}
                      placeholder="0"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>
              </View>

              {!editingClient && (
                <View style={[styles.formSection, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                      Shift Templates (1-Click Presets)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd' }}>
                      <Sparkles size={10} color={isDark ? '#38bdf8' : '#0284c7'} />
                      <Text variant="caption" style={{ color: isDark ? '#38bdf8' : '#0284c7' }}>
                        Auto Provision
                      </Text>
                    </View>
                  </View>

                  <Text variant="caption" style={{ color: theme.colors.mute, marginBottom: 8 }}>
                    Select an operational shift preset for this client. Shifts will be pre-configured upon creation.
                  </Text>

                  <View style={{ gap: 8 }}>
                    {CLIENT_SHIFT_PRESETS.map((preset) => {
                      const isSelected = selectedPresetId === preset.id;
                      return (
                        <Pressable
                          key={preset.id}
                          variant="cardSelect"
                          haptic="select"
                          onPress={() => setSelectedPresetId(preset.id)}
                          style={{
                            borderWidth: 1.5,
                            borderColor: isSelected ? theme.colors.primary : theme.colors.hairline,
                            backgroundColor: isSelected ? (isDark ? 'rgba(0, 112, 243, 0.1)' : 'rgba(0, 112, 243, 0.05)') : theme.colors.canvasElevated,
                            borderRadius: radiusNumeric.sm,
                            padding: 10,
                            minHeight: 44 }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ color: isSelected ? theme.colors.primary : theme.colors.ink }}>
                              {preset.name}
                            </Text>
                            {isSelected ? (
                              <CheckCircle2 size={16} color={theme.colors.primary} />
                            ) : (
                              <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.mute }} />
                            )}
                          </View>
                          <Text variant="caption" style={{ color: isSelected ? theme.colors.primary : theme.colors.mute, marginBottom: 4 }}>
                            {preset.badge}
                          </Text>
                          {preset.shifts.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                              {preset.shifts.map((s) => (
                                <View
                                  key={s.code}
                                  style={{
                                    backgroundColor: theme.colors.canvas,
                                    borderWidth: 1,
                                    borderColor: theme.colors.hairline,
                                    borderRadius: 4,
                                    paddingHorizontal: 5,
                                    paddingVertical: 2 }}
                                >
                                  <Text variant="mono" style={{ color: theme.colors.ink }}>
                                    {s.code}: {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={handleSave} />
            </View>
        </View>
      </AppModal>

      {/* C11 Client Detail Modal */}
      <AppModal visible={detailModalVisible} onClose={() => setDetailModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, maxHeight: '92%' }]}>
            {/* Header: Summary */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <Text style={[styles.codeText, { color: theme.colors.primary }]}>
                    {selectedDetailClient?.client_id || selectedDetailClient?.code}
                  </Text>
                  {selectedDetailClient?.status && (
                    <Badge
                      status={selectedDetailClient.deleted_at ? 'inactive' : selectedDetailClient.status}
                      customLabel={selectedDetailClient.deleted_at ? 'SOFT DELETED' : selectedDetailClient.status.toUpperCase()}
                    />
                  )}
                  {typeof selectedDetailClient?.maintenance_allowance_minutes === 'number' && selectedDetailClient.maintenance_allowance_minutes > 0 ? (
                    <View style={{ backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : '#fcd34d', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Wrench size={10} color={isDark ? '#fbbf24' : '#d97706'} />
                      <Text variant="caption" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                        MAINT: {Math.floor(selectedDetailClient.maintenance_allowance_minutes / 60)}h{selectedDetailClient.maintenance_allowance_minutes % 60 > 0 ? ` ${selectedDetailClient.maintenance_allowance_minutes % 60}m` : ''}/MO
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={10} color="#dc2626" />
                      <Text variant="caption" style={{ color: '#dc2626' }}>
                        MAINT: NOT ALLOWED
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                  {selectedDetailClient?.company_name}
                </Text>
              </View>
              <Pressable
                variant="iconButton"
                hitSlopToMin48
                onPress={() => setDetailModalVisible(false)}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
                accessibilityLabel="Close detail modal"
              >
                <X size={20} color={theme.colors.mute} />
              </Pressable>
            </View>

            {/* Scrollable Modal Body with Persistent Summary & Operational Tabs */}
            <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10, paddingBottom: 10 }}>
                {/* 1. Primary Contact Card (Immediate / Summary) */}
                <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                  <Text style={[styles.detailCardTitle, { color: theme.colors.primary }]}>
                    Primary Contact
                  </Text>
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>
                      Person: <Text style={{ color: theme.colors.ink }}>{selectedDetailClient?.contact_person || '—'}</Text>
                    </Text>
                    {selectedDetailClient?.phone && (
                      <Pressable
                        variant="buttonGhost"
                        hitSlopToMin48
                        onPress={() => Linking.openURL(`tel:${selectedDetailClient.phone}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                      >
                        <Phone size={12} color={theme.colors.primary} />
                        <Text variant="mono" style={{ color: theme.colors.primary }}>
                          {selectedDetailClient.phone}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* 2. Tax Identifiers Card (Immediate / Summary) */}
                <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                  <Text style={[styles.detailCardTitle, { color: '#7e22ce' }]}>
                    Tax & Statutory Identifiers
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>GSTIN</Text>
                      <Text variant="mono" style={{ color: theme.colors.ink }}>
                        {selectedDetailClient?.gstin || 'Not Registered'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>PAN</Text>
                      <Text variant="mono" style={{ color: theme.colors.ink }}>
                        {selectedDetailClient?.pan_number || '—'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 3. Location & Billing Card (On Demand) */}
                <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.detailCardTitle, { color: '#059669' }]}>
                      Operational & Billing Addresses
                    </Text>
                    <Pressable
                      variant="buttonGhost"
                      hitSlopToMin48
                      onPress={handleToggleMobileLocation}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 6 }}
                    >
                      <Text variant="caption" style={{ color: theme.colors.primary }}>
                        {mobileLocationExpanded ? 'Hide' : 'Load On Demand'}
                      </Text>
                      {mobileLocationExpanded ? <ChevronUp size={12} color={theme.colors.primary} /> : <ChevronDown size={12} color={theme.colors.primary} />}
                    </Pressable>
                  </View>

                  {!mobileLocationExpanded ? (
                    <Text style={{ color: theme.colors.mute, marginTop: 2 }}>
                      {[selectedDetailClient?.street, selectedDetailClient?.city, selectedDetailClient?.state].filter(Boolean).join(', ') || '—'}
                    </Text>
                  ) : mobileLocationLoading ? (
                    <View style={{ paddingVertical: 12, alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Fetching location details...</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.hairline, paddingTop: 6 }}>
                      <View>
                        <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>Site Address:</Text>
                        <Text style={{ color: theme.colors.ink }}>
                          {mobileLocationData?.site_address || '—'}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>Billing Address:</Text>
                        <Text style={{ color: theme.colors.ink }}>
                          {mobileLocationData?.billing_address || 'Same as site location'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* 4. Horizontal Sub-Navigation Tab Strip (5 Operational Tabs) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                  style={{ maxHeight: 48 }}
                >
                  {(
                    [
                      { id: 'machines', label: 'Machines', icon: Truck, count: mobileMachines.length },
                      { id: 'sites', label: 'Sites', icon: MapPin, count: mobileSites.length },
                      { id: 'logs', label: 'Running Logs', icon: Clock, count: mobileLogs.length },
                      { id: 'assignments', label: 'Assignments', icon: UserCheck, count: mobileAssignments.length },
                      { id: 'history', label: 'History', icon: History, count: mobileHistory.length },
                      { id: 'audit', label: 'Audit', icon: ShieldCheck, count: mobileAudits.length },
                    ] as const
                  ).map((tab) => {
                    const isActive = mobileActiveTab === tab.id;
                    const IconComponent = tab.icon;
                    return (
                      <Pressable
                        key={tab.id}
                        variant="chip"
                        haptic="select"
                        onPress={() => handleMobileTabChange(tab.id)}
                        style={[
                          styles.detailTabChip,
                          {
                            backgroundColor: isActive ? theme.colors.primary : theme.colors.canvas,
                            borderColor: isActive ? theme.colors.primary : theme.colors.hairline,
                            minHeight: 44,
                          },
                        ]}
                      >
                        <IconComponent size={12} color={isActive ? '#ffffff' : theme.colors.mute} />
                        <Text
                          style={[
                            styles.detailTabChipText,
                            { color: isActive ? '#ffffff' : theme.colors.ink },
                          ]}
                        >
                          {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* 5. Operational Tab Content Area */}
                {mobileActiveTab === null && (
                  <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas, alignItems: 'center', paddingVertical: 16 }]}>
                    <Text variant="caption" style={{ color: theme.colors.ink }}>
                      Operational Records (On Demand)
                    </Text>
                    <Text variant="caption" style={{ color: theme.colors.mute, textAlign: 'center', marginTop: 4, marginBottom: 10 }}>
                      Select a tab above to load machines, logs, assignments, history, or audit logs on demand.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      <Pressable
                        variant="chip"
                        haptic="select"
                        onPress={() => handleMobileTabChange('machines')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <Truck size={12} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.ink }}>Machines</Text>
                      </Pressable>
                      <Pressable
                        variant="chip"
                        haptic="select"
                        onPress={() => handleMobileTabChange('logs')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <Clock size={12} color="#059669" />
                        <Text style={{ color: theme.colors.ink }}>Running Logs</Text>
                      </Pressable>
                      <Pressable
                        variant="chip"
                        haptic="select"
                        onPress={() => handleMobileTabChange('assignments')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <UserCheck size={12} color="#7e22ce" />
                        <Text style={{ color: theme.colors.ink }}>Assignments</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* TAB: MACHINES */}
                {mobileActiveTab === 'machines' && (
                  <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'machines' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading deployed machines...</Text>
                    </View>
                  ) : mobileMachines.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      No equipment assigned to this client.
                    </Text>
                  ) : (
                    mobileMachines.map((m: any) => (
                      <View key={m.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text variant="mono" style={{ color: theme.colors.primary }}>
                            {m.machine_id}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>{m.model}</Text>
                        </View>
                        <Badge status={m.status === 'rented' || m.status === 'active' ? 'active' : 'inactive'} customLabel={m.status.toUpperCase()} />
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB: SITES */}
              {mobileActiveTab === 'sites' && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text variant="caption" style={{ color: theme.colors.mute, textTransform: 'uppercase' }}>
                      Registered Sites ({mobileSites.length})
                    </Text>
                    <Pressable
                      variant="buttonPrimary"
                      hitSlopToMin48
                      onPress={() => handleOpenAddSite(selectedDetailClient?.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minHeight: 32 }}
                    >
                      <Plus size={12} color="#ffffff" />
                      <Text variant="caption" style={{ color: '#ffffff' }}>Add Site</Text>
                    </Pressable>
                  </View>
                  {mobileTabLoading === 'sites' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading operational sites...</Text>
                    </View>
                  ) : mobileSites.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      No sites registered for this client.
                    </Text>
                  ) : (
                    mobileSites.map((s: any) => (
                      <View key={s.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Text variant="mono" style={{ color: theme.colors.primary }}>
                            {s.site_code}
                          </Text>
                          <Badge status={s.status === 'active' ? 'active' : 'inactive'} customLabel={s.status.toUpperCase()} />
                        </View>
                        <Text style={{ color: theme.colors.ink }}>{s.site_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} color={theme.colors.mute} />
                          <Text variant="caption" style={{ color: theme.colors.mute, flexShrink: 1 }}>
                            {[s.street, s.city, s.district, s.state_name, s.pincode].filter(Boolean).join(', ')}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB: LOGS */}
              {mobileActiveTab === 'logs' && (
                <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'logs' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading running logs...</Text>
                    </View>
                  ) : mobileLogs.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      No running logs recorded.
                    </Text>
                  ) : (
                    mobileLogs.map((l: any) => (
                      <View key={l.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text variant="mono" style={{ color: theme.colors.ink }}>
                            {l.machine_code} • {l.log_date}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Operator: {l.operator_name}</Text>
                        </View>
                        <Text variant="mono" style={{ color: '#059669' }}>
                          {l.running_hours} hrs
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB: ASSIGNMENTS */}
              {mobileActiveTab === 'assignments' && (
                <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'assignments' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading assignments...</Text>
                    </View>
                  ) : mobileAssignments.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      No operator assignments found.
                    </Text>
                  ) : (
                    mobileAssignments.map((a: any) => (
                      <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text style={{ color: theme.colors.ink }}>{a.operator_name}</Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>
                            {a.machine_code} • {a.shift_name || `Shift ${a.shift_code || '1'}`} ({a.shift})
                          </Text>
                        </View>
                        <Badge status={a.is_active ? 'active' : 'inactive'} customLabel={a.is_active ? 'ACTIVE' : 'ENDED'} />
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB: HISTORY */}
              {mobileActiveTab === 'history' && (
                <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'history' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading history...</Text>
                    </View>
                  ) : mobileHistory.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      No timeline history events found.
                    </Text>
                  ) : (
                    mobileHistory.map((h: any) => (
                      <View key={h.id} style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: theme.colors.ink }}>{h.title}</Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>{new Date(h.date).toLocaleDateString()}</Text>
                        </View>
                        <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>{h.desc}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB: AUDIT */}
              {mobileActiveTab === 'audit' && (
                <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'audit' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text variant="caption" style={{ color: theme.colors.mute }}>Loading audit trail...</Text>
                    </View>
                  ) : mobileAudits.length === 0 ? (
                    <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 20, color: theme.colors.mute }}>
                      Zero audit entries logged.
                    </Text>
                  ) : (
                    mobileAudits.map((a: any) => (
                      <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text variant="mono" style={{ color: theme.colors.primary }}>
                            {a.action}
                          </Text>
                          <Text variant="caption" style={{ color: theme.colors.mute }}>Actor: {a.actor_name || 'System'}</Text>
                        </View>
                        <Text variant="caption" style={{ color: theme.colors.mute }}>{formatDate(a.created_at)}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <Button label="Close" variant="outline" onPress={() => setDetailModalVisible(false)} />
              {selectedDetailClient && (
                <Button
                  label="Edit Client"
                  variant="primary"
                  onPress={() => {
                    setDetailModalVisible(false);
                    handleOpenEdit(selectedDetailClient);
                  }}
                />
              )}
            </View>
          </View>
        </AppModal>

      {/* Add Client Site Modal */}
      <AppModal visible={siteModalVisible} onClose={() => setSiteModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>Add Operating Site</Text>
                <Text variant="caption" style={{ color: theme.colors.mute, marginTop: 2 }}>
                  {siteTargetClientId
                    ? (clients.find((c) => c.id === siteTargetClientId)?.company_name || 'Existing Client')
                    : 'Register an operational facility'}
                </Text>
              </View>
              <Pressable variant="iconButton" hitSlopToMin48 onPress={() => setSiteModalVisible(false)} accessibilityLabel="Close site modal">
                <X size={20} color={theme.colors.mute} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Site Name *</Text>
                  <Input
                    value={siteFormName}
                    onChangeText={setSiteFormName}
                    placeholder="e.g. Pune Manufacturing Facility"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Street / Area *</Text>
                  <Input
                    value={siteFormStreet}
                    onChangeText={setSiteFormStreet}
                    placeholder="e.g. Plot 42, MIDC Phase 2"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>City / Town *</Text>
                    <Input
                      value={siteFormCity}
                      onChangeText={setSiteFormCity}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>District *</Text>
                    <Input
                      value={siteFormDistrict}
                      onChangeText={setSiteFormDistrict}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>State (Default: MH)</Text>
                    <Input
                      value="Maharashtra"
                      editable={false}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.mute, backgroundColor: theme.colors.canvas, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Pincode (6 digits) *</Text>
                    <Input
                      value={siteFormPincode}
                      onChangeText={setSiteFormPincode}
                      placeholder="411001"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      maxLength={6}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setSiteModalVisible(false)} disabled={isSavingSite} />
              <Button label={isSavingSite ? 'Saving...' : 'Save Site'} variant="primary" onPress={handleSaveSite} disabled={isSavingSite} />
            </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacingNumeric.md },
  filterPanelContent: {
    paddingTop: 10,
    borderTopWidth: 1,
    gap: spacingNumeric.sm },
  filterSelectorsGrid: {
    flexDirection: 'row',
    gap: 8 },
  selectorCol: {
    flex: 1 },
  filterPanelAnimatedContainer: {
    overflow: 'hidden' },
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
