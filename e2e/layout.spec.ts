import {expect, test, type Page} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

/** An unbroken "word" far wider than any column (pasted links, keyboard mashing). */
const LONG = "rsgysdgrrsgysdgr".repeat(24);

const viewer = testProfile({
  faction_rank: "Commander", system_role: "admin", is_bureau_manager: true, division: "MCB",
  division_rank: "Investigator III.", qualifications: ["TB"],
});
const longMember = testProfile({
  id: "44444444-4444-4444-8444-444444444444", full_name: LONG.slice(0, 64), badge_number: "4001",
  faction_rank: "Deputy Sheriff II.", system_role: "user",
});

const data = {
  tables: {
    profiles: [viewer, longMember],
    notifications: [{
      id: "n1", user_id: TEST_USER_ID, title: LONG.slice(0, 160), message: LONG, type: "info", category: "system",
      is_read: false, link: null, actor_id: null, created_at: new Date().toISOString(),
    }],
    vehicle_requests: [{
      id: "v1", user_id: longMember.id, vehicle_type: LONG.slice(0, 60), reason: LONG, status: "pending",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      profiles: {full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II."},
    }],
    fleet_categories: [{id: "other", name: LONG.slice(0, 80), description: LONG.slice(0, 300), unit: null, min_rank: null, tone: "green", sort_order: 1}],
    fleet_vehicles: [{
      id: "fv1", plate: "SFSD-0123456789", model: LONG.slice(0, 60), category_id: "other", game_id: 99999999, station: "Downtown",
      callsign: null, license_name: null, capacity: 2, shared_label: LONG.slice(0, 60), allowed_units: null, min_rank: null,
      is_unmarked: true, registration_required: true, registration_expires_on: null, notes: LONG.slice(0, 500), is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      holders: [{user_id: longMember.id, is_temporary: true, note: LONG.slice(0, 200), assigned_at: new Date().toISOString()}],
    }],
  },
  rpc: {
    get_announcements: [{
      id: "a1", title: LONG.slice(0, 120), content: LONG, type: "info", is_pinned: true, show_author: true,
      created_at: new Date().toISOString(), created_by: TEST_USER_ID, author_name: LONG.slice(0, 64), author_rank: "Commander",
      author_category: "executive", can_delete: true,
    }],
    get_policies: {can_edit: true, members: 2, policies: [{id: "p1", title: LONG.slice(0, 120), category: "general", summary: LONG.slice(0, 300), version: 1,
      requires_ack: true, status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString(), my_ack_version: null,
      acknowledged: 1, draft_changes: false}]},
    get_policy: {id: "p1", title: LONG.slice(0, 120), category: "general", summary: LONG.slice(0, 300), version: 1, requires_ack: true, status: "published",
      sort_order: 10, shown_version: 1, published_at: new Date().toISOString(), change_note: LONG.slice(0, 300), published_by_name: LONG.slice(0, 64),
      my_ack_version: null, body: [{type: "paragraph", content: LONG}], versions: [{version: 1, published_at: new Date().toISOString(),
        change_note: LONG.slice(0, 300), published_by_name: LONG.slice(0, 64)}], draft: null,
      missing: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II.", avatar_url: null}]},
    get_polls: [{id: "poll1", title: LONG.slice(0, 160), description: LONG.slice(0, 1000), audience: "all", anonymous: false, max_choices: 1, results: "live",
      closes_at: new Date(Date.now() + 86_400_000).toISOString(), closed_at: null, created_at: new Date().toISOString(), created_by: TEST_USER_ID,
      created_by_name: LONG.slice(0, 64), open: true, voted: true, can_manage: true, voters: 1, audience_size: 2, results_visible: true,
      options: [{id: "o1", label: LONG.slice(0, 120), votes: 1, mine: true, voters: [{full_name: LONG.slice(0, 64), avatar_url: null}]}]}],
    get_suggestions: {can_respond: true, suggestions: [{id: "i1", title: LONG.slice(0, 120), body: LONG, category: "website", status: "planned",
      response: LONG.slice(0, 1000), responded_at: new Date().toISOString(), created_at: new Date().toISOString(), author_id: longMember.id,
      author: {full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", avatar_url: null}, responded_by_name: LONG.slice(0, 64), votes: 3, voted: false}]},
    get_leaderboard: {month: "2026-10-01", visible: true, participants: 2, categories: ["duty", "reports", "events", "practice"].map((key) => ({key,
      me: {value: 3, place: 2, of: 2}, entries: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II.",
        avatar_url: null, value: 9, place: 1, me: false}, {user_id: TEST_USER_ID, full_name: LONG.slice(0, 64), badge_number: "1", faction_rank: "Commander",
        avatar_url: null, value: 3, place: 2, me: true}]}))},
    get_promotion_board: {criteria: [], exams: [], can_edit_criteria: true, nominations: [], members: [{user_id: longMember.id, full_name: LONG.slice(0, 64),
      badge_number: "4001", faction_rank: "Deputy Sheriff II.", rank_order: 14, division: "TSB", avatar_url: null, next_rank: "Deputy Sheriff III.",
      configured: true, since: "2026-08-01", days_in_rank: 60, missing: 0, eligible: true, on_leave: false, activity_status: "active", nomination: null,
      checks: [{key: "duty", label: LONG.slice(0, 80), value: 12, target: 30, unit: "óra", ok: false}]}]},
    get_trainees: [{user_id: longMember.id, full_name: LONG.slice(0, 64), badge_number: "4001", avatar_url: null, joined_on: "2026-10-01", days: 3,
      mentor: {id: TEST_USER_ID, full_name: LONG.slice(0, 64), faction_rank: "Commander", avatar_url: null}, assigned_at: null, signed_off_at: new Date().toISOString(),
      sign_off_note: LONG.slice(0, 400), signed_off_by_name: LONG.slice(0, 64), is_mentor: true, ready: false,
      checks: [{key: "exam", label: LONG.slice(0, 60), ok: true}], notes: [{id: "note1", body: LONG.slice(0, 400), created_at: new Date().toISOString(),
        author_name: LONG.slice(0, 64)}]}],
    get_mailbox: [{id: "t1", subject: LONG.slice(0, 200), created_at: new Date().toISOString(), last_message_at: new Date().toISOString(), message_count: 2,
      broadcast: true, iab: true, unread: true, to: [`${LONG.slice(0, 60)}@sfsd.org`],
      last: {sender_name: LONG.slice(0, 64), sender_address: `${LONG.slice(0, 80)}@sfsd.org`, snippet: LONG}}],
    get_mail_directory: {me: {address: `${LONG.slice(0, 60)}@sfsd.org`, name: LONG.slice(0, 64)}, can_broadcast: true, can_external: true, offices: [],
      groups: [{key: "all", address: "all@sfsd.org", label: "Teljes állomány", allowed: true}],
      members: [{id: longMember.id, name: LONG.slice(0, 64), rank: "Deputy Sheriff II.", badge: "4001", address: `${LONG.slice(0, 64)}@sfsd.org`}]},
    get_mail_thread: {
      thread: {id: "t1", subject: LONG.slice(0, 200), created_at: new Date().toISOString(), last_message_at: new Date().toISOString(), message_count: 1,
        broadcast: false, iab: true, unread: false, last: null, to: [`${LONG.slice(0, 60)}@sfsd.org`]},
      can_reply: true, recipients: [{address: `${LONG.slice(0, 60)}@sfsd.org`, user_id: longMember.id, group: null}],
      messages: [{id: "m1", sender_name: LONG.slice(0, 64), sender_address: `${LONG.slice(0, 80)}@lspd.org`, sender_kind: "external",
        to: [`${LONG.slice(0, 60)}@sfsd.org`, "internal.affairs.bureau@sfsd.org"], body: LONG, created_at: new Date().toISOString(),
        author: {id: TEST_USER_ID, full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "1", iab_title: null}}],
      iab_staff: [{full_name: LONG.slice(0, 64), title: "agent"}], cases: [{id: "c1", case_number: "IAB-2026-001", title: LONG.slice(0, 160), status: "open"}],
      public: {ref: "SF-2345-6789", kind: "complaint", status: "open", contact: LONG.slice(0, 120)},
    },
    get_iab_overview: {viewer: {iab_title: null, is_lead: true, is_member: false},
      members: [{id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "4001", avatar_url: null, iab_title: "agent"}],
      cases: [{id: "c1", case_number: "IAB-2026-001", title: LONG.slice(0, 160), summary: LONG.slice(0, 600), status: "open", priority: "high", outcome: null,
        opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), closed_at: null, lead: null,
        people: [{user_id: longMember.id, full_name: LONG.slice(0, 64), role: "subject"}], entries: 1, mail: 1}],
      stats: {open: 1, closed_90d: 0, inbox_unread: 1}},
    get_iab_case: {
      case: {id: "c1", case_number: "IAB-2026-001", title: LONG.slice(0, 160), summary: LONG.slice(0, 2000), status: "closed", priority: "high",
        outcome: "sustained", closure: LONG, opened_at: new Date().toISOString(), updated_at: new Date().toISOString(), closed_at: new Date().toISOString(),
        lead: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "4001", avatar_url: null, iab_title: "agent"},
        opened_by: null, closed_by: null},
      people: [{user_id: longMember.id, role: "subject", note: LONG.slice(0, 300), added_at: new Date().toISOString(),
        person: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "4001", avatar_url: null, iab_title: null}}],
      entries: [{id: "e1", kind: "memo", title: LONG.slice(0, 160), body: LONG, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        author: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "4001", avatar_url: null, iab_title: "agent"},
        can_edit: true}],
      mail: [{thread_id: "t1", subject: LONG.slice(0, 200), last_message_at: new Date().toISOString(), message_count: 3}],
      can_edit: true, can_close: true,
    },
    get_site_editor: {content: {hero: {title: LONG.slice(0, 80)}}, updated: {}, posts: [{id: "n1", slug: "x", title: LONG.slice(0, 160), excerpt: LONG.slice(0, 400),
      cover_url: null, category: "press", featured: true, published_at: new Date().toISOString(), author_display: LONG.slice(0, 120), status: "published",
      updated_at: new Date().toISOString(), created_at: new Date().toISOString(), author: LONG.slice(0, 64)}],
      leaders: [{id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Commander", avatar_url: null, tier: 0, hidden: false}]},
    get_public_site: {
      content: {hero: {title: LONG.slice(0, 80), highlight: LONG.slice(0, 80), subtitle: LONG.slice(0, 400)}, about: {lead: LONG.slice(0, 400), text: LONG},
        faq: [{q: LONG.slice(0, 200), a: LONG}], recruitment: {title: LONG.slice(0, 80), requirements: [LONG.slice(0, 200)], steps: [{title: LONG.slice(0, 80), text: LONG}]},
        gallery: [], sections: {}},
      news: [{id: "n1", slug: "x", title: LONG.slice(0, 160), excerpt: LONG.slice(0, 400), cover_url: null, category: "press", featured: true,
        published_at: new Date().toISOString(), author_display: LONG.slice(0, 120)}],
      stats: {members: 48, divisions: {TSB: 28}, cases_closed_year: 37, actions_30d: 0, duty_hours_month: 0, since: 2021},
      leadership: [{full_name: LONG.slice(0, 64), faction_rank: "Commander", avatar_url: null, division: "TSB", bureau_manager: true, bureau_commander: false, tier: 0}],
      recruitment: {open: true}, alert_level: "normal",
    },
    get_public_news: [{id: "n1", slug: "x", title: LONG.slice(0, 160), excerpt: LONG.slice(0, 400), cover_url: null, category: "press", featured: true,
      published_at: new Date().toISOString(), author_display: LONG.slice(0, 120)}],
    get_news_post: {post: {id: "n1", slug: "x", title: LONG.slice(0, 160), excerpt: LONG.slice(0, 400), cover_url: null, category: "press", featured: true,
      published_at: new Date().toISOString(), author_display: LONG.slice(0, 120), status: "published", updated_at: new Date().toISOString(),
      body: [{type: "paragraph", content: [{type: "text", text: LONG, styles: {}}]}]}, newer: null, older: null, related: []},
    get_relationship_graph: {center: "person:p1", truncated: true,
      nodes: [{key: "person:p1", kind: "person", id: "p1", label: LONG.slice(0, 64), alias: LONG.slice(0, 40), status: "wanted"},
        {key: "org:o1", kind: "org", id: "o1", label: LONG.slice(0, 80), title: LONG.slice(0, 40), color: "#dc2626"},
        {key: "case:c1", kind: "case", id: "c1", label: "MCB-2026-001", title: LONG.slice(0, 160), can_open: true},
        {key: "plate:X", kind: "plate", label: LONG.slice(0, 16), title: LONG.slice(0, 120)},
        {key: `address:${LONG.slice(0, 40)}`, kind: "address", label: LONG.slice(0, 200)}],
      edges: [{source: "person:p1", target: "org:o1", label: LONG.slice(0, 60)}, {source: "person:p1", target: "case:c1", label: "suspect"},
        {source: "person:p1", target: "plate:X", label: LONG.slice(0, 60)}, {source: "person:p1", target: `address:${LONG.slice(0, 40)}`, label: "house"}]},
    search_graph_nodes: [],
    get_payslip_document: {month: "2026-09-01", paid: true, paid_at: new Date().toISOString(), closed_at: new Date().toISOString(), tax_percent: 3,
      closed_by: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "4001"},
      member: {id: TEST_USER_ID, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "1"},
      row: {name: LONG.slice(0, 64), rank: "Deputy Sheriff II.", division: "TSB", unit: LONG.slice(0, 40), qualification: LONG.slice(0, 40), duty_minutes: 3125,
        reports: 14, pictures: 3, trained: 2, top_duty: 1, top_report: 2, bonus: 250000, bonus_note: LONG.slice(0, 300), account_number: LONG.slice(0, 40),
        pay: {rank: 9000000, duty: 1500000, unit: 2000000, qualification: 1000000, reports: 7000000, pictures: 300000, training: 2000000, top_duty: 1500000,
          top_report: 1000000, bonus: 250000}, total: 25550000}},
    get_award_document: {kind: "commendation", id: "c1", number: "C1C1C1C1", title: LONG.slice(0, 120), text: LONG, color: null, image_url: null,
      date: new Date().toISOString(), member: {id: TEST_USER_ID, full_name: LONG.slice(0, 64), faction_rank: "Deputy Sheriff II.", badge_number: "1", division: "TSB"},
      issuer: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "4001"},
      head: {id: "u9", full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "1020", title: "Bureau Manager"}},
    get_public_report: {ref: "SF-2345-6789", kind: "complaint", status: "open", subject: LONG.slice(0, 200), created_at: new Date().toISOString(),
      messages: [{id: "m1", mine: true, from: LONG.slice(0, 64), office: false, body: LONG, created_at: new Date().toISOString()},
        {id: "m2", mine: false, from: "Internal Affairs Bureau", office: true, body: LONG, created_at: new Date().toISOString()}]},
    get_case_trash: [{id: "c9", case_number: "SD-001/001/261001", title: LONG.slice(0, 160), status: "open", priority: "high", owner_id: longMember.id,
      owner_name: LONG.slice(0, 64), deleted_at: new Date().toISOString(), deleted_by_name: LONG.slice(0, 64),
      purge_at: new Date(Date.now() + 20 * 86_400_000).toISOString(), evidence: 3, people: 2, warrants: 1}],
    get_review_overview: {period: "2026-Q4", current_period: "2026-Q4", members: [{user_id: longMember.id, full_name: LONG.slice(0, 64),
      faction_rank: "Deputy Sheriff II.", badge_number: "4001", avatar_url: null, division: "TSB", can_write: true, review: null,
      last: {period: "2026-Q3", overall: 4.17, status: "acknowledged"}}]},
    get_reviews: {can_write: false, current_period: "2026-Q4", reviews: [{id: "rv1", user_id: TEST_USER_ID, period: "2026-Q4",
      scores: {activity: 4, reports: 5, teamwork: 4, conduct: 5, knowledge: 3, initiative: 4}, overall: 4.17, strengths: LONG, improvements: LONG,
      goals: LONG, status: "shared", shared_at: new Date().toISOString(), acknowledged_at: null, member_comment: null, created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), member: null,
      reviewer: {id: longMember.id, full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "4001", avatar_url: null},
      can_edit: false, can_delete: false, can_acknowledge: true}]},
    get_events: [{id: "ev1", title: LONG.slice(0, 120), description: LONG, kind: "patrol", starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      ends_at: null, location: LONG.slice(0, 120), audience: "all", rsvp: true, cancelled_at: null, created_at: new Date().toISOString(),
      created_by: longMember.id, created_by_name: LONG.slice(0, 64), can_manage: true, my_status: null, my_note: null,
      counts: {going: 0, maybe: 0, absent: 0}, responses: [], operation: {roles: 1, assigned: 1, my_role: LONG.slice(0, 60), report: false}}],
    get_event_operation: {event_id: "ev1", objective: LONG, situation: LONG, execution: LONG, radio_channel: LONG.slice(0, 40),
      rally_point: LONG.slice(0, 160), rally_at: null, updated_at: new Date().toISOString(), updated_by_name: LONG.slice(0, 64), case: null, report: null,
      roles: [{id: "r1", name: LONG.slice(0, 60), task: LONG.slice(0, 600), callsign: LONG.slice(0, 30), sort_order: 1, members: [{user_id: TEST_USER_ID,
        full_name: LONG.slice(0, 64), faction_rank: "Commander", badge_number: "1", avatar_url: null, callsign: LONG.slice(0, 30), note: LONG.slice(0, 200),
        vehicle: {id: "v1", plate: LONG.slice(0, 16), model: LONG.slice(0, 60), callsign: null}}]}]},
    verify_certificate: {code: "SFSD-0000-0001", kind: "scenario", ref: null, title: LONG.slice(0, 120), subtitle: LONG.slice(0, 80),
      issued_at: new Date().toISOString(), valid: true, revoked_at: null, holder: {full_name: LONG.slice(0, 64), badge_number: "4001", faction_rank: "Deputy Sheriff II."}},
  },
};

