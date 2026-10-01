import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { TAGS, CACHE_TIERS } from '@/lib/cache';

export interface ClientSite {
  id: string;
  client_id: string;
  site_code: string;
  site_name: string;
  street: string;
  city: string;
  district: string;
  state_id: number;
  state_name: string;
  pincode: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all sites for a client. Cached with tag-based invalidation.
 */
export const getClientSites = cache(async (clientId: string): Promise<ClientSite[]> => {
  return unstable_cache(
    async (): Promise<ClientSite[]> => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from('client_sites')
        .select('id, client_id, site_code, site_name, street, city, district, state_id, pincode, status, created_at, updated_at, states!inner(name)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        client_id: row.client_id,
        site_code: row.site_code,
        site_name: row.site_name,
        street: row.street,
        city: row.city,
        district: row.district,
        state_id: row.state_id,
        state_name: row.states?.name ?? '',
        pincode: row.pincode,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    },
    [`clients:sites:${clientId}`],
    {
      revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, // 600s
      tags: [TAGS.clientSites(clientId), TAGS.clientDetail(clientId)],
    }
  )();
});

/**
 * Fetch active sites for a client (used in dropdowns).
 */
export const getActiveClientSites = cache(async (clientId: string): Promise<ClientSite[]> => {
  const sites = await getClientSites(clientId);
  return sites.filter((s) => s.status === 'active');
});
