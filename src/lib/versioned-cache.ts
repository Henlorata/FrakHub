import {cacheEpoch} from "./cache-epoch";
import {onClientCachesCleared} from "./cache";
import {sandbox} from "./sandbox/state";
import {supabase} from "./supabaseClient";

/**
 * Lists kept in the browser between visits (Supabase egress): the member directory, the fleet,
 * the HR registry, the suspect list, the bureau catalogue and the case templates. Each copy is
 * stored with the versions of the database tables it comes from (private.cache_versions, bumped by
 * statement triggers). A visit asks for every version in one small call (get_cache_versions(),
 * reused for 15 s and refreshed right after the app's own writes) and downloads a list again only
 * when one of its tables changed.
 *
 * The copies belong to one member and their rights (rank, role, division and leadership are part
 * of the key), are removed on sign-out, and are never used in practice mode. When the versions
 * cannot be read the lists simply load as before, without storing anything.
 */

const STORAGE_PREFIX = "frakhub.cache.";
const VERSIONS_TTL_MS = 15_000;

type Versions = Record<string, number>;

interface Identity {
  key: string;
}

let identity: Identity | null = null;

interface RightsSubject {
  id: string;
  faction_rank: string;
  system_role?: string | null;
  division?: string | null;
  division_rank?: string | null;
  qualifications?: readonly string[] | null;
  is_bureau_manager?: boolean | null;
  is_bureau_commander?: boolean | null;
  commanded_divisions?: readonly string[] | null;
}

/** The signed-in member (AuthContext): a change of their rights makes every stored copy unusable. */
export function setCacheIdentity(profile: RightsSubject | null) {
  identity = profile ? {key: [
    profile.id, profile.system_role ?? "", profile.faction_rank, profile.division ?? "", profile.division_rank ?? "",
    [...(profile.qualifications ?? [])].sort().join("+"), profile.is_bureau_manager ? "bm" : "", profile.is_bureau_commander ? "bc" : "",
    [...(profile.commanded_divisions ?? [])].sort().join("+"),
  ].join("|")} : null;
}

// --- The versions ------------------------------------------------------------------------

let memo: {at: number; epoch: number; promise: Promise<Versions | null>} | null = null;

function currentVersions(fresh = false): Promise<Versions | null> {
  const now = Date.now();
  if (!fresh && memo && now - memo.at < VERSIONS_TTL_MS && memo.epoch === cacheEpoch()) return memo.promise;
  const promise = Promise.resolve(supabase.rpc("get_cache_versions"))
    .then(({data, error}) => (error || !data || typeof data !== "object" ? null : data as Versions))
    .catch(() => null);
  memo = {at: now, epoch: cacheEpoch(), promise};
  return promise;
}

// --- Stored copies -------------------------------------------------------------------------

interface Stored<T> {
  identity: string;
  stamp: string;
  data: T;
}

function readStored<T>(name: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + name);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
}

function writeStored<T>(name: string, value: Stored<T>) {
  try {
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
  } catch {
    // A full storage only costs the next visit a download.
  }
}

/** Removes every stored copy (sign-out). */
export function clearStoredCaches() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: nothing was stored either.
  }
  memo = null;
}

// --- Loaders --------------------------------------------------------------------------------

export interface VersionedLoader<T> {
  /** The stored copy while its tables are unchanged, otherwise a fresh load (`force`: always fresh). */
  get: (force?: boolean) => Promise<T>;
  /** Drops the copy (after a change the caller made itself). */
  invalidate: () => void;
}

/**
 * A list stored between visits. `name` is the storage key, `deps` the cache_versions keys of the
 * tables it reads. Keep sensitive fields (bank accounts, internal notes) out of what `load` returns:
 * the value is stored as it is.
 */
export function createVersionedLoader<T>(name: string, deps: string[], load: () => Promise<T>): VersionedLoader<T> {
  let memory: Stored<T> | null = null;
  let pending: Promise<T> | null = null;
  let generation = 0;
  onClientCachesCleared(() => {
    memory = null;
    pending = null;
    generation += 1;
  });

  const stampOf = (versions: Versions) => deps.map((key) => `${key}:${versions[key] ?? 0}`).join(",");

  const run = async (force: boolean): Promise<T> => {
    const who = identity?.key ?? null;
    // Practice mode and signed-out visitors: no stored copies at all.
    if (!who || sandbox.isActive()) return load();
    const started = generation;
    const versions = await currentVersions(force);
    if (!versions) return load();
    const stamp = stampOf(versions);
    if (!force) {
      if (memory && memory.identity === who && memory.stamp === stamp) return memory.data;
      const stored = readStored<T>(name);
      if (stored && stored.identity === who && stored.stamp === stamp) {
        memory = stored;
        return stored.data;
      }
    }
    const data = await load();
    if (started === generation && identity?.key === who && !sandbox.isActive()) {
      memory = {identity: who, stamp, data};
      writeStored(name, memory);
    }
    return data;
  };

  return {
    get(force = false) {
      if (pending && !force) return pending;
      const request = run(force).finally(() => {
        if (pending === request) pending = null;
      });
      pending = request;
      return request;
    },
    invalidate() {
      memory = null;
      pending = null;
      generation += 1;
      try {
        localStorage.removeItem(STORAGE_PREFIX + name);
      } catch {
        // Nothing stored.
      }
    },
  };
}
