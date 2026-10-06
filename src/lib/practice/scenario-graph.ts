/**
 * Checks of a branching scenario in the editor, the same rules the database applies when it is
 * saved (private.scenario_problem / scenario_analyse): the start exists, every choice leads to an
 * existing step or ends the scenario, no loops, at most 60 steps and 40 decisions on a path.
 * Pure and alias-free (e2e/practice-srs.spec.ts tests it).
 */

export interface GraphChoice {
  id: string;
  text: string;
  next: string | null;
  points: number;
  verdict?: string;
  feedback?: string;
}

export interface GraphNode {
  text?: string;
  choices?: GraphChoice[];
  end?: {title?: string; text?: string};
}

export interface GraphAnalysis {
  problems: string[];
  /** The best total of points from the start (the 100%). */
  maxScore: number;
  /** The longest path in decisions. */
  depth: number;
  hasCycle: boolean;
  /** Steps no path reaches from the start. */
  unreachable: string[];
}

export const MAX_STEPS = 60;
export const MAX_DEPTH = 40;
export const MAX_CHOICES = 6;

export function analyseScenario(nodes: Record<string, GraphNode>, start: string): GraphAnalysis {
  const problems: string[] = [];
  const keys = Object.keys(nodes);
  if (!nodes[start]) problems.push("A kezdő lépés hiányzik.");
  if (keys.length > MAX_STEPS) problems.push(`Legfeljebb ${MAX_STEPS} lépés lehet egy gyakorlatban.`);
  let endings = 0;
  for (const key of keys) {
    const node = nodes[key];
    const choices = node.choices ?? [];
    if (choices.length === 0) {
      endings += 1;
      continue;
    }
    if (choices.length > MAX_CHOICES) problems.push(`„${key}”: legfeljebb ${MAX_CHOICES} válasz lehet.`);
    if (!node.text?.trim()) problems.push(`„${key}”: hiányzik a helyzetleírás.`);
    const ids = new Set<string>();
    for (const choice of choices) {
      if (!choice.text.trim()) problems.push(`„${key}”: egy válasznak nincs szövege.`);
      if (!choice.id || ids.has(choice.id)) problems.push(`„${key}”: a válaszok azonosítója hiányzik vagy ismétlődik.`);
      ids.add(choice.id);
      if (choice.next === null || choice.next === "") endings += 1;
      else if (!nodes[choice.next]) problems.push(`„${key}”: egy válasz nem létező lépésre mutat (${choice.next}).`);
      if (!Number.isInteger(choice.points) || choice.points < 0 || choice.points > 10) problems.push(`„${key}”: a pont 0 és 10 között lehet.`);
    }
  }
  if (endings === 0) problems.push("Legalább egy befejezés kell (befejező lépés vagy befejező válasz).");

  // Longest path and best score by relaxation: settles within (steps + 1) rounds without loops.
  let best = new Map<string, number>();
  let depth = new Map<string, number>();
  let changed = true;
  let round = 0;
  while (changed && round <= keys.length + 1) {
    round += 1;
    changed = false;
    const nextBest = new Map<string, number>();
    const nextDepth = new Map<string, number>();
    for (const key of keys) {
      let b = 0;
      let d = 0;
      for (const choice of nodes[key].choices ?? []) {
        const target = choice.next && nodes[choice.next] ? choice.next : null;
        b = Math.max(b, (choice.points || 0) + (target ? best.get(target) ?? 0 : 0));
        d = Math.max(d, 1 + (target ? depth.get(target) ?? 0 : 0));
      }
      nextBest.set(key, b);
      nextDepth.set(key, d);
      if (b !== (best.get(key) ?? -1) || d !== (depth.get(key) ?? -1)) changed = true;
    }
    best = nextBest;
    depth = nextDepth;
  }
  const hasCycle = changed;
  if (hasCycle) problems.push("A gyakorlatban körbe vezető út van.");
  const maxDepth = depth.get(start) ?? 0;
  if (!hasCycle && maxDepth > MAX_DEPTH) problems.push(`Egy út legfeljebb ${MAX_DEPTH} döntésből állhat.`);

  // Steps nobody reaches (allowed, but worth a warning in the editor).
  const reached = new Set<string>();
  const stack = nodes[start] ? [start] : [];
  while (stack.length) {
    const key = stack.pop()!;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const choice of nodes[key]?.choices ?? []) if (choice.next && nodes[choice.next]) stack.push(choice.next);
  }

  return {
    problems: [...new Set(problems)], maxScore: hasCycle ? 0 : best.get(start) ?? 0, depth: maxDepth, hasCycle,
    unreachable: keys.filter((key) => !reached.has(key)),
  };
}

/**
 * The steps in reading order for the editor: the start, then breadth-first along the choices; the
 * endings after the situations; steps nobody reaches last. (The database keeps the steps as a JSON
 * object, which does not remember the order they were written in.)
 */
export function flowOrder(nodes: Record<string, GraphNode>, start: string): string[] {
  const seen = new Set<string>();
  const reached: string[] = [];
  const queue = nodes[start] ? [start] : [];
  while (queue.length) {
    const key = queue.shift()!;
    if (seen.has(key)) continue;
    seen.add(key);
    reached.push(key);
    for (const choice of nodes[key]?.choices ?? []) if (choice.next && nodes[choice.next] && !seen.has(choice.next)) queue.push(choice.next);
  }
  const ending = (key: string) => (nodes[key].choices?.length ?? 0) === 0;
  return [...reached.filter((key) => !ending(key)), ...reached.filter(ending), ...Object.keys(nodes).filter((key) => !seen.has(key))];
}

/** A free step id ("s3", "s4" ...). */
export function nextStepId(nodes: Record<string, unknown>): string {
  for (let index = Object.keys(nodes).length + 1; ; index += 1) if (!(`s${index}` in nodes)) return `s${index}`;
}
