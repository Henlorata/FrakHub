export type QuestionType = "text" | "single_choice" | "multiple_choice";
export type ExamType = "trainee" | "deputy_i" | "division_exam" | "other";
export type SubmissionStatus = "in_progress" | "pending" | "passed" | "failed" | "grading";
/** How an attempt ended: handed in, handed in when the time ran out, or closed by the server. */
export type FinishReason = "submitted" | "time_up" | "expired";

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  type: ExamType;
  division?: string | null;
  required_rank?: string | null;
  min_days_in_rank: number;
  time_limit_minutes: number;
  passing_percentage: number;
  is_public: boolean;
  is_active: boolean;
  is_invitation_only: boolean;
  allow_sharing: boolean;
  /** Question order shuffled per attempt (within each page). */
  shuffle_questions: boolean;
  /** Option order shuffled per attempt. */
  shuffle_options: boolean;
  /** Copy and paste are disabled while the exam runs. */
  block_clipboard: boolean;
  /** Decided on hand-in when no scored text question needs a grader. */
  auto_grade: boolean;
  /** Default waiting time after a failed attempt. */
  retry_cooldown_hours: number;
  created_by?: string | null;
  created_at?: string;
}

/** Why the signed-in member (or a guest) may not start the exam now. */
export type ExamBlockCode = "missing" | "inactive" | "empty" | "login" | "denied" | "invitation" | "recruits"
  | "completed" | "division" | "rank" | "days" | "pending" | "passed" | "cooldown";

export interface ExamBlock {
  code: ExamBlockCode;
  message: string;
  until?: string;
}

/** Totals of a sheet's integrity log. */
export interface IntegritySummary {
  away_count: number;
  away_ms: number;
  longest_away_ms: number;
  paste_count: number;
  paste_chars: number;
  copy_count: number;
  blocked_count: number;
  offline_ms: number;
  resume_count: number;
}

export type IntegrityEventKind = "away" | "paste" | "copy" | "blocked" | "offline" | "page" | "resume";

/** One entry of the integrity log (times in ms since the start of the attempt). */
export interface IntegrityEvent {
  k: IntegrityEventKind;
  at: number;
  /** Duration (away, offline). */
  d?: number;
  /** Pasted characters. */
  n?: number;
  /** Page. */
  p?: number;
  /** Question. */
  q?: string;
  /** What was blocked: paste, copy, drop, menu. */
  x?: string;
}

export interface ExamPage {
  page_number: number;
  title: string | null;
  description: string | null;
  /** Questions drawn from the page per attempt (null: all). Editors only. */
  draw_count?: number | null;
}

export interface SheetOption {
  id: string;
  option_text: string;
  /** Graders, and candidates with released feedback. */
  is_correct?: boolean;
}

export interface SheetAnswer {
  text: string | null;
  options: string[];
  points: number | null;
  comment: string | null;
  /** Characters pasted into the answer. */
  pasted: number;
}

/** A question of an attempt or a sheet, in the candidate's order. */
export interface SheetQuestion {
  id: string;
  page_number: number;
  question_text: string;
  question_type: QuestionType;
  points: number;
  is_required: boolean;
  options: SheetOption[];
  answer: SheetAnswer | null;
  /** Graders only. */
  guide?: string | null;
  auto_points?: number | null;
}

export interface AttemptInfo {
  id: string;
  status: SubmissionStatus | "removed";
  started_at?: string;
  deadline: string | null;
  finish_reason?: FinishReason | null;
  /** Guests: the code that attaches the sheet to their profile later. */
  claim_token?: string | null;
  percentage?: number | null;
  applicant_name?: string;
}

/** Reply of start_exam() for an open attempt. */
export interface AttemptPayload {
  server_now: string;
  finished: false;
  /** Guests only, once, when the attempt is created. */
  secret: string | null;
  attempt: AttemptInfo;
  exam: Pick<Exam, "id" | "title" | "description" | "type" | "time_limit_minutes" | "passing_percentage" | "block_clipboard" | "auto_grade">;
  pages: ExamPage[];
  questions: SheetQuestion[];
}

/** Reply of save/finish (and of start_exam for an attempt that already ended). */
export interface AttemptStateReply {
  server_now: string;
  finished: boolean;
  attempt: AttemptInfo;
  /** finish_exam(): required questions without an answer. */
  missing?: number;
  saved_at?: string;
}

export interface ExamIntro {
  server_now: string;
  exam: Pick<Exam, "id" | "title" | "description" | "type" | "division" | "time_limit_minutes" | "passing_percentage"
    | "is_public" | "is_active" | "block_clipboard" | "shuffle_questions" | "auto_grade"> & {
    question_count: number;
    page_count: number;
  };
  viewer: {signed_in: boolean; member: boolean; name: string | null};
  block: ExamBlock | null;
  attempt: AttemptInfo | null;
  last: {id: string; status: SubmissionStatus; end_time: string | null; retry_allowed_at: string | null; percentage: number | null} | null;
}

