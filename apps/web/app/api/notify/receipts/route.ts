import { NextResponse } from 'next/server';
import { Expo } from 'expo-server-sdk';
import { assertBearer } from '@/lib/notifications/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const preferredRegion = 'bom1';

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

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

  const admin = createSupabaseAdminClient();

  // 1. Fetch pending tickets created at least 15 minutes ago (up to 1,000)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: tickets, error: fetchErr } = await admin
    .from('push_tickets')
    .select('id, notification_id, device_id, ticket_id')
    .eq('status', 'ticketed')
    .lt('created_at', fifteenMinutesAgo)
    .limit(1000);

  if (fetchErr) {
    console.error('[NotifyReceipts] Error fetching tickets:', fetchErr);
    return NextResponse.json(
      { error: 'Failed to fetch tickets', details: fetchErr.message },
      { status: 500 }
    );
  }

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No tickets due for reconciliation' });
  }

  const ticketIds = tickets.map((t) => t.ticket_id);
  const ticketIdToRowMap = new Map(tickets.map((t) => [t.ticket_id, t]));

  // 2. Chunk ticket IDs for Expo receipt polling
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  let resolvedOk = 0;
  let resolvedError = 0;
  const deadDeviceIds: string[] = [];

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [tId, receipt] of Object.entries(receipts)) {
        const ticketRow = ticketIdToRowMap.get(tId);
        if (!ticketRow) continue;

        if (receipt.status === 'ok') {
          await admin
            .from('push_tickets')
            .update({ status: 'ok', error: null, outcome: 'accepted' })
            .eq('id', ticketRow.id);
          resolvedOk++;
        } else if (receipt.status === 'error') {
          const errorCode = receipt.details?.error || receipt.message || 'UnknownReceiptError';
          const isDeadDevice = receipt.details?.error === 'DeviceNotRegistered';
          await admin
            .from('push_tickets')
            .update({
              status: 'error',
              error: errorCode,
              // Terminal receipt semantics: dead device vs permanently failed
              // delivery. Provider acceptance ≠ device delivery.
              outcome: isDeadDevice ? 'dead' : 'skipped',
            })
            .eq('id', ticketRow.id);

          resolvedError++;

          if (isDeadDevice) {
            deadDeviceIds.push(ticketRow.device_id);
          }
        }
      }
    } catch (chunkErr) {
      console.warn('[NotifyReceipts] Failed to poll chunk receipts:', chunkErr);
    }
  }

  // 3. Deactivate any devices confirmed dead by Expo receipts
  if (deadDeviceIds.length > 0) {
    await admin
      .from('push_devices')
      .update({
        is_active: false,
        disabled_reason: 'DeviceNotRegistered',
      })
      .in('id', deadDeviceIds);
  }

  return NextResponse.json({
    success: true,
    totalPolled: tickets.length,
    resolvedOk,
    resolvedError,
    deadDevicesPruned: deadDeviceIds.length,
  });
}
