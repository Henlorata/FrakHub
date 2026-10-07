import {expect, test, type Request} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

// A 1x1 PNG: the browser compresses it like any picture before the upload.
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const picture = {name: "foto.png", mimeType: "image/png", buffer: PIXEL};

/** The text fields of a multipart upload (the file part left out). */
function formFields(request: Request): Record<string, string> {
  const body = request.postDataBuffer()?.toString("latin1") ?? "";
  const fields: Record<string, string> = {};
  for (const match of body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)) fields[match[1]] = match[2];
  return fields;
}

const mcbLead = testProfile({faction_rank: "Commander", system_role: "admin", division: "MCB", division_rank: "Investigator III.", is_bureau_manager: true});

test.describe("picture uploads", () => {
  test("a person's photo goes up with the avatar preset into its own folder", async ({page}) => {
    await mockSupabase(page, {tables: {profiles: [mcbLead], suspects: []}});
    const uploads: Record<string, string>[] = [];
    await page.route("https://api.cloudinary.com/**", (route) => {
      uploads.push({url: route.request().url(), ...formFields(route.request())});
      return route.fulfill({json: {secure_url: "https://res.cloudinary.com/e2e-cloud/image/upload/v1/mugshots/foto.webp"}});
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/mcb/suspects");
    await page.getByRole("button", {name: "Új személy"}).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Teljes név").fill("Big Smoke");
    await dialog.locator("input[type=file]").setInputFiles(picture);
    await dialog.getByRole("button", {name: "Adatlap mentése"}).click();
    await expect(page.getByText("Adatlap létrehozva.")).toBeVisible();

    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toContain("/v1_1/e2e-cloud/image/upload");
    // The preset of the profile pictures (VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET in the e2e build).
    expect(uploads[0].upload_preset).toBe("e2e-avatars");
    expect(uploads[0].folder).toBe("mugshots");
  });

  test("a missing upload preset is reported in Hungarian", async ({page}) => {
    await mockSupabase(page);
    await page.route("https://api.cloudinary.com/**", (route) =>
      route.fulfill({status: 400, json: {error: {message: "Upload preset not found"}}}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/profile?tab=settings");
    await page.locator("input[type=file][accept='image/*']").first().setInputFiles(picture);
    await expect(page.getByText(/A képfeltöltés nincs beállítva: a\(z\) „e2e-avatars” feltöltési beállítás/)).toBeVisible();
  });
});
