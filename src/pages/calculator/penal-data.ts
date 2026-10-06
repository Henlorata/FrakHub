import {LEGACY_ITEM_IDS, prepareData} from "@/lib/penalcode-processor";
import type {KategoriaData, PenalCodeGroup, PenalCodeItem} from "@/types/penalcode";

export interface CartItem {
  item: PenalCodeItem;
  quantity: number;
}

export interface HistorySnapshot {
  cart: CartItem[];
  finalFine: number;
  finalJail: number;
  reasons: string;
  timestamp: string;
}

export interface Template {
  id: string;
  name: string;
  cart: CartItem[];
  savedFine: number;
  savedJail: number;
}

export interface Summary {
  minFine: number;
  maxFine: number;
  minJail: number;
  maxJail: number;
  /** Items whose fine or jail time is not a plain number ("+10 perc", "Bíró dönt", …). */
  specialNotes: string[];
  warnings: PenalCodeItem[];
}

export type ListGroup = PenalCodeGroup & {matchType?: "group" | "children"};
export interface ListCategory {
  kategoria_nev: string;
  items: (PenalCodeItem | ListGroup)[];
}

export const CATEGORIES: KategoriaData[] = prepareData();
export const ITEMS = new Map<string, PenalCodeItem>();
CATEGORIES.forEach((category) => category.items.forEach((entry) => {
  if ("alpontok" in entry) entry.alpontok.forEach((item) => ITEMS.set(item.id, item));
  else ITEMS.set(entry.id, entry);
}));

export const itemCount = (category: KategoriaData) =>
  category.items.reduce((sum, entry) => sum + ("alpontok" in entry ? entry.alpontok.length : 1), 0);

const migrateItemId = (id: string) => LEGACY_ITEM_IDS.get(id) ?? id;
export const migrateIds = (ids: string[]) => [...new Set(ids.map(migrateItemId))];
export const hasLegacyIds = (ids: string[]) => ids.some((id) => LEGACY_ITEM_IDS.has(id));

/** Saved carts (history, templates) get the current penal code data of their items. */
export const refreshCart = (cart: CartItem[]): CartItem[] =>
  cart.map(({item, quantity}) => ({item: ITEMS.get(migrateItemId(item.id)) ?? item, quantity}));

/** The categories filtered by the search text and/or the favourites. */
export function filterCategories(search: string, favorites: string[] | null): ListCategory[] {
  const needle = search.trim().toLowerCase();
  const matches = (text: string | null | undefined) => !!text && text.toLowerCase().includes(needle);
  const itemMatches = (item: PenalCodeItem) => (!favorites || favorites.includes(item.id))
    && (!needle || matches(item.megnevezes) || matches(item.rovidites) || matches(item.paragrafus) || matches(item.megjegyzes));

  return CATEGORIES.map((category) => ({
    kategoria_nev: category.kategoria_nev,
    items: category.items.map((entry): PenalCodeItem | ListGroup | null => {
      if (!("alpontok" in entry)) return itemMatches(entry) ? entry : null;
      const children = entry.alpontok.filter(itemMatches);
      if (children.length > 0) return {...entry, alpontok: children, matchType: needle || favorites ? "children" : undefined};
      if (!favorites && needle && (matches(entry.megnevezes) || matches(entry.paragrafus) || matches(entry.megjegyzes))) {
        return {...entry, matchType: "group"};
      }
      return null;
    }).filter((entry): entry is PenalCodeItem | ListGroup => entry !== null),
  })).filter((category) => category.items.length > 0);
}

/** Fine and jail ranges of the cart (quantities count; "+N perc" adds to both ends of the jail time). */
export function summarize(cart: CartItem[]): Summary {
  let minFine = 0, maxFine = 0, minJail = 0, maxJail = 0;
  const specialNotes: string[] = [];
  const warnings: PenalCodeItem[] = [];
  const note = (item: PenalCodeItem, value: string, quantity: number) => {
    const text = `${item.megnevezes}: ${value} (x${quantity})`;
    if (!specialNotes.includes(text)) specialNotes.push(text);
  };
  const numeric = (value: number | string | null | undefined, kind: "fine" | "jail", item: PenalCodeItem, quantity: number): number | null => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (kind === "jail" && trimmed.startsWith("+") && trimmed.endsWith("perc")) {
      const amount = Number.parseInt(trimmed.slice(1).replace("perc", "").trim(), 10);
      if (!Number.isNaN(amount)) {
        minJail += amount * quantity;
        maxJail += amount * quantity;
      }
    }
    note(item, trimmed, quantity);
    return null;
  };

  cart.forEach(({item, quantity}) => {
    if (item.isWarning && !warnings.some((warning) => warning.id === item.id)) warnings.push(item);
    const fineLow = numeric(item.min_birsag, "fine", item, quantity);
    const fineHigh = numeric(item.max_birsag, "fine", item, quantity);
    if (fineLow !== null) minFine += fineLow * quantity;
    if (fineHigh !== null) maxFine += fineHigh * quantity;
    const jailLow = numeric(item.min_fegyhaz, "jail", item, quantity);
    const jailHigh = numeric(item.max_fegyhaz, "jail", item, quantity);
    if (jailLow !== null) minJail += jailLow * quantity;
    if (jailHigh !== null) maxJail += jailHigh * quantity;
  });

  return {minFine, maxFine, minJail, maxJail, specialNotes, warnings};
}

const hasJail = (item: PenalCodeItem) =>
  (typeof item.min_fegyhaz === "number" && item.min_fegyhaz > 0) || (typeof item.max_fegyhaz === "number" && item.max_fegyhaz > 0)
  || (typeof item.min_fegyhaz === "string" && item.min_fegyhaz.startsWith("+"))
  || (typeof item.max_fegyhaz === "string" && item.max_fegyhaz.startsWith("+"));

const reasonOf = ({item, quantity}: CartItem) => `${item.rovidites}${quantity > 1 ? `(x${quantity})` : ""}`;

/** "GV, KV(x2)": the reasons typed into the in-game ticket. */
export const ticketReasons = (cart: CartItem[]) => cart.map(reasonOf).join(", ");

/** The in-game arrest command, or "" when nothing in the cart carries jail time. */
export function arrestCommand(cart: CartItem[], targetId: string, jail: number): string {
  const items = cart.filter(({item}) => hasJail(item));
  if (jail <= 0 || items.length === 0) return "";
  return `arrest ${targetId.trim() || "[ID]"} ${jail} ${items.map(reasonOf).join(", ")}`;
}

/** The offences for the report ("Gyorshajtás (x2), Rendőri utasítás megtagadása"). */
export const chargesText = (cart: CartItem[]) =>
  cart.map(({item, quantity}) => `${item.megnevezes}${quantity > 1 ? ` (x${quantity})` : ""}`).join(", ");

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max > 0 ? max : Number.POSITIVE_INFINITY);
