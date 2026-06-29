import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcfgpbknvppimqvswgjq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjZmdwYmtudnBwaW1xdnN3Z2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzgyMTYsImV4cCI6MjA4NzgxNDIxNn0.-5_MscMmHdky3lHyImwNh19Y0j9tzfeuEuA8m1mkZZ0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Real-time subscription helper
export function subscribeToUserUpdates(
  username: string,
  callback: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`user-${username}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `username=eq.${username}`,
      },
      callback
    )
    .subscribe();

  return channel;
}

// Subscribe to notifications
export function subscribeToNotifications(
  userId: number,
  callback: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return channel;
}

// Subscribe to plan changes
export function subscribeToPlanUpdates(
  callback: (payload: any) => void
): RealtimeChannel {
  const channel = supabase
    .channel('plan-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'plans',
      },
      callback
    )
    .subscribe();

  return channel;
}

// Unsubscribe helper
export function unsubscribeChannel(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
