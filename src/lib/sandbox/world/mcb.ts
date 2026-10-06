import {builtinTemplates} from "@/lib/case-templates";
import {canApproveWarrants, isMcbLead, seesAllCases} from "@/lib/mcb";
import {canViewCaseList} from "@/lib/utils";
import type {Row} from "../postgrest";
import {DAY, DEMO, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";
import {caseExtras} from "./extras";

export const DEMO_CASE = DEMO.case(1);

// --- BlockNote document helpers -------------------------------------------------------------

type Styles = {bold?: true; italic?: true; textColor?: string};
const text = (value: string, styles: Styles = {}) => ({type: "text", text: value, styles});
const mention = (role: "officer" | "suspect", id: string, user: string) => ({type: "mention", props: {role, id, user}});
const props = {textColor: "default", backgroundColor: "default", textAlignment: "left"};
const heading = (value: string, level = 2) => ({type: "heading", props: {...props, level, isToggleable: false}, content: [text(value)], children: []});
const paragraph = (...content: unknown[]) => ({type: "paragraph", props, content, children: []});
const check = (value: string, checked = false) => ({type: "checkListItem", props: {...props, checked}, content: [text(value)], children: []});
const quote = (value: string) => ({type: "quote", props: {textColor: "default", backgroundColor: "default"}, content: [text(value)], children: []});
const fields = (rows: [string, string][]) => ({
  type: "table", props: {textColor: "default"}, children: [],
  content: {type: "tableContent", columnWidths: [230, 400], rows: rows.map(([label, value]) => ({cells: [[text(label, {bold: true})], [text(value)]]}))},
});
const evidence = (evidenceId: string, caption: string) =>
  ({type: "evidence", props: {evidenceId, caption, layout: "side", width: "full"}, children: []});

function demoDocument(evidenceIds: string[]) {
  return [
    heading("1. Az ügy összefoglalása"),
    paragraph(text("A kikötő 3-as raktáránál három éjszakán át rakodást figyeltünk meg zárás után. A bejelentést "),
      mention("officer", person(6), "Példa Piroska"), text(" rögzítette egy közúti ellenőrzés után.")),
    heading("2. Helyszíni szemle"),
    fields([["Időpont", "Hétfő, 02:40"], ["Helyszín", "Kikötő, 3-as raktár"], ["Jelen voltak", "Próba Panna, Példa Piroska"],
      ["Megállapítások", "Feltört lakat, friss keréknyomok, üres fegyverládák."]]),
    heading("3. Érintett személyek"),
    paragraph(mention("suspect", DEMO.suspect(1), "Csempész Csaba"), text(" bérli a raktárt; "),
      mention("suspect", DEMO.suspect(2), "Gyanús Géza"), text(" vezette a kisteherautót.")),
    quote("„Csak dobozokat pakoltunk, nem néztem bele egyikbe sem.” – Gyanús Géza"),
    heading("4. Bizonyítékok"),
    evidence(evidenceIds[0], "CAM-03: rakodás a 3-as raktárnál, 02:47."),
    evidence(evidenceIds[1], "CAM-11: a kisteherautó rendszáma részben olvasható."),
    heading("5. Teendők"),
    check("Térfigyelő felvételek bekérése", true),
    check("Gyanús Géza kihallgatása"),
    check("Házkutatási parancs a 3-as raktárra"),
    paragraph(text("Gyakorló mód: ", {bold: true}), text("ide nyugodtan írhatsz, semmi sem mentődik.", {italic: true, textColor: "gray"})),
  ];
}

// --- Seed ----------------------------------------------------------------------------------

export function seedMcb(world: World) {
  const {tables, me, ago} = world;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const mcbMember = me.division === "MCB";

  tables.suspects = [
    ["Csempész Csaba", "A Kapitány", "male", "Kikötői Banda", "wanted", "Magas, kopasz, a bal karján horgony tetoválás."],
    ["Gyanús Géza", "Gép", "male", "Kikötői Banda", "free", "Sofőr, gyakran a Dock Roadon látható."],
    ["Rejtély Rozi", null, "female", null, "free", "Tanú: a szemközti büfé tulajdonosa."],
    ["Kétes Károly", "Kari", "male", "Grove Street Families", "jailed", null],
    ["Hamis Hanna", "Hópehely", "female", "Ballas", "wanted", "Okmányhamisítás gyanúja."],
    ["Nyomtalan Norbert", null, "male", null, "unknown", null],
  ].map(([full_name, alias, gender, gang, status, description], index) => ({
    id: DEMO.suspect(index + 1), full_name, alias, gender, gang_affiliation: gang, status, description, mugshot_url: null,
    created_by: person(index % 2 ? 6 : 4), created_at: ago((40 - index * 5) * DAY), updated_at: ago((10 - index) * DAY),
  }));
  tables.suspect_properties = [
    {id: world.id(), suspect_id: DEMO.suspect(1), address: "Kikötő, 3-as raktár", property_type: "warehouse", notes: "Bérelt raktár.", created_at: ago(20 * DAY)},
    {id: world.id(), suspect_id: DEMO.suspect(1), address: "Ocean Docks 12.", property_type: "house", notes: null, created_at: ago(20 * DAY)},
    {id: world.id(), suspect_id: DEMO.suspect(5), address: "Idlewood, Ganton u. 4.", property_type: "apartment", notes: null, created_at: ago(12 * DAY)},
  ];
  tables.suspect_vehicles = [
    {id: world.id(), suspect_id: DEMO.suspect(2), plate_number: "4KUF 271", vehicle_type: "Rumpo", color: "fehér", notes: "Kisteherautó.", created_at: ago(9 * DAY)},
    {id: world.id(), suspect_id: DEMO.suspect(1), plate_number: "CSABA 1", vehicle_type: "Sultan", color: "fekete", notes: null, created_at: ago(15 * DAY)},
  ];
  tables.suspect_associates = [
    {id: world.id(), suspect_id: DEMO.suspect(1), associate_id: DEMO.suspect(2), relationship: "Bandatag", notes: null, created_at: ago(9 * DAY)},
    {id: world.id(), suspect_id: DEMO.suspect(1), associate_id: DEMO.suspect(4), relationship: "Üzleti partner", notes: null, created_at: ago(30 * DAY)},
  ];

  const caseRow = (n: number, title: string, description: string, status: string, priority: string, category: string, owner: string,
    createdDaysAgo: number, updatedMinutesAgo: number, badge: string): Row => ({
    id: DEMO.case(n), case_number: `SD-${badge.slice(-3)}/0${10 + n}/${world.day(-createdDaysAgo).replace(/-/g, "").slice(2)}`, title, description,
    status, priority, category, owner_id: owner, created_at: ago(createdDaysAgo * DAY), updated_at: ago(updatedMinutesAgo),
    closed_at: status === "closed" ? ago(updatedMinutesAgo) : null, body: [], body_version: 4, body_updated_by: owner, theme: "default",
  });
  tables.cases = [
    caseRow(1, "Fegyvercsempészet a kikötőben", "Éjszakai rakodás a 3-as raktárnál; a Kikötői Banda gyanúja.", "open", "high", "weapons",
      person(4), 6, 50, "9104"),
    caseRow(2, "Ékszerbolt-rablás, Downtown", "Fegyveres rablás nyitás előtt, két elkövető.", "open", "critical", "robbery", person(6), 3, 4 * 60, "9106"),
    caseRow(3, "Okmányhamisító műhely", "Hamis jogosítványok terjesztése Idlewoodban.", "open", "medium", "fraud", person(10), 10, 2 * DAY, "9110"),
    caseRow(4, "Lopott járművek a reptéren", "Lezárva: a járműveket visszaszolgáltattuk.", "closed", "low", "vehicle", person(4), 40, 12 * DAY, "9104"),
  ];
  if (mcbMember) {
    tables.cases.push(caseRow(5, "Saját aktám: graffiti-sorozat", "Gyakorló akta: a te nevedre szól.", "open", "low", "other", me.id, 1, 90,
      me.badge_number));
  }

  const evidenceIds = [world.id(), world.id(), world.id()];
  tables.cases[0].body = demoDocument(evidenceIds);
  tables.cases[0].body_updated_by = person(6);
  tables.cases[1].body = [heading("Összefoglaló"), paragraph(text("Két maszkos elkövető 09:50-kor tört be; a riasztás 09:52-kor szólalt meg."))];

  tables.case_collaborators = [
    {id: world.id(), case_id: DEMO_CASE, user_id: person(6), role: "editor", created_at: ago(5 * DAY)},
    {id: world.id(), case_id: DEMO_CASE, user_id: person(10), role: "viewer", created_at: ago(4 * DAY)},
    {id: world.id(), case_id: DEMO.case(2), user_id: person(4), role: "editor", created_at: ago(3 * DAY)},
  ];
  // The trainee works on the demo case as an editor (in their real role they may only see the list row).
  if (canViewCaseList(me)) tables.case_collaborators.push({id: world.id(), case_id: DEMO_CASE, user_id: me.id, role: "editor", created_at: ago(2 * DAY)});

  tables.case_evidence = [
    {id: evidenceIds[0], case_id: DEMO_CASE, file_path: `${origin}/training/scene-dock.svg`, file_name: "CAM-03 kikötő.png", file_type: "image",
      uploaded_by: person(4), created_at: ago(5 * DAY)},
    {id: evidenceIds[1], case_id: DEMO_CASE, file_path: `${origin}/training/cctv-van.svg`, file_name: "CAM-11 Dock Road.png", file_type: "image",
      uploaded_by: person(6), created_at: ago(4 * DAY)},
    {id: evidenceIds[2], case_id: DEMO_CASE, file_path: `${origin}/training/scene-dock.svg`, file_name: "Szemle jegyzőkönyv.pdf", file_type: "document",
      uploaded_by: person(6), created_at: ago(3 * DAY)},
  ];

  tables.case_suspects = [
    {id: world.id(), case_id: DEMO_CASE, suspect_id: DEMO.suspect(1), involvement_type: "suspect", notes: "A raktár bérlője.", added_at: ago(5 * DAY)},
    {id: world.id(), case_id: DEMO_CASE, suspect_id: DEMO.suspect(2), involvement_type: "suspect", notes: "Sofőr.", added_at: ago(5 * DAY)},
    {id: world.id(), case_id: DEMO_CASE, suspect_id: DEMO.suspect(3), involvement_type: "witness", notes: "Látta a rakodást.", added_at: ago(4 * DAY)},
    {id: world.id(), case_id: DEMO.case(2), suspect_id: DEMO.suspect(5), involvement_type: "suspect", notes: null, added_at: ago(3 * DAY)},
    {id: world.id(), case_id: DEMO.case(4), suspect_id: DEMO.suspect(4), involvement_type: "suspect", notes: null, added_at: ago(39 * DAY)},
  ];

  const warrant = (caseId: string, type: string, status: string, reason: string, suspectId: string | null, requestedBy: string, minutesAgo: number,
    extra: Row = {}): Row => ({
    id: world.id(), case_id: caseId, suspect_id: suspectId, property_id: null, target_name: null, type, status, reason, description: null,
    requested_by: requestedBy, approved_by: status === "pending" ? null : person(1), created_at: ago(minutesAgo), updated_at: ago(minutesAgo / 2),
    decided_at: status === "pending" ? null : ago(minutesAgo / 2), decision_note: null, closed_at: null, closed_by: null, closing_note: null, ...extra,
  });
  const warehouse = tables.suspect_properties[0].id;
  tables.case_warrants = [
    warrant(DEMO_CASE, "search", "pending", "Fegyverek tárolásának gyanúja a raktárban.", DEMO.suspect(1), person(6), 3 * 60, {property_id: warehouse}),
    warrant(DEMO_CASE, "arrest", "approved", "Fegyvercsempészet, a térfigyelő felvételek alapján.", DEMO.suspect(1), person(4), 2 * DAY),
    warrant(DEMO.case(2), "arrest", "approved", "Fegyveres rablás.", DEMO.suspect(5), person(6), 2 * DAY),
    warrant(DEMO.case(4), "arrest", "executed", "Járműlopás.", DEMO.suspect(4), person(4), 38 * DAY, {closed_at: ago(36 * DAY), closed_by: person(4)}),
  ];

  tables.case_notes = [
    {id: world.id(), case_id: DEMO_CASE, user_id: person(4), content: "Holnap éjjel megfigyelés a 3-as raktárnál, 02:00-tól.", created_at: ago(26 * 60)},
    {id: world.id(), case_id: DEMO_CASE, user_id: person(6), content: "Megvannak a CAM-11 felvételei, feltöltöttem őket.", created_at: ago(4 * DAY)},
    {id: world.id(), case_id: DEMO_CASE, user_id: person(10), content: "A rendszám első négy karaktere: 4KUF.", created_at: ago(3 * DAY)},
  ];

  let eventId = 1;
  const event = (kind: string, details: Row, actor: string, minutesAgo: number): Row =>
    ({id: eventId++, case_id: DEMO_CASE, kind, details, actor_id: actor, created_at: ago(minutesAgo)});
  tables.case_events = [
    event("created", {title: "Fegyvercsempészet a kikötőben"}, person(4), 6 * DAY),
    event("collaborator_added", {name: "Példa Piroska", role: "editor"}, person(4), 5 * DAY),
    event("person_linked", {name: "Csempész Csaba", role: "suspect"}, person(4), 5 * DAY),
    event("evidence_added", {name: "CAM-03 kikötő.png"}, person(4), 5 * DAY),
    event("evidence_added", {name: "CAM-11 Dock Road.png"}, person(6), 4 * DAY),
    event("warrant_requested", {type: "arrest", target: "Csempész Csaba"}, person(4), 2 * DAY),
    event("warrant_status", {type: "arrest", target: "Csempész Csaba", status: "approved"}, person(1), DAY),
    event("document", {saves: 3}, person(6), 50),
    event("warrant_requested", {type: "search", target: "Kikötő, 3-as raktár"}, person(6), 3 * 60),
  ];

  // The starter templates (the MCB leadership edits them on /mcb/templates).
  tables.case_templates = builtinTemplates().map((template) => ({
    ...template, id: world.id(), created_at: ago(40 * DAY), updated_at: ago(40 * DAY), created_by: person(1), updated_by: null,
  }));
}

// --- Reads ---------------------------------------------------------------------------------

const roleIn = (world: World, item: Row): "owner" | "editor" | "viewer" | null => {
  if (item.owner_id === world.me.id) return "owner";
  const collaborator = (world.tables.case_collaborators ?? []).find((row) => row.case_id === item.id && row.user_id === world.me.id);
  return (collaborator?.role as "editor" | "viewer" | undefined) ?? null;
};
const canOpen = (world: World, item: Row) => seesAllCases(world.me) || roleIn(world, item) !== null;

function findCase(world: World, id: unknown) {
  const item = (world.tables.cases ?? []).find((row) => row.id === id);
  if (!item) throw new SandboxError("Az akta nem található.", "P0002");
  return item;
}

export function warrantJson(world: World, warrant: Row) {
  const profile = (id: unknown) => {
    const row = world.person(id as string);
    return row ? {full_name: row.full_name, badge_number: row.badge_number, faction_rank: row.faction_rank} : null;
  };
  const suspect = (world.tables.suspects ?? []).find((row) => row.id === warrant.suspect_id);
  const property = (world.tables.suspect_properties ?? []).find((row) => row.id === warrant.property_id);
  const item = (world.tables.cases ?? []).find((row) => row.id === warrant.case_id);
  return {
    ...warrant,
    requester: profile(warrant.requested_by),
    approver: profile(warrant.approved_by),
    closer: profile(warrant.closed_by),
    suspect: suspect ? {id: suspect.id, full_name: suspect.full_name, alias: suspect.alias, mugshot_url: suspect.mugshot_url, status: suspect.status,
      gang_affiliation: suspect.gang_affiliation} : null,
    property: property ? {address: property.address, property_type: property.property_type} : null,
    case: item ? {id: item.id, case_number: item.case_number, title: item.title, status: item.status} : null,
  };
}

function listItem(world: World, item: Row) {
  const owner = world.person(item.owner_id as string);
  const of = (table: string, test: (row: Row) => boolean = () => true) =>
    (world.tables[table] ?? []).filter((row) => row.case_id === item.id && test(row)).length;
  return {
    id: item.id, case_number: item.case_number, title: item.title, description: item.description, status: item.status, priority: item.priority,
    category: item.category, created_at: item.created_at, updated_at: item.updated_at, closed_at: item.closed_at, owner_id: item.owner_id,
    owner_name: owner?.full_name ?? null, owner_badge: owner?.badge_number ?? null, owner_avatar: owner?.avatar_url ?? null,
    evidence: of("case_evidence"), people: of("case_suspects"), collaborators: of("case_collaborators"),
    warrants_pending: of("case_warrants", (row) => row.status === "pending"), warrants_active: of("case_warrants", (row) => row.status === "approved"),
    my_role: roleIn(world, item), can_open: canOpen(world, item),
  };
}

const plainText = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(plainText).join(" ");
  if (value && typeof value === "object") {
    const node = value as Row;
    return [typeof node.text === "string" ? node.text : "", node.props && (node.props as Row).user ? String((node.props as Row).user) : "",
      plainText(node.content), plainText(node.children), plainText(node.rows), plainText(node.cells)].join(" ");
  }
  return "";
};

