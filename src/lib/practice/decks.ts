import {Gavel, Radio, type LucideIcon} from "lucide-react";
import {BASIC_CODES, DIVISION_NUMBERS, TEN_CODES, UNIT_TYPES} from "@/data/radio-codes";
import {ITEMS} from "@/pages/calculator/penal-data";
import {formatCurrency, formatJailTime} from "@/lib/penalcode-processor";
import type {Tone} from "@/components/layout/PageHeader";
import type {CardState} from "./srs";

/**
 * The practice decks: every card can be asked in a few ways, harder ones as the card climbs the
 * boxes (code -> meaning first, meaning -> code later; for the penal code: abbreviation, then fine
 * or jail range, then the abbreviation from the name).
 */

export type DeckId = "radio" | "penal";

export interface PracticeCard {
  id: string;
  /** Group the wrong options are taken from first (similar cards are harder to tell apart). */
  group: string;
  /** What the weak-spot list and the summary show. */
  label: string;
  detail: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  mono?: boolean;
}

export interface Question {
  cardId: string;
  title: string;
  prompt: string;
  promptMono?: boolean;
  sub?: string;
  options: QuestionOption[];
  correct: string;
  /** Shown after answering. */
  explain: string;
}

export interface DeckDefinition {
  id: DeckId;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  cards: PracticeCard[];
  question: (card: PracticeCard, state: CardState | undefined) => Question;
}

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};

/**
 * Up to three wrong options with distinct texts, from the same group first. `alsoRight` leaves out
 * cards that would answer the question too (two offences share an abbreviation, e.g. "KV").
 */
function distractors<T>(card: PracticeCard, cards: PracticeCard[], text: (card: PracticeCard) => T | null, correct: T,
                        alsoRight?: (other: PracticeCard) => boolean): PracticeCard[] {
  const used = new Set<string>([String(correct)]);
  const out: PracticeCard[] = [];
  const pools = [shuffle(cards.filter((other) => other.group === card.group && other.id !== card.id)),
    shuffle(cards.filter((other) => other.group !== card.group))];
  for (const pool of pools) {
    for (const other of pool) {
      if (alsoRight?.(other)) continue;
      const value = text(other);
      if (value === null || used.has(String(value))) continue;
      used.add(String(value));
      out.push(other);
      if (out.length === 3) return out;
    }
  }
  return out;
}

// --- Radio codes ------------------------------------------------------------------------------

const RADIO_GROUPS = [
  {key: "code", terms: BASIC_CODES, label: "Code"},
  {key: "ten", terms: TEN_CODES, label: "10-es kód"},
  {key: "unit", terms: UNIT_TYPES, label: "Egységjel"},
  {key: "division", terms: DIVISION_NUMBERS, label: "Körzetszám"},
] as const;

const RADIO_TERMS = new Map<string, {code: string; meaning: string; group: string}>();
const RADIO_CARDS: PracticeCard[] = RADIO_GROUPS.flatMap((group) => group.terms.map((term) => {
  const id = `${group.key}:${term.code}`;
  RADIO_TERMS.set(id, {code: term.code, meaning: term.meaning, group: group.label});
  return {id, group: group.key, label: term.code, detail: term.meaning};
}));

function radioQuestion(card: PracticeCard, state: CardState | undefined): Question {
  const term = RADIO_TERMS.get(card.id)!;
  // From the third box on, the meaning is given and the code is asked.
  const reverse = (state?.b ?? 1) >= 3;
  const others = distractors(card, RADIO_CARDS, (other) => (reverse ? other.label : other.detail), reverse ? term.code : term.meaning);
  const options = shuffle([card, ...others]).map((option) => ({id: option.id, text: reverse ? option.label : option.detail, mono: reverse}));
  return {
    cardId: card.id, title: reverse ? "Melyik kód jelenti ezt?" : "Mit jelent?", prompt: reverse ? term.meaning : term.code, promptMono: !reverse,
    sub: term.group, options, correct: card.id, explain: `${term.code}: ${term.meaning}`,
  };
}

