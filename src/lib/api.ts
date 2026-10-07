import {supabase} from "./supabaseClient";
import {bumpCacheEpoch} from "./cache-epoch";
import {reportError} from "./error-reporting";
import {sandbox} from "./sandbox/state";

/** Error returned by one of our Vercel functions; `message` is user-facing (Hungarian). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * POSTs JSON to a serverless function in `api/`. By default the request carries the
 * current session's access token, which every privileged endpoint verifies.
 */
export async function postApi<T = unknown>(
  path: `/api/${string}`,
  body: unknown,
  {authenticated = true}: {authenticated?: boolean} = {},
): Promise<T> {
  // Practice mode: the demo world answers, nothing reaches the server.
  const backend = sandbox.backend();
  if (backend) return (await backend.api(path, body)) as T;

  const headers: Record<string, string> = {"Content-Type": "application/json"};
  if (authenticated) {
    // getSession() refreshes an expired access token before returning it.
    const {data} = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, "A munkamenet lejárt. Jelentkezz be újra.");
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(path, {method: "POST", headers, body: JSON.stringify(body)});
  } catch {
    throw new ApiError(0, "Hálózati hiba: a szerver nem érhető el.");
  }

  const payload = (await response.json().catch(() => null)) as {error?: string} | null;
  if (!response.ok) {
    // Refusals (4xx) are answers; a failing function goes to the error log.
    if (response.status >= 500) reportError("api", `${path}: ${response.status} ${payload?.error ?? ""}`.trim());
    throw new ApiError(response.status, payload?.error ?? `Szerverhiba (${response.status}).`);
  }
  // Our functions write (HR, deletions): the stored lists check their versions again.
  bumpCacheEpoch();
  return payload as T;
}
