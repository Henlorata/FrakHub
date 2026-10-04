import {existsSync} from "node:fs";
import type {IncomingMessage, ServerResponse} from "node:http";
import path from "node:path";
import type {Plugin, ViteDevServer} from "vite";

type WebHandler = (request: Request) => Response | Promise<Response>;

/**
 * Serves the Vercel functions in `api/` from the Vite dev server, so the whole app
 * (including registration and the admin endpoints) runs locally without the Vercel CLI.
 *
 * Every `api/<route>.ts` module exports Web-standard handlers named after HTTP methods
 * (`GET`, `POST`, ...), exactly the signature Vercel invokes in production.
 * Only active for `vite dev`; on Vercel the platform does the routing.
 */
export function vercelApiDev(): Plugin {
  let root = process.cwd();

  return {
    name: "frakhub:vercel-api-dev",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        handleApiRequest(server, root, req, res).catch((error: unknown) => {
          server.config.logger.error(`[api] ${req.method} ${req.url} failed: ${String(error)}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
          }
          res.end(JSON.stringify({error: "Belső szerverhiba (dev)."}));
        });
      });
    },
  };
}

async function handleApiRequest(server: ViteDevServer, root: string, req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const modulePath = resolveFunctionFile(root, url.pathname);

  if (!modulePath) {
    sendJson(res, 404, {error: "Ismeretlen API végpont."});
    return;
  }

  const mod = (await server.ssrLoadModule(modulePath)) as Record<string, unknown>;
  const method = (req.method ?? "GET").toUpperCase();
  const handler = mod[method];

  if (typeof handler !== "function") {
    sendJson(res, 405, {error: "A kérés metódusa nem engedélyezett."});
    return;
  }

  const response = await (handler as WebHandler)(await toWebRequest(req, url));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Mirrors Vercel's file-system routing: `/api/a/b` -> `api/a/b.ts` or `api/a/b/index.ts`. */
function resolveFunctionFile(root: string, pathname: string): string | null {
  const route = pathname.replace(/\/+$/, "");
  const segments = route.split("/").filter(Boolean);
  // Files and folders starting with "_" or "." are private helpers, never routes.
  if (segments.some((segment) => segment.startsWith("_") || segment.startsWith("."))) return null;

  for (const candidate of [`${route}.ts`, `${route}/index.ts`]) {
    const file = path.join(root, candidate);
    if (existsSync(file)) return file;
  }
  return null;
}

async function toWebRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, value);
  }

  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return new Request(url, {method, headers});

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Request(url, {method, headers, body: Buffer.concat(chunks)});
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
