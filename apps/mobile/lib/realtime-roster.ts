import { supabase } from './supabase';

export interface MobileRosterAssignmentBroadcastPayload {
  action: 'assigned' | 'unassigned' | 'updated';
  machineId?: string;
  operatorId?: string;
  shiftCode?: string;
  timestamp: number;
}

/**
 * Broadcasts an assignment_changed event over the Supabase Realtime channel `operations-roster`.
 * Ensures other connected supervisors, managers, and web sessions immediately revalidate their shift rosters.
 */
export async function broadcastMobileAssignmentChanged(payload: {
  action: 'assigned' | 'unassigned' | 'updated';
  machineId?: string;
  operatorId?: string;
  shiftCode?: string;
}): Promise<void> {
  try {
    const channel = supabase.channel('operations-roster');

    const fullPayload: MobileRosterAssignmentBroadcastPayload = {
      ...payload,
      timestamp: Date.now(),
    };

    if ((channel as any).state === 'joined') {
      await channel.send({
        type: 'broadcast',
        event: 'assignment_changed',
        payload: fullPayload,
      });
    } else {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 3000);
        channel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            try {
              await channel.send({
                type: 'broadcast',
                event: 'assignment_changed',
                payload: fullPayload,
              });
            } catch (err) {
              console.warn('[mobile realtime-roster] send error:', err);
            }
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
  } catch (err) {
    console.warn('[broadcastMobileAssignmentChanged] failed to broadcast:', err);
  }
}
