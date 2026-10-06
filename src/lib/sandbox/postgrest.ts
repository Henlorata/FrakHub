/**
 * A small in-memory stand-in for PostgREST, enough for the app's own queries: filters (eq, neq,
 * gt/gte/lt/lte, like/ilike, is, in, cs, not.*, or=(...)), ordering, limit/offset, counts, single
 * objects, many-to-one and one-to-many embeds resolved from a relation map, inserts, upserts,
 * updates and deletes with `return=representation`.
 */

export type Row = Record<string, unknown>;

export interface Schema {
  /** Foreign keys: table -> column -> referenced table (by `id`). */
  relations: Record<string, Record<string, string>>;
  /** Primary key columns (default `id`). */
  keys?: Record<string, string[]>;
  /** Fills defaults of an inserted row (ids, numbers, timestamps). */
  onInsert?: (table: string, row: Row, tables: Record<string, Row[]>) => Row;
  /** Runs after a write (stands in for triggers). */
  afterWrite?: (table: string, kind: "insert" | "update" | "delete", rows: Row[], tables: Record<string, Row[]>) => void;
}

export interface RestRequest {
  table: string;
  method: string;
  params: URLSearchParams;
  headers: Headers;
  body: unknown;
}

export interface RestResult {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "or", "and", "on_conflict", "columns"]);

// --- select ----------------------------------------------------------------------------

interface SelectNode {
  /** Output key. */
  key: string;
  /** Column or relation name. */
  name: string;
  hint?: string;
  inner?: boolean;
  children?: SelectNode[];
  star?: boolean;
}

