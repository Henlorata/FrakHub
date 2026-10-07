import type {Row} from "../postgrest";
import {DAY, SandboxError, type RpcHandler, type World} from "./context";
import {person} from "./people";

/**
 * Mail, the Internal Affairs Bureau, the Sheriff's Information Bureau's desk and the member's
 * signature in the demo world: a few letters in the old "public mails" style, one investigation
 * and two news items, all obviously made up.
 */

const GROUPS: {key: string; address: string; label: string}[] = [
  {key: "all", address: "all@sfsd.org", label: "Teljes állomány"},
  {key: "iab", address: "internal.affairs.bureau@sfsd.org", label: "Internal Affairs Bureau"},
  {key: "command", address: "command.staff@sfsd.org", label: "Command Staff (vezetőség)"},
  {key: "sib", address: "information.bureau@sfsd.org", label: "Sheriff's Information Bureau"},
  {key: "mcb", address: "mcb@sfsd.org", label: "Major Crimes Bureau"},
  {key: "seb", address: "seb@sfsd.org", label: "Special Enforcement Bureau"},
  {key: "tsb", address: "tsb@sfsd.org", label: "TSB állomány"},
];

/** As private.mail_address(): "Teszt Elek" → teszt.elek@sfsd.org. */
const address = (name: unknown) => `${String(name ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "tag"}@sfsd.org`;

interface Message {
  id: string;
  sender_name: string;
  sender_address: string;
  sender_kind: string;
  author_id: string | null;
  to: string[];
  body: string;
  created_at: string;
}

interface Thread {
  id: string;
  subject: string;
  created_at: string;
  broadcast: boolean;
  iab: boolean;
  recipients: {address: string; user_id: string | null; group: string | null}[];
  messages: Message[];
  read: boolean;
}

const threads = (world: World) => ((world.tables.mail_demo ??= []) as unknown as Thread[]);

export function seedCommunication(world: World) {
  const {tables, ago, me} = world;
  const name = (id: string) => String(world.person(id)?.full_name ?? "");
  const message = (id: string, sender: Partial<Message>, to: string[], body: string, minutes: number): Message => ({
    id, sender_name: "", sender_address: "", sender_kind: "self", author_id: null, to, body, created_at: ago(minutes), ...sender,
  });
  tables.mail_demo = [
    {id: "de-mail-1", subject: "Állománygyűlés péntek 20:00 (bemutató)", created_at: ago(120), broadcast: true, iab: false, read: false,
      recipients: [{address: "all@sfsd.org", user_id: null, group: "all"}],
      messages: [message("de-mail-1a", {sender_name: "SFSD Command Staff", sender_address: "command.staff@sfsd.org", sender_kind: "command",
        author_id: person(2)}, ["all@sfsd.org"],
      "Tisztelt Kollégák!\n\nPénteken 20:00-kor állománygyűlést tartunk a főkapitányságon. A részvétel kötelező; aki nem tud jönni, előre jelezze a felettesének.\n\nTisztelettel;\nSFSD Command Staff", 120)]},
    {id: "de-mail-2", subject: "Köszönet a közös akcióért (bemutató)", created_at: ago(DAY), broadcast: true, iab: false, read: true,
      recipients: [{address: "all@sfsd.org", user_id: null, group: "all"}],
      messages: [message("de-mail-2a", {sender_name: "Commander Harvey Cooper", sender_address: "cmd.cooper@lspd.org", sender_kind: "external",
        author_id: person(1)}, ["all@sfsd.org"],
      "Tisztelt San Fierro Sheriff's Department!\n\nKöszönjük a tegnap éjszakai közös akcióban nyújtott segítséget. A gyors és fegyelmezett együttműködés nélkül nem sikerült volna.\n\nTisztelettel;\nCommander Harvey Cooper\nLos Santos Police Department", DAY)]},
    {id: "de-mail-3", subject: "Szolgálati csere szombaton (bemutató)", created_at: ago(3 * DAY), broadcast: false, iab: false, read: true,
      recipients: [{address: address(me.full_name), user_id: me.id, group: null}],
      messages: [message("de-mail-3a", {sender_name: name(person(9)), sender_address: address(name(person(9))), author_id: person(9)},
        [address(me.full_name)],
        "Szia!\n\nSzombaton cserélnél velem műszakot? Az esti szolgálatot vállalnám helyetted, ha átveszed a délelőttit.\n\nKöszönöm,\n" + name(person(9)), 3 * DAY)]},
  ] as unknown as Row[];

  tables.member_signatures ??= [];

  tables.iab_demo = [{
    id: "de-iab-1", case_number: "IAB-2026-001", title: "Panasz egy igazoltatás hangneme miatt (bemutató)",
    summary: "Egy polgár levélben panaszolta, hogy az igazoltatás során tiszteletlenül beszéltek vele. A bodycam felvétel bekérve.",
    status: "open", priority: "normal", outcome: null, closure: null, opened_at: ago(2 * DAY), updated_at: ago(300), closed_at: null,
  }];
}

