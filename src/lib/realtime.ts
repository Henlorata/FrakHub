let sequence = 0;

/**
 * Unique Realtime topic per subscription. supabase-js hands back an existing channel
 * when the topic is still registered (e.g. while the previous effect's channel is
 * leaving after a remount), and subscribing that instance again throws.
 */
export const uniqueChannelName = (prefix: string) => `${prefix}:${++sequence}`;
