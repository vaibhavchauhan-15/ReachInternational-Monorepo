import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertBearer } from '@/lib/notifications/auth';
import { sendAll } from '@/lib/notifications/send-all';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ClaimedPushRow } from '@/lib/notifications/types';

const dispatchBodySchema = z.object({
  ids: z.array(z.string().uuid()).max(500).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 60;
export const preferredRegion = 'bom1';

export async function POST(req: Request) {
  try {
    const notifySecret = process.env.NOTIFY_SECRET;
    if (!notifySecret) {
      console.error('[NotifyDispatch] NOTIFY_SECRET is not configured on server');
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

  // Master kill-switch check
  if (process.env.PUSH_ENABLED !== 'true') {
    return NextResponse.json({ disabled: true, reason: 'PUSH_ENABLED is not true' });
  }

  const parsedBody = dispatchBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const ids: string[] | undefined = parsedBody.data.ids;

  const admin = createSupabaseAdminClient();
  const started = Date.now();
  let totalProcessed = 0;

  // Drain claimed batches within 45s execution window
  while (Date.now() - started < 45_000) {
    const { data: rows, error: claimErr } = await admin.rpc('claim_push_batch', {
      p_limit: 200,
      p_ids: ids ?? null,
    });

    if (claimErr) {
      console.error('[NotifyDispatch] Failed to claim push batch:', claimErr);
      return NextResponse.json(
        { error: 'Failed to claim push batch', details: claimErr.message },
        { status: 500 }
      );
    }

    const claimedRows = (rows as ClaimedPushRow[]) || [];
    if (claimedRows.length === 0) {
      break;
    }

    // Latency instrumentation: provider request window starts here.
    const uniqueIds = [...new Set(claimedRows.map((r) => r.notification_id))];
    const { error: beginErr } = await admin.rpc('begin_push_send', { p_ids: uniqueIds });
    if (beginErr) {
      console.warn('[NotifyDispatch] Failed to record send_started_at:', beginErr.message);
    }

    const results = await sendAll(claimedRows);

    const { error: finishErr } = await admin.rpc('finish_push_batch', {
      p_results: results,
    });

    if (finishErr) {
      console.error('[NotifyDispatch] Failed to finish push batch:', finishErr);
    }

    totalProcessed += claimedRows.length;

    // Fast-path calls targeting specific IDs exit immediately after first pass
    if (ids && ids.length > 0) {
      break;
    }
  }

  return NextResponse.json({
    success: true,
    processed: totalProcessed,
    elapsedMs: Date.now() - started,
  });
}