/** Nothing may push the page wider than the window. */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
}

test.describe("long unbroken text", () => {
  test("never pushes a dialog out of the window", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [viewer]}});
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", {name: "Új hirdetmény"}).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Rövid, beszédes cím").fill(LONG.slice(0, 120));
    await dialog.getByPlaceholder("Írd ide az üzenetet…").fill(LONG);

    const viewport = page.viewportSize()!;
    const dialogBox = (await dialog.boundingBox())!;
    const textareaBox = (await dialog.locator("textarea").boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
    expect(textareaBox.x + textareaBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
    await expect(dialog.getByRole("button", {name: "Közzététel"})).toBeInViewport();
  });

  for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
    test(`wraps in feeds, lists and profiles (${viewport.width}px)`, async ({page}) => {
      // Visits every page with long text, so it takes longer than one test usually may.
      test.slow();
      await page.setViewportSize(viewport);
      await mockSupabase(page, data);
      await login(page);
      await expect(page).toHaveURL(/\/dashboard$/);

      for (const path of ["/dashboard", "/notifications", "/logistics", "/logistics?tab=fleet", "/logistics?tab=fleet&view=usage",
        "/logistics/fleet/fv1", "/hr", "/hr?view=org", "/profile", "/events", "/changelog", "/mcb/templates", "/policies", "/community",
        "/community?tab=ideas", "/leaderboard", "/hr?tab=promotions", "/hr?tab=trainees", "/permissions", "/certificates/SFSD-0000-0001",
        "/mail", "/mail?thread=t1", "/iab", "/iab/case/c1", "/iab/case/c1/print", "/sib", "/sib?tab=page", "/home", "/news", "/news/x",
        "/contact", "/mcb/graph?node=person%3Ap1", "/finance/payslip/2026-09", "/hr/award/commendation/c1", "/mcb/trash", "/hr?tab=reviews",
        "/profile?tab=reviews"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalOverflow(page, path);
      }

      // A report from the public page, opened with its tracking code.
      await page.goto("/contact?view=track");
      await page.getByLabel("Követőkód").fill("SF-2345-6789-ABCD-EFGH");
      await page.getByRole("button", {name: "Megnyitás"}).click();
      await expect(page.getByText("Internal Affairs Bureau").first()).toBeVisible();
      await expectNoHorizontalOverflow(page, "/contact?view=track");

      // An operation plan with long names, and the editor of the same plan.
      await page.goto("/events?id=ev1&plan=1");
      const plan = page.getByRole("dialog");
      await expect(plan.getByText("A te szereped")).toBeVisible();
      await expectNoHorizontalOverflow(page, "operation plan");
      const planBox = (await plan.boundingBox())!;
      expect(planBox.x + planBox.width).toBeLessThanOrEqual(viewport.width);
      await plan.getByRole("tab", {name: "Szerkesztés"}).click();
      await expect(plan.getByLabel("Cél")).toBeVisible();
      await expectNoHorizontalOverflow(page, "operation plan editor");
    });
  }
});
