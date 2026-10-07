import {Calendar, Megaphone, Newspaper, Radio, ShieldAlert, Siren, UserPlus, Users, type LucideIcon} from "lucide-react";
import {isHighCommand, type RankSubject} from "@shared/ranks";
import {supabase} from "./supabaseClient";
import {formatMonthDate} from "./datetime";

/**
 * The public front page and the news (edited by the Sheriff's Information Bureau): the editable
 * sections, the published articles and a few aggregate numbers, read by visitors without an
 * account (supabase/migrations/…_public_site_and_news.sql).
 */

export type NewsCategory = "news" | "press" | "recruitment" | "operation" | "event" | "community" | "wanted";

export const NEWS_CATEGORIES: Record<NewsCategory, {label: string; icon: LucideIcon; chip: string; accent: string}> = {
  news: {label: "Hír", icon: Newspaper, chip: "bg-sky-500/15 text-sky-200 ring-sky-400/30", accent: "#38bdf8"},
  press: {label: "Sajtóközlemény", icon: Megaphone, chip: "bg-amber-500/15 text-amber-100 ring-amber-400/30", accent: "#f59e0b"},
  recruitment: {label: "Toborzás", icon: UserPlus, chip: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30", accent: "#34d399"},
  operation: {label: "Akció", icon: Siren, chip: "bg-red-500/15 text-red-200 ring-red-400/30", accent: "#f87171"},
  event: {label: "Esemény", icon: Calendar, chip: "bg-violet-500/15 text-violet-200 ring-violet-400/30", accent: "#a78bfa"},
  community: {label: "Közösség", icon: Users, chip: "bg-pink-500/15 text-pink-200 ring-pink-400/30", accent: "#f472b6"},
  wanted: {label: "Körözés", icon: ShieldAlert, chip: "bg-orange-500/15 text-orange-200 ring-orange-400/30", accent: "#fb923c"},
};

export const ALERT_ICON = Radio;

export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  category: NewsCategory;
  featured: boolean;
  published_at: string | null;
  author_display: string;
}

export interface NewsPost extends NewsItem {
  body: unknown[];
  status: "draft" | "published";
  updated_at: string;
}

export interface SiteContent {
  hero?: {eyebrow?: string; title?: string; highlight?: string; subtitle?: string; primary?: string; secondary?: string};
  about?: {title?: string; lead?: string; text?: string};
  values?: {title: string; text: string}[];
  divisions?: Partial<Record<"TSB" | "SEB" | "MCB", {name?: string; subtitle?: string; text?: string}>>;
  units?: Partial<Record<UnitKey, {name?: string; text?: string}>>;
  recruitment?: {title?: string; text?: string; requirements?: string[]; steps?: {title: string; text: string}[]; exam_id?: string | null};
  faq?: {q: string; a: string}[];
  gallery?: {url: string; caption?: string}[];
  contact?: {text?: string; links?: {label: string; url: string}[]};
  sections?: Partial<Record<"stats" | "leadership" | "gallery" | "faq" | "values", boolean>>;
  /** Leaders left off the front page (editor only; visitors never receive it). */
  leadership?: {hidden: string[]};
}

export type UnitKey = "SAHP" | "AB" | "MU" | "GW" | "FAB" | "SIB" | "TB";
export const UNIT_ORDER: UnitKey[] = ["SAHP", "AB", "MU", "GW", "FAB", "SIB", "TB"];

export interface LeaderCard {
  full_name: string;
  faction_rank: string;
  avatar_url: string | null;
  division: string | null;
  bureau_manager: boolean;
  bureau_commander: boolean;
  /** 0 Bureau Manager, 1 Executive Staff, 2 Command Staff, 3 Bureau Commander only. */
  tier: 0 | 1 | 2 | 3;
}

export interface PublicSite {
  content: SiteContent;
  news: NewsItem[];
  stats: {
    members: number; divisions: Record<string, number>; cases_closed_year: number; actions_30d: number; duty_hours_month: number;
    since: number | null;
  } | null;
  leadership: LeaderCard[] | null;
  recruitment: {open: boolean};
  alert_level: string | null;
}

export interface ArticlePage {
  post: NewsPost;
  newer: NewsItem | null;
  older: NewsItem | null;
  related: NewsItem[];
}

