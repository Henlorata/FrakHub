import type {Page, Request, Route} from "@playwright/test";

/**
 * Network-level Supabase mock for end-to-end tests.
 *
 * The dev server under test is started with VITE_SUPABASE_URL pointing at
 * MOCK_SUPABASE_URL (see playwright.config.ts). Every request to that origin is
 * answered here from in-memory tables, so tests never touch a real project and can
 * assert on the exact queries the app makes (request budget / quota regressions).
 */
export const MOCK_SUPABASE_URL = "http://127.0.0.1:54399";

type Row = Record<string, unknown>;

export interface MockOptions {
  /** Table rows served by the REST mock, keyed by table (or view) name. */
  tables?: Record<string, Row[]>;
  /** RPC results keyed by function name (a function receives the call's arguments). */
  rpc?: Record<string, unknown>;
  /** Credentials accepted by the password login. */
  credentials?: {email: string; password: string};
}

export interface RecordedRequest {
  method: string;
  /** "rest", "rpc", "auth", "storage" */
  kind: string;
  /** Table, RPC or auth endpoint name. */
  name: string;
  url: string;
  /** RPC arguments. */
  body?: Record<string, unknown> | null;
}

export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

/** Every training as already played, so the automatic training start stays out of the other tests. */
export const TRAINING_IDS = ["basic", "mcb", "supervisor", "instructor", "command", "executive", "bureau_commander", "bureau_manager"];
export const playedTrainings = (userId = TEST_USER_ID): Row[] => TRAINING_IDS.map((training_id) => ({
  user_id: userId, training_id, status: "completed", version: 1, updated_at: "2026-10-01T10:00:00Z",
}));

export const testProfile = (overrides: Row = {}): Row => ({
  id: TEST_USER_ID,
  email: "deputy@sfsd.test",
  full_name: "John Doe",
  badge_number: "1192",
  faction_rank: "Sergeant I.",
  division: "TSB",
  division_rank: null,
  qualifications: [],
  is_bureau_manager: false,
  is_bureau_commander: false,
  commanded_divisions: [],
  system_role: "supervisor",
  avatar_url: null,
  onboarding_completed: true,
  created_at: "2025-01-01T00:00:00Z",
  last_promotion_date: null,
  ...overrides,
});

const base64url = (value: string) => Buffer.from(value).toString("base64url");

/** Unsigned JWT: the browser client only decodes it, the mock never verifies it. */
function fakeJwt(userId: string, email: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {sub: userId, email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600};
  return `${base64url(JSON.stringify({alg: "HS256", typ: "JWT"}))}.${base64url(JSON.stringify(payload))}.signature`;
}

function authUser(email: string) {
  return {
    id: TEST_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: {provider: "email"},
    user_metadata: {},
    created_at: "2025-01-01T00:00:00Z",
  };
}

function session(email: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeJwt(TEST_USER_ID, email),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "e2e-refresh-token",
    user: authUser(email),
  };
}

/** Minimal PostgREST filter support: eq, neq, in, is (others pass through). */
function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let result = rows;
  params.forEach((value, column) => {
    if (["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"].includes(column)) return;
    const dot = value.indexOf(".");
    const op = value.slice(0, dot);
    const operand = value.slice(dot + 1);
    const asText = (cell: unknown) => (cell === null || cell === undefined ? null : String(cell));
    if (op === "eq") result = result.filter((row) => asText(row[column]) === operand);
    else if (op === "neq") result = result.filter((row) => asText(row[column]) !== operand);
    else if (op === "is" && operand === "null") result = result.filter((row) => row[column] == null);
    else if (op === "in") {
      const values = operand.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      result = result.filter((row) => values.includes(String(row[column])));
    }
  });
  const limit = Number(params.get("limit"));
  return Number.isFinite(limit) && limit > 0 ? result.slice(0, limit) : result;
}

export class MockSupabase {
  readonly requests: RecordedRequest[] = [];
  private readonly tables: Record<string, Row[]>;
  private readonly rpc: Record<string, unknown>;
  private readonly credentials: {email: string; password: string};

  constructor(options: MockOptions = {}) {
    this.tables = {
      profiles: [testProfile()],
      system_status: [{id: "global", alert_level: "normal", recruitment_open: true}],
      training_progress: playedTrainings(),
      ...options.tables,
    };
    this.rpc = options.rpc ?? {};
    this.credentials = options.credentials ?? {email: "deputy@sfsd.test", password: "correct-password"};
  }

  /** Requests of one kind/name, e.g. `count("rest", "suspects")`. */
  count(kind: string, name?: string) {
    return this.requests.filter((r) => r.kind === kind && (name === undefined || r.name === name)).length;
  }

