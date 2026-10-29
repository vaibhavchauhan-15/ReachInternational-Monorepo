import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { Pressable } from '../../../components/ui/touch/Pressable';
import {
  Badge,
  useTheme,
  MobileHeader,
  HeaderActionItem,
  KPICard,
  KPIGrid,
  FilterToolbar,
  Text,
  EmptyState,
  ErrorState,
  PermissionDeniedView,
  ConfirmDialog,
  FilterSidebar,
  FilterCategoryCard,
  DropdownFilterSelector,
  type FilterOption,
} from '../../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import {
  Building2,
  MapPin,
  Plus,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from '../../../components/ui/icon';
import { haptics } from '../../../lib/haptics';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../lib/auth/useAuth';
import {
  ClientListSkeleton,
  MobileClientCard,
  ClientModal,
  ClientSiteModal,
  ClientActionsModal,
} from '../../../components/clients';
import { usePersistentListState } from '../../../lib/hooks/usePersistentListState';
import {
  DEFAULT_CLIENT_SHIFT_PRESET_ID,
  getClientShiftPresetById,
  sanitizeDatabaseError,
} from '@reachinternational/utils';
import { createTempId, reconcileRow, removeTempRow } from '../../../lib/optimistic';
import * as Clipboard from 'expo-clipboard';

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

