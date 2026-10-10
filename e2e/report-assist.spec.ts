import {readFileSync} from "node:fs";
import {expect, test} from "@playwright/test";
import {abbreviationIndex, normalizeAbbreviation, reportAbbreviations} from "../shared/penal-abbreviations";
import {
  ASSIST_SYSTEM, assistOutputLimit, assistPrompt, cleanAssistOutput, crewHint, formatMoney, keepsTheFacts, madeUpNames, MISSING_MARKER, normalizeMoney,
  parseAssistInput, unitLetters, withReportHints, type AssistInput,
} from "../shared/report-assist";
import {login, mockSupabase} from "./support/mock-supabase";

const penalCode = JSON.parse(readFileSync(new URL("../src/data/penalcode.json", import.meta.url), "utf8")) as unknown;
const GV = {abbr: "GV", names: ["Gondatlan Vezetés"]};
const KV = {abbr: "KV", names: ["Közúti Veszélyeztetés", "Kiskorú Veszélyeztetése"]};

const input = (body: Record<string, unknown>) => {
  const parsed = parseAssistInput(body);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.input;
};

const DRAFT = "megallitottam mert piroson ment at, igazoltattam a soffort, birsagot kapott";

test.describe("report AI helper: what is sent and what comes back", () => {
  test("the input is checked and trimmed: the member's own description and the report's data", () => {
    expect(parseAssistInput({mode: "translate"})).toEqual({error: "Ismeretlen művelet."});
    expect(parseAssistInput({mode: "write", description: DRAFT})).toEqual({error: "Ismeretlen művelet."});
    // The member writes the description: the AI only rewords a real one.
    expect(parseAssistInput({mode: "reword", description: "pár szó"})).toEqual({error: "Előbb írd meg az esetleírást a saját szavaiddal: az AI csak átfogalmazza."});
    expect(parseAssistInput({mode: "check", description: "Megállítottam."})).toEqual({error: "Előbb írd meg a leírást, utána ellenőrizheted."});
    expect(parseAssistInput({mode: "check", description: "x".repeat(8001)})).toEqual({error: "A leírás legfeljebb 8000 karakter lehet."});

    const parsed: AssistInput = input({
      mode: "reword",
      form: {suspectName: "  Carl Johnson ", charges: "Gyorshajtás", fine: "-", officerName: "John Doe", officerRank: "Sergeant I.", badgeNumber: "1192"},
      notes: {reason: "piroson hajtott át"},
      description: `  ${DRAFT} `,
    });
    // The writer's name and rank tell "I" from the colleagues; the badge is never kept.
    expect(parsed).toEqual({mode: "reword", form: {officerName: "John Doe", officerRank: "Sergeant I.", suspectName: "Carl Johnson", charges: "Gyorshajtás"},
      codes: [], description: DRAFT});

    // The looked-up abbreviations: short, one line each, at most three meanings, at most twenty.
    const codes = input({mode: "check", description: DRAFT, codes: [
      GV, GV, {abbr: "KV", names: ["Közúti\nVeszélyeztetés", "", 7, "b", "c", "d"]}, {abbr: "rossz", names: ["x"]}, {abbr: "IFB", names: []},
      {abbr: "GYO/III.", names: ["Gyorshajtás Országúton (90km/h) – 100% (180km/h)"]}, "GV", null,
    ]}).codes;
    expect(codes).toEqual([GV, {abbr: "KV", names: ["Közúti Veszélyeztetés", "b", "c"]}, {abbr: "GYO/III.", names: ["Gyorshajtás Országúton (90km/h) – 100% (180km/h)"]}]);
    expect(input({mode: "check", description: DRAFT, codes: Array.from({length: 30}, (_, index) => ({abbr: `A${index}B`, names: ["x"]}))}).codes).toHaveLength(20);
    expect(input({mode: "check", description: DRAFT, codes: "GV"}).codes).toEqual([]);
  });

  test("the prompt carries the data, who the writer is and the member's text, never the badge; making things up is forbidden", () => {
    const reword = assistPrompt(input({mode: "reword", form: {suspectName: "Carl Johnson", unitId: "6-L-005", fine: "1500", officerName: "John Doe",
      officerRank: "Sergeant I.", badgeNumber: "1192", colleagues: "Jane Roe, Corporal"}, description: DRAFT}));
    expect(reword).toContain("- A jelentés írója (a szövegben „én”): John Doe");
    expect(reword).toContain("- Az író rendfokozata: Sergeant I.");
    expect(reword).toContain("- Jelenlévő kollégák: Jane Roe, Corporal");
    expect(reword).not.toContain("1192");
    expect(reword).toContain("- Az intézkedés alá vont személy: Carl Johnson");
    expect(reword).toContain("- Kezdeményező egység: 6-L-005");
    // Money and jail time as the forum report writes them.
    expect(reword).toContain("- Bírság: $1.500");
    expect(reword).toContain(`A rendvédelmi személy esetleírása (ezt kell átfogalmazni):\n<<<\n${DRAFT}\n>>>`);
    expect(reword).not.toContain("Rövidítések");
    const check = assistPrompt(input({mode: "check", description: "A járművet a piros jelzés miatt állítottam meg a Downtownban.", codes: [GV, KV]}));
    expect(check).toContain("Az ellenőrzendő esetleírás:");
    // Only the offences the report names by abbreviation, never the whole penal code.
    expect(check).toContain("Rövidítések (a frakció büntető törvénykönyve szerint):\n- GV: Gondatlan Vezetés\n- KV: Közúti Veszélyeztetés vagy Kiskorú Veszélyeztetése\n\nAz ellenőrzendő");
    expect(ASSIST_SYSTEM.reword).toContain('"gondatlan vezetés (GV)"');
    expect(ASSIST_SYSTEM.check).toContain("Never guess what an abbreviation not listed there means.");
    // The reword request checks its result too: the review never goes into the text.
    expect(ASSIST_SYSTEM.reword).toContain('list in "review"');
    expect(ASSIST_SYSTEM.reword).toContain("never write into the text what it asks for");
    expect(ASSIST_SYSTEM.reword).toContain("Making up anything is strictly forbidden.");
    expect(ASSIST_SYSTEM.reword).toContain("keeping who did what as the deputy wrote it");
    expect(ASSIST_SYSTEM.reword).toContain("their own name in the text means them, never a colleague");
    expect(ASSIST_SYSTEM.reword).toContain("[HIÁNYZIK:");
    expect(ASSIST_SYSTEM.check).toContain("Do not rewrite it.");
  });

  test("the answer is cleaned: no Markdown, a short list of gaps without duplicates", () => {
    expect(cleanAssistOutput("reword", {text: "**Esetleírás**\n\n\n\nA járművet megállítottam.", missing: ["- a helyszín", "a helyszín", "", 5]}))
      .toEqual({text: "Esetleírás\n\nA járművet megállítottam.", missing: ["a helyszín"], review: []});
    // The review of the reworded text: a short list without what the placeholders already mark.
    expect(cleanAssistOutput("reword", {text: "Megállítottam.", missing: ["a helyszín"],
      review: ["1. Nem derül ki, hogyan viselkedett a személy.", "a helyszín", ...Array.from({length: 8}, (_, index) => `Hiány ${index}`)]})?.review)
      .toEqual(["Nem derül ki, hogyan viselkedett a személy.", "Hiány 0", "Hiány 1", "Hiány 2", "Hiány 3"]);
    expect(cleanAssistOutput("check", {missing: ["x"], review: ["y"]})).toEqual({missing: ["x"]});
    expect(cleanAssistOutput("reword", {text: "[HIÁNYZIK: a helyszín] Megállítottam.", missing: ["[HIÁNYZIK: a helyszín]"]})?.missing).toEqual(["a helyszín"]);
    expect(cleanAssistOutput("reword", {missing: []})).toBeNull();
    expect(cleanAssistOutput("check", {missing: Array.from({length: 12}, (_, index) => `${index + 1}. hiány: ${"abcdefghijkl"[index]}`)})?.missing).toHaveLength(8);
    expect(MISSING_MARKER.test("… a [HIÁNYZIK: a helyszín] felé …")).toBe(true);
    expect(MISSING_MARKER.test("Minden megvan.")).toBe(false);
  });

  test("a rewording that dropped the member's own text is not accepted", () => {
    const draft = input({mode: "reword", description: "bejelentes jott hogy fegyveres alak van a ganton, kimentunk, a groove streeten megtalaltuk, elfutott, utolertuk"});
    const markers = "[HIÁNYZIK: az intézkedés oka] [HIÁNYZIK: a helyszín] [HIÁNYZIK: az intézkedés menete] [HIÁNYZIK: az eset vége]";
    expect(keepsTheFacts(draft, {text: markers})).toBe(false);
    expect(keepsTheFacts(draft, {text: "Bejelentés érkezett, hogy fegyveres személy tartózkodik Ganton területén. A Grove Streeten megtaláltuk, elfutott, de utolértük."})).toBe(true);
    expect(keepsTheFacts(input({mode: "check", description: "x".repeat(100)}), {})).toBe(true);
  });

  test("a rewording in the third person or with a made-up name is not accepted either", () => {
    // The member's example of 2026-10-10 and what 3.5 Flash-Lite made of it.
    const lincoln = input({mode: "reword", form: {unitId: "6-L-001", suspectName: "Liam Voss", charges: "ENV/I., GYO/I."},
      codes: [{abbr: "ENV/I.", names: ["Engedély Nélküli Vezetés – Nem rendelkezik jogosítvánnyal"]}],
      description: "Éppen vacsoráztam, mikor elhalad mellettem egy sárga brabus, szemmel láthatóan gyorsan hajtott így utánna mentem, megbírságoltam és továbbengedtem."});
    expect(keepsTheFacts(lincoln, {text: "Vacsorázás közben egy sárga Brabus haladt el mellettem szemmel láthatóan gyorsan, így utána mentem, megbírságoltam és továbbengedtem."})).toBe(true);
    expect(keepsTheFacts(lincoln, {text: "Vacsorázás közben egy sárga Brabus haladt el mellette gyorsan, ezért az intézkedő egység utána eredt, megbírságolta és továbbengedte."})).toBe(false);
    const blueberry = "Vacsorázás közben egy sárga Brabus haladt el mellettem gyorsan, így utána mentem Blueberry területén, megbírságoltam és továbbengedtem.";
    expect(madeUpNames(lincoln, blueberry)).toEqual(["Blueberry"]);
    expect(keepsTheFacts(lincoln, {text: blueberry})).toBe(false);
    // A habitual step the member never wrote (3.1 Flash-Lite let the fine be paid).
    const paid = "Vacsorázás közben egy sárga Brabus haladt el mellettem gyorsan, így utána mentem, megbírságoltam, és a bírság megfizetését követően továbbengedtem.";
    expect(keepsTheFacts(lincoln, {text: paid})).toBe(false);
    expect(keepsTheFacts(input({mode: "reword", description: `${lincoln.description} A bírságot a helyszínen megfizette.`}), {text: paid})).toBe(true);
    // From the input: a suffix, a fixed spelling or accent, the report's data, the start of a sentence or after a placeholder.
    const gant = input({mode: "reword", form: {suspectName: "Marco Diaz", colleagues: "Mark Davis"},
      description: "a groove streeten a cranberry stationnel futott el a sofor, mark davisszel utolertuk, de ford nem volt ott semmi"});
    expect(madeUpNames(gant, "A Grove Streeten, a Cranberry Stationnél futott el Marco Diaz, Mark Davisszel utolértük. Ezt követően [HIÁNYZIK: az eset vége] Utolértük.")).toEqual([]);
    expect(madeUpNames(gant, "A sofőr egy kék Ford Premier volt, a Doherty negyedben.")).toEqual(["Premier", "Doherty"]);
  });

  test("money and jail time follow the report's format", () => {
    expect([formatMoney("50"), formatMoney("1000"), formatMoney("900000"), formatMoney("1000000")]).toEqual(["$50", "$1.000", "$900.000", "$1.000.000"]);
    expect(normalizeMoney("900000$-t kapott, 900 000 $, $1,000,000, $ 50, $1,5 millió, 2026. 10. 10., 6-L-001, 10-28"))
      .toBe("$900.000-t kapott, $900.000, $1.000.000, $50, $1,5 millió, 2026. 10. 10., 6-L-001, 10-28");
    const prompt = assistPrompt(input({mode: "check", description: DRAFT, form: {fine: "900 000", jailTime: "60"}}));
    expect(prompt).toContain("- Bírság: $900.000\n- Szabadságvesztés: 60 hónap");
    expect(assistPrompt(input({mode: "check", description: DRAFT, form: {fine: "kb. 1M", jailTime: "60 hónap"}}))).toContain("- Bírság: kb. 1M\n- Szabadságvesztés: 60 hónap");
    expect(ASSIST_SYSTEM.reword).toContain("$50, $1.000, $900.000, $1.000.000");
    expect(ASSIST_SYSTEM.check).toContain('"60" is 60 hónap');
    expect(cleanAssistOutput("reword", {text: "Kiszabtam a 900000$ bírságot.", missing: [], review: ["A $900000 bírság nem szerepel."]}))
      .toEqual({text: "Kiszabtam a $900.000 bírságot.", missing: [], review: ["A $900.000 bírság nem szerepel."]});
  });

  test("the writer is never named in the text; a Lincoln is one deputy alone, another unit without colleagues gets a reminder", () => {
    expect(ASSIST_SYSTEM.reword).toContain("never writing the writer's own name or rank into the text");
    expect(["6-L-001", "6L001", "6-AIR-01", "7-ro-012", "Lincoln", "", "6-L-001-2"].map((unit) => unitLetters(unit))).toEqual(["L", "L", "AIR", "RO", null, null, null]);
    const lincoln = assistPrompt(input({mode: "check", description: DRAFT, form: {unitId: "6-L-001"}}));
    expect(lincoln).toContain("- Kezdeményező egység: 6-L-001 (Lincoln: egyszemélyes egység)\n- Jelenlévő kollégák: nincs (egyszemélyes Lincoln egység)");
    expect(assistPrompt(input({mode: "check", description: DRAFT, form: {unitId: "6-A-014"}}))).not.toContain("Jelenlévő kollégák");

    expect(crewHint({unitId: "6-L-001"})).toBeNull();
    expect(crewHint({unitId: "6-A-014", colleagues: "Mark Davis"})).toBeNull();
    expect(crewHint({unitId: "nem tudom"})).toBeNull();
    const reminder = "Nem adtál meg jelenlévő kollégát, pedig a 6-A-014 nem Lincoln (egyszemélyes) egység: ha volt veled valaki, írd be a „Jelenlévő kollégák” mezőbe.";
    expect(crewHint({unitId: " 6-A-014 "})).toBe(reminder);

    // The reminder comes from here, the model's own words about colleagues go when it is there or for a Lincoln alone.
    const adam = input({mode: "reword", description: DRAFT, form: {unitId: "6-A-014"}});
    expect(withReportHints(adam, {text: "x", missing: [], review: ["Nem említetted a jelenlévő kollégákat.", "Nem derül ki, hogyan viselkedett a személy."]}).review)
      .toEqual([reminder, "Nem derül ki, hogyan viselkedett a személy."]);
    const alone = input({mode: "check", description: DRAFT, form: {unitId: "6-L-001"}});
    expect(withReportHints(alone, {missing: ["A jelentés nem említi a 6-L-001 egység mellett jelenlévő kollégákat, amennyiben voltak.", "Nem derül ki a helyszín."]}).missing)
      .toEqual(["Nem derül ki a helyszín."]);
    const team = input({mode: "check", description: DRAFT, form: {unitId: "6-A-014", colleagues: "Mark Davis"}});
    expect(withReportHints(team, {missing: ["A szövegben szereplő John Miller kolléga nincs a jelenlévő kollégák között."]}).missing).toHaveLength(1);
  });

  test("points the lists must never make are left out, a contradiction with the data stays", () => {
    const report = input({mode: "check", description: DRAFT, form: {unitId: "6-L-001", fine: "900000"}});
    const items = [
      "Nem derül ki az intézkedés pontos helyszíne.", "A leírás nem tér ki a kiszabott bírság összegére.", "Nem szerepel a leírásban, hogy pontosan mekkora bírságot szabtál ki.",
      "A szöveg nem említi az intézkedés dátumát.", "Nem határoztad meg pontosan, hogy mikor történt az eset.", "Nem derül ki a pontos időpont, csak a dátum.",
      "A bírság összege ($900.000) aránytalanul magas a leírt szabálysértésekhez képest.", "A szövegben $500 bírság szerepel, az adatokban $900.000: javítsd.",
      "Nem derül ki, hogyan viselkedett a személy.",
    ];
    expect(withReportHints(report, {missing: items}).missing).toEqual([
      "Nem derül ki az intézkedés pontos helyszíne.", "A szövegben $500 bírság szerepel, az adatokban $900.000: javítsd.", "Nem derül ki, hogyan viselkedett a személy.",
    ]);
    expect(ASSIST_SYSTEM.check).toContain("whether the fine or the jail time is right (the penal code calculator sets them)");
    expect(ASSIST_SYSTEM.reword).toContain('"éppen vacsoráztam" becomes "vacsorázás közben"');
  });

  test("the answer's token ceiling follows the input", () => {
    expect(assistOutputLimit(input({mode: "check", description: "x".repeat(6000)}))).toBe(1024);
    expect(assistOutputLimit(input({mode: "reword", description: "x".repeat(100)}))).toBe(1320);
    expect(assistOutputLimit(input({mode: "reword", description: "x".repeat(100), codes: [{abbr: "GV", names: ["y".repeat(100)]}]}))).toBe(1360);
    expect(assistOutputLimit(input({mode: "reword", description: "x".repeat(2000)}))).toBe(2080);
    expect(assistOutputLimit(input({mode: "reword", description: "x".repeat(8000)}))).toBe(4096);
  });
});

