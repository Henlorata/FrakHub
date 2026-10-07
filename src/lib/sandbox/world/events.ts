import {fromHungarian} from "@/lib/datetime";
import {eventEnd, isInAudience, organisableAudiences, type EventStatus} from "@/lib/events";
import type {FleetSubject} from "@/lib/fleet";
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
      description: "A jelentkezők írásbeli vizsgája és az elbeszélgetések. Két Supervisory Staff tagot kérünk a felügyelethez."}),
    event({id: DEMO.event(4), title: "Kitüntetési ünnepség", kind: "ceremony", starts_at: at(12, "20:30"), location: "Városháza lépcsője",
      rsvp: false, description: "Díszegyenruha kötelező. A kitüntetettek névsorát a gyűlésen hirdetjük ki."}),
    event({id: DEMO.event(5), title: "Közös akció a kikötőben", kind: "patrol", starts_at: at(-3, "21:00"), ends_at: at(-3, "23:00"),
      location: "San Fierro kikötő", created_by: person(5), created_at: ago(8 * DAY), attendance_taken_at: ago(2 * DAY), attendance_taken_by: person(5)}),
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
  // The past action's attendance: the member was there, one who said they come was not.
  tables.event_attendance = [...[2, 5, 6, 9].map((n) => person(n)), me.id]
    .map((userId) => ({event_id: DEMO.event(5), user_id: userId, recorded_by: person(5), recorded_at: ago(2 * DAY)}));
  // The one who answered "Szabadságon leszek" has an approved leave over the meeting.
  (tables.hr_records ??= []).push({
    id: world.id(), user_id: person(11), kind: "leave", title: "Szabadság", details: null, starts_on: world.day(1), ends_on: world.day(3),
    status: "active", created_by: person(11), created_at: ago(3 * DAY), decided_by: person(2), decided_at: ago(2 * DAY),
  });
}

const attendeesOf = (world: World, eventId: unknown) =>
  (world.tables.event_attendance ?? []).filter((row) => row.event_id === eventId).map((row) => String(row.user_id));

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

/** A demo plan member (the stored plan keeps the names, like the server's JSON). */
function planMember(world: World, userId: string, vehicleId: string | null, callsign: string, note = ""): Row {
  const who = world.person(userId);
  const vehicle = vehicleId ? (world.tables.fleet_vehicles ?? []).find((row) => row.id === vehicleId) : undefined;
  return {
    user_id: userId, full_name: who?.full_name ?? "Ismeretlen", faction_rank: who?.faction_rank ?? null, badge_number: who?.badge_number ?? null,
    avatar_url: who?.avatar_url ?? null, callsign: callsign || null, note: note || null,
    vehicle: vehicle ? {id: vehicle.id, plate: vehicle.plate, model: vehicle.model, callsign: vehicle.callsign ?? null} : null,
  };
}

/** The past joint action has a plan and a report, so the dialog shows something in practice mode. */
export function seedOperations(world: World) {
  const plan: Row = {
    event_id: DEMO.event(5), objective: "A kikötői raktár átvizsgálása és a fegyverszállítmány lefoglalása.",
    situation: "Három-négy fegyveres a raktárban, egy kisteherautó a hátsó kapunál. A MCB megfigyelése szerint 21:30-kor rakodnak.",
    execution: "1. Gyülekezés a 3-as kapunál.\n2. A külső biztosítás lezárja a két kijáratot.\n3. A behatoló csapat a főbejáraton megy be.\n4. Elfogás után átvizsgálás, lefoglalás.",
    radio_channel: "3", rally_point: "Kikötő, 3-as kapu", rally_at: world.ago(3 * DAY + 30), updated_at: world.ago(3 * DAY + 120),
    updated_by_name: world.person(person(5))?.full_name ?? null, case: null,
    roles: [
      {id: world.id(), name: "Behatoló csapat", task: "Belépés a főbejáraton, a raktér biztosítása.", callsign: "ADAM", sort_order: 1,
        members: [planMember(world, person(5), null, "2-ADAM-1"), planMember(world, world.me.id, null, "2-ADAM-2")]},
      {id: world.id(), name: "Külső biztosítás", task: "A két kijárat lezárása, a kisteherautó megállítása.", callsign: "BOY", sort_order: 2,
        members: [planMember(world, person(2), null, "2-BOY-1"), planMember(world, person(9), null, "2-BOY-2")]},
    ],
    report: {outcome: "partial", summary: "Két gyanúsított elfogva, egy elmenekült a hátsó kerítésen át. Hat fegyver lefoglalva.",
      went_well: "Gyors behatolás, tiszta rádióforgalmazás.", improve: "A hátsó kerítéshez is kell egy egység.",
      at: world.ago(2 * DAY), by_name: world.person(person(5))?.full_name ?? null},
  };
  world.tables.event_operations = [{event_id: DEMO.event(5), plan}];
}

const storedPlan = (world: World, eventId: unknown) =>
  ((world.tables.event_operations ?? []).find((row) => row.event_id === eventId)?.plan as Row | undefined) ?? null;

