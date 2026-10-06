/**
 * Records a penal code release: compares src/data/penalcode.json with the last snapshot
 * (tooling/penal-snapshot.json) and, when something changed, adds a release to
 * shared/penal-changelog.ts and refreshes the snapshot. Run after editing penalcode.json:
 *
 *   bun run penal:changelog
 *
 * Reword the generated title/summary if needed; the daily job announces the release once.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {diffPenalCode, flattenPenalCode, summarizeChanges, type PenalEntry} from "../shared/penal-diff.ts";
import {PENAL_RELEASES, type PenalRelease} from "../shared/penal-changelog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "src/data/penalcode.json");
const snapshotPath = join(root, "tooling/penal-snapshot.json");
const changelogPath = join(root, "shared/penal-changelog.ts");

const writeSnapshot = (entries: PenalEntry[]) =>
  writeFileSync(snapshotPath, `[\n${entries.map((entry) => `  ${JSON.stringify(entry)}`).join(",\n")}\n]\n`);

const current = flattenPenalCode(JSON.parse(readFileSync(dataPath, "utf8")));
const readSnapshot = (): PenalEntry[] | null => {
  try {
    return JSON.parse(readFileSync(snapshotPath, "utf8")) as PenalEntry[];
  } catch {
    return null;
  }
};
const previous = readSnapshot();

if (!previous) {
  writeSnapshot(current);
  console.log(`Kiinduló állapot elmentve (${current.length} tétel).`);
  process.exit(0);
}

const changes = diffPenalCode(previous, current);
if (changes.length === 0) {
  console.log("Nincs változás a Btk.-ban.");
  process.exit(0);
}

const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Budapest"}).format(new Date());
let version = today;
for (let suffix = 2; PENAL_RELEASES.some((release) => release.version === version); suffix += 1) version = `${today}-${suffix}`;

const release: PenalRelease = {version, date: today, title: "Változott a Btk.", summary: summarizeChanges(changes), changes};
const source = readFileSync(changelogPath, "utf8");
const start = source.indexOf("export const PENAL_RELEASES: PenalRelease[] = ");
const end = source.indexOf("];\n", start);
if (start < 0 || end < 0) throw new Error("A shared/penal-changelog.ts szerkezete megváltozott: a PENAL_RELEASES tömb nem található.");
const literal = JSON.stringify([release, ...PENAL_RELEASES], null, 2);
writeFileSync(changelogPath, `${source.slice(0, start)}export const PENAL_RELEASES: PenalRelease[] = ${literal};\n${source.slice(end + 3)}`);
writeSnapshot(current);

console.log(`Új Btk. kiadás: ${version} – ${release.summary}`);
for (const change of changes) {
  const label = change.kind === "added" ? "+" : change.kind === "removed" ? "−" : "~";
  console.log(`  ${label} ${change.paragraph} ${change.name}${change.fields ? `: ${change.fields.map((field) => field.field).join(", ")}` : ""}`);
}
