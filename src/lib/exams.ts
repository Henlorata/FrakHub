import type {Tone} from "@/components/layout/PageHeader";
import {env} from "@/lib/env";
import {supabase} from "@/lib/supabaseClient";
import type {
  AttemptPayload, AttemptStateReply, ExamBlockCode, ExamEditorData, ExamHubData, ExamIntro, ExamPage, ExamSheet, ExamStats,
  ExamType, FinishReason, IntegrityEvent, IntegritySummary, QuestionType, SubmissionStatus,
} from "@/types/exams";

// --- Server calls ------------------------------------------------------------------

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

/** An answer while the exam runs (text questions: text; choice questions: option ids). */
export interface DraftAnswer {
  text?: string;
  options?: string[];
  /** Characters pasted into the answer so far. */
  pasted?: number;
}

export interface GuestAttempt {
  attemptId: string;
  secret: string;
}

export interface ExamSavePayload {
  exam: Record<string, unknown>;
  pages: ExamPage[];
  questions: Record<string, unknown>[];
}

export const examApi = {
  hub: () => rpc<ExamHubData>("get_exam_hub"),
  intro: (examId: string, guest: GuestAttempt | null) =>
    rpc<ExamIntro | {login_required: true} | null>("get_exam_intro", {
      _exam_id: examId, _attempt_id: guest?.attemptId ?? null, _secret: guest?.secret ?? null,
    }),
  start: (examId: string, applicantName: string | null, guest: GuestAttempt | null) =>
    rpc<AttemptPayload | AttemptStateReply>("start_exam", {
      _exam_id: examId, _applicant_name: applicantName, _attempt_id: guest?.attemptId ?? null, _secret: guest?.secret ?? null,
    }),
  save: (attemptId: string, answers: Record<string, DraftAnswer>, events: IntegrityEvent[], secret: string | null) =>
    rpc<AttemptStateReply>("save_exam_progress", {_attempt_id: attemptId, _answers: answers, _events: events, _secret: secret}),
  finish: (attemptId: string, answers: Record<string, DraftAnswer>, events: IntegrityEvent[], secret: string | null) =>
    rpc<AttemptStateReply>("finish_exam", {_attempt_id: attemptId, _answers: answers, _events: events, _secret: secret}),
  sheet: (submissionId: string) => rpc<ExamSheet>("get_exam_sheet", {_submission_id: submissionId}),
  grade: (submissionId: string, scores: Record<string, {points: number; comment: string}>, status: "passed" | "failed",
          notes: string, feedbackVisible: boolean, retryHours: number) =>
    rpc<{status: SubmissionStatus; total_score: number; max_score: number}>("grade_exam_submission", {
      _submission_id: submissionId, _scores: scores, _status: status, _notes: notes,
      _feedback_visible: feedbackVisible, _retry_hours: retryHours,
    }),
  editor: (examId: string) => rpc<ExamEditorData>("get_exam_editor", {_exam_id: examId}),
  saveExam: (examId: string | null, payload: ExamSavePayload) =>
    rpc<string>("save_exam", {_exam_id: examId, _exam: payload.exam, _pages: payload.pages, _questions: payload.questions}),
  stats: (examId: string) => rpc<ExamStats>("get_exam_stats", {_exam_id: examId}),
};

/**
 * Last-moment save when the page is closed: a keepalive request outlives the page, which
 * a normal supabase-js call does not.
 */
export function saveProgressOnExit(accessToken: string | null, attemptId: string, answers: Record<string, DraftAnswer>,
                                   events: IntegrityEvent[], secret: string | null) {
  if (!env.supabaseUrl || (Object.keys(answers).length === 0 && events.length === 0)) return;
  void fetch(`${env.supabaseUrl}/rest/v1/rpc/save_exam_progress`, {
    method: "POST",
    keepalive: true,
    headers: {"Content-Type": "application/json", apikey: env.supabaseKey, Authorization: `Bearer ${accessToken ?? env.supabaseKey}`},
    body: JSON.stringify({_attempt_id: attemptId, _answers: answers, _events: events, _secret: secret}),
  }).catch(() => undefined);
}

// --- Browser storage -----------------------------------------------------------------

const readJson = <T, >(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled: the server copy still exists.
  }
};

/** A guest's attempt lives in this browser only (the secret proves it is theirs). */
const guestKey = (examId: string) => `frakhub.exam.guest.${examId}`;
export const loadGuestAttempt = (examId: string) => readJson<GuestAttempt>(guestKey(examId));
export const storeGuestAttempt = (examId: string, attempt: GuestAttempt) => writeJson(guestKey(examId), attempt);
export const forgetGuestAttempt = (examId: string) => localStorage.removeItem(guestKey(examId));

/** Unsaved answers survive a reload or a lost connection. */
export interface AnswerBackup {
  answers: Record<string, DraftAnswer>;
  dirty: string[];
}
const backupKey = (attemptId: string) => `frakhub.exam.backup.${attemptId}`;
export const loadAnswerBackup = (attemptId: string) => readJson<AnswerBackup>(backupKey(attemptId));
export const storeAnswerBackup = (attemptId: string, backup: AnswerBackup) => writeJson(backupKey(attemptId), backup);
export const forgetAnswerBackup = (attemptId: string) => localStorage.removeItem(backupKey(attemptId));

/** The open attempt, for the "continue your exam" chip on other pages. */
export interface ActiveAttemptHint {
  examId: string;
  title: string;
  deadline: string;
  /** User id, or "guest". */
  owner: string;
}
const HINT_KEY = "frakhub.exam.active";
export const ACTIVE_ATTEMPT_EVENT = "frakhub:exam-attempt";

