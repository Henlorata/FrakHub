import {reloadingPage} from "./lazy";
import {sandbox} from "./sandbox/state";

/**
 * Error log (`report_client_error()`, read on the statistics page): what broke in a browser reaches
 * the leadership instead of a screenshot. A page that crashed, an unhandled error, a failed upload,
 * a server error of our functions and a database answer that only a frontend and schema out of step
 * give. Each error is sent once per page load (at most 15); the database counts repeats on one row
 * and throttles. Never in practice mode, offline or while a failed chunk reloads the page; the page
 * goes without its query (search words, codes) and the browser only as its name, version and system.
 */

export type ErrorKind = "crash" | "error" | "upload" | "api" | "database";

interface ErrorReport {
  _kind: ErrorKind;
  _message: string;
  _detail: string | null;
  _route: string;
  _build: string;
  _browser: string;
}

type Transport = (report: ErrorReport) => PromiseLike<unknown>;

const MAX_PER_LOAD = 15;
const sent = new Set<string>();
let transport: Transport | null = null;
const waiting: ErrorReport[] = [];

/** The Supabase client sends the reports (it imports this module, not the other way round). */
export function setErrorTransport(send: Transport) {
  transport = send;
  waiting.splice(0).forEach(deliver);
}

function deliver(report: ErrorReport) {
  try {
    transport?.(report).then(undefined, () => undefined);
  } catch {
    // The report itself must never break anything.
  }
}

/** The connection or the browser, not our code. */
const NOISE = [
  /^ResizeObserver loop/i,
  /^Script error\.?$/i,
  /^(TypeError: )?(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|cancelled|The network connection was lost\.?|The Internet connection appears to be offline\.?)$/i,
  /^AbortError\b|\baborted\b/i,
];
/** Scripts of browser extensions. */
const FOREIGN = /(chrome|moz|safari(-web)?|ms-browser)-extension:\/\/|webkit-masked-url:/i;

function describe(error: unknown): {message: string; stack: string} {
  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? `${error.name}: ` : "";
    return {message: `${name}${error.message}`, stack: error.stack ?? ""};
  }
  if (typeof error === "string") return {message: error, stack: ""};
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return {message: error.message, stack: ""};
  try {
    return {message: JSON.stringify(error) ?? String(error), stack: ""};
  } catch {
    return {message: String(error), stack: ""};
  }
}

/** The page with its ids folded (/mcb/case/:id); the query never goes. */
export const errorRoute = (path: string) => path.split("/").map((part) => (/\d/.test(part) ? ":id" : part)).join("/").slice(0, 120) || "/";

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:A|iOS)?\/(\d+)/, "Edge"], [/OPR\/(\d+)/, "Opera"], [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"], [/Version\/(\d+)[^ ]* .*Safari/, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/Android/, "Android"], [/iPhone|iPad|iPod/, "iOS"], [/Windows/, "Windows"], [/CrOS/, "ChromeOS"], [/Mac OS X|Macintosh/, "macOS"], [/Linux/, "Linux"],
];

/** "Chrome 141 · Windows": enough to tell browsers apart, not to recognise a device. */
export function browserLabel(agent: string) {
  let browser = "Más böngésző";
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(agent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  return system ? `${browser} · ${system}` : browser;
}

/** Records an error in the log (best effort, never throws). */
export function reportError(kind: ErrorKind, error: unknown, extra?: string | null) {
  if (sandbox.isActive() || navigator.onLine === false || reloadingPage()) return;
  const {message, stack} = describe(error);
  const text = message.replace(/\s+/g, " ").trim();
  if (!text || NOISE.some((pattern) => pattern.test(text)) || FOREIGN.test(stack)) return;
  const key = `${kind}:${text}`;
  if (sent.has(key) || sent.size >= MAX_PER_LOAD) return;
  sent.add(key);
  const report: ErrorReport = {
    _kind: kind,
    _message: text.slice(0, 300),
    _detail: [stack, extra].filter(Boolean).join("\n\n").slice(0, 2000) || null,
    _route: errorRoute(window.location.pathname),
    _build: __APP_BUILD__,
    _browser: browserLabel(navigator.userAgent),
  };
  if (transport) deliver(report);
  else if (waiting.length < 5) waiting.push(report);
}

/**
 * Database answers that only a frontend and schema out of step give: a missing function, column,
 * table or relation, a bad query, a broken constraint, a timeout, a privilege the database refused.
 * The expected refusals (our own Hungarian errors, an empty single row, a lapsed session) stay out.
 */
const SCHEMA_CODES = new Set(["PGRST100", "PGRST200", "PGRST201", "PGRST202", "PGRST204", "42703", "42883", "42P01", "42P17", "22P02", "23502", "23503",
  "23514", "57014"]);

export function reportDatabaseError(url: string, status: number, body: {code?: unknown; message?: unknown; hint?: unknown} | null) {
  const code = typeof body?.code === "string" ? body.code : "";
  const message = typeof body?.message === "string" ? body.message : "";
  const refused = code === "42501" && /^permission denied for |row-level security/i.test(message);
  if (status < 500 && !SCHEMA_CODES.has(code) && !refused) return;
  reportError("database", `${endpointOf(url)}: ${code || `HTTP ${status}`} ${message}`.trim(), typeof body?.hint === "string" ? body.hint : null);
}

/** "rpc/get_case_detail", "cases", "storage/object/finance_proofs": the call without its query or file. */
function endpointOf(url: string) {
  try {
    const path = new URL(url).pathname;
    if (path.startsWith("/rest/v1/")) return path.slice("/rest/v1/".length);
    return `storage/${path.replace(/^\/storage\/v1\//, "").split("/").slice(0, 2).join("/")}`;
  } catch {
    return "?";
  }
}

/** Errors nothing caught: a script error or a promise nobody handled. */
export function installErrorReporting() {
  window.addEventListener("error", (event) => {
    // A script from elsewhere (an extension, a blocked third party) gives nothing to fix here.
    if (event.filename && !event.filename.startsWith(window.location.origin)) return;
    reportError("error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => reportError("error", event.reason));
}
