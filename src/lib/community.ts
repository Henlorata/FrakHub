import {supabase} from "@/lib/supabaseClient";

/**
 * Policies with acknowledgement, polls, the suggestion board and the anonymous feedback channel.
 * Everything goes through RPCs (the tables are not readable directly), which also enforce who may
 * do what; the types mirror the JSON they return.
 */

export type PolicyCategory = "general" | "conduct" | "field" | "vehicles" | "radio" | "hr" | "mcb" | "academy" | "other";
export type PolicyStatus = "draft" | "published" | "archived";

export const POLICY_CATEGORIES: Record<PolicyCategory, string> = {
  general: "Általános", conduct: "Magatartás", field: "Intézkedés", vehicles: "Járművek", radio: "Rádió", hr: "Személyügy",
  mcb: "Nyomozás", academy: "Képzés", other: "Egyéb",
};

/** BlockNote blocks (text only: no pictures). */
export type DocumentBlocks = unknown[];

export interface PolicySummary {
  id: string;
  title: string;
  category: PolicyCategory;
  summary: string | null;
  version: number;
  requires_ack: boolean;
  status: PolicyStatus;
  published_at: string | null;
  updated_at: string;
  my_ack_version: number | null;
  /** Editors: how many acknowledged the current version. */
  acknowledged: number | null;
  /** Editors: the working copy differs from the published version. */
  draft_changes: boolean | null;
}

export interface PolicyList {
  can_edit: boolean;
  members: number;
  policies: PolicySummary[];
}

export interface PolicyDetail {
  id: string;
  category: PolicyCategory;
  status: PolicyStatus;
  version: number;
  sort_order: number;
  shown_version: number | null;
  title: string;
  summary: string | null;
  body: DocumentBlocks;
  requires_ack: boolean;
  published_at: string | null;
  change_note: string | null;
  published_by_name: string | null;
  my_ack_version: number | null;
  versions: {version: number; published_at: string; change_note: string | null; published_by_name: string | null}[];
  draft: {title: string; summary: string | null; body: DocumentBlocks; requires_ack: boolean; category: PolicyCategory; updated_at: string;
    updated_by_name: string | null} | null;
  missing: {user_id: string; full_name: string; badge_number: string; faction_rank: string; avatar_url: string | null}[] | null;
}

export interface PolicyDraft {
  title: string;
  category: PolicyCategory;
  summary: string | null;
  body: DocumentBlocks;
  requires_ack: boolean;
  sort_order?: number;
}

export type PollResults = "live" | "after_vote" | "after_close";

export interface PollOption {
  id: string;
  label: string;
  /** Null while the results are hidden. */
  votes: number | null;
  /** Null in anonymous polls. */
  mine: boolean | null;
  voters: {full_name: string; avatar_url: string | null}[] | null;
}

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  audience: string;
  anonymous: boolean;
  max_choices: number;
  results: PollResults;
  closes_at: string;
  closed_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  open: boolean;
  voted: boolean;
  can_manage: boolean;
  voters: number;
  audience_size: number;
  results_visible: boolean;
  options: PollOption[];
}

export interface PollDraft {
  title: string;
  description?: string | null;
  audience: string;
  anonymous: boolean;
  max_choices: number;
  results: PollResults;
  closes_at: string;
  options: string[];
}

export type SuggestionStatus = "new" | "reviewing" | "planned" | "done" | "declined";
export type SuggestionCategory = "general" | "website" | "training" | "events" | "equipment" | "other";

