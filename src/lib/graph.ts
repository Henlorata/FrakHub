import {Car, FolderOpen, Home, Network, User, type LucideIcon} from "lucide-react";
import {supabase} from "./supabaseClient";

/**
 * The MCB's relationship graph: persons, organisations, cases, vehicles (one node per plate) and
 * addresses around a starting point, read with get_relationship_graph(); search_graph_nodes()
 * finds a start. Node keys are "<kind>:<ref>" (supabase/migrations/…_documents_reports_graph.sql).
 */

export type GraphKind = "person" | "org" | "case" | "plate" | "address";

export interface GraphNode {
  key: string;
  kind: GraphKind;
  id?: string;
  label: string;
  title?: string | null;
  alias?: string | null;
  status?: string | null;
  image?: string | null;
  color?: string | null;
  threat?: string | null;
  can_open?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface GraphData {
  center: string;
  truncated: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSearchHit {
  key: string;
  kind: GraphKind;
  label: string;
  title?: string | null;
}

/**
 * Kinds are told apart by shape, icon and label as well, never by colour alone. The colours are the
 * dark-surface steps of the categorical palette (blue, violet, yellow, aqua); an organisation keeps
 * its own colour (orange when it has none).
 */
export const GRAPH_KINDS: Record<GraphKind, {label: string; plural: string; icon: LucideIcon; color: string}> = {
  person: {label: "Személy", plural: "Személyek", icon: User, color: "#3987e5"},
  org: {label: "Szervezet", plural: "Szervezetek", icon: Network, color: "#d95926"},
  case: {label: "Akta", plural: "Akták", icon: FolderOpen, color: "#9085e9"},
  plate: {label: "Jármű", plural: "Járművek", icon: Car, color: "#c98500"},
  address: {label: "Cím", plural: "Címek", icon: Home, color: "#199e70"},
};

/** The red of a wanted person's ring (status colour, always with the "Körözött" label). */
export const WANTED_COLOR = "#e66767";

export const nodeColor = (node: Pick<GraphNode, "kind" | "color">) =>
  node.kind === "org" && node.color ? node.color : GRAPH_KINDS[node.kind].color;

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
};

export const graphApi = {
  graph: (key: string, depth = 2) => rpc<GraphData | null>("get_relationship_graph", {_key: key, _depth: depth}),
  search: (query: string) => rpc<GraphSearchHit[]>("search_graph_nodes", {_query: query}),
};

/** Merges a newly read part into what is on screen (nodes by key, edges by their ends and label). */
export function mergeGraph(current: GraphData | null, next: GraphData): GraphData {
  if (!current) return next;
  const nodes = new Map(current.nodes.map((node) => [node.key, node]));
  for (const node of next.nodes) nodes.set(node.key, {...nodes.get(node.key), ...node});
  const edgeKey = (edge: GraphEdge) => `${edge.source}|${edge.target}|${edge.label ?? ""}`;
  const edges = new Map(current.edges.map((edge) => [edgeKey(edge), edge]));
  for (const edge of next.edges) edges.set(edgeKey(edge), edge);
  return {center: current.center, truncated: current.truncated || next.truncated, nodes: [...nodes.values()], edges: [...edges.values()]};
}

/** The address of the graph around a node. */
export const graphHref = (key: string) => `/mcb/graph?node=${encodeURIComponent(key)}`;
