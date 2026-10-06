import type {PenalChange} from "./penal-diff.js";

/**
 * Releases of the penal code (src/data/penalcode.json), newest first. Do not edit the change
 * lists by hand: after changing penalcode.json run `bun run penal:changelog`, which adds a release
 * here and refreshes tooling/penal-snapshot.json (e2e/penal-changelog.spec.ts fails until then).
 * The title and the summary may be reworded before the deploy. The daily job announces a new
 * release to every member once (announce_penal_code); the calculator shows its changes.
 */
export interface PenalRelease {
  /** Unique, e.g. "2026-10-06" (a second release on the same day gets "-2"). */
  version: string;
  /** Hungarian day of the release ("2026-10-06"). */
  date: string;
  title: string;
  summary: string;
  changes: PenalChange[];
}

export const PENAL_RELEASES: PenalRelease[] = [
  {
    "version": "2026-10-06",
    "date": "2026-10-06",
    "title": "A Btk. jelenlegi változata",
    "summary": "A változásnapló kiinduló állapota: innentől minden módosítás megjelenik a kalkulátorban.",
    "changes": []
  }
];

/** The current release (the daily job announces it once when it is new). */
export const PENAL_CODE_RELEASE: PenalRelease | undefined = PENAL_RELEASES[0];
