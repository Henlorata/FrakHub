export interface AcademyMaterial {
  id: string;
  title: string;
  day_number: number;
  page_order: number;
  content: any;
  category: 'basic' | 'mcb' | 'seb' | 'other';
  theme: string;
  updated_at: string;
}

export interface AcademyCycle {
  id: string;
  start_date: string; // YYYY-MM-DD
  status: 'planned' | 'active' | 'archived';
  created_at: string;
}

export interface AcademyStudent {
  id: string;
  cycle_id: string;
  user_id: string;
  status: 'enrolled' | 'passed' | 'failed' | 'dropped';
  profile?: {
    full_name: string;
    badge_number: string;
    faction_rank: string;
    avatar_url?: string;
  };
}

export interface AcademyLog {
  id: string;
  cycle_id: string;
  student_id: string;
  day_number: number;
  is_present: boolean;
  note: string;
  instructor_id: string;
}