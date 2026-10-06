import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const policy = {
  id: "p1", title: "Járműhasználati szabályzat", category: "vehicles", summary: "Ki, mikor és hogyan használhatja a járműveket.", version: 2,
  requires_ack: true, status: "published", published_at: inHours(-48), updated_at: inHours(-48), my_ack_version: 1, acknowledged: null, draft_changes: null,
};
const policyDetail = (version: number | null) => ({
  ...policy, sort_order: 10, shown_version: version ?? 2, change_note: "Új szabály az üldözésről", published_by_name: "Teszt Elek",
  body: version === 1
    ? [{type: "paragraph", content: "Szolgálati járművet csak szolgálatban lehet vezetni."}]
    : [{type: "paragraph", content: "Szolgálati járművet csak szolgálatban lehet vezetni."}, {type: "paragraph", content: "Üldözésben legfeljebb három egység vesz részt."}],
  versions: [{version: 2, published_at: inHours(-48), change_note: "Új szabály az üldözésről", published_by_name: "Teszt Elek"},
    {version: 1, published_at: inHours(-400), change_note: "Első kiadás", published_by_name: "Teszt Elek"}],
  draft: null, missing: null,
});

const poll = {
  id: "poll1", title: "Melyik estén legyen a gyűlés?", description: null, audience: "all", anonymous: true, max_choices: 1, results: "after_vote",
  closes_at: inHours(48), closed_at: null, created_at: inHours(-2), created_by: "x", created_by_name: "Teszt Elek", open: true, voted: false,
  can_manage: false, voters: 3, audience_size: 10, results_visible: false,
  options: [{id: "o1", label: "Kedd", votes: null, mine: null, voters: null}, {id: "o2", label: "Csütörtök", votes: null, mine: null, voters: null}],
};

