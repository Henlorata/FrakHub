import {useEffect, useState} from "react";
import {
  Anchor, Award, Binoculars, Bomb, Car, Crosshair, Dog, Eye, Fingerprint, Flame, HeartPulse, Lock, Megaphone, Plane, Radio, Shield,
  ShieldCheck, Siren, Star, Swords, Target, Truck, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import {INVESTIGATOR_RANKS, OPERATOR_RANKS} from "@shared/ranks";
import {onClientCachesCleared} from "./cache";
import {supabase} from "./supabaseClient";
import {createVersionedLoader} from "./versioned-cache";

/**
 * The bureaus' own ranks and titles (database: division_ranks, division_titles). The Bureau
 * Commander of a division edits its lists, the Bureau Manager every division's. The catalogue is
 * small, kept between visits (versioned-cache.ts) and read again only when it changes; the
 * permission mirrors below read the last loaded copy synchronously (until then, the lists the app
 * shipped with).
 */

export interface DivisionRank {
  id: string;
  division: string;
  name: string;
  sort_order: number;
  /** MCB: sees every case, approves warrants (formerly fixed as "Investigator III."). */
  privileged: boolean;
}

export type TitleTone = "amber" | "rose" | "emerald" | "sky" | "violet" | "orange" | "cyan" | "slate" | "red";

export interface DivisionTitle {
  id: string;
  division: string;
  name: string;
  icon: string;
  tone: TitleTone;
  description: string | null;
  sort_order: number;
}

export interface BureauCatalog {
  ranks: DivisionRank[];
  titles: DivisionTitle[];
}

const shipped = (division: string, names: readonly string[]): DivisionRank[] => names.map((name, index) => ({
  id: `default-${division}-${index + 1}`, division, name, sort_order: (index + 1) * 10,
  privileged: division === "MCB" && name === "Investigator III.",
}));

/** The lists the app shipped with (until the database answers). Titles have no fixed ids. */
export const DEFAULT_CATALOG: BureauCatalog = {
  ranks: [...shipped("MCB", INVESTIGATOR_RANKS), ...shipped("SEB", OPERATOR_RANKS)],
  titles: [],
};

let snapshot: BureauCatalog = DEFAULT_CATALOG;
const listeners = new Set<(catalog: BureauCatalog) => void>();
const publish = (next: BureauCatalog) => {
  snapshot = next;
  listeners.forEach((listener) => listener(next));
};
onClientCachesCleared(() => publish(DEFAULT_CATALOG));

const loader = createVersionedLoader("bureaus", ["bureaus"], async (): Promise<BureauCatalog> => {
  const {data, error} = await supabase.rpc("get_bureau_catalog");
  if (error) throw error;
  const value = data as Partial<BureauCatalog> | null;
  if (!value || !Array.isArray(value.ranks)) throw new Error("no catalogue");
  return {ranks: value.ranks, titles: Array.isArray(value.titles) ? value.titles : []};
});

/** Loads the catalogue (cached); keeps the last known copy when the call fails. */
export async function loadBureauCatalog(force = false): Promise<BureauCatalog> {
  try {
    const next = await loader.get(force);
    if (next !== snapshot) publish(next);
  } catch {
    // The shipped lists (or the last loaded copy) stay in use.
  }
  return snapshot;
}

/** The current catalogue; loads it on first use. */
export function useBureauCatalog(enabled = true): BureauCatalog {
  const [catalog, setCatalog] = useState(snapshot);
  useEffect(() => {
    listeners.add(setCatalog);
    if (enabled) void loadBureauCatalog();
    return () => {
      listeners.delete(setCatalog);
    };
  }, [enabled]);
  return catalog;
}

const byOrder = <T extends {sort_order: number; name: string}>(a: T, b: T) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "hu");

/** A division's ranks, highest first. */
export const divisionRanks = (division: string | null | undefined, catalog: BureauCatalog = snapshot): DivisionRank[] =>
  catalog.ranks.filter((rank) => rank.division === division).sort(byOrder);

/** A division's titles in their order. */
export const divisionTitles = (division: string | null | undefined, catalog: BureauCatalog = snapshot): DivisionTitle[] =>
  catalog.titles.filter((title) => title.division === division).sort(byOrder);

/** The titles of a member (unknown ids are left out). */
export const titlesOf = (ids: readonly string[] | null | undefined, catalog: BureauCatalog = snapshot): DivisionTitle[] =>
  (ids ?? []).map((id) => catalog.titles.find((title) => title.id === id)).filter((title): title is DivisionTitle => !!title).sort(byOrder);

/** Position of a rank inside its division (for sorting members), unknown ranks last. */
export const divisionRankOrder = (division: string | null | undefined, rank: string | null | undefined): number => {
  const found = rank ? snapshot.ranks.find((item) => item.division === division && item.name === rank) : undefined;
  return found ? found.sort_order : 9_999;
};

