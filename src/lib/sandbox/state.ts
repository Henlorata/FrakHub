import {useSyncExternalStore} from "react";
import {clearClientCaches} from "@/lib/cache";

/** What the Supabase client and the API helper ask while practice mode is on. */
export interface SandboxBackend {
  /** Answers a PostgREST/Storage request in memory (nothing reaches the database). */
  handle: (url: string, init?: RequestInit) => Promise<Response>;
  /** Answers a call to one of our `api/` functions. */
  api: (path: string, body: unknown) => Promise<unknown>;
}

let backend: SandboxBackend | null = null;
let epoch = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// --- The app's own localStorage keys stay untouched during practice -------------------------

/**
 * Drafts, the calculator's history, the report folder link and the like would otherwise keep what
 * was typed in practice mode. Their writes go to a throw-away overlay instead (reads see the overlay
 * first, then the real value). The Supabase session (`sb-*`), the training progress and the chunk
 * reload guard are real and pass through.
 */
const overlay = new Map<string, string | null>();
let restoreStorage: (() => void) | null = null;
const isolated = (key: string) => (key.startsWith("frakhub") || key.startsWith("sfsd_"))
  && !key.startsWith("frakhub.training.") && key !== "frakhub:chunk-reload-at";

function isolateStorage() {
  if (restoreStorage || typeof Storage === "undefined") return;
  const proto = Storage.prototype;
  const {getItem, setItem, removeItem} = proto;
  const local = window.localStorage;
  proto.getItem = function (this: Storage, key: string) {
    if (this === local && isolated(key) && overlay.has(key)) return overlay.get(key) ?? null;
    return getItem.call(this, key);
  };
  proto.setItem = function (this: Storage, key: string, value: string) {
    if (this === local && isolated(key)) overlay.set(key, String(value));
    else setItem.call(this, key, value);
  };
  proto.removeItem = function (this: Storage, key: string) {
    if (this === local && isolated(key)) overlay.set(key, null);
    else removeItem.call(this, key);
  };
  restoreStorage = () => {
    Object.assign(proto, {getItem, setItem, removeItem});
    overlay.clear();
    restoreStorage = null;
  };
}

/**
 * Practice mode of the trainings: while a backend is installed, the app talks to an in-memory demo
 * world instead of Supabase, so trainees can click everything without touching real data (and any
 * number of people can practise at once: the world lives in their own tab). Entering and leaving
 * clears the client caches and bumps the epoch, which remounts the routes with fresh data.
 */
export const sandbox = {
  backend: () => backend,
  isActive: () => backend !== null,
  epoch: () => epoch,
  enter(next: SandboxBackend) {
    backend = next;
    isolateStorage();
    epoch += 1;
    clearClientCaches();
    emit();
  },
  exit() {
    if (!backend) return;
    backend = null;
    restoreStorage?.();
    epoch += 1;
    clearClientCaches();
    emit();
  },
  subscribe,
};

export const useSandboxEpoch = () => useSyncExternalStore(subscribe, sandbox.epoch);
export const useSandboxActive = () => useSyncExternalStore(subscribe, sandbox.isActive);
