/**
 * Reading the duty time of the members from screenshots of the game's control panel (UCP,
 * "Frakció tagok" list) for the HR duty sheet.
 *
 * Pure functions without imports: also used by the end-to-end tests in Node.
 *
 * Each member is a block: the name, under it "Utoljára online: ..." (or "Jelenleg online"), and
 * on the right a pill "1586 perc" vertically centred on the block. Screenshots are cropped
 * differently (the "Tagok" title may be missing, the browser and the side menu may be on it),
 * so nothing relies on positions: the "perc" pills anchor the rows, the names are taken from the
 * column the status lines start in.
 */

export interface OcrBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWordLike {
  text: string;
  confidence: number;
  bbox: OcrBox;
}

export interface OcrLineLike extends OcrWordLike {
  words: OcrWordLike[];
}

/** One member row found on a picture. */
export interface DutyRow {
  name: string;
  nameBox: OcrBox;
  /** The minutes as the first pass read them (null: not readable). */
  minutes: number | null;
  /** The pill's number and "perc" (picture coordinates), to read it again; null when not found. */
  valueBox: OcrBox | null;
}

/** The game's counter of a month cannot be more than a month. */
export const MAX_MINUTES = 31 * 24 * 60;

const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

const height = (box: OcrBox) => Math.max(1, box.y1 - box.y0);
const centerY = (box: OcrBox) => (box.y0 + box.y1) / 2;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Look-alikes of digits in the pill ("Operc" is "0 perc"). */
const DIGIT_LOOKALIKES: Record<string, string> = {O: "0", o: "0", Q: "0", D: "0", I: "1", l: "1", "|": "1", "!": "1", S: "5", B: "8", Z: "2"};
const toDigits = (value: string) => value.replace(/[OoQDIl|!SBZ]/g, (char) => DIGIT_LOOKALIKES[char] ?? char);

/** A number of minutes from the pill's text ("1586 perc", "101perc", "Operc", "1 586"). */
export function parseMinutes(raw: string): number | null {
  const text = raw.replace(/[()©®°]/g, " ").trim();
  const match = text.match(/^([0-9OoQDIl|!SBZ][0-9OoQDIl|!SBZ\s.,]*?)\s*p\s*[eo]\s*r\s*[ce]\s*e?\.?$/i)
    ?? text.match(/^([0-9OoQDIl|!SBZ][0-9OoQDIl|!SBZ\s.,]*)$/);
  if (!match) return null;
  const digits = toDigits(match[1]).replace(/[\s.,]/g, "");
  if (!/^\d{1,5}$/.test(digits)) return null;
  const minutes = Number(digits);
  return minutes <= MAX_MINUTES ? minutes : null;
}

/** "perc" (or a misreading: "pere", "perce", "porc"), alone or after the number ("101perc"). */
function percPart(text: string): {number: string} | null {
  const match = text.trim().match(/^([0-9OoQDIl|!SBZ]*)([a-zA-Z]{3,5})\.?$/);
  if (!match) return null;
  const letters = match[2].toLowerCase();
  if (levenshtein(letters, "perc") > 1 || !letters.startsWith("p")) return null;
  return {number: match[1]};
}

const isStatus = (text: string) => /online/i.test(stripAccents(text)) || /^(utolj|jelenl)/i.test(stripAccents(text).trim());

