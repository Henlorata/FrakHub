import {supabase} from "./supabaseClient";

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
  if (!response.ok) throw new ApiError(response.status, payload?.error ?? `Szerverhiba (${response.status}).`);
  return payload as T;
}
