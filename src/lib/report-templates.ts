/**
 * The forum's BBCode templates for reports (the "Jelentések" board of forum.hl-rpg.eu).
 *
 * The forum requires exactly this layout: do not change the text, the tags or the line breaks.
 * `e2e/report-template.spec.ts` compares the output with the agreed template character by
 * character. Pure functions without imports (also used by the tests in Node).
 */

export interface ReportForm {
  officerName: string;
  officerRank: string;
  badgeNumber: string;
  colleagues: string;
  unitId: string;
  suspectName: string;
  suspectIdCard: string;
  suspectLicense: string;
  suspectMedical: string;
  /** As written into the report ("2026. 10. 05."). */
  date: string;
  charges: string;
  fine: string;
  jailTime: string;
  confiscatedItems: string;
  description: string;
}

/** "1500" -> "$1.500", "-" stays "-". */
export const formatFine = (value: string) => {
  if (value.trim() === "-" || value.trim() === "") return "-";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `$${Number(digits).toLocaleString("hu-HU").replace(/\s/g, ".")}`;
};

/** "30" -> "30 hónap", "-" stays "-". */
export const formatJailTime = (value: string) => {
  if (value.trim() === "-" || value.trim() === "") return "-";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `${digits} hónap`;
};

/** The opening post of a member's monthly report folder. */
export const folderCode = (folderName: string) => `[CENTER][IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[SIZE=5][FONT=book antiqua]San Fierro Sheriff's Department - Personnel Administration Bureau: ${folderName} jelentési mappája[/FONT][/SIZE]
[/CENTER]`;

/** One report, posted into the member's folder. */
export const reportCode = (form: ReportForm) => {
  const fine = form.fine ? (form.fine === "-" || form.fine.includes("$") ? form.fine : formatFine(form.fine)) : "";
  const jail = form.jailTime ? (form.jailTime === "-" || form.jailTime.includes("hónap") ? form.jailTime : formatJailTime(form.jailTime)) : "";

  return `[QUOTE]
[IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[FONT=book antiqua][U]San Fierro Sheriff's Department - Personnel Administration Bureau: Jelentés[/U][/FONT]

[SIZE=4][FONT=book antiqua][B]I. Rendvédelmi személyek információi:[/B][/FONT][/SIZE]

[FONT=arial][COLOR=rgb(124, 112, 107)][B]Teljes neve:[/B][/COLOR] ${form.officerName}
[COLOR=rgb(124, 112, 107)][B]Rendfokozata:[/B][/COLOR] ${form.officerRank}
[COLOR=rgb(124, 112, 107)][B]Jelvényszáma:[/B][/COLOR] ${form.badgeNumber}
[COLOR=rgb(124, 112, 107)][B]Jelenlévő kollégák nevei, rendfokozataik:[/B][/COLOR] ${form.colleagues}
[COLOR=rgb(124, 112, 107)][B]Intézkedést kezdeményező egység azonosítója:[/B][/COLOR] ${form.unitId}[/FONT]

[SIZE=4][FONT=book antiqua][B]II. Előállított személy információi:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállított személy teljes neve:[/B][/COLOR] ${form.suspectName}
[COLOR=rgb(124, 112, 107)][B]Személyazonosító igazolvány sorszáma:[/B][/COLOR] ${form.suspectIdCard}
[COLOR=rgb(124, 112, 107)][B]Jogosítvány sorszáma:[/B][/COLOR] ${form.suspectLicense}
[COLOR=rgb(124, 112, 107)][B]Egészségügyi sorszáma:[/B][/COLOR] ${form.suspectMedical}

[SIZE=4][FONT=book antiqua][B]III. Előállítás részletei:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállítás pontos ideje (nap/hónap/év):[/B][/COLOR] ${form.date}
[COLOR=rgb(124, 112, 107)][B]Vétség/bűncselekmény megnevezése:[/B][/COLOR] ${form.charges}
[COLOR=rgb(124, 112, 107)][B]Kiszabott bírság összege:[/B][/COLOR] ${fine}
[COLOR=rgb(124, 112, 107)][B]Kiszabott szabadságvesztés hossza:[/B][/COLOR] ${jail}
[COLOR=rgb(124, 112, 107)][B]Lefoglalt illegális tárgyak/lőfegyverek/szúró-vágó eszközök, drogterjesztéssel kapcsolatos termékek megnevezése illetve darabszáma:[/B][/COLOR] ${form.confiscatedItems}

[SIZE=4][FONT=book antiqua][B]IV. Esetleírás:[/B][/FONT][/SIZE]

${form.description}

[RIGHT][FONT=arial][COLOR=rgb(124, 112, 107)][B]Aláírás:[/B] [/COLOR]${form.officerName}, ${form.officerRank}[/FONT][/RIGHT]
[/QUOTE]`;
};

/**
 * The calendar date ("2026-10-05") of a report date typed as "2026. 10. 05.", "2026.10.05."
 * or "05/10/2026" (the template asks for day/month/year); null when unreadable.
 */
export function reportDateKey(text: string): string | null {
  const value = text.trim();
  let match = value.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = value.match(/^(\d{1,2})[./-]\s*(\d{1,2})[./-]\s*(\d{4})\.?$/);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
}

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A report's forum link, cleaned; null when it is not a forum.hl-rpg.eu link. */
export function normalizeForumUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "forum.hl-rpg.eu") return null;
    const post = url.pathname.match(/\/posts\/(\d+)/)?.[1] ?? url.hash.match(/post-(\d+)/)?.[1] ?? url.pathname.match(/\/post-(\d+)/)?.[1];
    if (post) return `https://forum.hl-rpg.eu/posts/${post}/`;
    return `https://forum.hl-rpg.eu${url.pathname}`;
  } catch {
    return null;
  }
}