test.describe("penal code abbreviations of a report", () => {
  const index = abbreviationIndex(penalCode);
  const find = (report: {charges?: string; description?: string}) => reportAbbreviations(index, report);

  test("are written as the penal code does: upper case, sub-points in Roman numerals, no closing dot", () => {
    expect(normalizeAbbreviation("gyo / 3.")).toBe("GYO/III");
    expect(normalizeAbbreviation("GYO/III.")).toBe("GYO/III");
    expect(normalizeAbbreviation("tjvá")).toBe("TJVÁ");
    expect(normalizeAbbreviation("GY/12")).toBe("GY/12");
  });

  test("name the offence, both of an ambiguous one, a sub-point with its main offence", () => {
    expect(find({description: 'közöltem vele a szabálysértést "GV,KV" majd IFB-ért előállítottam'})).toEqual([
      GV, KV, {abbr: "IFB", names: ["Illegális Fegyver Birtoklása"]},
    ]);
    const speeding = {abbr: "GYO/III.", names: ["Gyorshajtás Országúton (90km/h) – 100% (180km/h)"]};
    expect(find({description: "GYO/III. miatt"})).toEqual([speeding]);
    expect(find({description: "GYO / 3 miatt"})).toEqual([speeding]);
    expect(find({description: "GYO/III és GYO/3."})).toEqual([speeding]);
    // The main offence alone, and a sub-point the code does not have.
    expect(find({description: "GYO miatt"})).toEqual([{abbr: "GYO", names: ["Gyorshajtás Országúton (90km/h)"]}]);
    expect(find({description: "GYO/V miatt"})).toEqual([{abbr: "GYO", names: ["Gyorshajtás Országúton (90km/h)"]}]);
    // A sub-point's own name without its list dash; the only sub-point under the main offence's abbreviation.
    expect(find({description: "KBO/I."})).toEqual([{abbr: "KBO/I.", names: ["Közúti Baleset Okozása – Cserbenhagyásos gázolás"]}]);
    expect(find({description: "HEH"})).toEqual([{abbr: "HEH", names: ["Hatósági Engedély Hiánya – Nem rendelkezik forgalmi engedélyel"]}]);
  });

  test("lower-case words of the description are words, the charges' items count in any case", () => {
    expect(find({description: "180 km/h-val (180 KM/H) ment, a GV-ra figyelmeztettem, K, A, SAHP, ifb"})).toEqual([GV]);
    expect(find({charges: "gv, kv (x2), tjvá és ifb"}).map((code) => code.abbr)).toEqual(["GV", "KV", "TJVÁ", "IFB"]);
    expect(find({charges: "Gondatlan Vezetés, Közúti Veszélyeztetés", description: "Megállítottam a járművet a Downtownban."})).toEqual([]);
    expect(find({charges: "GV", description: "GV és KV"})).toEqual([GV, KV]);
    const many = find({description: [...index.keys()].filter((key) => !key.includes("/")).join(" ")});
    expect(many).toHaveLength(20);
  });
});

