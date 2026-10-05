import {supabase} from "@/lib/supabaseClient";
import type {TrainingId} from "./catalog";

export type TrainingStatus = "completed" | "skipped";

export interface TrainingRecord {
  training_id: string;
  status: TrainingStatus;
  version: number;
  updated_at: string;
}

export type ProgressMap = Partial<Record<TrainingId, TrainingRecord>>;

const storageKey = (userId: string) => `frakhub.training.${userId}`;

/**
 * The progress is stored in the database (any device) and mirrored in localStorage, so a member who
 * has played every training of their rank loads nothing extra: the table is read only when the local
 * copy misses a training (new rank, new device) and on the profile page.
 */
export function readLocalProgress(userId: string): ProgressMap {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) as ProgressMap : {};
  } catch {
    return {};
  }
}

function writeLocalProgress(userId: string, progress: ProgressMap) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(progress));
  } catch {
    // private mode / full storage: the database still has it
  }
}

export async function fetchProgress(userId: string): Promise<ProgressMap> {
  const {data, error} = await supabase.from("training_progress").select("training_id, status, version, updated_at").eq("user_id", userId);
  if (error) throw error;
  const progress = Object.fromEntries(((data ?? []) as TrainingRecord[]).map((row) => [row.training_id, row])) as ProgressMap;
  writeLocalProgress(userId, progress);
  return progress;
}

export async function saveProgress(userId: string, trainingId: TrainingId, status: TrainingStatus, version: number): Promise<TrainingRecord> {
  const record: TrainingRecord = {training_id: trainingId, status, version, updated_at: new Date().toISOString()};
  writeLocalProgress(userId, {...readLocalProgress(userId), [trainingId]: record});
  const {error} = await supabase.from("training_progress")
    .upsert({user_id: userId, ...record}, {onConflict: "user_id,training_id"});
  if (error) throw error;
  return record;
}
