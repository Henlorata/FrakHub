/**
 * Spaced repetition with five Leitner boxes. A right answer moves a card one box up (it comes back
 * later and later), a wrong one sends it back to the first box (asked again in the same session).
 * Pure and alias-free: the practice page and e2e/practice-srs.spec.ts use it.
 */

/** A card's state as stored in practice_progress.cards (short keys keep the row small). */
export interface CardState {
  /** Box 1-5. */
  b: number;
  /** Next due Hungarian day ("2026-10-08"). */
  d: string;
  /** Times it was forgotten. */
  l: number;
}

export type DeckState = Record<string, CardState>;

/** Days until a card in a box is due again (box 1: the same day). */
export const BOX_INTERVALS = [0, 1, 3, 7, 14] as const;
export const MAX_BOX = BOX_INTERVALS.length;

export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** The state after an answer. */
export function answerCard(state: CardState | undefined, right: boolean, today: string): CardState {
  if (!right) return {b: 1, d: today, l: (state?.l ?? 0) + 1};
  const box = Math.min(MAX_BOX, (state?.b ?? 0) + 1);
  return {b: box, d: addDays(today, BOX_INTERVALS[box - 1]), l: state?.l ?? 0};
}

export const isDue = (state: CardState | undefined, today: string) => !state || state.d <= today;

export interface SessionOptions {
  /** Cards in one session. */
  size?: number;
  /** New cards at most (the rest are reviews). */
  newLimit?: number;
  /** Deterministic order for tests. */
  random?: () => number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/**
 * The cards of the next session: due reviews first (the most overdue and the most forgotten first),
 * then a few new ones; when nothing is due, the cards coming up soonest (extra practice).
 */
export function pickSession(ids: string[], state: DeckState, today: string, options: SessionOptions = {}): string[] {
  const size = options.size ?? 12;
  const newLimit = options.newLimit ?? 5;
  const random = options.random ?? Math.random;
  const seen = ids.filter((id) => state[id]);
  const due = seen.filter((id) => isDue(state[id], today))
    .sort((a, b) => state[a].d.localeCompare(state[b].d) || state[b].l - state[a].l || state[a].b - state[b].b);
  const fresh = shuffled(ids.filter((id) => !state[id]), random);
  const picked = [...due.slice(0, size)];
  for (const id of fresh) {
    if (picked.length >= size || picked.length - Math.min(due.length, size) >= newLimit) break;
    picked.push(id);
  }
  if (picked.length < Math.min(size, 4)) {
    // Nothing (much) due: practise the cards coming up next.
    const upcoming = seen.filter((id) => !picked.includes(id)).sort((a, b) => state[a].d.localeCompare(state[b].d) || state[a].b - state[b].b);
    picked.push(...upcoming.slice(0, size - picked.length));
  }
  return shuffled(picked, random);
}

/** Counts for the deck card: how many are due, learnt (box 4+), new. */
export function deckStats(ids: string[], state: DeckState, today: string) {
  let due = 0;
  let learnt = 0;
  let fresh = 0;
  for (const id of ids) {
    const card = state[id];
    if (!card) fresh += 1;
    else {
      if (isDue(card, today)) due += 1;
      if (card.b >= 4) learnt += 1;
    }
  }
  return {total: ids.length, due, learnt, fresh, mastery: ids.length ? learnt / ids.length : 0};
}

/** The cards forgotten most (weak spots), at most `limit`. */
export function weakSpots(state: DeckState, limit = 5): string[] {
  return Object.entries(state).filter(([, card]) => card.l > 0)
    .sort(([, a], [, b]) => b.l - a.l || a.b - b.b).slice(0, limit).map(([id]) => id);
}

/** Drops cards that no longer exist in the deck (a removed code or offence) to keep the row small. */
export function pruneState(state: DeckState, ids: string[]): DeckState {
  const keep = new Set(ids);
  return Object.fromEntries(Object.entries(state).filter(([id]) => keep.has(id)));
}
