import {expect, test} from "@playwright/test";
import {login, mockSupabase, TEST_USER_ID, testProfile} from "./support/mock-supabase";

const lead = testProfile({
  faction_rank: "Commander", system_role: "admin", division: "MCB", division_rank: "Investigator III.", is_bureau_manager: true,
});

const informant = {
  id: "i1", codename: "HOLLÓ", real_name: "Carl Johnson", suspect_id: null, handler_id: TEST_USER_ID, reliability: 4, status: "active",
  contact: null, notes: null, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z",
  handler: {full_name: "John Doe", badge_number: "1192", avatar_url: null}, suspect: null, contacts: [], can_manage: true,
};

const LONG_TITLE = "Fegyverkereskedelem a kikötőben és a hozzá kapcsolódó pénzmosási hálózat felderítése a Grove Street környékén";
const longCase = {
  id: "c1", case_number: "MCB-2026-014", title: LONG_TITLE, description: null, status: "open", priority: "high", category: null,
  created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z", closed_at: null, owner_id: TEST_USER_ID, owner_name: "John Doe",
  owner_badge: "1192", owner_avatar: null, evidence: 0, people: 0, collaborators: 0, warrants_pending: 0, warrants_active: 0,
  my_role: "owner", can_open: true,
};

test.describe("informant meeting", () => {
  for (const viewport of [{width: 1280, height: 800}, {width: 390, height: 844}]) {
    test(`a long case title stays inside its field (${viewport.width}px)`, async ({page}) => {
      await page.setViewportSize(viewport);
      await mockSupabase(page, {
        tables: {profiles: [lead]},
        rpc: {get_informants: {is_lead: true, informants: [informant]}, get_case_list: [longCase]},
      });
      await login(page);
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto("/mcb/informants");

      await page.getByRole("button", {name: "Találkozó", exact: true}).click();
      const dialog = page.getByRole("dialog");
      const trigger = dialog.getByRole("combobox", {name: "Akta (nem kötelező)"});
      await trigger.click();
      const listbox = page.getByRole("listbox");
      const option = listbox.getByRole("option", {name: /MCB-2026-014/});
      await expect(option).toBeVisible();
      // The list fits the window too.
      const listBox = (await listbox.boundingBox())!;
      expect(listBox.x).toBeGreaterThanOrEqual(0);
      expect(listBox.x + listBox.width).toBeLessThanOrEqual(viewport.width);
      await option.click();
      await expect(trigger).toContainText("MCB-2026-014");

      const dialogBox = (await dialog.boundingBox())!;
      const triggerBox = (await trigger.boundingBox())!;
      const payment = dialog.getByLabel("Kifizetés ($)");
      const paymentBox = (await payment.boundingBox())!;
      expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
      // Side by side the field ends before the amount; stacked on a phone it ends above it.
      if (paymentBox.y < triggerBox.y + triggerBox.height) expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(paymentBox.x);
      // The title is cut short with an ellipsis, not spilled over.
      expect(await trigger.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

      await payment.click();
      await page.keyboard.type("1500");
      await expect(payment).toHaveValue("1500");
    });
  }
});
