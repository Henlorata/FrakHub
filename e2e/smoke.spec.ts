import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

/**
 * Opens every route as a high-ranking member (so admin-only UI renders too) and fails on
 * uncaught exceptions or React error screens. Data is mostly empty: this catches crashes,
 * not layout details.
 */
const ROUTES: {path: string; text: RegExp}[] = [
  {path: "/dashboard", text: /Gyors elérés/i},
  {path: "/notifications", text: /Kommunikáció/i},
  {path: "/notifications?view=settings", text: /Asztali értesítések/i},
  {path: "/reports", text: /jelentés/i},
  {path: "/reports?tab=folder", text: /jelentési mappa nyitása/i},
  {path: "/reports?tab=mine", text: /jelentés ebben a hónapban/i},
  {path: "/reports?tab=summary", text: /Rögzítés tag nevében/i},
  {path: "/hr", text: /Human Resources/i},
  {path: "/hr?tab=requests", text: /Regisztrációk/i},
  {path: "/hr?tab=history", text: /Állományváltozások/i},
  {path: "/hr?tab=stats", text: /Rendfokozatok/i},
  {path: "/mcb", text: /Major Crimes Bureau/i},
  {path: "/mcb/suspects", text: /Bűnügyi nyilvántartás/i},
  {path: "/mcb/warrants", text: /Elbírálásra vár/i},
  {path: "/mcb/admin", text: /Az iroda vezetése/i},
  {path: "/exams", text: /Vizsgák, eredmények és javítás/i},
  {path: "/exams?tab=grading", text: /Javításra vár/i},
  {path: "/exams?tab=all_history", text: /Minden állapot/i},
  {path: "/exams?tab=trash", text: /Törölt vizsgalapok/i},
  {path: "/exams/editor", text: /Új vizsga/i},
  {path: "/logistics", text: /Flotta és ellátás/i},
  {path: "/logistics?tab=fleet", text: /Marked Ford Explorer/i},
  {path: "/logistics?tab=fleet&view=reviews", text: /Nincs ellenőrzésre váró forgalmi/i},
  {path: "/logistics?tab=fleet&view=warnings", text: /Jármű-hibapontok/i},
  {path: "/logistics?tab=fleet&view=tuning", text: /hivatalos tuning/i},
  {path: "/logistics/fleet/v1", text: /Kulcsosok/i},
  {path: "/finance", text: /Költségtérítések/i},
  {path: "/finance?tab=payroll", text: /Hónap lezárása/i},
  {path: "/finance?tab=settings", text: /Rendfokozat/i},
  {path: "/finance?tab=overview", text: /Havi kiadások/i},
  {path: "/profile", text: /Személyi Akta/i},
  {path: "/calculator", text: /kalkulátor|büntető/i},
  {path: "/academy", text: /Trainee akadémia/i},
  {path: "/academy?course=basic&day=1", text: /még nincs tananyag/i},
  {path: "/academy?course=qual_AB", text: /Ebben a tananyagban még nincs oldal/i},
  {path: "/events", text: /Nincs tervezett esemény/i},
  {path: "/codes", text: /10-es kódok/i},
  {path: "/codes?tab=callsign", text: /Igazoltatott jármű/i},
  {path: "/codes?tab=quiz", text: /Mit jelent|Melyik kód/i},
  {path: "/hr?tab=promotions", text: /Javaslatok/i},
  {path: "/hr?tab=trainees", text: /Most nincs Trainee/i},
  {path: "/hr?tab=duty", text: /Aktivitásfigyelő/i},
  {path: "/hr/record/u1", text: /Szolgálati lap/i},
  {path: "/mcb/informants", text: /Még nincs informátor/i},
  {path: "/policies", text: /Még nincs szabályzat/i},
  {path: "/community", text: /Még nem volt szavazás/i},
  {path: "/community?tab=ideas", text: /Ebben a nézetben nincs ötlet/i},
  // The readers (the smoke user is one) land on the inbox; their own reports are one tab away.
  {path: "/community?tab=feedback", text: /Nincs beérkezett visszajelzés/i},
  {path: "/community?tab=feedback&box=mine", text: /Névtelen visszajelzés a vezetőségnek/i},
  {path: "/practice", text: /Kártyacsomagok/i},
  {path: "/practice?deck=radio", text: /Mit jelent|Melyik kód/i},
  {path: "/leaderboard", text: /Szerepelek a ranglistán/i},
  {path: "/permissions", text: /Csak amit én megtehetek/i},
  {path: "/profile?tab=certificates", text: /Még nincs oklevelem/i},
  {path: "/certificates/SFSD-0000-0001", text: /Ezennel igazoljuk/i},
];

