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

  const loader: CachedLoader<T> = {
    get(force = false) {
      if (!force && value !== undefined && Date.now() - loadedAt < ttlMs) return Promise.resolve(value);
      pending ??= load()
        .then((result) => {
          value = result;
          loadedAt = Date.now();
          return result;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    invalidate() {
      value = undefined;
      loadedAt = 0;
    },
  };
  registry.add(loader as CachedLoader<unknown>);
  return loader;
}

/** Drops every cached list, e.g. on sign-out so the next user never sees stale data. */
export function clearClientCaches() {
  registry.forEach((loader) => loader.invalidate());
}
