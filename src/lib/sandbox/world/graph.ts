import {plateKey} from "@/lib/license-ocr/parse";
import type {Row} from "../postgrest";
import {SandboxError, type RpcHandler, type World} from "./context";

/**
 * The relationship graph in the demo world: the same walk as get_relationship_graph() in the
 * database (persons, cases, vehicles by plate, addresses), over the demo register.
 */

const tableOf = (world: World, name: string) => world.tables[name] ?? [];
const addressKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

function neighbours(world: World, key: string): {target: string; label: string | null}[] {
  const [kind, ...rest] = key.split(":");
  const ref = rest.join(":");
  const out: {target: string; label: string | null}[] = [];
  if (kind === "person") {
    for (const row of tableOf(world, "suspect_associates")) {
      if (row.suspect_id === ref && row.associate_id) out.push({target: `person:${row.associate_id}`, label: row.relationship as string});
      if (row.associate_id === ref && row.suspect_id) out.push({target: `person:${row.suspect_id}`, label: row.relationship as string});
    }
    for (const row of tableOf(world, "organization_members")) {
      if (row.suspect_id === ref) out.push({target: `org:${row.organization_id}`, label: row.role as string});
    }
    for (const row of tableOf(world, "suspect_vehicles")) {
      if (row.suspect_id === ref && plateKey(row.plate_number as string)) out.push({target: `plate:${plateKey(row.plate_number as string)}`, label: row.vehicle_type as string});
    }
    for (const row of tableOf(world, "suspect_properties")) {
      if (row.suspect_id === ref && addressKey(row.address)) out.push({target: `address:${addressKey(row.address)}`, label: row.property_type as string});
    }
    for (const row of tableOf(world, "case_suspects")) {
      if (row.suspect_id === ref && row.case_id) out.push({target: `case:${row.case_id}`, label: row.involvement_type as string});
    }
  } else if (kind === "org") {
    for (const row of tableOf(world, "organization_members")) if (row.organization_id === ref) out.push({target: `person:${row.suspect_id}`, label: row.role as string});
  } else if (kind === "case") {
    for (const row of tableOf(world, "case_suspects")) if (row.case_id === ref && row.suspect_id) out.push({target: `person:${row.suspect_id}`, label: row.involvement_type as string});
  } else if (kind === "plate") {
    for (const row of tableOf(world, "suspect_vehicles")) {
      if (plateKey(row.plate_number as string) === ref && row.suspect_id) out.push({target: `person:${row.suspect_id}`, label: row.vehicle_type as string});
    }
  } else if (kind === "address") {
    for (const row of tableOf(world, "suspect_properties")) {
      if (addressKey(row.address) === ref && row.suspect_id) out.push({target: `person:${row.suspect_id}`, label: row.property_type as string});
    }
  }
  return out;
}

function node(world: World, key: string): Row | null {
  const [kind, ...rest] = key.split(":");
  const ref = rest.join(":");
  if (kind === "person") {
    const row = tableOf(world, "suspects").find((item) => item.id === ref);
    return row ? {key, kind, id: row.id, label: row.full_name, alias: row.alias, status: row.status, image: row.mugshot_url} : null;
  }
  if (kind === "org") {
    const row = tableOf(world, "crime_organizations").find((item) => item.id === ref);
    return row ? {key, kind, id: row.id, label: row.name, color: row.color, image: row.logo_url, status: row.status, threat: row.threat} : null;
  }
  if (kind === "case") {
    const row = tableOf(world, "cases").find((item) => item.id === ref);
    return row ? {key, kind, id: row.id, label: row.case_number, title: row.title, status: row.status, can_open: true} : null;
  }
  if (kind === "plate") {
    const row = tableOf(world, "suspect_vehicles").find((item) => plateKey(item.plate_number as string) === ref);
    return row ? {key, kind, label: String(row.plate_number).toUpperCase(), title: [row.vehicle_type, row.color].filter(Boolean).join(" · ")} : null;
  }
  if (kind === "address") {
    const row = tableOf(world, "suspect_properties").find((item) => addressKey(item.address) === ref);
    return row ? {key, kind, label: String(row.address).trim(), title: row.property_type} : null;
  }
  return null;
}

export const graphRpc: Record<string, RpcHandler> = {
  get_relationship_graph: (args, world) => {
    const start = String(args._key ?? "");
    if (!node(world, start)) return null;
    const depth = Math.min(Math.max(Number(args._depth ?? 2), 1), 3);
    const seen = [start];
    const edges = new Map<string, {source: string; target: string; label: string | null}>();
    let frontier = [start];
    for (let step = 0; step < depth && frontier.length; step++) {
      const next: string[] = [];
      for (const key of frontier) {
        for (const link of neighbours(world, key)) {
          if (!seen.includes(link.target)) {
            if (seen.length >= 150) continue;
            seen.push(link.target);
            next.push(link.target);
          }
          const [a, b] = [key, link.target].sort();
          edges.set(`${a}|${b}|${link.label ?? ""}`, {source: a, target: b, label: link.label});
        }
      }
      frontier = next;
    }
    return {center: start, truncated: false, nodes: seen.map((key) => node(world, key)).filter(Boolean),
      edges: [...edges.values()].filter((edge) => seen.includes(edge.source) && seen.includes(edge.target))};
  },
  search_graph_nodes: (args, world) => {
    const query = String(args._query ?? "").trim().toLowerCase();
    if (query.length < 2) return [];
    const hits: Row[] = [];
    for (const row of tableOf(world, "suspects")) {
      if (`${row.full_name} ${row.alias ?? ""}`.toLowerCase().includes(query)) hits.push({key: `person:${row.id}`, kind: "person", label: row.full_name, title: row.alias});
    }
    for (const row of tableOf(world, "cases")) {
      if (`${row.case_number} ${row.title}`.toLowerCase().includes(query)) hits.push({key: `case:${row.id}`, kind: "case", label: row.case_number, title: row.title});
    }
    const wanted = plateKey(query);
    for (const row of tableOf(world, "suspect_vehicles")) {
      const key = plateKey(row.plate_number as string);
      if (wanted && key.includes(wanted) && !hits.some((hit) => hit.key === `plate:${key}`)) {
        hits.push({key: `plate:${key}`, kind: "plate", label: String(row.plate_number).toUpperCase(), title: row.vehicle_type});
      }
    }
    return hits.slice(0, 20);
  },
};

export const requireGraphNode = (world: World, key: string) => {
  const found = node(world, key);
  if (!found) throw new SandboxError("Ez az elem nem található.");
  return found;
};
