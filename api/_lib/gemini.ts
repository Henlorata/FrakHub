/**
 * Google Gemini through its REST API (generateContent, no SDK), used on the free tier of Google AI
 * Studio. The models are tried in order: one whose free quota is used up, that is overloaded or that
 * does not answer in time passes the request to the next. Each thinks as little as it may (the
 * tasks are rewording, not reasoning; thinking tokens count against maxOutputTokens): "minimal" by
 * default, "model@low" for a model without it (3.7 and 3.8 Flash refuse "minimal" with HTTP 400).
 * Never logs the prompt or the answer.
 */

/**
 * quota: a per-minute limit (try again soon); exhausted: the free daily quota is used up (it starts
 * again at midnight Pacific time, 9:00 in Hungary); blocked: the safety filter refused the text;
 * unavailable: overloaded, too slow, refused or an unusable answer.
 */
export type GeminiFailure = "quota" | "exhausted" | "blocked" | "unavailable";

export class GeminiError extends Error {
  readonly kind: GeminiFailure;

  constructor(kind: GeminiFailure, message: string) {
    super(message);
    this.name = "GeminiError";
    this.kind = kind;
  }
}

export interface GeminiConfig {
  apiKey: string;
  /** Tried in order; "model@level" sets its thinking level. */
  models: string[];
}

export interface GeminiRequest {
  system: string;
  prompt: string;
  /** The answer's JSON shape (responseSchema, OpenAPI subset). */
  schema: Record<string, unknown>;
  temperature: number;
  /** A ceiling, not a cost: only the tokens written count. */
  maxOutputTokens: number;
  /** Time for one model: a slow one passes the request to the next. */
  attemptMs: number;
  /** Whether an answer is usable; an unusable one passes the request to the next model too. */
  accept?: (value: unknown) => boolean;
  /** Time for all attempts together (the function may run 30 s). */
  budgetMs: number;
}

interface GeminiResponse {
  candidates?: {content?: {parts?: {text?: string; thought?: boolean}[]}; finishReason?: string}[];
  promptFeedback?: {blockReason?: string};
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const SAFETY_CATEGORIES = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"];
/** A police report describes crimes and force: only clearly harmful text is refused. */
const SAFETY = SAFETY_CATEGORIES.map((category) => ({category, threshold: "BLOCK_ONLY_HIGH"}));
const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

/**
 * Asks the models in turn for a JSON answer of the given shape; `skipped` says why the earlier ones
 * did not answer. When none does, the error is the last one worth retrying, "exhausted" only when
 * every model's daily quota is used up.
 */
export async function generateJson(config: GeminiConfig, request: GeminiRequest): Promise<{value: unknown; model: string; skipped: string[]}> {
  const deadline = Date.now() + request.budgetMs;
  const failures: GeminiError[] = [];
  for (const entry of config.models) {
    const [model, thinkingLevel = "minimal"] = entry.split("@");
    const left = deadline - Date.now();
    if (left < 2_000) break;
    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-goog-api-key": config.apiKey},
        body: JSON.stringify({
          systemInstruction: {parts: [{text: request.system}]},
          contents: [{role: "user", parts: [{text: request.prompt}]}],
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxOutputTokens,
            responseMimeType: "application/json",
            responseSchema: request.schema,
            thinkingConfig: {thinkingLevel},
          },
          safetySettings: SAFETY,
        }),
        signal: AbortSignal.timeout(Math.min(left, request.attemptMs)),
      });
    } catch (error) {
      failures.push(new GeminiError("unavailable", `${model}: ${error instanceof Error ? error.name : "network"}`));
      continue;
    }
    if (response.status === 429) {
      // The free tier's request limits; the quota id tells a daily one ("...PerDay...") from a per-minute one.
      const daily = /PerDay/.test(await response.text().catch(() => ""));
      failures.push(new GeminiError(daily ? "exhausted" : "quota", `${model}: HTTP 429${daily ? " (daily quota)" : ""}`));
      continue;
    }
    if (response.status >= 500) {
      failures.push(new GeminiError("unavailable", `${model}: HTTP ${response.status}`));
      continue;
    }
    if (!response.ok) {
      // A wrong key, a retired model or a request the API refuses: logged for the operator (no texts).
      const detail = await response.text().catch(() => "");
      console.error(`[gemini] ${model}: HTTP ${response.status} ${detail.replace(/\s+/g, " ").slice(0, 300)}`);
      failures.push(new GeminiError("unavailable", `${model}: HTTP ${response.status}`));
      continue;
    }
    const data = await response.json().catch(() => null) as GeminiResponse | null;
    if (data?.promptFeedback?.blockReason) throw new GeminiError("blocked", `${model}: ${data.promptFeedback.blockReason}`);
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason && BLOCKED.has(candidate.finishReason)) throw new GeminiError("blocked", `${model}: ${candidate.finishReason}`);
    const text = (candidate?.content?.parts ?? []).filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("");
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      failures.push(new GeminiError("unavailable", `${model}: no JSON (${candidate?.finishReason ?? "?"})`));
      continue;
    }
    if (request.accept && !request.accept(value)) {
      failures.push(new GeminiError("unavailable", `${model}: unusable answer`));
      continue;
    }
    return {value, model, skipped: failures.map((failure) => failure.message)};
  }
  throw failures.findLast((failure) => failure.kind !== "exhausted") ?? failures.at(-1) ?? new GeminiError("unavailable", "no model answered in time");
}
