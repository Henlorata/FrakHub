export type QuestionType = "text" | "single_choice" | "multiple_choice";

export interface ExamOption {
  id: string;
  question_id: string;
  option_text: string;
  /** Only selected for graders; never sent to candidates. */
  is_correct?: boolean;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index: number;
  is_required: boolean;
  page_number: number;
  exam_options: ExamOption[];
}

export type ExamType = "trainee" | "deputy_i" | "division_exam" | "other";

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
  created_by?: string;
  created_at?: string;
  exam_questions?: ExamQuestion[];
}

export type SubmissionStatus = "pending" | "passed" | "failed" | "grading";

export interface ExamSubmission {
  id: string;
  exam_id: string;
  user_id?: string | null;
  applicant_name?: string | null;
  start_time: string;
  end_time?: string | null;
  tab_switch_count: number;
  total_score?: number | null;
  max_score?: number | null;
  status: SubmissionStatus;
  graded_by?: string | null;
  graded_at?: string | null;
  grading_notes?: string | null;
  feedback_visible?: boolean | null;
  retry_allowed_at?: string | null;
  claim_token?: string | null;
  created_at?: string;
  /** Set while the sheet is in the trash (hidden from the candidate, restorable). */
  deleted_at?: string | null;
  deleted_by?: string | null;
  exams?: {
    title: string;
    passing_percentage: number;
    type?: Exam["type"];
    division?: string | null;
    required_rank?: string | null;
  } | null;
  profiles?: {
    full_name: string;
    badge_number: string;
  } | null;
}

/** Row of the `exam_submissions_view` database view (submission + denormalized names). */
export interface ExamSubmissionView extends ExamSubmission {
  exam_title?: string | null;
  user_full_name?: string | null;
  user_badge_number?: string | null;
  percentage?: number | null;
  exam_type?: Exam["type"] | null;
  exam_division?: string | null;
}

export interface ExamAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  answer_text?: string | null;
  selected_option_ids?: string[] | null;
  points_awarded?: number | null;
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
