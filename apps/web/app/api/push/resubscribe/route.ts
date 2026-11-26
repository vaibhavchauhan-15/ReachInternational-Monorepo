import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Re-registers a changed/expired Web Push subscription for the authenticated
 * user. Called by the service worker on `pushsubscriptionchange` (which can
 * fire with no tab open) and by the page after re-subscribing. Endpoint
 * validation is enforced server-side inside `register_push_device` (SSRF
 * guard); this route adds schema validation and session binding on top.
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(10).max(512),
  }),
  installationId: z.string().uuid().optional(),
  vapidVersion: z.string().max(32).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    const { endpoint, keys, installationId, vapidVersion } = parsed.data;

    const { error } = await supabase.rpc('register_push_device', {
      p_platform: 'web',
      p_token: endpoint,
      p_provider: 'webpush',
      p_web_keys: { p256dh: keys.p256dh, auth: keys.auth },
      p_installation_id: installationId ?? null,
      p_vapid_version: vapidVersion ?? null,
    });

    if (error) {
      // Invalid endpoint host/format are client-data problems (4xx); anything
      // else is transient.
      const isClientData =
        error.message.includes('invalid_endpoint_host') ||
        error.message.includes('invalid_token_format');
      return NextResponse.json(
        { error: error.message },
        { status: isClientData ? 400 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PushResubscribe] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