export function readActiveAttempt(): ActiveAttemptHint | null {
  const hint = readJson<ActiveAttemptHint>(HINT_KEY);
  if (!hint || Date.parse(hint.deadline) < Date.now()) return null;
  return hint;
}
export function setActiveAttempt(hint: ActiveAttemptHint) {
  writeJson(HINT_KEY, hint);
  window.dispatchEvent(new Event(ACTIVE_ATTEMPT_EVENT));
}
export function clearActiveAttempt(examId?: string) {
  const hint = readJson<ActiveAttemptHint>(HINT_KEY);
  if (!hint || !examId || hint.examId === examId) {
    localStorage.removeItem(HINT_KEY);
    window.dispatchEvent(new Event(ACTIVE_ATTEMPT_EVENT));
  }
}

// --- Labels and formatting --------------------------------------------------------------

export const STATUS_META: Record<SubmissionStatus | "removed", {label: string; tone: Tone}> = {
  in_progress: {label: "Folyamatban", tone: "blue"},
  pending: {label: "Javításra vár", tone: "gold"},
  grading: {label: "Javítás alatt", tone: "gold"},
  passed: {label: "Sikeres", tone: "emerald"},
  failed: {label: "Sikertelen", tone: "red"},
  removed: {label: "Lezárva", tone: "slate"},
};

export const FINISH_LABELS: Record<FinishReason, string> = {
  submitted: "A vizsgázó adta le",
  time_up: "Az idő végén automatikusan leadva",
  expired: "Lejárt; a rendszer zárta le (a vizsgázó nem volt jelen)",
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  trainee: "Felvételi vizsga",
  deputy_i: "Deputy I. vizsga",
  division_exam: "Osztályvizsga",
  other: "Egyéb vizsga",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Kifejtős",
  single_choice: "Egy helyes válasz",
  multiple_choice: "Több helyes válasz",
};

/** Blocks that mean the exam is not for this member at all: the card is not shown. */
export const HIDDEN_BLOCKS: ReadonlySet<ExamBlockCode> = new Set<ExamBlockCode>(
  ["missing", "login", "denied", "recruits", "completed", "division", "rank", "inactive", "empty"],
);

const pad = (value: number) => String(value).padStart(2, "0");

/** Countdown: 4:05, 1:02:05. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Human duration: 45 mp, 3 p 20 mp, 1 ó 5 p. */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} mp`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return minutes ? `${hours} ó ${minutes} p` : `${hours} ó`;
  return seconds && minutes < 10 ? `${minutes} p ${seconds} mp` : `${minutes} p`;
}

/** Shown in Hungarian time, see lib/datetime. */
export {formatDateTime} from "@/lib/datetime";

export function percentOf(score: number | null | undefined, max: number | null | undefined) {
  return max && max > 0 ? Math.round((100 * (score ?? 0)) / max) : 0;
}

export const isAnswered = (type: QuestionType, answer: DraftAnswer | null | undefined) =>
  type === "text" ? !!answer?.text?.trim() : (answer?.options?.length ?? 0) > 0;

// --- Integrity ---------------------------------------------------------------------------

export type IntegrityLevel = "clean" | "minor" | "notable";

export const INTEGRITY_LEVEL_META: Record<IntegrityLevel, {label: string; hint: string; tone: Tone}> = {
  clean: {label: "Nincs eltérés", hint: "A vizsgázó végig az oldalon maradt, nem illesztett be szöveget.", tone: "emerald"},
  minor: {label: "Apró eltérések", hint: "Rövid távollét vagy kevés beillesztett szöveg: többnyire ártalmatlan.", tone: "slate"},
  notable: {label: "Érdemes átnézni", hint: "Hosszabb távollét vagy sok beillesztett szöveg. Nézd meg az idővonalat és a válaszokat.", tone: "orange"},
};

/** Tells the grader how much attention the log deserves; never a verdict by itself. */
export function integrityLevel(summary: Partial<IntegritySummary> | null | undefined): IntegrityLevel {
  if (!summary) return "clean";
  const {away_count = 0, away_ms = 0, longest_away_ms = 0, paste_count = 0, paste_chars = 0, copy_count = 0, blocked_count = 0} = summary;
  if (away_ms >= 60_000 || longest_away_ms >= 30_000 || paste_chars >= 200 || copy_count >= 3 || blocked_count >= 3) return "notable";
  if (away_count + paste_count + copy_count + blocked_count > 0) return "minor";
  return "clean";
}

/** Short facts for lists and the grader's summary. */
export function integrityFacts(summary: Partial<IntegritySummary> | null | undefined): string[] {
  if (!summary) return [];
  const facts: string[] = [];
  const {away_count = 0, away_ms = 0, longest_away_ms = 0, paste_count = 0, paste_chars = 0, copy_count = 0,
    blocked_count = 0, offline_ms = 0, resume_count = 0} = summary;
  if (away_count) {
    facts.push(`${away_count}× elhagyta az oldalt (összesen ${formatDuration(away_ms)}${away_count > 1 ? `, leghosszabb ${formatDuration(longest_away_ms)}` : ""})`);
  }
  if (paste_count) facts.push(`${paste_count}× illesztett be szöveget (${paste_chars} karakter)`);
  if (copy_count) facts.push(`${copy_count}× másolt a kérdésekből`);
  if (blocked_count) facts.push(`${blocked_count}× próbált tiltott másolást vagy beillesztést`);
  if (offline_ms) facts.push(`A kapcsolat ${formatDuration(offline_ms)} időre megszakadt`);
  if (resume_count) facts.push(`${resume_count}× nyitotta meg újra a vizsgát`);
  return facts;
}