export const SUGGESTION_STATUS: Record<SuggestionStatus, {label: string; tone: string}> = {
  new: {label: "Új", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"},
  reviewing: {label: "Vizsgáljuk", tone: "bg-violet-500/10 text-violet-200 ring-violet-500/25"},
  planned: {label: "Tervben", tone: "bg-amber-500/15 text-amber-100 ring-amber-500/30"},
  done: {label: "Megvalósult", tone: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30"},
  declined: {label: "Elvetve", tone: "bg-white/5 text-slate-400 ring-white/10"},
};

export const SUGGESTION_CATEGORIES: Record<SuggestionCategory, string> = {
  general: "Általános", website: "Weboldal", training: "Képzés", events: "Események", equipment: "Felszerelés", other: "Egyéb",
};

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  category: SuggestionCategory;
  status: SuggestionStatus;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  author_id: string | null;
  author: {full_name: string; faction_rank: string; avatar_url: string | null} | null;
  responded_by_name: string | null;
  votes: number;
  voted: boolean;
}

export type FeedbackRecipient = "command" | "manager";
export type FeedbackCategory = "conduct" | "leadership" | "harassment" | "idea" | "other";
export type FeedbackStatus = "new" | "read" | "answered" | "closed";

export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, string> = {
  conduct: "Magatartás", leadership: "Vezetés", harassment: "Zaklatás", idea: "Javaslat", other: "Egyéb",
};
export const FEEDBACK_RECIPIENTS: Record<FeedbackRecipient, {label: string; hint: string}> = {
  command: {label: "Parancsnokság", hint: "A parancsnoki állomány és az irodavezető olvassa."},
  manager: {label: "Csak az irodavezető", hint: "Ha a parancsnokság valamelyik tagjáról szól."},
};
export const FEEDBACK_STATUS: Record<FeedbackStatus, {label: string; tone: string}> = {
  new: {label: "Új", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"},
  read: {label: "Olvasva", tone: "bg-white/5 text-slate-300 ring-white/10"},
  answered: {label: "Megválaszolva", tone: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25"},
  closed: {label: "Lezárva", tone: "bg-white/5 text-slate-500 ring-white/10"},
};

export interface FeedbackMessage {
  id: string;
  from_reporter: boolean;
  body: string;
  created_at: string;
  /** The leader who answered (never the reporter). */
  author_name: string | null;
}

export interface FeedbackReport {
  id: string;
  recipient: FeedbackRecipient;
  category: FeedbackCategory;
  body: string;
  status: FeedbackStatus;
  /** Kept to the hour. */
  created_at: string;
  updated_at: string;
  messages: FeedbackMessage[];
  /** Leaders: how many reports the same (unknown) reporter sent. */
  reporter_reports: number | null;
  blocked_until: string | null;
}

export interface MyFeedback {
  blocked_until: string | null;
  sent_this_week: number;
  reports: FeedbackReport[];
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const communityApi = {
  policies: () => rpc<PolicyList>("get_policies"),
  policy: (id: string, version?: number | null) => rpc<PolicyDetail>("get_policy", {_id: id, _version: version ?? null}),
  savePolicy: (id: string | null, policy: PolicyDraft) => rpc<{id: string; version: number; updated_at: string}>("save_policy", {_id: id, _policy: policy}),
  publishPolicy: (id: string, note?: string | null) => rpc<{id: string; version: number; published_at: string}>("publish_policy",
    {_id: id, _change_note: note ?? null}),
  archivePolicy: (id: string, archived: boolean) => rpc<void>("archive_policy", {_id: id, _archived: archived}),
  deletePolicy: (id: string) => rpc<void>("delete_policy", {_id: id}),
  acknowledge: (id: string) => rpc<{version: number; acknowledged_at: string}>("acknowledge_policy", {_id: id}),

  polls: async () => (await rpc<Poll[] | null>("get_polls")) ?? [],
  createPoll: (poll: PollDraft) => rpc<{id: string}>("create_poll", {_poll: poll}),
  vote: (pollId: string, optionIds: string[]) => rpc<void>("cast_vote", {_poll_id: pollId, _option_ids: optionIds}),
  closePoll: (pollId: string) => rpc<void>("close_poll", {_poll_id: pollId}),
  deletePoll: (pollId: string) => rpc<void>("delete_poll", {_poll_id: pollId}),

  suggestions: () => rpc<{can_respond: boolean; suggestions: Suggestion[]}>("get_suggestions"),
  suggest: (title: string, body: string, category: SuggestionCategory) => rpc<{id: string}>("create_suggestion",
    {_title: title, _body: body, _category: category}),
  toggleVote: (id: string) => rpc<{votes: number; voted: boolean}>("toggle_suggestion_vote", {_id: id}),
  respond: (id: string, status: SuggestionStatus, response: string | null) =>
    rpc<{status: SuggestionStatus; response: string | null; responded_at: string}>("respond_suggestion", {_id: id, _status: status, _response: response}),
  deleteSuggestion: (id: string) => rpc<void>("delete_suggestion", {_id: id}),

  myFeedback: () => rpc<MyFeedback>("get_my_feedback"),
  submitFeedback: (recipient: FeedbackRecipient, category: FeedbackCategory, body: string) =>
    rpc<FeedbackReport>("submit_feedback", {_recipient: recipient, _category: category, _body: body}),
  inbox: async () => (await rpc<FeedbackReport[] | null>("get_feedback_inbox")) ?? [],
  reply: (reportId: string, body: string) => rpc<FeedbackReport>("reply_feedback", {_report_id: reportId, _body: body}),
  setFeedbackStatus: (reportId: string, status: FeedbackStatus) => rpc<void>("set_feedback_status", {_report_id: reportId, _status: status}),
  blockReporter: (reportId: string, days: number, reason: string | null) =>
    rpc<void>("block_feedback_reporter", {_report_id: reportId, _days: days, _reason: reason}),
};

// --- Plain text and a line diff of two document versions ------------------------------------

type InlineNode = {type?: string; text?: string; content?: InlineNode[] | string};
type BlockNode = {type?: string; props?: {level?: number}; content?: unknown; children?: BlockNode[]};

function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    // Tables: {type: "tableContent", rows: [{cells: [...]}]}.
    const rows = (content as {rows?: {cells?: unknown[]}[]} | null)?.rows;
    return rows ? rows.map((row) => (row.cells ?? []).map((cell) => inlineText((cell as {content?: unknown})?.content ?? cell)).join(" | ")).join("\n") : "";
  }
  return (content as InlineNode[]).map((node) => (typeof node === "string" ? node : node.text ?? inlineText(node.content))).join("");
}

/** The document as lines ("# Title", "• item", "1. step"), for the version comparison. */
export function documentLines(blocks: unknown, depth = 0): string[] {
  const lines: string[] = [];
  let number = 0;
  for (const block of (Array.isArray(blocks) ? blocks : []) as BlockNode[]) {
    const text = inlineText(block.content).trim();
    const indent = "  ".repeat(depth);
    number = block.type === "numberedListItem" ? number + 1 : 0;
    const prefix = block.type === "heading" ? `${"#".repeat(block.props?.level ?? 1)} ` : block.type === "bulletListItem" ? "• "
      : block.type === "numberedListItem" ? `${number}. ` : block.type === "checkListItem" ? "☐ " : block.type === "quote" ? "„" : "";
    if (text) lines.push(...text.split("\n").map((line, index) => `${indent}${index === 0 ? prefix : ""}${line}`));
    if (block.children?.length) lines.push(...documentLines(block.children, depth + 1));
  }
  return lines;
}

export type DiffLine = {kind: "same" | "added" | "removed"; text: string};

/** Line diff by the longest common subsequence (documents are short). */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const table = Array.from({length: n + 1}, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({kind: "same", text: before[i]});
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({kind: "removed", text: before[i]});
      i += 1;
    } else {
      out.push({kind: "added", text: after[j]});
      j += 1;
    }
  }
  while (i < n) out.push({kind: "removed", text: before[i++]});
  while (j < m) out.push({kind: "added", text: after[j++]});
  return out;
}
