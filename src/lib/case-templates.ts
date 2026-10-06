import {useCallback, useEffect, useState} from "react";
import {
  Camera, Car, ClipboardList, Clock, FileSearch, FileText, Fingerprint, Gavel, ListChecks, MapPin, MessagesSquare, Package, Quote, Scale,
  ScrollText, SeparatorHorizontal, ShieldAlert, Siren, Users, type LucideIcon,
} from "lucide-react";
import {createCachedLoader} from "./cache";
import {BUILTIN_TEMPLATES} from "./case-templates-builtin";
import {supabase} from "./supabaseClient";

/**
 * Case templates: the starting documents of a new case ("document") and the ready-made blocks
 * of the editor's "/" menu ("snippet"). Everyone who works with cases reads them (one cached
 * request per session); the MCB leadership edits them on /mcb/templates.
 */

export type TemplateKind = "document" | "snippet";
export type TemplateBlock = Record<string, unknown>;

export interface TemplateDraft {
  kind: TemplateKind;
  label: string;
  description: string | null;
  icon: string;
  aliases: string[];
  blocks: TemplateBlock[];
}

export interface CaseTemplate extends TemplateDraft {
  id: string;
  sort_order: number;
  updated_at: string | null;
}

/** The empty document of a new case (always offered, not stored). */
export const BLANK_TEMPLATE_ID = "blank";

export const TEMPLATE_ICONS: {key: string; label: string; icon: LucideIcon}[] = [
  {key: "file", label: "Dokumentum", icon: FileText},
  {key: "search", label: "Nyomozás", icon: FileSearch},
  {key: "clipboard", label: "Jegyzőkönyv", icon: ClipboardList},
  {key: "messages", label: "Kihallgatás", icon: MessagesSquare},
  {key: "quote", label: "Vallomás", icon: Quote},
  {key: "scroll", label: "Irat", icon: ScrollText},
  {key: "list", label: "Teendők", icon: ListChecks},
  {key: "clock", label: "Idővonal", icon: Clock},
  {key: "package", label: "Lefoglalás", icon: Package},
  {key: "camera", label: "Fénykép", icon: Camera},
  {key: "fingerprint", label: "Nyomok", icon: Fingerprint},
  {key: "map", label: "Helyszín", icon: MapPin},
  {key: "car", label: "Jármű", icon: Car},
  {key: "users", label: "Személyek", icon: Users},
  {key: "siren", label: "Körözés", icon: Siren},
  {key: "shield", label: "Gyanúsított", icon: ShieldAlert},
  {key: "gavel", label: "Parancs", icon: Gavel},
  {key: "scale", label: "Vádemelés", icon: Scale},
  {key: "divider", label: "Elválasztó", icon: SeparatorHorizontal},
];

export const templateIcon = (key: string | null | undefined): LucideIcon =>
  TEMPLATE_ICONS.find((item) => item.key === key)?.icon ?? FileText;

export const TEMPLATE_LIMITS = {label: 60, description: 200, aliases: 12, aliasChars: 300, bytes: 200_000};

const COLUMNS = "id, kind, label, description, icon, aliases, blocks, sort_order, updated_at";

const byOrder = (a: CaseTemplate, b: CaseTemplate) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "hu");

/** The starter templates as list rows (when the list cannot be loaded, and in practice mode). */
export const builtinTemplates = (): CaseTemplate[] => {
  const counters: Record<TemplateKind, number> = {document: 0, snippet: 0};
  return BUILTIN_TEMPLATES.map((template, index) => ({
    ...structuredClone(template), id: `builtin-${index + 1}`, sort_order: (counters[template.kind] += 1) * 10, updated_at: null,
  }));
};

const list = createCachedLoader(async () => {
  const {data, error} = await supabase.from("case_templates").select(COLUMNS).order("kind").order("sort_order");
  if (error) throw error;
  return ((data ?? []) as CaseTemplate[]).map((row) => ({...row, aliases: row.aliases ?? [], blocks: Array.isArray(row.blocks) ? row.blocks : []}))
    .sort(byOrder);
}, 10 * 60_000);

