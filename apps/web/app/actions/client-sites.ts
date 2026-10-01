'use server';

import { revalidateTag } from 'next/cache';
import { verifySession, requireRole } from '@/lib/dal';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { SiteSchema } from '@reachinternational/validation';
import { TAGS } from '@/lib/cache';

export async function createClientSite(
  clientId: string,
  formData: {
    site_name: string;
    street: string;
    city: string;
    district: string;
    state_id: number;
    pincode: string;
  }
) {
  const session = await verifySession();
  if (!session) return { error: 'Not authenticated' };
  await requireRole('super_admin', 'admin', 'manager');

  const parsed = SiteSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Validation failed' };
  }

  const supabase = await createSupabaseServerClient();

  // Check for similar sites (warning, not blocking)
  const { data: similar } = await supabase.rpc('find_similar_sites', {
    p_client_id: clientId,
    p_street: parsed.data.street,
    p_pincode: parsed.data.pincode,
  });

  // Insert the site
  const { data, error } = await supabase
    .from('client_sites')
    .insert({
      client_id: clientId,
      site_name: parsed.data.site_name,
      street: parsed.data.street,
      city: parsed.data.city,
      district: parsed.data.district,
      state_id: parsed.data.state_id,
      pincode: parsed.data.pincode,
    })
    .select('id, site_code')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique violation — duplicate address
      if (error.message.includes('address_key')) {
        return { error: 'A site with this address already exists for this client.' };
      }
      if (error.message.includes('site_name')) {
        return { error: 'A site with this name already exists for this client.' };
      }
    }
    return { error: error.message || 'Failed to create site' };
  }

  await logAudit({
    action: 'site.created',
    entity_id: data.id,
    entity_type: 'client_sites',
    metadata: {
      site_code: data.site_code,
      client_id: clientId,
      site_name: parsed.data.site_name,
    },
    user_id: session.userId,
  });

  // Invalidate caches
  revalidateTag(TAGS.clientSites(clientId), "max");
  revalidateTag(TAGS.clientDetail(clientId), "max");
  revalidateTag(TAGS.clients, "max");

  return {
    success: true,
    site: data,
    similarSites: similar && similar.length > 0 ? similar : undefined,
  };
}

export async function updateClientSite(
  siteId: string,
  clientId: string,
  formData: {
    site_name?: string;
    street?: string;
    city?: string;
    district?: string;
    state_id?: number;
    pincode?: string;
  }
) {
  const session = await verifySession();
  if (!session) return { error: 'Not authenticated' };
  await requireRole('super_admin', 'admin', 'manager');

  // Validate only the provided fields
  const parsed = SiteSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Validation failed' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('client_sites')
    .update(parsed.data)
    .eq('id', siteId)
    .eq('client_id', clientId)
    .select('id, site_code, site_name')
    .single();

  if (error) {
    if (error.code === '23505') {
      if (error.message.includes('address_key')) {
        return { error: 'A site with this address already exists for this client.' };
      }
      if (error.message.includes('site_name')) {
        return { error: 'A site with this name already exists for this client.' };
      }
    }
    return { error: error.message || 'Failed to update site' };
  }

  await logAudit({
    action: 'site.updated',
    entity_id: siteId,
    entity_type: 'client_sites',
    metadata: {
      client_id: clientId,
      changes: parsed.data,
    },
    user_id: session.userId,
  });

  revalidateTag(TAGS.clientSites(clientId), "max");
  revalidateTag(TAGS.clientDetail(clientId), "max");

  return { success: true, site: data };
}

export async function deactivateClientSite(siteId: string, clientId: string) {
  const session = await verifySession();
  if (!session) return { error: 'Not authenticated' };
  await requireRole('super_admin', 'admin', 'manager');

  const supabase = await createSupabaseServerClient();

  // Check no active machines at this site
  const { count } = await supabase
    .from('machines')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .neq('status', 'available');

  if (count && count > 0) {
    return { error: `Cannot deactivate site: ${count} active machine(s) still assigned.` };
  }

  const { error } = await supabase
    .from('client_sites')
    .update({ status: 'inactive' })
    .eq('id', siteId)
    .eq('client_id', clientId);

  if (error) return { error: error.message || 'Failed to deactivate site' };

  await logAudit({
    action: 'site.deactivated',
    entity_id: siteId,
    entity_type: 'client_sites',
    metadata: {
      client_id: clientId,
    },
    user_id: session.userId,
  });

  revalidateTag(TAGS.clientSites(clientId), "max");
  revalidateTag(TAGS.clientDetail(clientId), "max");

  return { success: true };
}

export async function getClientSitesAction(clientId: string) {
  if (!clientId) return [];
  const { getActiveClientSites } = await import("@/lib/data/clients/client-sites");
  return getActiveClientSites(clientId);
}
