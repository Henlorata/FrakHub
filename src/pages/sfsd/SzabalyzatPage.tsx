import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

// --- Típusdefiníciók ---

interface Rule {
  id: string;
  text: string;
}

interface RuleCategory {
  id: string;
  title: string;
  rules: Rule[];
}

// --- Szabályzat Adatbázis (Kategorizálva) ---

const rulesData: RuleCategory[] = [
  {
    id: "cat_altalanos",
    title: "Általános Magatartás és Belépés",
    rules: [
      { id: "r_01", text: "Amerikai név kötelező, karaktertörténettel természetesen lehet más is." },
      { id: "r_02", text: "Rangokat kéregetni tilos." },
      { id: "r_03", text: "Hogyha kilépsz úgy a frakcióból, hogy nem lettek kifizetve az élményképeid/jelentéseid, akkor azokért nem vállaljuk a felelőséget!" },
    ],
  },
  {
    id: "cat_hierarchia",
    title: "Hierarchia és Szolgálati Rend",
    rules: [
      { id: "r_04", text: "Bármi van, követned kell a nálad nagyobb rangú kéréseit/parancsait." },
      { id: "r_05", text: "Szolgálaton kívül tilos illegális tevékenységet végezni!" },
      { id: "r_06", text: "Tilos bármilyen tudatmódosító szer használata SZOLGÁLAT közben." },
      { id: "r_07", text: "Ha akció / frakció szerepjáték-szituáció van, köteles vagy azon megjelenni ha nem vagy szerepjáték-szituációban. (Kerekedés, kaszinózás, egyéb, nem létfontosságú szituációk nem számítanak bele.)" },
      { id: "r_08", text: "Ha nem vagy dutyban, ne avatkozz bele a rendőri ügyekbe." },
      { id: "r_09", text: "Meetingeken és kiképzéseken kötelező megjelenni, ha nem tudsz sehogyan sem megjelenni mindig a discord szerveren kell jelezned ezt!" },
    ],
  },
  {
    id: "cat_rang",
    title: "Rang-specifikus Szabályok",
    rules: [
      { id: "r_10", text: "A Deputy Sheriff Trainee-k nem mehetnek egyedül járőrözni. Mindig csatlakozni kell egy nagyobb rangú személyhez." },
      { id: "r_11", text: "A Deputy Sheriff I-ek bankrablásnál a kordonoknál kell állniuk és védeni azt. A széfterembe NEM hatolhatnak be a Deputy Sheriff Trainee-k!" },
      { id: "r_12", text: "Deputy Sheriff Trainee nem vihet el csak úgy autót, egyedül nem járőrözhet! 2 db Deputy Sheriff Trainee sem járőrzhet, mindig kell egy olyan ember akinek van autója! Ha nincs fent olyan ember akinek van autója, akkor a tananyagot olvasgassátok. Deputy Sheriff Trainee nem vezethet járőrautót, csak leader-i engedéllyel!" },
    ],
  },
  {
    id: "cat_alosztaly",
    title: "Alosztály-specifikus Szabályok (SEB, METRO, H.S.P.U., Investigator)",
    rules: [
      { id: "r_13", text: "Csak a SEB és a PD-n belül lévő METRO alosztályban lévők mennek ki a CCTV-kre. Ha erősítést kérnek akkor mehet több rendes egység!" },
      { id: "r_14", text: "Detektív Duty is hivatalos szolgálatnak minősül, nem veheted fel csak azért hogy legyen önvédelmi fegyvered. (Azonnali hibapont.)" },
      { id: "r_15", text: "PIT manővert H.S.P.U. egységeknek TILOS alkalmazni." },
      { id: "r_16", text: "Nagyobb lövöldözésnél, vagy akciónál mindig a SEB menjen előre." },
      { id: "r_17", text: "Ha a SEB duty-t használod akkor az M4-et vagy a Snipert dobd ki! Mindig csak az egyik maradjon nálad." },
      { id: "r_18", text: "FEGYVER/DROG ÜZLET BUKTATÁSBA CSAK INVESTIGATOR,LEADER KEZDHET BELE! Sima sheriffeknek TILOS buktatni!" },
      { id: "r_19", text: "A /hp parancs-ot csak a SEB MEDIC-ek használhatják (szanitéc részleg). Ha nem szanitécként használod a parancsot NONRP-vel szankcionálható, illetve kirúgással jár." },
      { id: "r_20", text: "Amennyiben van elérhető Investigator (aki ráér) akkor csak ők hallgathatják ki a suspecteket, köteles vagy átadni nekik a suspecteket! FIELD STAFF csak is abban az esetben hallgathat ki személyt, ha nincs elérhető Investigator." },
    ],
  },
  {
    id: "cat_eljaras",
    title: "Eljárási Szabályok (Üldözés, Fegyver, Rádió, RP)",
    rules: [
      { id: "r_21", text: "Mindig a Penal Code [BTK] szabályai alapján kell eljárni." },
      { id: "r_22", text: "Illegális Frakciók HQ-jára CCTV végett TILOS kimenni!" },
      { id: "r_23", text: "Lenyomozást csak nagyon indokolt esetben lehet használni. 10 sor elő RP kötelező hozzá." },
      { id: "r_24", text: "Az üldözési sort mindig tartani kell." },
      { id: "r_25", text: "Tűzparancsot csak a rangidős adhat ki!" },
      { id: "r_26", text: "Magánakciózni bárkinek szigorúan TILOS!" },
      { id: "r_27", text: "Rádiózni járőrözés közben kötelező 5 percenként!" },
      { id: "r_28", text: "Tilos az OOC rádiózás!" },
      { id: "r_29", text: "Bankrablásnál ameddig nincs lent a kordon, addig TILOS lőni a civilekre, csak azokra lehet lőni akik a széfteremben vannak, vagy azokra akik kint lövöldöznek." },
      { id: "r_30", text: "Fegyveres személytől kizárólag /elvesz [id] [fegyver] parancsot szabad használni. Csomagtartóból/széfből lefoglalt fegyvert le kell adni!" },
      { id: "r_31", text: "Személyes társalgásban (say-ben, azaz nem rádióban) rádiófóniákat használni TILOS." },
    ],
  },
  {
    id: "cat_jarmu",
    title: "Járműhasználat és PIT Manőver",
    rules: [
      { id: "r_32", text: "Csak a saját kocsidat viheted el, másét nem." },
      { id: "r_33", text: "A helikoptert csak a megfelelő vizsga letételével viheted el." },
      { id: "r_34", text: "Hajót csak akkor vihetsz el, ha az üldözött személy vízben menekül." },
      { id: "r_35", text: "Ha végeztél a szolgálattal, akkor a kocsit mindig megszerelve vidd vissza!" },
      { id: "r_36", text: "Pitelni csak az adott kocsi hátsó részét lehet." },
      { id: "r_37", text: "PIT manővert 150 km/h felett TILOS véghezvinni. Forgalmas belvárosokban, csak 80 km/h alatt lehet PIT manővert alkalmazni." },
    ],
  },
  {
    id: "cat_rp_chat",
    title: "Szerepjáték (RP) és Chat Szabályok",
    rules: [
      { id: "r_38", text: "Tilos idétlen kiegészítőket viselni szolgálat közben." },
      { id: "r_39", text: "Minden mondat végére tegyél írásjelet!" },
      { id: "r_40", text: "Tilos a -majd -és szavak használata." },
      { id: "r_41", text: "A /do-kat nagybetűvel kell kezdeni, a /me-ket pedig kicsivel!" },
      { id: "r_42", text: "Erőt, egészséget és hasonló ORFK-s szavakat tilos használni, amerikába vagyunk!" },
      { id: "r_43", text: "Tilos futni ./visz-ben!" },
      { id: "r_44", text: "Ha szolgálatba vagy az SFSD TS3 szobákat köteles vagy használni! (Kivétel: Moderátorok,Adminok.)" },
    ],
  },
  {
    id: "cat_ooc",
    title: "OOC és Kis-karakter Szabályok",
    rules: [
      { id: "r_45", text: "Frakció csoportokból információ kiadása TILOS!" },
      { id: "r_46", text: "Ha az SD-ben bent vagy akkor más frakcióban TILOS lenni kis karakterről!" },
      { id: "r_47", text: "Tilos kis karakterrel olyan szituációban részt venni ami nagy eséllyel a rendvédelem lelövésével járna, ezen felül ATM-et és bank-ot rabolni is TILOS." },
      { id: "r_48", text: "Tilos kis karakterrel illegális non-script frakcióba kezdeni, kivétel: fő-leader engedélyével." },
    ],
  },
];

