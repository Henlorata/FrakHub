/**
 * What changed for the members, newest release first. Shown on /changelog and, until dismissed, as
 * a strip on the dashboard. Add a release (new `id`) when a deploy brings something members should
 * know about; keep each item to one or two sentences.
 */

export interface ChangelogItem {
  area: string;
  title: string;
  text: string;
  /** Where to try it. */
  link?: string;
}

export interface Release {
  /** Stable id: the dashboard strip shows until the member has seen the latest one. */
  id: string;
  title: string;
  /** "2026-10": the month of the release. */
  month: string;
  summary: string;
  items: ChangelogItem[];
}

export const RELEASES: Release[] = [
  {
    id: "2026-10-new-frakhub",
    title: "Az új FrakHub",
    month: "2026-10",
    summary: "Újraépített oldal: események, havi fizetés, flotta, nyomozati teendők, előléptetési tábla, szabályzatok, szavazások, gyakorlás oklevelekkel és gyakorló mód.",
    items: [
      {area: "Irányítópult", title: "A hónapod egy pillantásra",
        text: "Jelentések és duty idő a havi követelményhez mérve, a következő események és a kalkulátor eseménynaplója.", link: "/dashboard"},
      {area: "Események", title: "Naptár jelentkezéssel",
        text: "Gyűlések, képzések, vizsgák és közös akciók; jelezd, ott leszel-e. A szervezők rögzítik a jelenlétet, a naptár mutatja, ki van szabadságon.",
        link: "/events"},
      {area: "Személyügy", title: "Szervezeti ábra és vezetők",
        text: "Az állomány fán is: Bureau Manager, Bureau Commanderek, alegységek vezetői. A vezetők a listában is jelölve vannak.", link: "/hr?view=org"},
      {area: "Személyügy", title: "Duty idő képernyőképekről",
        text: "A UCP „Frakció tagok” képeiből a szolgálati idők kitöltődnek; a bizonytalan értékeket a rendszer megjelöli. A képek nem kerülnek fel sehova.",
        link: "/hr?tab=duty"},
      {area: "Jelentések", title: "Kitöltés képről",
        text: "A tablet „Polgárok” oldaláról a név és az okmányszámok egy kattintással a jelentésbe kerülnek; a kép csak a gépeden marad.", link: "/reports"},
      {area: "Logisztika", title: "Járműpark kulcsokkal",
        text: "Minden jármű, a kulcsosai, a forgalmi lejárata, hibapontok és tuning; a vezetőség a kategóriákat és a kihasználtságot is kezeli.",
        link: "/logistics?tab=fleet"},
      {area: "Pénzügy", title: "Havi fizetés és fizetési papír",
        text: "A fizetés a duty időből, a jelentésekből és a képesítésekből számolódik; a lezárt hónapot mindenki látja a saját fizetési papírján.",
        link: "/finance?tab=payroll"},
      {area: "Pénzügy", title: "Kassza-előrejelzés",
        text: "A Command Staff látja, mennyi marad a kifizetések után, és merre tart a kassza az elmúlt hónapok üteme alapján.", link: "/finance?tab=overview"},
      {area: "Nyomozó Iroda", title: "Közös aktaszerkesztés és sablonok",
        text: "Élő közös dokumentum bizonyítékokkal és említésekkel, parancskérelmek, nyilvántartás; az aktasablonokat az MCB vezetése szerkeszti.",
        link: "/mcb"},
      {area: "Vizsgák", title: "Időzített vizsgák a szerveren",
        text: "A vizsga a szerveren fut: automatikus mentés, határidő, azonnali pontozás a választós kérdéseknél.", link: "/exams"},
      {area: "Eszközök", title: "Kódtár",
        text: "Rádiókódok kereséssel és másolással, hívójel-összeállító és gyakorló kvíz.", link: "/codes"},
      {area: "Képzések", title: "Gyakorló mód",
        text: "Rövid, kattintós bemutatók minden szerepkörnek, kitalált adatokkal: semmi sem mentődik. A profilodon bármikor újrajátszhatod.",
        link: "/profile?tab=trainings"},
      {area: "Kereső", title: "Ctrl+K mindenhonnan",
        text: "Oldalak, műveletek, tagok és akták egy gyorskeresőben.", link: "/dashboard"},
      {area: "Gyakorlás", title: "Kártyák és szituációk",
        text: "Rádiókódok és a Btk. napi pár percben: amit tudsz, ritkábban jön elő. Szituációs gyakorlatok visszajelzéssel minden döntésre.", link: "/practice"},
      {area: "Oklevelek", title: "Ellenőrizhető oklevelek",
        text: "Sikeres vizsga, új képesítés, kinevezés és teljesített gyakorlat után oklevél jár, amelyet a kódjával bárki ellenőrizhet.",
        link: "/profile?tab=certificates"},
      {area: "Szabályzatok", title: "Kötelező olvasmányok",
        text: "A frakció szabályai változatokkal; a kötelezőknél jelzed, hogy elolvastad, és látod, mi változott a legutóbbi óta.", link: "/policies"},
      {area: "Közösség", title: "Szavazás, ötletláda, névtelen visszajelzés",
        text: "Szavazások (névtelenül is), ötletek szavazatokkal és a vezetőség válaszával, és névtelen üzenet a vezetőségnek.", link: "/community"},
      {area: "Ranglista", title: "Ranglista és havi összefoglaló",
        text: "Önkéntes havi ranglista duty időből, jelentésekből, eseményekből és gyakorlásból; a hónap elején összefoglalót kapsz a hónapodról.",
        link: "/leaderboard"},
      {area: "Személyügy", title: "Előléptetés, Trainee hét, aktivitás",
        text: "Ki teljesíti a következő rang feltételeit, javaslatok és döntések; mentor a Trainee első hetére; a rögzített duty időt figyelő, tapintatos jelzés.",
        link: "/hr?tab=promotions"},
      {area: "Személyügy", title: "Nyomtatható szolgálati lap",
        text: "Rangok, beosztások, kitüntetések, figyelmeztetések, duty idő és oklevelek egy lapon.", link: "/profile"},
      {area: "Nyomozó Iroda", title: "Teendők, lefoglalt tárgyak, érvényes parancsok",
        text: "Teendők felelőssel és határidővel, a lefoglalt tárgyak őrzési lánca, lejáró és megújítható parancsok, kapcsolódó akták és informátorok.",
        link: "/mcb"},
      {area: "Kalkulátor", title: "Btk. változásnapló",
        text: "Ha változik a büntető törvénykönyv, a kalkulátor megmutatja, mely tételek új vagy módosult elemek.", link: "/calculator"},
      {area: "Pénzügy", title: "Fizetési papír grafikonnal",
        text: "A havi fizetéseid alakulása, és hogy mennyi duty idő kellett volna a következő sávhoz; a vezetőség előre látja egy táblamódosítás hatását.",
        link: "/finance?tab=payroll"},
      {area: "Súgó", title: "Ki mit tehet?",
        text: "Egy táblázat arról, melyik rang és beosztás mit intézhet az oldalon.", link: "/permissions"},
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];

/** localStorage: the id of the latest release the member has looked at or dismissed. */
export const CHANGELOG_SEEN_KEY = "frakhub.changelog.seen";