function splitTop(text: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let quoted = false;
  for (const char of text) {
    if (char === "\"") quoted = !quoted;
    if (!quoted && char === "(") depth += 1;
    if (!quoted && char === ")") depth -= 1;
    if (!quoted && depth === 0 && char === separator) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function parseSelect(select: string | null): SelectNode[] {
  if (!select || select.trim() === "*") return [{key: "*", name: "*", star: true}];
  return splitTop(select.replace(/\s+/g, " ")).map((token) => {
    if (token === "*") return {key: "*", name: "*", star: true};
    let alias: string | undefined;
    let rest = token;
    const open = token.indexOf("(");
    const colon = token.indexOf(":");
    if (colon > 0 && (open < 0 || colon < open) && token[colon + 1] !== ":") {
      alias = token.slice(0, colon).trim();
      rest = token.slice(colon + 1).trim();
    }
    if (rest.includes("(")) {
      const head = rest.slice(0, rest.indexOf("(")).trim();
      const inner = rest.slice(rest.indexOf("(") + 1, rest.lastIndexOf(")"));
      const [name, ...hints] = head.split("!");
      const isInner = hints.includes("inner");
      const hint = hints.find((item) => item !== "inner" && item !== "left");
      return {key: alias ?? name, name, hint, inner: isInner, children: parseSelect(inner)};
    }
    const name = rest.split("::")[0].trim();
    return {key: alias ?? name, name};
  });
}

// --- filters ------------------------------------------------------------------------------

const text = (value: unknown) => (value === null || value === undefined ? null : typeof value === "object" ? JSON.stringify(value) : String(value));

function compare(a: unknown, b: string): number {
  const left = text(a);
  if (left === null) return Number.NaN;
  const x = Number(left);
  const y = Number(b);
  if (left.trim() !== "" && b.trim() !== "" && Number.isFinite(x) && Number.isFinite(y)) return x - y;
  return left < b ? -1 : left > b ? 1 : 0;
}

const likeToRegex = (pattern: string, insensitive: boolean) => new RegExp(
  `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*").replace(/_/g, ".")}$`, insensitive ? "is" : "s");

function parseList(value: string): string[] {
  return splitTop(value.replace(/^\(|\)$/g, "")).map((item) => item.replace(/^"|"$/g, ""));
}

function matchOperator(cell: unknown, op: string, value: string): boolean {
  switch (op) {
    case "eq": return text(cell) === value;
    case "neq": return text(cell) !== value;
    case "gt": return compare(cell, value) > 0;
    case "gte": return compare(cell, value) >= 0;
    case "lt": return compare(cell, value) < 0;
    case "lte": return compare(cell, value) <= 0;
    case "like": return text(cell) !== null && likeToRegex(value, false).test(text(cell)!);
    case "ilike": return text(cell) !== null && likeToRegex(value, true).test(text(cell)!);
    case "is":
      if (value === "null") return cell === null || cell === undefined;
      if (value === "true") return cell === true;
      if (value === "false") return cell === false;
      return false;
    case "in": return parseList(value).includes(text(cell) ?? "");
    case "cs": {
      const wanted = value.replace(/^[{[]|[}\]]$/g, "").split(",").map((item) => item.replace(/^"|"$/g, "").trim()).filter(Boolean);
      return Array.isArray(cell) && wanted.every((item) => (cell as unknown[]).map(String).includes(item));
    }
    case "ov": {
      const wanted = value.replace(/^[{[]|[}\]]$/g, "").split(",").map((item) => item.replace(/^"|"$/g, "").trim());
      return Array.isArray(cell) && wanted.some((item) => (cell as unknown[]).map(String).includes(item));
    }
    default: return true;
  }
}

/** `col=op.value` / `col=not.op.value` */
function matchCondition(row: Row, column: string, expression: string): boolean {
  const negate = expression.startsWith("not.");
  const rest = negate ? expression.slice(4) : expression;
  const dot = rest.indexOf(".");
  const op = rest.slice(0, dot);
  const value = rest.slice(dot + 1);
  const cell = column.includes("->>") ? (row[column.split("->>")[0]] as Row | null)?.[column.split("->>")[1]] : row[column];
  const result = matchOperator(cell, op, value);
  return negate ? !result : result;
}

/** `(a.eq.1,b.ilike.%x%,and(c.eq.2,d.is.null))` */
function matchLogic(row: Row, expression: string, mode: "or" | "and"): boolean {
  const parts = splitTop(expression.replace(/^\(|\)$/g, ""));
  const results = parts.map((part) => {
    if (part.startsWith("and(")) return matchLogic(row, part.slice(3), "and");
    if (part.startsWith("or(")) return matchLogic(row, part.slice(2), "or");
    const dot = part.indexOf(".");
    return matchCondition(row, part.slice(0, dot), part.slice(dot + 1));
  });
  return mode === "or" ? results.some(Boolean) : results.every(Boolean);
}

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  return rows.filter((row) => {
    for (const [key, value] of params) {
      if (key === "or" && !matchLogic(row, value, "or")) return false;
      if (key === "and" && !matchLogic(row, value, "and")) return false;
      if (RESERVED.has(key) || key.includes(".")) continue;
      if (!matchCondition(row, key, value)) return false;
    }
    return true;
  });
}

function orderRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = order.split(",").map((part) => {
    const [column, ...modifiers] = part.split(".");
    return {column, desc: modifiers.includes("desc"), nullsFirst: modifiers.includes("nullsfirst") || (modifiers.includes("desc") && !modifiers.includes("nullslast"))};
  });
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const x = a[key.column];
      const y = b[key.column];
      if (x === y) continue;
      if (x === null || x === undefined) return key.nullsFirst ? -1 : 1;
      if (y === null || y === undefined) return key.nullsFirst ? 1 : -1;
      const result = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "hu", {numeric: true});
      if (result !== 0) return key.desc ? -result : result;
    }
    return 0;
  });
}

// --- embedding -----------------------------------------------------------------------------

function resolveEmbed(schema: Schema, tables: Record<string, Row[]>, table: string, row: Row, node: SelectNode): {value: unknown; table: string | null} {
  const relations = schema.relations[table] ?? {};
  const byId = (target: string, id: unknown) => (tables[target] ?? []).find((item) => item.id === id) ?? null;

  // alias:fk_column(...) or table!fk_column(...)
  if (relations[node.name]) return {value: byId(relations[node.name], row[node.name]), table: relations[node.name]};
  if (node.hint) {
    const column = relations[node.hint] ? node.hint : node.hint.replace(new RegExp(`^${table}_`), "").replace(/_fkey$/, "");
    if (relations[column]) return {value: byId(relations[column], row[column]), table: relations[column]};
  }
  // target_table(...): many-to-one through our foreign key, or one-to-many through theirs.
  const ownColumn = Object.entries(relations).find(([, target]) => target === node.name)?.[0];
  if (ownColumn) return {value: byId(node.name, row[ownColumn]), table: node.name};
  const theirColumn = Object.entries(schema.relations[node.name] ?? {}).find(([, target]) => target === table)?.[0];
  if (theirColumn) return {value: (tables[node.name] ?? []).filter((item) => item[theirColumn] === row.id), table: node.name};
  // Unknown relation: keep what the demo row already carries.
  return {value: row[node.key] ?? row[node.name] ?? null, table: null};
}