function addEvent(world: World, caseId: unknown, kind: string, details: Row) {
  const events = (world.tables.case_events ??= []);
  events.push({id: events.length + 1000, case_id: caseId, kind, details, actor_id: world.me.id, created_at: world.stamp()});
}

export const mcbRpc: Record<string, RpcHandler> = {
  reorder_case_templates: (args, world) => {
    if (!isMcbLead(world.me)) throw new SandboxError("A sablonokat az MCB vezetése kezeli.", "42501");
    const ids = (args._ids as string[] | null) ?? [];
    for (const row of world.tables.case_templates ?? []) {
      const position = ids.indexOf(row.id as string);
      if (position >= 0) row.sort_order = (position + 1) * 10;
    }
    return null;
  },

  get_case_list: (args, world) => (world.tables.cases ?? [])
    .filter((item) => args._include_archived || item.status !== "archived")
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((item) => listItem(world, item)),

  get_case_detail: (args, world) => {
    const item = findCase(world, args._case_id);
    if (!canOpen(world, item)) throw new SandboxError("Ezt az aktát csak a tulajdonosa, a közreműködői és az MCB vezetése nyithatja meg.", "42501");
    const role = roleIn(world, item);
    const owner = world.person(item.owner_id as string);
    const lead = isMcbLead(world.me);
    return {
      case: {...item, body_updated_by_name: world.person(item.body_updated_by as string)?.full_name ?? null},
      owner: owner ? {id: owner.id, full_name: owner.full_name, badge_number: owner.badge_number, faction_rank: owner.faction_rank,
        division: owner.division, division_rank: owner.division_rank, avatar_url: owner.avatar_url} : null,
      collaborators: (world.tables.case_collaborators ?? []).filter((row) => row.case_id === item.id && row.user_id !== item.owner_id).map((row) => {
        const profile = world.person(row.user_id as string);
        return {...row, profile: profile ? {full_name: profile.full_name, badge_number: profile.badge_number, faction_rank: profile.faction_rank,
          avatar_url: profile.avatar_url} : null};
      }),
      evidence: (world.tables.case_evidence ?? []).filter((row) => row.case_id === item.id)
        .map((row) => ({...row, uploader_name: world.person(row.uploaded_by as string)?.full_name ?? null})),
      people: (world.tables.case_suspects ?? []).filter((row) => row.case_id === item.id)
        .map((row) => ({...row, suspect: (world.tables.suspects ?? []).find((suspect) => suspect.id === row.suspect_id) ?? null})),
      warrants: (world.tables.case_warrants ?? []).filter((row) => row.case_id === item.id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map((row) => warrantJson(world, row)),
      ...caseExtras(world, item.id),
      viewer: {
        role,
        can_edit: (role === "owner" || role === "editor") && item.status === "open",
        can_manage: lead || role === "owner",
        is_lead: lead,
        can_approve: canApproveWarrants(world.me),
      },
    };
  },

  search_cases: (args, world) => {
    const needle = String(args._query ?? "").trim().toLowerCase();
    if (needle.length < 2) return [];
    return (world.tables.cases ?? []).flatMap((item) => {
      const owner = world.person(item.owner_id as string);
      const head = [item.title, item.case_number, item.description].join(" ").toLowerCase();
      const open = canOpen(world, item);
      const body = open ? plainText(item.body) : "";
      const at = body.toLowerCase().indexOf(needle);
      if (!head.includes(needle) && at < 0) return [];
      return [{
        id: item.id, case_number: item.case_number, title: item.title, status: item.status, priority: item.priority, owner_name: owner?.full_name ?? null,
        updated_at: item.updated_at, match: head.includes(needle) ? "title" : "body",
        snippet: at >= 0 ? body.slice(Math.max(0, at - 40), at + 80).replace(/\s+/g, " ").trim() : null, can_open: open,
      }];
    });
  },

  save_case_document: (args, world) => {
    const item = findCase(world, args._case_id);
    if (Number(args._base_version) !== Number(item.body_version)) {
      return {ok: false, conflict: true, version: item.body_version, updated_at: item.updated_at,
        updated_by_name: world.person(item.body_updated_by as string)?.full_name ?? null};
    }
    item.body = args._body;
    item.body_version = Number(item.body_version) + 1;
    item.body_updated_by = world.me.id;
    item.updated_at = world.stamp();
    addEvent(world, item.id, "document", {saves: 1});
    return {ok: true, version: item.body_version, updated_at: item.updated_at};
  },

  update_case: (args, world) => {
    const item = findCase(world, args._case_id);
    const patch = (args._changes ?? {}) as Row;
    for (const key of ["title", "description", "priority", "category", "theme"]) {
      if (patch[key] !== undefined) item[key] = patch[key];
    }
    item.updated_at = world.stamp();
    return {title: item.title, description: item.description, priority: item.priority, category: item.category, theme: item.theme,
      updated_at: item.updated_at};
  },

  set_case_status: (args, world) => {
    const item = findCase(world, args._case_id);
    const from = item.status;
    item.status = args._status;
    item.closed_at = args._status === "closed" ? world.stamp() : null;
    item.updated_at = world.stamp();
    let expired = 0;
    if (args._status !== "open") {
      (world.tables.case_warrants ?? []).filter((row) => row.case_id === item.id && row.status === "pending").forEach((row) => {
        row.status = "expired";
        expired += 1;
      });
    }
    addEvent(world, item.id, "status", {from: from as string, to: item.status as string});
    return {status: item.status, closed_at: item.closed_at, updated_at: item.updated_at, expired_warrants: expired};
  },

  transfer_case: (args, world) => {
    const item = findCase(world, args._case_id);
    const target = world.person(args._new_owner as string);
    if (!target) throw new SandboxError("A tag nem található.");
    const previous = item.owner_id;
    item.owner_id = target.id;
    world.tables.case_collaborators = (world.tables.case_collaborators ?? []).filter((row) => !(row.case_id === item.id && row.user_id === target.id));
    if (args._keep_previous && previous) {
      world.tables.case_collaborators.push({id: world.id(), case_id: item.id, user_id: previous, role: "editor", created_at: world.stamp()});
    }
    addEvent(world, item.id, "owner", {from_name: world.person(previous as string)?.full_name ?? null, to_name: target.full_name});
    return {owner_id: target.id, owner_name: target.full_name};
  },

  decide_warrant: (args, world) => {
    const warrant = (world.tables.case_warrants ?? []).find((row) => row.id === args._warrant_id);
    if (!warrant) throw new SandboxError("A parancs nem található.");
    const status = String(args._status);
    if ((status === "approved" || status === "rejected") && warrant.requested_by === world.me.id) {
      throw new SandboxError("A saját kérelmedről nem dönthetsz.");
    }
    warrant.status = status;
    warrant.updated_at = world.stamp();
    if (status === "approved" || status === "rejected") {
      warrant.approved_by = world.me.id;
      warrant.decided_at = world.stamp();
      warrant.decision_note = args._note ?? null;
    } else {
      warrant.closed_by = world.me.id;
      warrant.closed_at = world.stamp();
      warrant.closing_note = args._note ?? null;
    }
    const suspect = (world.tables.suspects ?? []).find((row) => row.id === warrant.suspect_id);
    if (suspect && warrant.type === "arrest") {
      if (status === "approved") suspect.status = "wanted";
      if (status === "executed") suspect.status = "jailed";
    }
    addEvent(world, warrant.case_id, "warrant_status", {type: warrant.type, status, target: suspect?.full_name ?? "", note: (args._note as string) ?? null});
    return warrantJson(world, warrant);
  },

  get_suspect_dossier: (args, world) => {
    const suspect = (world.tables.suspects ?? []).find((row) => row.id === args._suspect_id);
    if (!suspect) throw new SandboxError("A személy nem található.");
    const people = world.tables.suspects ?? [];
    const link = (row: Row, otherId: unknown, direction: "out" | "in") => {
      const other = people.find((item) => item.id === otherId);
      return {id: row.id, other_id: otherId, relationship: row.relationship, notes: row.notes, created_at: row.created_at, direction,
        person: other ? {id: other.id, full_name: other.full_name, alias: other.alias, mugshot_url: other.mugshot_url, status: other.status} : null};
    };
    return {
      suspect,
      creator_name: world.person(suspect.created_by as string)?.full_name ?? null,
      vehicles: (world.tables.suspect_vehicles ?? []).filter((row) => row.suspect_id === suspect.id),
      properties: (world.tables.suspect_properties ?? []).filter((row) => row.suspect_id === suspect.id),
      associates: (world.tables.suspect_associates ?? []).filter((row) => row.suspect_id === suspect.id).map((row) => link(row, row.associate_id, "out")),
      linked_by: (world.tables.suspect_associates ?? []).filter((row) => row.associate_id === suspect.id).map((row) => link(row, row.suspect_id, "in")),
      cases: (world.tables.case_suspects ?? []).filter((row) => row.suspect_id === suspect.id).flatMap((row) => {
        const item = (world.tables.cases ?? []).find((entry) => entry.id === row.case_id);
        return item ? [{link_id: row.id, case_id: item.id, case_number: item.case_number, title: item.title, status: item.status,
          priority: item.priority, involvement_type: row.involvement_type, notes: row.notes, added_at: row.added_at, can_open: canOpen(world, item)}] : [];
      }),
      warrants: (world.tables.case_warrants ?? []).filter((row) => row.suspect_id === suspect.id).map((row) => warrantJson(world, row)),
    };
  },

  get_mcb_overview: (_args, world) => {
    const cases = world.tables.cases ?? [];
    const warrants = world.tables.case_warrants ?? [];
    const suspects = world.tables.suspects ?? [];
    const members = (world.tables.profiles ?? []).filter((row) => row.division === "MCB" || row.id === world.me.id);
    const months = [-5, -4, -3, -2, -1, 0].map((offset) => world.month(offset));
    const categories = [...new Set(cases.map((item) => (item.category as string) ?? "none"))];
    return {
      viewer: {is_lead: isMcbLead(world.me)},
      totals: {
        open: cases.filter((item) => item.status === "open").length, closed: cases.filter((item) => item.status === "closed").length,
        archived: cases.filter((item) => item.status === "archived").length,
        critical: cases.filter((item) => item.status === "open" && item.priority === "critical").length,
        opened_30d: cases.filter((item) => String(item.created_at) >= world.ago(30 * DAY)).length,
        closed_30d: cases.filter((item) => item.closed_at && String(item.closed_at) >= world.ago(30 * DAY)).length,
        avg_close_days: 26, warrants_pending: warrants.filter((row) => row.status === "pending").length,
        warrants_active: warrants.filter((row) => row.status === "approved").length,
        wanted: suspects.filter((row) => row.status === "wanted").length, suspects: suspects.length,
      },
      monthly: months.map((month, index) => ({month, opened: [3, 5, 2, 6, 4, 3][index], closed: [2, 4, 3, 3, 5, 1][index]})),
      categories: categories.map((category) => ({
        category, open: cases.filter((item) => (item.category ?? "none") === category && item.status === "open").length,
        total: cases.filter((item) => (item.category ?? "none") === category).length,
      })),
      members: members.map((row, index) => ({
        id: row.id, full_name: row.full_name, badge_number: row.badge_number, faction_rank: row.faction_rank, division: row.division,
        division_rank: row.division_rank, avatar_url: row.avatar_url, system_role: row.system_role, is_bureau_commander: !!row.is_bureau_commander,
        is_bureau_manager: !!row.is_bureau_manager, open_owned: cases.filter((item) => item.owner_id === row.id && item.status === "open").length,
        critical_owned: cases.filter((item) => item.owner_id === row.id && item.priority === "critical").length,
        closed_owned: cases.filter((item) => item.owner_id === row.id && item.status === "closed").length, closed_90d: index % 3,
        collaborations: (world.tables.case_collaborators ?? []).filter((item) => item.user_id === row.id).length, evidence_30d: (index * 3) % 7,
        last_activity: world.ago(60 + index * 400),
      })),
      unattended: cases.filter((item) => item.id === DEMO.case(3)).map((item) => ({
        id: item.id, case_number: item.case_number, title: item.title, priority: item.priority, updated_at: item.updated_at, owner_id: item.owner_id,
        owner_name: world.person(item.owner_id as string)?.full_name ?? null, owner_division: "MCB", reason: "stale",
      })),
      recent: (world.tables.case_events ?? []).slice(-6).reverse().map((row) => {
        const item = cases.find((entry) => entry.id === row.case_id);
        return {id: row.id, case_id: row.case_id, case_number: item?.case_number ?? "", title: item?.title ?? "", kind: row.kind, details: row.details,
          created_at: row.created_at, actor_name: world.person(row.actor_id as string)?.full_name ?? null};
      }),
    };
  },

  delete_suspect_safely: (args, world) => {
    if ((world.tables.case_suspects ?? []).some((row) => row.suspect_id === args._suspect_id)) {
      return {success: false, message: "A személy aktához kapcsolódik, ezért nem törölhető."};
    }
    world.tables.suspects = (world.tables.suspects ?? []).filter((row) => row.id !== args._suspect_id);
    return {success: true, message: "Adatlap törölve."};
  },
};

export const mcbApi: Record<string, (body: Row, world: World) => unknown> = {
  "/api/case/delete": (body, world) => {
    world.tables.cases = (world.tables.cases ?? []).filter((row) => row.id !== body.caseId);
    return {ok: true};
  },
};
