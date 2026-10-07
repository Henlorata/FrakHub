/**
 * A small force layout for the relationship graph (no library): nodes push each other apart,
 * links pull their ends together, a weak pull keeps the whole near the middle. Pure functions, so
 * the page can run it frame by frame (the network settles visibly) or all at once (reduced motion).
 */

export interface Point {
  x: number;
  y: number;
}

export interface SimNode extends Point {
  key: string;
  vx: number;
  vy: number;
  /** Held by the user (dragged): forces do not move it. */
  pinned?: boolean;
}

export interface SimLink {
  source: string;
  target: string;
}

/** A stable pseudo-random number in [0, 1) for a key (the same layout on every visit). */
function hash(key: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Starting positions: known nodes keep theirs, the centre sits in the middle, a new node starts
 * near the first neighbour that already has a place (else on a ring around the middle).
 */
export function seedPositions(keys: string[], links: SimLink[], center: string, previous: Map<string, Point>): SimNode[] {
  const placed = new Map<string, Point>();
  for (const key of keys) {
    const known = previous.get(key);
    if (known) placed.set(key, known);
  }
  if (!placed.has(center)) placed.set(center, {x: 0, y: 0});
  const neighbours = new Map<string, string[]>();
  for (const link of links) {
    neighbours.set(link.source, [...(neighbours.get(link.source) ?? []), link.target]);
    neighbours.set(link.target, [...(neighbours.get(link.target) ?? []), link.source]);
  }
  // Breadth first from the placed ones, so a branch unfolds from where it hangs.
  let pending = keys.filter((key) => !placed.has(key));
  for (let round = 0; round < 6 && pending.length; round++) {
    const still: string[] = [];
    for (const key of pending) {
      const anchor = (neighbours.get(key) ?? []).map((other) => placed.get(other)).find(Boolean);
      if (!anchor) {
        still.push(key);
        continue;
      }
      const angle = hash(key) * Math.PI * 2;
      const distance = 110 + hash(key, 7) * 60;
      placed.set(key, {x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance});
    }
    pending = still;
  }
  pending.forEach((key, index) => {
    const angle = (index / Math.max(pending.length, 1)) * Math.PI * 2 + hash(key);
    placed.set(key, {x: Math.cos(angle) * 320, y: Math.sin(angle) * 320});
  });
  return keys.map((key) => ({key, ...placed.get(key)!, vx: 0, vy: 0}));
}

const REPULSION = 11000;
const LINK_LENGTH = 165;
const LINK_STRENGTH = 0.06;
const GRAVITY = 0.012;
const DAMPING = 0.62;

/** One step of the simulation with the given heat (alpha 1 → 0); moves the nodes in place. */
export function tick(nodes: SimNode[], links: SimLink[], alpha: number) {
  const index = new Map(nodes.map((node, i) => [node.key, i]));
  const fx = new Float64Array(nodes.length);
  const fy = new Float64Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x;
      let dy = nodes[j].y - nodes[i].y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        // On top of each other: nudge apart in a stable direction.
        dx = hash(nodes[j].key) - 0.5;
        dy = hash(nodes[i].key) - 0.5;
        d2 = dx * dx + dy * dy || 0.01;
      }
      const d = Math.sqrt(d2);
      const force = (REPULSION / Math.max(d2, 400)) * alpha;
      const ux = dx / d;
      const uy = dy / d;
      fx[i] -= ux * force;
      fy[i] -= uy * force;
      fx[j] += ux * force;
      fy[j] += uy * force;
    }
  }
  for (const link of links) {
    const a = index.get(link.source);
    const b = index.get(link.target);
    if (a === undefined || b === undefined) continue;
    const dx = nodes[b].x - nodes[a].x;
    const dy = nodes[b].y - nodes[a].y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (d - LINK_LENGTH) * LINK_STRENGTH * alpha;
    fx[a] += (dx / d) * force;
    fy[a] += (dy / d) * force;
    fx[b] -= (dx / d) * force;
    fy[b] -= (dy / d) * force;
  }
  nodes.forEach((node, i) => {
    if (node.pinned) {
      node.vx = 0;
      node.vy = 0;
      return;
    }
    fx[i] -= node.x * GRAVITY * alpha;
    fy[i] -= node.y * GRAVITY * alpha;
    node.vx = (node.vx + fx[i]) * DAMPING;
    node.vy = (node.vy + fy[i]) * DAMPING;
    node.x += node.vx;
    node.y += node.vy;
  });
}

/** Runs the whole cooling at once (reduced motion, tests). */
export function settle(nodes: SimNode[], links: SimLink[], steps = 300) {
  let alpha = 1;
  for (let step = 0; step < steps; step++) {
    tick(nodes, links, alpha);
    alpha *= 0.985;
  }
  return nodes;
}

/** The box around the nodes (with room for the labels), for fitting the view. */
export function bounds(nodes: Point[], padding = 80) {
  if (!nodes.length) return {x: -200, y: -200, width: 400, height: 400};
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  return {x: minX, y: minY, width: Math.max(...xs) + padding - minX, height: Math.max(...ys) + padding + 20 - minY};
}
