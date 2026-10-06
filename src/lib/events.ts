import {CalendarDays, GraduationCap, Medal, ScrollText, Siren, Users, type LucideIcon} from "lucide-react";
import {DIVISIONS, isHighCommand, isStaff, QUALIFICATIONS} from "@shared/ranks";
import {isUnitMember, leadsUnit, type FleetSubject} from "@/lib/fleet";
import {supabase} from "@/lib/supabaseClient";
import type {Profile} from "@/types/supabase";

/**
 * Events: meetings, trainings, exams and joint actions with attendance. The database decides
 * who sees and organises an event (private.can_see_event / can_manage_event); the helpers here
 * mirror it for the buttons.
 */

export type EventKind = "meeting" | "training" | "exam" | "patrol" | "ceremony" | "other";
export type EventStatus = "going" | "maybe" | "absent";

export interface EventCounts {
  going: number;
  maybe: number;
  absent: number;
}

export interface EventResponse {
  user_id: string;
  status: EventStatus;
  full_name: string;
  badge_number: string | null;
  faction_rank: string | null;
  avatar_url: string | null;
  /** Visible to the organisers and to the member themselves. */
  note: string | null;
}

export interface FactionEvent {
  id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  audience: string;
  rsvp: boolean;
  cancelled_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  can_manage: boolean;
  my_status: EventStatus | null;
  my_note: string | null;
  counts: EventCounts;
  responses: EventResponse[];
  /** When the organisers recorded who was there (null: not yet). */
  attendance_taken_at?: string | null;
  attended_count?: number | null;
  /** Whether the reader was there (null: attendance not taken). */
  i_attended?: boolean | null;
  /** Who was there: organisers only. */
  attendee_ids?: string[] | null;
}

/** Approved leave in the calendar (dates only, like the roster). */
export interface Absence {
  user_id: string;
  full_name: string;
  badge_number: string | null;
  faction_rank: string | null;
  avatar_url: string | null;
  starts_on: string;
  ends_on: string;
}

/** A member's attendance of the last 90 days (themselves and the staff). */
export interface MemberAttendance {
  attended: number;
  total: number;
  events: {id: string; title: string; kind: EventKind; starts_at: string; audience: string; response: EventStatus | null; attended: boolean}[];
}

/** What the dashboard shows of the next events. */
export interface UpcomingEvent {
  id: string;
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  rsvp: boolean;
  my_status: EventStatus | null;
}

export interface EventDraft {
  title: string;
  description: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  audience: string;
  rsvp: boolean;
}

export const EVENT_KINDS: Record<EventKind, {label: string; icon: LucideIcon; text: string; tile: string; bar: string; dot: string}> = {
  meeting: {label: "Gyűlés", icon: Users, text: "text-yellow-300", tile: "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30",
    bar: "from-yellow-300 to-amber-600", dot: "bg-yellow-400"},
  training: {label: "Képzés", icon: GraduationCap, text: "text-cyan-300", tile: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    bar: "from-cyan-300 to-sky-600", dot: "bg-cyan-400"},
  exam: {label: "Vizsga", icon: ScrollText, text: "text-violet-300", tile: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
    bar: "from-violet-300 to-purple-600", dot: "bg-violet-400"},
  patrol: {label: "Közös akció", icon: Siren, text: "text-sky-300", tile: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    bar: "from-sky-300 to-blue-700", dot: "bg-sky-400"},
  ceremony: {label: "Ünnepség", icon: Medal, text: "text-emerald-300", tile: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    bar: "from-emerald-300 to-teal-600", dot: "bg-emerald-400"},
  other: {label: "Egyéb", icon: CalendarDays, text: "text-slate-300", tile: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    bar: "from-slate-300 to-slate-600", dot: "bg-slate-400"},
};

export const EVENT_KIND_ORDER: EventKind[] = ["meeting", "training", "exam", "patrol", "ceremony", "other"];

export const RESPONSE_LABELS: Record<EventStatus, string> = {going: "Ott leszek", maybe: "Talán", absent: "Nem tudok menni"};

const UNIT_AUDIENCES = [...DIVISIONS, ...QUALIFICATIONS] as readonly string[];

/** "Mindenki", "Felügyelők és felettük", "SEB divízió", "SAHP egység". */
export const audienceLabel = (audience: string) =>
  audience === "all" ? "Mindenki"
    : audience === "staff" ? "Felügyelők és felettük"
      : audience === "command" ? "Parancsnokság"
        : (DIVISIONS as readonly string[]).includes(audience) ? `${audience} divízió` : `${audience} egység`;

/** The audiences a member may organise events for (empty: no "new event" button). */
export function organisableAudiences(profile: Profile | null | undefined): string[] {
  if (!profile || profile.system_role === "pending") return [];
  if (isHighCommand(profile) || profile.is_bureau_manager) return ["all", "staff", "command", ...UNIT_AUDIENCES];
  if (isStaff(profile)) return ["all", "staff", ...UNIT_AUDIENCES];
  return UNIT_AUDIENCES.filter((unit) => leadsUnit(profile, unit));
}

/** Whether the member is part of an event's audience (organisers see more). */
export const isInAudience = (profile: FleetSubject, audience: string) =>
  audience === "all"
  || (audience === "staff" && isStaff(profile))
  || (audience === "command" && (isHighCommand(profile) || !!profile.is_bureau_manager))
  || (audience !== "staff" && audience !== "command" && isUnitMember(profile, audience));

/** Answers are open until the event ends (three hours when it has no end). */
export const eventEnd = (event: Pick<FactionEvent, "starts_at" | "ends_at">) =>
  event.ends_at ? Date.parse(event.ends_at) : Date.parse(event.starts_at) + 3 * 3_600_000;

export const canRespond = (event: FactionEvent, now = Date.now()) => event.rsvp && !event.cancelled_at && eventEnd(event) > now;

/** Attendance is recorded by the organisers from the start until 30 days later (set_event_attendance). */
export const canTakeAttendance = (event: FactionEvent, now = Date.now()) =>
  event.can_manage && !event.cancelled_at && Date.parse(event.starts_at) <= now && Date.parse(event.starts_at) >= now - 30 * 86_400_000;

/** The absences covering a calendar day ("2026-10-09"). */
export const absentOn = (absences: Absence[], day: string) => absences.filter((item) => item.starts_on <= day && item.ends_on >= day);

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

const COLUMNS = "id";

export const eventsApi = {
  list: (from: Date, to: Date) => rpc<FactionEvent[]>("get_events", {_from: from.toISOString(), _to: to.toISOString()}),
  respond: (eventId: string, status: EventStatus | null, note?: string | null) =>
    rpc<EventCounts>("respond_to_event", {_event_id: eventId, _status: status, _note: note ?? null}),
  /** Approved leave overlapping the days ("2026-10-01" to "2026-12-31"). */
  absences: async (from: string, to: string) => (await rpc<Absence[] | null>("get_absences", {_from: from, _to: to})) ?? [],
  setAttendance: (eventId: string, userIds: string[]) =>
    rpc<{attended: number; attendance_taken_at: string}>("set_event_attendance", {_event_id: eventId, _user_ids: userIds}),
  memberAttendance: (userId: string) => rpc<MemberAttendance>("get_member_attendance", {_user_id: userId}),
  create: async (draft: EventDraft) => {
    const {data, error} = await supabase.from("events").insert(draft).select(COLUMNS).single();
    if (error) throw error;
    return (data as {id: string}).id;
  },
  update: async (id: string, patch: Partial<EventDraft> & {cancelled_at?: string | null}) => {
    const {error} = await supabase.from("events").update(patch).eq("id", id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const {error} = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  },
};
