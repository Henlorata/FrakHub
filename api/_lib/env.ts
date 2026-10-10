import {HttpError} from "./http.js";

/** First non-empty value among the given environment variable names. */
function read(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function required(...names: string[]): string {
  const value = read(...names);
  if (!value) {
    // Logged for the operator; the client only sees a generic configuration error.
    console.error(`[api] Missing environment variable: one of ${names.join(", ")}`);
    throw new HttpError(500, "A szerver nincs megfelelően konfigurálva.");
  }
  return value;
}

/**
 * Server-side configuration. Legacy names are still read as fallbacks so existing
 * Vercel deployments keep working without changing their environment variables.
 */
export const serverEnv = {
  supabaseUrl: () => required("SUPABASE_URL", "VITE_SUPABASE_URL"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
  cloudinary: () => ({
    cloudName: required("CLOUDINARY_CLOUD_NAME", "VITE_CLOUDINARY_CLOUD_NAME"),
    apiKey: required("CLOUDINARY_API_KEY"),
    apiSecret: required("CLOUDINARY_API_SECRET"),
  }),
  cronSecret: () => read("CRON_SECRET"),
  /**
   * Google Gemini for the report form's AI helper (a Google AI Studio key of a project without
   * billing, so it stays on the free tier); null when not set. GEMINI_MODELS: comma separated,
   * tried in order; "model@level" sets a model's thinking level (default "minimal").
   */
  gemini: () => {
    const apiKey = read("GEMINI_API_KEY");
    if (!apiKey) return null;
    const models = (read("GEMINI_MODELS") ?? DEFAULT_GEMINI_MODELS).split(",").map((model) => model.trim()).filter(Boolean);
    return {apiKey, models};
  },
};

/**
 * Free tier models, each with its own daily quota (3.6 Flash 20 requests a day, the Flash-Lite ones
 * 500). Compared on sample reports on 2026-10-10: 3.6 Flash kept every fact and found the gaps best,
 * in 2-6 s, but is often overloaded (503); 3.1 Flash-Lite writes fluent Hungarian (2-4 s) and keeps
 * about 95 % of the facts; 3.5 Flash-Lite is the fastest (1-2 s) and keeps a few more facts of a long
 * draft, but makes spelling and suffix mistakes in about every other text ("bekatve", "nálunk",
 * "Jackson-t"). gemini-3.5-flash is served by 3.6 Flash (same quota); 3.7 and 3.8 Flash took 60-130 s.
 */
const DEFAULT_GEMINI_MODELS = "gemini-3.6-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite";
