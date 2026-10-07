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
    id: "2026-10-navigation",
    title: "Rendezettebb menü, saját gyorsgombok",
    month: "2026-10",
    summary: "Becsukható menücsoportok, testreszabható gyors elérés, a szabadság a személyügyi adatlapon, és az oldal magától frissül az új verzióra.",
    items: [
      {area: "Menü", title: "Becsukható csoportok",
        text: "Az oldalsó menü csoportjai (Áttekintés, Operatív, …) a nevükre kattintva becsukhatók, és a böngésző megjegyzi. A becsukott csoportban is látszik az oldal, ahol éppen vagy."},
      {area: "Irányítópult", title: "Saját gyors elérés",
        text: "A Gyors elérés Testreszabás gombjával kiválaszthatod és sorba rendezheted a gombokat: oldalakat és gyorsműveleteket (új BOLO, új levél, szabadság igénylése…).",
        link: "/dashboard"},
      {area: "Személyügy", title: "Szabadság az adatlapon",
        text: "A jóváhagyott szabadság napjaiban a tag mindenhol Szabadságon látszik, utána magától visszatér a korábbi aktivitása.",
        link: "/hr"},
      {area: "Jelentések", title: "Friss űrlap",
        text: "A jelentésíró mindig a mai dátummal indul. A félbehagyott jelentést 10 percig őrzi meg, utána üres űrlap fogad."},
      {area: "Általános", title: "Frissítés magától",
        text: "Ha közben új verzió jelent meg, a következő oldalváltáskor az oldal magától betölti; nem kell kézzel frissíteni."},
    ],
  },
  {
    id: "2026-10-operations-reviews",
    title: "Műveleti terv, értékelések, helyszínrajz",
    month: "2026-10",
    summary: "Csapatbeosztás és értékelés az akciókhoz, negyedéves teljesítményértékelés, helyszínrajz és jelölés a bizonyítékokon, akták lomtára, okosabb levelezés.",
    items: [
      {area: "Események", title: "Műveleti terv",
        text: "A szervező célt, gyülekezőt, rádiócsatornát és csapatokat ad az eseményhez, járművel és hívójellel. A kártyán látod a szerepedet, az akció után pedig az értékelést.",
        link: "/events"},
      {area: "Személyügy", title: "Teljesítményértékelés",
        text: "A Supervisory Staff és felette negyedévente értékelheti a nála alacsonyabb rangúakat hat szempont szerint. A sajátodat a profilodon olvasod, és visszaigazolod.",
        link: "/profile?tab=reviews"},
      {area: "Nyomozó Iroda", title: "Helyszínrajz az aktában",
        text: "A dokumentumban a „/” menü Helyszínrajz pontjával autókat, személyeket, utakat, épületeket, nyilakat és bizonyítékjelölőket rajzolhatsz; a nyomtatott aktán is megjelenik."},
      {area: "Nyomozó Iroda", title: "Jelölés a képeken",
        text: "Feltöltés előtt nyilat, keretet, feliratot és számozást tehetsz a képre, a személyes adatot pedig kitakarhatod. Feltöltött képről jelölt másolat is készíthető."},
      {area: "Nyomozó Iroda", title: "Akták lomtára",
        text: "A törölt akta 30 napig a lomtárban marad, onnan visszaállítható; utána a fájljaival együtt végleg törlődik.", link: "/mcb/trash"},
      {area: "Levelezés", title: "Keresés, olvasottság, sablonok",
        text: "Keress a leveleid között, nézd meg, kik olvasták a leveledet, és írj sablonból: a címzett neve és rangja magától kitöltődik.", link: "/mail"},
      {area: "Általános", title: "Új jelvény",
        text: "Megújult a department csillaga: fémes, hétágú sheriffcsillag kék zománcközéppel, a nagy méretekben a San Fierro Sheriff felirattal."},
    ],
  },
  {
    id: "2026-10-documents-graph",
    title: "Aláírt iratok, kapcsolati háló, nyilvános bejelentések",
    month: "2026-10",
    summary: "Nyomtatható fizetési papír és kitüntetési okirat aláírással, az MCB kapcsolati hálója, és panasz vagy bejelentés a nyilvános oldalról, e-mail nélkül.",
    items: [
      {area: "Pénzügy", title: "Fizetési papír",
        text: "Egy lezárt hónap fizetését aláírt, nyomtatható papíron is megkapod: a hónapot lezáró vezető és a te aláírásod kerül rá.",
        link: "/finance?tab=payroll"},
      {area: "Személyügy", title: "Kitüntetési okirat",
        text: "A szalagjaidhoz és a dicséreteidhez nyomtatható okirat tartozik, az adományozó és a department vezetőjének aláírásával.",
        link: "/profile?tab=awards"},
      {area: "Nyomozó Iroda", title: "Kapcsolati háló",
        text: "Személyek, bűnszervezetek, akták, rendszámok és címek egy hálón. Egy közös autó vagy lakcím is összeköti az embereket.",
        link: "/mcb/graph"},
      {area: "Főoldal", title: "Panasz, bejelentés, kérdés",
        text: "A látogatók a nyilvános oldalon írhatnak az IAB-nak, az MCB-nek vagy a vezetőségnek. E-mail nem kell: a választ egy követőkóddal olvassák, nálunk a belső postában jelenik meg.",
        link: "/contact"},
      {area: "Biztonság", title: "Kijelentkezés a többi eszközön",
        text: "A profilod Fiók lapján egy gombbal kiléptetheted magad minden más böngészőből és eszközről.", link: "/profile?tab=settings"},
      {area: "Személyügy", title: "Elrejthető vezetőség",
        text: "A személyügyi oldal Vezetőség panelje összecsukható, és a böngésző megjegyzi.", link: "/hr"},
    ],
  },
  {
    id: "2026-10-public-site-mail",
    title: "Nyilvános főoldal, levelezés, aláírás",
    month: "2026-10",
    summary: "Új bemutatkozó oldal hírekkel, belső posta a régi public-mails helyett, az Internal Affairs Bureau vizsgálatai és saját aláírás minden nyomtatható iraton.",
    items: [
      {area: "Főoldal", title: "A department nyilvános oldala",
        text: "Osztályok, egységek, vezetőség, toborzás és gyakori kérdések a látogatóknak és a jelentkezőknek. Belépve ugyanúgy az irányítópultra érkezel.",
        link: "/home"},
      {area: "Hírek", title: "Hírek a Sheriff's Information Bureautól",
        text: "A SIB, a Command és az Executive Staff hírt, sajtóközleményt és képeket tesz közzé; a fontosakról értesítést kapsz.", link: "/news"},
      {area: "Levelezés", title: "Belső posta",
        text: "Írj tagoknak vagy csoportcímeknek (all@sfsd.org, internal.affairs.bureau@sfsd.org, command.staff@sfsd.org): a címzettek mind olvassák és válaszolhatnak.",
        link: "/mail"},
      {area: "Internal Affairs", title: "Bejelentés az IAB-nak",
        text: "Panaszt vagy kérelmet levélben teszel az IAB címére. Az ügyet a bureau vizsgálja ki, a végén aláírt, nyomtatható irattal zárja.",
        link: "/mail?new=1"},
      {area: "Profil", title: "Saját aláírás",
        text: "Rajzold meg, töltsd fel papírról, válassz egy stílust a nevedből vagy kérj egy automatikusat. A szolgálati lapon, az aktákon, a parancsokon, a leveleken és az okleveleken a neved fölé kerül.",
        link: "/profile?tab=settings&signature=1"},
      {area: "Általános", title: "Új név: SFSD Intranet",
        text: "Az oldal neve mostantól San Fierro Sheriff's Department Intranet, röviden SFSD Intranet."},
    ],
  },
  {
    id: "2026-10-patrol-security",
    title: "Járőrszolgálat, statisztika, kétlépcsős belépés",
    month: "2026-10",
    summary: "BOLO-k és eligazítás, rendszámkereső, osztályonként szerkeszthető rangok és címek, bűnszervezetek, statisztika és kétlépcsős azonosítás.",
    items: [
      {area: "Járőrszolgálat", title: "BOLO és eligazítás",
        text: "Körözött járművek és személyek képpel, utolsó helyszínnel és lejárattal. Az eligazítás egy lapon mutatja a műszakhoz kellő mindent: aktív BOLO-k, körözöttek, mai események.",
        link: "/briefing"},
      {area: "Járőrszolgálat", title: "Rendszámkereső",
        text: "Írj be egy rendszámot a gyorskeresőbe (Ctrl+K): BOLO, flotta és a nyilvántartott járművek egyszerre. A szóköz, a kötőjel és az összetéveszthető karakterek (0 és O, 8 és B) nem számítanak.", link: "/briefing"},
      {area: "Statisztika", title: "Az osztály számokban",
        text: "Bírságok, letartóztatások és a leggyakoribb szabálysértések hetekre bontva, és hogy a hét mely napján, hány órakor a legforgalmasabb a szolgálat.",
        link: "/stats"},
      {area: "Személyügy", title: "Osztályrangok és címek",
        text: "A Bureau Commanderek maguk alakítják az osztályuk rangjait. A SEB-ben a Medic és a Marksman cím külön jelölést kap a rang mellett.",
        link: "/hr?tab=bureaus"},
      {area: "Nyomozó Iroda", title: "Bűnszervezetek",
        text: "Bandák és kartellek tagokkal, területtel és hírszerzési naplóval; az akták, parancsok és járművek a tagokból jönnek.", link: "/mcb/organizations"},
      {area: "Nyomozó Iroda", title: "Fejléces aktasablonok",
        text: "Az MCB két új alapsablonja logós fejléccel; az ügyszám, a létrehozó és a dátum magától kitöltődik.", link: "/mcb"},
      {area: "Biztonság", title: "Kétlépcsős azonosítás",
        text: "Kapcsold be a profilod Fiók lapján: a jelszó mellé a telefonod hitelesítő alkalmazásának kódja is kell. Vezetőknek erősen ajánlott.",
        link: "/profile?tab=settings"},
      {area: "Jelentések", title: "Javított névfelismerés",
        text: "A tablet képéről a többrészes nevek (például egy kezdőbetűvel) is hiánytalanul átjönnek.", link: "/reports"},
    ],
  },
  {
    id: "2026-10-new-frakhub",
    title: "Az új SFSD Intranet",
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
