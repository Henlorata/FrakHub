import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const DIRECTORY = {
  me: {address: "john.doe@sfsd.org", name: "John Doe"},
  can_broadcast: true,
  can_external: true,
  offices: [],
  groups: [
    {key: "all", address: "all@sfsd.org", label: "Teljes állomány", allowed: true},
    {key: "iab", address: "internal.affairs.bureau@sfsd.org", label: "Internal Affairs Bureau", allowed: true},
  ],
  members: [{id: "u2", name: "Laura Graves", rank: "Deputy Sheriff II.", badge: "1203", address: "laura.graves@sfsd.org"}],
};

const THREAD = {
  thread: {id: "t1", subject: "Felülvizsgálati kérelem", created_at: "2026-10-07T08:00:00Z", last_message_at: "2026-10-07T08:00:00Z", message_count: 1,
    broadcast: false, iab: true, unread: false, last: null, to: ["internal.affairs.bureau@sfsd.org"]},
  can_reply: true,
  recipients: [{address: "internal.affairs.bureau@sfsd.org", user_id: null, group: "iab"}],
  messages: [{id: "m1", sender_name: "John Doe", sender_address: "john.doe@sfsd.org", sender_kind: "self", to: ["internal.affairs.bureau@sfsd.org"],
    body: "Tisztelt Internal Affairs Bureau!\n\nKérem a vizsgálatot.", created_at: "2026-10-07T08:00:00Z",
    author: {id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", iab_title: null}}],
  iab_staff: null,
  cases: [],
};

test("a member writes a letter to the IAB and reads it in the old public-mails format", async ({page}) => {
  const mock = await mockSupabase(page, {
    rpc: {get_mail_directory: DIRECTORY, get_mailbox: [], send_mail: "t1", get_mail_thread: THREAD},
  });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/mail?new=1");

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Címzett").fill("internal");
  await dialog.getByLabel("Címzett").press("Enter");
  await dialog.getByLabel("Tárgy").fill("Felülvizsgálati kérelem");
  await dialog.locator("textarea").fill("Tisztelt Internal Affairs Bureau!\n\nKérem a vizsgálatot.");
  await dialog.getByRole("button", {name: "Küldés"}).click();

  await expect.poll(() => mock.requests.find((request) => request.name === "send_mail")?.body).toMatchObject({
    _subject: "Felülvizsgálati kérelem", _to: [{kind: "group", key: "iab"}], _as: "self",
  });
  await expect(page).toHaveURL(/box=sent&thread=t1/);
  await expect(page.getByText("internal.affairs.bureau@sfsd.org").first()).toBeVisible();
  await expect(page.getByText("Kérem a vizsgálatot.")).toBeVisible();
  await expect(page.getByText("Válasz mindenkinek")).toBeVisible();
});
