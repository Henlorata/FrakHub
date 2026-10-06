import {supabase} from "@/lib/supabaseClient";
import {UNIT_LABELS} from "@/lib/fleet";

/**
 * Certificates (issued by the database, checked by code), the opt-in leaderboard, the monthly
 * recap and the printable service record.
 */

export type CertificateKind = "exam" | "qualification" | "rank" | "scenario";

export interface Certificate {
  code: string;
  kind: CertificateKind;
  ref: string;
  title: string;
  subtitle: string | null;
  issued_at: string;
  revoked_at: string | null;
}

/** What the public check returns (null: unknown code). */
export interface VerifiedCertificate {
  code: string;
  kind: CertificateKind;
  /** The unit key or the rank (qualification and rank certificates). */
  ref: string | null;
  title: string;
  subtitle: string | null;
  issued_at: string;
  valid: boolean;
  revoked_at: string | null;
  holder: {full_name: string; badge_number: string; faction_rank: string};
}

export const CERTIFICATE_KIND: Record<CertificateKind, {label: string; tone: string}> = {
  exam: {label: "Vizsgabizonyítvány", tone: "text-sky-300"},
  qualification: {label: "Képesítési okirat", tone: "text-emerald-300"},
  rank: {label: "Kinevezési okirat", tone: "text-amber-300"},
  scenario: {label: "Gyakorlati igazolás", tone: "text-violet-300"},
};

/** The certificate's headline: units are named in full ("Aero Bureau képesítés"). */
export function certificateTitle(certificate: {kind: CertificateKind; ref: string | null; title: string}): string {
  if (certificate.kind === "qualification" && certificate.ref) {
    const unit = UNIT_LABELS[certificate.ref as keyof typeof UNIT_LABELS];
    return `${unit ?? certificate.ref} képesítés`;
  }
  return certificate.title;
}

export const CERTIFICATE_CODE = /^SFSD-[0-9A-F]{4}-[0-9A-F]{4}$/;

/** Accepts "sfsd 1a2b 3c4d", "1A2B3C4D" or a pasted link and returns "SFSD-1A2B-3C4D" (or null). */
export function normalizeCertificateCode(input: string): string | null {
  const raw = input.trim().toUpperCase().split("/").pop() ?? "";
  const hex = raw.replace(/^SFSD/, "").replace(/[^0-9A-F]/g, "");
  if (hex.length !== 8) return null;
  return `SFSD-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export const certificateUrl = (code: string) => `${window.location.origin}/certificates/${code}`;

export type LeaderboardCategory = "duty" | "reports" | "events" | "practice";

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  badge_number: string;
  faction_rank: string;
  avatar_url: string | null;
  value: number;
  place: number;
  me: boolean;
}

export interface Leaderboard {
  month: string;
  /** Whether the caller is listed. */
  visible: boolean;
  /** Members who chose to appear. */
  participants: number;
  categories: {key: LeaderboardCategory; entries: LeaderboardEntry[]; me: {value: number; place: number; of: number} | null}[];
}

export interface MonthlyRecap {
  month: string;
  duty_minutes: number | null;
  duty_avg: number | null;
  /** Percent of the recorded members with less duty time. */
  duty_better_than: number | null;
  reports: number;
  reports_avg: number | null;
  reports_better_than: number | null;
  events_attended: number;
  events_total: number;
  practice_correct: number;
  practice_days: number;
  pay: number | null;
  top_duty: number | null;
  top_report: number | null;
  promotions: {to: string; at: string}[];
  awards: {name: string; color_hex: string | null}[];
  certificates: number;
  leaderboard_visible: boolean;
}

export interface ServiceRecord {
  generated_at: string;
  generated_by: string | null;
  member: {
    id: string; full_name: string; badge_number: string; faction_rank: string; division: string; division_rank: string | null;
    qualifications: string[] | null; avatar_url: string | null; is_bureau_manager: boolean | null; is_bureau_commander: boolean | null;
    commanded_divisions: string[] | null; created_at: string; last_promotion_date: string | null;
  };
  details: {station: string | null; joined_on: string | null; join_type: string | null; activity_status: string | null} | null;
  history: {kind: string; from_value: string | null; to_value: string | null; detail: string | null; created_at: string; actor_name: string | null}[];
  awards: {name: string; color_hex: string | null; awarded_at: string}[];
  records: {kind: "warning" | "commendation"; title: string; created_at: string}[];
  duty: {month: string; minutes: number}[];
  reports: {month: string; count: number}[];
  attendance: {attended: number; total: number};
  exams: {title: string; graded_at: string | null; percentage: number | null}[];
  certificates: {code: string; kind: CertificateKind; ref: string; title: string; issued_at: string}[];
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const recognitionApi = {
  myCertificates: async () => (await rpc<Certificate[] | null>("get_my_certificates")) ?? [],
  verify: (code: string) => rpc<VerifiedCertificate | null>("verify_certificate", {_code: code}),
  leaderboard: (month?: string | null) => rpc<Leaderboard>("get_leaderboard", {_month: month ?? null}),
  setVisible: (visible: boolean) => rpc<{visible: boolean}>("set_leaderboard_visibility", {_visible: visible}),
  recap: (month?: string | null) => rpc<MonthlyRecap>("get_monthly_recap", {_month: month ?? null}),
  serviceRecord: (userId: string) => rpc<ServiceRecord>("get_service_record", {_user_id: userId}),
};

export const LEADERBOARD_CATEGORIES: Record<LeaderboardCategory, {label: string; hint: string}> = {
  duty: {label: "Duty idő", hint: "A gyűlésen rögzített havi idő"},
  reports: {label: "Jelentések", hint: "A jelentésnaplóba felvett jelentések"},
  events: {label: "Események", hint: "Ahol a szervező jelenlétet rögzített"},
  practice: {label: "Gyakorlás", hint: "Napok legalább tíz gyakorló kérdéssel"},
};

/** The month the recap of `month` was last shown for (localStorage), so it opens once. */
export const RECAP_SEEN_KEY = "frakhub.recap.seen";
