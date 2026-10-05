import {expect, test} from "@playwright/test";
import {folderCode, folderThreadId, normalizeForumUrl, reportCode, reportDateKey, type ReportForm} from "../src/lib/report-templates";

// The forum requires this exact layout (agreed template). A change here must be deliberate.
const FORM: ReportForm = {
  officerName: "John Smith", officerRank: "Corporal", badgeNumber: "1234", colleagues: "Jane Doe, Deputy Sheriff II.",
  unitId: "6-L-005", suspectName: "Mark Black", suspectIdCard: "AB123", suspectLicense: "JK456", suspectMedical: "EU789",
  date: "2026. 10. 05.", charges: "Gyorshajtás (GV)", fine: "1500000", jailTime: "30", confiscatedItems: "-",
  description: "Megállítottuk a járművet.",
};

const EXPECTED_REPORT = `[QUOTE]
[IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[FONT=book antiqua][U]San Fierro Sheriff's Department - Personnel Administration Bureau: Jelentés[/U][/FONT]

[SIZE=4][FONT=book antiqua][B]I. Rendvédelmi személyek információi:[/B][/FONT][/SIZE]

[FONT=arial][COLOR=rgb(124, 112, 107)][B]Teljes neve:[/B][/COLOR] John Smith
[COLOR=rgb(124, 112, 107)][B]Rendfokozata:[/B][/COLOR] Corporal
[COLOR=rgb(124, 112, 107)][B]Jelvényszáma:[/B][/COLOR] 1234
[COLOR=rgb(124, 112, 107)][B]Jelenlévő kollégák nevei, rendfokozataik:[/B][/COLOR] Jane Doe, Deputy Sheriff II.
[COLOR=rgb(124, 112, 107)][B]Intézkedést kezdeményező egység azonosítója:[/B][/COLOR] 6-L-005[/FONT]

[SIZE=4][FONT=book antiqua][B]II. Előállított személy információi:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállított személy teljes neve:[/B][/COLOR] Mark Black
[COLOR=rgb(124, 112, 107)][B]Személyazonosító igazolvány sorszáma:[/B][/COLOR] AB123
[COLOR=rgb(124, 112, 107)][B]Jogosítvány sorszáma:[/B][/COLOR] JK456
[COLOR=rgb(124, 112, 107)][B]Egészségügyi sorszáma:[/B][/COLOR] EU789

[SIZE=4][FONT=book antiqua][B]III. Előállítás részletei:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállítás pontos ideje (nap/hónap/év):[/B][/COLOR] 2026. 10. 05.
[COLOR=rgb(124, 112, 107)][B]Vétség/bűncselekmény megnevezése:[/B][/COLOR] Gyorshajtás (GV)
[COLOR=rgb(124, 112, 107)][B]Kiszabott bírság összege:[/B][/COLOR] $1.500.000
[COLOR=rgb(124, 112, 107)][B]Kiszabott szabadságvesztés hossza:[/B][/COLOR] 30 hónap
[COLOR=rgb(124, 112, 107)][B]Lefoglalt illegális tárgyak/lőfegyverek/szúró-vágó eszközök, drogterjesztéssel kapcsolatos termékek megnevezése illetve darabszáma:[/B][/COLOR] -

[SIZE=4][FONT=book antiqua][B]IV. Esetleírás:[/B][/FONT][/SIZE]

Megállítottuk a járművet.

[RIGHT][FONT=arial][COLOR=rgb(124, 112, 107)][B]Aláírás:[/B] [/COLOR]John Smith, Corporal[/FONT][/RIGHT]
[/QUOTE]`;

test.describe("forum report template", () => {
  test("the report keeps the forum's template character by character", () => {
    expect(reportCode(FORM)).toBe(EXPECTED_REPORT);
  });

  test("dashes and already formatted amounts are kept", () => {
    const code = reportCode({...FORM, fine: "-", jailTime: "-"});
    expect(code).toContain("[B]Kiszabott bírság összege:[/B][/COLOR] -\n");
    expect(code).toContain("[B]Kiszabott szabadságvesztés hossza:[/B][/COLOR] -\n");
  });

  test("the folder post keeps its template", () => {
    expect(folderCode("John Smith")).toBe(`[CENTER][IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[SIZE=5][FONT=book antiqua]San Fierro Sheriff's Department - Personnel Administration Bureau: John Smith jelentési mappája[/FONT][/SIZE]
[/CENTER]`);
  });

  test("report dates and forum links are read", () => {
    expect(reportDateKey("2026. 10. 05.")).toBe("2026-10-05");
    expect(reportDateKey("05/10/2026")).toBe("2026-10-05");
    expect(reportDateKey("2026.02.30.")).toBeNull();
    // Members only see their folder's (thread's) link: page numbers and anchors are dropped.
    expect(normalizeForumUrl("https://forum.hl-rpg.eu/threads/john-smith-jelentesi-mappaja.123/")).toBe("https://forum.hl-rpg.eu/threads/john-smith-jelentesi-mappaja.123/");
    expect(normalizeForumUrl("https://forum.hl-rpg.eu/threads/john-smith-jelentesi-mappaja.123/page-3#post-456789")).toBe("https://forum.hl-rpg.eu/threads/john-smith-jelentesi-mappaja.123/");
    expect(normalizeForumUrl("https://forum.hl-rpg.eu/threads/x.123?foo=1")).toBe("https://forum.hl-rpg.eu/threads/x.123/");
    expect(folderThreadId("https://forum.hl-rpg.eu/threads/john-smith-jelentesi-mappaja.123/")).toBe("123");
    expect(normalizeForumUrl("https://forum.hl-rpg.eu/posts/456789/")).toBe("https://forum.hl-rpg.eu/posts/456789/");
    expect(normalizeForumUrl("https://example.com/posts/1/")).toBeNull();
  });
});