function project(schema: Schema, tables: Record<string, Row[]>, table: string | null, row: Row, nodes: SelectNode[]): Row | null {
  const output: Row = {};
  for (const node of nodes) {
    if (node.star) {
      Object.assign(output, row);
    } else if (node.children) {
      const {value, table: target} = table ? resolveEmbed(schema, tables, table, row, node) : {value: row[node.key] ?? null, table: null};
      if (node.inner && (value === null || (Array.isArray(value) && value.length === 0))) return null;
      output[node.key] = Array.isArray(value)
        ? value.map((item) => project(schema, tables, target, item as Row, node.children!)).filter(Boolean)
        : value && typeof value === "object" ? project(schema, tables, target, value as Row, node.children) : null;
    } else {
      output[node.key] = row[node.name] ?? null;
    }
  }
  return output;
}

// --- handler -------------------------------------------------------------------------------

export function handleRest(schema: Schema, tables: Record<string, Row[]>, request: RestRequest): RestResult {
  const {table, method, params, headers} = request;
  const prefer = headers.get("prefer") ?? "";
  const single = (headers.get("accept") ?? "").includes("vnd.pgrst.object+json");
  const nodes = parseSelect(params.get("select"));
  const rows = (tables[table] ??= []);
  const represent = (list: Row[]) => list.map((row) => project(schema, tables, table, row, nodes)).filter((row): row is Row => row !== null);
  const reply = (list: Row[], status = 200, total?: number): RestResult => {
    if (single) {
      return list.length === 1 ? {status, body: list[0]}
        : {status: 406, body: {code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${list.length} rows`, hint: null}};
    }
    const headersOut: Record<string, string> = {};
    if (prefer.includes("count=")) headersOut["Content-Range"] = `0-${Math.max(list.length - 1, 0)}/${total ?? list.length}`;
    return {status, body: list, headers: headersOut};
  };

  if (method === "GET" || method === "HEAD") {
    let result = represent(orderRows(filterRows(rows, params), params.get("order")));
    const total = result.length;
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.get("limit") === null ? undefined : Number(params.get("limit"));
    result = result.slice(offset, limit === undefined ? undefined : offset + limit);
    if (method === "HEAD") return {status: 200, headers: {"Content-Range": `0-${Math.max(result.length - 1, 0)}/${total}`}};
    return reply(result, 200, total);
  }

  const returnRows = prefer.includes("return=representation");
  if (method === "POST") {
    const payload = (Array.isArray(request.body) ? request.body : [request.body]) as Row[];
    const conflict = (params.get("on_conflict") ?? (schema.keys?.[table] ?? ["id"]).join(",")).split(",");
    const merge = prefer.includes("resolution=merge-duplicates");
    const ignore = prefer.includes("resolution=ignore-duplicates");
    const written: Row[] = [];
    for (const item of payload) {
      const existing = (merge || ignore) ? rows.find((row) => conflict.every((column) => row[column] !== undefined && row[column] === item[column])) : undefined;
      if (existing) {
        if (merge) Object.assign(existing, item);
        written.push(existing);
        continue;
      }
      const created = schema.onInsert ? schema.onInsert(table, {...item}, tables) : {...item};
      rows.push(created);
      written.push(created);
    }
    schema.afterWrite?.(table, "insert", written, tables);
    return returnRows ? reply(represent(written), 201) : {status: 201};
  }

  if (method === "PATCH") {
    const changes = (request.body ?? {}) as Row;
    const matched = filterRows(rows, params);
    matched.forEach((row) => Object.assign(row, changes));
    schema.afterWrite?.(table, "update", matched, tables);
    return returnRows ? reply(represent(matched)) : {status: 204};
  }

  if (method === "DELETE") {
    const matched = filterRows(rows, params);
    tables[table] = rows.filter((row) => !matched.includes(row));
    schema.afterWrite?.(table, "delete", matched, tables);
    return returnRows ? reply(represent(matched)) : {status: 204};
  }
  return {status: 405, body: {message: `Nem támogatott művelet: ${method}`}};
}
