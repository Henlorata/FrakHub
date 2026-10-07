import {MessageCircleQuestion, Scale, Siren, type LucideIcon} from "lucide-react";
import {supabase} from "./supabaseClient";

/**
 * Reports from the public page: a complaint to the Internal Affairs Bureau, a tip to the Major
 * Crimes Bureau or a question to the Command Staff. No e-mail anywhere: the report becomes a
 * thread in the intranet's mail, the visitor gets a tracking code and reads the answers the staff
 * mark for them on the public page (supabase/migrations/…_documents_reports_graph.sql).
 */

export type PublicReportKind = "complaint" | "tip" | "question";

export const PUBLIC_REPORT_KINDS: Record<PublicReportKind, {
  label: string; office: string; address: string; hint: string; icon: LucideIcon; tone: string; accent: string;
}> = {
  complaint: {label: "Panasz", office: "Internal Affairs Bureau", address: "internal.affairs.bureau@sfsd.org",
    hint: "Egy deputy viselkedése vagy intézkedése ellen. A belső vizsgálatokat végző iroda kapja.",
    icon: Scale, tone: "bg-fuchsia-500/10 text-fuchsia-200 ring-fuchsia-400/30", accent: "#e879f9"},
  tip: {label: "Bejelentés", office: "Major Crimes Bureau", address: "mcb@sfsd.org",
    hint: "Bűncselekményről, körözött személyről vagy gyanús tevékenységről. Névtelenül is küldheted.",
    icon: Siren, tone: "bg-sky-500/10 text-sky-200 ring-sky-400/30", accent: "#38bdf8"},
  question: {label: "Kérdés", office: "SFSD Command Staff", address: "command.staff@sfsd.org",
    hint: "Általános kérdés a vezetőséghez: jelentkezés, együttműködés, egyéb ügyek.",
    icon: MessageCircleQuestion, tone: "bg-amber-500/10 text-amber-100 ring-amber-400/30", accent: "#f59e0b"},
};

export interface PublicReportMessage {
  id: string;
  /** Written by the visitor. */
  mine: boolean;
  from: string;
  /** Written in the name of an office (IAB, SIB, Command Staff). */
  office: boolean;
  body: string;
  created_at: string;
}

export interface PublicReport {
  ref: string;
  kind: PublicReportKind;
  status: "open" | "closed";
  subject: string;
  created_at: string;
  messages: PublicReportMessage[];
}

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const publicReportsApi = {
  submit: (input: {kind: PublicReportKind; subject: string; body: string; name: string; contact: string; trap: string; elapsed: number}) =>
    rpc<{code: string; ref: string}>("submit_public_report", {
      _kind: input.kind, _subject: input.subject, _body: input.body, _name: input.name || null, _contact: input.contact || null,
      _trap: input.trap || null, _elapsed: input.elapsed,
    }),
  get: (code: string) => rpc<PublicReport | null>("get_public_report", {_code: code}),
  reply: (code: string, body: string, trap: string) => rpc<null>("reply_public_report", {_code: code, _body: body, _trap: trap || null}),
};

/** "sf 7k3q 9xz2…" → "SF-7K3Q-9XZ2-…" (spaces, missing dashes and lower case forgiven). */
export function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const body = raw.startsWith("SF") ? raw.slice(2) : raw;
  const groups = body.match(/.{1,4}/g) ?? [];
  return ["SF", ...groups.slice(0, 4)].join("-");
}

export const isCompleteCode = (code: string) => /^SF-[2-9A-HJKMNP-Z]{4}(-[2-9A-HJKMNP-Z]{4}){3}$/.test(code);

// --- The codes kept on this device (nothing is sent anywhere) ------------------------------------

export interface SavedReport {
  code: string;
  subject: string;
  kind: PublicReportKind;
  at: string;
}

const KEY = "frakhub.public-reports";

export function savedReports(): SavedReport[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedReport[];
    return Array.isArray(list) ? list.filter((item) => item && isCompleteCode(item.code)) : [];
  } catch {
    return [];
  }
}

export function rememberReport(report: SavedReport) {
  try {
    const list = [report, ...savedReports().filter((item) => item.code !== report.code)].slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage disabled: the visitor keeps the code by hand.
  }
}

export function forgetReport(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedReports().filter((item) => item.code !== code)));
  } catch {
    // nothing kept
  }
}