const planSummary = (plan: Row | null, myId: string) => {
  if (!plan) return null;
  const roles = (plan.roles as Row[]) ?? [];
  return {
    roles: roles.length,
    assigned: roles.reduce((sum, role) => sum + ((role.members as Row[]) ?? []).length, 0),
    my_role: (roles.find((role) => ((role.members as Row[]) ?? []).some((member) => member.user_id === myId))?.name as string) ?? null,
    report: !!plan.report,
  };
};

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
        const attendees = attendeesOf(world, row.id);
        const taken = row.attendance_taken_at ?? null;
        return {
          ...row,
          attendance_taken_at: taken,
          attended_count: taken ? attendees.length : null,
          i_attended: taken ? attendees.includes(world.me.id) : null,
          attendee_ids: manage ? attendees : null,
          created_by_name: world.person(row.created_by as string)?.full_name ?? null,
          can_manage: manage,
          my_status: mine?.status ?? null,
          my_note: mine?.note ?? null,
          counts: countsOf(world, row.id),
          operation: planSummary(storedPlan(world, row.id), world.me.id),
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

  get_event_operation: (args, world) => {
    const row = (world.tables.events ?? []).find((item) => item.id === args._event_id);
    if (!row || !visible(world, row)) throw new SandboxError("Az esemény nem található.", "P0002");
    return storedPlan(world, row.id);
  },

  save_event_operation: (args, world) => {
    const row = (world.tables.events ?? []).find((item) => item.id === args._event_id);
    if (!row) throw new SandboxError("Az esemény nem található.", "P0002");
    if (!canManage(world, row)) throw new SandboxError("A műveleti tervet az esemény szervezői írják.", "42501");
    const draft = (args._plan ?? {}) as Row;
    const previous = storedPlan(world, row.id);
    const plan: Row = {
      event_id: row.id, objective: draft.objective || null, situation: draft.situation || null, execution: draft.execution || null,
      radio_channel: draft.radio_channel || null, rally_point: draft.rally_point || null, rally_at: draft.rally_at || null,
      updated_at: world.stamp(), updated_by_name: world.me.full_name, case: null, report: previous?.report ?? null,
      roles: ((draft.roles as Row[]) ?? []).map((role, index) => ({
        id: (role.id as string) || world.id(), name: role.name, task: role.task || null, callsign: role.callsign || null, sort_order: index + 1,
        members: ((role.members as Row[]) ?? []).map((member) =>
          planMember(world, member.user_id as string, (member.vehicle_id as string) ?? null, String(member.callsign ?? ""), String(member.note ?? ""))),
      })),
    };
    world.tables.event_operations = [...(world.tables.event_operations ?? []).filter((item) => item.event_id !== row.id), {event_id: row.id, plan}];
    return plan;
  },

  delete_event_operation: (args, world) => {
    world.tables.event_operations = (world.tables.event_operations ?? []).filter((item) => item.event_id !== args._event_id);
    return null;
  },

  save_operation_report: (args, world) => {
    const plan = storedPlan(world, args._event_id);
    if (!plan) throw new SandboxError("Előbb készíts műveleti tervet.");
    const report = (args._report ?? {}) as Row;
    plan.report = {outcome: report.outcome, summary: report.summary || null, went_well: report.went_well || null, improve: report.improve || null,
      at: world.stamp(), by_name: world.me.full_name};
    return plan;
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

  set_event_attendance: (args, world) => {
    const row = (world.tables.events ?? []).find((item) => item.id === args._event_id);
    if (!row || !visible(world, row)) throw new SandboxError("Az esemény nem található.", "P0002");
    if (!canManage(world, row)) throw new SandboxError("A jelenlétet az esemény szervezője rögzíti.", "42501");
    if (row.cancelled_at) throw new SandboxError("Elmaradt eseményhez nem rögzíthető jelenlét.");
    if (Date.parse(String(row.starts_at)) > Date.now()) throw new SandboxError("A jelenlétet az esemény kezdete után rögzítheted.");
    const ids = [...new Set((args._user_ids as string[] | null) ?? [])].filter((id) => world.person(id) || id === world.me.id);
    world.tables.event_attendance = [
      ...(world.tables.event_attendance ?? []).filter((item) => item.event_id !== row.id),
      ...ids.map((userId) => ({event_id: row.id, user_id: userId, recorded_by: world.me.id, recorded_at: world.stamp()})),
    ];
    row.attendance_taken_at = world.stamp();
    row.attendance_taken_by = world.me.id;
    return {attended: ids.length, attendance_taken_at: row.attendance_taken_at};
  },

  get_member_attendance: (args, world) => {
    const target = String(args._user_id ?? world.me.id);
    const who = target === world.me.id ? world.me : world.person(target);
    const since = Date.now() - 90 * DAY * 60_000;
    const events = (world.tables.events ?? [])
      .filter((row) => row.attendance_taken_at && !row.cancelled_at && Date.parse(String(row.starts_at)) >= since
        && Date.parse(String(row.starts_at)) <= Date.now() && visible(world, row)
        && ((who && isInAudience(who as unknown as FleetSubject, String(row.audience))) || attendeesOf(world, row.id).includes(target)))
      .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)))
      .map((row) => ({
        id: row.id, title: row.title, kind: row.kind, starts_at: row.starts_at, audience: row.audience,
        response: (world.tables.event_responses ?? []).find((answer) => answer.event_id === row.id && answer.user_id === target)?.status ?? null,
        attended: attendeesOf(world, row.id).includes(target),
      }));
    return {attended: events.filter((item) => item.attended).length, total: events.length, events};
  },

  get_absences: (args, world) => (world.tables.hr_records ?? [])
    .filter((row) => row.kind === "leave" && row.status === "active" && String(row.starts_on) <= String(args._to) && String(row.ends_on) >= String(args._from))
    .map((row) => {
      const who = row.user_id === world.me.id ? world.me : world.person(row.user_id as string);
      return {
        user_id: row.user_id, full_name: who?.full_name ?? "Ismeretlen", badge_number: who?.badge_number ?? null, faction_rank: who?.faction_rank ?? null,
        avatar_url: who?.avatar_url ?? null, starts_on: row.starts_on, ends_on: row.ends_on,
      };
    })
    .sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on))),
};
