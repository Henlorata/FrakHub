import {DEFAULT_CATALOG} from "@/lib/bureaus";
import type {Row} from "../postgrest";
import {SandboxError, type RpcHandler, type World} from "./context";

/** The bureaus' ranks and titles in the demo world (HR page "Osztályok", member sheet). */

const DEMO_TITLES = [
  {id: "de-title-medic", division: "SEB", name: "Medic", icon: "heart-pulse", tone: "rose", description: "Az egység egészségügyi ellátója a bevetéseken.", sort_order: 10},
  {id: "de-title-marksman", division: "SEB", name: "Marksman", icon: "crosshair", tone: "amber", description: "Kijelölt lövész: távolsági fedezet és megfigyelés.", sort_order: 20},
];

export function seedBureaus(world: World) {
  world.tables.division_ranks = DEFAULT_CATALOG.ranks.map((rank) => ({...rank, id: rank.id.replace("default-", "de-rank-")}));
  world.tables.division_titles = DEMO_TITLES.map((title) => ({...title}));
  // A demo operator with a title, so the badges show in practice mode.
  const operator = (world.tables.profiles ?? []).find((row) => row.division === "SEB" && row.id !== world.me.id && !row.is_bureau_commander);
  if (operator) operator.division_titles = ["de-title-medic"];
}

const ranks = (world: World) => (world.tables.division_ranks ??= []);
const titles = (world: World) => (world.tables.division_titles ??= []);
const sorted = (rows: Row[]) => [...rows].sort((a, b) => String(a.division).localeCompare(String(b.division))
  || Number(a.sort_order) - Number(b.sort_order));

const nextOrder = (rows: Row[], division: unknown) =>
  Math.max(0, ...rows.filter((row) => row.division === division).map((row) => Number(row.sort_order))) + 10;

const reorder = (rows: Row[], division: unknown, ids: unknown) => {
  ((ids as string[]) ?? []).forEach((id, index) => {
    const row = rows.find((item) => item.id === id && item.division === division);
    if (row) row.sort_order = (index + 1) * 10;
  });
  return null;
};

export const bureauRpc: Record<string, RpcHandler> = {
  get_bureau_catalog: (_args, world) => ({ranks: sorted(ranks(world)), titles: sorted(titles(world))}),
  save_division_rank: (args, world) => {
    const name = String(args._name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2) throw new SandboxError("A rang neve 2–40 karakter lehet.");
    if (args._id) {
      const row = ranks(world).find((item) => item.id === args._id);
      if (!row) throw new SandboxError("A rang nem található.");
      for (const person of world.tables.profiles ?? []) {
        if (person.division === row.division && person.division_rank === row.name) person.division_rank = name;
      }
      Object.assign(row, {name, privileged: typeof args._privileged === "boolean" ? args._privileged : row.privileged});
      return row;
    }
    const row: Row = {id: world.id(), division: args._division, name, sort_order: nextOrder(ranks(world), args._division), privileged: !!args._privileged};
    ranks(world).push(row);
    return row;
  },
  delete_division_rank: (args, world) => {
    const row = ranks(world).find((item) => item.id === args._id);
    if (!row) throw new SandboxError("A rang nem található.");
    const target = args._move_to ? ranks(world).find((item) => item.id === args._move_to) : null;
    let moved = 0;
    for (const person of world.tables.profiles ?? []) {
      if (person.division === row.division && person.division_rank === row.name) {
        person.division_rank = target?.name ?? null;
        moved += 1;
      }
    }
    world.tables.division_ranks = ranks(world).filter((item) => item.id !== row.id);
    return moved;
  },
  reorder_division_ranks: (args, world) => reorder(ranks(world), args._division, args._ids),
  save_division_title: (args, world) => {
    const fields = {name: String(args._name ?? "").trim(), icon: args._icon, tone: args._tone, description: args._description ?? null};
    if (args._id) {
      const row = titles(world).find((item) => item.id === args._id);
      if (!row) throw new SandboxError("A cím nem található.");
      return Object.assign(row, fields);
    }
    const row: Row = {id: world.id(), division: args._division, ...fields, sort_order: nextOrder(titles(world), args._division)};
    titles(world).push(row);
    return row;
  },
  delete_division_title: (args, world) => {
    let holders = 0;
    for (const person of world.tables.profiles ?? []) {
      const held = (person.division_titles as string[] | undefined) ?? [];
      if (held.includes(String(args._id))) {
        person.division_titles = held.filter((id) => id !== args._id);
        holders += 1;
      }
    }
    world.tables.division_titles = titles(world).filter((item) => item.id !== args._id);
    return holders;
  },
  reorder_division_titles: (args, world) => reorder(titles(world), args._division, args._ids),
};