const PERSON_FIELDS = (world: World, id: string | null) => {
  const row = id ? world.person(id) : undefined;
  return row ? {id: row.id, full_name: row.full_name, faction_rank: row.faction_rank, badge_number: row.badge_number,
    avatar_url: row.avatar_url ?? null, iab_title: row.iab_title ?? null} : null;
};

function threadItem(world: World, thread: Thread) {
  const last = thread.messages[thread.messages.length - 1];
  return {
    id: thread.id, subject: thread.subject, created_at: thread.created_at, last_message_at: last.created_at,
    message_count: thread.messages.length, broadcast: thread.broadcast, iab: thread.iab,
    unread: !thread.read && last.author_id !== world.me.id,
    last: {sender_name: last.sender_name, sender_address: last.sender_address, snippet: last.body.replace(/\s+/g, " ").slice(0, 140)},
    to: thread.recipients.map((recipient) => recipient.address),
  };
}

const requireThread = (world: World, id: unknown) => {
  const thread = threads(world).find((item) => item.id === id);
  if (!thread) throw new SandboxError("A levél nem található.");
  return thread;
};

export const communicationRpc: Record<string, RpcHandler> = {
  get_mail_directory: (_args, world) => ({
    me: {address: address(world.me.full_name), name: world.me.full_name},
    can_broadcast: world.me.system_role !== "user",
    can_external: world.me.system_role !== "user",
    offices: [],
    groups: GROUPS.map((group) => ({...group, allowed: group.key !== "all" || world.me.system_role !== "user"})),
    members: (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending" && row.id !== world.me.id)
      .map((row) => ({id: row.id, name: row.full_name, rank: row.faction_rank, badge: row.badge_number, address: address(row.full_name)})),
  }),

  get_mailbox: (args, world) => {
    const box = String(args._box ?? "inbox");
    const mine = (thread: Thread) => thread.messages.some((message) => message.author_id === world.me.id && message.sender_kind === "self");
    const list = threads(world).filter((thread) => box === "sent" ? mine(thread)
      : box === "all" ? thread.broadcast
        : box === "iab" ? thread.iab
          : !thread.messages.every((message) => message.author_id === world.me.id));
    return list.map((thread) => threadItem(world, thread)).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  },

  search_mail: (args, world) => {
    const needle = String(args._query ?? "").trim().toLowerCase();
    if (needle.length < 2) return [];
    return threads(world).flatMap((thread) => {
      const hit = thread.messages.find((message) => message.body.toLowerCase().includes(needle));
      const found = thread.subject.toLowerCase().includes(needle) || !!hit
        || thread.messages.some((message) => message.sender_name.toLowerCase().includes(needle));
      if (!found) return [];
      const at = hit ? hit.body.toLowerCase().indexOf(needle) : -1;
      return [{...threadItem(world, thread), match: hit ? hit.body.slice(Math.max(0, at - 60), at + 120).replace(/\s+/g, " ") : null}];
    });
  },

  get_mail_receipts: (args, world) => {
    const thread = requireThread(world, args._thread);
    if (!thread.messages.some((message) => message.author_id === world.me.id)) {
      throw new SandboxError("Az olvasottságot a levél írói látják.", "42501");
    }
    const readers = (world.tables.profiles ?? []).filter((row) => row.system_role !== "pending" && row.id !== world.me.id).slice(0, 12)
      .map((row, index) => ({user_id: row.id, full_name: row.full_name, faction_rank: row.faction_rank, badge_number: row.badge_number,
        avatar_url: row.avatar_url ?? null, read_at: index % 3 === 2 ? null : world.ago(30 + index * 7)}));
    return {total: readers.length, read: readers.filter((reader) => reader.read_at).length, last_message_at: thread.messages[thread.messages.length - 1].created_at,
      readers};
  },

  get_mail_templates: (_args, world) => (world.tables.mail_templates ??= [
    {id: "de-tpl-1", title: "Tájékoztatás az állománynak", subject: "Tájékoztatás",
      body: "Tisztelt Kollégák!\n\n[A tájékoztatás szövege]\n\nSan Fierro, {{dátum}}\n\nTisztelettel:\n{{feladó}}\n{{feladó_rang}}",
      shared: true, mine: false, can_edit: false, updated_at: world.ago(DAY)},
  ]),

  save_mail_template: (args, world) => {
    const rows = (world.tables.mail_templates ??= []);
    const id = (args._id as string | null) ?? world.id();
    const row = {id, title: args._title, subject: args._subject ?? "", body: args._body, shared: !!args._shared, mine: true, can_edit: true,
      updated_at: world.stamp()};
    const index = rows.findIndex((item) => item.id === id);
    if (index >= 0) rows[index] = row;
    else rows.push(row);
    return id;
  },

  delete_mail_template: (args, world) => {
    world.tables.mail_templates = (world.tables.mail_templates ?? []).filter((item) => item.id !== args._id);
    return null;
  },

  get_mail_thread: (args, world) => {
    const thread = requireThread(world, args._id);
    thread.read = true;
    const wrote = thread.messages.some((message) => message.author_id === world.me.id);
    return {
      thread: threadItem(world, thread),
      receipts: wrote ? {total: 12, read: 8} : null,
      can_reply: !thread.broadcast || world.me.system_role !== "user",
      recipients: thread.recipients,
      messages: thread.messages.map((message) => ({
        id: message.id, sender_name: message.sender_name, sender_address: message.sender_address, sender_kind: message.sender_kind,
        to: message.to, body: message.body, created_at: message.created_at, author: PERSON_FIELDS(world, message.author_id),
      })),
      iab_staff: null,
      cases: [],
    };
  },

  send_mail: (args, world) => {
    const body = String(args._body ?? "").trim();
    if (!body) throw new SandboxError("A levél üres.");
    const chips = (Array.isArray(args._to) ? args._to : []) as {kind: string; id?: string; key?: string}[];
    const recipients = chips.map((chip) => chip.kind === "group"
      ? {address: GROUPS.find((group) => group.key === chip.key)?.address ?? "all@sfsd.org", user_id: null, group: chip.key ?? null}
      : {address: address(world.person(chip.id)?.full_name), user_id: chip.id ?? null, group: null});
    const message: Message = {
      id: world.id(), sender_name: world.me.full_name, sender_address: address(world.me.full_name), sender_kind: "self",
      author_id: world.me.id, to: recipients.map((recipient) => recipient.address), body, created_at: world.stamp(),
    };
    if (args._thread) {
      const thread = requireThread(world, args._thread);
      thread.recipients.push(...recipients.filter((recipient) => !thread.recipients.some((item) => item.address === recipient.address)));
      message.to = thread.recipients.map((recipient) => recipient.address);
      thread.messages.push(message);
      return thread.id;
    }
    if (recipients.length === 0) throw new SandboxError("Adj meg legalább egy címzettet.");
    const thread: Thread = {
      id: world.id(), subject: String(args._subject ?? "").trim() || "(nincs tárgy)", created_at: message.created_at,
      broadcast: recipients.some((recipient) => recipient.group === "all"), iab: recipients.some((recipient) => recipient.group === "iab"),
      recipients, messages: [message], read: true,
    };
    threads(world).push(thread);
    return thread.id;
  },

  save_signature: (args, world) => {
    const rows = (world.tables.member_signatures ??= []);
    const row = {user_id: world.me.id, path: args._path, width: args._width, height: args._height, method: args._method, style: args._style ?? null,
      updated_at: world.stamp()};
    const index = rows.findIndex((item) => item.user_id === world.me.id);
    if (index >= 0) rows[index] = row;
    else rows.push(row);
    return null;
  },
  delete_signature: (_args, world) => {
    world.tables.member_signatures = (world.tables.member_signatures ?? []).filter((row) => row.user_id !== world.me.id);
    return null;
  },

  get_iab_overview: (_args, world) => {
    const cases = world.tables.iab_demo ?? [];
    return {
      viewer: {iab_title: world.me.iab_title ?? null, is_lead: true, is_member: !!world.me.iab_title},
      members: [person(6), person(10)].map((id, index) => ({...PERSON_FIELDS(world, id), iab_title: index === 0 ? "chief_deputy" : "agent"})),
      cases: cases.map((row) => ({...row, lead: {...PERSON_FIELDS(world, person(6)), iab_title: "chief_deputy"}, entries: 1, mail: 1,
        people: [{user_id: person(11), full_name: world.person(person(11))?.full_name, role: "subject"}]})),
      stats: {open: cases.filter((row) => row.status === "open").length, closed_90d: 0, inbox_unread: 1},
    };
  },
  get_iab_case: (args, world) => {
    const row = (world.tables.iab_demo ?? []).find((item) => item.id === args._id);
    if (!row) throw new SandboxError("A vizsgálat nem található.");
    const lead = {...PERSON_FIELDS(world, person(6)), iab_title: "chief_deputy"};
    return {
      case: {...row, lead, opened_by: lead, closed_by: null},
      people: [{user_id: person(11), role: "subject", note: null, added_at: row.opened_at, person: PERSON_FIELDS(world, person(11))}],
      entries: [{id: "de-iab-e1", kind: "memo", title: "Értesítés a vizsgálat megindításáról", created_at: world.ago(300), updated_at: world.ago(300),
        body: "A beérkezett panasz alapján a belső vizsgálatot megindítottuk. Az érintett tagot meghallgatásra idézzük.", author: lead, can_edit: true}],
      mail: [{thread_id: "de-mail-3", subject: "Panaszlevél (bemutató)", last_message_at: world.ago(2 * DAY), message_count: 1}],
      can_edit: true,
      can_close: true,
    };
  },

  get_site_editor: (_args, world) => ({
    content: {
      hero: {title: "A megye szolgálatában.", highlight: "Egy jelvény. Egy csapat.", subtitle: "Járőrszolgálat, nyomozás és különleges egységek San Fierro megyében."},
      about: {lead: "A San Fierro Sheriff's Department a megye rendjének őre.", text: "Osztályaink és egységeink együtt dolgoznak."},
      sections: {}, gallery: [], faq: [], leadership: {hidden: []},
    },
    updated: {},
    leaders: [person(1), person(2), person(3)].map((id, index) => ({...PERSON_FIELDS(world, id), tier: index === 0 ? 0 : index === 1 ? 2 : 3, hidden: false})),
    posts: [
      {id: "de-news-1", slug: "bemutato-hir", title: "Sikeres közös akció a kikötőben (bemutató)", excerpt: "Lőfegyvereket és illegális árut foglaltak le.",
        cover_url: null, category: "operation", featured: true, published_at: world.ago(DAY), author_display: "Sheriff's Information Bureau", status: "published",
        updated_at: world.ago(DAY), created_at: world.ago(DAY + 60), author: world.person(person(4))?.full_name ?? null},
      {id: "de-news-2", slug: "bemutato-piszkozat", title: "Toborzás: új akadémiai ciklus (piszkozat)", excerpt: null, cover_url: null, category: "recruitment",
        featured: false, published_at: null, author_display: "Sheriff's Information Bureau", status: "draft", updated_at: world.ago(90),
        created_at: world.ago(200), author: world.me.full_name},
    ],
  }),
};
