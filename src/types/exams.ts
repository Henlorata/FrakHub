export type QuestionType = 'text' | 'single_choice' | 'multiple_choice';

export interface ExamOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
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

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  type: 'trainee' | 'deputy_i' | 'division_exam' | 'other';
  division?: string | null;
  required_rank?: string | null;
  min_days_in_rank: number;
  time_limit_minutes: number;
  passing_percentage: number;
  is_public: boolean;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  exam_questions?: ExamQuestion[];
}

export interface ExamSubmission {
  id: string;
  exam_id: string;
  user_id?: string;
  applicant_name?: string;
  start_time: string;
  end_time?: string;
  tab_switch_count: number;
  total_score?: number;
  max_score?: number;
  status: 'pending' | 'passed' | 'failed' | 'grading';
  graded_by?: string;
  retry_allowed_at?: string;
  exams?: {
    title: string;
    passing_percentage: number;
  };
  profiles?: {
    full_name: string;
    badge_number: string;
  };
}