export interface SiteEditor {
  content: SiteContent;
  updated: Record<string, {at: string; by: string | null}>;
  /** Everyone the front page's leadership section can show, with whether they are hidden. */
  leaders: {id: string; full_name: string; faction_rank: string; avatar_url: string | null; tier: LeaderCard["tier"]; hidden: boolean}[];
  posts: (NewsItem & {status: "draft" | "published"; updated_at: string; created_at: string; author: string | null})[];
}

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

// Visitors move between the front page, the news and back: one read per five minutes is enough.
const SITE_KEY = "frakhub.site";
let memory: {at: number; data: PublicSite} | null = null;

export const siteApi = {
  async site(force = false): Promise<PublicSite> {
    if (!force && memory && Date.now() - memory.at < 5 * 60_000) return memory.data;
    if (!force) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(SITE_KEY) ?? "null") as {at: number; data: PublicSite} | null;
        if (stored && Date.now() - stored.at < 5 * 60_000) {
          memory = stored;
          return stored.data;
        }
      } catch {
        // Unreadable copy: read again.
      }
    }
    const data = await rpc<PublicSite | null>("get_public_site");
    if (!data) throw new Error("A főoldal nem tölthető be.");
    memory = {at: Date.now(), data};
    try {
      sessionStorage.setItem(SITE_KEY, JSON.stringify(memory));
    } catch {
      // Storage full or disabled: the memory copy is enough.
    }
    return data;
  },
  /** The front page's data when it was read in the last five minutes (no request). */
  cached(): PublicSite | null {
    if (memory && Date.now() - memory.at < 5 * 60_000) return memory.data;
    try {
      const stored = JSON.parse(sessionStorage.getItem(SITE_KEY) ?? "null") as {at: number; data: PublicSite} | null;
      return stored && Date.now() - stored.at < 5 * 60_000 ? stored.data : null;
    } catch {
      return null;
    }
  },
  forget() {
    memory = null;
    try {
      sessionStorage.removeItem(SITE_KEY);
    } catch {
      // nothing stored
    }
  },
  news: (category: NewsCategory | null, before?: string | null) =>
    rpc<NewsItem[]>("get_public_news", {_category: category, _before: before ?? null, _limit: 12}),
  article: (slug: string) => rpc<ArticlePage | null>("get_news_post", {_slug: slug}),
  // The SIB's desk.
  editor: () => rpc<SiteEditor>("get_site_editor"),
  post: (id: string) => rpc<NewsPost & {author_display_raw: string | null}>("get_news_post_editor", {_id: id}),
  saveContent: (key: keyof SiteContent, value: unknown) => rpc<null>("save_site_content", {_key: key, _value: value}),
  savePost: (input: {id: string | null; title: string; excerpt: string | null; body: unknown[]; cover_url: string | null; category: NewsCategory;
    featured: boolean; author_display: string | null; slug: string | null}) =>
    rpc<{id: string; slug: string}>("save_news_post", {
      _id: input.id, _title: input.title, _excerpt: input.excerpt, _body: input.body, _cover_url: input.cover_url, _category: input.category,
      _featured: input.featured, _author_display: input.author_display, _slug: input.slug,
    }),
  publish: (id: string, publish: boolean, notify = false) => rpc<null>("publish_news_post", {_id: id, _publish: publish, _notify: notify}),
  remove: (id: string) => rpc<null>("delete_news_post", {_id: id}),
};

/** Edits the front page (private.can_edit_site): the SIB (qualification or unit leader), the Command and Executive Staff, the Bureau Manager. */
export const canEditSite = (profile: RankSubject | null | undefined) =>
  !!profile && profile.system_role !== "pending" && (!!profile.is_bureau_manager || isHighCommand(profile)
    || !!profile.qualifications?.includes("SIB") || !!profile.commanded_divisions?.includes("SIB"));

/** The article's date ("2026. október 7."). */
export const articleDate = (value: string | null) => (value ? formatMonthDate(value) : "");

/** Reading time of a BlockNote body (about 200 words a minute). */
export function readingMinutes(blocks: unknown[]): number {
  let words = 0;
  const visit = (node: unknown) => {
    if (typeof node === "string") words += node.split(/\s+/).filter(Boolean).length;
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      const value = node as {text?: unknown; content?: unknown; children?: unknown};
      if (typeof value.text === "string") visit(value.text);
      visit(value.content);
      visit(value.children);
    }
  };
  visit(blocks);
  return Math.max(1, Math.round(words / 200));
}