/** Mirror of private.has_privileged_division_rank(). */
export const isPrivilegedRank = (division: string | null | undefined, rank: string | null | undefined): boolean =>
  !!rank && snapshot.ranks.some((item) => item.division === division && item.name === rank && item.privileged);

// --- Looks ------------------------------------------------------------------------------

export const TITLE_ICONS: {key: string; label: string; icon: LucideIcon}[] = [
  {key: "heart-pulse", label: "Egészségügy", icon: HeartPulse},
  {key: "crosshair", label: "Lövész", icon: Crosshair},
  {key: "target", label: "Célpont", icon: Target},
  {key: "binoculars", label: "Megfigyelés", icon: Binoculars},
  {key: "eye", label: "Felderítés", icon: Eye},
  {key: "bomb", label: "Robbantás", icon: Bomb},
  {key: "flame", label: "Tűz", icon: Flame},
  {key: "shield", label: "Pajzs", icon: Shield},
  {key: "shield-check", label: "Védelem", icon: ShieldCheck},
  {key: "swords", label: "Közelharc", icon: Swords},
  {key: "radio", label: "Rádió", icon: Radio},
  {key: "megaphone", label: "Tárgyaló", icon: Megaphone},
  {key: "siren", label: "Riasztás", icon: Siren},
  {key: "car", label: "Vezető", icon: Car},
  {key: "truck", label: "Szállítás", icon: Truck},
  {key: "plane", label: "Légi", icon: Plane},
  {key: "anchor", label: "Vízi", icon: Anchor},
  {key: "dog", label: "Kutyás", icon: Dog},
  {key: "fingerprint", label: "Helyszínelő", icon: Fingerprint},
  {key: "lock", label: "Zárak", icon: Lock},
  {key: "wrench", label: "Technika", icon: Wrench},
  {key: "zap", label: "Gyors", icon: Zap},
  {key: "star", label: "Csillag", icon: Star},
  {key: "award", label: "Kitüntetés", icon: Award},
];

export const titleIcon = (key: string | null | undefined): LucideIcon => TITLE_ICONS.find((item) => item.key === key)?.icon ?? Award;

export const TITLE_TONES: Record<TitleTone, {label: string; chip: string; swatch: string}> = {
  rose: {label: "Rózsa", chip: "bg-rose-500/10 text-rose-200 ring-rose-500/35", swatch: "bg-rose-400"},
  amber: {label: "Borostyán", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/35", swatch: "bg-amber-400"},
  emerald: {label: "Smaragd", chip: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/35", swatch: "bg-emerald-400"},
  sky: {label: "Ég", chip: "bg-sky-500/10 text-sky-200 ring-sky-500/35", swatch: "bg-sky-400"},
  violet: {label: "Ibolya", chip: "bg-violet-500/10 text-violet-200 ring-violet-500/35", swatch: "bg-violet-400"},
  orange: {label: "Narancs", chip: "bg-orange-500/10 text-orange-200 ring-orange-500/35", swatch: "bg-orange-400"},
  cyan: {label: "Cián", chip: "bg-cyan-500/10 text-cyan-200 ring-cyan-500/35", swatch: "bg-cyan-400"},
  slate: {label: "Pala", chip: "bg-slate-500/10 text-slate-200 ring-slate-500/35", swatch: "bg-slate-400"},
  red: {label: "Piros", chip: "bg-red-500/10 text-red-200 ring-red-500/35", swatch: "bg-red-400"},
};

export const titleTone = (tone: string | null | undefined) => TITLE_TONES[(tone ?? "amber") as TitleTone] ?? TITLE_TONES.amber;

// --- Editing (the division's Bureau Commander, the Bureau Manager) -------------------------

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

const refreshAfter = async <T>(work: Promise<T>): Promise<T> => {
  try {
    return await work;
  } finally {
    loader.invalidate();
    void loadBureauCatalog(true);
  }
};

export const bureauApi = {
  saveRank: (rank: {id: string | null; division: string; name: string; privileged?: boolean | null}) =>
    refreshAfter(rpc<DivisionRank>("save_division_rank", {_id: rank.id, _division: rank.division, _name: rank.name, _privileged: rank.privileged ?? null})),
  /** Returns how many members were moved. */
  deleteRank: (id: string, moveTo: string | null) => refreshAfter(rpc<number>("delete_division_rank", {_id: id, _move_to: moveTo})),
  reorderRanks: (division: string, ids: string[]) => refreshAfter(rpc<null>("reorder_division_ranks", {_division: division, _ids: ids})),
  saveTitle: (title: {id: string | null; division: string; name: string; icon: string; tone: string; description: string | null}) =>
    refreshAfter(rpc<DivisionTitle>("save_division_title", {
      _id: title.id, _division: title.division, _name: title.name, _icon: title.icon, _tone: title.tone, _description: title.description,
    })),
  /** Returns how many members held it. */
  deleteTitle: (id: string) => refreshAfter(rpc<number>("delete_division_title", {_id: id})),
  reorderTitles: (division: string, ids: string[]) => refreshAfter(rpc<null>("reorder_division_titles", {_division: division, _ids: ids})),
};
