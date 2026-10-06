import {expect, test} from "@playwright/test";
import {
  cleanMemberName, findDutyRows, judgeDutyScan, matchMember, mergeDutyRows, parseMinutes, type OcrLineLike, type OcrWordLike,
} from "../src/lib/duty-ocr/parse";

/**
 * Lines laid out like Tesseract returns them for a 1080p screenshot of the UCP "Frakció tagok"
 * list (made-up members), with the side menu and the character switcher on the left.
 */
const word = (text: string, x0: number, y0: number, x1: number, y1 = y0 + 14): OcrWordLike => ({text, confidence: 90, bbox: {x0, y0, x1, y1}});
const line = (...words: OcrWordLike[]): OcrLineLike => ({
  text: words.map((item) => item.text).join(" "), confidence: 90, words,
  bbox: {x0: Math.min(...words.map((item) => item.bbox.x0)), y0: Math.min(...words.map((item) => item.bbox.y0)),
    x1: Math.max(...words.map((item) => item.bbox.x1)), y1: Math.max(...words.map((item) => item.bbox.y1))},
});

/** A member block: name, status line, and the pill ("1586 perc", or merged "101perc"). */
const block = (y: number, name: string, pill: OcrWordLike[], status = "Utoljara online: 2026. oktober 5."): OcrLineLike[] => [
  line(...name.split(" ").map((part, index) => word(part, 478 + index * 60, y, 470 + (index + 1) * 60))),
  line(...status.split(" ").map((part, index) => word(part, 478 + index * 55, y + 24, 525 + index * 55))),
  line(word("(©", 1518, y + 10, 1533), ...pill),
];

const PAGE: OcrLineLike[] = [
  line(word("Tagok", 452, 251, 510)),
  line(word("Napi", 67, 319, 101), word("Ajandék", 106, 319, 168)),
  ...block(315, "Kitalált Kristóf", [word("1586", 1539, 327, 1567, 339), word("perc", 1571, 327, 1598, 339)]),
  ...block(392, "Teszt Elek", [word("101perc", 1549, 403, 1598, 415)]),
  ...block(467, "Demó Dénes", [word("Operc", 1559, 477, 1598, 492)]),
  ...block(544, "Minta T Mónika", [word("125", 1559, 557, 1579, 569), word("perc", 1583, 557, 1610, 569)], "Jelenleg online"),
  // A member whose pill was not read at all.
  ...block(620, "Próba Panna", []).slice(0, 2),
  // The character switcher in the side menu: a name, but not a member row.
  line(word("Kitalált", 33, 907, 80), word("Kristóf", 85, 907, 130)),
];

test.describe("duty time reading", () => {
  test("rows come from the pills and the names' column; the side menu is ignored", () => {
    const rows = findDutyRows(PAGE);
    expect(rows.map((row) => [row.name, row.minutes])).toEqual([
      ["Kitalált Kristóf", 1586], ["Teszt Elek", 101], ["Demó Dénes", 0], ["Minta T Mónika", 125], ["Próba Panna", null],
    ]);
    // The pills can be read again from their boxes.
    expect(rows[0].valueBox).toMatchObject({x0: 1539, x1: 1598});
    expect(rows[4].valueBox).toBeNull();
  });

  test("the names' column is found without the status lines too", () => {
    const withoutStatus = PAGE.filter((item) => !/online/i.test(item.text));
    expect(findDutyRows(withoutStatus).map((row) => row.name)).toEqual(["Kitalált Kristóf", "Teszt Elek", "Demó Dénes", "Minta T Mónika"]);
  });

  test("minutes survive the usual misreadings", () => {
    expect(parseMinutes("1586 perc")).toBe(1586);
    expect(parseMinutes("101perc")).toBe(101);
    expect(parseMinutes("Operc")).toBe(0);
    expect(parseMinutes("1 586 perc")).toBe(1586);
    expect(parseMinutes("125 perce")).toBe(125);
    expect(parseMinutes("perc")).toBeNull();
    expect(parseMinutes("99999 perc")).toBeNull();
    expect(parseMinutes("LEADER")).toBeNull();
  });

  test("names: initials in the middle, no single letters at the ends, no status lines", () => {
    expect(cleanMemberName("Eriksen T Brownie")).toBe("Eriksen T Brownie");
    expect(cleanMemberName("Reid S. Merriman")).toBe("Reid S. Merriman");
    expect(cleanMemberName("T Brownie")).toBeNull();
    expect(cleanMemberName("Jelenleg online")).toBeNull();
    expect(cleanMemberName("Lisa")).toBeNull();
  });

  const members = [
    {id: "1", full_name: "Kitalált Kristóf"}, {id: "2", full_name: "Teszt Elek"}, {id: "3", full_name: "Minta T. Mónika"},
    {id: "4", full_name: "Harvey Cooper"}, {id: "5", full_name: "Próba Panna"},
  ];

  test("names match members exactly, by a close spelling, or cut at the edge", () => {
    expect(matchMember("Minta T Mónika", members)).toMatchObject({member: {id: "3"}, exact: true});
    expect(matchMember("Kitalalt Kristof", members)).toMatchObject({member: {id: "1"}, exact: true});
    expect(matchMember("Teszt Elck", members)).toMatchObject({member: {id: "2"}, exact: false});
    expect(matchMember("Harvey Coo", members)).toMatchObject({member: {id: "4"}, exact: false});
    expect(matchMember("Senki Sem", members)).toBeNull();
  });

  test("overlapping pictures agree; differing readings and close names are doubtful, unreadable ones missing", () => {
    const merged = mergeDutyRows([
      {name: "Kitalált Kristóf", minutes: 1586, certain: true},
      {name: "Kitalált Kristóf", minutes: 1586, certain: true},
      {name: "Teszt Elek", minutes: 101, certain: true},
      {name: "Teszt Elek", minutes: 1, certain: true},
      {name: "Harvey Coo", minutes: 0, certain: true},
      {name: "Próba Panna", minutes: null, certain: false},
      {name: "Senki Sem", minutes: 30, certain: true},
    ], members);
    const byName = Object.fromEntries(merged.map((row) => [row.member?.full_name ?? row.name, row]));
    expect(byName["Kitalált Kristóf"]).toMatchObject({minutes: 1586, status: "ok"});
    expect(byName["Teszt Elek"]).toMatchObject({status: "doubtful"});
    expect(byName["Harvey Cooper"]).toMatchObject({minutes: 0, status: "doubtful", fuzzyName: true});
    expect(byName["Próba Panna"]).toMatchObject({minutes: null, status: "missing"});
    expect(byName["Senki Sem"]).toMatchObject({member: null});
    expect(judgeDutyScan(merged)).toEqual({ok: true});
  });

  test("pictures are rejected when nothing, no member, or mostly unreadable numbers were found", () => {
    expect(judgeDutyScan([])).toMatchObject({ok: false});
    expect(judgeDutyScan(mergeDutyRows([{name: "Senki Sem", minutes: 30, certain: true}], members))).toMatchObject({ok: false});
    const unreadable = mergeDutyRows([
      {name: "Kitalált Kristóf", minutes: null, certain: false},
      {name: "Teszt Elek", minutes: null, certain: false},
      {name: "Próba Panna", minutes: 12, certain: true},
    ], members);
    expect(judgeDutyScan(unreadable)).toMatchObject({ok: false, reason: expect.stringContaining("nem olvasható")});
  });
});