// --- Penal code -------------------------------------------------------------------------------

const PENAL_CARDS: PracticeCard[] = [...ITEMS.values()].map((item) => ({
  id: item.id, group: item.kategoria_nev, label: item.megnevezes, detail: `${item.paragrafus} · ${item.rovidites}`,
}));

const fineText = (id: string) => {
  const item = ITEMS.get(id);
  if (!item || (item.min_birsag === null && item.max_birsag === null)) return null;
  return `${formatCurrency(item.min_birsag)} – ${formatCurrency(item.max_birsag)}`;
};
const jailText = (id: string) => {
  const item = ITEMS.get(id);
  if (!item || (item.min_fegyhaz === null && item.max_fegyhaz === null)) return null;
  return `${formatJailTime(item.min_fegyhaz)} – ${formatJailTime(item.max_fegyhaz)}`;
};
const fullName = (id: string) => {
  const item = ITEMS.get(id)!;
  return item.fo_tetel_nev ? `${item.fo_tetel_nev} – ${item.megnevezes}` : item.megnevezes;
};

function penalQuestion(card: PracticeCard, state: CardState | undefined): Question {
  const item = ITEMS.get(card.id)!;
  const box = state?.b ?? 1;
  const name = fullName(card.id);
  const explain = `${item.paragrafus} ${name} (${item.rovidites})${fineText(card.id) ? ` · bírság: ${fineText(card.id)}` : ""}${jailText(card.id) ? ` · fegyház: ${jailText(card.id)}` : ""}`;
  // Box 3: the fine (or the jail time when there is no fine) of the offence.
  if (box === 3 && (fineText(card.id) || jailText(card.id))) {
    const fine = !!fineText(card.id);
    const text = fine ? fineText : jailText;
    const others = distractors(card, PENAL_CARDS, (other) => text(other.id), text(card.id)!);
    if (others.length >= 2) {
      return {cardId: card.id, title: fine ? "Mekkora a bírság?" : "Mennyi a fegyház?", prompt: name, sub: `${item.paragrafus} · ${item.kategoria_nev}`,
        options: shuffle([card, ...others]).map((option) => ({id: option.id, text: text(option.id)!, mono: true})), correct: card.id, explain};
    }
  }
  // Box 4-5: the abbreviation from the name.
  if (box >= 4) {
    const others = distractors(card, PENAL_CARDS, (other) => ITEMS.get(other.id)?.rovidites ?? null, item.rovidites);
    return {cardId: card.id, title: "Mi a rövidítése?", prompt: name, sub: item.kategoria_nev,
      options: shuffle([card, ...others]).map((option) => ({id: option.id, text: ITEMS.get(option.id)!.rovidites, mono: true})), correct: card.id, explain};
  }
  // Box 1-2: the offence behind an abbreviation (never two offences with that abbreviation among the options).
  const others = distractors(card, PENAL_CARDS, (other) => fullName(other.id), name,
    (other) => ITEMS.get(other.id)?.rovidites.trim() === item.rovidites.trim());
  return {cardId: card.id, title: "Melyik tétel?", prompt: item.rovidites, promptMono: true, sub: `${item.paragrafus} · ${item.kategoria_nev}`,
    options: shuffle([card, ...others]).map((option) => ({id: option.id, text: fullName(option.id)})), correct: card.id, explain};
}

export const DECKS: Record<DeckId, DeckDefinition> = {
  radio: {
    id: "radio", label: "Rádiókódok", description: "Code-ok, 10-es kódok, egységjelek és körzetszámok.", icon: Radio, tone: "cyan",
    cards: RADIO_CARDS, question: radioQuestion,
  },
  penal: {
    id: "penal", label: "Büntető törvénykönyv", description: "Rövidítések, bírságok és fegyházidők a kalkulátor adataiból.", icon: Gavel,
    tone: "red", cards: PENAL_CARDS, question: penalQuestion,
  },
};

export const DECK_ORDER: DeckId[] = ["radio", "penal"];
