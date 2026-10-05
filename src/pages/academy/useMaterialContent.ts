import {useEffect, useState} from "react";
import {supabase} from "@/lib/supabaseClient";
import {onClientCachesCleared} from "@/lib/cache";

export type MaterialTable = "academy_materials" | "academy_division_materials";

/** Column list for material lists: everything except the (large) document content. */
export const MATERIAL_LIST_COLUMNS = {
  academy_materials: "id, title, day_number, page_order, category, theme, updated_at",
  academy_division_materials: "id, course_id, title, page_order, theme",
} as const;

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, {content: unknown; at: number}>();
const cacheKey = (table: MaterialTable, id: string) => `${table}:${id}`;
onClientCachesCleared(() => cache.clear());

function readCache(key: string) {
  const entry = cache.get(key);
  return entry && Date.now() - entry.at < TTL_MS ? entry : undefined;
}

/** Stores freshly saved content so the next view does not refetch it. */
export function setMaterialContent(table: MaterialTable, id: string, content: unknown) {
  cache.set(cacheKey(table, id), {content, at: Date.now()});
}

export function forgetMaterialContent(table: MaterialTable, id: string) {
  cache.delete(cacheKey(table, id));
}

/** Loads one page's content on demand (cached), instead of every page of a course at once. */
export async function fetchMaterialContent(table: MaterialTable, id: string): Promise<unknown> {
  const key = cacheKey(table, id);
  const cached = readCache(key);
  if (cached) return cached.content;
  const {data, error} = await supabase.from(table).select("content").eq("id", id).maybeSingle();
  if (error) throw error;
  const content = (data as {content?: unknown} | null)?.content ?? null;
  cache.set(key, {content, at: Date.now()});
  return content;
}

export function useMaterialContent(table: MaterialTable, id: string | undefined) {
  const key = id ? cacheKey(table, id) : "";
  const [loaded, setLoaded] = useState<{key: string; content: unknown} | null>(null);
  const cached = key ? readCache(key) : undefined;

  useEffect(() => {
    if (!id || readCache(cacheKey(table, id))) return;
    let active = true;
    fetchMaterialContent(table, id)
      .then((content) => {
        if (active) setLoaded({key: cacheKey(table, id), content});
      })
      .catch((error) => console.error("Tananyag betöltési hiba:", error));
    return () => {
      active = false;
    };
  }, [table, id]);

  if (!key) return {content: undefined, loading: false};
  if (cached) return {content: cached.content, loading: false};
  if (loaded?.key === key) return {content: loaded.content, loading: false};
  return {content: undefined, loading: true};
}
