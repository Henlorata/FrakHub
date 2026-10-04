/**
 * Small HTTP helpers for the Vercel functions (Web standard Request/Response).
 * Files under `api/_lib` are not deployed as endpoints (Vercel ignores `_` paths).
 */

/** Error carrying an HTTP status and a user-facing (Hungarian) message. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Authenticated, user-specific responses must never be cached by a CDN.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Wraps a handler: `HttpError`s become JSON error responses, anything unexpected is
 * logged server-side and answered with a generic message (no internal details leak).
 */
export function handle(name: string, handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return json({error: error.message}, error.status);
      console.error(`[api/${name}]`, error);
      return json({error: "Váratlan szerverhiba történt. Próbáld újra később."}, 500);
    }
  };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Érvénytelen kérés: a törzs nem érvényes JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Érvénytelen kérés.");
  }
  return body as Record<string, unknown>;
}

export function getBearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  return match ? match[1] : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, message = "Hiányzó vagy érvénytelen azonosító."): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new HttpError(400, message);
  return value;
}

/** Runs `task` over `items` with at most `limit` promises in flight. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = {status: "fulfilled", value: await task(items[index])};
      } catch (reason) {
        results[index] = {status: "rejected", reason};
      }
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return results;
}
