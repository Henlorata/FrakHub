import {supabase} from "./supabaseClient";
import {createCachedLoader} from "./cache";
import type {PublicReportKind} from "./public-reports";

/**
 * The department's mail (the old Discord "public-mails" letters): threads between members and the
 * shared addresses (all@, internal.affairs.bureau@, command.staff@, …). Addresses are for display;
 * every recipient and every member of a recipient group reads and answers the thread
 * (supabase/migrations/…_internal_affairs_and_mail.sql).
 */

export type MailBox = "inbox" | "sent" | "all" | "iab";
export type MailGroupKey = "all" | "iab" | "command" | "sib" | "mcb" | "seb" | "tsb";
export type MailSenderKind = "self" | "external" | "iab" | "sib" | "command" | "public";

export interface MailThreadItem {
  id: string;
  subject: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
  broadcast: boolean;
  iab: boolean;
  /** Came from the public page (complaint, tip or question). */
  public_kind?: PublicReportKind | null;
  unread: boolean;
  last: {sender_name: string; sender_address: string; snippet: string} | null;
  to: string[];
}

export interface MailAuthor {
  id: string;
  full_name: string;
  faction_rank: string;
  badge_number: string;
  iab_title: string | null;
}

export interface MailMessage {
  id: string;
  sender_name: string;
  sender_address: string;
  sender_kind: MailSenderKind;
  to: string[];
  body: string;
  created_at: string;
  /** Hidden for letters written in an office's name or recorded from outside (except for the leadership). */
  author: MailAuthor | null;
  /** In a public report's thread: the visitor reads this message with the tracking code. */
  visible_to_reporter?: boolean;
}

export interface MailThread {
  thread: MailThreadItem;
  can_reply: boolean;
  /** How many of the readers opened it (its writers; the offices on letters to all@). */
  receipts?: {total: number; read: number} | null;
  /** A report from the public page: its reference, kind, status and the visitor's in-game contact. */
  public?: {ref: string; kind: PublicReportKind; status: "open" | "closed"; contact: string | null} | null;
  recipients: {address: string; user_id: string | null; group: MailGroupKey | null}[];
  messages: MailMessage[];
  /** The IAB's staff, listed under its letters. */
  iab_staff: {full_name: string; title: string}[] | null;
  /** Linked investigations (IAB members and the Bureau Manager). */
  cases: {id: string; case_number: string; title: string; status: string}[];
}

export interface MailDirectory {
  me: {address: string; name: string};
  can_broadcast: boolean;
  can_external: boolean;
  /** Offices the member may write in the name of. */
  offices: {key: MailSenderKind; address: string; label: string}[];
  groups: {key: MailGroupKey; address: string; label: string; allowed: boolean}[];
  members: {id: string; name: string; rank: string; badge: string; address: string}[];
}

export type MailRecipient = {kind: "user"; id: string} | {kind: "group"; key: MailGroupKey};

export const MAIL_BOXES: {key: MailBox; label: string}[] = [
  {key: "inbox", label: "Beérkezett"},
  {key: "sent", label: "Elküldött"},
  {key: "all", label: "Körlevelek"},
  {key: "iab", label: "IAB postafiók"},
];

const rpc = async <T>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

/** A search hit: the thread and the matching words of a message. */
export type MailSearchHit = MailThreadItem & {match: string | null};

export interface MailReceipts {
  total: number;
  read: number;
  last_message_at: string;
  readers: {user_id: string; full_name: string; faction_rank: string | null; badge_number: string | null; avatar_url: string | null;
    read_at: string | null}[];
}

/** A letter template: shared (the offices keep them) or the member's own. */
export interface MailTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
  shared: boolean;
  mine: boolean;
  can_edit: boolean;
  updated_at: string;
}

/** The tokens a template may carry, filled when it is used. */
export const MAIL_TOKENS: {token: string; label: string}[] = [
  {token: "{{címzett}}", label: "a címzett neve (egy címzettnél)"},
  {token: "{{címzett_rang}}", label: "a címzett rendfokozata"},
  {token: "{{címzett_jelvény}}", label: "a címzett jelvényszáma"},
  {token: "{{feladó}}", label: "a te neved (vagy az iroda neve)"},
  {token: "{{feladó_rang}}", label: "a rendfokozatod"},
  {token: "{{dátum}}", label: "a mai dátum"},
];

/** Replaces the known tokens; unknown ones and those without a value stay as they are. */
export function fillMailTokens(text: string, values: Partial<Record<"címzett" | "címzett_rang" | "címzett_jelvény" | "feladó" | "feladó_rang" | "dátum", string>>) {
  return text.replace(/\{\{\s*([\p{L}_]+)\s*\}\}/gu, (whole, key: string) => {
    const value = values[key.toLowerCase() as keyof typeof values];
    return value === undefined ? whole : value;
  });
}

// The address book changes rarely: once per 10 minutes is plenty.
const directory = createCachedLoader(() => rpc<MailDirectory>("get_mail_directory"), 10 * 60_000);

export const mailApi = {
  directory: () => directory.get(),
  mailbox: (box: MailBox, before?: string | null) => rpc<MailThreadItem[]>("get_mailbox", {_box: box, _before: before ?? null, _limit: 40}),
  thread: (id: string) => rpc<MailThread>("get_mail_thread", {_id: id}),
  send: (args: {
    subject?: string | null; body: string; to: MailRecipient[]; thread?: string | null;
    as?: MailSenderKind; externalName?: string | null; externalAddress?: string | null; toReporter?: boolean;
  }) => rpc<string>("send_mail", {
    _subject: args.subject ?? null, _body: args.body, _to: args.to, _thread: args.thread ?? null,
    _as: args.as ?? "self", _external_name: args.externalName ?? null, _external_address: args.externalAddress ?? null,
    _to_reporter: args.toReporter ?? false,
  }),
  setPublicStatus: (thread: string, status: "open" | "closed") => rpc<null>("set_public_report_status", {_thread: thread, _status: status}),
  search: (query: string) => rpc<MailSearchHit[]>("search_mail", {_query: query, _limit: 30}),
  receipts: (thread: string) => rpc<MailReceipts>("get_mail_receipts", {_thread: thread}),
  templates: () => rpc<MailTemplate[]>("get_mail_templates"),
  saveTemplate: (template: {id: string | null; title: string; subject: string; body: string; shared: boolean}) =>
    rpc<string>("save_mail_template", {_id: template.id, _title: template.title, _subject: template.subject, _body: template.body, _shared: template.shared}),
  deleteTemplate: (id: string) => rpc<null>("delete_mail_template", {_id: id}),
};

/** "RE: subject", without stacking prefixes. */
export const replySubject = (subject: string) => (/^re:/i.test(subject.trim()) ? subject.trim() : `RE: ${subject.trim()}`);
