interface CachedLoader<T> {
  /** Cached value while fresh; otherwise loads (concurrent callers share one request). */
  get: (force?: boolean) => Promise<T>;
  invalidate: () => void;
}

const registry = new Set<CachedLoader<unknown>>();

/**
 * In-memory cache with TTL and in-flight de-duplication for rarely changing lists
 * (member directory, ribbons, ...). Saves repeated identical queries when users move
 * between pages, which keeps Supabase egress and request counts down.
 */
export function createCachedLoader<T>(load: () => Promise<T>, ttlMs: number): CachedLoader<T> {
  let value: T | undefined;
  let loadedAt = 0;
  let pending: Promise<T> | null = null;
  // A load that was already running when the cache was cleared must not refill it (sign-out,
  // entering or leaving practice mode).
  let generation = 0;

  const loader: CachedLoader<T> = {
    get(force = false) {
      if (!force && value !== undefined && Date.now() - loadedAt < ttlMs) return Promise.resolve(value);
      if (pending) return pending;
      const started = generation;
      const request: Promise<T> = load()
        .then((result) => {
          if (started === generation) {
            value = result;
            loadedAt = Date.now();
          }
          return result;
        })
        .finally(() => {
          if (pending === request) pending = null;
        });
      pending = request;
      return request;
    },
    invalidate() {
      value = undefined;
      loadedAt = 0;
      pending = null;
      generation += 1;
    },
  };
  registry.add(loader as CachedLoader<unknown>);
  return loader;
}

const resets = new Set<() => void>();

/** Stores outside createCachedLoader (e.g. the fleet) forget their data on sign-out too. */
export function onClientCachesCleared(reset: () => void) {
  resets.add(reset);
}

/** Drops every cached list, e.g. on sign-out so the next user never sees stale data. */
export function clearClientCaches() {
  registry.forEach((loader) => loader.invalidate());
  resets.forEach((reset) => reset());
}
