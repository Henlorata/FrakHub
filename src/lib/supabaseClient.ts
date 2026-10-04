import {createClient} from "@supabase/supabase-js";
import {env} from "./env";

/**
 * Browser Supabase client. Authenticated as the signed-in user, so every query is
 * subject to Row Level Security.
 *
 * Intentionally untyped: the old hand-written `Database` type no longer matched the
 * live schema. Generate real types with `bun run db:types` and pass the generated
 * `Database` type to `createClient<Database>()` to get end-to-end typing back.
 */
export const supabase = createClient(
  // Placeholders keep module evaluation from throwing when configuration is missing;
  // App then renders a configuration error screen instead of a blank page.
  env.supabaseUrl || "https://missing-config.invalid",
  env.supabaseKey || "missing-key",
);
