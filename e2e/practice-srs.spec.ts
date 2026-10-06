import {expect, test} from "@playwright/test";
import {addDays, answerCard, BOX_INTERVALS, deckStats, isDue, pickSession, pruneState, weakSpots, type DeckState} from "../src/lib/practice/srs";
import {analyseScenario, flowOrder, nextStepId, type GraphNode} from "../src/lib/practice/scenario-graph";

const today = "2026-10-06";
/** A fixed "random" for deterministic sessions. */
const fixed = () => 0.42;

test.describe("spaced repetition", () => {
  test("a right answer moves the card a box up and further away, a wrong one back to the first box", () => {
    const first = answerCard(undefined, true, today);
    expect(first).toEqual({b: 1, d: addDays(today, BOX_INTERVALS[0]), l: 0});
    const second = answerCard(first, true, today);
    expect(second).toEqual({b: 2, d: "2026-10-07", l: 0});
    const top = answerCard({b: 5, d: today, l: 0}, true, today);
    expect(top).toEqual({b: 5, d: "2026-10-20", l: 0});
    expect(answerCard(second, false, today)).toEqual({b: 1, d: today, l: 1});
    expect(isDue({b: 3, d: "2026-10-09", l: 0}, today)).toBe(false);
    expect(isDue(undefined, today)).toBe(true);
  });

  test("a session takes the due cards first, then a few new ones", () => {
    const ids = Array.from({length: 30}, (_, index) => `card-${index}`);
    const state: DeckState = {
      "card-0": {b: 1, d: "2026-10-01", l: 3},
      "card-1": {b: 2, d: "2026-10-05", l: 0},
      "card-2": {b: 4, d: "2026-10-20", l: 0},
    };
    const session = pickSession(ids, state, today, {size: 8, newLimit: 3, random: fixed});
    expect(session).toHaveLength(5);
    expect(session).toEqual(expect.arrayContaining(["card-0", "card-1"]));
    expect(session).not.toContain("card-2");
    expect(session.filter((id) => !state[id])).toHaveLength(3);
  });

  test("with nothing due or new, the cards coming up next are practised", () => {
    const ids = ["a", "b", "c"];
    const state: DeckState = {a: {b: 3, d: "2026-10-09", l: 0}, b: {b: 2, d: "2026-10-07", l: 0}, c: {b: 5, d: "2026-10-30", l: 0}};
    expect(pickSession(ids, state, today, {random: fixed}).sort()).toEqual(["a", "b", "c"]);
  });

  test("deck figures, weak spots and pruning", () => {
    const state: DeckState = {a: {b: 4, d: "2026-10-20", l: 2}, b: {b: 1, d: today, l: 5}, gone: {b: 2, d: today, l: 9}};
    expect(deckStats(["a", "b", "c"], state, today)).toEqual({total: 3, due: 1, learnt: 1, fresh: 1, mastery: 1 / 3});
    expect(weakSpots(state, 2)).toEqual(["gone", "b"]);
    expect(Object.keys(pruneState(state, ["a", "b"]))).toEqual(["a", "b"]);
  });
});

test.describe("scenario graph", () => {
  const nodes: Record<string, GraphNode> = {
    start: {text: "Mi a teendő?", choices: [{id: "a", text: "Jó", next: "mid", points: 3}, {id: "b", text: "Rossz", next: "end", points: 0}]},
    mid: {text: "És most?", choices: [{id: "a", text: "Befejezem", next: null, points: 2}, {id: "b", text: "Tovább", next: "end", points: 1}]},
    end: {end: {title: "Vége"}},
    spare: {end: {title: "Nem elérhető"}},
  };

  test("the best path and the longest one are computed like on the server", () => {
    const analysis = analyseScenario(nodes, "start");
    expect(analysis.problems).toEqual([]);
    expect(analysis.maxScore).toBe(5);
    expect(analysis.depth).toBe(2);
    expect(analysis.unreachable).toEqual(["spare"]);
  });

  test("loops, dangling choices and a missing start are reported", () => {
    const loop = analyseScenario({...nodes, end: {text: "Vissza", choices: [{id: "a", text: "Újra", next: "start", points: 0}]}}, "start");
    expect(loop.hasCycle).toBe(true);
    expect(loop.problems).toContain("A gyakorlatban körbe vezető út van.");
    const dangling = analyseScenario({start: {text: "x", choices: [{id: "a", text: "y", next: "nincs", points: 0}]}}, "start");
    expect(dangling.problems.some((problem) => problem.includes("nem létező lépésre"))).toBe(true);
    expect(analyseScenario(nodes, "hianyzik").problems).toContain("A kezdő lépés hiányzik.");
    expect(nextStepId({s1: {}, s2: {}, s3: {}})).toBe("s4");
  });

  test("the editor lists the steps in reading order whatever order the database returns them in", () => {
    // jsonb sorts the keys by length: "end", "mid", "spare", "start".
    const shuffled: Record<string, GraphNode> = {end: nodes.end, mid: nodes.mid, spare: nodes.spare, start: nodes.start};
    expect(flowOrder(shuffled, "start")).toEqual(["start", "mid", "end", "spare"]);
    expect(flowOrder({}, "start")).toEqual([]);
  });
});
