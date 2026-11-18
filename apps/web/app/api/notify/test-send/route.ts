import { NextResponse } from 'next/server';
import { assertBearer } from '@/lib/notifications/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const notifySecret = process.env.NOTIFY_SECRET;
    if (!notifySecret) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing NOTIFY_SECRET' },
        { status: 500 }
      );
    }

    assertBearer(req, notifySecret);
  } catch (authError: any) {
    return NextResponse.json(
      { error: authError?.message || 'Unauthorized' },
      { status: 401 }
    );
  }

  const { userId, title, body, priority, category } = (await req.json().catch(() => ({}))) as Record<string, any>;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId in request body' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: notifId, error: enqErr } = await admin.rpc('enqueue_notification', {
    p_user_id: userId,
    p_category: category || 'general_updates',
    p_priority: priority || 'normal',
    p_title: title || 'Test Notification',
    p_body: body || 'ReachInternational notification pipeline test successful.',
    p_deep_link: '/dashboard',
    p_dedupe_key: `test_manual_${userId}_${Date.now()}`,
    p_push: true,
  });

  if (enqErr) {
    return NextResponse.json({ error: enqErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    notificationId: notifId,
    message: 'Test notification queued successfully.',
  });
}