test.describe("community", () => {
  test("a changed must-read policy asks again, shows what changed and records the acknowledgement", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_policies: {can_edit: false, members: 10, policies: [policy]},
        get_policy: (args: {_version: number | null}) => policyDetail(args._version),
        acknowledge_policy: {version: 2, acknowledged_at: inHours(0)},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/policies");

    await expect(page.getByText(/kötelező szabályzat vár rád/)).toBeVisible();
    const reader = page.locator('[data-tour="policy-reader"]');
    await expect(reader.getByRole("heading", {name: "Járműhasználati szabályzat"})).toBeVisible();
    await expect(reader.getByText(/Egy korábbi változatot \(v1\) már elolvastál/)).toBeVisible();

    await reader.getByRole("button", {name: "Mi változott?"}).click();
    const diff = page.getByRole("dialog");
    await expect(diff.getByText("Üldözésben legfeljebb három egység vesz részt.")).toBeVisible();
    await expect(diff.getByText(/Sorok: 1 új \(/)).toBeVisible();
    // The version on screen (v2) is reused; only v1 is read for the comparison.
    expect(mock.requests.filter((request) => request.name === "get_policy").map((request) => (request.body as {_version: number | null})._version))
      .toEqual([null, 1]);
    await page.keyboard.press("Escape");

    await reader.getByRole("button", {name: /Elolvastam és megértettem/}).click();
    await expect(reader.getByText(/Elolvastad és megértetted \(v2\)/)).toBeVisible();
    expect(mock.requests.find((request) => request.name === "acknowledge_policy")?.body).toMatchObject({_id: "p1"});
    // The list and the policy come from RPCs only (the tables are not readable directly).
    expect(mock.requests.filter((request) => request.kind === "rest" && request.name.startsWith("polic"))).toHaveLength(0);
  });

  test("an anonymous poll takes one final vote; its results show after voting", async ({page}) => {
    let voted = false;
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"})]},
      rpc: {
        get_polls: () => [voted ? {...poll, voted: true, voters: 4, results_visible: true,
          options: [{id: "o1", label: "Kedd", votes: 1, mine: null, voters: null}, {id: "o2", label: "Csütörtök", votes: 3, mine: null, voters: null}]} : poll],
        cast_vote: () => {
          voted = true;
          return null;
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/community");

    const card = page.locator("#poll-poll1");
    await expect(card.getByText("Névtelen")).toBeVisible();
    await expect(card.getByRole("button", {name: "Szavazok"})).toBeDisabled();
    await card.getByRole("radio", {name: "Csütörtök"}).click();
    await card.getByRole("button", {name: "Szavazok"}).click();
    await expect(card.getByText("75%")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "cast_vote")?.body).toMatchObject({_poll_id: "poll1", _option_ids: ["o2"]});
    // Members do not start polls for everyone.
    await expect(page.getByRole("button", {name: /Új szavazás/})).toHaveCount(0);
  });

  test("ideas are upvoted (not one's own) and anonymous feedback is sent without a name", async ({page}) => {
    const me = testProfile({faction_rank: "Deputy Sheriff II.", system_role: "user"});
    const idea = (id: string, author: string, votes: number) => ({
      id, title: id === "i1" ? "Havi lőtéri edzés" : "Saját ötletem", body: "Részletek az ötletről, legalább tíz karakter.", category: "training",
      status: "new", response: null, responded_at: null, created_at: inHours(-30), author_id: author,
      author: {full_name: author === me.id ? me.full_name : "Más Tag", faction_rank: "Deputy Sheriff I.", avatar_url: null}, responded_by_name: null, votes, voted: false,
    });
    const mock = await mockSupabase(page, {
      tables: {profiles: [me]},
      rpc: {
        get_suggestions: {can_respond: false, suggestions: [idea("i1", "other", 4), idea("i2", String(me.id), 1)]},
        toggle_suggestion_vote: {votes: 5, voted: true},
        get_my_feedback: {blocked_until: null, sent_this_week: 0, reports: []},
        submit_feedback: {id: "f1"},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/community?tab=ideas");

    await expect(page.getByRole("button", {name: /A saját ötletedre nem szavazhatsz/})).toBeDisabled();
    await page.getByRole("button", {name: /Támogatom/}).click();
    await expect(page.getByRole("button", {name: /Szavazat visszavonása/})).toContainText("5");
    expect(mock.requests.find((request) => request.name === "toggle_suggestion_vote")?.body).toMatchObject({_id: "i1"});

    await page.goto("/community?tab=feedback");
    await expect(page.getByText(/senki – a vezetőség sem – látja, ki írta/)).toBeVisible();
    await page.getByLabel("Üzenet").fill("A heti gyűlések túl későn kezdődnek, sokan nem érnek oda.");
    await page.getByRole("button", {name: /Névtelen küldés/}).click();
    await expect(page.getByText("Névtelen visszajelzés elküldve.")).toBeVisible();
    const sent = mock.requests.find((request) => request.name === "submit_feedback")?.body;
    expect(sent).toMatchObject({_recipient: "command", _category: "idea"});
    expect(JSON.stringify(sent)).not.toContain(String(me.id));
  });

  test("the readers of anonymous feedback land on the inbox, their own reports one tab away", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Captain II.", system_role: "admin"})]},
      rpc: {
        get_feedback_inbox: [{id: "r1", recipient: "command", category: "idea", body: "A gyűlések túl későn kezdődnek, korábban kellene.", status: "new",
          created_at: inHours(-3), updated_at: inHours(-3), messages: [], reporter_reports: 1, blocked_until: null}],
        get_my_feedback: {blocked_until: null, sent_this_week: 0, reports: []},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/community?tab=feedback");
    await expect(page.getByText("A gyűlések túl későn kezdődnek, korábban kellene.")).toBeVisible();
    expect(mock.count("rpc", "get_my_feedback")).toBe(0);
    await page.goto("/community?tab=feedback&box=mine");
    await expect(page.getByText(/senki – a vezetőség sem – látja, ki írta/)).toBeVisible();
  });
});
