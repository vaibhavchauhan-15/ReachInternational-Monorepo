/**
 * Native Mobile Clients / CRM Server State & Business Logic Hook
 * Encapsulates TanStack Query caching, search, filtering, and client mutations.
 */

import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type StatusFilter = 'all' | 'active' | 'inactive';
export type ClientSortOptionType =
  | 'company_name_asc'
  | 'company_name_desc'
  | 'code_asc'
  | 'code_desc'
  | 'created_at_desc'
  | 'created_at_asc';

export interface ClientItem {
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

export interface UseClientsDataOptions {
  searchQuery?: string;
  activeFilter?: StatusFilter;
  sortBy?: ClientSortOptionType;
  enabled?: boolean;
}

export function useClientsData({
  searchQuery = '',
  activeFilter = 'all',
  sortBy = 'company_name_asc',
  enabled = true,
}: UseClientsDataOptions) {
  const queryClient = useQueryClient();

  // 1. Fetch Clients with Sites
  const {
    data: allClients = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<ClientItem[]>({
    queryKey: ['clients'],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error: fetchErr } = await supabase
        .from('clients')
        .select(`
          id,
          code,
          company_name,
          contact_person,
          phone,
          gstin,
          pan_number,
          street,
          city,
          district,
          state,
          pincode,
          is_billing_address_different,
          billing_address,
          billing_city,
          billing_district,
          billing_state,
          billing_pincode,
          maintenance_allowance_minutes,
          status,
          deleted_at,
          client_sites(
            id,
            site_code,
            site_name,
            city,
            status
          )
        `)
        .order('company_name', { ascending: true });

      if (fetchErr) {
        throw new Error(fetchErr.message || 'Failed to fetch clients');
      }

      return (data || []).map((c: any) => ({
        ...c,
        address: c.street || '',
        site_count: c.client_sites?.length || 0,
      })) as ClientItem[];
    },
  });

  // 2. Filter & Sort in memory
  const filteredClients = useMemo(() => {
    let result = [...allClients];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      result = result.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.state && c.state.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q))
      );
    }

    if (activeFilter !== 'all') {
      result = result.filter((c) => c.status === activeFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'company_name_asc':
          return a.company_name.localeCompare(b.company_name);
        case 'company_name_desc':
          return b.company_name.localeCompare(a.company_name);
        case 'code_asc':
          return a.code.localeCompare(b.code);
        case 'code_desc':
          return b.code.localeCompare(a.code);
        case 'created_at_desc':
          return (b as any).created_at ? (b as any).created_at.localeCompare((a as any).created_at || '') : 0;
        case 'created_at_asc':
          return (a as any).created_at ? (a as any).created_at.localeCompare((b as any).created_at || '') : 0;
        default:
          return 0;
      }
    });

    return result;
  }, [allClients, searchQuery, activeFilter, sortBy]);

  // 3. Client Deletion Mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error: dErr } = await supabase
        .from('clients')
        .update({ status: 'inactive', deleted_at: new Date().toISOString() })
        .eq('id', clientId);

      if (dErr) {
        throw new Error(dErr.message || 'Failed to delete client');
      }

      return clientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // 4. Restore Client Mutation
  const restoreClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error: rErr } = await supabase
        .from('clients')
        .update({ status: 'active', deleted_at: null })
        .eq('id', clientId);

      if (rErr) {
        throw new Error(rErr.message || 'Failed to restore client');
      }

      return clientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return {
    allClients,
    clients: filteredClients,
    totalCount: filteredClients.length,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    deleteClient: deleteClientMutation.mutateAsync,
    isDeletingClient: deleteClientMutation.isPending,
    restoreClient: restoreClientMutation.mutateAsync,
    isRestoringClient: restoreClientMutation.isPending,
  };
}
