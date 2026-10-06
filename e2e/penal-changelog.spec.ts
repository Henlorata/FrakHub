import {readFileSync} from "node:fs";
import {expect, test} from "@playwright/test";
import {diffPenalCode, fieldText, flattenPenalCode, summarizeChanges, type PenalEntry} from "../shared/penal-diff";
import {PENAL_RELEASES} from "../shared/penal-changelog";

const penalCode = JSON.parse(readFileSync(new URL("../src/data/penalcode.json", import.meta.url), "utf8")) as unknown;
const snapshot = JSON.parse(readFileSync(new URL("../tooling/penal-snapshot.json", import.meta.url), "utf8")) as PenalEntry[];

test.describe("penal code change log", () => {
  test("the snapshot matches penalcode.json (run `bun run penal:changelog` after editing the penal code)", () => {
    expect(diffPenalCode(snapshot, flattenPenalCode(penalCode))).toEqual([]);
  });

  test("every offence has a unique id like the calculator's", () => {
    const entries = flattenPenalCode(penalCode);
    expect(entries.length).toBeGreaterThan(100);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.every((entry) => entry.id.startsWith("item:"))).toBe(true);
  });

  test("releases are newest first with unique versions", () => {
    const versions = PENAL_RELEASES.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    const dates = PENAL_RELEASES.map((release) => release.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test("changes are found by id: added, removed and changed fields", () => {
    const base: PenalEntry = {id: "item:1 §|FF", paragraph: "1 §", name: "Forgalom Feltartása", category: "Közlekedés",
      fine: [250_000, 500_000], jail: [null, null], note: ""};
    const before = [base, {...base, id: "item:2 §|GV", paragraph: "2 §", name: "Gondatlan Vezetés"}];
    const after = [{...base, fine: [250_000, 600_000] as [number, number], jail: [10, 20] as [number, number]},
      {...base, id: "item:9 §|ÚJ", paragraph: "9 §", name: "Új tétel"}];
    const changes = diffPenalCode(before, after);
    expect(changes.map((change) => change.kind)).toEqual(["changed", "added", "removed"]);
    expect(changes[0].fields?.map((field) => field.field)).toEqual(["fine", "jail"]);
    expect(changes[0].fields?.[1]).toMatchObject({from: "nincs", to: "10 perc – 20 perc"});
    expect(summarizeChanges(changes)).toBe("1 új, 1 módosult és 1 törölt tétel.");
    expect(summarizeChanges([])).toBe("Nincs változás.");
    expect(fieldText({...base, fine: [500, 500]}, "fine")).toContain("500");
  });
});