/** A member's name: two to five words, letters (initials allowed), no digits. */
export function cleanMemberName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, "");
  if (!/^\p{Lu}[\p{L}' .-]*$/u.test(name) || name.length > 48) return null;
  const words = name.split(" ");
  if (words.length < 2 || words.length > 5) return null;
  // Single letters are initials ("Eriksen T Brownie"), but not at the start or the end.
  if (words.some((word, index) => word.replace(/[^\p{L}]/gu, "").length < 2 && (index === 0 || index === words.length - 1))) return null;
  if (isStatus(name)) return null;
  return name;
}

/**
 * The rows of a picture from the first pass's lines: every "perc" pill with the name left of
 * it (in the names' column, at the top of the block), and names whose pill was not readable.
 */
export function findDutyRows(lines: OcrLineLike[]): DutyRow[] {
  // The pills: a "perc" word, its number in the same word or the word before it.
  const pills: {box: OcrBox; number: string}[] = [];
  for (const line of lines) {
    line.words.forEach((word, index) => {
      const part = percPart(word.text);
      if (!part) return;
      let number = part.number;
      let x0 = word.bbox.x0;
      const before = line.words[index - 1];
      const h = height(word.bbox);
      if (!number && before && word.bbox.x0 - before.bbox.x1 < h * 2 && /[0-9OoQDIl|!SBZ]/.test(before.text) && !/[a-z]{2}/i.test(toDigits(before.text))) {
        number = before.text;
        x0 = before.bbox.x0;
      }
      pills.push({box: {x0, y0: Math.min(word.bbox.y0, before?.bbox.y0 ?? word.bbox.y0), x1: word.bbox.x1, y1: word.bbox.y1}, number});
    });
  }

  // The names' column: where the status lines start (otherwise where most name-like lines start).
  const statuses = lines.filter((line) => isStatus(line.text));
  const nameLike = lines.filter((line) => !isStatus(line.text) && cleanMemberName(line.text));
  let column: number | null = statuses.length ? median(statuses.map((line) => line.bbox.x0)) : null;
  if (column === null && nameLike.length) {
    const buckets = new Map<number, number>();
    nameLike.forEach((line) => buckets.set(Math.round(line.bbox.x0 / 20), (buckets.get(Math.round(line.bbox.x0 / 20)) ?? 0) + 1));
    const best = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
    column = best[0] * 20;
  }
  if (column === null) return [];
  const inColumn = (line: OcrLineLike) => Math.abs(line.bbox.x0 - column!) <= Math.max(12, height(line.bbox) * 1.5);
  const names = nameLike.filter(inColumn).sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const used = new Set<OcrLineLike>();
  const rows: DutyRow[] = [];
  for (const pill of [...pills].sort((a, b) => a.box.y0 - b.box.y0)) {
    const h = height(pill.box);
    const middle = centerY(pill.box);
    const candidates = names.filter((line) => !used.has(line) && line.bbox.x1 < pill.box.x0
      && centerY(line.bbox) <= middle + h * 0.4 && centerY(line.bbox) >= middle - h * 2.4);
    const best = candidates.sort((a, b) => Math.abs(centerY(a.bbox) - (middle - h)) - Math.abs(centerY(b.bbox) - (middle - h)))[0];
    if (!best) continue;
    used.add(best);
    rows.push({name: cleanMemberName(best.text)!, nameBox: best.bbox, minutes: parseMinutes(pill.number), valueBox: pill.box});
  }
  // Names of a member block (a status line right under them) whose pill was not read.
  for (const line of names) {
    if (used.has(line)) continue;
    const h = height(line.bbox);
    const status = statuses.find((item) => item.bbox.y0 >= line.bbox.y0 + h * 0.5 && item.bbox.y0 - line.bbox.y1 < h * 1.6 && inColumn(item));
    if (status) rows.push({name: cleanMemberName(line.text)!, nameBox: line.bbox, minutes: null, valueBox: null});
  }
  return rows.sort((a, b) => a.nameBox.y0 - b.nameBox.y0);
}

/**
 * The value of several readings: the most frequent one; ties go to the reading listed first.
 * `certain` when at least two readings agree and none differs.
 */
export function vote<T>(candidates: (T | null | undefined)[]): {value: T | null; certain: boolean} {
  const counts = new Map<T, number>();
  candidates.forEach((candidate) => {
    if (candidate !== null && candidate !== undefined) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  });
  let best: T | null = null;
  let bestCount = 0;
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const count = counts.get(candidate) ?? 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return {value: best, certain: counts.size === 1 && bestCount >= 2};
}

// --- Matching the names with the members ---------------------------------------------------

export const nameKey = (name: string) => stripAccents(name).toLowerCase().replace(/[^a-z]/g, "");

export interface MemberLike {
  id: string;
  full_name: string;
}

/** The member with this name: exact (accents, case, dots and spaces aside) or a close spelling. */
export function matchMember<M extends MemberLike>(name: string, members: M[]): {member: M; exact: boolean} | null {
  const key = nameKey(name);
  if (key.length < 4) return null;
  const exact = members.filter((member) => nameKey(member.full_name) === key);
  if (exact.length === 1) return {member: exact[0], exact: true};
  if (exact.length > 1) return null;
  const allowed = Math.max(1, Math.floor(key.length / 8));
  const scored = members.map((member) => ({member, distance: levenshtein(nameKey(member.full_name), key)}))
    .filter((item) => item.distance <= allowed).sort((a, b) => a.distance - b.distance);
  if (scored.length && !(scored.length > 1 && scored[1].distance === scored[0].distance)) return {member: scored[0].member, exact: false};
  // A name cut at the edge of the picture ("Harvey Coo"): the only member whose name starts so.
  if (key.length >= 6) {
    const starting = members.filter((member) => {
      const memberKey = nameKey(member.full_name);
      return memberKey.startsWith(key) && key.length >= memberKey.length * 0.7;
    });
    if (starting.length === 1) return {member: starting[0], exact: false};
  }
  return null;
}

export type DutyStatus = "ok" | "doubtful" | "missing";

export interface DutyReading {
  name: string;
  minutes: number | null;
  /** Every reading of the number agreed (and the same member on several pictures too). */
  certain: boolean;
}

export interface MergedDutyRow<M extends MemberLike, R extends DutyReading = DutyReading> {
  /** The name as read (the first picture that had it). */
  name: string;
  member: M | null;
  /** The name matched a member only by a close spelling. */
  fuzzyName: boolean;
  minutes: number | null;
  /** The pictures agree on the number and it was read surely (whatever the name match). */
  certain: boolean;
  status: DutyStatus;
  /** The readings of the pictures (the first one shows best what was read). */
  readings: R[];
}

/**
 * The rows of every picture, one per member: a member on several pictures (overlapping
 * screenshots) gets the reading the pictures agree on; differing readings are doubtful.
 */
export function mergeDutyRows<M extends MemberLike, R extends DutyReading>(readings: R[], members: M[]): MergedDutyRow<M, R>[] {
  const groups = new Map<string, {name: string; member: M | null; fuzzy: boolean; readings: R[]}>();
  for (const reading of readings) {
    const match = matchMember(reading.name, members);
    const key = match ? `member:${match.member.id}` : `name:${nameKey(reading.name)}`;
    const group = groups.get(key) ?? {name: reading.name, member: match?.member ?? null, fuzzy: !!match && !match.exact, readings: []};
    group.readings.push(reading);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const values = group.readings.map((reading) => reading.minutes);
    const known = values.filter((value): value is number => value !== null);
    const {value} = vote(values);
    const agree = new Set(known).size <= 1;
    const certain = agree && group.readings.some((reading) => reading.certain && reading.minutes !== null);
    const status: DutyStatus = value === null ? "missing" : certain && !group.fuzzy ? "ok" : "doubtful";
    return {name: group.name, member: group.member, fuzzyName: group.fuzzy, minutes: value, certain: certain && value !== null, status, readings: group.readings};
  });
}

/**
 * Whether the pictures are worth using: rejected when nothing was found, when no name is a
 * member, or when most numbers could not be read (something is wrong with the pictures).
 */
export function judgeDutyScan<M extends MemberLike, R extends DutyReading>(rows: MergedDutyRow<M, R>[]): {ok: true} | {ok: false; reason: string} {
  const matched = rows.filter((row) => row.member);
  if (!rows.length) return {ok: false, reason: "Nem találtunk taglistát a képeken."};
  if (!matched.length) return {ok: false, reason: "A képeken lévő nevek egyike sem tagja az állománynak."};
  const missing = matched.filter((row) => row.status === "missing").length;
  const doubtful = matched.filter((row) => row.status === "doubtful").length;
  if (missing * 2 > matched.length || (missing + doubtful) * 4 > matched.length * 3) {
    return {ok: false, reason: "A duty idők nagy része nem olvasható biztosan a képeken."};
  }
  return {ok: true};
}
