import {fromHungarian} from "@/lib/datetime";
import {eventEnd, isInAudience, organisableAudiences, type EventStatus} from "@/lib/events";
import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

/** The demo calendar: a meeting to answer, a training, an exam day, a past action and a cancelled event. */
export function seedEvents(world: World) {
  const {tables, me, ago} = world;
  const at = (dayOffset: number, time: string) => fromHungarian(world.day(dayOffset), time);
  const event = (fields: Row): Row => ({
    description: null, ends_at: null, location: null, audience: "all", rsvp: true, cancelled_at: null, created_at: ago(4 * DAY),
    created_by: person(1), updated_at: ago(2 * DAY), updated_by: null, ...fields,
  });
  tables.events = [
    event({id: DEMO.event(1), title: "Heti állománygyűlés", kind: "meeting", starts_at: at(2, "20:00"), ends_at: at(2, "21:00"),
      location: "Downtown Station, eligazító",
      description: "Napirend: a hét értékelése, előléptetések, a havi duty idők rögzítése. Egyenruhában gyere, és hozd a heti jelentéseid listáját."}),
    event({id: DEMO.event(2), title: "Üldözéses vezetés gyakorlat", kind: "training", starts_at: at(5, "18:00"), ends_at: at(5, "20:00"),
      location: "Angel Pine, régi repülőtér", created_by: person(2),
      description: "Gyakorlás párban: követés, PIT manőver, blokád. A járműveket a logisztika biztosítja."}),
    event({id: DEMO.event(3), title: "Felvételi vizsganap", kind: "exam", starts_at: at(9, "19:00"), location: "Downtown Station, tanterem",
      audience: "staff", rsvp: true, created_by: person(2),
      description: "A jelentkezők írásbeli vizsgája és az elbeszélgetések. Két felügyelőt kérünk a felügyelethez."}),
    event({id: DEMO.event(4), title: "Kitüntetési ünnepség", kind: "ceremony", starts_at: at(12, "20:30"), location: "Városháza lépcsője",
      rsvp: false, description: "Díszegyenruha kötelező. A kitüntetettek névsorát a gyűlésen hirdetjük ki."}),
    event({id: DEMO.event(5), title: "Közös akció a kikötőben", kind: "patrol", starts_at: at(-3, "21:00"), ends_at: at(-3, "23:00"),
      location: "San Fierro kikötő", created_by: person(5), created_at: ago(8 * DAY)}),
    event({id: DEMO.event(6), title: "Lőtéri edzés", kind: "training", starts_at: at(4, "17:00"), location: "Fort Carson lőtér",
      cancelled_at: ago(6 * 60), created_by: person(2)}),
  ];
  const answer = (eventId: string, userId: string, status: EventStatus, note: string | null = null): Row =>
    ({event_id: eventId, user_id: userId, status, note, updated_at: ago(DAY)});
  tables.event_responses = [
    ...[2, 3, 5, 6, 8, 9].map((n) => answer(DEMO.event(1), person(n), "going")),
    answer(DEMO.event(1), person(10), "maybe", "Csak 20:30-tól tudok jönni."),
    answer(DEMO.event(1), person(11), "absent", "Szabadságon leszek."),
    ...[5, 9, 10].map((n) => answer(DEMO.event(2), person(n), "going")),
    answer(DEMO.event(2), me.id, "maybe"),
    ...[1, 2].map((n) => answer(DEMO.event(3), person(n), "going")),
    ...[2, 5, 6, 8, 9].map((n) => answer(DEMO.event(5), person(n), "going")),
    answer(DEMO.event(5), me.id, "going"),
  ];
}

const canManage = (world: World, row: Row) => organisableAudiences(world.me).includes(String(row.audience));

const visible = (world: World, row: Row) => isInAudience(world.me, String(row.audience)) || canManage(world, row);

const countsOf = (world: World, eventId: unknown) => {
  const rows = (world.tables.event_responses ?? []).filter((row) => row.event_id === eventId);
  return {
    going: rows.filter((row) => row.status === "going").length,
    maybe: rows.filter((row) => row.status === "maybe").length,
    absent: rows.filter((row) => row.status === "absent").length,
  };
};

/** The next events of the dashboard (same rule as get_dashboard_summary()). */
export function upcomingEvents(world: World) {
  const now = Date.now();
  return (world.tables.events ?? [])
    .filter((row) => !row.cancelled_at && visible(world, row)
      && eventEnd({starts_at: String(row.starts_at), ends_at: row.ends_at as string | null}) > now
      && Date.parse(String(row.starts_at)) < now + 14 * DAY * 60_000)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
    .slice(0, 3)
    .map((row) => ({
      id: row.id, title: row.title, kind: row.kind, starts_at: row.starts_at, ends_at: row.ends_at, location: row.location, rsvp: row.rsvp,
      my_status: (world.tables.event_responses ?? []).find((answer) => answer.event_id === row.id && answer.user_id === world.me.id)?.status ?? null,
    }));
}

export const eventsRpc: Record<string, RpcHandler> = {
  get_events: (args, world) => {
    const from = Date.parse(String(args._from));
    const to = Date.parse(String(args._to));
    return (world.tables.events ?? [])
      .filter((row) => Date.parse(String(row.starts_at)) < to && Date.parse(String(row.ends_at ?? row.starts_at)) >= from && visible(world, row))
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
      .map((row) => {
        const manage = canManage(world, row);
        const answers = (world.tables.event_responses ?? []).filter((answer) => answer.event_id === row.id);
        const mine = answers.find((answer) => answer.user_id === world.me.id);
        return {
          ...row,
          created_by_name: world.person(row.created_by as string)?.full_name ?? null,
          can_manage: manage,
          my_status: mine?.status ?? null,
          my_note: mine?.note ?? null,
          counts: countsOf(world, row.id),
          responses: answers.map((answer) => {
            const who = world.person(answer.user_id as string);
            return {
              user_id: answer.user_id, status: answer.status, full_name: who?.full_name ?? "Ismeretlen", badge_number: who?.badge_number ?? null,
              faction_rank: who?.faction_rank ?? null, avatar_url: who?.avatar_url ?? null,
              note: answer.user_id === world.me.id || manage ? answer.note : null,
            };
          }).sort((a, b) => String(a.status).localeCompare(String(b.status)) || String(a.full_name).localeCompare(String(b.full_name), "hu")),
        };
      });
  },

  respond_to_event: (args, world) => {
    const row = (world.tables.events ?? []).find((item) => item.id === args._event_id);
    if (!row || !visible(world, row)) throw new SandboxError("Az esemény nem található.", "P0002");
    if (!row.rsvp) throw new SandboxError("Ehhez az eseményhez nem kell jelezni a részvételt.");
    if (row.cancelled_at) throw new SandboxError("Az esemény elmarad.");
    if (eventEnd({starts_at: String(row.starts_at), ends_at: row.ends_at as string | null}) < Date.now()) {
      throw new SandboxError("Az esemény már véget ért.");
    }
    const answers = (world.tables.event_responses ??= []);
    const index = answers.findIndex((answer) => answer.event_id === row.id && answer.user_id === world.me.id);
    if (index >= 0) answers.splice(index, 1);
    const status = args._status as EventStatus | null;
    if (status) {
      const note = typeof args._note === "string" && args._note.trim() ? args._note.trim().slice(0, 200) : null;
      answers.push({event_id: row.id, user_id: world.me.id, status, note, updated_at: world.stamp()});
    }
    return countsOf(world, row.id);
  },
};
