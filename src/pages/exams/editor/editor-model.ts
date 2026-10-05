import type {ExamSavePayload} from "@/lib/exams";
import type {Exam, ExamEditorData, ExamType, QuestionType} from "@/types/exams";
import type {Profile} from "@/types/supabase";

let sequence = 0;
/** React key and temporary id of a new row (not a uuid, so the server creates the row). */
export const newKey = () => `new-${Date.now().toString(36)}-${++sequence}`;

export interface DraftOption {
  key: string;
  id: string | null;
  option_text: string;
  is_correct: boolean;
}

export interface DraftQuestion {
  key: string;
  id: string | null;
  page: number;
  question_text: string;
  question_type: QuestionType;
  points: number;
  is_required: boolean;
  guide: string;
  options: DraftOption[];
}

export interface DraftPage {
  title: string;
  description: string;
  /** Questions drawn per attempt (null: every question of the page). */
  draw_count: number | null;
}

export type DraftSettings = Pick<Exam, "title" | "type" | "division" | "required_rank" | "min_days_in_rank" | "time_limit_minutes"
  | "passing_percentage" | "is_public" | "is_active" | "allow_sharing" | "is_invitation_only" | "shuffle_questions"
  | "shuffle_options" | "block_clipboard" | "auto_grade" | "retry_cooldown_hours"> & {description: string};

export interface Draft {
  settings: DraftSettings;
  pages: Record<number, DraftPage>;
  questions: DraftQuestion[];
}

export const EMPTY_PAGE: DraftPage = {title: "", description: "", draw_count: null};

export const ALL_DIVISIONS = ["SEB", "MCB", "TSB", "SAHP", "AB", "MU", "GW", "FAB", "SIB"];

/** Exam types the member may create (recruitment and Deputy I. exams: bureau managers only). */
export function allowedTypes(profile: Profile): {value: ExamType; label: string}[] {
  const common: {value: ExamType; label: string}[] = [{value: "division_exam", label: "Osztályvizsga"}, {value: "other", label: "Egyéb vizsga"}];
  return profile.is_bureau_manager
    ? [{value: "trainee", label: "Felvételi vizsga"}, {value: "deputy_i", label: "Deputy I. vizsga"}, ...common]
    : common;
}

/** Divisions the member may assign (bureau managers: any, or none). */
export function allowedDivisions(profile: Profile): string[] {
  if (profile.is_bureau_manager) return ALL_DIVISIONS;
  const own = profile.is_bureau_commander && profile.division ? [profile.division] : [];
  return [...new Set([...own, ...(profile.commanded_divisions ?? [])])];
}

export function emptyDraft(profile: Profile): Draft {
  const divisions = allowedDivisions(profile);
  return {
    settings: {
      title: "", description: "", type: "division_exam", division: profile.is_bureau_manager ? null : divisions[0] ?? null,
      required_rank: null, min_days_in_rank: 0, time_limit_minutes: 30, passing_percentage: 80, is_public: false, is_active: true,
      allow_sharing: false, is_invitation_only: false, shuffle_questions: false, shuffle_options: false, block_clipboard: false,
      auto_grade: false, retry_cooldown_hours: 24,
    },
    pages: {},
    questions: [newQuestion(1, "text")],
  };
}

export function fromEditorData(data: ExamEditorData): Draft {
  const {exam} = data;
  return {
    settings: {
      title: exam.title, description: exam.description ?? "", type: exam.type, division: exam.division ?? null,
      required_rank: exam.required_rank ?? null, min_days_in_rank: exam.min_days_in_rank ?? 0,
      time_limit_minutes: exam.time_limit_minutes ?? 60, passing_percentage: exam.passing_percentage ?? 80,
      is_public: !!exam.is_public, is_active: exam.is_active !== false, allow_sharing: !!exam.allow_sharing,
      is_invitation_only: !!exam.is_invitation_only, shuffle_questions: !!exam.shuffle_questions,
      shuffle_options: !!exam.shuffle_options, block_clipboard: !!exam.block_clipboard, auto_grade: !!exam.auto_grade,
      retry_cooldown_hours: exam.retry_cooldown_hours ?? 0,
    },
    pages: Object.fromEntries(data.pages.map((page) => [page.page_number, {
      title: page.title ?? "", description: page.description ?? "", draw_count: page.draw_count ?? null,
    }])),
    questions: data.questions.map((question) => ({
      key: question.id, id: question.id, page: question.page_number, question_text: question.question_text,
      question_type: question.question_type, points: question.points, is_required: question.is_required,
      guide: question.guide ?? "",
      options: question.options.map((option) => ({key: option.id, id: option.id, option_text: option.option_text, is_correct: option.is_correct})),
    })),
  };
}

