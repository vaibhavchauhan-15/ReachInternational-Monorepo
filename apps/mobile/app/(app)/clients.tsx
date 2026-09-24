import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, Switch, ActivityIndicator, Linking } from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Building2, MapPin, Phone, Mail, Plus, Edit2, Trash2, X, CheckCircle2, ShieldAlert, ReceiptText, RefreshCw, Truck, Clock, UserCheck, History, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth/useAuth';
import { ClientListSkeleton, MobileClientCard } from '../../components/clients';
import { DropdownFilterSelector, type FilterOption } from '../../components/machines';
import { usePersistentListState } from '../../lib/hooks/usePersistentListState';

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
  { id: 'code_asc', label: 'Client Code (A → Z)' },
  { id: 'code_desc', label: 'Client Code (Z → A)' },
  { id: 'created_at_desc', label: 'Newest Registered' },
  { id: 'created_at_asc', label: 'Oldest Registered' },
];

interface ClientItem {
  id: string;
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
  status: 'active' | 'inactive';
  deleted_at?: string | null;
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

export default function ClientsScreen() {
  const { theme, isDark } = useTheme();
  const { role } = useAuth();
  const router = useRouter();

  const normalizedRole = (role || '').toLowerCase();
  const canAccessClients = ['super_admin', 'admin', 'manager'].includes(normalizedRole);

  useEffect(() => {
    if (role && !canAccessClients) {
      router.replace('/(app)/dashboard');
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
    defaultFilters: {
      activeFilter: 'all',
      sortBy: 'company_name_asc',
    },
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

  const handleResetAllFilters = useCallback(() => {
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

  // C11 Client Detail State & In-Memory Session Cache
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetailClient, setSelectedDetailClient] = useState<ClientItem | null>(null);
  type MobileDetailTab = 'machines' | 'logs' | 'assignments' | 'history' | 'audit';
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileDetailTab | null>(null);
  const [mobileLocationExpanded, setMobileLocationExpanded] = useState(false);
  const [mobileLocationLoading, setMobileLocationLoading] = useState(false);
  const [mobileLocationData, setMobileLocationData] = useState<{ site_address: string; billing_address: string; is_different: boolean } | null>(null);

  const [mobileTabLoading, setMobileTabLoading] = useState<string | null>(null);
  const [mobileMachines, setMobileMachines] = useState<any[]>([]);
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
          'id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, status, deleted_at';

        let dbQuery = supabase
          .from('clients')
          .select(CLIENT_PROJECTION, { count: 'exact' });

        // Status filter
        if (statusFilter === 'active') {
          dbQuery = dbQuery.eq('status', 'active').is('deleted_at', null);
        } else if (statusFilter === 'inactive') {
          dbQuery = dbQuery.or('status.eq.inactive,deleted_at.not.is.null');
        }

        // Server-side full-text search across all 8 indexed dimensions
        const s = (searchQuery || '').trim().replace(/[,()"\\]/g, '');
        if (s) {
          dbQuery = dbQuery.or(
            `company_name.ilike.%${s}%,code.ilike.%${s}%,gstin.ilike.%${s}%,pan_number.ilike.%${s}%,contact_person.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,district.ilike.%${s}%,state.ilike.%${s}%`
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
          const clientData = data as unknown as ClientItem[];
          const finalCount = count ?? data.length;
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
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!companyName.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid company name.');
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
      Alert.alert('Validation Error', 'Address, City, and State are required fields.');
      return;
    }

    const streetVal = address.trim();
    const fullUnifiedAddress = [streetVal, city.trim(), district.trim(), stateName.trim(), pincode.trim()]
      .filter(Boolean)
      .join(', ');

    if (editingClient) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
                ...c,
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
              }
            : c
        )
      );
    } else {
      const nextNum = clients.length + 1;
      const code = `CLI-${nextNum.toString().padStart(4, '0')}`;
      const newClient: ClientItem = {
        id: `cli-${Date.now()}`,
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
        status: 'active',
      };
      setClients([newClient, ...clients]);
    }
    mobileQueryCacheRef.current.clear();
    setModalVisible(false);
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
          onPress: () => {
            mobileQueryCacheRef.current.clear();
            setClients((prev) =>
              prev.map((c) => (c.id === client.id ? { ...c, status: 'inactive', deleted_at: new Date().toISOString() } : c))
            );
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
    async (tab: 'machines' | 'logs' | 'assignments' | 'history' | 'audit') => {
      setMobileActiveTab(tab);
      if (!selectedDetailClient?.id) return;

      const clientId = selectedDetailClient.id;
      const cacheKey = `${clientId}:${tab}`;
      const cached = mobileDetailCacheRef.current.get(cacheKey);
      if (cached) {
        if (tab === 'machines') setMobileMachines(cached);
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
          const { data } = await supabase
            .from('operator_machine_assignments')
            .select('id, shift_start_time, shift_end_time, is_active, machines!inner(machine_id, model, client_id), users!operator_id(full_name, phone)')
            .eq('machines.client_id', clientId)
            .order('is_active', { ascending: false });
          const res = (data || []).map((a: any) => ({
            id: a.id,
            shift: `${(a.shift_start_time || '').slice(0, 5)} - ${(a.shift_end_time || '').slice(0, 5)}`,
            is_active: !!a.is_active,
            machine_code: Array.isArray(a.machines) ? a.machines[0]?.machine_id : a.machines?.machine_id || '—',
            operator_name: Array.isArray(a.users) ? a.users[0]?.full_name : a.users?.full_name || '—',
            operator_phone: Array.isArray(a.users) ? a.users[0]?.phone : a.users?.phone || '',
          }));
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
      {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [Search] + [3-Dot Actions] */}
      <MobileHeader
        title="Client Directory"
        search={{
          value: search,
          onChangeText: handleSearchChange,
          placeholder: 'Search by company, code, GST, PAN, city, state...',
          onClear: () => handleSearchChange(''),
          isSearching: isSearching,
        }}
        actions={headerActions}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0070f3" />}
      >
        {/* Interactive 4-Card KPI Metric Grid */}
        <View style={styles.kpiGrid}>
          {/* Total Accounts Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleFilterChange('all')}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor:
                  activeFilter === 'all'
                    ? theme.colors.ink
                    : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>TOTAL ACCOUNTS</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{kpis.total}</Text>
          </TouchableOpacity>

          {/* Active Accounts Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleFilterChange(activeFilter === 'active' ? 'all' : 'active')}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  activeFilter === 'active'
                    ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5'
                    : theme.colors.canvasElevated,
                borderColor: activeFilter === 'active' ? '#10b981' : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#10b981' }]}>ACTIVE ACCOUNTS</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{kpis.active}</Text>
          </TouchableOpacity>

          {/* Inactive Accounts Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleFilterChange(activeFilter === 'inactive' ? 'all' : 'inactive')}
            style={[
              styles.kpiCard,
              {
                backgroundColor:
                  activeFilter === 'inactive'
                    ? isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb'
                    : theme.colors.canvasElevated,
                borderColor: activeFilter === 'inactive' ? '#f59e0b' : theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: '#f59e0b' }]}>INACTIVE / CHURN</Text>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>{kpis.inactive}</Text>
          </TouchableOpacity>

          {/* Locations Covered Card */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleFilterChange('all')}
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>ACTIVE CITIES</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.primary }]}>
              {kpis.locationsCovered || kpis.cities}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search & Filter Toolbar Card */}
        <View
          style={[
            styles.filterToolbar,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Top Search & Add CTA Row */}
          <View style={styles.actionRow}>
            <View style={styles.searchContainer}>
              <Input
                value={search}
                onChangeText={handleSearchChange}
                placeholder="Search company, code, GST, PAN, city..."
                leftIcon={
                  isSearching ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Search size={16} color={theme.colors.mute} />
                  )
                }
              />
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleOpenAdd}
              accessibilityLabel="Add client"
            >
              <Plus size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Filter & Sort Selectors Row */}
          <View style={styles.filterSelectorsRow}>
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
                label="Sort"
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

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <View style={[styles.activeChipsRow, { borderTopColor: theme.colors.hairline }]}>
              <Text style={[styles.activeChipsLabel, { color: theme.colors.mute }]}>Active:</Text>
              {debouncedSearch.trim() !== '' && (
                <View style={[styles.activeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.activeChipText, { color: theme.colors.ink }]} numberOfLines={1}>
                    "{debouncedSearch}"
                  </Text>
                  <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={12} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>
              )}
              {activeFilter !== 'all' && (
                <View style={[styles.activeChip, { backgroundColor: activeFilter === 'active' ? '#ecfdf5' : '#fffbeb', borderColor: activeFilter === 'active' ? '#a7f3d0' : '#fde68a' }]}>
                  <Text style={[styles.activeChipText, { color: activeFilter === 'active' ? '#059669' : '#d97706' }]}>
                    Status: {activeFilter === 'active' ? 'Active' : 'Inactive'}
                  </Text>
                  <TouchableOpacity onPress={() => handleFilterChange('all')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={12} color={activeFilter === 'active' ? '#059669' : '#d97706'} />
                  </TouchableOpacity>
                </View>
              )}
              {sortBy !== 'company_name_asc' && (
                <View style={[styles.activeChip, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <Text style={[styles.activeChipText, { color: theme.colors.ink }]}>
                    Sort: {CLIENT_SORT_OPTIONS.find((s) => s.id === sortBy)?.label || sortBy}
                  </Text>
                  <TouchableOpacity onPress={() => setSortBy('company_name_asc')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <X size={12} color={theme.colors.mute} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={handleResetAllFilters} style={styles.clearAllBtn}>
                <Text style={[styles.clearAllText, { color: theme.colors.link }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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
              />
            ))
          )}
        </View>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              style={[
                styles.pageBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                page === 1 && { opacity: 0.5 },
              ]}
              disabled={page === 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Previous</Text>
            </TouchableOpacity>

            <Text style={[styles.pageIndicator, { color: theme.colors.ink }]}>
              Page {page} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[
                styles.pageBtn,
                { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline },
                page === totalPages && { opacity: 0.5 },
              ]}
              disabled={page === totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={[styles.pageBtnText, { color: theme.colors.ink }]}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Server-Side Page Size Selector (10, 25, 50, 100) */}
        {totalFiltered > 0 && (
          <View style={styles.pageSizeRow}>
            <Text style={[styles.pageSizeLabel, { color: theme.colors.mute }]}>Rows per page:</Text>
            {([10, 25, 50, 100] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
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
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit Client Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                {editingClient ? `Edit (${editingClient.code})` : 'Add New Client'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>Company & Tax Details</Text>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Company Name *</Text>
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="e.g. Pushpa Infracon Pvt Ltd"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Contact Person</Text>
                  <TextInput
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    placeholder="e.g. Rajesh Sharma"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Phone Number</Text>
                  <TextInput
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
                    <TextInput
                      value={gstin}
                      onChangeText={(t) => setGstin(t.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      placeholderTextColor={theme.colors.mute}
                      autoCapitalize="characters"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>PAN Number</Text>
                    <TextInput
                      value={panNumber}
                      onChangeText={(t) => setPanNumber(t.toUpperCase())}
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
                  <TextInput
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
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>District</Text>
                    <TextInput
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
                    <TextInput
                      value={stateName}
                      onChangeText={setStateName}
                      placeholder="e.g. Maharashtra"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Pincode</Text>
                    <TextInput
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
                      <TextInput
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
                        <TextInput
                          value={billingCity}
                          onChangeText={setBillingCity}
                          placeholder="e.g. Gurugram"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing District</Text>
                        <TextInput
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
                        <TextInput
                          value={billingState}
                          onChangeText={setBillingState}
                          placeholder="e.g. Haryana"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink, minHeight: 44 }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing Pincode</Text>
                        <TextInput
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
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>

      {/* C11 Client Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, maxHeight: '92%' }]}>
            {/* Header: Summary */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.codeText, { color: theme.colors.primary }]}>
                    {selectedDetailClient?.code}
                  </Text>
                  {selectedDetailClient?.status && (
                    <Badge
                      status={selectedDetailClient.deleted_at ? 'inactive' : selectedDetailClient.status}
                      customLabel={selectedDetailClient.deleted_at ? 'SOFT DELETED' : selectedDetailClient.status.toUpperCase()}
                    />
                  )}
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.ink }]} numberOfLines={1}>
                  {selectedDetailClient?.company_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
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
                      Person: <Text style={{ color: theme.colors.ink, fontWeight: '600' }}>{selectedDetailClient?.contact_person || '—'}</Text>
                    </Text>
                    {selectedDetailClient?.phone && (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${selectedDetailClient.phone}`)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                      >
                        <Phone size={12} color={theme.colors.primary} />
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>
                          {selectedDetailClient.phone}
                        </Text>
                      </TouchableOpacity>
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
                      <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>
                        {selectedDetailClient?.gstin || 'Not Registered'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>PAN</Text>
                      <Text style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>
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
                    <TouchableOpacity
                      onPress={handleToggleMobileLocation}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 6 }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.primary }}>
                        {mobileLocationExpanded ? 'Hide' : 'Load On Demand'}
                      </Text>
                      {mobileLocationExpanded ? <ChevronUp size={12} color={theme.colors.primary} /> : <ChevronDown size={12} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  </View>

                  {!mobileLocationExpanded ? (
                    <Text style={{ fontSize: 11, color: theme.colors.mute, marginTop: 2 }}>
                      {[selectedDetailClient?.street, selectedDetailClient?.city, selectedDetailClient?.state].filter(Boolean).join(', ') || '—'}
                    </Text>
                  ) : mobileLocationLoading ? (
                    <View style={{ paddingVertical: 12, alignItems: 'center', gap: 4 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={{ fontSize: 10, color: theme.colors.mute }}>Fetching location details...</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.hairline, paddingTop: 6 }}>
                      <View>
                        <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>Site Address:</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '500' }}>
                          {mobileLocationData?.site_address || '—'}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.detailTextSmall, { color: theme.colors.mute }]}>Billing Address:</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.ink, fontWeight: '500' }}>
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
                      { id: 'logs', label: 'Running Logs', icon: Clock, count: mobileLogs.length },
                      { id: 'assignments', label: 'Assignments', icon: UserCheck, count: mobileAssignments.length },
                      { id: 'history', label: 'History', icon: History, count: mobileHistory.length },
                      { id: 'audit', label: 'Audit', icon: ShieldCheck, count: mobileAudits.length },
                    ] as const
                  ).map((tab) => {
                    const isActive = mobileActiveTab === tab.id;
                    const IconComponent = tab.icon;
                    return (
                      <TouchableOpacity
                        key={tab.id}
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
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* 5. Operational Tab Content Area */}
                {mobileActiveTab === null && (
                  <View style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas, alignItems: 'center', paddingVertical: 16 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.ink }}>
                      Operational Records (On Demand)
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.colors.mute, textAlign: 'center', marginTop: 4, marginBottom: 10 }}>
                      Select a tab above to load machines, logs, assignments, history, or audit logs on demand.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      <TouchableOpacity
                        onPress={() => handleMobileTabChange('machines')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <Truck size={12} color={theme.colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink }}>Machines</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMobileTabChange('logs')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <Clock size={12} color="#059669" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink }}>Running Logs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleMobileTabChange('assignments')}
                        style={[styles.detailTabChip, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvasElevated, minHeight: 44 }]}
                      >
                        <UserCheck size={12} color="#7e22ce" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.ink }}>Assignments</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* TAB: MACHINES */}
                {mobileActiveTab === 'machines' && (
                  <View style={{ gap: 8 }}>
                  {mobileTabLoading === 'machines' ? (
                    <View style={{ paddingVertical: 24, alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Loading deployed machines...</Text>
                    </View>
                  ) : mobileMachines.length === 0 ? (
                    <Text style={{ textAlign: 'center', paddingVertical: 20, fontSize: 11, color: theme.colors.mute }}>
                      No equipment assigned to this client.
                    </Text>
                  ) : (
                    mobileMachines.map((m: any) => (
                      <View key={m.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text style={{ fontFamily: 'monospace', fontWeight: '800', color: theme.colors.primary, fontSize: 12 }}>
                            {m.machine_id}
                          </Text>
                          <Text style={{ fontSize: 10, color: theme.colors.mute }}>{m.model}</Text>
                        </View>
                        <Badge status={m.status === 'rented' || m.status === 'active' ? 'active' : 'inactive'} customLabel={m.status.toUpperCase()} />
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
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Loading running logs...</Text>
                    </View>
                  ) : mobileLogs.length === 0 ? (
                    <Text style={{ textAlign: 'center', paddingVertical: 20, fontSize: 11, color: theme.colors.mute }}>
                      No running logs recorded.
                    </Text>
                  ) : (
                    mobileLogs.map((l: any) => (
                      <View key={l.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: 11, color: theme.colors.ink }}>
                            {l.machine_code} • {l.log_date}
                          </Text>
                          <Text style={{ fontSize: 10, color: theme.colors.mute }}>Operator: {l.operator_name}</Text>
                        </View>
                        <Text style={{ fontFamily: 'monospace', fontWeight: '800', color: '#059669', fontSize: 12 }}>
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
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Loading assignments...</Text>
                    </View>
                  ) : mobileAssignments.length === 0 ? (
                    <Text style={{ textAlign: 'center', paddingVertical: 20, fontSize: 11, color: theme.colors.mute }}>
                      No operator assignments found.
                    </Text>
                  ) : (
                    mobileAssignments.map((a: any) => (
                      <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text style={{ fontWeight: '700', fontSize: 12, color: theme.colors.ink }}>{a.operator_name}</Text>
                          <Text style={{ fontSize: 10, color: theme.colors.mute }}>{a.machine_code} ({a.shift})</Text>
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
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Loading history...</Text>
                    </View>
                  ) : mobileHistory.length === 0 ? (
                    <Text style={{ textAlign: 'center', paddingVertical: 20, fontSize: 11, color: theme.colors.mute }}>
                      No timeline history events found.
                    </Text>
                  ) : (
                    mobileHistory.map((h: any) => (
                      <View key={h.id} style={[styles.detailSectionCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontWeight: '700', fontSize: 12, color: theme.colors.ink }}>{h.title}</Text>
                          <Text style={{ fontSize: 9, color: theme.colors.mute }}>{new Date(h.date).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: theme.colors.mute, marginTop: 2 }}>{h.desc}</Text>
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
                      <Text style={{ fontSize: 11, color: theme.colors.mute }}>Loading audit trail...</Text>
                    </View>
                  ) : mobileAudits.length === 0 ? (
                    <Text style={{ textAlign: 'center', paddingVertical: 20, fontSize: 11, color: theme.colors.mute }}>
                      Zero audit entries logged.
                    </Text>
                  ) : (
                    mobileAudits.map((a: any) => (
                      <View key={a.id} style={[styles.detailItemCard, { borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }]}>
                        <View>
                          <Text style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: 11, color: theme.colors.primary }}>
                            {a.action}
                          </Text>
                          <Text style={{ fontSize: 10, color: theme.colors.mute }}>Actor: {a.actor_name || 'System'}</Text>
                        </View>
                        <Text style={{ fontSize: 9, color: theme.colors.mute }}>{new Date(a.created_at).toLocaleDateString()}</Text>
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacingNumeric.md },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacingNumeric.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  filterToolbar: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.sm + 2,
    gap: spacingNumeric.sm,
    marginBottom: spacingNumeric.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  actionRow: { flexDirection: 'row', gap: spacingNumeric.sm },
  searchContainer: { flex: 1 },
  addBtn: { width: 44, height: 44, borderRadius: radiusNumeric.md, justifyContent: 'center', alignItems: 'center' },
  filterSelectorsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  selectorCol: {
    flex: 1,
  },
  activeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  activeChipsLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
  },
  activeChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  clearAllBtn: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: { gap: spacingNumeric.sm },
  emptyCard: { padding: spacingNumeric.lg, alignItems: 'center' },
  emptyText: { fontSize: 12, fontWeight: '600' },
  clientCard: { padding: spacingNumeric.md, borderRadius: radiusNumeric.md, gap: spacingNumeric.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  codeText: { fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  clientName: { fontSize: 14, fontWeight: '800' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  taxBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  taxBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  subText: { fontSize: 10 },
  cardDetails: { borderTopWidth: 1, paddingTop: 8, gap: 4 },
  detailRow: { fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minHeight: 44 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacingNumeric.md },
  modalContent: { borderRadius: radiusNumeric.lg, padding: spacingNumeric.md, gap: spacingNumeric.sm, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 15, fontWeight: '800' },
  formSection: { marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  formGroup: { marginBottom: 8 },
  rowInputs: { flexDirection: 'row', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: radiusNumeric.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { fontSize: 11, fontWeight: '600' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 4 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1 },
  pageBtnText: { fontSize: 12, fontWeight: '600' },
  pageIndicator: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pageSizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 20 },
  pageSizeLabel: { fontSize: 11, fontWeight: '600' },
  pageSizeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, minHeight: 32, justifyContent: 'center', alignItems: 'center' },
  pageSizeChipText: { fontSize: 11, fontWeight: '700' },
  detailTabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radiusNumeric.full, borderWidth: 1, minHeight: 44 },
  detailTabChipText: { fontSize: 11, fontWeight: '700' },
  detailSectionCard: { borderWidth: 1, borderRadius: radiusNumeric.sm, padding: 10 },
  detailCardTitle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailTextSmall: { fontSize: 10, fontWeight: '500' },
  detailItemCard: { borderWidth: 1, borderRadius: radiusNumeric.sm, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
});
