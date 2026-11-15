import { NextResponse } from 'next/server';
import { assertBearer } from '@/lib/notifications/auth';
import { sendAll } from '@/lib/notifications/send-all';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ClaimedPushRow } from '@/lib/notifications/types';

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

  const bodyJson = await req.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(bodyJson?.ids) ? bodyJson.ids : undefined;

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
