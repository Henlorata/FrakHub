import {getRankPriority, isAcademyInstructor} from "@shared/ranks";
import type {Row} from "../postgrest";
import {DAY, DEMO, type RpcHandler, type World} from "./context";
import {person} from "./people";

export const DEMO_COURSE = "qual_SAHP";

const props = {textColor: "default", backgroundColor: "default", textAlignment: "left"};
const text = (value: string, styles: Record<string, unknown> = {}) => ({type: "text", text: value, styles});
const heading = (value: string, level = 2) => ({type: "heading", props: {...props, level, isToggleable: false}, content: [text(value)], children: []});
const paragraph = (...content: unknown[]) => ({type: "paragraph", props, content, children: []});
const bullet = (value: string) => ({type: "bulletListItem", props, content: [text(value)], children: []});

const page = (title: string, intro: string, points: string[]) => [
  heading(title, 1),
  paragraph(text(intro)),
  ...points.map(bullet),
  paragraph(text("Bemutató tananyag a gyakorló módhoz.", {italic: true, textColor: "gray"})),
];

export function seedAcademy(world: World) {
  const {tables, me, ago, day} = world;
  tables.academy_courses = [
    {id: DEMO_COURSE, title: "SAHP – autópálya-rendészet", description: "Üldözés, útzár és sebességmérés az autópályán.", category: "qualification",
      is_open: true, required_rank: null, linear_progression: true, sort_order: 10},
    {id: "qual_TB", title: "TB – oktatói képesítés", description: "Hogyan tarts órát, és hogyan értékeld az újoncokat.", category: "qualification",
      is_open: true, required_rank: "Corporal", linear_progression: false, sort_order: 20},
    {id: "mcb", title: "MCB – nyomozói alapok", description: "Helyszíni szemle, kihallgatás és aktavezetés.", category: "division",
      is_open: true, required_rank: null, linear_progression: true, sort_order: 30},
  ];
  tables.academy_division_materials = [
    {id: DEMO.page(1), course_id: DEMO_COURSE, title: "1. Az autópálya szabályai", page_order: 1, theme: "default", updated_at: ago(12 * DAY),
      content: page("Az autópálya szabályai", "Az SAHP egység a nagy sebességű forgalom biztonságáért felel.",
        ["Megállás csak a leállósávban, villogóval.", "Gyalogos az úttesten: azonnali útzár.", "Üldözésnél a rádióforgalom elsőbbséget kap."])},
    {id: DEMO.page(2), course_id: DEMO_COURSE, title: "2. Útzár felállítása", page_order: 2, theme: "default", updated_at: ago(12 * DAY),
      content: page("Útzár felállítása", "Az útzár célja a jármű megállítása sérülés nélkül.",
        ["Legalább két jármű, keresztben.", "Szöges szalag csak engedéllyel.", "A rádióban jelezd a pontos helyet."])},
    {id: DEMO.page(3), course_id: DEMO_COURSE, title: "3. Sebességmérés", page_order: 3, theme: "default", updated_at: ago(4 * DAY),
      content: page("Sebességmérés", "A traffipax adata csak kalibrált eszközzel bizonyíték.", ["Rögzítsd a mért értéket.", "Közöld a sofőrrel a mért sebességet."])},
    {id: DEMO.page(4), course_id: "mcb", title: "1. Helyszíni szemle", page_order: 1, theme: "default", updated_at: ago(30 * DAY),
      content: page("Helyszíni szemle", "A helyszín az első és legfontosabb bizonyíték.", ["Zárd le a területet.", "Fényképezz mindent, mielőtt bármihez hozzányúlsz."])},
    {id: DEMO.page(5), course_id: "qual_TB", title: "1. Az óra felépítése", page_order: 1, theme: "default", updated_at: ago(30 * DAY),
      content: page("Az óra felépítése", "Egy jó óra rövid elméletből és sok gyakorlásból áll.", ["Célkitűzés", "Bemutatás", "Gyakorlás", "Visszajelzés"])},
  ];
  tables.academy_materials = [1, 2, 3, 4, 5].flatMap((dayNumber) => [1, 2].map((order) => ({
    id: DEMO.page(10 + dayNumber * 2 + order), title: `${dayNumber}. nap – ${order === 1 ? "elmélet" : "gyakorlat"}`, day_number: dayNumber,
    page_order: order, category: "basic", theme: "default", updated_at: ago(40 * DAY),
    content: page(`${dayNumber}. nap – ${order === 1 ? "elmélet" : "gyakorlat"}`, "Az alapképzés bemutató anyaga.",
      ["Rádióforgalmazás", "Intézkedési alapok", "Járműhasználat"]),
  })));
  tables.academy_progress = [{id: world.id(), user_id: me.id, material_id: DEMO.page(1), completed_at: ago(5 * DAY)}];

  const cycle = world.id();
  tables.academy_cycles = [
    {id: cycle, start_date: day(-1), status: "active", created_at: ago(3 * DAY), created_by: person(5)},
    {id: world.id(), start_date: day(-30), status: "archived", created_at: ago(32 * DAY), created_by: person(5)},
  ];
  const student = (userId: string, status = "enrolled"): Row => ({id: world.id(), cycle_id: cycle, user_id: userId, status});
  tables.academy_students = [student(person(12)), student(person(13))];
  tables.academy_logs = tables.academy_students.map((row, index) => ({
    id: world.id(), cycle_id: cycle, student_id: row.id, day_number: 1, is_present: index === 0, note: index === 0 ? "Aktív, jól figyelt." : "Igazoltan hiányzott.",
    instructor_id: person(5),
  }));
}

export const academyRpc: Record<string, RpcHandler> = {
  get_academy_overview: (_args, world) => {
    const {tables, me} = world;
    const instructor = isAcademyInstructor(me);
    const cycle = (tables.academy_cycles ?? []).find((row) => row.status === "active") ?? null;
    const done = new Set((tables.academy_progress ?? []).filter((row) => row.user_id === me.id).map((row) => row.material_id));
    return {
      viewer: {instructor, trainee: me.faction_rank === "Deputy Sheriff Trainee"},
      today: world.day(),
      cycle: cycle ? {id: cycle.id, start_date: cycle.start_date, status: cycle.status} : null,
      basic: [1, 2, 3, 4, 5].map((day) => ({day, pages: (tables.academy_materials ?? []).filter((row) => row.day_number === day).length})),
      courses: [...(tables.academy_courses ?? [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((course) => {
        const pages = (tables.academy_division_materials ?? []).filter((row) => row.course_id === course.id);
        const rankOk = !course.required_rank || getRankPriority(me.faction_rank) <= getRankPriority(course.required_rank as string);
        return {
          id: course.id, title: course.title, description: course.description, category: course.category, is_open: course.is_open,
          required_rank: course.required_rank, linear_progression: course.linear_progression, pages: pages.length,
          completed: pages.filter((row) => done.has(row.id)).length, readable: instructor || (!!course.is_open && rankOk), rank_ok: rankOk,
        };
      }),
    };
  },
  reorder_academy_pages: (args, world) => {
    const table = args._kind === "basic" ? "academy_materials" : "academy_division_materials";
    ((args._ids ?? []) as string[]).forEach((id, index) => {
      const row = (world.tables[table] ?? []).find((item) => item.id === id);
      if (row) row.page_order = index + 1;
    });
    return null;
  },
};