export function newOption(): DraftOption {
  return {key: newKey(), id: null, option_text: "", is_correct: false};
}

export function newQuestion(page: number, type: QuestionType): DraftQuestion {
  return {
    key: newKey(), id: null, page, question_text: "", question_type: type, points: type === "text" ? 2 : 1, is_required: true,
    guide: "", options: type === "text" ? [] : [newOption(), newOption()],
  };
}

/** The pages in use, in order (always at least the first). */
export function pageNumbers(draft: Draft): number[] {
  const pages = new Set(draft.questions.map((question) => question.page));
  Object.keys(draft.pages).forEach((page) => pages.add(Number(page)));
  if (!pages.size) pages.add(1);
  return [...pages].sort((a, b) => a - b);
}

/** Questions in saving order: by page, then by their order on the page. */
export const orderedQuestions = (draft: Draft) =>
  draft.questions.map((question, index) => ({question, index}))
    .sort((a, b) => a.question.page - b.question.page || a.index - b.index)
    .map(({question}) => question);

/** First problem that would stop the save, with the question to jump to. */
export function validate(draft: Draft): {message: string; questionKey?: string; tab: "settings" | "questions"} | null {
  const {settings} = draft;
  if (settings.title.trim().length < 3) return {message: "Adj a vizsgának legalább 3 karakteres címet.", tab: "settings"};
  if (!draft.questions.length) return {message: "A vizsgának legalább egy kérdés kell.", tab: "questions"};
  const ordered = orderedQuestions(draft);
  for (const [index, question] of ordered.entries()) {
    const label = `${index + 1}. kérdés`;
    if (!question.question_text.trim()) return {message: `${label}: hiányzik a kérdés szövege.`, questionKey: question.key, tab: "questions"};
    if (question.question_type === "text") continue;
    if (question.options.length < 2) return {message: `${label}: legalább két válaszlehetőség kell.`, questionKey: question.key, tab: "questions"};
    if (question.options.some((option) => !option.option_text.trim())) {
      return {message: `${label}: van üres válaszlehetőség.`, questionKey: question.key, tab: "questions"};
    }
    const correct = question.options.filter((option) => option.is_correct).length;
    if (question.points > 0 && correct === 0) return {message: `${label}: jelöld meg a helyes választ.`, questionKey: question.key, tab: "questions"};
    if (question.question_type === "single_choice" && correct > 1) {
      return {message: `${label}: egyválasztós kérdésnek egy helyes válasza lehet.`, questionKey: question.key, tab: "questions"};
    }
  }
  return null;
}

/** Pages are renumbered 1..n on save, so gaps never reach the server. */
export function toPayload(draft: Draft): ExamSavePayload {
  const pages = pageNumbers(draft).filter((page) => draft.questions.some((question) => question.page === page));
  const renumber = new Map(pages.map((page, index) => [page, index + 1]));
  const {settings} = draft;
  return {
    exam: {...settings, title: settings.title.trim(), description: settings.description.trim()},
    pages: pages.map((page) => {
      const meta = draft.pages[page] ?? EMPTY_PAGE;
      return {page_number: renumber.get(page) ?? 1, title: meta.title.trim() || null, description: meta.description.trim() || null, draw_count: meta.draw_count};
    }),
    questions: orderedQuestions(draft).map((question) => ({
      id: question.id ?? question.key,
      question_text: question.question_text.trim(),
      question_type: question.question_type,
      points: question.points,
      is_required: question.is_required,
      page_number: renumber.get(question.page) ?? 1,
      guide: question.guide.trim(),
      options: question.question_type === "text" ? [] : question.options.map((option) => ({
        id: option.id ?? option.key, option_text: option.option_text.trim(), is_correct: option.is_correct,
      })),
    })),
  };
}
