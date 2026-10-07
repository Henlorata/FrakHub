import {expect, test} from "@playwright/test";
import {mockSupabase} from "./support/mock-supabase";

const CODE = "SF-2345-6789-ABCD-EFGH";

const REPORT = {
  ref: "SF-2345-6789", kind: "complaint", status: "open", subject: "Durva igazoltatás", created_at: "2026-10-07T08:00:00Z",
  messages: [
    {id: "m1", mine: true, from: "Carl Johnson", office: false, body: "Tegnap este egy deputy durván igazoltatott.", created_at: "2026-10-07T08:00:00Z"},
    {id: "m2", mine: false, from: "Internal Affairs Bureau", office: true, body: "Köszönjük, kivizsgáljuk.", created_at: "2026-10-07T09:00:00Z"},
  ],
};

test("a visitor writes a complaint without any e-mail and follows it with the tracking code", async ({page}) => {
  const mock = await mockSupabase(page, {rpc: {submit_public_report: {code: CODE, ref: "SF-2345-6789"}, get_public_report: REPORT}});
  await page.goto("/contact");

  await page.getByRole("button", {name: /Panasz/}).click();
  await page.getByPlaceholder("pl. John Smith").fill("Carl Johnson");
  await page.getByPlaceholder("pl. Panasz egy igazoltatás miatt").fill("Durva igazoltatás");
  await page.locator("textarea").fill("Tegnap este egy deputy durván igazoltatott.");
  await page.getByRole("button", {name: "Küldés"}).click();

  await expect(page.getByText(CODE)).toBeVisible();
  const body = mock.requests.find((request) => request.name === "submit_public_report")?.body ?? {};
  expect(body).toMatchObject({_kind: "complaint", _subject: "Durva igazoltatás", _name: "Carl Johnson", _contact: null, _trap: null});
  expect(typeof body._elapsed).toBe("number");
  expect(Object.keys(body).some((key) => /mail/i.test(key))).toBe(false);

  await page.getByRole("button", {name: /Bejelentés megnyitása/}).click();
  await expect(page.getByText("Köszönjük, kivizsgáljuk.")).toBeVisible();
  await expect(page.getByText("Válaszoltak")).toBeVisible();
  expect(mock.requests.find((request) => request.name === "get_public_report")?.body).toEqual({_code: CODE});

  // The code is kept on this device.
  await page.goto("/contact?view=track");
  await expect(page.getByText("Ezen az eszközön", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: /Durva igazoltatás/})).toBeVisible();
});
