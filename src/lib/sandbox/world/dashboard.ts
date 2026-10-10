import {isHighCommand, isStaff} from "@shared/ranks";
import {canApproveWarrants} from "@/lib/mcb";
import {canViewCaseList, getStaffCategory} from "@/lib/utils";
import {addDaysKey} from "@/lib/datetime";
import type {Row} from "../postgrest";
import {DAY, type RpcHandler, type World} from "./context";
import {person} from "./people";
import {upcomingEvents} from "./events";

export function seedDashboard(world: World) {
  const {tables, me, ago} = world;
  tables.system_status = [{id: "global", alert_level: "normal", recruitment_open: true, updated_by: person(1), updated_at: ago(3 * DAY)}];

  tables.announcements = [
    {id: world.id(), title: "Gyakorló mód: üdv a bemutató világban!", type: "training", is_pinned: true, show_author: true, created_by: person(1), created_at: ago(40),
      content: "Ez egy kitalált hirdetmény. A képzés alatt minden adat bemutató: nyugodtan kattints, semmi sem mentődik."},
    {id: world.id(), title: "Fokozott ellenőrzés a kikötőben", type: "alert", is_pinned: false, show_author: false, created_by: person(2), created_at: ago(9 * 60),
      content: "A héten a kikötői raktáraknál fokozott járőrözést tartunk. Gyanús szállítmány esetén azonnal értesítsd az MCB-t."},
    {id: world.id(), title: "Csütörtök 20:00 – állománygyűlés", type: "info", is_pinned: false, show_author: true, created_by: person(1), created_at: ago(2 * DAY),
      content: "A gyűlésen értékeljük a hónapot és kihirdetjük az előléptetéseket. Részvétel kötelező, akadályoztatás esetén szólj a felettesednek."},
  ];

  const log = (userId: string, type: string, details: string, minutesAgo: number): Row =>
    ({id: world.id(), user_id: userId, action_type: type, details, created_at: ago(minutesAgo)});
  tables.action_logs = [
    log(person(9), "ticket", "Bírság: $15 000 - Indok: Gyorshajtás, Piros jelzés figyelmen kívül hagyása", 7),
    log(person(6), "arrest", "60 perc - Indokok: Testi sértés, Ellenállás", 26),
    log(person(11), "ticket", "Bírság: $5 000 - Indok: Szabálytalan parkolás", 54),
    log(person(5), "arrest", "120 perc - Indokok: Fegyveres rablás, Lőfegyver engedély nélkül", 3 * 60),
    log(person(8), "ticket", "Bírság: $25 000 - Indok: Ittas vezetés", 5 * 60),
    log(person(10), "ticket", "Bírság: $8 000 - Indok: Jogosítvány nélküli vezetés", 26 * 60),
  ];

  const note = (title: string, message: string, type: string, category: string, minutesAgo: number, read: boolean, link: string | null,
    actor: string | null = null): Row =>
    ({id: world.id(), user_id: me.id, title, message, type, category, is_read: read, created_at: ago(minutesAgo), link, actor_id: actor});
  tables.notifications = [
    note("Járműigénylés elfogadva", "A Buffalo STX igénylésedet elfogadták, a kulcs a tiéd.", "success", "logistics", 35, false, "/logistics", person(5)),
    note("Új hirdetmény", "Gyakorló mód: üdv a bemutató világban!", "info", "announcement", 40, false, "/dashboard", person(1)),
    note("Vizsgaeredmény", "Deputy I. vizsga: megfelelt (86%).", "success", "exam", 3 * DAY, true, "/exams?tab=mine"),
    note("Költségtérítés jóváhagyva", "$4 500 – javítási költség.", "success", "finance", 5 * DAY, true, "/finance"),
    note("Új tananyag", "Frissült a SAHP képesítés tananyaga.", "info", "academy", 8 * DAY, true, "/academy"),
  ];
  tables.notification_preferences = [];

  // Saved reports (the report pages read them, the counts follow them); in the demo they count for their month.
  const today = world.day();
  let number = 100;
  const report = (userId: string, suspect: string, charges: string, fine: string, jail: string, unit: string, description: string,
                  daysAgo: number, forumPost: number | null): Row => {
    const occurred = addDaysKey(today, -daysAgo);
    const author = world.person(userId);
    const [year, monthPart, dayPart] = occurred.split("-");
    number += 1;
    return {
      id: world.id(), number, user_id: userId, occurred_on: occurred, month: `${occurred.slice(0, 7)}-01`, period: `${occurred.slice(0, 7)}-01`,
      title: `${suspect} – ${charges}`.slice(0, 160), source: "report", officer_name: author?.full_name ?? null, officer_rank: author?.faction_rank ?? null,
      badge_number: author?.badge_number ?? null, colleagues: null, unit_id: unit, suspect_name: suspect, suspect_id_card: null, suspect_license: null,
      suspect_medical: null, report_date: `${year}. ${monthPart}. ${dayPart}.`, charges, fine, jail_time: jail, confiscated_items: "-", description,
      forum_url: forumPost ? `https://forum.hl-rpg.eu/posts/${forumPost}/` : null, forum_post_id: forumPost,
      created_at: ago(daysAgo * DAY + 30), created_by: userId, updated_at: null, voided_at: null, voided_by: null, void_reason: null,
    };
  };
  tables.report_logs = [
    report(person(11), "Tommy Vercetti", "Szabálytalan parkolás", "500", "-", "6-L-014",
      "A Downtown parkolóházánál a mozgássérült helyen álló járművet és vezetőjét igazoltattam, helyszíni bírságot szabtam ki.", 5, 900006),
    report(person(8), "Big Smoke", "Kábítószer birtoklása, Ellenszegülés", "8000", "40", "6-S-002",
      "A kikötőben a bejelentés nyomán érkeztünk; a gyanúsított menekülni próbált, a motozáskor 30 g kokaint találtunk nála.", 4, 900005),
    report(me.id, "Ryder Wilson", "Lőfegyver engedély nélküli birtoklása", "5000", "30", "6-L-005",
      "Bejelentésre érkeztünk a Grove Streetre; a gyanúsítottnál a ruházat átvizsgálásakor engedély nélküli pisztolyt találtunk.", 6, null),
    report(person(6), "Carl Johnson", "Betöréses lopás", "3000", "20", "6-M-003",
      "Az ékszerbolt helyszíni szemléje után a térfigyelő felvételek alapján azonosítottuk és előállítottuk a gyanúsítottat.", 2, 900004),
    report(person(9), "Claude Speed", "Gyorshajtás Lakott Területen (50km/h) – 25% (65km/h)", "1500", "-", "6-L-021",
      "Fort Carsonban sebességmérés közben 65 km/h-val mértük be a járművet, félreállítottuk és helyszíni bírságot szabtunk ki.", 2, 900003),
    report(me.id, "Victor Vance", "Fegyveres rablás", "15000", "60", "6-L-005",
      "A benzinkút kirablásáról szóló riasztás után a menekülő járművet megállítottuk, a gyanúsítottat lefegyvereztük és előállítottuk.", 3, 900002),
    report(me.id, "Mike Toreno", "Piros jelzés figyelmen kívül hagyása", "1000", "-", "6-L-005",
      "A Downtown kereszteződésében a piros jelzésen áthajtó járművet megállítottam, a vezetőt igazoltattam és megbírságoltam.", 1, 900001),
  ];
}

