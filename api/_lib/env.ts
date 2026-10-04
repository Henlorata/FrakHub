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
};
