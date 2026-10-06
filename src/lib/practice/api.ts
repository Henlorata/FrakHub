import {supabase} from "@/lib/supabaseClient";
import type {DeckState} from "./srs";

/** Practice data of the member: deck states, streaks, scenarios (one get_practice_overview call). */

export interface DeckProgress {
  cards: DeckState;
  answered: number;
  correct: number;
  sessions: number;
  updated_at: string;
}

export interface ScenarioResult {
  scenario_id: string;
  user_id: string;
  best_score: number;
  max_score: number;
  best_percent: number;
  passed: boolean;
  attempts: number;
  last_run_at: string;
}

export type ScenarioCategory = "traffic" | "patrol" | "arrest" | "radio" | "mcb" | "other";

export const SCENARIO_CATEGORIES: Record<ScenarioCategory, string> = {
  traffic: "Közlekedés", patrol: "Járőrözés", arrest: "Elfogás", radio: "Rádió", mcb: "Nyomozás", other: "Egyéb",
};

export interface ScenarioSummary {
  id: string;
  title: string;
  summary: string | null;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3;
  max_score: number;
  pass_percent: number;
  published: boolean;
  updated_at: string;
  steps: number;
  result: ScenarioResult | null;
  /** Instructors: how many played and passed. */
  stats: {players: number; passed: number} | null;
}

export interface PracticeOverview {
  decks: Partial<Record<string, DeckProgress>>;
  streak: number;
  best_streak: number;
  today: string;
  days: {day: string; answered: number; correct: number}[];
  can_edit: boolean;
  scenarios: ScenarioSummary[];
  certificates: number;
}

export type Verdict = "good" | "ok" | "bad";

export interface ScenarioChoice {
  id: string;
  text: string;
  /** Null: the choice ends the scenario. */
  next: string | null;
  points: number;
  verdict: Verdict;
  feedback?: string;
}

export interface ScenarioNode {
  text?: string;
  choices?: ScenarioChoice[];
  /** An ending (a node without choices). */
  end?: {title?: string; text?: string};
}

export interface Scenario {
  id: string;
  title: string;
  summary: string | null;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3;
  start_node: string;
  nodes: Record<string, ScenarioNode>;
  max_score: number;
  pass_percent: number;
  published: boolean;
  sort_order: number;
  updated_at: string;
  my_result: ScenarioResult | null;
}

export interface ScenarioDraft {
  title: string;
  summary: string | null;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3;
  start_node: string;
  nodes: Record<string, ScenarioNode>;
  pass_percent: number;
  published: boolean;
  sort_order: number;
}

export interface RunResult {
  score: number;
  max_score: number;
  percent: number;
  passed: boolean;
  /** The certificate code when a published scenario was passed. */
  certificate: string | null;
  best: ScenarioResult;
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const practiceApi = {
  overview: () => rpc<PracticeOverview>("get_practice_overview"),
  saveSession: (deck: string, cards: DeckState, answered: number, correct: number) =>
    rpc<{streak: number; best_streak: number; today: {answered: number; correct: number} | null}>("save_practice_session",
      {_deck: deck, _cards: cards, _answered: answered, _correct: correct}),
  scenario: (id: string) => rpc<Scenario>("get_scenario", {_id: id}),
  submitRun: (id: string, choices: string[]) => rpc<RunResult>("submit_scenario_run", {_scenario_id: id, _choices: choices}),
  saveScenario: (id: string | null, draft: ScenarioDraft) => rpc<{id: string; max_score: number; updated_at: string}>("save_scenario",
    {_id: id, _scenario: draft}),
  deleteScenario: (id: string) => rpc<void>("delete_scenario", {_id: id}),
};
