import {createClient, type RealtimeChannel} from "@supabase/supabase-js";
import {env} from "./env";
import {sandbox} from "./sandbox/state";

const SUPABASE_URL = env.supabaseUrl || "https://missing-config.invalid";

/**
 * Requests the practice mode answers itself. Sign-in and the training progress (the one thing a
 * training stores for real) go to Supabase.
 */
const handledInSandbox = (url: string) =>
  (url.startsWith(`${SUPABASE_URL}/rest/v1/`) && !url.startsWith(`${SUPABASE_URL}/rest/v1/training_progress`))
  || url.startsWith(`${SUPABASE_URL}/storage/v1/`);

const sandboxAwareFetch: typeof fetch = (input, init) => {
  const backend = sandbox.backend();
  if (backend) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (handledInSandbox(url)) return backend.handle(url, init);
  }
  return fetch(input, init);
};

/**
 * Browser Supabase client. Authenticated as the signed-in user, so every query is
 * subject to Row Level Security.
 *
 * Intentionally untyped: the old hand-written `Database` type no longer matched the
 * live schema. Generate real types with `bun run db:types` and pass the generated
 * `Database` type to `createClient<Database>()` to get end-to-end typing back.
 */
export const supabase = createClient(
  // Placeholders keep module evaluation from throwing when configuration is missing;
  // App then renders a configuration error screen instead of a blank page.
  SUPABASE_URL,
  env.supabaseKey || "missing-key",
  {global: {fetch: sandboxAwareFetch}},
);

// --- Practice mode: Realtime stays silent ---------------------------------------------

const FAKE = Symbol("sandbox-channel");

/** A channel that never connects (practice mode has no live data). */
function fakeChannel(topic: string): RealtimeChannel {
  const channel = {
    [FAKE]: true,
    topic: `realtime:${topic}`,
    on: () => channel,
    subscribe: (callback?: (status: string) => void) => {
      queueMicrotask(() => callback?.("SUBSCRIBED"));
      return channel;
    },
    unsubscribe: async () => "ok" as const,
    teardown: () => undefined,
    track: async () => "ok" as const,
    untrack: async () => "ok" as const,
    send: async () => "ok" as const,
    presenceState: () => ({}),
  };
  return channel as unknown as RealtimeChannel;
}

const realChannel = supabase.channel.bind(supabase);
const realRemoveChannel = supabase.removeChannel.bind(supabase);
supabase.channel = ((name: string, options?: Parameters<typeof realChannel>[1]) =>
  sandbox.isActive() ? fakeChannel(name) : realChannel(name, options)) as typeof supabase.channel;
supabase.removeChannel = ((channel: RealtimeChannel) =>
  (channel as unknown as {[FAKE]?: boolean})[FAKE] ? Promise.resolve("ok" as const) : realRemoveChannel(channel)) as typeof supabase.removeChannel;