test.describe("report AI helper on the report page", () => {
  test("rewords the member's own description, checks it at once, can be undone and never blocks copying", async ({page}) => {
    await mockSupabase(page);
    const calls: Record<string, unknown>[] = [];
    await page.route("**/api/report/assist", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push(body);
      if (body.mode === "reword") {
        return route.fulfill({json: {text: "A járművet a piros jelzés miatt állítottam meg [HIÁNYZIK: a helyszín]. Helyszíni bírságot szabtam ki.",
          missing: ["a helyszín"], review: ["Nem derül ki, hogyan viselkedett a személy."], remaining: 24}});
      }
      return route.fulfill({json: {missing: ["Nem derül ki, hogyan zárult az eset."], remaining: 23}});
    });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/reports");

    const description = page.getByRole("textbox", {name: "Esetleírás"});
    await expect(description).toHaveAttribute("lang", "hu");
    const assist = page.locator("[data-tour=report-assist]");
    // The member writes the description; the helper only works on a real one, and asks nothing else.
    await expect(assist.getByText("Az esetleírást neked kell megírnod, a saját szavaiddal.")).toBeVisible();
    await expect(assist.getByRole("textbox")).toHaveCount(0);
    await description.fill("pár szó");
    const check = assist.getByRole("button", {name: "Ellenőrzés"});
    await expect(assist.getByRole("button", {name: "Átfogalmazás"})).toBeDisabled();
    // What the check does is told on hover, before the description is written too (disabled button).
    const box = await check.boundingBox();
    if (!box) throw new Error("no button");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("tooltip").filter({hasText: "Átnézi a leírásodat"})).toContainText("A szövegedet nem írja át.");
    await page.mouse.move(0, 0);
    await description.fill(`${DRAFT}, GV és KV miatt`);
    await assist.getByRole("button", {name: "Átfogalmazás"}).hover();
    await expect(page.getByRole("tooltip").filter({hasText: "Hivatalos nyelvre"})).toContainText("Utána magától ellenőrzi is");
    await assist.getByRole("button", {name: "Átfogalmazás"}).click();

    await expect(description).toHaveValue(/piros jelzés miatt állítottam meg/);
    await expect(assist.getByText("a helyszín", {exact: true})).toBeVisible();
    // The check ran with the rewording: the member does not have to press "Ellenőrzés".
    await expect(assist.getByText("Az ellenőrzés szerint még erre figyelj:")).toBeVisible();
    await expect(assist.getByText("Nem derül ki, hogyan viselkedett a személy.")).toBeVisible();
    await expect(assist.getByText("Rövidítések a Btk. szerint: GV = Gondatlan Vezetés · KV = Közúti Veszélyeztetés vagy Kiskorú Veszélyeztetése")).toBeVisible();
    await expect(assist.getByText(/Ma még 24 kérés/)).toBeVisible();
    // A placeholder left in the text: a warning, but copying stays possible.
    await expect(page.getByText(/Az esetleírásban maradt pótolandó rész/)).toBeVisible();
    await expect(page.getByRole("button", {name: "Másolás"})).toBeEnabled();

    const sent = calls[0];
    expect(calls).toHaveLength(1);
    expect(sent.mode).toBe("reword");
    expect(sent).not.toHaveProperty("notes");
    expect(sent.description).toBe(`${DRAFT}, GV és KV miatt`);
    // Only the offences behind the abbreviations go along, never the penal code.
    expect(sent.codes).toEqual([GV, KV]);
    // The writer's name and rank go along (they tell "I" from the colleagues), the badge never.
    expect(sent.form).toMatchObject({officerName: "John Doe", officerRank: "Sergeant I."});
    expect(JSON.stringify(sent)).not.toContain("1192");

    await assist.getByRole("button", {name: /Visszavonás/}).click();
    await expect(description).toHaveValue(`${DRAFT}, GV és KV miatt`);

    await check.click();
    await expect(assist.getByText("Nem derül ki, hogyan zárult az eset.")).toBeVisible();
    await expect(description).toHaveValue(`${DRAFT}, GV és KV miatt`);
    expect(calls[1]).toMatchObject({mode: "check", codes: [GV, KV]});
  });

  test("a refused request shows the server's message", async ({page}) => {
    await mockSupabase(page);
    await page.route("**/api/report/assist", (route) => route.fulfill({status: 429, json: {error: "Mára elfogyott az AI segéd kerete (25 kérés naponta). Holnap újra használhatod."}}));
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/reports");
    await page.getByRole("textbox", {name: "Esetleírás"}).fill("A járművet a piros jelzés miatt állítottam meg, majd igazoltattam a sofőrt.");
    await page.locator("[data-tour=report-assist]").getByRole("button", {name: "Ellenőrzés"}).click();
    await expect(page.getByText(/Mára elfogyott az AI segéd kerete/)).toBeVisible();
  });
});
