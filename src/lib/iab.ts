import {CheckCircle2, CircleSlash, FileWarning, HelpCircle, Scale, Undo2, type LucideIcon} from "lucide-react";
import {supabase} from "./supabaseClient";
import type {Profile} from "@/types/supabase";

/**
 * Internal Affairs Bureau: the bureau's staff (its own titles on profiles.iab_title), the
 * investigations with the members they concern, memos, interviews and notes, linked letters and
 * the IAB's closure. Readers: IAB members and the Bureau Manager; never the subject.
 */

export type IabTitle = "sheriff" | "assistant_sheriff" | "chief_deputy" | "notary" | "agent";
export type IabRole = "subject" | "complainant" | "witness";
export type IabEntryKind = "memo" | "interview" | "note";
export type IabOutcome = "sustained" | "not_sustained" | "exonerated" | "unfounded" | "policy_failure" | "withdrawn";
export type IabPriority = "low" | "normal" | "high";

/** The bureau's titles stay in English, as the faction uses them. */
export const IAB_TITLES: Record<IabTitle, string> = {
  sheriff: "Sheriff",
  assistant_sheriff: "Assistant Sheriff",
  chief_deputy: "Chief Deputy",
  notary: "Notary",
  agent: "Agent",
};
export const IAB_TITLE_ORDER: IabTitle[] = ["sheriff", "assistant_sheriff", "chief_deputy", "notary", "agent"];

export const IAB_ROLES: Record<IabRole, {label: string; chip: string}> = {
  subject: {label: "Vizsgált", chip: "bg-red-500/10 text-red-300 ring-red-500/30"},
  complainant: {label: "Bejelentő", chip: "bg-amber-500/10 text-amber-200 ring-amber-500/30"},
  witness: {label: "Tanú", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
};

export const IAB_ENTRY_KINDS: Record<IabEntryKind, {label: string; hint: string; printed: boolean}> = {
  memo: {label: "Hivatalos feljegyzés", hint: "Levél, tájékoztatás, intézkedés: a nyomtatott iraton aláírással.", printed: true},
  interview: {label: "Meghallgatás", hint: "Ki, mikor, mit mondott: jegyzőkönyv.", printed: true},
  note: {label: "Belső megjegyzés", hint: "Csak az IAB-nak; nyomtatáskor kérésre kerül az iratra.", printed: false},
};

export const IAB_OUTCOMES: Record<IabOutcome, {label: string; text: string; icon: LucideIcon; tone: string}> = {
  sustained: {label: "Megalapozott", text: "A panasz igazolódott, kötelezettségszegés történt.", icon: FileWarning, tone: "text-red-300 bg-red-500/10 ring-red-500/30"},
  not_sustained: {label: "Nem bizonyított", text: "A bizonyítékok sem igazolni, sem cáfolni nem tudták.", icon: HelpCircle, tone: "text-amber-200 bg-amber-500/10 ring-amber-500/30"},
  exonerated: {label: "Felmentve", text: "Az eset megtörtént, de szabályszerű volt.", icon: CheckCircle2, tone: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30"},
  unfounded: {label: "Alaptalan", text: "A bejelentett eset nem történt meg.", icon: CircleSlash, tone: "text-sky-300 bg-sky-500/10 ring-sky-500/30"},
  policy_failure: {label: "Szabályzati hiányosság", text: "A tag a szabályok szerint járt el, a szabályt kell javítani.", icon: Scale, tone: "text-violet-300 bg-violet-500/10 ring-violet-500/30"},
  withdrawn: {label: "Visszavonva", text: "A bejelentést visszavonták vagy okafogyottá vált.", icon: Undo2, tone: "text-slate-300 bg-white/5 ring-white/10"},
};

export const IAB_PRIORITY: Record<IabPriority, {label: string; chip: string}> = {
  low: {label: "Alacsony", chip: "bg-white/5 text-slate-300 ring-white/10"},
  normal: {label: "Normál", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30"},
  high: {label: "Sürgős", chip: "bg-red-500/10 text-red-300 ring-red-500/30"},
};

export interface IabPerson {
  id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string;
  avatar_url: string | null;
  iab_title: IabTitle | null;
}

export interface IabCaseListItem {
  id: string;
  case_number: string;
  title: string;
  summary: string | null;
  status: "open" | "closed";
  priority: IabPriority;
  outcome: IabOutcome | null;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  lead: IabPerson | null;
  people: {user_id: string; full_name: string; role: IabRole}[];
  entries: number;
  mail: number;
}

export interface IabOverview {
  viewer: {iab_title: IabTitle | null; is_lead: boolean; is_member: boolean};
  members: IabPerson[];
  cases: IabCaseListItem[];
  stats: {open: number; closed_90d: number; inbox_unread: number};
}

export interface IabEntry {
  id: string;
  kind: IabEntryKind;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: IabPerson | null;
  can_edit: boolean;
}

export interface IabCaseDetail {
  case: {
    id: string; case_number: string; title: string; summary: string | null; status: "open" | "closed"; priority: IabPriority;
    outcome: IabOutcome | null; closure: string | null; opened_at: string; updated_at: string; closed_at: string | null;
    lead: IabPerson | null; opened_by: IabPerson | null; closed_by: IabPerson | null;
  };
  people: {user_id: string; role: IabRole; note: string | null; added_at: string; person: IabPerson}[];
  entries: IabEntry[];
  mail: {thread_id: string; subject: string; last_message_at: string; message_count: number}[];
  can_edit: boolean;
  can_close: boolean;
}

/** Sees the investigations (the sidebar entry): IAB members and the Bureau Manager. */
export const canSeeIab = (profile: Pick<Profile, "iab_title" | "is_bureau_manager"> | null | undefined) =>
  !!profile && (!!profile.iab_title || !!profile.is_bureau_manager);

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const iabApi = {
  overview: () => rpc<IabOverview>("get_iab_overview"),
  detail: (id: string) => rpc<IabCaseDetail>("get_iab_case", {_id: id}),
  saveCase: (input: {id: string | null; title: string; summary: string | null; priority: IabPriority; lead: string | null}) =>
    rpc<string>("save_iab_case", {_id: input.id, _title: input.title, _summary: input.summary, _priority: input.priority, _lead: input.lead}),
  setPerson: (caseId: string, userId: string, role: IabRole | null, note: string | null = null) =>
    rpc<null>("set_iab_case_person", {_case: caseId, _user: userId, _role: role, _note: note}),
  saveEntry: (caseId: string, input: {id: string | null; kind: IabEntryKind; title: string | null; body: string}) =>
    rpc<string>("save_iab_entry", {_case: caseId, _id: input.id, _kind: input.kind, _title: input.title, _body: input.body}),
  deleteEntry: (id: string) => rpc<null>("delete_iab_entry", {_id: id}),
  close: (caseId: string, outcome: IabOutcome, closure: string) => rpc<null>("close_iab_case", {_case: caseId, _outcome: outcome, _closure: closure}),
  reopen: (caseId: string) => rpc<null>("reopen_iab_case", {_case: caseId}),
  linkMail: (caseId: string, threadId: string, link = true) => rpc<null>("link_iab_mail", {_case: caseId, _thread: threadId, _link: link}),
  setTitle: (userId: string, title: IabTitle | null) => rpc<null>("set_iab_title", {_user_id: userId, _title: title}),
};
