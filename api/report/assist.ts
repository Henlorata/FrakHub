import {
  ASSIST_SCHEMA, ASSIST_SYSTEM, assistOutputLimit, assistPrompt, cleanAssistOutput, keepsTheFacts, parseAssistInput, withReportHints, type AssistResult,
} from "../../shared/report-assist.js";
import {serverEnv} from "../_lib/env.js";
import {GeminiError, generateJson} from "../_lib/gemini.js";
import {handle, HttpError, json, readJsonObject} from "../_lib/http.js";
import {getSupabaseAdmin, requireCaller} from "../_lib/supabase.js";

/** Requests a member may make a day, and all members together (well below the free tier's daily quota). */
const MEMBER_DAILY = 25;
const EVERYONE_DAILY = 400;

/**
 * The report form's AI helper (shared/report-assist.ts): rewords the member's own case description
 * and checks the result in the same request (one request of the allowance and of Gemini's free
 * quota), or only lists what their description lacks. Signed-in members only, within a daily
 * allowance (take_ai_assist). The texts go to Google Gemini and back, and are never stored or logged
 * here; the writer's name and rank are sent, their badge never.
 */
export const POST = handle("report/assist", async (request) => {
  const caller = await requireCaller(request);
  const parsed = parseAssistInput(await readJsonObject(request));
  if ("error" in parsed) throw new HttpError(400, parsed.error);
  const {input} = parsed;

  const gemini = serverEnv.gemini();
  if (!gemini) {
    console.error("[api/report/assist] GEMINI_API_KEY is not set");
    throw new HttpError(503, "Az AI segéd még nincs beállítva.");
  }

  const {data: allowance, error} = await getSupabaseAdmin()
    .rpc("take_ai_assist", {_user: caller.id, _member_limit: MEMBER_DAILY, _overall_limit: EVERYONE_DAILY});
  if (error) throw error;
  const quota = allowance as {ok: boolean; remaining: number; reason?: string};
  if (!quota.ok) {
    throw new HttpError(429, quota.reason === "member"
      ? `Mára elfogyott az AI segéd kerete (${MEMBER_DAILY} kérés naponta). Holnap újra használhatod.`
      : "Mára elfogyott az AI segéd közös kerete. Holnap újra használható.");
  }

  try {
    const started = Date.now();
    const {value, model, skipped} = await generateJson(gemini, {
      system: ASSIST_SYSTEM[input.mode],
      prompt: assistPrompt(input),
      schema: ASSIST_SCHEMA[input.mode],
      // Low, against Gemini 3's advice of 1.0 (loops in long reasoning): at 1.0 the samples of
      // 2026-10-10 gained made-up facts (an admission, a paid fine) and lost real ones; the text is only reworded.
      temperature: 0.2,
      maxOutputTokens: assistOutputLimit(input),
      attemptMs: 15_000,
      budgetMs: 26_000,
      accept: (answer) => {
        const cleaned = cleanAssistOutput(input.mode, answer);
        return cleaned !== null && keepsTheFacts(input, cleaned);
      },
    });
    const output = cleanAssistOutput(input.mode, value);
    if (!output) throw new GeminiError("unavailable", "unusable answer");
    // Which model answered, how fast and why the earlier ones did not (never the texts).
    console.info(`[api/report/assist] ${input.mode}: ${model}, ${Date.now() - started} ms, ${input.codes.length} abbreviations${skipped.length ? `; skipped ${skipped.join(", ")}` : ""}`);
    return json({...withReportHints(input, output), remaining: quota.remaining} satisfies AssistResult);
  } catch (failure) {
    if (!(failure instanceof GeminiError)) throw failure;
    console.error(`[api/report/assist] ${failure.kind}: ${failure.message}`);
    if (failure.kind === "blocked") throw new HttpError(422, "Az AI segéd ezt a szöveget nem dolgozta fel. Fogalmazd át, vagy írd meg magad.");
    if (failure.kind === "exhausted") throw new HttpError(429, "Mára elfogyott az AI segéd ingyenes kerete. Reggel 9 körül újra használható, addig írd meg magad a leírást.");
    if (failure.kind === "quota") throw new HttpError(429, "Az AI segéd most túl sok kérést kapott. Próbáld újra egy perc múlva.");
    throw new HttpError(503, "Az AI segéd most nem érhető el. Próbáld újra később.");
  }
});