export interface HubExam extends Exam {
  question_count: number;
  block: ExamBlock | null;
  open_attempt: {id: string; deadline: string} | null;
  last: {id: string; status: SubmissionStatus; end_time: string | null; retry_allowed_at: string | null; percentage: number | null} | null;
}

export interface MySheet {
  id: string;
  exam_id: string;
  exam_title: string;
  status: SubmissionStatus;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  passing_percentage: number;
  start_time: string;
  end_time: string | null;
  deadline: string | null;
  retry_allowed_at: string | null;
  feedback_visible: boolean;
  graded_at: string | null;
  finish_reason: FinishReason | null;
}

export interface QueueSheet {
  id: string;
  exam_id: string;
  exam_title: string;
  exam_type: ExamType;
  exam_division: string | null;
  user_id: string | null;
  candidate_name: string;
  badge_number: string | null;
  avatar_url: string | null;
  start_time: string;
  end_time: string | null;
  finish_reason: FinishReason | null;
  integrity: Partial<IntegritySummary>;
  tab_switch_count: number | null;
  total_score: number | null;
  max_score: number | null;
  /** Scored text questions the grader still has to score. */
  open_questions: number;
}

export interface LiveAttempt {
  id: string;
  exam_id: string;
  exam_title: string;
  candidate_name: string;
  badge_number: string | null;
  avatar_url: string | null;
  start_time: string;
  deadline: string;
  last_seen_at: string | null;
  question_count: number;
  answered: number;
  integrity: Partial<IntegritySummary>;
}

export interface ExamHubData {
  server_now: string;
  exams: HubExam[];
  mine: MySheet[];
  queue: QueueSheet[];
  live: LiveAttempt[];
}

/** Reply of get_exam_sheet(). */
export interface ExamSheet {
  server_now: string;
  viewer: {grader: boolean; can_grade: boolean; can_trash: boolean; can_purge: boolean};
  sheet: {
    id: string;
    exam_id: string;
    user_id: string | null;
    candidate_name: string;
    applicant_name: string | null;
    badge_number: string | null;
    avatar_url: string | null;
    status: SubmissionStatus;
    start_time: string;
    end_time: string | null;
    deadline: string | null;
    finish_reason: FinishReason | null;
    last_seen_at: string | null;
    total_score: number | null;
    max_score: number | null;
    grading_notes: string | null;
    graded_at: string | null;
    graded_by_name: string | null;
    feedback_visible: boolean;
    retry_allowed_at: string | null;
    deleted_at: string | null;
    tab_switch_count: number | null;
    integrity: Partial<IntegritySummary> | null;
    integrity_log: IntegrityEvent[] | null;
    claim_token: string | null;
  };
  exam: Pick<Exam, "id" | "title" | "type" | "division" | "passing_percentage" | "time_limit_minutes" | "retry_cooldown_hours">;
  pages: ExamPage[];
  questions: SheetQuestion[];
}

export interface EditorOption {
  id: string;
  option_text: string;
  is_correct: boolean;
}

export interface EditorQuestion {
  id: string;
  page_number: number;
  question_text: string;
  question_type: QuestionType;
  points: number;
  is_required: boolean;
  guide: string | null;
  options: EditorOption[];
}

/** Reply of get_exam_editor(). */
export interface ExamEditorData {
  exam: Exam;
  pages: ExamPage[];
  questions: EditorQuestion[];
  sheet_count: number;
  open_attempts: number;
}

/** Reply of get_exam_stats(). */
export interface ExamStats {
  totals: {
    sheets: number;
    graded: number;
    passed: number;
    failed: number;
    pending: number;
    avg_percentage: number | null;
    avg_minutes: number | null;
    last_at: string | null;
  };
  questions: {
    id: string;
    answered: number;
    graded: number;
    avg_ratio: number | null;
    option_counts: Record<string, number>;
  }[];
}

/** Row of the `exam_submissions_view` database view (sheet + names, for lists). */
export interface ExamSubmissionView {
  id: string;
  created_at: string;
  exam_id: string;
  user_id: string | null;
  status: SubmissionStatus;
  total_score: number | null;
  max_score: number | null;
  start_time: string;
  end_time: string | null;
  tab_switch_count: number | null;
  grading_notes: string | null;
  graded_at: string | null;
  graded_by: string | null;
  feedback_visible: boolean | null;
  exam_title: string | null;
  user_full_name: string | null;
  user_badge_number: string | null;
  applicant_name: string | null;
  percentage: number | null;
  deleted_at: string | null;
  deleted_by: string | null;
  exam_type: ExamType | null;
  exam_division: string | null;
  deadline: string | null;
  finish_reason: FinishReason | null;
  integrity: Partial<IntegritySummary> | null;
}

export interface ExamOverride {
  id: string;
  exam_id: string;
  user_id: string;
  access_type: "allow" | "deny";
  granted_by?: string | null;
  profile?: {
    full_name: string;
    badge_number: string;
    faction_rank: string;
    avatar_url?: string | null;
  } | null;
}