const PAGE_SIZE = 15;

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
  const { role } = useAuth();
  const router = useRouter();

  const normalizedRole = (role || '').toLowerCase();
  const canAccessClients = ['super_admin', 'admin', 'manager', 'supervisor'].includes(normalizedRole);
  const canManageClients = ['super_admin', 'admin', 'manager'].includes(normalizedRole);

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientItem | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState<boolean>(false);
  const [clientForActions, setClientForActions] = useState<ClientItem | null>(null);

  // Persistent search, filters, and sorting
  const {
    search: debouncedSearch,
    inputValue: search,
    setSearch,
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
      setCurrentPage(1);
    },
    [setFilter]
  );

  const setSortBy = useCallback(
    (val: ClientSortOptionType) => {
      setFilter('sortBy', val);
      setCurrentPage(1);
    },
    [setFilter]
  );

  const [refreshing, setRefreshing] = useState(false);
  const querySeqRef = useRef(0);
  const mobileQueryCacheRef = useRef<Map<string, MobileQueryCacheEntry>>(new Map());
  const onEndReachedCalledDuringMomentum = useRef(true);

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
    setCurrentPage(1);
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
    (status: StatusFilter, query: string, sortOption: ClientSortOptionType, pageNum: number, sizeNum: number = PAGE_SIZE) =>
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
      isNextPage: boolean = false
    ) => {
      const sizeNum = PAGE_SIZE;
      const cacheKey = getMobileCacheKey(statusFilter, searchQuery, sortOption, pageNum, sizeNum);

      // Check in-memory cache for page 1
      if (!isNextPage) {
        const cached = mobileQueryCacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
          setClients(cached.clients);
          setTotalCount(cached.total);
          setIsLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const seq = ++querySeqRef.current;
      try {
        if (isNextPage) {
          setIsFetchingNextPage(true);
        } else {
          setIsLoading(true);
          setFetchError(null);
        }

        // Lean projection: strictly returns CODE, COMPANY & TAX, CONTACT PERSON, PHONE, SITE LOCATION, STATUS
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

        // Server-side full-text search across all indexed dimensions
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

        const clientData: ClientItem[] = [];
        if (data && data.length > 0) {
          const seenIds = new Set<string>();
          for (const item of (data as any[])) {
            if (!item || !item.id || seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            const sites = Array.isArray(item.client_sites) ? item.client_sites : [];
            clientData.push({
              ...item,
              client_sites: sites,
              site_count: sites.length,
            });
          }
        }

        const finalCount = count ?? (isNextPage ? totalCount : clientData.length);

        if (isNextPage) {
          setClients((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const merged = [...prev];
            for (const item of clientData) {
              if (!existingIds.has(item.id)) {
                existingIds.add(item.id);
                merged.push(item);
              }
            }
            return merged;
          });
          setCurrentPage(pageNum);
        } else {
          mobileQueryCacheRef.current.set(cacheKey, {
            clients: clientData,
            total: finalCount,
            timestamp: Date.now(),
          });
          setClients(clientData);
          setCurrentPage(1);
        }
        setTotalCount(finalCount);
      } catch (err: any) {
        if (seq !== querySeqRef.current) return;
        console.warn('Clients server query error:', err);
        setFetchError(err instanceof Error ? err : new Error(err?.message || 'Failed to fetch client records.'));
        if (!isNextPage) {
          setClients([]);
          setTotalCount(0);
        }
      } finally {
        if (seq === querySeqRef.current) {
          setIsLoading(false);
          setIsFetchingNextPage(false);
          setRefreshing(false);
        }
      }
    },
    [getMobileCacheKey, totalCount]
  );

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    setCurrentPage(1);
    fetchClients(debouncedSearch, activeFilter, sortBy, 1, false);
  }, [debouncedSearch, activeFilter, sortBy, fetchClients]);

  const onRefresh = useCallback(() => {
    mobileQueryCacheRef.current.clear();
    setRefreshing(true);
    fetchKPIs();
    setCurrentPage(1);
    fetchClients(debouncedSearch, activeFilter, sortBy, 1, false);
  }, [fetchKPIs, fetchClients, debouncedSearch, activeFilter, sortBy]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setCurrentPage(1);
  };

  const handleFilterChange = (filter: StatusFilter) => {
    if (filter === activeFilter) return;
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const totalFiltered = totalCount;
  const hasNextPage = clients.length < totalFiltered;

  // Infinite Scroll Trigger
  const handleMomentumScrollBegin = useCallback(() => {
    onEndReachedCalledDuringMomentum.current = false;
  }, []);

  const handleLoadMore = useCallback(() => {
    if (
      onEndReachedCalledDuringMomentum.current ||
      !hasNextPage ||
      isFetchingNextPage ||
      isLoading ||
      clients.length === 0
    ) {
      return;
    }
    onEndReachedCalledDuringMomentum.current = true;
    const nextPage = currentPage + 1;
    fetchClients(debouncedSearch, activeFilter, sortBy, nextPage, true);
  }, [
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    clients.length,
    currentPage,
    debouncedSearch,
    activeFilter,
    sortBy,
    fetchClients,
  ]);

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

  const handleOpenEdit = useCallback((client: ClientItem) => {
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
  }, []);

  const handleSave = () => {
    if (!companyName.trim()) {
      return;
    }

    const normEntered = companyName.trim().toLowerCase();
    const isDuplicate = clients.some(
      (c) => c.company_name.trim().toLowerCase() === normEntered && (!editingClient || c.id !== editingClient.id)
    );
    if (isDuplicate) {
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
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
        }
      })();
    }
  };

  const handleOpenAddSite = useCallback((targetClientId?: string) => {
    setSiteTargetClientId(targetClientId || null);
    setSiteFormName('');
    setSiteFormStreet('');
    setSiteFormCity('');
    setSiteFormDistrict('');
    setSiteFormStateId(27);
    setSiteFormPincode('');
    setSiteModalVisible(true);
  }, []);

  const handleSaveSite = async () => {
    const cId = siteTargetClientId;
    if (!cId || !siteFormName.trim() || !siteFormStreet.trim() || !siteFormCity.trim() || !siteFormDistrict.trim() || !siteFormPincode.trim() || siteFormPincode.length !== 6) {
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

      if (error) throw error;

      setSiteModalVisible(false);
    } catch (err: any) {
      // Handled silently
    } finally {
      setIsSavingSite(false);
    }
  };

  const handleSoftDelete = useCallback((client: ClientItem) => {
    haptics.warning();
    setClientToDelete(client);
  }, []);

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
      } else {
        haptics.confirm();
        setClientToDelete(null);
      }
    } catch (err: any) {
      setClients(prevClients);
      haptics.reject();
    } finally {
      setIsDeletingClient(false);
    }
  };

  // Client Detail Navigation
  const handleOpenDetail = useCallback(
    (client: ClientItem) => {
      haptics.select();
      const identifier = client.client_id || client.code || client.id;
      router.push(`/(app)/clients/${encodeURIComponent(identifier)}` as any);
    },
    [router]
  );

  // Client Assign Supervisor Handler
  const handleAssignSupervisor = useCallback(
    (client: ClientItem) => {
      haptics.select();
      const identifier = client.client_id || client.code || client.id;
      router.push(`/(app)/clients/${encodeURIComponent(identifier)}?tab=assignments&action=assign-supervisor` as any);
    },
    [router]
  );

  // Client Assign Machine Handler
  const handleAssignMachine = useCallback(
    (client: ClientItem) => {
      haptics.select();
      const identifier = client.client_id || client.code || client.id;
      router.push(`/(app)/clients/${encodeURIComponent(identifier)}?tab=machines` as any);
    },
    [router]
  );

  // Copy Client ID
  const handleCopyId = useCallback(async (client: ClientItem) => {
    const code = client.client_id || client.code || client.id;
    try {
      if (Clipboard && Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(code);
      }
      haptics.tap();
    } catch {
      // Graceful fallback
    }
  }, []);

  // 3-Dot Actions Modal Open
  const handleOpenActions = useCallback((client: ClientItem) => {
    haptics.select();
    setClientForActions(client);
  }, []);

  const headerActions = useMemo<HeaderActionItem[]>(() => {
    const list: HeaderActionItem[] = [];

    if (canManageClients) {
      list.push({
        id: 'add-client',
        label: 'Add New Client',
        icon: <Plus size={16} color={theme.colors.ink} />,
        onPress: () => handleOpenAdd(),
      });
    }

    list.push({
      id: 'refresh-clients',
      label: 'Refresh Client Directory',
      icon: <RefreshCw size={16} color={theme.colors.ink} />,
      onPress: () => onRefresh(),
    });

    return list;
  }, [theme.colors.ink, onRefresh, canManageClients]);

  // Render client card item
  const renderClientItem = useCallback(
    ({ item }: { item: ClientItem }) => (
      <View style={styles.cardItemWrapper}>
        <MobileClientCard
          client={item}
          canManageClients={canManageClients}
          searchTerm={debouncedSearch}
          onViewDetails={handleOpenDetail}
          onEdit={handleOpenEdit}
          onDelete={handleSoftDelete}
          onAddSite={(c: any) => handleOpenAddSite(c.id)}
          onAssignSupervisor={handleAssignSupervisor}
          onAssignMachine={handleAssignMachine}
          onOpenActions={handleOpenActions}
        />
      </View>
    ),
    [
      canManageClients,
      debouncedSearch,
      handleOpenDetail,
      handleOpenEdit,
      handleSoftDelete,
      handleOpenAddSite,
      handleAssignSupervisor,
      handleAssignMachine,
      handleOpenActions,
    ]
  );

  // Static FlatList Header: Renders KPI Grid & FilterToolbar with dedicated 16dp spacing
  const renderListHeader = useCallback(
    () => (
      <View style={styles.listHeaderContainer}>
        {/* Interactive 4-Card KPI Metric Grid with clean 16dp separation to search box */}
        <View style={styles.kpiContainer}>
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
              label="Inactive Accounts"
              value={kpis.inactive}
              icon={AlertTriangle}
              variant={kpis.inactive > 0 ? 'warning' : 'default'}
              active={activeFilter === 'inactive'}
              onPress={() => handleFilterChange(activeFilter === 'inactive' ? 'all' : 'inactive')}
            />

            <KPICard
              label="Covered Locations"
              value={kpis.locationsCovered || kpis.cities}
              icon={MapPin}
              variant="info"
              onPress={() => handleFilterChange('all')}
            />
          </KPIGrid>
        </View>

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
              <Text variant="caption" weight="semibold" style={[styles.activeBadgesHeader, { color: theme.colors.mute }]}>
                Active Filters:
              </Text>

              {debouncedSearch.trim() !== '' && (
                <Badge
                  variant="outline"
                  size="md"
                  label={`Search: "${debouncedSearch}"`}
                  onRemove={() => handleSearchChange('')}
                />
              )}

              {activeFilter !== 'all' && (
                <Badge
                  variant={activeFilter === 'active' ? 'success' : 'warning'}
                  size="md"
                  label={`Status: ${CLIENT_STATUS_FILTER_OPTIONS.find((s) => s.id === activeFilter)?.label || activeFilter}`}
                  onRemove={() => handleFilterChange('all')}
                />
              )}

              {sortBy !== 'company_name_asc' && (
                <Badge
                  variant="outline"
                  size="md"
                  label={`Sort: ${CLIENT_SORT_OPTIONS.find((s) => s.id === sortBy)?.label || sortBy}`}
                  onRemove={() => setSortBy('company_name_asc')}
                />
              )}

              <Pressable
                variant="buttonGhost"
                hitSlopToMin48
                onPress={handleResetAllFilters}
                style={styles.resetAllLink}
                accessibilityRole="button"
                accessibilityLabel="Reset all active filters"
              >
                <RotateCcw size={11} color={theme.colors.link} />
                <Text variant="caption" weight="semibold" style={{ color: theme.colors.link }}>
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
              onChange={(val: any) => handleFilterChange(val as StatusFilter)}
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
              onChange={(val: any) => {
                setSortBy(val as ClientSortOptionType);
              }}
              minMenuWidth={280}
            />
          </FilterCategoryCard>
        </FilterSidebar>

        {/* Results count indicator */}
        <View style={styles.resultsCountRow}>
          <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
            Showing{' '}
            <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
              {clients.length > 0 ? `1–${clients.length}` : 0}
            </Text>{' '}
            of{' '}
            <Text variant="caption" weight="bold" style={{ color: theme.colors.ink }}>
              {totalFiltered}
            </Text>{' '}
            {totalFiltered === 1 ? 'client' : 'clients'}
            {activeFilterCount > 0 ? ' (filtered)' : ''}
          </Text>
        </View>
      </View>
    ),
    [
      kpis,
      activeFilter,
      search,
      isSearching,
      filterPanelOpen,
      activeFilterCount,
      debouncedSearch,
      sortBy,
      totalFiltered,
      clients.length,
      theme.colors.hairline,
      theme.colors.mute,
      theme.colors.link,
      theme.colors.ink,
      handleSearchChange,
      handleResetAllFilters,
      handleFilterChange,
      setSortBy,
    ]
  );

  // List Empty / Initial Loading Component
  const renderListEmpty = useCallback(() => {
    if (filterPanelOpen) return null;

    if (isLoading || isSearching) {
      return (
        <View style={styles.skeletonContainer}>
          <ClientListSkeleton count={4} />
        </View>
      );
    }

    if (fetchError && clients.length === 0) {
      return (
        <ErrorState
          error={fetchError}
          onRetry={onRefresh}
          retryLabel="Retry Loading Clients"
          secondaryActionLabel={activeFilterCount > 0 ? 'Reset All Filters' : undefined}
          onSecondaryAction={activeFilterCount > 0 ? handleResetAllFilters : undefined}
        />
      );
    }

    if (debouncedSearch.trim()) {
      return (
        <EmptyState
          variant="no-results"
          title="No Clients Found"
          description={`No client records matched "${debouncedSearch.trim()}".`}
          actionLabel="Clear Search"
          onAction={() => handleSearchChange('')}
        />
      );
    }

    if (activeFilter !== 'all') {
      return (
        <EmptyState
          variant="filtered"
          title="No Matching Clients"
          description="No clients found matching the selected status filter."
          actionLabel="Show All Clients"
          onAction={() => handleFilterChange('all')}
        />
      );
    }

    return (
      <EmptyState
        title="No Clients Registered"
        description="No clients are currently registered in your organization."
        actionLabel="Add New Client"
        onAction={handleOpenAdd}
      />
    );
  }, [
    filterPanelOpen,
    isLoading,
    isSearching,
    fetchError,
    clients.length,
    debouncedSearch,
    activeFilter,
    activeFilterCount,
    onRefresh,
    handleResetAllFilters,
    handleSearchChange,
    handleFilterChange,
  ]);

  // List Footer: Chunk loading spinner or end-of-list row
  const renderListFooter = useCallback(() => {
    if (isLoading || clients.length === 0) return null;

    return (
      <View style={styles.scrollFooterContainer}>
        {isFetchingNextPage ? (
          <View style={styles.loadingMoreRow}>
            <ActivityIndicator size="small" color={theme.colors.link} />
            <Text variant="caption" style={{ color: theme.colors.mute, marginLeft: 8 }}>
              Loading more clients ({clients.length} of {totalFiltered})...
            </Text>
          </View>
        ) : hasNextPage ? (
          <View style={styles.loadingMoreRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Scroll to load more clients
            </Text>
          </View>
        ) : (
          <View style={styles.endOfListRow}>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
            <Text variant="caption" weight="medium" style={[styles.endOfListText, { color: theme.colors.mute }]}>
              All {totalFiltered} clients loaded
            </Text>
            <View style={[styles.endOfListLine, { backgroundColor: theme.colors.hairline }]} />
          </View>
        )}
      </View>
    );
  }, [
    isLoading,
    clients.length,
    isFetchingNextPage,
    hasNextPage,
    totalFiltered,
    theme.colors.link,
    theme.colors.mute,
    theme.colors.hairline,
  ]);

  if (role && !canAccessClients) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
        <MobileHeader
          title="Client Accounts"
          showBack={true}
          backRoute="/dashboard"
        />
        <PermissionDeniedView
          featureName="Client Management"
          currentRole={role}
          requiredRoles={['super_admin', 'admin', 'manager', 'supervisor']}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      {/* Top Standardized Mobile Header: [Logo] + [Page Title] + [3-Dot Actions] */}
      <MobileHeader
        title="Client Directory"
        showBack={true}
        backRoute="/dashboard"
        actions={headerActions}
      />

      {/* Virtualized Production FlatList with 0ms Static Header & Infinite Scroll */}
      <FlatList
        data={isLoading && clients.length === 0 ? [] : clients}
        renderItem={renderClientItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle={isDark ? 'white' : 'black'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.link}
          />
        }
      />

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

      {/* 3-Dot Client Actions Modal */}
      <ClientActionsModal
        visible={Boolean(clientForActions)}
        client={clientForActions}
        onClose={() => setClientForActions(null)}
        onViewDetails={handleOpenDetail}
        onEdit={handleOpenEdit}
        onAddSite={(c) => handleOpenAddSite(c.id)}
        onAssignSupervisor={handleAssignSupervisor}
        onAssignMachine={handleAssignMachine}
        onCopyId={handleCopyId}
        onDelete={handleSoftDelete}
        canManageClients={canManageClients}
      />

      {/* Soft Delete Confirmation Dialog */}
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
  scrollContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: spacingNumeric.md,
    paddingTop: spacingNumeric.sm,
    paddingBottom: 120,
  },
  listHeaderContainer: {
    width: '100%',
  },
  kpiContainer: {
    marginBottom: spacingNumeric.md,
  },
  activeBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  activeBadgesHeader: {
    marginRight: 2,
  },
  resetAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resultsCountRow: {
    paddingHorizontal: 2,
    marginBottom: spacingNumeric.xs,
  },
  cardItemWrapper: {
    marginBottom: spacingNumeric.sm,
  },
  skeletonContainer: {
    width: '100%',
  },
  scrollFooterContainer: {
    paddingVertical: spacingNumeric.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  endOfListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
    width: '100%',
  },
  endOfListLine: {
    flex: 1,
    height: 1,
  },
  endOfListText: {
    textAlign: 'center',
  },
});