const count = (rows: Row[] | undefined, test: (row: Row) => boolean) => (rows ?? []).filter(test).length;

/** The member's month against the requirements (as get_dashboard_summary() reports it). */
function myMonth(world: World) {
  const {tables, me} = world;
  const month = world.month();
  const duty = (tables.duty_time_entries ?? []).find((row) => row.user_id === me.id && String(row.month) === month);
  const settings = tables.payroll_settings?.[0];
  const reports = count(tables.report_logs, (row) => row.user_id === me.id && String(row.period) === month && !row.voided_at);
  return {
    month,
    reports,
    report_period: month,
    period_reports: reports,
    duty_minutes: duty ? Number(duty.minutes) : null,
    duty_updated_at: duty?.updated_at ?? null,
    min_reports: settings?.min_reports ?? 8,
    min_duty_hours: settings?.min_duty_hours ?? 30,
    reports_recorded: false,
    previous: previousMonth(world),
  };
}

/** Last month as recorded for the member (null: nothing recorded). */
function previousMonth(world: World) {
  const {tables, me} = world;
  const month = world.month(-1);
  const duty = (tables.duty_time_entries ?? []).find((row) => row.user_id === me.id && String(row.month) === month);
  const reports = count(tables.report_logs, (row) => row.user_id === me.id && String(row.period) === month && !row.voided_at);
  if (!duty && !reports) return null;
  const settings = tables.payroll_settings?.[0];
  return {month, duty_minutes: duty ? Number(duty.minutes) : null, reports, min_duty_hours: settings?.min_duty_hours ?? 30,
    min_reports: settings?.min_reports ?? 8, closed: true};
}

