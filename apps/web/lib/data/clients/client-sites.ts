import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { TAGS, CACHE_TIERS } from '@/lib/cache';
import type { ClientSite, ClientSiteDropdownItem, ClientWithSitesResponse } from '@reachinternational/types';

export type { ClientSite, ClientSiteDropdownItem, ClientWithSitesResponse };

/**
 * Single Authoritative DAL Module for client_sites.
 * All reads and writes to public.client_sites flow strictly through this module.
 */

/**
 * Comprehensive client read model RPC:
 * Returns client profile, all active sites (ordered by site_no), and counts (machines, logs, sites) in 1 round trip.
 */
export const getClientWithSites = cache(async (clientId: string): Promise<ClientWithSitesResponse | null> => {
  if (!clientId) return null;

  return unstable_cache(
    async (): Promise<ClientWithSitesResponse | null> => {
      const supabase = createSupabaseAdminClient();

      // Attempt single round-trip RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_client_with_sites', {
        p_client_id: clientId,
      });

      if (!rpcError && rpcData && rpcData.client) {
        return rpcData as ClientWithSitesResponse;
      }

      // High-performance fallback: query client with joined sites
      const [clientRes, sitesRes, machinesCountRes, logsCountRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
        supabase
          .from('client_sites')
          .select('*, states(name)')
          .eq('client_id', clientId)
          .is('deleted_at', null)
          .order('site_no', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('machines').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('machine_hour_logs').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);

      if (clientRes.error || !clientRes.data) return null;

      const rawSites = sitesRes.data || [];
      const sites: ClientSite[] = rawSites.map((row: any, idx: number) => {
        const siteNo = row.site_no != null ? Number(row.site_no) : idx;
        const code = row.code || `S${String(siteNo).padStart(2, '0')}`;
        const addressFull =
          row.address_full ||
          [row.street, row.city, row.district, row.pincode].filter(Boolean).join(', ');

        return {
          id: row.id,
          client_id: row.client_id,
          site_no: siteNo,
          code,
          site_code: row.site_code || `${clientRes.data.client_id || clientRes.data.code || 'CLI'}-${code}`,
          legacy_code: row.legacy_code || null,
          site_name: row.site_name,
          street: row.street,
          city: row.city,
          district: row.district,
          state_id: row.state_id,
          state_name: row.states?.name ?? '',
          pincode: row.pincode,
          address_full: addressFull,
          address_key: row.address_key,
          is_default: row.is_default != null ? Boolean(row.is_default) : siteNo === 0,
          status: row.status || 'active',
          deleted_at: row.deleted_at || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      return {
        client: clientRes.data as any,
        sites,
        counts: {
          total_sites: sites.length,
          active_sites: sites.filter((s) => s.status === 'active').length,
          assigned_machines: machinesCountRes.count || 0,
          total_logs: logsCountRes.count || 0,
        },
      };
    },
    [`clients:with-sites:${clientId}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, // 600s
      tags: [TAGS.clientSites(clientId), TAGS.clientDetail(clientId)],
    }
  )();
});

/**
 * Fetch all sites for a client. Cached with tag-based invalidation.
 */
export const getClientSites = cache(async (clientId: string): Promise<ClientSite[]> => {
  if (!clientId) return [];
  const res = await getClientWithSites(clientId);
  return res?.sites || [];
});

/**
 * Fetch active sites for a client (lean query used in dropdowns).
 * SELECT id, code, site_code, site_name, city, address_full, is_default, site_no
 * WHERE client_id = $1 AND deleted_at IS NULL AND status = 'active'
 * ORDER BY site_no ASC
 */
export const getActiveClientSites = cache(async (clientId: string): Promise<ClientSiteDropdownItem[]> => {
  if (!clientId) return [];

  return unstable_cache(
    async (): Promise<ClientSiteDropdownItem[]> => {
      const supabase = createSupabaseAdminClient();

      // Dropdown lean RPC attempt
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_client_sites_dropdown', {
        p_client_id: clientId,
      });

      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData as ClientSiteDropdownItem[];
      }

      // Direct lean query
      const { data, error } = await supabase
        .from('client_sites')
        .select('id, site_code, site_name, street, city, district, pincode, status, created_at')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any, idx: number) => {
        const siteNo = row.site_no != null ? Number(row.site_no) : idx;
        const code = row.code || (row.site_code ? row.site_code.replace(/^.*-S/, 'S') : `S${String(siteNo).padStart(2, '0')}`);
        const addressFull =
          row.address_full ||
          [row.street, row.city, row.district, row.pincode].filter(Boolean).join(', ');

        return {
          id: row.id,
          code,
          site_code: row.site_code,
          site_name: row.site_name,
          city: row.city,
          address_full: addressFull,
          is_default: row.is_default != null ? Boolean(row.is_default) : siteNo === 0,
          site_no: siteNo,
        };
      });
    },
    [`clients:sites-dropdown:${clientId}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, // 600s
      tags: [TAGS.clientSites(clientId)],
    }
  )();
});
