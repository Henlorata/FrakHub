import {expect, test} from "@playwright/test";
import {GeminiError, generateJson} from "../api/_lib/gemini";

/** The Gemini client against a stubbed fetch: the request it builds, the fallback and the failures. */
type Answer = {status: number; body?: unknown} | "hang";

async function run(answers: Record<string, Answer>, models = ["model-a", "model-b"], attemptMs = 10_000) {
  const calls: {url: string; init: RequestInit}[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({url, init: init ?? {}});
    const answer = answers[/\/models\/([^:]+):generateContent$/.exec(url)?.[1] ?? "?"] ?? {status: 503};
    // A model that never answers: only the client's timeout ends the request.
    if (answer === "hang") return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    return new Response(answer.body === undefined ? "" : JSON.stringify(answer.body), {status: answer.status, headers: {"Content-Type": "application/json"}});
  }) as typeof fetch;
  try {
    const result = await generateJson({apiKey: "test-key", models}, {
      system: "Rendszer", prompt: "Adatok", schema: {type: "OBJECT"}, temperature: 0.3, maxOutputTokens: 512, attemptMs, budgetMs: 10_000,
    });
    return {result, calls};
  } catch (error) {
    return {error, calls};
  } finally {
    globalThis.fetch = original;
  }
}

const ok = (value: unknown, extra: Record<string, unknown> = {}) => ({
  status: 200,
  body: {candidates: [{content: {parts: [{text: "gondolkodom", thought: true}, {text: JSON.stringify(value)}]}, finishReason: "STOP", ...extra}]},
});

test.describe("Gemini client", () => {
  test("sends the instructions, the schema and the key in a header; reads the answer without the thoughts", async () => {
    const {result, calls} = await run({"model-a": ok({text: "Szöveg", missing: []})});
    expect(result).toEqual({value: {text: "Szöveg", missing: []}, model: "model-a", skipped: []});
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/model-a:generateContent");
    expect(new Headers(calls[0].init.headers).get("x-goog-api-key")).toBe("test-key");
    expect(calls[0].url).not.toContain("test-key");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.systemInstruction).toEqual({parts: [{text: "Rendszer"}]});
    expect(body.contents).toEqual([{role: "user", parts: [{text: "Adatok"}]}]);
    expect(body.generationConfig).toEqual({
      temperature: 0.3, maxOutputTokens: 512, responseMimeType: "application/json", responseSchema: {type: "OBJECT"}, thinkingConfig: {thinkingLevel: "minimal"},
    });
    expect(body.safetySettings.every((setting: {threshold: string}) => setting.threshold === "BLOCK_ONLY_HIGH")).toBe(true);
  });

  test("an answer the caller cannot use passes the request on", async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const text = String(input).includes("/model-a:") ? "[HIÁNYZIK: a helyszín]" : "Megállítottam a járművet.";
      return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify({text, missing: []})}]}, finishReason: "STOP"}]}),
        {status: 200, headers: {"Content-Type": "application/json"}});
    }) as typeof fetch;
    try {
      const result = await generateJson({apiKey: "test-key", models: ["model-a", "model-b"]}, {
        system: "Rendszer", prompt: "Adatok", schema: {type: "OBJECT"}, temperature: 0.3, maxOutputTokens: 512, attemptMs: 5000, budgetMs: 10_000,
        accept: (value) => !String((value as {text: string}).text).startsWith("[HIÁNYZIK"),
      });
      expect(result).toEqual({value: {text: "Megállítottam a járművet.", missing: []}, model: "model-b", skipped: ["model-a: unusable answer"]});
      expect(urls).toHaveLength(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("a model that does not answer in time passes the request on; model@level sets its thinking", async () => {
    const {result, calls} = await run({"model-a": "hang", "model-b": ok({missing: []})}, ["model-a", "model-b@low"], 200);
    expect(result).toMatchObject({value: {missing: []}, model: "model-b"});
    expect(calls[1].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/model-b:generateContent");
    expect(calls.map((call) => JSON.parse(String(call.init.body)).generationConfig.thinkingConfig)).toEqual([{thinkingLevel: "minimal"}, {thinkingLevel: "low"}]);
  });

  test("a used-up, overloaded or refusing model passes the request to the next one", async () => {
    for (const status of [429, 500, 503, 400, 404]) {
      const {result, calls} = await run({"model-a": {status}, "model-b": ok({missing: ["a helyszín"]})});
      expect(result, `HTTP ${status}`).toEqual({value: {missing: ["a helyszín"]}, model: "model-b", skipped: [`model-a: HTTP ${status}`]});
      expect(calls).toHaveLength(2);
    }
  });

  test("a blocked text stops at once; nothing answering is reported as unavailable or quota", async () => {
    let outcome = await run({"model-a": ok({}, {finishReason: "SAFETY"}), "model-b": ok({missing: []})});
    expect(outcome.error).toBeInstanceOf(GeminiError);
    expect((outcome.error as GeminiError).kind).toBe("blocked");
    expect(outcome.calls).toHaveLength(1);

    outcome = await run({"model-a": {status: 200, body: {promptFeedback: {blockReason: "PROHIBITED_CONTENT"}}}});
    expect((outcome.error as GeminiError).kind).toBe("blocked");

    outcome = await run({"model-a": {status: 503}, "model-b": {status: 503}});
    expect((outcome.error as GeminiError).kind).toBe("unavailable");

    outcome = await run({"model-a": {status: 503}, "model-b": {status: 429}});
    expect((outcome.error as GeminiError).kind).toBe("quota");

    // The free daily quota (the quota id says so): "exhausted" only when every model's is used up.
    const daily = {status: 429, body: {error: {code: 429, details: [{violations: [{quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}};
    outcome = await run({"model-a": daily, "model-b": daily});
    expect((outcome.error as GeminiError).kind).toBe("exhausted");
    outcome = await run({"model-a": {status: 503}, "model-b": daily});
    expect((outcome.error as GeminiError).kind).toBe("unavailable");

    outcome = await run({"model-a": {status: 200, body: {candidates: [{content: {parts: [{text: "nem JSON"}]}, finishReason: "MAX_TOKENS"}]}}, "model-b": {status: 503}});
    expect((outcome.error as GeminiError).kind).toBe("unavailable");
  });
});
