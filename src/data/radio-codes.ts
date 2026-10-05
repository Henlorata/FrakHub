/**
 * Radio basics for the practice corner of the onboarding page (trainees cannot open the academy
 * yet). Copied from the basic academy's day 1, "5. Rádió fóniák" and "4. Helyes rádiózás" (2026-10);
 * update both together.
 */

export interface RadioTerm {
  code: string;
  meaning: string;
}

/** Unit letters of the call signs (Fonetikus ABC). */
export const UNIT_TYPES: (RadioTerm & {short: string})[] = [
  {code: "LINCOLN", short: "L", meaning: "Alapvető járőrautó egy egyenruhás sheriffel."},
  {code: "ADAM", short: "A", meaning: "Alapvető járőrautó két-három egyenruhás sheriffel."},
  {code: "AIR", short: "AIR", meaning: "Légi jármű (pl. helikopter)."},
  {code: "BRAVO", short: "B", meaning: "Major Crimes Bureau (nyomozó) egység."},
  {code: "HSPU", short: "HS", meaning: "Jelöletlen, gyors reagálású egység."},
  {code: "ROBERT", short: "RO", meaning: "SEB jelölt vagy jelöletlen járőrautós egysége."},
  {code: "RESCUE", short: "RE", meaning: "SEB Bearcat egysége."},
  {code: "PARAMEDIC", short: "PA", meaning: "Medical Unit (MU) egység."},
];

export const BASIC_CODES: RadioTerm[] = [
  {code: "Code 1", meaning: "Az egység válaszol a hívásra."},
  {code: "Code 2", meaning: "Rutinhívás: fényhíd és sziréna nélkül, a közlekedési szabályok betartásával."},
  {code: "Code 2-High", meaning: "Kiemelt hívás: fényhíddal, de sziréna nélkül."},
  {code: "Code 3", meaning: "Sürgős hívás: fényhíddal és szirénával, kivétel a közlekedési szabályok alól."},
  {code: "Code 4", meaning: "Nincs szükség további erősítésre, vissza a járőrszolgálathoz."},
  {code: "Code 4-Adam", meaning: "Nincs szükség további erősítésre, az egységek már úton vannak vagy a közelben."},
  {code: "Code 5", meaning: "Megfigyelés folyik, a jelölt egységek kerüljék a helyszínt."},
  {code: "Code 6", meaning: "Az egység megérkezett, elhagyja a járművet intézkedés céljából."},
  {code: "Code 6-Adam", meaning: "Az egység elhagyja a járművet, erősítésre van szükség."},
  {code: "Code 6-Charles", meaning: "Körözött bűnöző a helyszínen, a közeli egységek legyenek készenlétben."},
  {code: "Code 6-Gang", meaning: "Csoportos bandatevékenységet észleltünk."},
  {code: "Code 7", meaning: "Az egység engedélyt kér szünet tartására."},
  {code: "Code 8", meaning: "Beindult egy tűzjelző, tüzet jelentettek."},
  {code: "Code 8-Adam", meaning: "Aktív tűzeset, a helyszín biztosítása."},
  {code: "Code 10", meaning: "Rádiócsendet kérek a kutatás információinak közléséhez."},
  {code: "Code 12", meaning: "Hamis riasztás, téves hívás."},
  {code: "Code 20", meaning: "Értesítsék a médiát."},
  {code: "Code 30", meaning: "Betörés folyamatban, megszólalt a riasztó: szirénával és fényhíddal."},
  {code: "Code 30-Silent", meaning: "Betörés folyamatban, halk riasztás: sziréna és fényhíd nélkül."},
  {code: "Code 37", meaning: "A járművet lopottnak jelentették."},
  {code: "Code 77", meaning: "Lehetséges, hogy csapdába akarnak csalni."},
  {code: "Code 99", meaning: "Vészhelyzet, minden egység reagáljon a helyszínre."},
  {code: "Code 100", meaning: "Az egységek abban a helyzetben, hogy elfogják a menekülő gyanúsítottat."},
];

export const TEN_CODES: RadioTerm[] = [
  {code: "10-4", meaning: "Nyugtázva, vettem."},
  {code: "10-6", meaning: "Az egység elfoglalt."},
  {code: "10-8", meaning: "Szolgálatba állás."},
  {code: "10-9", meaning: "Ismételje meg az előzőt."},
  {code: "10-10", meaning: "Szolgálat leadása."},
  {code: "10-12", meaning: "Látogatóink érkeztek."},
  {code: "10-14", meaning: "Konvoj, kíséret."},
  {code: "10-15", meaning: "Célszemély előzetes letartóztatásban, úton a fegyházhoz."},
  {code: "10-16", meaning: "Egy egységet kérek a rab átvételéhez."},
  {code: "10-17", meaning: "Egy egységet kérek az iratok átvételéhez."},
  {code: "10-18", meaning: "Fejezze be a feladatát a lehető leghamarabb."},
  {code: "10-19", meaning: "Visszatérés a kapitányságra."},
  {code: "10-20", meaning: "Jelenlegi pozíció."},
  {code: "10-22", meaning: "Hagyják figyelmen kívül az előző üzenetet."},
  {code: "10-28", meaning: "Jármű ellenőrzése, körözés alatt áll-e."},
  {code: "10-29", meaning: "Személy ellenőrzése, körözés alatt áll-e."},
  {code: "10-35", meaning: "Bizalmas információ."},
  {code: "10-97", meaning: "Érkezés a helyszínre."},
  {code: "10-98", meaning: "Egység elérhető, riasztható."},
  {code: "10-99", meaning: "Vészhelyzet."},
];

export const DIVISION_NUMBERS: RadioTerm[] = [
  {code: "6", meaning: "Downtown Station (fő állomás, San Fierro)"},
  {code: "7", meaning: "Hubert Station (SEB, Montgomery)"},
  {code: "8", meaning: "Angel Pine (kialakítás alatt)"},
  {code: "9", meaning: "Fort Carson (kialakítás alatt)"},
];

/** Short rules a trainee meets on the first days (academy day 1, "3. Alapvető információk"). */
export const FIRST_DAY_RULES: {title: string; text: string}[] = [
  {title: "Legalább 7 nap Trainee", text: "Ha a kiképződ alkalmasnak talál, felkeres a vizsgával."},
  {title: "Soha nem egyedül", text: "Trainee-ként nem járőrözhetsz egyedül, és saját járőrautód sincs még."},
  {title: "Havi 30 óra duty", text: "Ez alatt nem jár alapfizetés és rangfelvétel."},
  {title: "Havi 8 jelentés", text: "A fórumra küldött jelentéseidet a Jelentések oldalon naplózod."},
  {title: "TS3 és rádió", text: "Szolgálatban kötelező a TS3; járőrözés közben legalább 5 percenként rádiózz."},
  {title: "Határátlépés", text: "Los Santosba belépéskor rádiózz az LSPD-nek; ott engedélyük nélkül nem intézkedhetsz."},
];