export const dashboardRpc: Record<string, RpcHandler> = {
  get_dashboard_summary: (_args, world) => {
    const {tables, me} = world;
    const staff = isStaff(me);
    const highCommand = me.system_role === "admin" || !!me.is_bureau_manager || isHighCommand(me);
    const soon = world.day(7);
    const myVehicles = (tables.fleet_assignments ?? []).filter((key) => key.user_id === me.id).map((key) => key.vehicle_id);
    return {
      unread_notifications: count(tables.notifications, (row) => row.user_id === me.id && !row.is_read),
      pending_exam_sheets: staff || me.qualifications?.includes("TB") ? count(tables.exam_submissions, (row) => row.status === "pending" && !row.deleted_at) : 0,
      pending_registrations: staff ? count(tables.profiles, (row) => row.system_role === "pending") : null,
      pending_leave_requests: staff ? count(tables.hr_records, (row) => row.kind === "leave" && row.status === "pending") : null,
      pending_vehicle_requests: staff ? count(tables.vehicle_requests, (row) => row.status === "pending") : null,
      pending_budget_requests: highCommand ? count(tables.budget_requests, (row) => row.status === "pending") : null,
      pending_warrants: canApproveWarrants(me) ? count(tables.case_warrants, (row) => row.status === "pending" && row.requested_by !== me.id) : null,
      my_open_cases: canViewCaseList(me) ? count(tables.cases, (row) => row.owner_id === me.id && row.status === "open") : null,
      my_pending_requests: count(tables.vehicle_requests, (row) => row.user_id === me.id && row.status === "pending")
        + count(tables.budget_requests, (row) => row.user_id === me.id && row.status === "pending"),
      my_active_warnings: count(tables.hr_records, (row) => row.user_id === me.id && row.kind === "warning" && row.status === "active"),
      my_vehicle_warnings: count(tables.vehicle_warnings, (row) => row.user_id === me.id && !row.revoked_at && !row.converted_record_id),
      my_vehicles_due: count(tables.fleet_vehicles, (row) => myVehicles.includes(row.id) && !!row.registration_required
        && !!row.registration_expires_on && String(row.registration_expires_on) <= soon),
      fleet_registration_due: staff ? count(tables.fleet_vehicles, (row) => !!row.registration_required && !!row.registration_expires_on
        && String(row.registration_expires_on) <= soon) : null,
      fleet_registration_reviews: staff ? count(tables.fleet_registration_requests, (row) => row.status === "pending") : null,
      members_total: count(tables.profiles, (row) => row.system_role !== "pending"),
      members_on_leave: count(tables.hr_records, (row) => row.kind === "leave" && row.status === "active"
        && String(row.starts_on) <= world.day() && String(row.ends_on) >= world.day()),
      my_month: myMonth(world),
      upcoming_events: upcomingEvents(world),
      my_case_tasks: {
        open: count(tables.case_tasks, (row) => row.assignee_id === me.id && !row.done_at),
        overdue: count(tables.case_tasks, (row) => row.assignee_id === me.id && !row.done_at && !!row.due_on && String(row.due_on) < world.day()),
      },
      policies_to_acknowledge: count(tables.policies, (row) => !!row.requires_ack && !row.acked),
      open_polls: count(tables.polls, (row) => !row.closed_at && !row.voted),
      nominations_pending: highCommand ? count(tables.promotion_nominations, (row) => row.status === "pending") : null,
      trainees_ready: null,
      trainees_without_mentor: null,
      mentees: count(tables.trainee_mentors, (row) => row.mentor_id === me.id && !row.completed_at),
      feedback_new: null,
      // No end-of-month recap in practice mode (it would cover the tour).
      recap_month: null,
      active_bolos: count(tables.bolo_alerts, (row) => row.status === "active" && String(row.expires_at) > new Date().toISOString()),
      mail_unread: 0,
      iab_open: null,
    };
  },

  get_announcements: (args, world) => {
    const limit = typeof args._limit === "number" ? args._limit : 12;
    const staff = isStaff(world.me);
    return [...(world.tables.announcements ?? [])]
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit)
      .map((row) => {
        const author = world.person(row.created_by as string);
        const named = !!row.show_author || staff || row.created_by === world.me.id;
        return {
          id: row.id, title: row.title, content: row.content, type: row.type, is_pinned: !!row.is_pinned, show_author: row.show_author !== false,
          created_at: row.created_at, created_by: row.created_by,
          author_name: named ? author?.full_name ?? null : null,
          author_rank: named ? author?.faction_rank ?? null : null,
          author_category: getStaffCategory(author?.faction_rank as string | undefined),
          can_delete: row.created_by === world.me.id || world.me.system_role === "admin" || !!world.me.is_bureau_manager,
        };
      });
  },
};