/** The stored templates; the starter set (marked `fallback`) when they cannot be loaded. */
export async function loadCaseTemplates(force = false): Promise<{templates: CaseTemplate[]; fallback: boolean}> {
  try {
    return {templates: await list.get(force), fallback: false};
  } catch {
    return {templates: builtinTemplates(), fallback: true};
  }
}

/** Templates of one kind, loaded on first use (`enabled: false` waits). */
export function useCaseTemplates(kind: TemplateKind, {enabled = true}: {enabled?: boolean} = {}) {
  const [state, setState] = useState<{templates: CaseTemplate[] | null; fallback: boolean}>({templates: null, fallback: false});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadCaseTemplates(version > 0).then((result) => {
      if (active) setState({templates: result.templates.filter((template) => template.kind === kind), fallback: result.fallback});
    });
    return () => {
      active = false;
    };
  }, [enabled, kind, version]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {...state, reload};
}

/** What is wrong with a template before saving (Hungarian), or null. */
export function templateProblem(draft: TemplateDraft): string | null {
  const label = draft.label.trim();
  if (label.length < 2) return "Adj nevet a sablonnak (legalább 2 karakter).";
  if (label.length > TEMPLATE_LIMITS.label) return `A név legfeljebb ${TEMPLATE_LIMITS.label} karakter lehet.`;
  if ((draft.description ?? "").trim().length > TEMPLATE_LIMITS.description) return `A leírás legfeljebb ${TEMPLATE_LIMITS.description} karakter lehet.`;
  if (draft.aliases.length > TEMPLATE_LIMITS.aliases || draft.aliases.join(" ").length > TEMPLATE_LIMITS.aliasChars) {
    return `Legfeljebb ${TEMPLATE_LIMITS.aliases} keresőszó adható meg.`;
  }
  const size = new TextEncoder().encode(JSON.stringify(draft.blocks)).length;
  if (size > TEMPLATE_LIMITS.bytes) return "A sablon túl hosszú (legfeljebb kb. 200 kB).";
  if (JSON.stringify(draft.blocks).includes("data:image")) return "Kép nem lehet a sablonban.";
  return null;
}

/** "lefoglalt, tárgyak" -> ["lefoglalt", "tárgyak"] (lower case, no duplicates). */
export const parseAliases = (value: string) =>
  [...new Set(value.split(/[,;\n]/).map((item) => item.trim().toLowerCase()).filter(Boolean).map((item) => item.slice(0, 30)))];

const clean = (draft: TemplateDraft) => ({
  label: draft.label.trim(),
  description: draft.description?.trim() || null,
  icon: draft.icon,
  aliases: draft.kind === "snippet" ? draft.aliases : [],
  blocks: draft.blocks,
});

export const caseTemplatesApi = {
  create: async (draft: TemplateDraft, sortOrder: number): Promise<CaseTemplate> => {
    const {data, error} = await supabase.from("case_templates").insert({...clean(draft), kind: draft.kind, sort_order: sortOrder})
      .select(COLUMNS).single();
    list.invalidate();
    if (error) throw error;
    return data as CaseTemplate;
  },
  /** Several at once (restoring the starter templates). */
  createMany: async (drafts: (TemplateDraft & {sort_order: number})[]) => {
    const {error} = await supabase.from("case_templates")
      .insert(drafts.map((draft) => ({...clean(draft), kind: draft.kind, sort_order: draft.sort_order})));
    list.invalidate();
    if (error) throw error;
  },
  update: async (id: string, draft: TemplateDraft): Promise<CaseTemplate> => {
    const {data, error} = await supabase.from("case_templates").update(clean(draft)).eq("id", id).select(COLUMNS).single();
    list.invalidate();
    if (error) throw error;
    return data as CaseTemplate;
  },
  remove: async (id: string) => {
    const {error} = await supabase.from("case_templates").delete().eq("id", id);
    list.invalidate();
    if (error) throw error;
  },
  reorder: async (ids: string[]) => {
    const {error} = await supabase.rpc("reorder_case_templates", {_ids: ids});
    list.invalidate();
    if (error) throw error;
  },
};