test("every page renders without runtime errors", async ({page}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));

  await mockSupabase(page, {
    tables: {
      profiles: [testProfile({
        faction_rank: "Commander",
        system_role: "admin",
        division: "MCB",
        division_rank: "Investigator III.",
        is_bureau_manager: true,
        qualifications: ["TB"],
      })],
      payroll_settings: [{id: "global", rank_pay: {}, unit_pay: {}, duty_tiers: [], min_duty_hours: 30, top_duty_pay: [0, 0, 0],
        top_report_pay: [0, 0, 0], report_pay: 0, picture_pay: 0, training_pay: 0, tax_percent: 3, executive_unit: "BM", updated_at: null}],
      fleet_categories: [{id: "explorer", name: "Marked Ford Explorer", description: null, unit: null, min_rank: null, tone: "orange",
        sort_order: 20}],
      fleet_vehicles: [{
        id: "v1", plate: "SFSD-012", model: "Ford Explorer", category_id: "explorer", game_id: 250562, station: "Downtown",
        callsign: null, license_name: null, capacity: 2, shared_label: null, allowed_units: null, min_rank: null, is_unmarked: true,
        registration_required: true, registration_expires_on: null, notes: null, is_active: true,
        created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", holders: [],
      }],
    },
    rpc: {
      get_exam_hub: {server_now: "2026-10-01T00:00:00Z", exams: [], mine: [], queue: [], live: []},
      get_academy_overview: {
        viewer: {instructor: true, trainee: false}, today: "2026-10-02", cycle: {id: "c1", start_date: "2026-10-01", status: "active"},
        basic: [1, 2, 3, 4, 5].map((day) => ({day, pages: 0})),
        courses: [{id: "qual_AB", title: "AB képesítés", description: null, category: "qualification", is_open: true, required_rank: null,
          linear_progression: true, pages: 0, completed: 0, readable: true, rank_ok: true}],
      },
      get_payroll: (args: {_month: string}) => ({
        month: args._month, status: "open", saved: false, withdrawn: null, note: null, closed_at: null, closed_by_name: null, rows: [],
        settings: {rank_pay: {}, unit_pay: {}, duty_tiers: [], min_duty_hours: 30, top_duty_pay: [0, 0, 0], top_report_pay: [0, 0, 0],
          report_pay: 0, picture_pay: 0, training_pay: 0, tax_percent: 3, executive_unit: "BM"},
        total: 0, tax: 0, paid_total: 0, can_edit_settings: true, months: [],
      }),
      get_case_list: [],
      get_events: [],
      get_mcb_overview: {
        viewer: {is_lead: true},
        totals: {open: 0, closed: 0, archived: 0, critical: 0, opened_30d: 0, closed_30d: 0, avg_close_days: null, warrants_pending: 0,
          warrants_active: 0, wanted: 0, suspects: 0},
        monthly: [{month: "2026-10", opened: 0, closed: 0}], categories: [], members: [], unattended: [], recent: [],
      },
      get_finance_overview: {pending: {count: 0, amount: 0}, months: [{month: "2026-10-01", reimbursed: 0, reimbursements: 0, payroll_status: null,
        payroll_total: null, payroll_withdrawn: null, payroll_tax_percent: null}]},
      get_promotion_board: {criteria: [], exams: [], can_edit_criteria: true, members: [], nominations: []},
      get_trainees: [],
      get_activity_watch: {months: ["2026-09-01", "2026-08-01"], recorded: [false, false], min_minutes: 1800, members: []},
      get_service_record: {
        generated_at: "2026-10-06T10:00:00Z", generated_by: "Teszt",
        member: {id: "u1", full_name: "Teszt Elek", badge_number: "1001", faction_rank: "Commander", division: "TSB", division_rank: null,
          qualifications: ["TB"], avatar_url: null, is_bureau_manager: true, is_bureau_commander: false, commanded_divisions: [],
          created_at: "2025-01-01T00:00:00Z", last_promotion_date: null},
        details: null, history: [], awards: [], records: [], duty: [], reports: [], attendance: {attended: 0, total: 0}, exams: [], certificates: [],
      },
      get_informants: {is_lead: true, informants: []},
      get_policies: {can_edit: true, members: 1, policies: []},
      get_polls: [],
      get_suggestions: {can_respond: true, suggestions: []},
      get_my_feedback: {blocked_until: null, sent_this_week: 0, reports: []},
      get_feedback_inbox: [],
      get_practice_overview: {decks: {}, streak: 0, best_streak: 0, today: "2026-10-06", days: [], can_edit: true, scenarios: [], certificates: 0},
      get_leaderboard: {month: "2026-10-01", visible: false, participants: 0,
        categories: ["duty", "reports", "events", "practice"].map((key) => ({key, entries: [], me: null}))},
      get_my_certificates: [],
      verify_certificate: {code: "SFSD-0000-0001", kind: "exam", ref: null, title: "Deputy I. vizsga", subtitle: "Sikeres vizsga",
        issued_at: "2026-10-01T10:00:00Z", valid: true, revoked_at: null, holder: {full_name: "Teszt Elek", badge_number: "1001", faction_rank: "Commander"}},
    },
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.getByText(route.text).first(), route.path).toBeVisible();
    await expect(page.getByText("Váratlan hiba történt"), route.path).toHaveCount(0);
  }

  expect(errors).toEqual([]);
});
