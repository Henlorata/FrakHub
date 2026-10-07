import {useEffect, useMemo, useState} from "react";
import {supabase} from "@/lib/supabaseClient";
import {onClientCachesCleared} from "@/lib/cache";
import type {SignatureData} from "./geometry";

export type SignatureMethod = "draw" | "upload" | "style" | "auto";

export interface StoredSignature extends SignatureData {
  method: SignatureMethod;
  style: string | null;
  updated_at: string;
}

/**
 * Signatures are read only where documents show them (prints, the profile), a few at a time, and
 * kept for the session. Whether the member has one is also remembered on the device, so the
 * reminder popup does not ask the database again.
 */
const cache = new Map<string, StoredSignature | null>();
const listeners = new Set<() => void>();
onClientCachesCleared(() => {
  cache.clear();
  presence.clear();
  listeners.forEach((listener) => listener());
});

const HAS_KEY = (userId: string) => `frakhub.signature.${userId}`;
/** Whether the member has a signature, as the profile read (AuthContext) found it. */
const presence = new Map<string, boolean>();

/** True/false when known from the profile read (no request needed), undefined otherwise. */
export const signaturePresence = (userId: string) => presence.get(userId);

export function rememberHasSignature(userId: string, has: boolean) {
  presence.set(userId, has);
  try {
    if (has) localStorage.setItem(HAS_KEY(userId), "1");
    else localStorage.removeItem(HAS_KEY(userId));
  } catch {
    // Storage disabled: the popup asks once per session instead.
  }
}

export const knownToHaveSignature = (userId: string) => {
  try {
    return localStorage.getItem(HAS_KEY(userId)) === "1";
  } catch {
    return false;
  }
};

async function fetchMissing(ids: string[]) {
  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length === 0) return;
  const {data, error} = await supabase.from("member_signatures")
    .select("user_id, path, width, height, method, style, updated_at").in("user_id", missing);
  if (error) throw error;
  for (const id of missing) cache.set(id, null);
  for (const row of (data ?? []) as (StoredSignature & {user_id: string})[]) {
    const {user_id: userId, ...signature} = row;
    cache.set(userId, signature);
  }
  listeners.forEach((listener) => listener());
}

export const signatureApi = {
  async get(userId: string): Promise<StoredSignature | null> {
    await fetchMissing([userId]);
    return cache.get(userId) ?? null;
  },
  async save(userId: string, signature: SignatureData, method: SignatureMethod, style: string | null = null) {
    const {error} = await supabase.rpc("save_signature", {
      _path: signature.path, _width: signature.width, _height: signature.height, _method: method, _style: style,
    });
    if (error) throw error;
    cache.set(userId, {...signature, method, style, updated_at: new Date().toISOString()});
    rememberHasSignature(userId, true);
    listeners.forEach((listener) => listener());
  },
  async remove(userId: string) {
    const {error} = await supabase.rpc("delete_signature");
    if (error) throw error;
    cache.set(userId, null);
    rememberHasSignature(userId, false);
    listeners.forEach((listener) => listener());
  },
};

/** The signatures of the given members (null: none set; undefined: still loading). */
export function useSignatures(ids: (string | null | undefined)[]) {
  const key = useMemo(() => [...new Set(ids.filter((id): id is string => !!id))].sort().join(","), [ids]);
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!key) return;
    fetchMissing(key.split(",")).catch((error) => console.error("Aláírás betöltési hiba:", error));
  }, [key]);
  return (id: string | null | undefined): StoredSignature | null | undefined => (id ? (cache.has(id) ? cache.get(id) : undefined) : null);
}
