import {expect, test} from "@playwright/test";
import {login, mockSupabase, testProfile} from "./support/mock-supabase";

/** A freshly accepted trainee: links the admission exam, reads the rules, then the basic training starts. */
test.describe("onboarding", () => {
  test("a trainee links the exam, enters service and is offered the basic training", async ({page}) => {
    const trainee = testProfile({faction_rank: "Deputy Sheriff Trainee", system_role: "user", onboarding_completed: false, division: "TSB"});
    const mock = await mockSupabase(page, {
      tables: {profiles: [trainee], training_progress: []},
      rpc: {
        claim_exam_submission: {success: true, message: "Vizsga csatolva."},
        complete_onboarding: () => {
          trainee.onboarding_completed = true;
          return null;
        },
      },
    });
    await login(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", {name: /Gratulálunk/})).toBeVisible();

    // The finish button waits for the exam and the rules.
    const enter = page.getByRole("button", {name: /Szolgálatba lépek/});
    await expect(enter).toBeDisabled();

    await page.getByLabel("Vizsgakód").fill("tr7k2mq9xd");
    await expect(page.getByLabel("Vizsgakód")).toHaveValue("TR-7K2M-Q9XD");
    await page.getByRole("button", {name: "Csatolás"}).click();
    await expect(page.getByText("Összekapcsolva")).toBeVisible();
    expect(mock.requests.find((request) => request.name === "claim_exam_submission")?.body).toEqual({_token: "TR-7K2M-Q9XD"});

    await page.getByText("Elolvastam és megértettem.").click();
    await enter.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("[data-tour-overlay]").getByRole("heading", {name: "Alapképzés"})).toBeVisible();
  });

  test("the practice corner works while waiting", async ({page}) => {
    await mockSupabase(page, {
      tables: {profiles: [testProfile({faction_rank: "Deputy Sheriff Trainee", system_role: "user", onboarding_completed: false})]},
    });
    await login(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByText("Készülj, amíg vársz")).toBeVisible();
    // One of the four answers is right: any click gives feedback and moves the counter.
    const answers = page.locator("[data-quiz-option]");
    await expect(answers).toHaveCount(4);
    await answers.first().click();
    await expect(page.locator("[data-quiz-score]")).toHaveText(/^[01]\/1$/);
  });
});
