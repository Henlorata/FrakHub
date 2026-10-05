import type {LucideIcon} from "lucide-react";
import {ClipboardList, FilePlus2, FileSearch, MessagesSquare} from "lucide-react";

/**
 * Starting documents of a new case and snippets of the editor's slash menu. Blocks are stored in
 * BlockNote's full form (text nodes, not plain strings), so the database search finds their text.
 */

type Styles = {bold?: true; italic?: true; textColor?: string};
type Inline = {type: "text"; text: string; styles: Styles};
export type TemplateBlock = Record<string, unknown>;

const text = (value: string, styles: Styles = {}): Inline => ({type: "text", text: value, styles});
const hint = (value: string) => text(value, {italic: true, textColor: "gray"});

const heading = (value: string, level = 2): TemplateBlock => ({
  type: "heading", props: {level, textColor: "default", backgroundColor: "default", textAlignment: "left", isToggleable: false},
  content: [text(value)], children: [],
});
const paragraph = (...content: Inline[]): TemplateBlock => ({
  type: "paragraph", props: {textColor: "default", backgroundColor: "default", textAlignment: "left"}, content, children: [],
});
const bullet = (...content: Inline[]): TemplateBlock => ({
  type: "bulletListItem", props: {textColor: "default", backgroundColor: "default", textAlignment: "left"}, content, children: [],
});
const check = (value: string): TemplateBlock => ({
  type: "checkListItem", props: {textColor: "default", backgroundColor: "default", textAlignment: "left", checked: false},
  content: [text(value)], children: [],
});
const quote = (...content: Inline[]): TemplateBlock => ({
  type: "quote", props: {textColor: "default", backgroundColor: "default"}, content, children: [],
});
const divider = (): TemplateBlock => ({type: "divider", props: {}, children: []});

/** A two-column form table: bold labels on the left, empty cells to fill in on the right. */
const fieldTable = (labels: string[]): TemplateBlock => ({
  type: "table",
  props: {textColor: "default"},
  content: {
    type: "tableContent",
    columnWidths: [230, 400],
    rows: labels.map((label) => ({cells: [[text(label, {bold: true})], []]})),
  },
  children: [],
});

const listTable = (headers: string[], rows = 3): TemplateBlock => ({
  type: "table",
  props: {textColor: "default"},
  content: {
    type: "tableContent",
    headerRows: 1,
    rows: [
      {cells: headers.map((header) => [text(header, {bold: true})])},
      ...Array.from({length: rows}, () => ({cells: headers.map(() => [])})),
    ],
  },
  children: [],
});

export interface CaseTemplate {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  blocks: () => TemplateBlock[];
}

export const CASE_TEMPLATES: CaseTemplate[] = [
  {
    id: "investigation",
    label: "Nyomozati akta",
    description: "Összefoglaló, előzmények, helyszín, személyek, bizonyítékok, teendők és következtetés.",
    icon: FileSearch,
    blocks: () => [
      heading("1. Az ügy összefoglalása"),
      paragraph(hint("Röviden: mi történt, mikor, hol, és mi a nyomozás célja.")),
      heading("2. Előzmények, bejelentés"),
      paragraph(hint("Ki és hogyan jelezte az esetet, milyen korábbi ügyekhez kapcsolódik (@akta).")),
      heading("3. Helyszíni szemle"),
      fieldTable(["Időpont", "Helyszín", "Jelen voltak", "Megállapítások"]),
      heading("4. Érintett személyek, vallomások"),
      paragraph(hint("Hivatkozz a személyekre „@” jellel; a vallomásokat idézet blokkba írd.")),
      heading("5. Bizonyítékok"),
      paragraph(hint("A feltöltött fájlokat a „/bizonyíték” paranccsal illesztheted be.")),
      heading("6. Teendők"),
      check("Tanúk kihallgatása"),
      check("Térfigyelő felvételek bekérése"),
      check("Parancsok igénylése"),
      heading("7. Következtetés, javaslat"),
      paragraph(hint("A nyomozás eredménye, a javasolt intézkedés (vádemelés, körözés, lezárás).")),
    ],
  },
  {
    id: "scene",
    label: "Helyszíni szemle",
    description: "Jegyzőkönyv a helyszínről, lefoglalt tárgyakkal és fényképekkel.",
    icon: ClipboardList,
    blocks: () => [
      heading("Helyszíni szemle jegyzőkönyve", 1),
      fieldTable(["Időpont", "Helyszín", "Szemlét végezte", "Jelen voltak", "Látási viszonyok"]),
      heading("A helyszín leírása"),
      paragraph(hint("Az épület, helyiség, jármű állapota, behatolási nyomok, sérülések.")),
      heading("Lefoglalt tárgyak"),
      listTable(["#", "Tárgy", "Fellelés helye", "Megjegyzés"]),
      heading("Fényképek"),
      paragraph(hint("„/bizonyíték” – a feltöltött felvételek beillesztése.")),
    ],
  },
  {
    id: "interview",
    label: "Kihallgatási jegyzőkönyv",
    description: "Kihallgatott személy, körülmények, vallomás és a nyomozó megjegyzései.",
    icon: MessagesSquare,
    blocks: () => [
      heading("Kihallgatási jegyzőkönyv", 1),
      fieldTable(["Kihallgatott", "Minősége", "Időpont", "Helyszín", "Kihallgató", "Jelen voltak"]),
      heading("Figyelmeztetések"),
      bullet(text("A kihallgatott tájékoztatást kapott a jogairól.")),
      bullet(text("Ügyvéd jelenléte: "), hint("igen / nem")),
      heading("Vallomás"),
      quote(hint("A vallomás szövege, lehetőleg szó szerint.")),
      heading("A nyomozó megjegyzései"),
      paragraph(hint("Ellentmondások, viselkedés, további ellenőrizendő állítások.")),
    ],
  },
  {
    id: "blank",
    label: "Üres akta",
    description: "Üres dokumentum, saját felépítéssel.",
    icon: FilePlus2,
    blocks: () => [],
  },
];

/** Slash menu snippets: ready-made blocks inserted after the cursor. */
export const DOCUMENT_SNIPPETS: {id: string; title: string; subtext: string; aliases: string[]; blocks: () => TemplateBlock[]}[] = [
  {
    id: "statement",
    title: "Tanúvallomás",
    subtext: "Címsor, adatok és a vallomás idézetként",
    aliases: ["vallomas", "tanu", "statement"],
    blocks: () => [
      heading("Tanúvallomás", 3),
      fieldTable(["Tanú", "Időpont", "Rögzítette"]),
      quote(hint("A vallomás szövege.")),
    ],
  },
  {
    id: "seized",
    title: "Lefoglalt tárgyak",
    subtext: "Táblázat a lefoglalt eszközökről",
    aliases: ["lefoglalt", "targyak", "foglalas"],
    blocks: () => [heading("Lefoglalt tárgyak", 3), listTable(["#", "Tárgy", "Fellelés helye", "Megjegyzés"])],
  },
  {
    id: "timeline",
    title: "Idővonal",
    subtext: "Események időrendben",
    aliases: ["idovonal", "esemenyek", "timeline"],
    blocks: () => [
      heading("Idővonal", 3),
      bullet(text("00:00 – ", {bold: true}), hint("esemény")),
      bullet(text("00:00 – ", {bold: true}), hint("esemény")),
    ],
  },
  {
    id: "separator",
    title: "Új fejezet",
    subtext: "Elválasztó és címsor",
    aliases: ["fejezet", "szakasz"],
    blocks: () => [divider(), heading("Új fejezet")],
  },
];