// --- A Komponens ---

export function SzabalyzatPage() {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Memoizált szűrés a keresőhöz
  const filteredCategories = React.useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();

    if (!lowerSearch) {
      return rulesData;
    }

    const filtered = rulesData
      .map(category => {
        // Ha a kategória címe tartalmazza a keresőszót, az összes szabályát megtartjuk
        if (category.title.toLowerCase().includes(lowerSearch)) {
          return category;
        }

        // Különben szűrjük a szabályokat a kategórián belül
        const matchingRules = category.rules.filter(rule =>
          rule.text.toLowerCase().includes(lowerSearch)
        );

        // Csak akkor adjuk vissza a kategóriát, ha volt benne találat
        if (matchingRules.length > 0) {
          return { ...category, rules: matchingRules };
        }

        return null;
      })
      .filter((category): category is RuleCategory => category !== null); // Kiszűrjük a null-ra vizsgált kategóriákat

    return filtered;
  }, [searchTerm]);

  // Alapértelmezetten az összes kategória ID-ja, hogy nyitva legyenek
  const defaultOpenCategories = React.useMemo(() => rulesData.map(c => c.id), []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">SFSD Frakció Szabályzat</h1>
        <p className="text-slate-400">
          A frakció működését és tagjainak viselkedését meghatározó szabályok.
          Használd a keresőt a gyors szűréshez.
        </p>
      </div>

      {/* Keresőmező */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          placeholder="Szabályok keresése..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Szabályok Accordion */}
      {filteredCategories.length > 0 ? (
        <Accordion
          type="multiple"
          // Ha keresünk, nyissunk ki minden találati kategóriát, egyébként az összeset
          defaultValue={searchTerm ? filteredCategories.map(c => c.id) : defaultOpenCategories}
          className="w-full space-y-4"
        >
          {filteredCategories.map(category => (
            <AccordionItem
              value={category.id}
              key={category.id}
              className="border-b-0 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden"
            >
              <AccordionTrigger className="text-xl font-semibold text-white px-4 hover:no-underline bg-slate-800/50 data-[state=open]:border-b border-slate-700">
                {category.title}
              </AccordionTrigger>
              <AccordionContent className="pt-0">
                <div className="p-4 space-y-3">
                  {category.rules.map(rule => (
                    <Card key={rule.id} className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-4 text-slate-200 text-base leading-relaxed">
                        {rule.text}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        // Ha nincs találat
        <div className="text-center text-slate-400 py-12">
          <Search className="mx-auto h-12 w-12" />
          <h3 className="mt-2 text-lg font-medium">Nincs találat</h3>
          <p className="mt-1 text-sm">
            Nem található a keresésnek megfelelő szabály.
          </p>
        </div>
      )}
    </div>
  );
}