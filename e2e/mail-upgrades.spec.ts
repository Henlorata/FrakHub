import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID} from "./support/mock-supabase";

const DIRECTORY = {
  me: {address: "john.doe@sfsd.org", name: "John Doe"},
  can_broadcast: true, can_external: false, offices: [],
  groups: [{key: "all", address: "all@sfsd.org", label: "Teljes állomány", allowed: true}],
  members: [{id: "u2", name: "Laura Graves", rank: "Deputy Sheriff II.", badge: "1203", address: "laura.graves@sfsd.org"}],
};

const ITEM = {
  id: "t1", subject: "Kikötői razzia", created_at: "2026-10-07T08:00:00Z", last_message_at: "2026-10-07T08:00:00Z", message_count: 1,
  broadcast: true, iab: false, unread: false, to: ["all@sfsd.org"],
  last: {sender_name: "John Doe", sender_address: "john.doe@sfsd.org", snippet: "Holnap este razzia a kikötőben."},
};

const THREAD = {
  thread: ITEM, can_reply: true, receipts: {total: 12, read: 8},
  recipients: [{address: "all@sfsd.org", user_id: null, group: "all"}],
  messages: [{id: "m1", sender_name: "John Doe", sender_address: "john.doe@sfsd.org", sender_kind: "self", to: ["all@sfsd.org"],
    body: "Holnap este razzia a kikötőben, mindenki legyen ott.", created_at: "2026-10-07T08:00:00Z",
    author: {id: TEST_USER_ID, full_name: "John Doe", faction_rank: "Sergeant I.", badge_number: "1192", iab_title: null}}],
  iab_staff: null, cases: [],
};

test.describe("mail upgrades", () => {
  test("members search their letters", async ({page}) => {
    const mock = await mockSupabase(page, {
      rpc: {get_mail_directory: DIRECTORY, get_mailbox: [], search_mail: [{...ITEM, match: "Holnap este razzia a kikötőben, mindenki legyen ott."}]},
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mail");

    await page.getByLabel("Keresés a levelekben").fill("razzia");
    await expect(page.getByText("Keresés: 1 találat")).toBeVisible();
    await expect(page.getByText(/mindenki legyen ott/)).toBeVisible();
    expect(mock.requests.filter((request) => request.name === "search_mail").at(-1)?.body).toEqual({_query: "razzia", _limit: 30});
  });

  test("the writer sees who has read a letter to everyone", async ({page}) => {
    await mockSupabase(page, {
      rpc: {
        get_mail_directory: DIRECTORY, get_mailbox: [ITEM], get_mail_thread: THREAD,
        get_mail_receipts: {total: 12, read: 8, last_message_at: ITEM.last_message_at, readers: [
          {user_id: "u2", full_name: "Laura Graves", faction_rank: "Deputy Sheriff II.", badge_number: "1203", avatar_url: null, read_at: "2026-10-07T09:00:00Z"},
          {user_id: "u3", full_name: "Deputy Dénes", faction_rank: "Deputy Sheriff I.", badge_number: "1300", avatar_url: null, read_at: null},
        ]},
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mail?thread=t1");

    await page.getByRole("button", {name: "Olvasta: 8/12"}).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("8 / 12 olvasó megnyitotta")).toBeVisible();
    await expect(dialog.getByText("Laura Graves")).toBeVisible();
    await expect(dialog.getByText("Még nem nyitotta meg (1)")).toBeVisible();
  });

  test("a template fills the letter with the recipient's and the writer's data", async ({page}) => {
    await mockSupabase(page, {
      rpc: {
        get_mail_directory: DIRECTORY, get_mailbox: [],
        get_mail_templates: [{id: "tp1", title: "Előléptetés", subject: "Előléptetés", shared: true, mine: false, can_edit: true, updated_at: ITEM.created_at,
          body: "Tisztelt {{címzett_rang}} {{címzett}}!\n\nGratulálunk.\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}"}],
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mail?new=1");

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Címzett").fill("laura");
    await dialog.getByLabel("Címzett").press("Enter");
    await dialog.getByRole("button", {name: "Sablon"}).click();
    await page.getByRole("menuitem", {name: "Előléptetés"}).click();
    await expect(dialog.getByLabel("Tárgy")).toHaveValue("Előléptetés");
    await expect(dialog.locator("textarea")).toHaveValue("Tisztelt Deputy Sheriff II. Laura Graves!\n\nGratulálunk.\n\nTisztelettel:\nJohn Doe\nSergeant I.");
  });
});
