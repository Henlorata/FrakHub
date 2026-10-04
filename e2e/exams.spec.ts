import {expect, test} from "@playwright/test";
import {mockSupabase} from "./support/mock-supabase";

const EXAM_ID = "44444444-4444-4444-8444-444444444444";

// The REST mock serves stored rows as they are, so the embedded questions are part of the row.
const exam = {
  id: EXAM_ID, title: "TGF Felvételi", description: "Teszt vizsga", type: "trainee", division: null,
  time_limit_minutes: 30, passing_percentage: 70, is_public: true, is_active: true, is_invitation_only: false,
  allow_sharing: true, min_days_in_rank: 0, required_rank: null,
  exam_questions: [
    {id: "q1", exam_id: EXAM_ID, question_text: "Mi a Discord neved?", question_type: "text", points: 0, order_index: 0, is_required: true, page_number: 1, exam_options: []},
    {id: "q2", exam_id: EXAM_ID, question_text: "Mit jelent a Code 3?", question_type: "single_choice", points: 2, order_index: 1, is_required: true, page_number: 1,
      exam_options: [{id: "o1", question_id: "q2", option_text: "Megkülönböztető jelzés"}, {id: "o2", question_id: "q2", option_text: "Járőrözés"}]},
  ],
};

test.describe("public exam", () => {
  test("a guest submits through the server and gets a claim code", async ({page}) => {
    const mock = await mockSupabase(page, {
      tables: {exams: [exam]},
      rpc: {submit_exam: {id: "55555555-5555-4555-8555-555555555555", claim_token: "TR-TEST-CODE"}},
    });
    await page.goto(`/exam/public/${EXAM_ID}`);
    await page.getByPlaceholder("TELJES IC NÉV...").fill("Vendég Vilmos");
    await page.getByRole("button", {name: /SZIMULÁCIÓ INDÍTÁSA/}).click();

    // Unscored questions are labelled for the candidate.
    await expect(page.getByText("NEM PONTOZOTT")).toBeVisible();
    await expect(page.getByText("2 PONT")).toBeVisible();

    await page.getByPlaceholder("Írd ide a válaszod...").fill("vilmos#1234");
    await page.getByText("Megkülönböztető jelzés").click();
    await page.getByRole("button", {name: /VIZSGA BEFEJEZÉSE/}).click();
    await page.getByRole("button", {name: /IGEN, LEADÁS/}).click();

    await expect(page.getByText("TR-TEST-CODE")).toBeVisible();
    expect(mock.count("rpc", "submit_exam")).toBe(1);
    // Nothing is written to the tables directly any more.
    expect(mock.requests.some((r) => r.kind === "rest" && r.method === "POST")).toBe(false);
    const submit = mock.requests.find((r) => r.name === "submit_exam");
    expect(submit).toBeTruthy();
  });
});