  async install(page: Page) {
    // Safety net: nothing may leave the machine during tests (no real Supabase,
    // Cloudinary, texture CDN or YouTube traffic).
    await page.route(
      (url) => !["127.0.0.1", "localhost"].includes(url.hostname),
      (route) => route.abort("blockedbyclient"),
    );
    await page.route(`${MOCK_SUPABASE_URL}/**`, (route, request) => this.handle(route, request));
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      // Phoenix v2 frames: [join_ref, ref, topic, event, payload]. Acknowledge every
      // push (joins, heartbeats, token updates) so channels report SUBSCRIBED.
      ws.onMessage((message) => {
        try {
          const [joinRef, ref, topic] = JSON.parse(String(message)) as [string | null, string | null, string];
          if (ref) ws.send(JSON.stringify([joinRef, ref, topic, "phx_reply", {status: "ok", response: {}}]));
        } catch {
          // binary broadcast frames are not used by the app
        }
      });
    });
  }

  private record(request: Request, kind: string, name: string) {
    this.requests.push({method: request.method(), kind, name, url: request.url()});
  }

  private async handle(route: Route, request: Request) {
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.startsWith("/auth/v1/")) return this.handleAuth(route, request, path.slice("/auth/v1/".length));
    if (path.startsWith("/rest/v1/rpc/")) {
      const name = path.slice("/rest/v1/rpc/".length);
      let body: Record<string, unknown> | null;
      try {
        body = request.postDataJSON() as Record<string, unknown> | null;
      } catch {
        body = null;
      }
      this.requests.push({method: request.method(), kind: "rpc", name, url: request.url(), body});
      const result = this.rpc[name];
      return route.fulfill({json: typeof result === "function" ? (result as (args: unknown) => unknown)(body) : result ?? null});
    }
    if (path.startsWith("/rest/v1/")) return this.handleRest(route, request, path.slice("/rest/v1/".length), url);
    if (path.startsWith("/storage/v1/")) {
      this.record(request, "storage", path);
      return route.fulfill({json: []});
    }
    return route.fulfill({status: 404, json: {message: `unmocked: ${path}`}});
  }

  private async handleAuth(route: Route, request: Request, endpoint: string) {
    this.record(request, "auth", endpoint.split("?")[0]);
    if (endpoint.startsWith("token")) {
      const body = request.postDataJSON() as {email?: string; password?: string} | null;
      if (body?.email === this.credentials.email && body.password === this.credentials.password) {
        return route.fulfill({json: session(body.email)});
      }
      return route.fulfill({
        status: 400,
        json: {code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials"},
      });
    }
    if (endpoint.startsWith("logout")) {
      return route.fulfill({status: 204, body: ""});
    }
    if (endpoint.startsWith("user")) return route.fulfill({json: authUser(this.credentials.email)});
    return route.fulfill({json: {}});
  }

  private async handleRest(route: Route, request: Request, table: string, url: URL) {
    const method = request.method();
    let body: Record<string, unknown> | null = null;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = request.postDataJSON() as Record<string, unknown> | null;
      } catch {
        body = null;
      }
    }
    this.requests.push({method, kind: "rest", name: table, url: request.url(), body});
    const rows = applyFilters(this.tables[table] ?? [], url.searchParams);
    const headers = await request.allHeaders();
    const prefer = headers["prefer"] ?? "";
    const contentRange = `0-${Math.max(rows.length - 1, 0)}/${rows.length}`;
    // Like the real API: let the browser read the count header cross-origin.
    const expose = {"Access-Control-Expose-Headers": "Content-Range"};

    if (method === "HEAD") {
      return route.fulfill({status: 200, headers: {...expose, "Content-Range": prefer.includes("count") ? contentRange : "*/*"}});
    }
    if (method !== "GET") {
      // Mutations succeed; echo the payload when the client asks for a representation.
      const payload = request.postDataJSON() as Row | Row[] | null;
      const echo = Array.isArray(payload) ? payload : payload ? [{id: crypto.randomUUID(), ...payload}] : [];
      return prefer.includes("return=representation")
        ? route.fulfill({status: 201, json: echo})
        : route.fulfill({status: 204, body: ""});
    }
    if ((headers["accept"] ?? "").includes("vnd.pgrst.object+json")) {
      return rows.length === 1
        ? route.fulfill({json: rows[0]})
        : route.fulfill({status: 406, json: {code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned"}});
    }
    return route.fulfill({json: rows, headers: {...expose, "Content-Range": contentRange}});
  }
}

/** Installs the mock and returns it for assertions. */
export async function mockSupabase(page: Page, options?: MockOptions) {
  const mock = new MockSupabase(options);
  await mock.install(page);
  return mock;
}

/** Logs in through the real login form. */
export async function login(page: Page, email = "deputy@sfsd.test", password = "correct-password") {
  await page.goto("/login");
  await page.getByPlaceholder("badge@sfsd.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", {name: /belépés/i}).click();
}
