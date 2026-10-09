-- =============================================================================
-- More practice scenarios (the members asked for many after the two samples): 39 branching
-- scenarios written from the faction's rules (policy library "Frakció szabályzat"), the basic
-- academy (days 1-4: duty, radio codes and formats, traffic stops, pursuits, arrests, felony stops,
-- entries, the use of force), the division manuals (MCB, Crisis Team, Operation Safe Streets, Aero
-- Bureau, Medical Unit, Financial Administration Bureau, Sheriff's Information Bureau) and the
-- penal code's items and notes.
--
-- They come in hidden (published = false), as the samples did: the instructors read them and
-- publish them one by one (publishing a scenario certifies those who already passed it). Each is
-- checked with private.scenario_problem() here, and max_score is computed like save_scenario() does.
-- Data only; compatible with the deployed frontend.
-- =============================================================================

insert into public.practice_scenarios (title, summary, category, difficulty, start_node, nodes, pass_percent, sort_order)
select v.title, v.summary, v.category, v.difficulty, v.start_node, v.nodes, v.pass_percent, v.sort_order
from (values
('Igazoltatás ADAM egységben', 'Egy közúti igazoltatás a tananyag sorrendjében: indok, a sofőr rádiózik, az anyósülésen ülő intézkedik, iratok, kötelező felszerelés, bírság.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "ADAM egységben (6A029) járőröztök Downtownban; a társad, Deputy Reyes vezet, te az anyósülésen ülsz. Előttetek egy kék BMW X5 halad, a bal hátsó lámpája nem világít. Mit tesztek?",
  "choices": [
   {
    "id": "a",
    "text": "Megcélozzuk a járművet, szirénát kapcsolunk, felszólítjuk a félreállásra, és mögé húzódunk.",
    "next": "radio_stop",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag sorrendje: megcélzás, sziréna, felszólítás, félrehúzódás a jármű mögé. A működésképtelen izzó valós indok."
   },
   {
    "id": "b",
    "text": "Nem állítjuk meg: egy hibás lámpa miatt nem érdemes.",
    "next": "missed",
    "points": 0,
    "verdict": "bad",
    "feedback": "Igazoltatást csak indokoltan lehet kezdeményezni, és itt van indok: a törött vagy hibás jármű az egyik. A működésképtelen izzó balesetveszélyes."
   },
   {
    "id": "c",
    "text": "Elévágunk, és a járőrautóval szorítjuk le az útról.",
    "next": "radio_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Veszélyes manőver. Igazoltatáshoz elég a jelzés és a felszólítás; a civilek és a saját biztonságotok az első."
   }
  ]
 },
 "radio_stop": {
  "text": "A BMW lehúzódik a járda mellé, mögé álltok. Ki rádiózza az igazoltatást, és mit mond be?",
  "choices": [
   {
    "id": "a",
    "text": "A társam, a sofőr: „6A029 10-20 Downtown. Igazoltatás: kék színű BMW X5, rsz.: 8KLM421, két fő. Az egység 10-6.”",
    "next": "exit",
    "points": 2,
    "verdict": "good",
    "feedback": "Az igazoltatás rádiózását a sofőr hajtja végre. A jármű leírásának sorrendje: szín, márka, típus, rendszám, a bent ülők száma."
   },
   {
    "id": "b",
    "text": "Senki, a végén úgyis bemondjuk, mi történt.",
    "next": "exit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rádiózás biztosíték: ha kilőnek egy igazoltatás közben, a nyomozók csak a bemondott, IC lenyomattal rendelkező adatokból tudnak dolgozni."
   },
   {
    "id": "c",
    "text": "Én az anyósülésről: „Megállítottunk egy autót, megyünk.”",
    "next": "exit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Igazoltatásnál a sofőr rádiózik, és a pozíció, a jármű pontos leírása és a 10-6 is hozzátartozik."
   },
   {
    "id": "d",
    "text": "A társam: „6A029 igazoltat egy BMW-t Downtownban, 10-6.”",
    "next": "exit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó irány, de hiányos: a szín, a típus, a rendszám és a bent ülők száma is kell, ebben a sorrendben."
   }
  ]
 },
 "exit": {
  "text": "Bemondtátok. Ki száll ki, és hogyan közelít a BMW-hez?",
  "choices": [
   {
    "id": "a",
    "text": "Mindketten kiszállunk, és két oldalról az ablakokhoz sietünk.",
    "next": "greet",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kapkodás, és nem a tananyag szerinti szereposztás: a sofőr marad a rádiónál, az anyósülésen ülő intézkedik."
   },
   {
    "id": "b",
    "text": "A társam száll ki, én maradok a rádiónál.",
    "next": "greet",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: ADAM egységben az anyósülésen ülő száll ki intézkedni, a sofőr rádiózik."
   },
   {
    "id": "c",
    "text": "Én szállok ki az anyósülésről: RP-ben megérintem a jármű hátulját, majd megállok a sofőr ajtaja előtt.",
    "next": "greet",
    "points": 2,
    "verdict": "good",
    "feedback": "ADAM egységben a sofőr rádiózik, az anyósülésen ülő száll ki. A jármű hátuljának megérintése RP-ben a DNS rögzítése."
   }
  ]
 },
 "greet": {
  "text": "Ott állsz a sofőr ajtajánál. Hogyan kezded a beszélgetést?",
  "choices": [
   {
    "id": "a",
    "text": "„Szép napot! Deputy Morgan vagyok a Sheriff’s Departmenttől, jelvényszámom 1342. Azért állítottuk félre, mert nem világít a bal hátsó lámpája. Kérem a személyi igazolványát, a jogosítványát és a forgalmi engedélyt.”",
    "next": "query",
    "points": 2,
    "verdict": "good",
    "feedback": "Napszaknak megfelelő köszönés, név, szervezet, jelvényszám, az indok, végül az iratok: ez a tananyag mintája."
   },
   {
    "id": "b",
    "text": "„Erőt, egészséget! Iratokat!”",
    "next": "query",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az „Erőt, egészséget” ORFK-s kifejezés, a szabályzat tiltja: Amerikában vagyunk. A rideg „Iratokat!” sem méltó egy deputyhoz."
   },
   {
    "id": "c",
    "text": "„Jó napot, kérem az iratait.”",
    "next": "query",
    "points": 1,
    "verdict": "ok",
    "feedback": "Köszöntél, de hiányzik a bemutatkozás, a jelvényszám és az, hogy miért állítottátok félre."
   }
  ]
 },
 "query": {
  "text": "A sofőr, Tyler Brooks átadja az iratokat. Mi következik?",
  "choices": [
   {
    "id": "a",
    "text": "Odaviszem az iratokat a társamnak, beszéljük meg a kocsiban, a rádió felesleges.",
    "next": "equipment",
    "points": 0,
    "verdict": "bad",
    "feedback": "ADAM egységben a kint álló deputy rádión adja le a rendszámot és a nevet; ne hagyd magára az igazoltatott járművet."
   },
   {
    "id": "b",
    "text": "„Deputy Morgan to Deputy Reyes. 10-29 8KLM421, 10-28 Tyler Brooks.”",
    "next": "equipment",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: a 10-28 a járművet, a 10-29 a személyt ellenőrzi."
   },
   {
    "id": "c",
    "text": "Rádión kérem a társamat: „Deputy Morgan to Deputy Reyes. 10-28 8KLM421, 10-29 Tyler Brooks.”",
    "next": "equipment",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-28 a jármű, a 10-29 a személy ellenőrzése; a keresés formátuma: [rang] [vezetéknév] to [rang] [vezetéknév]."
   }
  ]
 },
 "equipment": {
  "text": "A 10-28 és a 10-29 tiszta. Mit ellenőrzöl még?",
  "choices": [
   {
    "id": "a",
    "text": "Megkérem a sofőrt, hogy vegye elő és mutassa fel a kötelező felszerelést: az elakadásjelző háromszöget és az egészségügyi csomagot.",
    "next": "kit",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha az adatokkal minden rendben, jöhet a kötelező felszerelés. Ezt a célszemély veszi elő és mutatja fel."
   },
   {
    "id": "b",
    "text": "Kinyitom a csomagtartót, és megnézem magam.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos a csomagtartóba belenézni: a célszemélynek kell kivennie és felmutatnia az eszközöket."
   },
   {
    "id": "c",
    "text": "Semmit, a papírok rendben vannak.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tananyag szerint rendben lévő adatok után a kötelező felszerelés következik."
   }
  ]
 },
 "kit": {
  "text": "A sofőr a csomagtartóból előveszi és megmutatja a háromszöget és az egészségügyi csomagot. Hogyan zárod az igazoltatást?",
  "choices": [
   {
    "id": "a",
    "text": "A felszerelésért is megbüntetem, mert nem azonnal mutatta.",
    "next": "radio_end",
    "points": 0,
    "verdict": "bad",
    "feedback": "A felszerelés megvan, fel is mutatta: nincs mit büntetni. Mindig csak a valós szabálysértésért."
   },
   {
    "id": "b",
    "text": "Szó nélkül átadom a csekket, és visszaülök.",
    "next": "radio_end",
    "points": 1,
    "verdict": "ok",
    "feedback": "A bírság jogos, de a büntetés pontjait fel kell sorolni, és el is kell köszönni."
   },
   {
    "id": "c",
    "text": "Felsorolom a büntetés pontjait (működésképtelen izzó), a Kalkulátor szerinti kereten belül kiszabom a bírságot, átadom a csekket az iratokkal, és elköszönök.",
    "next": "radio_end",
    "points": 3,
    "verdict": "good",
    "feedback": "A deputy köteles felsorolni a büntetés pontjait, majd a csekket az iratokkal együtt adja át. A felszerelés megvan, azért nem jár bírság."
   }
  ]
 },
 "radio_end": {
  "text": "Visszaültél a járőrautóba. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Továbbmegyünk, a rádió most úgyis zsúfolt.",
    "next": "done_quiet",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amíg nem rádiózzátok le a végét, a többiek elfoglaltnak (10-6) hisznek titeket."
   },
   {
    "id": "b",
    "text": "Lerádiózzuk az igazoltatás végét, és jelentjük, hogy folytatjuk a járőrszolgálatot: „6A029 10-20 Downtown, járőrszolgálat teljesítése, az egység 10-98.”",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az egység lerádiózza az igazoltatás végét és a járőrszolgálat folytatását; így a többiek tudják, hogy újra riaszthatók vagytok."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szabályos igazoltatás",
   "text": "Indok, rádió, szereposztás, udvarias bemutatkozás, ellenőrzés, felszerelés, bírság és a vége is be van mondva."
  }
 },
 "done_quiet": {
  "end": {
   "title": "Lezárva, de csendben",
   "text": "Az igazoltatás rendben volt, csak a végét nem rádióztátok le."
  }
 },
 "missed": {
  "end": {
   "title": "Elmaradt intézkedés",
   "text": "Egy hibás lámpa valós indok az igazoltatásra; a tananyag szerinti lépésekkel érdemes végigvinni."
  }
 }
}$json$::jsonb, 70, 100),
('LINCOLN egység: egyedül az igazoltatáson', 'Egyedül járőrözöl: mikor szállhatsz ki, hol kérdezed le az adatokat, melyik gyorshajtási tétel illik a mért sebességhez.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "Deputy Sheriff II. vagy, saját járőrautóddal egyedül járőrözöl (LINCOLN egység, 6L118). Egy fekete Sultan 82 km/h-val hajt el melletted egy 50-es belvárosi szakaszon; a traffipax rögzítette. Mi az első lépés?",
  "choices": [
   {
    "id": "a",
    "text": "Megcélzom, szirénát kapcsolok, felszólítom a félreállásra, és mögé húzódom.",
    "next": "radio",
    "points": 2,
    "verdict": "good",
    "feedback": "A gyorshajtás az igazoltatás egyik indoka; a sorrend: megcélzás, sziréna, felszólítás, félrehúzódás."
   },
   {
    "id": "b",
    "text": "Utánamegyek, és a következő kereszteződésnél keresztbe állok előtte.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Veszélyes és szükségtelen. A felszólítás és a mögé állás elég."
   },
   {
    "id": "c",
    "text": "Felírom a rendszámot, majd a végén bírságolom, ha újra látom.",
    "next": "missed",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabálysértőt ott kell megállítani és igazoltatni; utólagos „bírságolás” nem létezik."
   }
  ]
 },
 "radio": {
  "text": "A Sultan lehúzódik. Mikor és mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "Még a kocsiban: „6L118 10-20 Downtown. Igazoltatás: fekete Sultan, rsz.: 4FHR230, egy fő. Az egység 10-6.” Csak ezután szállok ki.",
    "next": "documents",
    "points": 2,
    "verdict": "good",
    "feedback": "LINCOLN egységnél a deputy csak azt követően száll ki, hogy lerádiózta az igazoltatást."
   },
   {
    "id": "b",
    "text": "Kiszállok, és a sofőr ajtajánál, menet közben mondom be.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül előbb a rádió, utána a kiszállás: ha baj lesz, már tudják, hol vagy és kit állítottál meg."
   },
   {
    "id": "c",
    "text": "Nem rádiózom, egy gyorshajtás percek alatt megvan.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden igazoltatást rádiózni kell. Egyedül különösen: senki más nem tudja, hol vagy."
   }
  ]
 },
 "documents": {
  "text": "Bemutatkoztál, elmondtad az indokot, és megkaptad a sofőr iratait. Mit teszel most?",
  "choices": [
   {
    "id": "a",
    "text": "Megnézem az iratokat, és lekérdezés nélkül visszaadom.",
    "next": "measure",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rendszámot és a nevet ellenőrizni kell, lehet, hogy körözik."
   },
   {
    "id": "b",
    "text": "Visszaülök a járőrautóba, és onnan kérdezem le a rendszámot (10-28) és a sofőr nevét (10-29).",
    "next": "measure",
    "points": 2,
    "verdict": "good",
    "feedback": "LINCOLN egységnél az iratok átvétele után a deputy visszaül a gépjárműbe, és ott kérdezi le az adatokat."
   },
   {
    "id": "c",
    "text": "Az ablaknál állva bemondom a rádióba, és megvárom a választ.",
    "next": "measure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Társ nélkül nincs, aki lekérdezzen helyetted: a tananyag szerint visszaülsz, és a járőrautóból ellenőrzöl."
   }
  ]
 },
 "measure": {
  "text": "A lekérdezés tiszta. A traffipax 82 km/h-t mért, ahol 50 a megengedett. Melyik tétel illik ide?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorshajtás országúton, 25% (110 km/h): GYO/I.",
    "next": "argue",
    "points": 0,
    "verdict": "bad",
    "feedback": "A belváros lakott terület (50 km/h), az országúti tételek itt nem használhatók."
   },
   {
    "id": "b",
    "text": "Gondatlan vezetés (GV).",
    "next": "argue",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyorshajtásnak saját tétele van; a gondatlan vezetés pl. az indexelés hiánya vagy a sávból kilógás."
   },
   {
    "id": "c",
    "text": "Gyorshajtás lakott területen, 25% (65 km/h): GYLT/I., 350 000 – 700 000 $.",
    "next": "argue",
    "points": 3,
    "verdict": "good",
    "feedback": "82 km/h a 65 km/h-s határ fölött, de a 100 km/h-s alatt van, ezért a 25%-os kategória (GYLT/I.)."
   },
   {
    "id": "d",
    "text": "Gyorshajtás lakott területen, 100% (100 km/h): GYLT/II.",
    "next": "argue",
    "points": 0,
    "verdict": "bad",
    "feedback": "A GYLT/II. 100 km/h-tól jár; 82 km/h még a 25%-os kategória."
   }
  ]
 },
 "argue": {
  "text": "Közlöd a sofőrrel a tételt. Felcsattan: „Ugyan már, 60-nal se mentem! Maguk csak a pénzt szedik!” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nyugodtan elmondom a mért értéket, megmutatom a traffipax adatát, és figyelmeztetem, hogy a sértegetés külön tétel lehet.",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "A deputy tisztelettel és higgadtan beszél; nem kell azonnal ordítani. A rendőrrel szembeni tiszteletlenség (RSZT) valóban külön tétel."
   },
   {
    "id": "b",
    "text": "Azonnal megbilincselem és letartóztatom.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aránytalan. Egy ingerült megjegyzés még nem ok a letartóztatásra."
   },
   {
    "id": "c",
    "text": "Visszakiabálok, hogy ne merjen így beszélni velem.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "A dühből cselekvés nem méltó egy deputyhoz; a tananyag a nyugodt, tisztelettudó hangot várja."
   }
  ]
 },
 "close": {
  "text": "A sofőr lehiggad. Hogyan fejezed be?",
  "choices": [
   {
    "id": "a",
    "text": "Átadom a csekket és az iratokat, és továbbhajtok.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "Rendben van, de a pontokat fel kell sorolni, és le kell rádiózni, hogy újra elérhető vagy."
   },
   {
    "id": "b",
    "text": "Felsorolom a büntetés pontjait, átadom a csekket az iratokkal, elköszönök, visszaülök, és lerádiózom, hogy újra 10-98 vagyok.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Pontok, csekk, iratok, elköszönés, majd a rádió: az egység ismét elérhető."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szép munka",
   "text": "Egyedül is a szabály szerint: előbb a rádió, a lekérdezés a járőrautóból, a pontos tétel és higgadt hang."
  }
 },
 "missed": {
  "end": {
   "title": "Elszalasztott intézkedés",
   "text": "A szabálysértőt ott kell megállítani; utólag nincs igazoltatás."
  }
 }
}$json$::jsonb, 70, 110),
('Iratok, neon, szélvédő', 'Egy igazoltatás, ahol több apró hibát kell helyesen felismerni: lejárt iratok, tiltott neon, sérült szélvédő, fényszóró nappal.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "Nappal, Doherty környékén megállítasz egy zöld Buffalót: nem ég a fényszórója, az első szélvédője repedt, és alul piros neon világít. Melyik hiba nem büntethető?",
  "choices": [
   {
    "id": "a",
    "text": "Mindegyik büntethető: nappal is kötelező a fényszóró (FHM), a repedt első szélvédő zavarja a kilátást (RJVK/I.), a piros neon tilos (IAA/I.).",
    "next": "documents",
    "points": 2,
    "verdict": "good",
    "feedback": "A fényszóró nappal is kötelező, a repedt első szélvédő balesetveszélyes, a neon pedig minden színben engedélyezett, kivéve a pirosat és a kéket."
   },
   {
    "id": "b",
    "text": "A neon: a színes neon bármilyen színben szabad.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "A neon minden színben engedélyezett, kivéve a pirosat és a kéket, sem állandó, sem villogó változatban."
   },
   {
    "id": "c",
    "text": "A szélvédő: csak a hátsó szélvédő számít.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az első szélvédő sérülése (RJVK/I.) zavarja a kilátást, ezért büntethető."
   },
   {
    "id": "d",
    "text": "A fényszóró: nappal nem kötelező.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nappal is kötelező a fényszóró, nem csak éjszaka (FHM)."
   }
  ]
 },
 "documents": {
  "text": "Elkéred az iratokat. A jogosítvány tavaly lejárt, a forgalmi engedély érvényes, a személyi igazolványt otthon felejtette. Mit állapítasz meg?",
  "choices": [
   {
    "id": "a",
    "text": "A forgalmi engedély hiánya (HEH) is jár, ha már a jogosítvány rossz.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A forgalmi érvényes, azért nem jár bírság. Mindig csak a valós hiányért."
   },
   {
    "id": "b",
    "text": "Csak az engedély nélküli vezetés, a személyi igazolvány nem számít.",
    "next": "kit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az ENV/I. jó, de a személyi igazolvány hiánya (SZIH) is külön tétel."
   },
   {
    "id": "c",
    "text": "Engedély nélküli vezetés (ENV/I., a lejárt jogosítvány olyan, mintha nem lenne) és személyi igazolvány hiánya (SZIH).",
    "next": "kit",
    "points": 3,
    "verdict": "good",
    "feedback": "A lejárt jogosítvány egyenlő azzal, hogy nincs; a hiányzó személyi igazolvány külön tétel."
   },
   {
    "id": "d",
    "text": "A lejárt jogosítvány csak figyelmeztetést ér, hiszen volt neki.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lejárt jogosítvány egyenlő azzal, hogy nincs: ENV/I."
   }
  ]
 },
 "kit": {
  "text": "A kötelező felszerelést kéred. Az egészségügyi csomag megvan, a háromszög viszont a hátsó ülésen hever, nem a helyén. Mi a helyes?",
  "choices": [
   {
    "id": "a",
    "text": "Én magam rakom be a csomagtartóba, és közben körülnézek benne.",
    "next": "neon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A csomagtartóba belenézni tilos; a célszemély maga rakja el."
   },
   {
    "id": "b",
    "text": "Elfogadom, mert nála van, és megkérem, hogy rakja a helyére. Ezért nem bírságolok.",
    "next": "neon",
    "points": 2,
    "verdict": "good",
    "feedback": "A kötelező felszerelés hiányánál a tétel megjegyzése szerint elfogadható, ha a személynél van; ilyenkor szólj, hogy rakja a helyére."
   },
   {
    "id": "c",
    "text": "Kötelező felszerelés hiánya (KFH), mert nem a csomagtartóban van.",
    "next": "neon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha a személynél van, elfogadható: elég szólni, hogy rakja a helyére."
   }
  ]
 },
 "neon": {
  "text": "A sofőr megkérdezi, ha a piros helyett zöld neont szereltet, az rendben lesz-e. Mit válaszolsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Igen, a zöld engedélyezett. Csak a piros és a kék tilos, villogó változatban is, ugyanígy a színes vagy tompított fényszóróknál.”",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "Az illegális alkatrészeknél (IAA/I. és II.) a piros és a kék tiltott, a többi szín megengedett."
   },
   {
    "id": "b",
    "text": "„Semmilyen neon nem engedélyezett.”",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem igaz: csak a piros és a kék tilos."
   },
   {
    "id": "c",
    "text": "„A kék rendben van, csak a piros tilos.”",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kék is tilos: a megkülönböztető jelzésekkel téveszthető össze."
   }
  ]
 },
 "close": {
  "text": "Összesíted a tételeket. Hogyan zárod?",
  "choices": [
   {
    "id": "a",
    "text": "Felsorolom a pontokat (FHM, RJVK/I., IAA/I., ENV/I., SZIH), a Kalkulátorban összeállítom a bírságot, átadom a csekket, és mivel jogosítványa nincs, nem engedem tovább vezetni.",
    "next": "done",
    "points": 3,
    "verdict": "good",
    "feedback": "Minden pont elhangzik, a bírság a Kalkulátor kereteiből jön, és érvényes jogosítvány nélkül nem ülhet vissza a volán mögé."
   },
   {
    "id": "b",
    "text": "A sok apróság miatt inkább letartóztatom.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezek bírsággal sújtható szabálysértések, nem indokolnak letartóztatást."
   },
   {
    "id": "c",
    "text": "A pontokat felsorolom, a csekket átadom, és elengedem vezetni.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A bírság rendben van, de érvényes jogosítvány nélkül nem vezethet tovább."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Pontos lista",
   "text": "Minden hibát a tétel megjegyzése szerint ítéltél meg, és a ki nem érdemelt bírságot is elkerülted."
  }
 }
}$json$::jsonb, 70, 120),
('Egy szolgálat a rádióban', 'Szolgálatba lépéstől a leadásig: 10-8, ötperces helyzetjelentés, hívójel, elfoglalt egység, szünet, riasztás, 10-10.', 'radio', 1, 'start',
 $json${
 "start": {
  "text": "Felvetted a dutyt a locker roomban (/duty). Samantha Cole vagy, Deputy Sheriff I. Hogyan jelented a rádióban, hogy szolgálatba léptél?",
  "choices": [
   {
    "id": "a",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-8. Szép estét!”",
    "next": "patrol",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag mintája: név, rang, 10-8 (szolgálatba állás) és köszönés."
   },
   {
    "id": "b",
    "text": "„Samantha Cole, 10-10. Szép estét!”",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-10 a szolgálat leadása; a szolgálatba állás a 10-8."
   },
   {
    "id": "c",
    "text": "Semmit, a dutyt úgyis látják.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szolgálatba lépést rádiózni kell, ez a nap első IC lenyomata."
   }
  ]
 },
 "patrol": {
  "text": "Társaddal ADAM egységben (6A014) járőröztök a Financial környékén; te ülsz az anyósülésen. Öt perce nem szólt a rádiótok. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, ez a sofőr dolga.",
    "next": "callsign",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: ADAM egységben az anyósülésen ülő rádiózik. Járőrözés közben legalább ötpercenként kötelező."
   },
   {
    "id": "b",
    "text": "„6A014 járőrözik.”",
    "next": "callsign",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó, hogy szóltál, de hiányzik a pozíció (10-20) és az elérhetőség (10-98)."
   },
   {
    "id": "c",
    "text": "Én jelentem, mert az anyósülésen ülök: „6A014 10-20 Financial, járőrszolgálat teljesítése, az egység 10-98.”",
    "next": "callsign",
    "points": 2,
    "verdict": "good",
    "feedback": "ADAM egységben az anyósülésen ülő rádiózik, és ötpercenként köteles jelenteni a helyzetet: hívójel, 10-20, folyamat, elérhetőség."
   }
  ]
 },
 "callsign": {
  "text": "Egy Trainee megkérdezi, mit jelent a 6A014 hívójel. Mit válaszolsz?",
  "choices": [
   {
    "id": "a",
    "text": "6: a hatodik járőrautó; A: Alpha század; 014: a jelvényszámom.",
    "next": "repair",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 6 a Downtown Station divíziószáma, az A az ADAM egység, a 014 a rendszám számjegyei."
   },
   {
    "id": "b",
    "text": "6: Downtown Station, a fő San Fierrói kirendeltség; A: ADAM egység (két-három sheriff); 014: a járőrautó rendszámának számjegyei.",
    "next": "repair",
    "points": 2,
    "verdict": "good",
    "feedback": "Divíziószám, egységtípus a fonetikus ábécéből, végül a rendszám számjegyei."
   },
   {
    "id": "c",
    "text": "6: Hubert Station; A: AIR egység; 014: a szolgálat sorszáma.",
    "next": "repair",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Hubert Station (SEB) száma a 7, az AIR egység jele pedig AIR, nem A."
   }
  ]
 },
 "repair": {
  "text": "A kocsi megsérült egy kátyúban, elmentek a Repair Co.-hoz szereltetni. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, pár perc az egész.",
    "next": "pause",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha közben riasztás jön, a többiek rátok számítanak: jelenteni kell, és indokolni, miért nem tudtok reagálni."
   },
   {
    "id": "b",
    "text": "„6A014 10-98.”",
    "next": "pause",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-98 azt jelenti, elérhetők vagytok. Szereltetés közben 10-6 (elfoglalt), indokkal."
   },
   {
    "id": "c",
    "text": "„6A014 10-20 Repair Co., szereltetés, 10-6.”",
    "next": "pause",
    "points": 2,
    "verdict": "good",
    "feedback": "A reagálást akadályozó, több perces folyamatot (szereltetés, tankolás, szünet) jelenteni kell, a pozícióval és az indokkal együtt."
   }
  ]
 },
 "pause": {
  "text": "Másfél óra után szünetet tartanátok. Hogyan intézed?",
  "choices": [
   {
    "id": "a",
    "text": "Leparkolunk egy gyorsétteremnél, a rádiót lehalkítjuk.",
    "next": "callout",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szünetet kérni és jelenteni kell; a rádiót szolgálatban nem lehet „lehalkítani”."
   },
   {
    "id": "b",
    "text": "Code 7-tel engedélyt kérek a szünetre, majd: „6A014 visszatér Downtown Departmentre, szünet tartása miatt nem elérhető.”",
    "next": "callout",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 7 a szünet engedélyezésének kérése; a szünet idejére jelezni kell, hogy nem vagytok elérhetők."
   },
   {
    "id": "c",
    "text": "„Code 4, szünet.”",
    "next": "callout",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nincs szükség több erősítésre; a szünet kérése a Code 7."
   }
  ]
 },
 "callout": {
  "text": "A szünet után riasztás jön: a közelben láttak egy lopottnak jelentett járművet (Code 37). Elindultok. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "„Megyünk.”",
    "next": "end_duty",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó szándék, de a hívójel és a reagálási kód hiányzik."
   },
   {
    "id": "b",
    "text": "„6A014 fogadja a hívást, reagál rá, Code 3!”",
    "next": "end_duty",
    "points": 2,
    "verdict": "good",
    "feedback": "Így mindenki tudja, ki megy, és milyen kóddal; a Code 3 fényhíddal és szirénával jár."
   },
   {
    "id": "c",
    "text": "„10-4.”",
    "next": "end_duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-4 annyi: vettem. Mondd be, hogy reagáltok, és milyen kóddal."
   }
  ]
 },
 "end_duty": {
  "text": "A szolgálat végén leadnád a dutyt. Mit rádiózol, és mit teszel a járművel?",
  "choices": [
   {
    "id": "a",
    "text": "Rádiózom a 10-10-et, a koszos kocsit pedig a következő úgyis lemossa.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A rádiózás jó, de a szolgálat végén a járművet megszerelve és tisztán kell visszavinni."
   },
   {
    "id": "b",
    "text": "„10-8”, és ott hagyom a kocsit, ahol épp vagyok.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-8 a szolgálatba állás. A járművet vissza kell vinni, megszerelve és tisztán."
   },
   {
    "id": "c",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-10. További szép estét!” A kocsit megszerelve és tisztán viszem vissza.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-10 a szolgálat leadása; a szabályzat szerint a járművet megszerelve és tisztán kell visszavinni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Tiszta rádióforgalom",
   "text": "Szolgálatba lépés, helyzetjelentések, elfoglaltság, szünet, riasztás és leadás: mind a tananyag formájában."
  }
 }
}$json$::jsonb, 70, 130),
('Határátlépés Los Santosba', 'Mikor és hogyan rádiózd a határátlépést, milyen indokot mondj, mit tehetsz Los Santosban, és mikor jár bírság az útlevél hiányáért.', 'radio', 1, 'start',
 $json${
 "start": {
  "text": "San Fierróban minden szerviz foglalt, ezért Los Santosba mentek szereltetni (6A029). Deputy Kearney vagy. Mit teszel a határnál?",
  "choices": [
   {
    "id": "a",
    "text": "A saját közös rádiónkon szólok, hogy átmegyünk.",
    "next": "reason",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az LSPD-nek kell szólni, hiszen az ő területükre léptek."
   },
   {
    "id": "b",
    "text": "Rádiózom az LSPD-nek: „SFSD to LSPD, Deputy Kearney vételen. 6A029 átlépi a határt szereltetés miatt.”",
    "next": "reason",
    "points": 2,
    "verdict": "good",
    "feedback": "Los Santosba belépéskor kötelező rádiózni az LSPD-nek; ez a tananyag mintája."
   },
   {
    "id": "c",
    "text": "Semmit, a határ csak a térképen létezik.",
    "next": "reason",
    "points": 0,
    "verdict": "bad",
    "feedback": "A határátlépést (üldözés és rablás kivételével) mindig rádiózni kell."
   }
  ]
 },
 "reason": {
  "text": "Másnap egy sérült kollégát visztek egy Los Santos-i kórházba, harmadnap egy LS-i hivatalba mentek iratokért. Milyen indokot mondasz a második esetben?",
  "choices": [
   {
    "id": "a",
    "text": "A kórháznál a kórházi ellátást, a hivatalos útnál pedig az „ügyintézés” kifejezést.",
    "next": "pursuit",
    "points": 2,
    "verdict": "good",
    "feedback": "A szereltetés, a nyomozás és a kórházi ellátás saját indok; minden más esetben az „ügyintézés”."
   },
   {
    "id": "b",
    "text": "Mindkettőnél az „ügyintézés” kifejezést.",
    "next": "pursuit",
    "points": 1,
    "verdict": "ok",
    "feedback": "A hivatali útnál jó, de a kórházi ellátás saját indok, azt mondd."
   },
   {
    "id": "c",
    "text": "A hivatali útnál részletesen elmondom a rádióban, milyen iratokért megyünk.",
    "next": "pursuit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erre szolgál az „ügyintézés” kifejezés: a részletek nem a közös rádióra tartoznak."
   }
  ]
 },
 "pursuit": {
  "text": "Egy üldözés San Fierróból átvezet Los Santosba. Rádiózni kell a határátlépést?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, a határnál meg kell állni, és be kell jelenteni.",
    "next": "ls_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Üldözésnél vagy rablásnál nem kell; ha megállnál, elveszítenéd a gyanúsítottat."
   },
   {
    "id": "b",
    "text": "Nem kell: üldözésre vagy rablásra reagálva a határátlépést nem kell rádiózni.",
    "next": "ls_stop",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez a tananyag kivétele; minden más határátlépést viszont rádiózni kell."
   },
   {
    "id": "c",
    "text": "A határnál abba kell hagyni az üldözést.",
    "next": "ls_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tananyag csak a rádiózás alól ad kivételt; az üldözést nem kell a határon abbahagyni."
   }
  ]
 },
 "ls_stop": {
  "text": "Szereltetés után Los Santosban egy autó átmegy előttetek a piroson. Mit tehettek?",
  "choices": [
   {
    "id": "a",
    "text": "Megállítjuk és megbüntetjük, hiszen ugyanaz a törvény.",
    "next": "passport",
    "points": 0,
    "verdict": "bad",
    "feedback": "A törvény lehet ugyanaz, de a hatáskör nem: LS-ben az LSPD intézkedik, vagy az ő jelenlétükkel és engedélyükkel ti."
   },
   {
    "id": "b",
    "text": "Megállítjuk, és utólag szólunk az LSPD-nek.",
    "next": "passport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az engedély előbb kell, nem utólag."
   },
   {
    "id": "c",
    "text": "Nem igazoltatunk: LS területén csak az LSPD jelenlétével és engedélyével intézkedhetünk. Jelezhetjük nekik a szabálysértést.",
    "next": "passport",
    "points": 2,
    "verdict": "good",
    "feedback": "LS területén nem igazoltathattok, nem intézkedhettek az LSPD jelenléte és engedélye nélkül."
   }
  ]
 },
 "passport": {
  "text": "Hazafelé, már San Fierróban igazoltattok egy Los Santosból érkező sofőrt, akinél nincs útlevél. Büntethető?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, útlevél hiánya (ÚH): San Fierróban annak jár, aki Los Santosból érkezik, Los Santosban fordítva.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint az útlevél hiánya annál büntethető, aki a másik városból érkezik."
   },
   {
    "id": "b",
    "text": "Nem, útlevél csak külföldre kell.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A két város között is kell: az ÚH tétel épp erre szól."
   },
   {
    "id": "c",
    "text": "Csak akkor, ha San Fierrói lakos.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: annak jár, aki Los Santosból érkezik San Fierróba."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Határozott határeset",
   "text": "Rádióztad a határátlépést, a megfelelő indokot mondtad, és Los Santosban sem léptél túl a hatáskörödön."
  }
 }
}$json$::jsonb, 70, 140),
('Rádióetikett', 'Hívásformátum, magázódás, 10-9 és 10-22, bizalmas információ, OOC rádiózás, rádiófóniák a say-ben, szolgálaton kívüli rádió és a helyesírás.', 'radio', 1, 'start',
 $json${
 "start": {
  "text": "Sergeant I. vagy, Garcia a vezetékneved. Lieutenant Wothsmernek kell szólnod a rádióban. Hogyan kezded?",
  "choices": [
   {
    "id": "a",
    "text": "„Sergeant Garcia to Lieutenant Wothsmer.”",
    "next": "tone",
    "points": 2,
    "verdict": "good",
    "feedback": "A kötelező formátum: [rang] [vezetéknév] to [rang] [a keresett fél vezetékneve]."
   },
   {
    "id": "b",
    "text": "„Garcia to Wothsmer, figyelj már ide!”",
    "next": "tone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rang hiányzik, és tegeződő a hangnem."
   },
   {
    "id": "c",
    "text": "„Wothsmer, ott vagy?”",
    "next": "tone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rang és formátum nélkül, tegeződve: a rádióban mindig magázódunk, és a kötelező formátumot használjuk."
   }
  ]
 },
 "tone": {
  "text": "A hadnagy válaszol, és azt kérdezi, mi a helyzet. Hogyan felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Minden oké, főnök, majd szólok.”",
    "next": "repeat",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tegeződés és laza stílus: a rádióban nincs kivétel a magázódás alól."
   },
   {
    "id": "b",
    "text": "„Lieutenant, a gyanúsított őrizetben van, a helyszín biztosítva. Kérem, jelezze, ha további teendő van.”",
    "next": "repeat",
    "points": 2,
    "verdict": "good",
    "feedback": "A rádióban minden esetben magázódni kell, nincs kivétel."
   },
   {
    "id": "c",
    "text": "„Őrizetben, biztosítva.”",
    "next": "repeat",
    "points": 1,
    "verdict": "ok",
    "feedback": "Tömör, de a megszólítás és a mondat ne vesszen el; választékosan, szerephez illően beszélj."
   }
  ]
 },
 "repeat": {
  "text": "Egy kolléga zajos helyről beszél, nem értetted, amit mondott. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "„10-9.”",
    "next": "mistake",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-9 jelentése: ismételje meg az előzőt."
   },
   {
    "id": "b",
    "text": "„Code 10.”",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 10 rádiócsend kérése a kutatás információinak közléséhez."
   },
   {
    "id": "c",
    "text": "„10-22.”",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-22 az előző üzenet figyelmen kívül hagyását kéri."
   }
  ]
 },
 "mistake": {
  "text": "Bemondtál egy rossz rendszámot. Hogyan javítod?",
  "choices": [
   {
    "id": "a",
    "text": "„10-22”, majd bemondom a helyes rendszámot.",
    "next": "secret",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-22 kéri, hogy hagyják figyelmen kívül az előző üzenetet; utána jöhet a helyes adat."
   },
   {
    "id": "b",
    "text": "„10-4”, és bemondom újra.",
    "next": "secret",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-4 annyit jelent: vettem."
   },
   {
    "id": "c",
    "text": "Nem javítom, majd kiderül.",
    "next": "secret",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy rossz rendszám miatt rossz járművet állíthatnak meg."
   }
  ]
 },
 "secret": {
  "text": "Egy informátor nevét kellene átadnod az ügy nyomozójának. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom a nevet a közös rádióba, gyorsabb.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "Bizalmas információ nem mehet a közös rádióra: bárki hallhatja."
   },
   {
    "id": "b",
    "text": "A rádióban csak jelzem, hogy 10-35 (bizalmas információ), és a nevet személyesen adom át.",
    "next": "ooc",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-35 a bizalmas információ jele; egy informátor neve nem a közös rádióra tartozik."
   },
   {
    "id": "c",
    "text": "Discordon megírom egy barátomnak, hogy adja tovább.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "IC ügyet nem intézünk OOC csatornán: minden történésnek IC lenyomata kell, és az MG tilos."
   }
  ]
 },
 "ooc": {
  "text": "Egy kolléga a rádióba írja: „bocs, lagg volt, újraindítom a gépet”. Mi a helyes?",
  "choices": [
   {
    "id": "a",
    "text": "Belefér, mindenki megérti.",
    "next": "say",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem fér bele: az OOC rádiózás tilos."
   },
   {
    "id": "b",
    "text": "Az OOC rádiózás tilos: az ilyet OOC úton (pl. TS3-on) kell jelezni, IC-ben legfeljebb annyit, hogy az egység most nem elérhető (10-6).",
    "next": "say",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat tiltja az OOC rádiózást; IC-ben az elérhetőség változását lehet jelezni."
   },
   {
    "id": "c",
    "text": "Én is visszaírom, hogy nálam is laggol.",
    "next": "say",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel csak folytatod az OOC rádiózást."
   }
  ]
 },
 "say": {
  "text": "Járőrözés közben a társad (say-ben) azt mondja neked: „10-4, Code 7 után megyünk 10-19.” Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem szólok semmit, és normál mondatban válaszolok.",
    "next": "offduty",
    "points": 1,
    "verdict": "ok",
    "feedback": "Te helyesen beszélsz, de érdemes szólni neki, mert a szabály mindenkire vonatkozik."
   },
   {
    "id": "b",
    "text": "Én is így válaszolok, gyorsabb.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Személyes társalgásban (say-ben) a rádiófóniák használata tilos."
   },
   {
    "id": "c",
    "text": "Szólok neki, hogy személyes beszélgetésben tilos a rádiófóniákat használni; mondja el rendes mondatokban.",
    "next": "offduty",
    "points": 2,
    "verdict": "good",
    "feedback": "Rádiófóniát csak a rádióban használunk; say-ben tilos."
   }
  ]
 },
 "offduty": {
  "text": "Szolgálaton kívül sétálsz a városban, és látod, hogy valakit kirabolnak. A rádió nálad van. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Odamegyek, és saját magam fogom el a rablót.",
    "next": "punctuation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha nem vagy dutyban, ne avatkozz bele a rendőri ügyekbe; a magánakció tilos."
   },
   {
    "id": "b",
    "text": "Bemondom a rádióba, hiszen fontos.",
    "next": "punctuation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül tilos a rádiót használni: tárcsázd a 911-et."
   },
   {
    "id": "c",
    "text": "Nem rádiózom, és nem avatkozom bele: szolgálaton kívül tilos a rádió, ilyenkor a 911-et hívom, és elmondom, amit látok.",
    "next": "punctuation",
    "points": 3,
    "verdict": "good",
    "feedback": "Szolgálaton kívül a rádió használata tilos, vészhelyzetben a 911-et kell hívni. Dutyn kívül ne avatkozz bele a rendőri ügyekbe."
   }
  ]
 },
 "punctuation": {
  "text": "Egy lövöldözés közepén gyors helyzetjelentést írsz a rádióba. Mire figyelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak a nagybetűkre, az írásjel akció közben elmaradhat.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az írásjel is kötelező, minden mondat végére."
   },
   {
    "id": "b",
    "text": "A helyesírásra és a mondatvégi írásjelekre akkor is, ha épp lőnek rám.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag kiemeli: a helyesírásra és az írásjelekre akkor is figyelj, ha egy akció közepén vagy, és lőnek rád."
   },
   {
    "id": "c",
    "text": "Akció közben nem számít, csak gyors legyen.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A helyesírás és az írásjelek akció közben is kötelezők."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Rádióetikett: rendben",
   "text": "Formátum, magázódás, kódok, bizalmas adatok, OOC és say: mind a szabályzat szerint."
  }
 }
}$json$::jsonb, 70, 150),
('Előállítás lépésről lépésre', 'Drog egy igazoltatáson: őrizetbe vétel, jogok, motozás (nőt csak nő), szállítás a kirendeltségre, külön választás, Investigator, bírság, fegyház.', 'arrest', 1, 'start',
 $json${
 "start": {
  "text": "Igazoltatás közben a Sabre kesztyűtartójából egy zacskó fehér por csúszik ki; a sofőr, Marcus Reed idegesen visszagyűri. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elveszem a zacskót, és elengedem.",
    "next": "rights",
    "points": 0,
    "verdict": "bad",
    "feedback": "Lefoglalás mellett az eljárás is jár: őrizetbe vétel, kihallgatás, bírság."
   },
   {
    "id": "b",
    "text": "Úgy teszek, mintha nem láttam volna, és csak a bírságot adom ki.",
    "next": "rights",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kábítószer birtoklása bűncselekmény (KB); nem lehet elnézni."
   },
   {
    "id": "c",
    "text": "Megkérem, hogy szálljon ki; a drogteszttel ellenőrzöm, és pozitív eredménynél őrizetbe veszem.",
    "next": "rights",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha az igazoltatás során drogot találunk, a célszemélyt őrizetbe vehetjük; a drogteszt az opcionális duty itemek között van."
   }
  ]
 },
 "rights": {
  "text": "Megbilincselted. Mit mondasz neki?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, majd a kirendeltségen.",
    "next": "search",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jogait a bilincselés után, ott helyben kell felsorolni."
   },
   {
    "id": "b",
    "text": "Felsorolom a jogait: joga van hallgatni, és bármi, amit mond, felhasználható ellene; joga van orvosi ellátást kérni; joga van egy telefonhíváshoz.",
    "next": "search",
    "points": 3,
    "verdict": "good",
    "feedback": "Az őrizetbe vétel része a jogok felsorolása: hallgatás, orvosi ellátás, telefonhívás."
   },
   {
    "id": "c",
    "text": "„Joga van hallgatni, és bármi, amit mond, felhasználható ön ellen.”",
    "next": "search",
    "points": 1,
    "verdict": "ok",
    "feedback": "Ez csak az első jog: az orvosi ellátás és a telefonhívás is jár."
   }
  ]
 },
 "search": {
  "text": "Átvizsgálnád a ruházatát. Hol és hogyan?",
  "choices": [
   {
    "id": "a",
    "text": "Nem motozom meg, a fegyházban úgyis átnézik.",
    "next": "woman",
    "points": 0,
    "verdict": "bad",
    "feedback": "A motozás a helyszínen jár, a saját biztonságod miatt is."
   },
   {
    "id": "b",
    "text": "Még a helyszínen, az autóhoz állítva, részletes RP-vel.",
    "next": "woman",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint a célszemélyt a helyszínen az autóhoz állítjuk, és részletes RP-vel átvizsgáljuk a ruházatát."
   },
   {
    "id": "c",
    "text": "Itt a helyszínen teljes átkutatást végzek, levetkőztetve.",
    "next": "woman",
    "points": 0,
    "verdict": "bad",
    "feedback": "A teljes átkutatás terepen tilos, arra az állomásokon kijelölt helyek valók."
   }
  ]
 },
 "woman": {
  "text": "Az anyósülésen ülő Lisa Grantnél is gyanús csomag van. Te férfi vagy, és a közelben nincs női kolléga. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Engedélyt kérek tőle a motozáshoz; ha nem adja meg, rádión egy női kollégát kérek a helyszínre.",
    "next": "transport",
    "points": 2,
    "verdict": "good",
    "feedback": "Férfit csak férfi, nőt csak nő motozhat. Ha nincs elérhető női állománytag, engedély kell; ha nem adja meg, egy női tagot kérünk a helyszínre."
   },
   {
    "id": "b",
    "text": "Megmotozom, hiszen sürgős.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nőt csak nő motozhat; engedély nélkül nem."
   },
   {
    "id": "c",
    "text": "Nem motozom meg, mert nő, és elengedem.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyanú megmarad: kérj engedélyt, vagy hívj női kollégát."
   }
  ]
 },
 "transport": {
  "text": "Mindkettőjüket beülteted. Hova viszed őket, és mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "A legközelebbi kirendeltségre; bemondom a szállítást, és útközben Investigatort kérek a kihallgatáshoz.",
    "next": "separate",
    "points": 2,
    "verdict": "good",
    "feedback": "A célszemélyt a legközelebbi kirendeltségre visszük (Hubert Station kivételével), útközben pedig Investigatort kérünk."
   },
   {
    "id": "b",
    "text": "Egyenesen a fegyházba.",
    "next": "separate",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen történhet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "Hubert Stationre, mert ott több a hely.",
    "next": "separate",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tananyag kifejezetten kivétel Hubert Stationt."
   }
  ]
 },
 "separate": {
  "text": "A kirendeltségen vagytok. Kettejük vallomása eltérhet. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Egy cellába teszem őket, hogy megnyugodjanak.",
    "next": "investigator",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pont az ellenkezője kell: külön kell választani őket."
   },
   {
    "id": "b",
    "text": "Együtt hallgatom ki őket, gyorsabb.",
    "next": "investigator",
    "points": 0,
    "verdict": "bad",
    "feedback": "Együtt összehangolhatják a történetüket."
   },
   {
    "id": "c",
    "text": "Külön választom őket: Lisát zárkába teszem, amíg Marcust kihallgatják.",
    "next": "investigator",
    "points": 2,
    "verdict": "good",
    "feedback": "Több személy esetén külön kell választani őket, és a többi felet zárkába kell tenni."
   }
  ]
 },
 "investigator": {
  "text": "Megérkezik egy szabad Investigator. Ki hallgatja ki Marcust?",
  "choices": [
   {
    "id": "a",
    "text": "Én, mert én fogtam el.",
    "next": "fine",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabályzat szerint ilyenkor át kell adnod az Investigatornak."
   },
   {
    "id": "b",
    "text": "Az Investigator: ha van elérhető nyomozó, csak ő hallgathat ki, és át kell adnom neki a gyanúsítottat.",
    "next": "fine",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha van elérhető Investigator, csak ők hallgathatják ki a gyanúsítottakat; a Field Staff csak akkor, ha nincs."
   },
   {
    "id": "c",
    "text": "Együtt, de én kérdezek.",
    "next": "fine",
    "points": 1,
    "verdict": "ok",
    "feedback": "Segíthetsz, de a kihallgatás az Investigatoré."
   }
  ]
 },
 "fine": {
  "text": "A kihallgatás után mi a sorrend?",
  "choices": [
   {
    "id": "a",
    "text": "A drogot visszaadjuk, ha kifizeti a bírságot.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt kábítószer nem jár vissza."
   },
   {
    "id": "b",
    "text": "Előbb fegyházba visszük, a bírság ráér.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bírságot a kihallgatás után osztjuk ki, a beszállítás előtt."
   },
   {
    "id": "c",
    "text": "Kiosztjuk a bírságot (kábítószer birtoklás, KB: 1 500 000 – 3 000 000 $ és 30–60 perc), majd fegyházba szállítjuk, az indulást rádión jelezve.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatás után a bírság, majd a beszállítás a fegyházba; az indulást rádiózni kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szabályos előállítás",
   "text": "Jogok, motozás, szállítás, külön választás, Investigator, bírság és fegyház: minden a tananyag sorrendjében."
  }
 }
}$json$::jsonb, 70, 160),
('Első szolgálat Trainee-ként', 'Az első nap: egyenruha, 10-8, a duty itemek, miért nem járőrözhet két Trainee, ki vezet, rádió az anyósülésről, TS3 és a Trainee-hét.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Ma van az első napod Deputy Sheriff Trainee-ként. James Carter vagy, a locker roomban állsz. Milyen egyenruhát (skint) választasz?",
  "choices": [
   {
    "id": "a",
    "text": "Rövid ujjú egyenruhát: csak az ilyen skinek engedélyezettek.",
    "next": "duty",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint csak rövid ujjú uniformot viselő skinek engedélyezettek (/skin)."
   },
   {
    "id": "b",
    "text": "A saját civil ruhámat, a mellényt ráveszem.",
    "next": "duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban egyenruha kell, rövid ujjú."
   },
   {
    "id": "c",
    "text": "A hosszú ujjú, téli egyenruhát, mert hideg van.",
    "next": "duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak rövid ujjú uniform engedélyezett."
   }
  ]
 },
 "duty": {
  "text": "Felvetted a dutyt (/duty). Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, Trainee-ként még nem rádiózhatok.",
    "next": "items",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szolgálatba lépést a Trainee is rádiózza."
   },
   {
    "id": "b",
    "text": "„James Carter, Deputy Sheriff Trainee, 10-8. Szép napot!”",
    "next": "items",
    "points": 2,
    "verdict": "good",
    "feedback": "A szolgálatba lépés mintája: név, rang, 10-8, köszönés."
   },
   {
    "id": "c",
    "text": "„Trainee szolgálatban, valaki vigyen el!”",
    "next": "items",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rádióban a formátum és a választékos stílus kötelező."
   }
  ]
 },
 "items": {
  "text": "A felszerelésed összeállításakor melyik dolog az, ami szolgálatban kifejezetten tilos?",
  "choices": [
   {
    "id": "a",
    "text": "A vészhívó.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A vészhívó kötelező duty item."
   },
   {
    "id": "b",
    "text": "A pénztartó táska: szolgálat közben tilos hordani.",
    "next": "alone",
    "points": 2,
    "verdict": "good",
    "feedback": "A vészhívó és a nagy tüske a duty itemek része, a pénztartó táska viszont szolgálatban tilos."
   },
   {
    "id": "c",
    "text": "A nagy tüske.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nagy tüske is a duty itemek között van."
   }
  ]
 },
 "alone": {
  "text": "Senki sincs szolgálatban, akinek járőrautója van; egy másik Trainee, Ethan Moore viszont igen. Azt javasolja, vigyetek el egy kocsit kettesben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elvisszük, ketten már nem vagyunk egyedül.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Két Trainee sem járőrözhet, és Trainee nem vihet el csak úgy autót."
   },
   {
    "id": "b",
    "text": "Elmegyek egyedül gyalog járőrözni a környéken.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Trainee semmilyen esetben nem járőrözhet egyedül."
   },
   {
    "id": "c",
    "text": "Nem megyünk: két Trainee sem járőrözhet együtt, mindig kell valaki, akinek van autója. Addig a tananyagot olvassuk.",
    "next": "partner",
    "points": 3,
    "verdict": "good",
    "feedback": "A szabályzat szerint két Trainee sem járőrözhet; ha nincs fent senki, akinek autója van, olvassátok a tananyagot."
   }
  ]
 },
 "partner": {
  "text": "Megérkezik Deputy Sheriff II. Sarah Kim, akinek van járőrautója, és magával visz. Vezethetsz te?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha Sarah megengedi.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Sarah nem leader: Trainee csak leaderi engedéllyel vezethet."
   },
   {
    "id": "b",
    "text": "Nem: Trainee csak leaderi engedéllyel vezethet járőrautót. Az anyósülésre ülök.",
    "next": "radio",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint Trainee nem vezethet járőrautót, csak leaderi engedéllyel."
   },
   {
    "id": "c",
    "text": "Igen, gyakorolnom kell.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyakorlás nem kivétel: leaderi engedély kell hozzá."
   }
  ]
 },
 "radio": {
  "text": "ADAM egységben ültök, te az anyósülésen. Mi a dolgod a rádióval?",
  "choices": [
   {
    "id": "a",
    "text": "Semmi, Trainee-ként csak figyelek.",
    "next": "ts3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az anyósülésen ülőé a rádió, Trainee-ként is."
   },
   {
    "id": "b",
    "text": "Csak akkor szólok, ha történik valami.",
    "next": "ts3",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az új fejleményeket mindig, de az ötperces helyzetjelentés is kötelező."
   },
   {
    "id": "c",
    "text": "Ötpercenként én jelentem az egység helyzetét, mert az anyósülésen ülök.",
    "next": "ts3",
    "points": 2,
    "verdict": "good",
    "feedback": "ADAM egységben az anyósülésen ülő rádiózik, és köteles ötpercenként jelenteni a helyzetet."
   }
  ]
 },
 "ts3": {
  "text": "A barátaid egy másik TS3 szobába hívnak beszélgetni szolgálat közben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Átmegyek, a rádiót úgyis látom a játékban.",
    "next": "week",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban az SFSD szobái kötelezők."
   },
   {
    "id": "b",
    "text": "Kilépek a TS3-ból, mert zavar.",
    "next": "week",
    "points": 0,
    "verdict": "bad",
    "feedback": "A TS3 használata szolgálatban kötelező."
   },
   {
    "id": "c",
    "text": "Maradok az SFSD TS3 szobájában: szolgálatban kötelező használni.",
    "next": "week",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha szolgálatban vagy, az SFSD TS3 szobáit köteles vagy használni."
   }
  ]
 },
 "week": {
  "text": "Meddig leszel Trainee?",
  "choices": [
   {
    "id": "a",
    "text": "Legalább 7 napig; ha a feletteseim és a kiképzőm alkalmasnak találnak, felkeresnek a vizsgával.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Minimum 7 nap Trainee-ként; a vizsgára a felettesek és a kiképző hívnak."
   },
   {
    "id": "b",
    "text": "Pontosan egy hétig, utána automatikusan Deputy leszek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 7 nap a minimum, utána vizsga jön."
   },
   {
    "id": "c",
    "text": "Amíg nem kérek rangot.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rangokat kéregetni tilos."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Jó kezdés",
   "text": "Szabályos egyenruha, 10-8, tiltott tárgy nélkül, társsal, aki vezet, rádióval és TS3-mal: így indul egy Trainee hete."
  }
 }
}$json$::jsonb, 70, 170),
('Verekedés a kocsma előtt', 'Két férfi verekszik: szétválasztás, sérült ellátása, szemtanúk, a helyes tételek, a sértegetés és az uszító a tömegben.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Éjjel egy kocsma előtt két férfi verekszik, körülöttük többen kiabálnak. Megérkezel (Code 6). Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Határozott, de nyugodt hangon szétválasztom őket, a többieket hátrébb küldöm, és ha kell, erősítést kérek.",
    "next": "injury",
    "points": 2,
    "verdict": "good",
    "feedback": "A deputy nem dühből cselekszik: határozottan, de nyugodtan rendez, és ha kell, segítséget kér."
   },
   {
    "id": "b",
    "text": "Megvárom, amíg elfáradnak.",
    "next": "injury",
    "points": 0,
    "verdict": "bad",
    "feedback": "Közben valaki súlyosan megsérülhet: be kell avatkozni."
   },
   {
    "id": "c",
    "text": "Gumibottal közéjük vágok.",
    "next": "injury",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az erő az utolsó eszköz, nem az első."
   }
  ]
 },
 "injury": {
  "text": "Az egyikük vérzik a fején. Mi a következő?",
  "choices": [
   {
    "id": "a",
    "text": "Megbilincselem, mert ő is verekedett.",
    "next": "witnesses",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a sérülés: a felelősséget utána tisztázzuk."
   },
   {
    "id": "b",
    "text": "Semmi, csak egy karcolás.",
    "next": "witnesses",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fejsérülést komolyan kell venni."
   },
   {
    "id": "c",
    "text": "Mentőt (PARAMEDIC egységet) kérek, és amíg odaér, elsősegélyt nyújtok.",
    "next": "witnesses",
    "points": 2,
    "verdict": "good",
    "feedback": "A sérült ellátása az első; a segítségnyújtás elmulasztása önálló tétel is."
   }
  ]
 },
 "witnesses": {
  "text": "Mit kezdesz a szemtanúkkal?",
  "choices": [
   {
    "id": "a",
    "text": "Mindenkit letartóztatok, aki ott volt.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aki csak nézte, az nem bűnös."
   },
   {
    "id": "b",
    "text": "Elküldöm őket, csak zavarnak.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ők tudják, mi történt: meg kell hallgatni őket."
   },
   {
    "id": "c",
    "text": "Igazoltatom és külön-külön meghallgatom őket, hogy kiderüljön, ki kezdte.",
    "next": "charge",
    "points": 2,
    "verdict": "good",
    "feedback": "Külön-külön, hogy ne befolyásolják egymást."
   }
  ]
 },
 "charge": {
  "text": "Kiderül, hogy Brad Cole egyedül támadt a másikra, aki könnyebben sérült meg. Melyik tételek jönnek szóba?",
  "choices": [
   {
    "id": "a",
    "text": "Garázdaság magányosan (G/I.) és könnyű testi sértés (TS/I.).",
    "next": "insult",
    "points": 2,
    "verdict": "good",
    "feedback": "Egyedül, fegyver nélkül: G/I.; a könnyebb sérülés: TS/I."
   },
   {
    "id": "b",
    "text": "Terrorcselekmény (TCS).",
    "next": "insult",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy kocsmai verekedés nem terrorcselekmény."
   },
   {
    "id": "c",
    "text": "Garázdaság fegyveresen (G/III.).",
    "next": "insult",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem volt fegyver."
   }
  ]
 },
 "insult": {
  "text": "Brad a bilincselés közben sértegetni kezd. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Visszasértegetem.",
    "next": "crowd",
    "points": 0,
    "verdict": "bad",
    "feedback": "A deputy tisztelettel beszél, a sértegetés nem méltó hozzá."
   },
   {
    "id": "b",
    "text": "Megütöm, hogy elhallgasson.",
    "next": "crowd",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez bántalmazás és hivatali visszaélés."
   },
   {
    "id": "c",
    "text": "Higgadt maradok, és figyelmeztetem, hogy a rendőrrel szembeni tiszteletlenség (RSZT) külön tétel; ha folytatja, felrovom.",
    "next": "crowd",
    "points": 2,
    "verdict": "good",
    "feedback": "A tisztelet akkor is jár, ha ő nem adja meg: az RSZT-t higgadtan alkalmazzuk."
   }
  ]
 },
 "crowd": {
  "text": "A tömegből valaki üvöltve uszítja a többieket, hogy szabadítsák ki Bradet. Melyik tétel illik rá?",
  "choices": [
   {
    "id": "a",
    "text": "Hatósági rendelkezés elleni uszítás (HREU).",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Aki nyilvánosság előtt, a köznyugalom megzavarásával a hatóság rendelkezése ellen uszít: HREU."
   },
   {
    "id": "b",
    "text": "Rendbontás (RB).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RB egy rendezvény rendjével szembeni ellenállás; ide a HREU illik."
   },
   {
    "id": "c",
    "text": "Semmi, ez a szólásszabadsága.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az intézkedés elleni uszítás bűncselekmény."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Nyugalom helyreállítva",
   "text": "Szétválasztottad őket, ellátattad a sérültet, meghallgattad a tanúkat, és a helyes tételeket alkalmaztad."
  }
 }
}$json$::jsonb, 70, 180),
('Közösségi járőrözés', 'Egy csendes délután: segítség a lakosságnak, egy panasz, beszélgetés a társsal, OOC provokáció és egy kérdés a deputyk viselkedéséről.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Csendes délután járőröztök. Egy idős hölgy integet az út szélén. Mit tesztek?",
  "choices": [
   {
    "id": "a",
    "text": "Továbbmegyünk, ez nem hívás.",
    "next": "complaint",
    "points": 0,
    "verdict": "bad",
    "feedback": "A béke fenntartójának kötelessége jó kapcsolatot kiépíteni a lakossággal."
   },
   {
    "id": "b",
    "text": "Félrehúzódunk, kiszállunk, és udvariasan megkérdezzük, miben segíthetünk.",
    "next": "complaint",
    "points": 2,
    "verdict": "good",
    "feedback": "Félre is húzódhatunk, beszélgethetünk a járókelőkkel: éreztetjük, hogy bizalommal fordulhatnak felénk."
   },
   {
    "id": "c",
    "text": "Kiabálunk ki az ablakon, hogy mit akar.",
    "next": "complaint",
    "points": 0,
    "verdict": "bad",
    "feedback": "Udvariatlan; nem kell fennhangon beszélni az emberekkel."
   }
  ]
 },
 "complaint": {
  "text": "Elmondja, hogy az utcájában esténként száguldoznak. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Ez nem a mi dolgunk.”",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A közúti szabályok betartatása épp a mi dolgunk."
   },
   {
    "id": "b",
    "text": "„Majd meglátjuk.”",
    "next": "partner",
    "points": 1,
    "verdict": "ok",
    "feedback": "Udvarias, de semmi konkrétum; a lakos azt érzi, nem vettük komolyan."
   },
   {
    "id": "c",
    "text": "Megköszönöm, felírom az utca nevét, esténként gyakrabban járőrözünk ott, és jelzem a TSB-nek egy traffipaxos ellenőrzéshez.",
    "next": "partner",
    "points": 2,
    "verdict": "good",
    "feedback": "A TSB működteti a traffipaxot és tartatja be a közúti szabályokat: a lakossági jelzés így cselekvés lesz."
   }
  ]
 },
 "partner": {
  "text": "A járőr hosszú, a társad unatkozik. Mit tesztek?",
  "choices": [
   {
    "id": "a",
    "text": "Beszélgetünk, megismerjük egymást: a járőr a kapcsolatépítésről is szól.",
    "next": "ooc",
    "points": 2,
    "verdict": "good",
    "feedback": "A járőr során megismerjük a társunkat, kapcsolatot építünk vele; ettől nem unalmas."
   },
   {
    "id": "b",
    "text": "Vezetés közben telefonozunk.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A mobiltelefon használata vezetéskor szabálysértés, ránk is vonatkozik."
   },
   {
    "id": "c",
    "text": "Keresünk valakit, akit igazoltathatunk, hogy legyen mit csinálni.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "Igazoltatást csak indokoltan lehet kezdeményezni."
   }
  ]
 },
 "ooc": {
  "text": "Egy játékos az OOC chaten provokálni kezd, sértegeti a frakciót. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Visszaírok, hogy megvédjem a frakció becsületét.",
    "next": "question",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel csak nő a vita; a frakcióról a viselkedésed alapján alkotnak véleményt."
   },
   {
    "id": "b",
    "text": "Elnézem, és nem erőltetem a vitát az OOC chaten.",
    "next": "question",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OOC provokálást próbáljuk elnézni; ha látjuk, hogy nincs értelme, ne erőltessük az OOC beszélgetést."
   },
   {
    "id": "c",
    "text": "IC-ben megbüntetem, amikor legközelebb látom.",
    "next": "question",
    "points": 0,
    "verdict": "bad",
    "feedback": "OOC sérelemért IC intézkedni metagaming és visszaélés."
   }
  ]
 },
 "question": {
  "text": "Egy civil megkérdezi, miért ilyen gorombák a deputyk. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Ez nem a maga dolga.”",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lakosság véleménye a mi dolgunk is."
   },
   {
    "id": "b",
    "text": "Megköszönöm, hogy elmondta: mi tisztelettel bánunk mindenkivel, és ha egy kollégára panasza van, a Sheriff's Department oldalán, a Kapcsolat menüben jelezheti.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A lakossági panaszt a nyilvános oldalon is fogadjuk (az Internal Affairs Bureau vizsgálja); a tisztelet a bizalom alapja."
   },
   {
    "id": "c",
    "text": "Sértegetésért megbüntetem (RSZT).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy kérdés nem tiszteletlenség."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Bizalom építve",
   "text": "Segítettél, komolyan vetted a panaszt, nem ugrottál be a provokációnak, és megmutattad, hová fordulhatnak a lakosok."
  }
 }
}$json$::jsonb, 70, 190),
('CCTV-riasztás', 'Ki mehet ki egy CCTV-riasztásra, mikor csatlakozhatnak a rendes egységek, miért nem megyünk illegális frakciók HQ-jára, és mi a helyzet szolgálaton kívül.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "CCTV-riasztás érkezik egy San Fierro-i raktárnál. TSB egység vagy, és pont a közelben jársz. Kimehetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a társam is jön.",
    "next": "request",
    "points": 0,
    "verdict": "bad",
    "feedback": "A létszám sem számít: csak erősítéskérésre mehetsz."
   },
   {
    "id": "b",
    "text": "Nem: CCTV-re csak a SEB és a PD-n belüli METRO alosztály tagjai mennek; ha ők erősítést kérnek, akkor mehetnek rendes egységek is.",
    "next": "request",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint csak a SEB és a PD-n belüli METRO alosztály megy ki a CCTV-kre; erősítéskéréskor csatlakozhatnak mások."
   },
   {
    "id": "c",
    "text": "Igen, a legközelebbi egység vagyok.",
    "next": "request",
    "points": 0,
    "verdict": "bad",
    "feedback": "A közelség itt nem számít: a CCTV a SEB és a METRO dolga."
   }
  ]
 },
 "request": {
  "text": "Tíz perc múlva a SEB erősítést kér a raktárhoz. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "„6A029 reagál a SEB erősítéskérésére, Code 3!”, és a helyszínen a SEB rangidősének utasításait követem.",
    "next": "hq",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha erősítést kérnek, mehetnek a rendes egységek is; a helyszínen a SEB irányít."
   },
   {
    "id": "b",
    "text": "Megyek, és elsőként behatolok.",
    "next": "hq",
    "points": 0,
    "verdict": "bad",
    "feedback": "A behatolás a SEB-é; a deputyk csak felkérésre."
   },
   {
    "id": "c",
    "text": "Nem megyek, a CCTV a SEB dolga.",
    "next": "hq",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha erősítést kérnek, a rendes egységek is mehetnek."
   }
  ]
 },
 "hq": {
  "text": "Egy órával később CCTV-riasztás jön egy ismert illegális frakció főhadiszállásáról. A SEB-es kolléga szerint oda nem mennek. Miért?",
  "choices": [
   {
    "id": "a",
    "text": "Mert ott sosincs bűncselekmény.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem ezért: a szabályzat tiltja."
   },
   {
    "id": "b",
    "text": "Mert illegális frakciók HQ-jára CCTV végett tilos kimenni.",
    "next": "offduty",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat kifejezetten tiltja az illegális frakciók HQ-jára való kivonulást CCTV miatt."
   },
   {
    "id": "c",
    "text": "Mert az az LSPD dolga.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem hatásköri kérdés: a CCTV miatti kivonulás tilos oda."
   }
  ]
 },
 "offduty": {
  "text": "Szolgálaton kívül, civilben látod, hogy a raktárnál újra mozgás van. MCB-tag vagy. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Felveszem a detektív dutyt, hogy legyen nálam fegyver, és odamegyek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A detektív duty hivatalos szolgálat, nem veheted fel csak azért, hogy önvédelmi fegyvered legyen (azonnali hibapont)."
   },
   {
    "id": "b",
    "text": "Odamegyek civilben, és szétnézek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Dutyn kívül ne avatkozz bele; ez magánakció lenne."
   },
   {
    "id": "c",
    "text": "Nem avatkozom bele, és a 911-et hívom: ha nem vagyok dutyban, nem avatkozom bele a rendőri ügyekbe.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Dutyn kívül ne avatkozz bele a rendőri ügyekbe; vészhelyzetben a 911."
   }
  ]
 },
 "done": {
  "end": {
   "title": "A helyén minden",
   "text": "Tudod, kié a CCTV, mikor csatlakozhatsz, hová tilos menni, és mit tegyél, ha nem vagy szolgálatban."
  }
 }
}$json$::jsonb, 70, 200),
('Szolgálaton kívül', 'Egy buli és egy hazaút: illegális kérés, drog, detektív duty önvédelemre, beavatkozás dutyn kívül, kérdések a nyomozásról, és a kis karakter szabályai.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Szolgálaton kívül egy bulin vagy. Egy barátod illegális fegyvert akar venni, és megkér, hogy vidd el autóval a találkozóra. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nemet mondok: szolgálaton kívül is tilos illegális tevékenységet végezni.",
    "next": "drugs",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint szolgálaton kívül tilos illegális tevékenységet végezni."
   },
   {
    "id": "b",
    "text": "Elviszem, de nem szállok ki a kocsiból.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fuvar is részvétel: bűnrészesség lehet."
   },
   {
    "id": "c",
    "text": "Elviszem, hiszen most nem vagyok szolgálatban.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiltás épp a szolgálaton kívüli időre szól."
   }
  ]
 },
 "drugs": {
  "text": "Megkínálnak valamivel, amitől „jobban érzed magad”. Holnap reggel szolgálatba lépsz. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elfogadom, holnapra kimegy.",
    "next": "detective",
    "points": 0,
    "verdict": "bad",
    "feedback": "Illegális, és a hatása a szolgálatodba is átnyúlhat."
   },
   {
    "id": "b",
    "text": "Elfogadom, de nem mondom el senkinek.",
    "next": "detective",
    "points": 0,
    "verdict": "bad",
    "feedback": "A titok nem teszi szabályossá."
   },
   {
    "id": "c",
    "text": "Nemet mondok: illegális, és szolgálatban is tilos bármilyen tudatmódosító szer.",
    "next": "detective",
    "points": 2,
    "verdict": "good",
    "feedback": "A kábítószer birtoklása bűncselekmény, és szolgálat közben tilos bármilyen tudatmódosító szer használata."
   }
  ]
 },
 "detective": {
  "text": "Hazafelé egy rossz környéken mész át, és jó lenne egy önvédelmi fegyver. MCB-tag vagy. Felveheted erre a detektív dutyt?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha utána leadom.",
    "next": "interfere",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az sem számít, mikor adod le: erre nem veheted fel."
   },
   {
    "id": "b",
    "text": "Igen, a duty erre is jó.",
    "next": "interfere",
    "points": 0,
    "verdict": "bad",
    "feedback": "Azonnali hibapont: a detektív duty hivatalos szolgálat."
   },
   {
    "id": "c",
    "text": "Nem: a detektív duty hivatalos szolgálat, nem veheted fel csak azért, hogy legyen önvédelmi fegyvered (azonnali hibapont).",
    "next": "interfere",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a detektív duty hivatalos szolgálatnak minősül; önvédelmi fegyverért felvenni azonnali hibapont."
   }
  ]
 },
 "interfere": {
  "text": "Egy autós szabálytalanul parkol egy tűzcsap előtt. A jelvényed nálad van. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megbírságolom, hiszen nálam a jelvény.",
    "next": "info",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül nem intézkedsz."
   },
   {
    "id": "b",
    "text": "Nem intézkedem: ha nem vagyok dutyban, nem avatkozom bele a rendőri ügyekbe. Ha veszélyt látok, a 911-et hívom.",
    "next": "info",
    "points": 2,
    "verdict": "good",
    "feedback": "Dutyn kívül ne avatkozz bele a rendőri ügyekbe; vészhelyzetben a 911-et kell hívni."
   },
   {
    "id": "c",
    "text": "Rádión szólok a kollégáknak.",
    "next": "info",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül tilos a rádiót használni."
   }
  ]
 },
 "info": {
  "text": "Egy civil barátod arról kérdez, mi lett a múlt heti lövöldözés nyomozásával. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit: a frakció csoportjaiból és az ügyekről információt kiadni tilos.",
    "next": "alt",
    "points": 2,
    "verdict": "good",
    "feedback": "Frakciócsoportokból információt kiadni tilos."
   },
   {
    "id": "b",
    "text": "Elmondom, amit tudok, hiszen a barátom.",
    "next": "alt",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy kiszivárgott részlet egy egész nyomozást tönkretehet."
   },
   {
    "id": "c",
    "text": "Megmutatom neki az aktát a telefonomon.",
    "next": "alt",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez a legsúlyosabb kiszivárogtatás."
   }
  ]
 },
 "alt": {
  "text": "Egy ismerős azt javasolja, hogy a „kis karaktereddel” csatlakozz egy illegális csoporthoz, mert az „nem a sheriff”. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csatlakozom, a kis karakter egy másik ember.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabály épp a kis karakterekre vonatkozik."
   },
   {
    "id": "b",
    "text": "Csatlakozom, csak bankot és ATM-et nem rabolok vele.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Már a csatlakozás is tilos engedély nélkül; a bank- és ATM-rablás pedig kis karakterrel is tilos."
   },
   {
    "id": "c",
    "text": "Nemet: amíg az SD tagja vagyok, más frakcióban a kis karakteremmel sem lehetek, illegális csoportba pedig csak a fő-leader engedélyével kezdhetnék.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint SD-tagként kis karakterrel más frakcióban lenni tilos; illegális non-script frakcióba kezdeni csak a fő-leader engedélyével lehet."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szolgálaton kívül is deputy",
   "text": "Nem vettél részt illegális dologban, nem vetted fel a dutyt fegyverért, nem intézkedtél dutyn kívül, és nem szivárogtattál."
  }
 }
}$json$::jsonb, 70, 210),
('Sajtó a helyszínen', 'Egy riporter a kordonnál: mit mondhat egy deputy, a Code 20, a Public Information Officer, a sajtótájékoztató, a kiszivárgó képek és a kordon átlépése.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Egy lövöldözés helyszínén a kordonnál állsz. Egy riporter odalép: „Mi történt? Hány halott van?” Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Elzavarom, és megfenyegetem, hogy letartóztatom.",
    "next": "code20",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtóval is tisztelettel beszélünk."
   },
   {
    "id": "b",
    "text": "Elmondom, amit tudok, a nyilvánosságnak joga van tudni.",
    "next": "code20",
    "points": 0,
    "verdict": "bad",
    "feedback": "A hiteles tájékoztatás a SIB dolga; egy félinformáció kárt okozhat."
   },
   {
    "id": "c",
    "text": "Udvariasan közlöm, hogy a helyszínről nem adhatok információt; a sajtót a Sheriff's Information Bureau tájékoztatja.",
    "next": "code20",
    "points": 2,
    "verdict": "good",
    "feedback": "A SIB a hivatalos kommunikációs részleg, ő tájékoztatja hitelesen a médiát."
   }
  ]
 },
 "code20": {
  "text": "A rangidős azt mondja, értesítsék a médiát. Melyik kódot használja?",
  "choices": [
   {
    "id": "a",
    "text": "Code 10.",
    "next": "pio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 10 rádiócsend a kutatás információinak közléséhez."
   },
   {
    "id": "b",
    "text": "10-35.",
    "next": "pio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-35 bizalmas információ."
   },
   {
    "id": "c",
    "text": "Code 20: értesítsék a médiát.",
    "next": "pio",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 20 a média értesítésének kódja."
   }
  ]
 },
 "pio": {
  "text": "Megérkezik a Public Information Officer. Mit tudsz róla?",
  "choices": [
   {
    "id": "a",
    "text": "Szolgálati egyenruhában dolgozik, lőfegyvert és kényszerítő eszközt nem visel; ő tart sajtótájékoztatót és készít riportot.",
    "next": "conference",
    "points": 2,
    "verdict": "good",
    "feedback": "A SIB anyaga szerint a PIO egyenruhában, fegyver és kényszerítő eszköz nélkül dolgozik."
   },
   {
    "id": "b",
    "text": "Civil ruhában van, hogy ne lássák.",
    "next": "conference",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálati egyenruhában végzi a munkáját."
   },
   {
    "id": "c",
    "text": "Ő is fegyveres, a kordonnál segít.",
    "next": "conference",
    "points": 0,
    "verdict": "bad",
    "feedback": "A PIO nem visel lőfegyvert és kényszerítő eszközt."
   }
  ]
 },
 "conference": {
  "text": "Ki vehet részt a sajtótájékoztatón?",
  "choices": [
   {
    "id": "a",
    "text": "Csak a frakció tagjai.",
    "next": "leak",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtótájékoztató a sajtónak szól."
   },
   {
    "id": "b",
    "text": "Bárki, aki odaér.",
    "next": "leak",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak a regisztrált sajtó."
   },
   {
    "id": "c",
    "text": "A helyszínen regisztrált sajtó.",
    "next": "leak",
    "points": 2,
    "verdict": "good",
    "feedback": "A sajtótájékoztatón a helyszínen regisztrált sajtó jogosult részt venni."
   }
  ]
 },
 "leak": {
  "text": "Egy kolléga a frakció belső csoportjából egy képet tenne ki a helyszínről a közösségi oldalára. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "Ne tegye: frakciócsoportokból információt kiadni tilos, a hivatalos közlés a SIB dolga.",
    "next": "cordon",
    "points": 2,
    "verdict": "good",
    "feedback": "Frakciócsoportokból információt kiadni tilos; a közösségi oldalakat a SIB üzemelteti."
   },
   {
    "id": "b",
    "text": "Csak a jó képeket.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Semmilyen képet nem."
   },
   {
    "id": "c",
    "text": "Tegye ki, jó reklám.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kiszivárgott kép egy nyomozást is veszélyeztethet."
   }
  ]
 },
 "cordon": {
  "text": "A riporter átlép a kordonon, hogy közelebbről fotózzon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Hagyom, ő is csak a munkáját végzi.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kordon a helyszín és a riporter biztonságát is védi."
   },
   {
    "id": "b",
    "text": "Felszólítom, hogy azonnal menjen vissza; ha nem teszi, a hatósági eljárás megzavarása miatt intézkedem.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A kordon mindenkire vonatkozik; aki megzavarja az eljárást, felelősségre vonható (HEM)."
   },
   {
    "id": "c",
    "text": "Elveszem a fényképezőgépét, és összetöröm.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez rongálás és visszaélés."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Hiteles tájékoztatás",
   "text": "A deputy nem nyilatkozik, a SIB és a PIO tájékoztat, a képek nem szivárognak ki, és a kordon tart."
  }
 }
}$json$::jsonb, 70, 220),
('Havi kötelezettségek', 'Jelentések és duty idő, AI-tilalom, helyesírás és sablon, naplózás, meeting, inaktivitás és a rangkéregetés.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Hónap közepe van. Hány jelentés és mennyi duty idő kötelező havonta?",
  "choices": [
   {
    "id": "a",
    "text": "Nincs kötelező minimum.",
    "next": "ai",
    "points": 0,
    "verdict": "bad",
    "feedback": "Van: 8 jelentés és 30 óra."
   },
   {
    "id": "b",
    "text": "Havi 8 jelentés és legalább 30 óra duty; ez alatt nem jár alapfizetés és rangfelvétel.",
    "next": "ai",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint havi 8 jelentés kötelező, és havi 30 óra minimum duty idő elvárt."
   },
   {
    "id": "c",
    "text": "Havi 3 jelentés és 10 óra.",
    "next": "ai",
    "points": 0,
    "verdict": "bad",
    "feedback": "Havi 8 jelentés és 30 óra a minimum."
   }
  ]
 },
 "ai": {
  "text": "Fáradt vagy, és egy AI-jal íratnád meg a jelentést. Szabad?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: AI használata tilos; ha észlelik, arról a jelentésről megvonják a fizetést.",
    "next": "spelling",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a saját fogalmazásotokra kíváncsiak; AI esetén a jelentésre nem jár fizetés."
   },
   {
    "id": "b",
    "text": "Igen, ha senki nem veszi észre.",
    "next": "spelling",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiltás attól nem szűnik meg, hogy nem veszik észre."
   },
   {
    "id": "c",
    "text": "Igen, ha átírom kicsit.",
    "next": "spelling",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos: a saját fogalmazásod kell."
   }
  ]
 },
 "spelling": {
  "text": "Mire figyelsz a jelentés írásakor?",
  "choices": [
   {
    "id": "a",
    "text": "A helyesírásra, a mondatvégi írásjelekre és a fórum kötelező sablonjára; a saját fogalmazásomban.",
    "next": "log",
    "points": 2,
    "verdict": "good",
    "feedback": "A helyesírásra és az írásjelekre kiemelten figyelünk; a fórum sablonjai kötelezők."
   },
   {
    "id": "b",
    "text": "Minél rövidebb, annál jobb, írásjel nélkül.",
    "next": "log",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden mondat végére írásjel kell."
   },
   {
    "id": "c",
    "text": "A tartalom számít, a helyesírás nem.",
    "next": "log",
    "points": 0,
    "verdict": "bad",
    "feedback": "A frakcióról a helyesírás alapján is véleményt alkotnak."
   }
  ]
 },
 "log": {
  "text": "Elküldted a jelentést a fórumra. Mit teszel még?",
  "choices": [
   {
    "id": "a",
    "text": "Kétszer naplózom, hogy duplán számítson.",
    "next": "meeting",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fórumbejegyzés csak egyszer számít."
   },
   {
    "id": "b",
    "text": "Semmit, a vezetők úgyis megszámolják a fórumon.",
    "next": "meeting",
    "points": 1,
    "verdict": "ok",
    "feedback": "Megszámolhatják, de a naplózással biztosan beszámít."
   },
   {
    "id": "c",
    "text": "Naplózom a Jelentések oldalon a fórum linkjével, hogy a fizetésnél beszámítson.",
    "next": "meeting",
    "points": 2,
    "verdict": "good",
    "feedback": "A naplózott jelentés számít a havi fizetésnél, és te is látod, hol tartasz."
   }
  ]
 },
 "meeting": {
  "text": "A hónap utolsó hétvégéjén meeting van, de nem tudsz ott lenni. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nem szólok, úgyis sokan vannak.",
    "next": "inactive",
    "points": 0,
    "verdict": "bad",
    "feedback": "A távolmaradást mindig jelezni kell."
   },
   {
    "id": "b",
    "text": "Előre jelzem a Discord szerveren, hogy nem tudok megjelenni.",
    "next": "inactive",
    "points": 2,
    "verdict": "good",
    "feedback": "A meetingeken és kiképzéseken kötelező megjelenni; ha nem tudsz, a Discord szerveren kell jelezned."
   },
   {
    "id": "c",
    "text": "Utólag megkérdezem, mi volt.",
    "next": "inactive",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előtte kell jelezni."
   }
  ]
 },
 "inactive": {
  "text": "Két hónapra elutazol. Hogyan kérsz inaktivitást?",
  "choices": [
   {
    "id": "a",
    "text": "Egyszerre két hónapot kérek.",
    "next": "rank",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy hónapnál hosszabbat nem lehet kérni."
   },
   {
    "id": "b",
    "text": "Nem szólok, majd visszajövök.",
    "next": "rank",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az inaktivitást a Discordon jelezni kell."
   },
   {
    "id": "c",
    "text": "Egyszerre legfeljebb egy hónapot kérhetek; ha tovább nem leszek elérhető, havonta jelzem.",
    "next": "rank",
    "points": 2,
    "verdict": "good",
    "feedback": "Egy hónapnál hosszabb inaktivitást kérelmezni tilos; ha tovább nem vagy elérhető, havonta jelezd."
   }
  ]
 },
 "rank": {
  "text": "Egy kolléga azt javasolja, kérj előléptetést a vezetőtől, mert „régóta itt vagy”. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Írok a vezetőnek, hogy megérdemlem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez rangkéregetés, tilos."
   },
   {
    "id": "b",
    "text": "Megkérem a barátaimat, hogy ők is szóljanak.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez is rangkéregetés, csak közvetve."
   },
   {
    "id": "c",
    "text": "Nem kérek: rangokat kéregetni tilos; az előléptetésről a vezetőség dönt a munkám alapján.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat tiltja a rangok kéregetését."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Minden pipa a helyén",
   "text": "Megvan a 8 jelentés és a 30 óra, saját szavaiddal, naplózva, jelezted a távolmaradást, és nem kérted a rangot."
  }
 }
}$json$::jsonb, 70, 230),
('Vadászok ellenőrzése', 'Game Wardenként a vadászterületen: ellenőrzés indok nélkül, láthatósági és lövedékálló mellény, orvvadászat és a bejelentetlen puska.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Game Warden vagy, Ford Raptorral járőrözöl a vadászterületen. Két vadászt látsz; semmi gyanúsat nem csinálnak. Ellenőrizheted őket?",
  "choices": [
   {
    "id": "a",
    "text": "Csak ha lövést hallok.",
    "next": "vest",
    "points": 0,
    "verdict": "bad",
    "feedback": "Indok nélkül is ellenőrizheted őket."
   },
   {
    "id": "b",
    "text": "Nem, igazoltatni csak indokkal lehet.",
    "next": "vest",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Game Wardenre itt külön szabály vonatkozik."
   },
   {
    "id": "c",
    "text": "Igen: a Game Warden különösebb indok nélkül is ellenőrizheti a vadászokat.",
    "next": "vest",
    "points": 2,
    "verdict": "good",
    "feedback": "A GW képesítés leírása szerint a vadászok különösebb indok nélkül ellenőrizhetők."
   }
  ]
 },
 "vest": {
  "text": "Az egyikükön nincs láthatósági mellény. Melyik tétel?",
  "choices": [
   {
    "id": "a",
    "text": "Láthatósági mellény viselésének elmulasztása (LMVE): 500 000 – 1 000 000 $.",
    "next": "armor",
    "points": 2,
    "verdict": "good",
    "feedback": "Vadászat közben kötelező a láthatósági mellény; ennek elmulasztása az LMVE."
   },
   {
    "id": "b",
    "text": "Nem büntethető, a mellény csak ajánlott.",
    "next": "armor",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vadászat közben kötelező."
   },
   {
    "id": "c",
    "text": "Kötelező felszerelés hiánya (KFH).",
    "next": "armor",
    "points": 0,
    "verdict": "bad",
    "feedback": "A KFH a járművek kötelező felszerelése."
   }
  ]
 },
 "armor": {
  "text": "A másikon lövedékálló mellény van. Büntethető?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ilyet csak a rendvédelem viselhet.",
    "next": "license",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rendvédelem kivétel, de a vadászterület is."
   },
   {
    "id": "b",
    "text": "Nem: lövedékálló mellényt magánterületen, lőtéren és vadászterületen szabad hordani.",
    "next": "license",
    "points": 2,
    "verdict": "good",
    "feedback": "Az LMVK megjegyzése szerint vadászterületen szabad."
   },
   {
    "id": "c",
    "text": "Igen, lövedékálló mellény viselése közterületen (LMVK).",
    "next": "license",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vadászterületen ez kivétel."
   }
  ]
 },
 "license": {
  "text": "Kiderül, hogy a második vadásznak nincs vadászengedélye, és egy elejtett szarvas van a kocsijában. Melyik tétel?",
  "choices": [
   {
    "id": "a",
    "text": "Lopás (L).",
    "next": "weapon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A vad engedély nélküli elejtésének saját tétele van: OV."
   },
   {
    "id": "b",
    "text": "Orvvadászat (OV): 2 500 000 – 5 000 000 $ és 30–60 perc fegyház.",
    "next": "weapon",
    "points": 2,
    "verdict": "good",
    "feedback": "Engedély nélkül vad elejtése vadászterületen: orvvadászat."
   },
   {
    "id": "c",
    "text": "Csak figyelmeztetés, egy szarvas miatt.",
    "next": "weapon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az orvvadászat fegyházzal járó bűncselekmény."
   }
  ]
 },
 "weapon": {
  "text": "A puskája engedélyes, de az LSPD-nél nincs bejelentve. Mit állapítasz meg?",
  "choices": [
   {
    "id": "a",
    "text": "Illegális fegyver birtoklása (IFB): akkor is illegális, ha van rá engedély, de nincs bejelentve az LSPD felé.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az IFB megjegyzése: engedély mellett is illegális a bejelentetlen fegyver."
   },
   {
    "id": "b",
    "text": "Vadászterületen nem kell bejelenteni.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bejelentés helytől független."
   },
   {
    "id": "c",
    "text": "Rendben van, hiszen engedélyes.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bejelentés is kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Tiszta vadászat",
   "text": "Ellenőrizted a vadászokat, és minden tételt a megjegyzése szerint alkalmaztál."
  }
 }
}$json$::jsonb, 70, 240),
('Jármű, felszerelés, megjelenés', 'Kinek a kocsija, milyen kiegészítő fér bele, a pénztartó táska, a dupla nagykaliber, a köszönés és a jármű visszavitele.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Szolgálatba lépnél, de a saját járőrautód szervizben van. A kollégád autója szabad a garázsban. Elviheted?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha visszahozom.",
    "next": "accessories",
    "points": 0,
    "verdict": "bad",
    "feedback": "Másét akkor sem."
   },
   {
    "id": "b",
    "text": "Igen, ha nem veszi észre.",
    "next": "accessories",
    "points": 0,
    "verdict": "bad",
    "feedback": "Másét semmiképp."
   },
   {
    "id": "c",
    "text": "Nem: csak a saját kocsimat vihetem el, másét nem.",
    "next": "accessories",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint csak a saját kocsidat viheted el."
   }
  ]
 },
 "accessories": {
  "text": "Milyen kiegészítőt viselhetsz szolgálatban?",
  "choices": [
   {
    "id": "a",
    "text": "Legfeljebb egy egyszerű darabot, például egy karórát; idétlen vagy feltűnő kiegészítőt nem, és többet egyszerre sem.",
    "next": "moneybag",
    "points": 2,
    "verdict": "good",
    "feedback": "Az idétlen kiegészítőket mellőzzük, és egyszerre ne legyen rajtad több; egy karóra belefér."
   },
   {
    "id": "b",
    "text": "Napszemüveget, kalapot és láncot, mindet egyszerre.",
    "next": "moneybag",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyszerre több kiegészítő sem lehet rajtad."
   },
   {
    "id": "c",
    "text": "Bármilyet, ez az én stílusom.",
    "next": "moneybag",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálat közben tilos idétlen kiegészítőket viselni."
   }
  ]
 },
 "moneybag": {
  "text": "Szolgálat közben pénztartó táskát kaptál egy achievementért. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megtartom a szolgálat végéig.",
    "next": "calibre",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban tilos hordani."
   },
   {
    "id": "b",
    "text": "Amint tudok, elmegyek egy ATM-hez: szolgálat közben tilos pénztartó táskát hordani.",
    "next": "calibre",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint achievement esetén minél hamarabb menj egy ATM-hez."
   },
   {
    "id": "c",
    "text": "Odaadom egy civilnek.",
    "next": "calibre",
    "points": 0,
    "verdict": "bad",
    "feedback": "A helyes út az ATM."
   }
  ]
 },
 "calibre": {
  "text": "Járőrözésre két nagy kaliberű fegyvert vinnél, biztos, ami biztos. Szabad?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha az egyik a csomagtartóban van.",
    "next": "greeting",
    "points": 0,
    "verdict": "bad",
    "feedback": "A járőrözés nem bevetés: egy nagykaliber elég."
   },
   {
    "id": "b",
    "text": "Nem: a dupla nagykaliber tilos; kivétel a bevetés, ha hirtelen kell egy másik, de amint nincs rá szükség, le kell tenni.",
    "next": "greeting",
    "points": 2,
    "verdict": "good",
    "feedback": "A dupla nagykaliber használata tilos, a bevetés a kivétel."
   },
   {
    "id": "c",
    "text": "Igen, ha mindkettő szolgálati.",
    "next": "greeting",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos, akár szolgálati, akár nem."
   }
  ]
 },
 "greeting": {
  "text": "Egy civil „Erőt, egészséget!” köszönéssel üdvözöl. Hogyan köszönsz vissza?",
  "choices": [
   {
    "id": "a",
    "text": "Nem köszönök vissza.",
    "next": "return",
    "points": 0,
    "verdict": "bad",
    "feedback": "A köszönés a tisztelet része; csak ne ORFK-s formában."
   },
   {
    "id": "b",
    "text": "„Erőt, egészséget!”",
    "next": "return",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos: Amerikában vagyunk."
   },
   {
    "id": "c",
    "text": "„Szép napot!”: az „Erőt, egészséget” és a hasonló ORFK-s kifejezések tilosak, Amerikában vagyunk.",
    "next": "return",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat kifejezetten tiltja az ORFK-s kifejezéseket."
   }
  ]
 },
 "return": {
  "text": "A szolgálat végén a kocsid sáros és horpadt. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Leparkolom így, a szerelők majd megcsinálják.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiéd a feladat: megszerelve és tisztán."
   },
   {
    "id": "b",
    "text": "Elcserélem egy másik, tiszta kocsira.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak a saját kocsidat viheted."
   },
   {
    "id": "c",
    "text": "Megszereltetem és lemosatom, és csak így viszem vissza.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A szolgálat végén a kocsit mindig megszerelve és tisztán kell visszavinni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Rendben és rendesen",
   "text": "A saját kocsid, mértékletes megjelenés, nincs pénztartó táska és dupla nagykaliber, helyes köszönés, tiszta autó."
  }
 }
}$json$::jsonb, 70, 250),
('Traffipax-ellenőrzés: melyik tétel?', 'Mért sebességek lakott területen, országúton és autópályán, egy telefonáló sofőr, nyári gumi decemberben és egy menekülő autó.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Decemberi délelőtt van. A TSB egységeként traffipaxszal mérsz az autópálya-felhajtónál (megengedett 120 km/h). Egy szürke Comet 245 km/h-val száguld el. Melyik tételt alkalmazod, ha megállítod?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorshajtás országúton, 200% (270 km/h): GYO/IV.",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autópályán az autópályás tételek érvényesek (alap 120 km/h)."
   },
   {
    "id": "b",
    "text": "Gyorshajtás autópályán, 150% (300 km/h): GYA/IV.",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "A GYA/IV. 300 km/h-tól jár; 245 km/h a 100%-os kategória."
   },
   {
    "id": "c",
    "text": "Gyorshajtás autópályán, 100% (240 km/h): GYA/III., 450 000 – 900 000 $; ilyen átlépésnél a vezetéstől is eltiltható (legfeljebb 30 napra).",
    "next": "rural",
    "points": 3,
    "verdict": "good",
    "feedback": "245 km/h a 240 km/h-s határ fölött, de a 300 km/h-s alatt: GYA/III. Ennél a szintnél az eltiltás is mérlegelhető."
   },
   {
    "id": "d",
    "text": "Gyorshajtás autópályán, 50% (180 km/h): GYA/II.",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "245 km/h már a 240 km/h-s, 100%-os kategória (GYA/III.)."
   }
  ]
 },
 "rural": {
  "text": "Átállsz egy országúti szakaszra (megengedett 90 km/h). Egy piros Sabre 140 km/h-val halad. Melyik kategória?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorshajtás országúton, 25% (110 km/h): GYO/I.",
    "next": "town",
    "points": 0,
    "verdict": "bad",
    "feedback": "135 km/h fölött már a 50%-os kategória jár."
   },
   {
    "id": "b",
    "text": "Gyorshajtás országúton, 50% (135 km/h): GYO/II., 400 000 – 800 000 $.",
    "next": "town",
    "points": 2,
    "verdict": "good",
    "feedback": "140 km/h a 135 km/h-s határ fölött, a 180 km/h-s alatt: GYO/II."
   },
   {
    "id": "c",
    "text": "Gyorshajtás országúton, 100% (180 km/h): GYO/III.",
    "next": "town",
    "points": 0,
    "verdict": "bad",
    "feedback": "A GYO/III. 180 km/h-tól jár."
   }
  ]
 },
 "town": {
  "text": "Egy lakott területen (50 km/h) egy fehér Elegy 210 km/h-val süvít el, és a szirénára sem lassít, egyértelműen le akar rázni. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal MDC üldözés jelet rakok és rádiózom: ha a célszemély egyértelműen menekül nagy sebességgel, nem kell kivárni a harmadik felszólítást.",
    "next": "phone",
    "points": 3,
    "verdict": "good",
    "feedback": "Az üldözési jel főszabály szerint a harmadik felszólítás után jár, kivétel, ha a célszemély egyértelműen le akarja rázni a járőrautót."
   },
   {
    "id": "b",
    "text": "Háromszor felszólítom, és csak utána jelzem az üldözést, akármi történik.",
    "next": "phone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kivétel pont erre szól: ha egyértelműen menekül nagy sebességgel, nem kell kivárni a harmadikat."
   },
   {
    "id": "c",
    "text": "Hagyom, ilyen sebességnél úgysem érem utol.",
    "next": "phone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy 210 km/h-val száguldó autó a belvárosban életveszélyes; jelezd az üldözést, és a többi egység is be tud kapcsolódni."
   }
  ]
 },
 "phone": {
  "text": "Az Elegy sofőrjét elfogják: 200 km/h fölött ment lakott területen. Közben te egy lassan haladó autót látsz, a sofőr szemből nézve telefont tart a füléhez. Ezt büntetheted?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, és azt a sofőrt is, akit hátulról láttam, mert biztosan ő is telefonált.",
    "next": "tyres",
    "points": 0,
    "verdict": "bad",
    "feedback": "Hátulról nem látod, mit csinál a sofőr: feltételezés alapján nincs bírság."
   },
   {
    "id": "b",
    "text": "Nem büntethető, a telefonálás nem szabálysértés.",
    "next": "tyres",
    "points": 0,
    "verdict": "bad",
    "feedback": "Van rá tétel: mobiltelefon használata vezetéskor (MHV)."
   },
   {
    "id": "c",
    "text": "Igen: mobiltelefon használata vezetéskor (MHV). Most szemből IC is láttam, ezért alkalmazható.",
    "next": "tyres",
    "points": 2,
    "verdict": "good",
    "feedback": "Az MHV-t akkor használd, ha IC láttad, hogy telefonál: szemből igen, hátulról nem látod."
   }
  ]
 },
 "tyres": {
  "text": "Megállítod a telefonálót. Nyári gumi van az autón, és december van. Mit állapítasz meg?",
  "choices": [
   {
    "id": "a",
    "text": "Helytelen járműabroncs használata (HJH): november 1. és április 30. között téli gumi kell (a négyévszakos mindig jó). A MHV mellé ezt is felsorolom.",
    "next": "ban",
    "points": 2,
    "verdict": "good",
    "feedback": "A HJH november 1. és április 30. között vonatkozik a nem téli (és nem négyévszakos) abroncsra."
   },
   {
    "id": "b",
    "text": "Rendben van, a gumi csak hó esetén számít.",
    "next": "ban",
    "points": 0,
    "verdict": "bad",
    "feedback": "A dátum számít: november 1. és április 30. között téli (vagy négyévszakos) abroncs kötelező."
   },
   {
    "id": "c",
    "text": "Lefoglalom a járművet a gumi miatt.",
    "next": "ban",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aránytalan: a helytelen abroncs bírsággal sújtható tétel."
   }
  ]
 },
 "ban": {
  "text": "Visszagondolsz az Elegyre: 210 km/h egy 50-es zónában. Mi jár ezért a tétel megjegyzése szerint?",
  "choices": [
   {
    "id": "a",
    "text": "GYLT/IV., de bevonni semmit sem lehet, csak bírságolni.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A tétel jó, de a megjegyzés szerint a jogosítvány és a forgalmi bevonható."
   },
   {
    "id": "b",
    "text": "GYLT/III. (200%, 150 km/h), és legfeljebb figyelmeztetés.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "200 km/h fölött már a GYLT/IV. jár, és a bevonás is lehetséges."
   },
   {
    "id": "c",
    "text": "GYLT/IV. (300%, 200 km/h fölött), 500 000 – 1 000 000 $; ennél a szintnél a jogosítvány és a forgalmi engedély bevonható.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A lakott területi 300%-os kategória megjegyzése szerint itt a jogosítvány és a forgalmi engedély is bevonható."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Pontos mérés, pontos tétel",
   "text": "A sebességkategóriák, a telefonálás és az abroncs szabálya is megvan: a Kalkulátor tételei szerint dolgoztál."
  }
 }
}$json$::jsonb, 70, 260),
('Ittas sofőr az éjszakában', 'Kígyózó autó éjjel: igazoltatás, alkoholszonda, őrizetbe vétel, jogok, motozás, kihallgatás és fegyház.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Éjjel kettő van. Egy ezüst Premier kígyózva halad a Gant híd felé, kétszer is átlóg a szemközti sávba. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Igazoltatást kezdeményezek gondatlan vezetés miatt: megcélzás, sziréna, felszólítás, félrehúzódás mögé, rádiózás.",
    "next": "smell",
    "points": 2,
    "verdict": "good",
    "feedback": "A gondatlan vezetés valós indok. A szokásos sorrend és a rádió itt is kötelező."
   },
   {
    "id": "b",
    "text": "Mögötte maradok, hátha magától leáll.",
    "next": "smell",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aki ittasan vezet, minden méterrel veszélyesebb. Állítsd meg."
   },
   {
    "id": "c",
    "text": "Mellé húzódom, és az ablakon át kiabálok, hogy álljon meg.",
    "next": "smell",
    "points": 0,
    "verdict": "bad",
    "feedback": "Veszélyes manőver egy kiszámíthatatlan sofőr mellett; a sziréna és a felszólítás a helyes út."
   }
  ]
 },
 "smell": {
  "text": "A sofőr, Kevin Walsh nehezen találja az iratait, a lehelete alkoholszagú, a szeme vörös. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megkérem, hogy fújjon az alkoholszondába (opcionális duty item), és az eredményt rádión is bemondom.",
    "next": "result",
    "points": 2,
    "verdict": "good",
    "feedback": "A gyanút bizonyítani kell: az alkoholszonda (vagy a drogteszt) a duty itemek között van, és a rádió IC lenyomatot ad."
   },
   {
    "id": "b",
    "text": "Rögtön megbilincselem, a szag elég bizonyíték.",
    "next": "result",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szag gyanú, nem bizonyíték. Előbb az alkoholszonda."
   },
   {
    "id": "c",
    "text": "Elküldöm haza, hogy ne vezessen tovább, és ennyi.",
    "next": "result",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ittas vezetés bűncselekmény (JIÁ), nem elég hazaküldeni."
   }
  ]
 },
 "result": {
  "text": "A szonda pozitív. Melyik tétel ez, és mi jár érte?",
  "choices": [
   {
    "id": "a",
    "text": "Gondatlan vezetés (GV), csak bírság.",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kígyózás ok volt a megállításra, de az ittas vezetésnek saját tétele van, fegyházzal."
   },
   {
    "id": "b",
    "text": "Közúti veszélyeztetés (KV), csak bírság.",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ittas vezetésnek saját tétele van (JIÁ)."
   },
   {
    "id": "c",
    "text": "Járművezetés ittas állapotban (JIÁ): 250 000 – 500 000 $ és 15–30 perc fegyház.",
    "next": "custody",
    "points": 2,
    "verdict": "good",
    "feedback": "A JIÁ a tudatmódosító szer használatát is lefedi vezetés előtt vagy közben."
   }
  ]
 },
 "custody": {
  "text": "Őrizetbe veszed. Mi a helyes sorrend?",
  "choices": [
   {
    "id": "a",
    "text": "Bilincs, a jogainak felsorolása (hallgathat, és amit mond, felhasználható; orvosi ellátást kérhet; egy telefonhívás jár neki), majd az autónál részletes RP-vel átvizsgálom a ruházatát.",
    "next": "passenger",
    "points": 3,
    "verdict": "good",
    "feedback": "Pontosan a tananyag szerint: bilincs, jogok, majd a helyszínen az autóhoz állítva motozás, részletes RP-vel."
   },
   {
    "id": "b",
    "text": "Bilincs, motozás, beültetés; a jogait kihagyom, ittasan úgysem érti.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jogok felsorolása mindig jár, állapottól függetlenül."
   },
   {
    "id": "c",
    "text": "Beültetem az autóba, a jogait majd a kirendeltségen mondom el.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jogait az őrizetbe vételkor, a bilincs után kell felsorolni."
   }
  ]
 },
 "passenger": {
  "text": "Az anyósülésen egy nő ül, ő is ittas, de nem vezetett. Mi a teendő vele?",
  "choices": [
   {
    "id": "a",
    "text": "Őt is letartóztatom ittas vezetésért.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem vezetett, ezért ittas vezetés nem róható fel neki."
   },
   {
    "id": "b",
    "text": "Odaadom neki a kulcsot, hogy vigye haza az autót.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő is ittas: ha vezetne, ugyanazt a bűncselekményt követné el."
   },
   {
    "id": "c",
    "text": "Ő nem vezetett, ezért JIÁ nem jár neki. Igazoltatom, és megkérem, hogy ittasan ne üljön a volán mögé.",
    "next": "transport",
    "points": 2,
    "verdict": "good",
    "feedback": "A JIÁ a vezetőre vonatkozik. Az utas nem vezetheti el a járművet ittasan."
   }
  ]
 },
 "transport": {
  "text": "Beülteted Kevint. Mit rádiózol, és mi történik útközben?",
  "choices": [
   {
    "id": "a",
    "text": "Hubert Stationre viszem, mert ott csendesebb.",
    "next": "interrogation",
    "points": 0,
    "verdict": "bad",
    "feedback": "A legközelebbi kirendeltségre kell vinni, Hubert Station kivételével."
   },
   {
    "id": "b",
    "text": "Egyenesen a fegyházba viszem, ott hallgatom ki.",
    "next": "interrogation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen történhet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "Bemondom, hogy a legközelebbi kirendeltségre szállítom, és útközben Investigatort kérek a kihallgatáshoz.",
    "next": "interrogation",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint a célszemélyt a legközelebbi kirendeltségre visszük, és útközben kérünk Investigatort; ha nincs, mi hallgatjuk ki."
   }
  ]
 },
 "interrogation": {
  "text": "Nincs szabad Investigator, te hallgatod ki. Hogyan?",
  "choices": [
   {
    "id": "a",
    "text": "Leveszem a bilincset és leültetem; RP-ben az egyik kezét az asztalon lévő fémrúdhoz csatolom, leveszem a maszkját, diktafont használok, és rákérdezek az estéjére.",
    "next": "jail",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez a tananyag kihallgatási rendje: a bilincs RP-ben rajta marad a rúdon, maszk nincs, diktafon használható."
   },
   {
    "id": "b",
    "text": "Kihallgatás nélkül kiszabom a büntetést.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kihallgatás része az eljárásnak; a bírságot utána osztjuk ki."
   },
   {
    "id": "c",
    "text": "A cellában, bilincsben, maszkban kérdezem ki, hogy gyorsabb legyen.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatáskor a maszkot le kell venni, és a széken, a rúdhoz csatolva ül."
   }
  ]
 },
 "jail": {
  "text": "A kihallgatás végére értél. Mi a sorrend a végén?",
  "choices": [
   {
    "id": "a",
    "text": "Kiosztom a bírságot, majd fegyházba szállítom, és ezt az indulás pillanatában rádión jelzem (10-15).",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatás után a pénzbírság, majd a beszállítás; az indulást rádión jelezni kell."
   },
   {
    "id": "b",
    "text": "Előbb fegyházba viszem, a bírságot majd ott valaki kiosztja.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bírságot a kihallgatás után te osztod ki, még a beszállítás előtt."
   },
   {
    "id": "c",
    "text": "Bírság, fegyház, a rádiózás elmarad, mert késő van.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A beszállítás indulását mindig rádiózni kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Biztonságban az utakon",
   "text": "Bizonyítottad a gyanút, szabályosan vetted őrizetbe, és a kihallgatás is a tananyag szerint zajlott."
  }
 }
}$json$::jsonb, 70, 270),
('Megvesztegetési kísérlet', 'Az igazoltatott sofőr pénzt ajánl, hogy „felejtsd el” a bírságot. Mit tesz egy deputy, és mit, ha a társa is kísértésbe esik?', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Gyorshajtásért igazoltatsz egy drága Cheetah-t. A sofőr, Victor Hale halkan megszólal: „Deputy, itt van ötszázezer, és felejtsük el az egészet, rendben?” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Határozottan visszautasítom, és közlöm vele, hogy a hivatali személy megvesztegetésének kísérlete bűncselekmény, ezért őrizetbe veszem.",
    "next": "radio",
    "points": 3,
    "verdict": "good",
    "feedback": "A hivatali személy megvesztegetése (HSZM) súlyos tétel: 3 000 000 – 6 000 000 $ és 30–60 perc fegyház. Nincs alku."
   },
   {
    "id": "b",
    "text": "Elfogadom, senki nem látta.",
    "next": "accepted",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez korrupció (73 §), a legsúlyosabb tételek egyike: 3 000 000 – 6 000 000 $ és 60–90 perc fegyház, és a frakcióból is kirúgás jár érte."
   },
   {
    "id": "c",
    "text": "Visszautasítom, és csak a gyorshajtásért bírságolok.",
    "next": "radio",
    "points": 1,
    "verdict": "ok",
    "feedback": "A visszautasítás helyes, de a megvesztegetési kísérlet önálló bűncselekmény (HSZM), nem lehet elnézni."
   }
  ]
 },
 "accepted": {
  "end": {
   "title": "Korrupció",
   "text": "A pénz elfogadása bűncselekmény, és az egész frakció hitelét rombolja. Ilyenkor nincs második esély."
  }
 },
 "radio": {
  "text": "Victor tiltakozik, hogy csak viccelt. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„10-22”, mert a sofőr szerint csak vicc volt.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-22 az előző üzenet figyelmen kívül hagyását kéri; itt nincs mit visszavonni."
   },
   {
    "id": "b",
    "text": "Semmit, ez kettőnk ügye.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rádiózás IC lenyomat; nélküle később nincs mire hivatkozni."
   },
   {
    "id": "c",
    "text": "Bemondom a helyzetet, erősítést kérek a szállításhoz, és a felajánlott összeget bizonyítékként rögzítem.",
    "next": "partner",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden új fejleményt rádiózni kell; a felajánlott pénz bizonyíték, IC lenyomattal."
   }
  ]
 },
 "partner": {
  "text": "A társad félrehív: „Hagyd már, fele-fele, és mindenki jól jár.” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nemet mondok, és a történteket jelentem a felettesemnek (a belső ügyekért az Internal Affairs Bureau felel).",
    "next": "charges",
    "points": 3,
    "verdict": "good",
    "feedback": "A társ fedezése bűnpártolás lenne. A belső ügyeket az Internal Affairs Bureau vizsgálja; a felettesed tudja, kihez fordulj."
   },
   {
    "id": "b",
    "text": "Ráhagyom, de én nem kérek a pénzből.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "A hallgatással fedezed a társadat, ez bűnpártolás. Mondj nemet, és jelentsd a felettesednek."
   },
   {
    "id": "c",
    "text": "Elfogadom, egyszer belefér.",
    "next": "accepted",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem fér bele: ez korrupció, a frakcióból kirúgással jár."
   }
  ]
 },
 "charges": {
  "text": "Victort őrizetbe vetted. Milyen tételeket sorolsz fel?",
  "choices": [
   {
    "id": "a",
    "text": "Csak korrupció (73 §).",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A korrupció a hivatalos személyt terheli, aki elfogad. A kínálónak a hivatali személy megvesztegetése (HSZM) jár."
   },
   {
    "id": "b",
    "text": "Csak a gyorshajtás, a pénz visszaadásával rendezzük.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A megvesztegetési kísérlet önálló bűncselekmény."
   },
   {
    "id": "c",
    "text": "Gyorshajtás (a mért kategória szerint) és hivatali személy megvesztegetése (HSZM): utóbbi 3 000 000 – 6 000 000 $ és 30–60 perc fegyház.",
    "next": "jail",
    "points": 2,
    "verdict": "good",
    "feedback": "Mindkét cselekmény külön tétel. A HSZM fegyházzal jár."
   }
  ]
 },
 "jail": {
  "text": "A fegyházidő 60 perc lesz. Hol töltheti le?",
  "choices": [
   {
    "id": "a",
    "text": "Fegyházban: a Departmenten lévő cellákban legfeljebb 59 perc szabható ki.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A Department celláiban legfeljebb 59 perces jail adható, 60 perc már a fegyházé."
   },
   {
    "id": "b",
    "text": "Sehol, ha kifizeti a bírságot.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A HSZM fegyházzal jár, a bírság nem váltja ki."
   },
   {
    "id": "c",
    "text": "A Department cellájában, ott is el lehet tölteni.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Department celláiban legfeljebb 59 perc szabható ki."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Tiszta kéz",
   "text": "Visszautasítottad a pénzt, jelentetted a társad ajánlatát, és a helyes tételeket alkalmaztad."
  }
 }
}$json$::jsonb, 70, 280),
('Gázolás és cserbenhagyás', 'Egy autó elüt egy gyalogost, és elhajt. Helyszínbiztosítás, segítségnyújtás, a menekülő jármű leírása és a felelősök.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "„Gázolás a Market Streeten, a jármű elhajtott” – hallod a rádióban. Két sarokra vagy. Hogyan reagálsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem reagálok, más úgyis közelebb van.",
    "next": "scene",
    "points": 0,
    "verdict": "bad",
    "feedback": "Te vagy két sarokra; a reagálást is rádiózni kell, hogy tudják, ki megy."
   },
   {
    "id": "b",
    "text": "„6A029 fogadja a hívást, reagál rá, Code 3!” – fényhíddal és szirénával indulok.",
    "next": "scene",
    "points": 2,
    "verdict": "good",
    "feedback": "Sürgős hívásra Code 3-mal reagálunk, fényhíddal és szirénával."
   },
   {
    "id": "c",
    "text": "Code 2-vel megyek, nehogy balesetet okozzak.",
    "next": "scene",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás, sziréna nélkül; egy sérült gyalogoshoz sürgősen kell menni."
   }
  ]
 },
 "scene": {
  "text": "Odaérsz: a gyalogos a földön fekszik, vérzik, de lélegzik. Körülötte néhányan telefonnal videóznak. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom az érkezést (10-97), biztosítom a helyszínt, mentőt (PARAMEDIC egységet) kérek, és elsősegélyt nyújtok a sérültnek.",
    "next": "witness",
    "points": 3,
    "verdict": "good",
    "feedback": "Az élet az első: a helyszín biztosítása, mentő és elsősegély. Az érkezést rádiózni kell."
   },
   {
    "id": "b",
    "text": "Rögtön a menekülő autó után indulok.",
    "next": "witness",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sérült ellátása és a helyszín biztosítása az első; a jármű leírását rádión bárki megkaphatja."
   },
   {
    "id": "c",
    "text": "Felírom a videózók nevét, mert nem segítettek.",
    "next": "witness",
    "points": 0,
    "verdict": "bad",
    "feedback": "A segítségnyújtás elmulasztása valóban tétel, de előbb a sérült és a helyszín."
   }
  ]
 },
 "witness": {
  "text": "Egy szemtanú elmondja: egy fekete Washington volt, a rendszámból 3-KFT-et látta, egy férfi vezette, észak felé hajtott. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„Cserbenhagyásos gázolás: fekete Washington, a rendszám részlete 3KFT, egy fő, észak felé.” És BOLO-t rögzítek az eligazításon.",
    "next": "found",
    "points": 2,
    "verdict": "good",
    "feedback": "A leírás sorrendje: szín, márka, típus, rendszám, a bent ülők száma, és az irány. A BOLO-t minden egység látja."
   },
   {
    "id": "b",
    "text": "„Fekete autó, észak felé.”",
    "next": "found",
    "points": 1,
    "verdict": "ok",
    "feedback": "Hiányos: a márka, a típus, a rendszám részlete és az utasok száma is kell."
   },
   {
    "id": "c",
    "text": "„Elütöttek valakit, egy autó elhajtott.”",
    "next": "found",
    "points": 0,
    "verdict": "bad",
    "feedback": "Leírás nélkül senki sem fogja felismerni a járművet."
   }
  ]
 },
 "found": {
  "text": "Egy egység tíz perc múlva megtalálja az autót egy garázsban, a vezetője beismeri a gázolást. Melyik tétel?",
  "choices": [
   {
    "id": "a",
    "text": "Gondatlan vezetés (GV), mert nem szándékosan tette.",
    "next": "bystander",
    "points": 0,
    "verdict": "bad",
    "feedback": "A cserbenhagyásos gázolásnak saját tétele van fegyházzal (KBO/I.)."
   },
   {
    "id": "b",
    "text": "Közúti baleset okozása, cserbenhagyásos gázolás (KBO/I.): 750 000 – 1 500 000 $ és 15–30 perc fegyház.",
    "next": "bystander",
    "points": 2,
    "verdict": "good",
    "feedback": "Elütött valakit, és nem állt meg segíteni vagy mentőt hívni: ez a KBO/I."
   },
   {
    "id": "c",
    "text": "Halálesetkor (KBO/III.), mert súlyos volt.",
    "next": "bystander",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sérült életben van; a KBO/III. a script szerinti halálra vonatkozik."
   }
  ]
 },
 "bystander": {
  "text": "Kiderül, hogy egy jelenlévő autós látta a gázolást, de csak videózott, segítséget sem hívott. Mit állapíthatsz meg?",
  "choices": [
   {
    "id": "a",
    "text": "Bűnrészesség (BR), mert végig ott volt.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bűnrészesség a bűncselekményben való részvétel; ő nem vett részt, csak nem segített."
   },
   {
    "id": "b",
    "text": "Segítségnyújtás elmulasztása (SNYE): akkor is vétség, ha nem ő okozta a balesetet.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint a mulasztás akkor is vétség, ha nem ő okozta a balesetet."
   },
   {
    "id": "c",
    "text": "Semmit, nem ő gázolt.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A segítségnyújtás elmulasztása önálló tétel, a baleset okozójától függetlenül."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Elfogva, ellátva",
   "text": "A sérült ellátást kapott, a leírásból elfogták a sofőrt, és a mulasztót is felelősségre vontad."
  }
 }
}$json$::jsonb, 70, 290),
('Üldözés: a felszólítástól az MDC-jelig', 'Mikor rakható MDC üldözés jel, mit mondasz be, milyen sorrendben haladnak az egységek, és mikor szabad egy autóra lőni.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "TSB egységként (6A029) egy piros Banshee-t igazoltatnál gondatlan vezetés miatt. Szirénát kapcsolsz és felszólítod, de nem áll meg, a megengedett sebességgel halad tovább. Mikor rakhatsz MDC üldözés jelet?",
  "choices": [
   {
    "id": "a",
    "text": "Ha a harmadik felszólításra sem áll meg; addig folytatom a felszólítást.",
    "next": "radio",
    "points": 2,
    "verdict": "good",
    "feedback": "Üldözés MDC jel akkor rakható, ha a célszemély nem áll meg a harmadik felszólításra."
   },
   {
    "id": "b",
    "text": "Soha, az MDC jel csak lövöldözésnél kell.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autós üldözésnél az MDC üldözés funkcióját kell használni."
   },
   {
    "id": "c",
    "text": "Azonnal, már az első után.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Főszabály a harmadik felszólítás. Kivétel, ha egyértelműen le akar rázni nagy sebességgel, de ő most nem ezt teszi."
   }
  ]
 },
 "radio": {
  "text": "A harmadik felszólításra sem áll meg, és most gyorsít. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 99!”",
    "next": "order",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 vészhelyzet: minden egység reagáljon. Egy üldözéshez a pontos adatok kellenek."
   },
   {
    "id": "b",
    "text": "„Üldözöm a Banshee-t!”",
    "next": "order",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó szándék, de hiányzik a pozíció, a rendszám, az utasok száma, az irány és az MDC jel."
   },
   {
    "id": "c",
    "text": "„6A029, 10-20: Doherty, MDC jel, 10-99, C3! Piros Banshee, rsz.: 2BNS518, egy fő, kelet felé.”",
    "next": "order",
    "points": 3,
    "verdict": "good",
    "feedback": "MDC jelet raksz, és bemondod a pozíciót, a jármű leírását (szín, márka, rendszám, utasok) és az irányt."
   }
  ]
 },
 "order": {
  "text": "Egy SAHP Corvette és egy SEB ROBERT egység is csatlakozik. Milyen sorrendben haladtok a gyanúsított mögött?",
  "choices": [
   {
    "id": "a",
    "text": "Elöl a SAHP, utána a ROBERT (SEB), majd én (TSB); ha jön Bearcat, ő a leghátsó. Teret adok, hogy előrejöhessenek.",
    "next": "passenger",
    "points": 2,
    "verdict": "good",
    "feedback": "Az üldözési sorrend: SAHP ← ROBERT ← TSB ← BEARCAT. Mindig tartani kell, hogy ne hozzátok hátrányba egymást."
   },
   {
    "id": "b",
    "text": "Én maradok elöl, mert én kezdtem.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sorrend nem az érkezésen múlik: a SAHP és a SEB egységek mennek előre."
   },
   {
    "id": "c",
    "text": "Mindenki egymás mellett, hogy körbezárjuk.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "Zsúfolt és balesetveszélyes; az üldözési sorrendet mindig tartani kell."
   }
  ]
 },
 "passenger": {
  "text": "A társad az anyósülésen ül. Mi a dolga?",
  "choices": [
   {
    "id": "a",
    "text": "Kihajol az ablakon, és lövésre készül.",
    "next": "dropout",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amíg ránk nem lőnek, mi sem lövünk, autóra pedig csak tűzparancsra."
   },
   {
    "id": "b",
    "text": "Mihamarabb bemondja a közös rádióba, amit az üldözött járműről megtud: irány, kiszálló utas, eldobott tárgy.",
    "next": "dropout",
    "points": 2,
    "verdict": "good",
    "feedback": "Az anyósülésen ülő kötelessége az üldözött járműről szerzett információt mihamarabb közölni a közös rádión."
   },
   {
    "id": "c",
    "text": "Telefonnal videózza az üldözést.",
    "next": "dropout",
    "points": 0,
    "verdict": "bad",
    "feedback": "A dolga a rádió: az információ a többi egységnek kell."
   }
  ]
 },
 "dropout": {
  "text": "Egy kanyarban megcsúszol, és kiesel az üldözésből. A többiek már két sarokkal előrébb járnak. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Csak akkor csatlakozom vissza, ha nem akadályozok más egységet; addig a rádiót követem, és ha kérik, lezárok egy utat.",
    "next": "shots",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha kiestél, csak akkor térhetsz vissza, ha nem akadályozol más egységet."
   },
   {
    "id": "b",
    "text": "Feladom, és visszamegyek járőrözni, szó nélkül.",
    "next": "shots",
    "points": 1,
    "verdict": "ok",
    "feedback": "Biztonságos, de mondd be, hogy kiestél, hogy a többiek tudjanak róla."
   },
   {
    "id": "c",
    "text": "Padlógázzal visszaküzdöm magam a sor elejére.",
    "next": "shots",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel a sorrendet és a többiek biztonságát is veszélyezteted."
   }
  ]
 },
 "shots": {
  "text": "A Banshee-ből rálőnek a SAHP egységre. Szabad-e most visszalőni a járműre?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, azonnal tüzet nyitok, hiszen ránk lőttek.",
    "next": "cornered",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autóra éles fegyverrel csak tűzparancs esetén lehet lőni, tűzparancsot pedig csak a rangidős adhat ki."
   },
   {
    "id": "b",
    "text": "Csak tűzparancsra: autóra éles fegyverrel tűzparancs esetén lehet lőni, és azt csak a rangidős adhatja ki. Bemondom a lövéseket, és várom a parancsot.",
    "next": "cornered",
    "points": 3,
    "verdict": "good",
    "feedback": "Amíg nem lőnek ránk, mi sem lövünk; és ha lőnek, akkor is a rangidős tűzparancsa kell az autóra leadott lövésekhez."
   },
   {
    "id": "c",
    "text": "A sokkolóval célzom meg a kocsit.",
    "next": "cornered",
    "points": 0,
    "verdict": "bad",
    "feedback": "Sokkolóval autóra lőni tilos."
   }
  ]
 },
 "cornered": {
  "text": "A rangidős tűzparancsot ad, a Banshee kereke kilyukad, és egy zsákutcában megáll. Az egységek körbeállják. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 100”: abban a helyzetben vagyunk, hogy elfogjuk.",
    "next": "custody",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 100 jelentése: az egységek abban a helyzetben vannak, hogy elfogják a menekülő gyanúsítottat."
   },
   {
    "id": "b",
    "text": "„Code 4.”",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nincs szükség több erősítésre: ehhez még korai."
   },
   {
    "id": "c",
    "text": "„Code 12.”",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 12 téves riasztás."
   }
  ]
 },
 "custody": {
  "text": "A sofőr megadja magát, őrizetbe veszed. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 4” a többieknek, és bemondom, hogy a gyanúsítottat a legközelebbi kirendeltségre szállítom, és Investigatort kérek a kihallgatáshoz.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "A kihallgatás csak kirendeltségen lehet; a fegyházba indulást (10-15) a kihallgatás után jelzed."
   },
   {
    "id": "b",
    "text": "„10-8.”",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-8 a szolgálatba állás."
   },
   {
    "id": "c",
    "text": "„Code 4”, és egyenesen a fegyházba viszem.",
    "next": "charges",
    "points": 1,
    "verdict": "ok",
    "feedback": "A Code 4 jó, de előbb a kirendeltség: kihallgatás csak ott lehet, fegyházban nem."
   }
  ]
 },
 "charges": {
  "text": "Milyen tétel jár a menekülésért?",
  "choices": [
   {
    "id": "a",
    "text": "Rendvédelmi utasítás megszegése (RUM).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A menekülésre a rendvédelem előli menekülés (REM) a pontos tétel."
   },
   {
    "id": "b",
    "text": "Csak gondatlan vezetés, azért akartam megállítani.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A menekülés és a lövések önálló bűncselekmények."
   },
   {
    "id": "c",
    "text": "Rendvédelem előli menekülés (REM): 1 000 000 – 2 000 000 $ és 15–30 perc fegyház; a lövésekért pedig külön tételek (pl. hivatali személy elleni erőszak).",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A menekülésnek saját tétele van (REM), a rendvédelmi egységre leadott lövéseknek pedig külön."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Elfogva, szabályosan",
   "text": "Harmadik felszólítás, MDC jel, pontos rádió, sorrend, tűzparancs és Code 100: így néz ki egy szabályos üldözés."
  }
 }
}$json$::jsonb, 70, 300),
('Betörésjelzés: Code 30 vagy Code 30-Silent', 'Hangos és halk riasztás, Code 6, téves riasztás, egyedül egy betörés helyszínén, egy gyanús hívás és a Code 4.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "A rádióban: „Code 30, a Juniper Hill-i ékszerüzletben megszólalt a riasztó.” Hogyan vonulsz?",
  "choices": [
   {
    "id": "a",
    "text": "Fényhíddal és szirénával: a Code 30-nál ezeket használni kell.",
    "next": "arrive",
    "points": 2,
    "verdict": "good",
    "feedback": "Code 30: betörés folyamatban, megszólalt a riasztó, használjanak szirénát és fényhidat."
   },
   {
    "id": "b",
    "text": "Code 2-vel, a közlekedési szabályokat betartva.",
    "next": "arrive",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; egy folyamatban lévő betörés sürgős."
   },
   {
    "id": "c",
    "text": "Csendben, fényhíd nélkül, hogy meglepjem őket.",
    "next": "arrive",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az a Code 30-Silent, a halk riasztás."
   }
  ]
 },
 "arrive": {
  "text": "Megérkezel, és kiszállnál. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 6-Charles.”",
    "next": "false_alarm",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 6-Charles azt jelenti, körözött bűnöző van a helyszínen."
   },
   {
    "id": "b",
    "text": "„Code 6”: megérkeztem, és elhagyom a járművet intézkedés céljából.",
    "next": "false_alarm",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 6 jelenti, hogy az egység megérkezett, és intézkedés céljából elhagyja a járművet."
   },
   {
    "id": "c",
    "text": "„10-97.”",
    "next": "false_alarm",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az érkezést jelzi, de azt nem, hogy elhagyod a járművet; ehhez a Code 6 kell."
   }
  ]
 },
 "false_alarm": {
  "text": "Az üzlet zárva, sértetlen. A tulajdonos telefonon elmondja, hogy a raktárban felejtett macska indította be a riasztót. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, egyszerűen továbbmegyek.",
    "next": "silent",
    "points": 0,
    "verdict": "bad",
    "feedback": "A riasztás lezárását rádiózni kell, különben a többiek még úton lehetnek."
   },
   {
    "id": "b",
    "text": "„Code 12”: téves riasztás. A többi egység visszatérhet a járőrszolgálathoz.",
    "next": "silent",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 12 a hamis riasztás, téves hívás kódja."
   },
   {
    "id": "c",
    "text": "„Code 77.”",
    "next": "silent",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 77 azt jelzi, hogy csapdába akarnak csalni."
   }
  ]
 },
 "silent": {
  "text": "Egy óra múlva: „Code 30-Silent, egy Paradiso-i villában halk riasztás.” Hogyan vonulsz?",
  "choices": [
   {
    "id": "a",
    "text": "Fényhíd és sziréna nélkül: halk riasztásnál nem jelezzük az érkezést.",
    "next": "alone",
    "points": 2,
    "verdict": "good",
    "feedback": "Code 30-Silent: betörés folyamatban, halk riasztás, ne használjanak szirénát és fényhidat."
   },
   {
    "id": "b",
    "text": "Szirénával, hogy elijesszem őket.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Halk riasztásnál a sziréna figyelmeztetné a betörőket."
   },
   {
    "id": "c",
    "text": "Code 3-mal, mint mindig.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 3 szirénával jár; a halk riasztásnál ez épp a hiba."
   }
  ]
 },
 "alone": {
  "text": "Odaérsz: egy ablak betörve, bent mozgás. Egyedül vagy. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Bemegyek egyedül, mielőtt elmenekülnek.",
    "next": "secure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Életveszélyes, és a behatolás nem a te dolgod, hacsak a rangidős fel nem kér rá."
   },
   {
    "id": "b",
    "text": "„Code 4”, majd bemegyek.",
    "next": "secure",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nincs szükség erősítésre, pedig épp most van."
   },
   {
    "id": "c",
    "text": "„Code 6-Adam”: elhagyom a járművet, erősítésre van szükség. Fedezékből figyelem a kijáratokat, és várok.",
    "next": "secure",
    "points": 3,
    "verdict": "good",
    "feedback": "Egyedül ne menj be: kérj erősítést. Egy épületbe alapból a SEB hatol be, a kint lévők a terepet biztosítják."
   }
  ]
 },
 "secure": {
  "text": "Megérkezik az erősítés, a SEB átvizsgálja a villát, a betörőt elfogják. Négy egység van kint, és még kettő tart felétek. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 4-Adam.”",
    "next": "trap",
    "points": 1,
    "verdict": "ok",
    "feedback": "A Code 4-Adam is azt mondja, nem kell több erősítés, de azt jelzi, hogy az úton lévők jönnek tovább; itt nincs rájuk szükség."
   },
   {
    "id": "b",
    "text": "„Code 4”: nincs szükség további erősítésre, a többiek térjenek vissza a járőrszolgálathoz.",
    "next": "trap",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha minden kéz megvan, a Code 4 felszabadítja a még úton lévőket."
   },
   {
    "id": "c",
    "text": "„Code 99.”",
    "next": "trap",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 vészhelyzet, minden egység jöjjön: épp az ellenkezője kell."
   }
  ]
 },
 "trap": {
  "text": "Hazafelé egy hívás: valaki egy elhagyatott dokk végére hív, mert „rablást látott”. A nevét nem mondja meg, és többször is kéri, hogy egyetlen egység menjen, csendben. Mit gondolsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csapda lehet: bemondom a Code 77-et, és csak több egységgel, óvatosan megyünk ki.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 77 jelzi, hogy csapdába akarhatnak csalni; ilyenkor senki ne menjen egyedül."
   },
   {
    "id": "b",
    "text": "„Code 20”, értesítsék a médiát.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 20 a média értesítése, nem ide való."
   },
   {
    "id": "c",
    "text": "Egyedül megyek, ahogy kérte, nehogy elijesszük.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pont ezt akarja egy csapda."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Mindig a jó kóddal",
   "text": "Code 30 és 30-Silent, Code 6 és 6-Adam, Code 12, Code 4 és Code 77: a helyzethez illő kódokat használtad."
  }
 }
}$json$::jsonb, 70, 310),
('Légi támogatás: az AIR egység', 'Az Aero Bureau pilótája egy üldözésben: ki repülhet, mit rádiózol, mi a dolgod a levegőben, Los Santos légtere, vízbe ugró gyanúsított, leszállás.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "Byerly J Skylor vagy, Sergeant I., AB képesítéssel. Járőrrepülésre indulnál, amikor egy kolléga, aki még nem tette le az AB vizsgát, elkérné a helikoptert. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "Elviheti, ha egy Sergeant engedélyt ad rá.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erre nincs engedély: a feltétel a letett vizsga."
   },
   {
    "id": "b",
    "text": "„A helikoptert csak a megfelelő vizsga letételével viheted el.” A gépet én viszem.",
    "next": "patrol",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a helikoptert csak a megfelelő vizsga letételével lehet elvinni."
   },
   {
    "id": "c",
    "text": "Odaadom, csak óvatosan vezessen.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vizsga nélkül nem viheti el, kéréstől függetlenül."
   }
  ]
 },
 "patrol": {
  "text": "Felszálltál. Mit rádiózol a közös csatornán?",
  "choices": [
   {
    "id": "a",
    "text": "„6-AIR-001, 10-20: San Fierro, az egység járőrszolgálatot lát el, 10-98.”",
    "next": "pursuit",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Aero Bureau mintája: hívójel, 10-20, mit csinál az egység, és hogy riasztható."
   },
   {
    "id": "b",
    "text": "„10-10.”",
    "next": "pursuit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-10 a szolgálat leadása."
   },
   {
    "id": "c",
    "text": "„AIR felszállt.”",
    "next": "pursuit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó, hogy szóltál, de a hívójel, a 10-20 és a 10-98 is kell."
   }
  ]
 },
 "pursuit": {
  "text": "Egy földi üldözés indul Doherty felett. Csatlakozol. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 99!”",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy üldözéshez nem kell minden egység; a Code 99 vészhelyzet."
   },
   {
    "id": "b",
    "text": "„6-AIR-001, 10-20: MDC jel, 10-99, C3!”, és a gyanúsított fölé repülök.",
    "next": "role",
    "points": 2,
    "verdict": "good",
    "feedback": "Az AB mintája az üldözéshez; a C3 itt a sürgősséget jelzi, hiszen a helikopteren nincs sziréna és villogó."
   },
   {
    "id": "c",
    "text": "Semmit, a földiek úgyis látnak.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden új fejleményt rádiózni kell, a légi egység csatlakozását is."
   }
  ]
 },
 "role": {
  "text": "Mi a legfontosabb dolgod az üldözés alatt?",
  "choices": [
   {
    "id": "a",
    "text": "Leszállok előtte az úton, hogy megállítsam.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "Életveszélyes; leszállni kijelölt vagy széles, tisztás helyen lehet."
   },
   {
    "id": "b",
    "text": "A gyanúsított követése és megfigyelése, a földi egységek folyamatos tájékoztatása az irányáról és a veszélyforrásokról, és a légtér ellenőrzése.",
    "next": "border",
    "points": 3,
    "verdict": "good",
    "feedback": "Ezek az AIR egység szerepei egy üldözésben: követés, megfigyelés, tájékoztatás, veszélyforrások jelzése."
   },
   {
    "id": "c",
    "text": "A helikopterből rálövök az autóra.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autóra csak tűzparancsra lehet lőni, azt a rangidős adja ki."
   }
  ]
 },
 "border": {
  "text": "A gyanúsított átlépi a határt Los Santos felé, te követed. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megfordulok, a határon túl nem repülhetek.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "Repülhetsz, csak jelezd az LSPD-nek."
   },
   {
    "id": "b",
    "text": "Szó nélkül követem.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "A légtérbe lépést az LSPD-nek be kell jelenteni."
   },
   {
    "id": "c",
    "text": "Az LSPD-nek rádiózom: „SFSD to LSPD! Vonalban Byerly J Skylor, Sergeant I. beszél. A 6-AIR-001-es egység belép a Los Santos-i légtérbe üldözés céljából!”",
    "next": "water",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Aero Bureau tananyaga szerint a Los Santos-i légtérbe lépést (és a kilépést is) be kell jelenteni az LSPD-nek."
   }
  ]
 },
 "water": {
  "text": "A gyanúsított kiszáll, és beugrik a vízbe a kikötőnél. Mit mondasz a hangosbeszélőn (/m)?",
  "choices": [
   {
    "id": "a",
    "text": "„Álljon meg, vagy tüzet nyitunk!”",
    "next": "boat",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy úszó, fegyvertelen emberrel szemben aránytalan fenyegetés."
   },
   {
    "id": "b",
    "text": "Semmit; a földiek majd sokkolóval kiszedik.",
    "next": "boat",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vízben lévő emberre sokkolóval lőni tilos."
   },
   {
    "id": "c",
    "text": "„Itt a San Fierro Sheriff's Department Aero Bureau egysége! Felszólítom, hogy azonnal ússzon ki a legközelebbi partra, majd hasaljon a földre, és ne mozduljon!”",
    "next": "boat",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez az Aero Bureau felszólítása a vízben menekülőnek."
   }
  ]
 },
 "boat": {
  "text": "Egy földi kolléga megkérdezi, elhozhatja-e a hajót. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Igen: hajót akkor lehet elvinni, ha az üldözött személy vízben menekül, és most ez a helyzet.",
    "next": "landing",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint hajót akkor vihetsz el, ha az üldözött vízben menekül."
   },
   {
    "id": "b",
    "text": "Nem, hajót csak a SEB vihet.",
    "next": "landing",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nincs ilyen szabály; a feltétel az, hogy az üldözött vízben meneküljön."
   },
   {
    "id": "c",
    "text": "Igen, és utána a hajóval járőrözhet is egész este.",
    "next": "landing",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak a vízben menekülő üldözéséhez; járőrözni vele nem lehet."
   }
  ]
 },
 "landing": {
  "text": "A gyanúsítottat a parton elfogják. Le kellene szállnod, hogy egy kollégát a helyszínre vigyél. Hol teheted le a gépet?",
  "choices": [
   {
    "id": "a",
    "text": "Kijelölt, „H” betűvel jelölt helyen, vagy széles, tisztás terepen; szűkebb helyre csak akkor, ha az akció megköveteli.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az AB tananyaga szerint csak kijelölt vagy széles, tisztás helyre lehet leszállni, kivétel, ha az akció megköveteli."
   },
   {
    "id": "b",
    "text": "Az út közepén, a forgalomban: az a legközelebbi.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Balesetveszélyes; kijelölt vagy széles, tisztás terep kell."
   },
   {
    "id": "c",
    "text": "Bárhová, ahol elférek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem bárhová: kijelölt (H) vagy széles, tisztás terepre."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szem az égen",
   "text": "Vizsgával repültél, rádióztad a csatlakozást és a légtérbe lépést, tájékoztattad a földi egységeket, és biztonságosan szálltál le."
  }
 }
}$json$::jsonb, 70, 320),
('Gyalogos üldözés és a sokkoló', 'A gyanúsított gyalog menekül: rádió, vészhívó, mikor nem szabad sokkolót használni, eldobott fegyver, vízben menekülő, /visz.', 'arrest', 2, 'start',
 $json${
 "start": {
  "text": "Egy igazoltatásnál a gyanúsított, Jayden Cross kiugrik az autóból, és a kikötő felé fut. Egyedül vagy (LINCOLN). Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom a gyalogos üldözést, az irányt és a leírását, erősítést kérek (Code 6-Adam), és utána eredek.",
    "next": "button",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden új fejleményt rádiózni kell; a Code 6-Adam azt jelzi, hogy elhagyod a járművet, és erősítés kell."
   },
   {
    "id": "b",
    "text": "Szó nélkül utána futok.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rádió nélkül senki sem tudja, merre jársz, ha baj lesz."
   },
   {
    "id": "c",
    "text": "Beülök a kocsiba, és elmegyek, úgysem érem utol.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy menekülőt nem hagyunk: jelezd, és kérj erősítést."
   }
  ]
 },
 "button": {
  "text": "Futás közben látod, hogy a derekán valami fémes csillan. Használhatod a vészhívót?",
  "choices": [
   {
    "id": "a",
    "text": "Nem, csak lövöldözésnél szabad.",
    "next": "gun",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyalogos üldözés is ilyen eset."
   },
   {
    "id": "b",
    "text": "Igen, és minden igazoltatás elején is megnyomom, biztos, ami biztos.",
    "next": "gun",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak az említett esetekben; különben elveszti a jelentőségét."
   },
   {
    "id": "c",
    "text": "Igen: gyalogos üldözésnél, lövöldözésnél és súlyos eseteknél szabad használni, ez ilyen.",
    "next": "gun",
    "points": 2,
    "verdict": "good",
    "feedback": "A vészhívót gyalogos üldözés, lövöldözés és súlyos esetek idejére szánták."
   }
  ]
 },
 "gun": {
  "text": "Jayden megáll, pisztolyt ránt, de nem céloz rád, a móló felé hátrál. Te fedezékben vagy, van időd fegyvert váltani. A kezedben a sokkoló van. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Fegyvert váltok, és fedezékből felszólítom: éles fegyverre sokkolóval lőni tilos, és van időm váltani.",
    "next": "water",
    "points": 3,
    "verdict": "good",
    "feedback": "Sokkolóval tilos éles fegyverre lőni, kivéve, ha nincs időd átváltani, vagy IC így beszéltétek meg a társaddal a taktikát."
   },
   {
    "id": "b",
    "text": "Rálövök a sokkolóval, az a legbiztonságosabb.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "Éles fegyverrel szemben a sokkoló tilos, ha van időd fegyvert váltani."
   },
   {
    "id": "c",
    "text": "Kilépek a fedezékből, és rábeszélem, hogy tegye le.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "A beszéd jó, de fedezékből; egy fegyveres előtt kilépni életveszélyes."
   }
  ]
 },
 "water": {
  "text": "Jayden eldobja a pisztolyt, és beugrik a vízbe. Használhatod most a sokkolót?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, így gyorsan megáll.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vízben lévő emberre a sokkoló tilos: megfulladhat."
   },
   {
    "id": "b",
    "text": "Utána ugrom, és a vízben bilincselem meg.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül a vízben veszélyes; a part, az AIR és a hajó biztonságosabb."
   },
   {
    "id": "c",
    "text": "Nem: vízben lévő emberre sokkolóval lőni tilos. Rádión AIR egységet és hajót kérek, és a parton várom.",
    "next": "evidence",
    "points": 2,
    "verdict": "good",
    "feedback": "A sokkoló vízben lévő emberre tilos. Hajót akkor lehet vinni, ha az üldözött vízben menekül."
   }
  ]
 },
 "evidence": {
  "text": "Az eldobott pisztoly a mólón fekszik. Mit teszel vele?",
  "choices": [
   {
    "id": "a",
    "text": "Elteszem magamnak, jó lesz tartaléknak.",
    "next": "shore",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt fegyvert le kell adni; magadnál tartani visszaélés."
   },
   {
    "id": "b",
    "text": "A vízbe dobom, hogy senki ne használhassa.",
    "next": "shore",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez bizonyíték: megsemmisíteni bűncselekmény (célravezető bizonyíték eltitkolása)."
   },
   {
    "id": "c",
    "text": "Lefényképezem a helyszínen, rögzítem, majd lefoglalom, és leadom bizonyítékként.",
    "next": "shore",
    "points": 2,
    "verdict": "good",
    "feedback": "Egy eldobott fegyvert a helyszínen fotózunk, jegyzőkönyvbe vesszük, és a lefoglalt fegyvert le kell adni."
   }
  ]
 },
 "shore": {
  "text": "Jayden kiúszik, és a parton megadja magát. Hogyan viszed a kocsihoz?",
  "choices": [
   {
    "id": "a",
    "text": "/visz-szel futva viszem, hogy gyorsabb legyen.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos /visz-ben futni."
   },
   {
    "id": "b",
    "text": "Megbilincselem, felsorolom a jogait, és /visz-szel, sétálva kísérem a kocsihoz.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint tilos /visz-ben futni."
   },
   {
    "id": "c",
    "text": "Bilincs nélkül hagyom sétálni, elfáradt.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aki egyszer már megszökött, újra próbálkozhat."
   }
  ]
 },
 "charges": {
  "text": "Milyen tételek jönnek szóba?",
  "choices": [
   {
    "id": "a",
    "text": "Semmi, hiszen eldobta a fegyvert.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az eldobás nem teszi meg nem történtté a birtoklást és a menekülést."
   },
   {
    "id": "b",
    "text": "Fogolyszökés (FSZ).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Még nem volt fogoly: a menekülés tétele a REM."
   },
   {
    "id": "c",
    "text": "Rendvédelem előli menekülés (REM), és illegális fegyver birtoklása (IFB), ha a pisztoly nincs bejelentve az LSPD felé.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A menekülésnek saját tétele van, és a nem bejelentett fegyver akkor is illegális, ha van rá engedély."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Elfogva, épségben",
   "text": "Rádióztál, jogosan nyomtad meg a vészhívót, nem használtad a sokkolót, ahol tilos, és a fegyvert is szabályosan foglaltad le."
  }
 }
}$json$::jsonb, 70, 330),
('Fegyveres utas az igazoltatáson', 'Pisztoly egy utas derekán: higgadt utasítás, /elvesz, bejelentetlen fegyver, lefoglalás a csomagtartóból, a sofőr és az arányos erő.', 'arrest', 2, 'start',
 $json${
 "start": {
  "text": "ADAM egységben igazoltattok egy fekete Ballert. Az anyósülésen ülő férfi derékszíjában pisztoly markolata látszik. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Fegyvert rántok, és ordítva követelem, hogy szálljon ki.",
    "next": "disarm",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fenyegetés nélkül aránytalan; ezzel épp kiprovokálhatod a bajt."
   },
   {
    "id": "b",
    "text": "Nyugodt hangon felszólítom, hogy tartsa a kezét látható helyen, a társam pedig erősítést kér.",
    "next": "disarm",
    "points": 2,
    "verdict": "good",
    "feedback": "Higgadt, határozott utasítás és erősítés: a helyzet így kezelhető, kapkodás nélkül."
   },
   {
    "id": "c",
    "text": "Nem szólok, hátha nem akar bajt.",
    "next": "disarm",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy látható fegyvert nem hagyhatsz figyelmen kívül."
   }
  ]
 },
 "disarm": {
  "text": "A férfi, Darnell Hayes, a kezét a műszerfalra teszi. Hogyan veszed el a fegyvert?",
  "choices": [
   {
    "id": "a",
    "text": "Hagyom nála, amíg nem fenyeget.",
    "next": "permit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres személy fegyverét el kell venni."
   },
   {
    "id": "b",
    "text": "Megkérem, hogy adja ide a kezembe.",
    "next": "permit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabályzat szerint fegyveres személytől kizárólag /elvesz paranccsal vehető el a fegyver."
   },
   {
    "id": "c",
    "text": "Kizárólag az /elvesz [id] [fegyver] paranccsal.",
    "next": "permit",
    "points": 2,
    "verdict": "good",
    "feedback": "Fegyveres személytől kizárólag az /elvesz [id] [fegyver] parancsot szabad használni."
   }
  ]
 },
 "permit": {
  "text": "Darnellnek van fegyverviselési engedélye, de a lekérdezés szerint ez a pisztoly nincs bejelentve az LSPD felé. Mit állapítasz meg?",
  "choices": [
   {
    "id": "a",
    "text": "Illegális fegyver kereskedelem (IFK).",
    "next": "trunk",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kereskedelemre nincs utalás; a birtoklás tétele az IFB."
   },
   {
    "id": "b",
    "text": "Illegális fegyver birtoklása (IFB): akkor is illegális, ha van rá engedély, de nincs bejelentve az LSPD felé. 3 000 000 – 6 000 000 $ és 30–60 perc.",
    "next": "trunk",
    "points": 3,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint a fegyver akkor is illegális, ha van engedély, de nincs bejelentve az LSPD-nél."
   },
   {
    "id": "c",
    "text": "Rendben van, hiszen van engedélye.",
    "next": "trunk",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az engedély mellé a bejelentés is kell."
   }
  ]
 },
 "trunk": {
  "text": "Az őrizetbe vétel után a jármű átvizsgálásakor a csomagtartóban egy második fegyvert találtok. Mi lesz vele?",
  "choices": [
   {
    "id": "a",
    "text": "Lefoglalom, rögzítem bizonyítékként, és leadom: a csomagtartóból lefoglalt fegyvert le kell adni.",
    "next": "driver",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a csomagtartóból vagy széfből lefoglalt fegyvert le kell adni."
   },
   {
    "id": "b",
    "text": "Visszateszem, mert a sofőr szerint nem az övé.",
    "next": "driver",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalás nem a tulajdonoson múlik: bizonyíték, le kell adni."
   },
   {
    "id": "c",
    "text": "A szolgálati kocsiban tartom, hátha még kell.",
    "next": "driver",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt fegyvert le kell adni; a dupla nagykaliber viselése is tilos."
   }
  ]
 },
 "driver": {
  "text": "A sofőr, Kayla Hayes azt állítja, nem tudott a fegyverekről. Mit teszel vele?",
  "choices": [
   {
    "id": "a",
    "text": "Elküldöm, nem az ő ügye.",
    "next": "force",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ő autójában voltak a fegyverek: ki kell hallgatni."
   },
   {
    "id": "b",
    "text": "Őt is ellenőrzöm (10-29), és a kirendeltségen kihallgatják; hogy tudott-e róla, azt a kihallgatás dönti el.",
    "next": "force",
    "points": 2,
    "verdict": "good",
    "feedback": "Feltételezés helyett kihallgatás: így derül ki, mi a szerepe."
   },
   {
    "id": "c",
    "text": "Azonnal letartóztatom fegyverkereskedelemért.",
    "next": "force",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erre nincs bizonyíték: előbb a kihallgatás."
   }
  ]
 },
 "force": {
  "text": "A szállítás előtt Darnell hirtelen ellöki a társadat, és fegyvertelenül futni próbál. Milyen erőt alkalmazhatsz?",
  "choices": [
   {
    "id": "a",
    "text": "Lelövöm, hiszen megtámadott.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyvertelen, menekülő emberrel szemben a halálos erő aránytalan."
   },
   {
    "id": "b",
    "text": "Arányosat: a társammal lefogjuk, vagy a sokkolóval mozgásképtelenné teszem. Halálos erő nem jöhet szóba, mert nem jelent súlyos veszélyt.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A halálos erő csak akkor alkalmazható, ha a személy súlyos veszélyt jelent; egy fegyvertelen menekülőnél a tompa vagy energikus eszköz az arányos."
   },
   {
    "id": "c",
    "text": "Hagyom futni, és a rádióban leírom.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "Ne hagyd: arányos erővel megállíthatod, közben rádiózz."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Kézben tartva",
   "text": "Higgadtan vetted el a fegyvert, felismerted a bejelentetlen fegyvert, szabályosan foglaltál le, és arányos erőt alkalmaztál."
  }
 }
}$json$::jsonb, 70, 340),
('Kihallgatás a kirendeltségen', 'Két gyanúsított egy rablás után: külön választás, ki hallgathat ki, előkészítés, diktafon, tisztességes kérdezés, bírság és a cella korlátja.', 'arrest', 2, 'start',
 $json${
 "start": {
  "text": "Két gyanúsítottat hoztatok be egy benzinkútrablás után: Ray Lopezt és Tom Fishert. Mi az első teendő a kirendeltségen?",
  "choices": [
   {
    "id": "a",
    "text": "Külön választom őket: az egyiket zárkába teszem, amíg a másikat kihallgatják.",
    "next": "who",
    "points": 2,
    "verdict": "good",
    "feedback": "Több személy esetén külön kell választani őket, a többi felet zárkába kell tenni."
   },
   {
    "id": "b",
    "text": "Mindkettőt a fegyházba viszem, ott kihallgatjuk.",
    "next": "who",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen lehet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "Együtt ültetem le őket a kihallgatóban.",
    "next": "who",
    "points": 0,
    "verdict": "bad",
    "feedback": "Együtt összehangolhatják a vallomásukat."
   }
  ]
 },
 "who": {
  "text": "Corporal vagy (Field Staff). Rádión Investigatort kértél, és egy nyomozó visszaszól, hogy ráér, öt perc múlva ott lesz. Ki hallgatja ki őket?",
  "choices": [
   {
    "id": "a",
    "text": "Megvárom: ha van elérhető Investigator, csak ő hallgathatja ki a gyanúsítottakat, és át kell adnom neki őket.",
    "next": "prep",
    "points": 3,
    "verdict": "good",
    "feedback": "Ha van elérhető Investigator (aki ráér), csak ők hallgathatnak ki. Field Staff csak akkor, ha nincs."
   },
   {
    "id": "b",
    "text": "Én, hiszen Corporal vagyok.",
    "next": "prep",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rang itt nem számít: elérhető Investigator mellett neki kell átadni."
   },
   {
    "id": "c",
    "text": "Én kezdem el, és ha odaér, átadom.",
    "next": "prep",
    "points": 1,
    "verdict": "ok",
    "feedback": "Ha elérhető Investigator jön, várd meg, és add át neki."
   }
  ]
 },
 "prep": {
  "text": "Másnap éjjel egy hasonló ügyben egyetlen Investigator sincs szolgálatban, ezért te hallgatod ki Ray-t. Hogyan készíted elő?",
  "choices": [
   {
    "id": "a",
    "text": "A cellában, a rácson keresztül kérdezem.",
    "next": "record",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kihallgatás a kihallgatóban történik."
   },
   {
    "id": "b",
    "text": "Leveszem a bilincset, leültetem, és RP-ben az egyik kezét az asztalon lévő fémrúdhoz csatolom; a maszkját leveszem.",
    "next": "record",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatásnál a bilincs RP-vel a rúdon marad, a maszkot levesszük."
   },
   {
    "id": "c",
    "text": "Bilincsben, maszkban ültetem le, hadd féljen.",
    "next": "record",
    "points": 0,
    "verdict": "bad",
    "feedback": "A maszkot le kell venni, és a széken, a rúdhoz csatolva ül."
   }
  ]
 },
 "record": {
  "text": "Mivel rögzíted a kihallgatást?",
  "choices": [
   {
    "id": "a",
    "text": "Diktafonnal: így a vallomás később is visszahallgatható.",
    "next": "questions",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint kihallgatásnál diktafont alkalmazhatunk."
   },
   {
    "id": "b",
    "text": "Sehogy, emlékezni fogok rá.",
    "next": "questions",
    "points": 0,
    "verdict": "bad",
    "feedback": "Emlékezetből nincs mire hivatkozni; a diktafon IC bizonyíték."
   },
   {
    "id": "c",
    "text": "A telefonommal, és feltöltöm a frakció Discordjára.",
    "next": "questions",
    "points": 0,
    "verdict": "bad",
    "feedback": "Frakciócsoportokból információt kiadni tilos, és IC eszköz kell: a diktafon."
   }
  ]
 },
 "questions": {
  "text": "Ray hallgat. Hogyan folytatod?",
  "choices": [
   {
    "id": "a",
    "text": "Megfenyegetem, hogy ha nem beszél, megverem.",
    "next": "fine",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kényszerítés hatósági eljárásban (KHE) bűncselekmény."
   },
   {
    "id": "b",
    "text": "Higgadtan rákérdezek a tetteire, a társaira és az ellentmondásokra; a hallgatáshoz joga van, nem fenyegetem.",
    "next": "fine",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatáson megkérdőjelezzük a tetteiket, a társaikat; a hallgatás joga megilleti."
   },
   {
    "id": "c",
    "text": "Megígérem, hogy elengedem, ha beszél.",
    "next": "fine",
    "points": 0,
    "verdict": "bad",
    "feedback": "Olyat ne ígérj, amit nem tarthatsz be: a kihallgatás tisztességes kérdezés, nem alku."
   }
  ]
 },
 "fine": {
  "text": "Ray végül beismeri a rablást. Mi a sorrend a végén?",
  "choices": [
   {
    "id": "a",
    "text": "A zsákmányt nála hagyom, az már az övé.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rablás tételénél a kifosztott összeget vagy tárgyakat is el kell venni."
   },
   {
    "id": "b",
    "text": "Kiosztom a bírságot (rablás, RA: 1 000 000 – 2 000 000 $ és 30–60 perc; a zsákmányt is elvesszük), majd fegyházba szállítom, az indulást rádiózva.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatás után bírság, majd beszállítás; a rablásnál a kifosztott összeget vagy tárgyakat is el kell venni."
   },
   {
    "id": "c",
    "text": "90 percig a Department cellájában tartom.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Department celláiban legfeljebb 59 perces jail adható."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szabályos kihallgatás",
   "text": "Külön választottad őket, a megfelelő személy kérdezett, és a kihallgatás tisztességes és rögzített volt."
  }
 }
}$json$::jsonb, 70, 350),
('Lövések a garázsnál', 'Rád és a társadra lőnek: fedezék, vészhívó, Code 99, elsősegély /hp nélkül, a SEB megy előre, ki ad tűzparancsot, magánakció, ki nyomoz.', 'patrol', 2, 'start',
 $json${
 "start": {
  "text": "Társaddal (6A033) egy doherty-i garázs előtt igazoltattok, amikor lövések dördülnek, és a társad a lábán megsérül. Mit teszel azonnal?",
  "choices": [
   {
    "id": "a",
    "text": "Fedezékbe húzom magunkat, megnyomom a vészhívót, és bemondom: lövöldözés, sérült kolléga, Code 99, a pozíciónk.",
    "next": "aid",
    "points": 3,
    "verdict": "good",
    "feedback": "Lövöldözésnél szabad a vészhívó; a Code 99 vészhelyzet, minden egység reagáljon."
   },
   {
    "id": "b",
    "text": "„Code 4”, nehogy pánik legyen.",
    "next": "aid",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nem kell erősítés: épp most kell."
   },
   {
    "id": "c",
    "text": "Kiállok, és vakon visszalövök arra, amerről hallom.",
    "next": "aid",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb fedezék és segítség: vaktában lőni a civilekre is veszélyes."
   }
  ]
 },
 "aid": {
  "text": "Fedezékben vagytok. A társad vérzik. Te nem vagy SEB Medic. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Otthagyom, és megkeresem a lövőt.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sérült társad ellátása és a segítség hívása az első."
   },
   {
    "id": "b",
    "text": "Használom a /hp parancsot, gyorsabb.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A /hp csak a SEB Medicek joga."
   },
   {
    "id": "c",
    "text": "Amennyit biztonságosan tudok, ellátom (nyomókötés), és PARAMEDIC egységet kérek; a /hp parancsot nem használom.",
    "next": "seb",
    "points": 2,
    "verdict": "good",
    "feedback": "A /hp parancsot csak a SEB Medicek használhatják; más NONRP miatt szankcionálható, és kirúgással jár."
   }
  ]
 },
 "seb": {
  "text": "Megérkezik a SEB és több egység. A lövő bent van a garázsban. Mi a helyes felállás?",
  "choices": [
   {
    "id": "a",
    "text": "Mindenki egyszerre megy be.",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kaotikus és életveszélyes: a SEB megy előre."
   },
   {
    "id": "b",
    "text": "Nagyobb lövöldözésnél mindig a SEB megy előre és hatol be; mi kint biztosítjuk a terepet.",
    "next": "fire",
    "points": 2,
    "verdict": "good",
    "feedback": "Nagyobb lövöldözésnél vagy akciónál mindig a SEB megy előre; a kint lévők a terepet biztosítják."
   },
   {
    "id": "c",
    "text": "Én megyek be elsőként, mert én voltam itt előbb.",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "A behatolás a SEB dolga, a deputyk csak felkérésre."
   }
  ]
 },
 "fire": {
  "text": "Egy Deputy Sheriff III. azt kiabálja: „Tüzet nyitni!” A helyszínen egy Lieutenant is van. Ki adhat tűzparancsot?",
  "choices": [
   {
    "id": "a",
    "text": "A SEB bármelyik tagja.",
    "next": "private",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem a SEB-tagság, hanem a rangidős adja ki."
   },
   {
    "id": "b",
    "text": "Csak a rangidős, itt a Lieutenant.",
    "next": "private",
    "points": 2,
    "verdict": "good",
    "feedback": "Tűzparancsot csak a rangidős adhat ki."
   },
   {
    "id": "c",
    "text": "Bárki, aki látja a veszélyt.",
    "next": "private",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tűzparancsot csak a rangidős adhat."
   }
  ]
 },
 "private": {
  "text": "A lövő elmenekült. Egy kollégád felajánlja, hogy este, szolgálaton kívül ketten „elintézitek”. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak ha a társam is jön.",
    "next": "investigation",
    "points": 0,
    "verdict": "bad",
    "feedback": "A létszám nem teszi szabályossá a magánakciót."
   },
   {
    "id": "b",
    "text": "Benne vagyok, de csak szolgálaton kívül.",
    "next": "investigation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül is tilos az illegális tevékenység, és a magánakció is."
   },
   {
    "id": "c",
    "text": "Nemet: a magánakció szigorúan tilos, és szolgálaton kívül illegális tevékenységet sem végezhetünk; az ügyet a nyomozókra bízzuk.",
    "next": "investigation",
    "points": 2,
    "verdict": "good",
    "feedback": "Magánakciózni bárkinek szigorúan tilos."
   }
  ]
 },
 "investigation": {
  "text": "Melyik iroda vizsgálja azt a lövöldözést, amelyben a társad megsérült?",
  "choices": [
   {
    "id": "a",
    "text": "A Homicide Bureau: az osztály személyzetét érintő, sérülést okozó lövöldözések hozzá tartoznak.",
    "next": "report",
    "points": 2,
    "verdict": "good",
    "feedback": "A Homicide Bureau vizsgálja az osztály személyzetét érintő, sérülést vagy halált okozó lövöldözéseket."
   },
   {
    "id": "b",
    "text": "A Narcotics Bureau.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Narcotics a kábítószeres ügyeké."
   },
   {
    "id": "c",
    "text": "A Financial Administration Bureau.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "A FAB a vállalkozások szabályos működését ellenőrzi."
   }
  ]
 },
 "report": {
  "text": "A nap végén mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "AI-jal íratom meg, gyorsabb.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos AI-t használni; észlelés esetén arról a jelentésről megvonják a fizetést."
   },
   {
    "id": "b",
    "text": "Megírom a jelentést a fórum sablonja szerint, a saját szavaimmal, és naplózom a Jelentések oldalon.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A jelentést magad írod (AI használata tilos), és a naplózással számít a fizetésnél."
   },
   {
    "id": "c",
    "text": "Nem írok, a többiek úgyis látták.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jelentés kötelező, és a nyomozáshoz is kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Mindenki hazaért",
   "text": "Fedezék, vészhívó, Code 99, szabályos elsősegély, a SEB ment előre, a rangidős adta a tűzparancsot, és nem lett magánakció."
  }
 }
}$json$::jsonb, 70, 360),
('Banda a parkban: FI-kártya és SanGang', 'Operation Safe Streets járőr: Field Interview, mi kell a SanGang adatbázishoz, Code 6-Gang, metagaming, graffiti és az információ továbbítása.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Az Operation Safe Streets (Gang Enforcement Team) egyenruhás járőreként a Jefferson Parkban vagy. Egy fiatal férfi kék bandanában ül egy padon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Letartóztatom, mert bandásan néz ki.",
    "next": "fi",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem lehet random letartóztatni valakit azért, mert „bandásan néz ki”; a profilalkotás tilos."
   },
   {
    "id": "b",
    "text": "Semmit: a ruhája miatt senkit nem lehet megszólítani.",
    "next": "fi",
    "points": 0,
    "verdict": "bad",
    "feedback": "Megszólítani lehet: az FI nem letartóztatás, hanem adatgyűjtés."
   },
   {
    "id": "c",
    "text": "Odamegyek, udvariasan igazoltatom, és Field Interview (FI) kártyát töltök ki róla.",
    "next": "fi",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden gyanús személyről FI-kártyát kell kitölteni, hogy később adatbázisba kerüljön."
   }
  ]
 },
 "fi": {
  "text": "Mi kerül az FI-kártyára?",
  "choices": [
   {
    "id": "a",
    "text": "Csak a neve, a többi felesleges.",
    "next": "sangang",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az adatbázishoz az azonosító jegyek, a hely és az idő is kell."
   },
   {
    "id": "b",
    "text": "Név, becenév, születési idő, lakcím, telefonszám, banda-hovatartozás (ha van), azonosító jegyek, a kapcsolat helye, dátum és idő, az intézkedő neve és jelvényszáma, megjegyzések.",
    "next": "sangang",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez az OSS FI-kártyájának mintája."
   },
   {
    "id": "c",
    "text": "A gyanúm, hogy bűnöző, és egy fénykép a közösségi oldaláról.",
    "next": "sangang",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az FI tényeket rögzít, nem vélekedést."
   }
  ]
 },
 "sangang": {
  "text": "A férfi nyakán tetoválás van, és kék a ruhája. Felvehető a SanGang adatbázisba bandatagként?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a kollégám is így gondolja.",
    "next": "gang6",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem vélemény kell, hanem három azonosító jegy."
   },
   {
    "id": "b",
    "text": "Még nem: legalább három azonosító jegy kell (például tetoválás, ruházat, szimbólum, graffiti, kézjel); itt kettő van.",
    "next": "gang6",
    "points": 3,
    "verdict": "good",
    "feedback": "Bandatag csak akkor kerülhet be a SanGang rendszerbe, ha legalább három azonosító jegy van."
   },
   {
    "id": "c",
    "text": "Igen, a tetoválás egyedül is elég.",
    "next": "gang6",
    "points": 0,
    "verdict": "bad",
    "feedback": "Legalább három azonosító jegy kell."
   }
  ]
 },
 "gang6": {
  "text": "Később a park sarkán öt hasonló öltözetű férfi gyűlik össze, kézjeleket mutogatnak, kettőnél kés. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 20.”",
    "next": "mg",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 20 a média értesítése."
   },
   {
    "id": "b",
    "text": "„Code 6-Charles.”",
    "next": "mg",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 6-Charles körözött bűnözőt jelez a helyszínen."
   },
   {
    "id": "c",
    "text": "„Code 6-Gang”: csoportos bandatevékenységet észleltünk; megadom a pozíciót, és erősítést kérek.",
    "next": "mg",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 6-Gang jelzi a csoportos bandatevékenységet."
   }
  ]
 },
 "mg": {
  "text": "Egy kolléga OOC-ból tudja, hogy az egyikük egy banda vezetője, és ezt be akarja írni az aktába. Mit mondasz neki?",
  "choices": [
   {
    "id": "a",
    "text": "„Mondd be a rádióba, hogy mindenki tudja.”",
    "next": "graffiti",
    "points": 0,
    "verdict": "bad",
    "feedback": "OOC tudást IC csatornán terjeszteni szintén metagaming."
   },
   {
    "id": "b",
    "text": "„Ne metagamelj: amit OOC tudsz, azt IC-ben bizonyítani kell, mielőtt bárhová beírod.”",
    "next": "graffiti",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS tananyaga szerint ha OOC tudod, hogy ki bandatag, IC-ben bizonyíték kell; minden történésnek IC lenyomata kell."
   },
   {
    "id": "c",
    "text": "„Írd be, úgyis igaz.”",
    "next": "graffiti",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez metagaming: IC bizonyíték nélkül nem kerülhet az aktába."
   }
  ]
 },
 "graffiti": {
  "text": "Két fiatalt tetten érsz, ahogy banda-graffitit festenek egy falra. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Igazoltatom őket, FI-kártyát töltök ki róluk, fényképpel dokumentálom a graffitit, és a rongálásért felelősségre vonom őket.",
    "next": "report",
    "points": 2,
    "verdict": "good",
    "feedback": "Graffitinél FI-kártya és fotódokumentáció készül; maga a festés rongálás."
   },
   {
    "id": "b",
    "text": "Lefestetem velük a falat, és továbbmegyek.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez nem eljárás: igazoltatás, FI és dokumentáció kell."
   },
   {
    "id": "c",
    "text": "Lefényképezem a graffitit, őket pedig elengedem.",
    "next": "report",
    "points": 1,
    "verdict": "ok",
    "feedback": "A fotó jó, de FI-kártya is kell róluk, és a rongálás tétel."
   }
  ]
 },
 "report": {
  "text": "Mit kezdesz a nap végén az összegyűjtött információkkal?",
  "choices": [
   {
    "id": "a",
    "text": "Megtartom magamnak, egyszer még jól jöhet.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az információ a nyomozásé, át kell adni."
   },
   {
    "id": "b",
    "text": "Kiteszem a közösségi oldalamra, hogy a lakosság is lássa.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Frakcióinformációt kiadni tilos; a nyilvánosság a SIB dolga."
   },
   {
    "id": "c",
    "text": "Jelentést írok, és átadom a Major Crimes Bureau-nak: az OSS feladata az információk továbbítása.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS a begyűjtött információkat a Major Crimes Bureau felé adja át."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Bizonyíték, nem előítélet",
   "text": "FI-kártya, három azonosító jegy, a megfelelő kód, nincs metagaming, dokumentált graffiti és átadott információ."
  }
 }
}$json$::jsonb, 70, 370),
('Megfigyelés Code 5 alatt', 'Egy díler napi rutinjának feltérképezése: akta, civil autó, Code 5, jegyzetek, gyalogos követés, parancs kérése és a rajtaütés.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Investigator II. vagy. Egy feltételezett díler, Carlos Vega napi rutinját kell feltérképezned. Hogyan kezded?",
  "choices": [
   {
    "id": "a",
    "text": "Aktát nyitok az ügyről, és civil autóból, feltűnés nélkül figyelem és jegyzetelek.",
    "next": "code5",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden ügy megkezdésekor kötelező aktát nyitni; a megfigyelés civil autóból, jegyzeteléssel zajlik."
   },
   {
    "id": "b",
    "text": "Odamegyek, és megkérdezem, mivel foglalkozik.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel figyelmeztetnéd: a megfigyelés titkos."
   },
   {
    "id": "c",
    "text": "Jelölt járőrautóval leparkolok a háza előtt.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy jelölt autó azonnal lebuktatja a megfigyelést."
   }
  ]
 },
 "code5": {
  "text": "A megfigyelés idejére mit mondasz be a rádióban?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 5”: megfigyelés folyik, a jelölt egységek kerüljék a helyszínt; megadom a körzetet.",
    "next": "notes",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 5 jelzi, hogy megfigyelés folyik, és a jelölt egységek kerüljék a helyszínt."
   },
   {
    "id": "b",
    "text": "Semmit: minél kevesebben tudnak róla, annál jobb.",
    "next": "notes",
    "points": 0,
    "verdict": "bad",
    "feedback": "Code 5 nélkül egy arra járó jelölt egység lebuktathat."
   },
   {
    "id": "c",
    "text": "„Code 6-Charles.”",
    "next": "notes",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az körözött bűnözőt jelez a helyszínen."
   }
  ]
 },
 "notes": {
  "text": "Három estén át figyeled. Mit rögzítesz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak azt, ha bűncselekményt látok.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rutin a lényeg: a találkozók és időpontok vezetnek a bizonyítékhoz."
   },
   {
    "id": "b",
    "text": "Semmit, majd emlékszem.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jegyzet nélkül nincs jelentés és nincs parancs."
   },
   {
    "id": "c",
    "text": "Időpontokat, helyeket, kivel találkozik, milyen járművekkel, és fényképeket készítek.",
    "next": "patrol",
    "points": 2,
    "verdict": "good",
    "feedback": "A megfigyelés célja a napi rutin feltérképezése: kivel, mikor, hol."
   }
  ]
 },
 "patrol": {
  "text": "Egy jelölt járőrautó szirénával befordul Carlos utcájába egy igazoltatás miatt. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Kiszállok, és odakiabálok nekik.",
    "next": "foot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel te bukod le a megfigyelést."
   },
   {
    "id": "b",
    "text": "Rádión diszkréten emlékeztetem az egységet, hogy Code 5 van érvényben, és kerülje a helyszínt.",
    "next": "foot",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 5-öt mindenkinek tartania kell; egy rövid emlékeztető megmentheti a megfigyelést."
   },
   {
    "id": "c",
    "text": "Semmit, majd utána folytatom.",
    "next": "foot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Lehet, hogy nem lesz utána: szólj nekik."
   }
  ]
 },
 "foot": {
  "text": "Carlos gyalog indul a belvárosba. Hogyan követed?",
  "choices": [
   {
    "id": "a",
    "text": "Autóval, lassan mellette gurulva.",
    "next": "deal",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez a legfeltűnőbb módszer."
   },
   {
    "id": "b",
    "text": "Kettesben, gyalog követjük, rádión tartjuk a kapcsolatot, és fényképeket készítünk.",
    "next": "deal",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS lábmegfigyelési mintája: két deputy gyalog követ, rádión tartják a kapcsolatot, és fotóznak."
   },
   {
    "id": "c",
    "text": "Egyedül, közvetlenül mögötte.",
    "next": "deal",
    "points": 0,
    "verdict": "bad",
    "feedback": "Feltűnő, és egyedül veszélyes."
   }
  ]
 },
 "deal": {
  "text": "Egy parkolóban Carlos egy táskát ad át valakinek pénzért cserébe. Most mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Dokumentálom, és a bizonyítékokkal házkutatási parancsot kérek az aktában; rajtaütés csak parancs alapján történhet.",
    "next": "warrant",
    "points": 3,
    "verdict": "good",
    "feedback": "Minden rajtaütés és házkutatás parancs alapján történik."
   },
   {
    "id": "b",
    "text": "Azonnal letartóztatom mindkettőt, egyedül.",
    "next": "warrant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül veszélyes, és a nagyobb fogás (a raktár, a forrás) elúszik."
   },
   {
    "id": "c",
    "text": "Hívok egy járőrt, hogy igazoltassa a vevőt később.",
    "next": "warrant",
    "points": 1,
    "verdict": "ok",
    "feedback": "Lehetséges, de lebukhat a megfigyelés; előbb a parancs és a terv."
   }
  ]
 },
 "warrant": {
  "text": "Ki hagyhatja jóvá a parancskérést?",
  "choices": [
   {
    "id": "a",
    "text": "Egy jóváhagyásra jogosult (kiemelt rangú) nyomozó vagy vezető, de soha nem az, aki kérte.",
    "next": "raid",
    "points": 2,
    "verdict": "good",
    "feedback": "Az aktában a parancsot a jogosultak hagyják jóvá; a saját kérését senki sem hagyhatja jóvá."
   },
   {
    "id": "b",
    "text": "Én magam, hiszen én nyitottam az aktát.",
    "next": "raid",
    "points": 0,
    "verdict": "bad",
    "feedback": "A saját kérésedet nem hagyhatod jóvá."
   },
   {
    "id": "c",
    "text": "Bármelyik deputy.",
    "next": "raid",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak a jóváhagyásra jogosultak."
   }
  ]
 },
 "raid": {
  "text": "A parancs megvan. Hogyan zajlik a rajtaütés?",
  "choices": [
   {
    "id": "a",
    "text": "A parancs után bárhogy, minden szabad.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A parancs nem mindenre felhatalmazás: a terv és a SEB kell."
   },
   {
    "id": "b",
    "text": "Hajnalban, a SEB-bel közösen: a SEB hatol be, mi biztosítunk, a talált bizonyítékokat dokumentáljuk és lefoglaljuk.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS mintája a hajnali, SEB-bel közös rajtaütés; behatolni a SEB hatol be."
   },
   {
    "id": "c",
    "text": "Délben egyedül becsengetek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy dílerhez nem megyünk egyedül, és a behatolás a SEB dolga."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Türelem és parancs",
   "text": "Akta, Code 5, jegyzetek, kettesben követés, parancs a jogosulttól, és SEB-es rajtaütés."
  }
 }
}$json$::jsonb, 70, 380),
('Egy betörés helyszínelése', 'Akta és helyszínbiztosítás, ujjlenyomat a tananyag lépéseivel, DNS-minta, az OOC bizonyíték szabálya, telefonbemérés, járműtulajdonos, lefoglalt tárgyak.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Betörést jelentenek egy garcia-i lakásba; a tulajdonos szerint ékszereket vittek el. Investigator I. vagy. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Megvárom, amíg a tulajdonos rendet rak.",
    "next": "prints",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rendrakás eltünteti a nyomokat."
   },
   {
    "id": "b",
    "text": "Aktát nyitok az ügyről, és biztosítom a helyszínt, hogy senki ne nyúljon semmihez.",
    "next": "prints",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden ügy megkezdésekor kötelező aktát nyitni; a helyszín érintetlensége a bizonyítékok miatt kell."
   },
   {
    "id": "c",
    "text": "Körbejárom, és mindent megfogok, hogy lássam, mi hiányzik.",
    "next": "prints",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel a saját ujjlenyomatodat hagyod a bizonyítékokon."
   }
  ]
 },
 "prints": {
  "text": "Az ablakpárkányon ujjlenyomatot gyanítasz. Hogyan rögzíted?",
  "choices": [
   {
    "id": "a",
    "text": "Letörlöm, hogy jobban látsszon.",
    "next": "dna",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel megsemmisíted."
   },
   {
    "id": "b",
    "text": "UV lámpával megkeresem, óvatosan port szórok rá, ecsettel elsimítom, a fölösleget eltávolítom; átlátszó szalaggal felveszem, és sötét vagy világos papírra ragasztom.",
    "next": "dna",
    "points": 3,
    "verdict": "good",
    "feedback": "Ez a tananyag négy lépése: por és ecset, a felesleg eltávolítása, szalag, papír; utána fotózható, elemezhető."
   },
   {
    "id": "c",
    "text": "Lefotózom a telefonommal, a por felesleges.",
    "next": "dna",
    "points": 0,
    "verdict": "bad",
    "feedback": "A por és a szalag kell, hogy a minta tisztán kirajzolódjon és megőrizhető legyen."
   }
  ]
 },
 "dna": {
  "text": "Egy vércseppet találsz egy üvegszilánkon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Fültisztító pálcika vattás végével vagy vattaecsettel mintát veszek DNS-vizsgálatra.",
    "next": "ooc",
    "points": 2,
    "verdict": "good",
    "feedback": "DNS-minta nyerhető testnedvből, hajszálból; a mintavétel vattás pálcikával vagy ecsettel történik."
   },
   {
    "id": "b",
    "text": "Feltörlöm egy papírzsebkendővel.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szennyezett, használhatatlan minta lesz belőle."
   },
   {
    "id": "c",
    "text": "Hagyom, a vér nem bizonyíték.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A vér DNS-mintát ad."
   }
  ]
 },
 "ooc": {
  "text": "Az ujjlenyomat alapján egy gyanúsítottra gondolsz. Mit kell OOC is igazolni?",
  "choices": [
   {
    "id": "a",
    "text": "Hogy a személy tényleg ott járt és látható volt: OOC bizonyíték kötelező, különben az ujjlenyomatra nem lehet építeni.",
    "next": "trace",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint az ujjlenyomatnál OOC bizonyíték kötelező arról, hogy az a személy látható volt."
   },
   {
    "id": "b",
    "text": "Semmit, az IC ujjlenyomat mindent igazol.",
    "next": "trace",
    "points": 0,
    "verdict": "bad",
    "feedback": "OOC bizonyíték nélkül nem lehet rá építeni."
   },
   {
    "id": "c",
    "text": "Elég, ha a tulajdonos megnevezi.",
    "next": "trace",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy megnevezés nem bizonyítja, hogy ott járt."
   }
  ]
 },
 "trace": {
  "text": "Megvan a gyanúsított telefonszáma. Bemérheted a helyzetét?",
  "choices": [
   {
    "id": "a",
    "text": "Persze, bármikor, egy paranccsal.",
    "next": "vehicle",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak nagyon indokolt esetben, RP-vel."
   },
   {
    "id": "b",
    "text": "Csak az LSPD mérhet be telefont.",
    "next": "vehicle",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az MCB is bemérhet, a szabályok szerint."
   },
   {
    "id": "c",
    "text": "Csak nagyon indokolt esetben: legalább 10 soros előzetes RP kell hozzá, és a /try használata kötelező.",
    "next": "vehicle",
    "points": 2,
    "verdict": "good",
    "feedback": "A lenyomozás csak nagyon indokolt esetben használható, 10 soros előzetes RP-vel és /try-jal."
   }
  ]
 },
 "vehicle": {
  "text": "Egy szemtanú látta a menekülő autó rendszámát. Kié?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom a rendszámot 10-28-ra.",
    "next": "evidence",
    "points": 1,
    "verdict": "ok",
    "feedback": "Azt mutatja meg, körözik-e; a tulajdonost a /getvehowner adja."
   },
   {
    "id": "b",
    "text": "Körbekérdezem a környéken, ki ismeri.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Lassú és bizonytalan, amikor egy lekérdezés megmondja."
   },
   {
    "id": "c",
    "text": "Lekérdezem a jármű tulajdonosát (/getvehowner), és az eredményt az aktához csatolom.",
    "next": "evidence",
    "points": 2,
    "verdict": "good",
    "feedback": "A nyomozói parancsok között ott van a jármű tulajdonosának lekérdezése."
   }
  ]
 },
 "evidence": {
  "text": "Megtaláltátok az ékszereket a gyanúsítottnál. Mi a teendő velük?",
  "choices": [
   {
    "id": "a",
    "text": "Hazaviszem a szekrényembe, amíg kell.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez visszaélés: a lefoglalt tárgy helye rögzített."
   },
   {
    "id": "b",
    "text": "Lefoglalom, az aktában lefoglalt tárgyként rögzítem (az őrzési lánccal), és az ügy végén a tulajdonos visszakapja.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A lefoglalt tárgyak útját az aktában rögzítjük: így bizonyíték marad."
   },
   {
    "id": "c",
    "text": "Rögtön visszaadom a tulajdonosnak, a bizonyítéknak nem kell nyoma.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nyom nélkül az ügyben nincs bizonyíték."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Helyszínelés tankönyv szerint",
   "text": "Akta, érintetlen helyszín, szabályos ujjlenyomat és DNS, OOC bizonyíték, indokolt bemérés és rögzített lefoglalás."
  }
 }
}$json$::jsonb, 70, 390),
('Fegyverüzlet nyomában', 'Egy deputy fülébe jut egy fegyverüzlet: ki buktathat, az informátor, a szerep egy akcióban, Code 5, a kordon szabálya, a lefoglalás és a tétel.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Deputy Sheriff III. vagy, nem vagy MCB-tag. Egy ismerős a kikötőben elmondja, hogy este nyolckor fegyverüzlet lesz a 3-as raktárnál. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Este odamegyek a társammal, és lebuktatjuk.",
    "next": "informant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Sima sheriffeknek tilos buktatni; ez magánakció lenne."
   },
   {
    "id": "b",
    "text": "Szólok a barátaimnak, hogy ma este kerüljék a kikötőt.",
    "next": "informant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ügyről információt kiadni tilos; így az egész akció kiszivároghat."
   },
   {
    "id": "c",
    "text": "Jelentem az MCB-nek: fegyver- vagy drogüzlet buktatásába csak Investigator vagy leader kezdhet bele.",
    "next": "informant",
    "points": 3,
    "verdict": "good",
    "feedback": "A szabályzat szerint fegyver- vagy drogüzlet buktatásába csak Investigator vagy leader kezdhet bele; sima sheriffeknek tilos."
   }
  ]
 },
 "informant": {
  "text": "Az Investigator megkérdezi, ki mondta. Az ismerős azt kérte, maradjon titokban a neve. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elmondom az Investigatornak bizalmasan (10-35), és jelzem, hogy informátorként csak engedéllyel lehet kezelni.",
    "next": "plan",
    "points": 2,
    "verdict": "good",
    "feedback": "Informátort csak engedéllyel lehet használni, és a neve bizalmas információ."
   },
   {
    "id": "b",
    "text": "Nem mondom el, ő az én informátorom.",
    "next": "plan",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az informátorokat az MCB kezeli engedéllyel; neked a továbbítás a dolgod."
   },
   {
    "id": "c",
    "text": "Bemondom a nevét a közös rádióba.",
    "next": "plan",
    "points": 0,
    "verdict": "bad",
    "feedback": "Bizalmas információ nem mehet a közös rádióra."
   }
  ]
 },
 "plan": {
  "text": "Az Investigator tervet készít. Te mit vállalhatsz?",
  "choices": [
   {
    "id": "a",
    "text": "Beépülök vevőnek, mert ismerem a környéket.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fedett munka az MCB nyomozóinak feladata, szabályokkal."
   },
   {
    "id": "b",
    "text": "Én vezetem az akciót, hiszen én hoztam az információt.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az akciót Investigator vagy leader vezeti."
   },
   {
    "id": "c",
    "text": "Amit a terv rám bíz: például a kordont vagy egy kijárat biztosítását, a rangidős utasítása szerint.",
    "next": "code5",
    "points": 2,
    "verdict": "good",
    "feedback": "Az akciót az MCB tervezi; a deputyk a rájuk bízott feladatot látják el."
   }
  ]
 },
 "code5": {
  "text": "Este nyolc előtt mit mondanak be a nyomozók?",
  "choices": [
   {
    "id": "a",
    "text": "Code 20-at, hogy a média is ott legyen.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A média értesítése lebuktatná az akciót."
   },
   {
    "id": "b",
    "text": "Code 30-at.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 30 betörés, megszólalt riasztó."
   },
   {
    "id": "c",
    "text": "Code 5-öt: megfigyelés folyik, a jelölt egységek kerüljék a kikötőt.",
    "next": "cordon",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 5 tartja távol a jelölt egységeket a megfigyelt helyszíntől."
   }
  ]
 },
 "cordon": {
  "text": "A buktatás megkezdődik, a SEB behatol a raktárba, lövöldözés tör ki. Te egy kijáratnál állsz. Kívül egy civil autó halad el gyorsan. Lőhetsz rá, ha gyanús?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: amíg a kordon nincs lent, a civilekre tilos lőni; csak a bent lévőkre vagy a kint lövöldözőkre, tűzparancs szerint.",
    "next": "seized",
    "points": 2,
    "verdict": "good",
    "feedback": "Bevetéseknél a kordon lezárásáig tilos a civilekre lőni."
   },
   {
    "id": "b",
    "text": "Igen, ha a SEB kéri.",
    "next": "seized",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kordon szabálya mindenkire vonatkozik, a tűzparancsot pedig a rangidős adja."
   },
   {
    "id": "c",
    "text": "Igen, ha gyorsan halad.",
    "next": "seized",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyorsaság nem tesz senkit célponttá."
   }
  ]
 },
 "seized": {
  "text": "A raktárban fegyvereket és lőszert foglaltak le. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Megtartom a legjobbat a kocsimban.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt fegyvert le kell adni, a dupla nagykaliber pedig tilos."
   },
   {
    "id": "b",
    "text": "A nyomozók dokumentálják, lefoglalják, az aktához rögzítik és leadják; senki nem visz haza belőle.",
    "next": "charge",
    "points": 2,
    "verdict": "good",
    "feedback": "A lefoglalt fegyvert le kell adni, és az aktában rögzíteni."
   },
   {
    "id": "c",
    "text": "Szétosztjuk a SEB-esek között.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez visszaélés; a lefoglalt fegyvert le kell adni."
   }
  ]
 },
 "charge": {
  "text": "Az elfogott eladóra melyik tétel illik?",
  "choices": [
   {
    "id": "a",
    "text": "Csak illegális fegyver birtoklása (IFB).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az eladó nemcsak birtokolt, hanem kereskedett is."
   },
   {
    "id": "b",
    "text": "Lopás (L).",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez fegyverkereskedelem, nem lopás."
   },
   {
    "id": "c",
    "text": "Illegális fegyver kereskedelem (IFK): 4 000 000 – 8 000 000 $ és 30–60 perc; ha van engedélye, bevonják.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az eladónak a kereskedelem tétele jár; a tétel megjegyzése szerint az engedélyét be kell vonni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Csapatmunka",
   "text": "Jelentetted, megvédted az informátort, a rád bízott feladatot láttad el, és a kordon szabályát is betartottad."
  }
 }
}$json$::jsonb, 70, 400),
('FAB: a lejárt bérletű autószerviz', 'Financial Administration Bureau ügynökként: /entlist, bizonyíték, tájékoztatás, nincs halasztás, pecsét és /closecarshop, távollévő tulajdonos, jelentés, hibás parancs.', 'other', 2, 'start',
 $json${
 "start": {
  "text": "Field Agent vagy a Financial Administration Bureau-nál. Honnan tudod, mely vállalkozások működnek lejárt bérlettel?",
  "choices": [
   {
    "id": "a",
    "text": "Az /entlist parancs alapján ellenőrzöm, és képernyőképet mentek róla.",
    "next": "prepare",
    "points": 2,
    "verdict": "good",
    "feedback": "Az FAB ügynökei a bérleti határidőket az /entlist alapján figyelik, a bizonyíték képernyőkép."
   },
   {
    "id": "b",
    "text": "Véletlenszerűen végigjárom az üzleteket.",
    "next": "prepare",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az /entlist pontosan megmutatja, hol jár le a bérlet."
   },
   {
    "id": "c",
    "text": "A pletykák alapján.",
    "next": "prepare",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy zárás alapja az /entlist, nem a hallomás."
   }
  ]
 },
 "prepare": {
  "text": "Az ID12-es CarShop bérlete öt napja lejárt. Mit teszel, mielőtt odamész?",
  "choices": [
   {
    "id": "a",
    "text": "Semmit, a helyszínen majd kiderül.",
    "next": "owner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Bizonyíték nélkül nem lehet zárni."
   },
   {
    "id": "b",
    "text": "Discordon szólok a tulajdonosnak, hogy zárjon be.",
    "next": "owner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Discordon csak előzetes IC kapcsolatfelvétel után lehet egyeztetni, és a zárás az ügynök dolga."
   },
   {
    "id": "c",
    "text": "Bizonyítékot gyűjtök (képernyőkép az /entlistről), és FAB azonosítással vonulok a helyszínre.",
    "next": "owner",
    "points": 2,
    "verdict": "good",
    "feedback": "Az RP protokoll előkészülete: ellenőrzés, bizonyítékgyűjtés, vonulás FAB azonosítással."
   }
  ]
 },
 "owner": {
  "text": "A tulajdonos ott van az üzletben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megkérem, hogy fizessen nekem, és akkor nem zárok.",
    "next": "delay",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ügynök nem élhet vissza a pozíciójával: ez korrupció."
   },
   {
    "id": "b",
    "text": "Szó nélkül lezárom.",
    "next": "delay",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha jelen van, tájékoztatni kell."
   },
   {
    "id": "c",
    "text": "IC bemutatkozom, tájékoztatom a lejárt bérletről, és teret adok a szerepjátéknak.",
    "next": "delay",
    "points": 2,
    "verdict": "good",
    "feedback": "Az etikai kódex szerint a tulajdonost tájékoztatni kell, ha jelen van, és RP-szituációt kell biztosítani."
   }
  ]
 },
 "delay": {
  "text": "A tulajdonos könyörög, hogy halasszátok el egy nappal a zárást. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem lehet: a zárás nem halasztható, RP-alapú döntés és azonnali intézkedés.",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "A FAB GYIK-je szerint a zárás nem halasztható."
   },
   {
    "id": "b",
    "text": "Egy kis díjért cserébe elhalaszthatom.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez visszaélés a pozícióval, belső vizsgálat jár érte."
   },
   {
    "id": "c",
    "text": "Rendben, holnap visszajövök.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zárás nem halasztható."
   }
  ]
 },
 "close": {
  "text": "Hogyan zárod le az üzletet?",
  "choices": [
   {
    "id": "a",
    "text": "Csak kiadom a parancsot, a pecsételés felesleges.",
    "next": "absent",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RP része az eljárásnak."
   },
   {
    "id": "b",
    "text": "A tulajdonossal záratom be.",
    "next": "absent",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zárás az ügynök feladata."
   },
   {
    "id": "c",
    "text": "RP-ben lepecsételem, kiadom a /closecarshop parancsot, és képernyőképet mentek.",
    "next": "absent",
    "points": 2,
    "verdict": "good",
    "feedback": "A bezárás lépései: RP pecsételés, /closecarshop, képernyőkép."
   }
  ]
 },
 "absent": {
  "text": "Másnap egy másik lejárt üzletnél a tulajdonos nem elérhető. Lezárhatod?",
  "choices": [
   {
    "id": "a",
    "text": "Csak ha a Bureau Director is ott van.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ehhez nem kell a Director."
   },
   {
    "id": "b",
    "text": "Nem, csak a tulajdonos jelenlétében.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jogos zárásnál a jelenléte nem feltétel."
   },
   {
    "id": "c",
    "text": "Igen: ha jogos a lezárás, az RP akkor is végrehajtható, ha a tulajdonos nincs ott.",
    "next": "report",
    "points": 2,
    "verdict": "good",
    "feedback": "A GYIK szerint a tulajdonos távollétében is végrehajtható a jogos zárás."
   }
  ]
 },
 "report": {
  "text": "Mi kerül a jelentésbe?",
  "choices": [
   {
    "id": "a",
    "text": "Csak a parancsot írom le.",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sablon minden pontja kell, a mellékletekkel."
   },
   {
    "id": "b",
    "text": "A FAB sablon szerint: azonosító (FAB/DATE/####), dátum, ügynök és partnerek, a vállalkozás adatai, a megállapítás, az RP-lezárás leírása, a parancs és a képernyőképek.",
    "next": "mistake",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden zárásról jelentés készül a sablon szerint, a képernyőképeket csatolni kell."
   },
   {
    "id": "c",
    "text": "Elég, ha szólok a vezetőnek.",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden zárásról írásos jelentés kell."
   }
  ]
 },
 "mistake": {
  "text": "Rájössz, hogy rossz ID-t adtál meg, és egy rendben lévő üzletet zártál le. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorsan lezárok egy másikat is, hogy kiegyenlítsem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez újabb visszaélés lenne."
   },
   {
    "id": "b",
    "text": "Hallgatok, talán senki nem veszi észre.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Eltitkolni súlyosabb, mint hibázni."
   },
   {
    "id": "c",
    "text": "Azonnal jelzem a vezetőségnek: hibás parancs esetén belső kivizsgálás indulhat, a bizonyítékokat (képernyőképek, log) archiválni kell.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A FAB szabályai szerint hibás parancsnál belső kivizsgálás indulhat; a bizonyítékokat meg kell őrizni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szabályos zárás",
   "text": "Bizonyíték, tájékoztatás, halasztás nélkül, pecséttel és paranccsal, jelentéssel, és a hibát is vállaltad."
  }
 }
}$json$::jsonb, 70, 410),
('Felony stop: a körözött jármű', 'Körözött jármű a forgalomban: rádió menet közben, megbizonyosodás, fedezék, erősítés helye, a felszólítások sorrendje, ellenállás, utasok.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "Járőrözés közben a 10-28 egy szürke Sentinelre jelez: két napja fegyveres rablás miatt körözik, a BOLO szerint a sofőr kopasz, szakállas férfi. A volán mögött épp ilyen férfi ül, mellette valaki. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal szirénázom, és egyedül megállítom.",
    "next": "sure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres rablás gyanúsítottjánál előbb a rádió és az erősítés."
   },
   {
    "id": "b",
    "text": "Hagyom, majd az MCB elintézi.",
    "next": "sure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy körözött járművet nem engedünk el: jelezni kell, és erősítéssel megállítani."
   },
   {
    "id": "c",
    "text": "Még menet közben riasztom az egységeket: látom a feltehetőleg körözött járművet, megadom a pozíciót, és erősítést kérek.",
    "next": "sure",
    "points": 3,
    "verdict": "good",
    "feedback": "A felony stop azzal kezdődik, hogy még menet közben riasztjuk a rádióban lévő egységeket, közöljük a pozíciót, és erősítést kérünk."
   }
  ]
 },
 "sure": {
  "text": "Egy kolléga megkérdezi a rádióban, biztos-e, hogy a körözött ül a kocsiban. Miért fontos ez?",
  "choices": [
   {
    "id": "a",
    "text": "Mert a felony stopot csak akkor alkalmazzuk, ha tényleg megbizonyosodtunk arról, hogy a körözött személy ül a járműben. Itt a rendszám és a sofőr is egyezik.",
    "next": "pull",
    "points": 2,
    "verdict": "good",
    "feedback": "Felony stop csak akkor, ha biztos, hogy a körözött személy ül a gépjárműben."
   },
   {
    "id": "b",
    "text": "Nem fontos, felony stopot bármelyik gyanús autónál lehet.",
    "next": "pull",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak akkor, ha megbizonyosodtunk róla, hogy a körözött ül benne."
   },
   {
    "id": "c",
    "text": "Nem fontos, a rendszám önmagában elég.",
    "next": "pull",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy körözött autót más is vezethet: a személyről kell megbizonyosodni."
   }
  ]
 },
 "pull": {
  "text": "Felszólítod a félreállásra, a Sentinel lehúzódik. Hova állsz, és mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Mellé állok, hogy jól lássam a sofőrt.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "Mellette nincs fedezéked, és a tűzvonalba kerülsz."
   },
   {
    "id": "b",
    "text": "A jármű mögé állok, mint egy igazoltatásnál, kinyitom az ajtómat, és fedezékként használva szólítom fel a bent ülőket.",
    "next": "backup",
    "points": 2,
    "verdict": "good",
    "feedback": "A jármű mögé állunk, az ajtót kinyitjuk, és fedezékként használjuk."
   },
   {
    "id": "c",
    "text": "Kiszállok, és az ablakhoz sétálok.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres gyanúsítotthoz nem sétálunk oda: fedezékből szólítjuk ki."
   }
  ]
 },
 "backup": {
  "text": "Megérkezik az erősítés. Hova álljon?",
  "choices": [
   {
    "id": "a",
    "text": "A Sentinel elé, hogy elzárja az utat.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyanúsított elé állva tűzvonalba kerül, és fedezéke sincs."
   },
   {
    "id": "b",
    "text": "Mindig az első járőrautó mögé; ha nincs hely, akkor mellé.",
    "next": "air",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag kétszer is kiemeli: az erősítés az első járőrautó mögé áll, ha nincs hely, mellé."
   },
   {
    "id": "c",
    "text": "A Sentinel mellé, hogy két oldalról fogjuk közre.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "Keresztbe lőhetnétek egymásra; az első járőrautó mögé kell állni."
   }
  ]
 },
 "air": {
  "text": "Egy AIR egység is a helyszín fölé ér. Mit kérsz tőle?",
  "choices": [
   {
    "id": "a",
    "text": "Figyelje a gyanúsítottakat, jelezze a veszélyforrásokat (például ha az utas fegyvert vesz elő), és kövesse, ha valaki menekül.",
    "next": "cmd1",
    "points": 2,
    "verdict": "good",
    "feedback": "Felony stop során az AIR egység megfigyel, jelzi a veszélyforrásokat, kommunikál a földi egységekkel, és követi a menekülőt."
   },
   {
    "id": "b",
    "text": "Semmit, a földiek boldogulnak.",
    "next": "cmd1",
    "points": 1,
    "verdict": "ok",
    "feedback": "Boldogulnátok, de a légi megfigyelés épp ilyenkor értékes."
   },
   {
    "id": "c",
    "text": "Szálljon le az út közepén, a Sentinel mellett.",
    "next": "cmd1",
    "points": 0,
    "verdict": "bad",
    "feedback": "Leszállni csak kijelölt vagy széles, tisztás helyen lehet, és itt a levegőben hasznos."
   }
  ]
 },
 "cmd1": {
  "text": "Megkezditek a sofőr lekapcsolását. Mi az első felszólítás?",
  "choices": [
   {
    "id": "a",
    "text": "„SOFŐR! Dobja ki a kulcsot!”",
    "next": "cmd2",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a motort kell leállítania."
   },
   {
    "id": "b",
    "text": "„SOFŐR! Felszólítom arra, hogy egy lassú mozdulattal állítsa le a motort!”",
    "next": "cmd2",
    "points": 2,
    "verdict": "good",
    "feedback": "Első a motor leállítása: így nem tud elhajtani."
   },
   {
    "id": "c",
    "text": "„SOFŐR! Szálljon ki felemelt kézzel!”",
    "next": "cmd2",
    "points": 0,
    "verdict": "bad",
    "feedback": "Túl korán: előbb a motor, a kulcs és az ablak."
   }
  ]
 },
 "cmd2": {
  "text": "A motor leállt. Mi következik?",
  "choices": [
   {
    "id": "a",
    "text": "„Lassan, bal kezével húzza ki a kulcsot az önindítóból!”, majd: „Tekerje le az ablakot, és dobja ki a kocsi kulcsát!”",
    "next": "cmd3",
    "points": 2,
    "verdict": "good",
    "feedback": "Kulcs bal kézzel, ablak le, kulcs ki: ez a sorrend."
   },
   {
    "id": "b",
    "text": "„Forduljon körbe!”",
    "next": "cmd3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Még ül: előbb a kulcs és az ablak."
   },
   {
    "id": "c",
    "text": "„Nyissa ki belülről az ajtót, és szálljon ki!”",
    "next": "cmd3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ajtót majd kívülről nyitja ki, a lehúzott ablakon át; előbb a kulcs."
   }
  ]
 },
 "cmd3": {
  "text": "A kulcs a földön. Hogyan száll ki a sofőr?",
  "choices": [
   {
    "id": "a",
    "text": "„Szálljon ki felemelt kézzel, és hátráljon felém!”",
    "next": "resist",
    "points": 1,
    "verdict": "ok",
    "feedback": "Kimaradt a körbefordulás és a háttal állás."
   },
   {
    "id": "b",
    "text": "„Szálljon ki, és jöjjön ide hozzám!”",
    "next": "resist",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szembefordulva, hozzád sétálva bármikor fegyvert ránthat."
   },
   {
    "id": "c",
    "text": "„Kívülről nyissa ki az ajtót, majd felemelt kézzel szálljon ki! Forduljon körbe, és álljon nekem háttal! Hátráljon, amíg azt nem mondom: állj!”",
    "next": "resist",
    "points": 3,
    "verdict": "good",
    "feedback": "Ajtó kívülről, kiszállás felemelt kézzel, körbefordulás, háttal állás, hátrálás az „állj”-ig: ez a tananyag sorrendje."
   }
  ]
 },
 "resist": {
  "text": "A sofőr hátrálás közben megtorpan, szitkozódik, és visszafordul a kocsi felé. Mi a teendő a felony stop szabályai szerint?",
  "choices": [
   {
    "id": "a",
    "text": "Odarohanok, és a földre viszem.",
    "next": "passengers",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kilépnél a fedezékből egy fegyveres gyanúsított elé."
   },
   {
    "id": "b",
    "text": "Hagyjuk, majd megnyugszik.",
    "next": "passengers",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem hagyhatjuk: ismételd a felszólítást, és hívj felügyelőt."
   },
   {
    "id": "c",
    "text": "Fedezékből ismétlem a felszólítást, és rádión legalább egy Supervisory Staff tagot kérek a helyszínre.",
    "next": "passengers",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha a személy ellenállást tanúsít, kötelező legalább egy felügyelőt (Supervisory Staff) hívni a helyszínre."
   }
  ]
 },
 "passengers": {
  "text": "A sofőr végül engedelmeskedik, megbilincselitek. Az anyósülésen még ül valaki. Mi a következő?",
  "choices": [
   {
    "id": "a",
    "text": "Odamegyek, és kihúzom az utast a kocsiból.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az utasnál is ugyanaz az eljárás jár, fedezékből."
   },
   {
    "id": "b",
    "text": "A sofőrt ellenőrizzük és őrizetbe vesszük, majd ugyanezt az eljárást elvégezzük az utassal is.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A vezető után az esetleges utasokkal is elvégezzük ugyanazt."
   },
   {
    "id": "c",
    "text": "Az utas nem körözött, elengedjük ellenőrzés nélkül.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő is lehet fegyveres vagy tettestárs: ugyanúgy ki kell szólítani."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Tankönyvi felony stop",
   "text": "Megbizonyosodtál, rádióztál, fedezékből, erősítéssel és a felszólítások sorrendjében dolgoztál."
  }
 }
}$json$::jsonb, 70, 420),
('PIT vagy nem PIT?', 'Egy üldözés több szakaszán: mikor szabad PIT manővert alkalmazni (felszólítás, belváros, sebesség, SAHP), és hogyan.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "TSB egységként (Dodge Charger) üldözöl egy kék Sultant Downtownban. Kétszer szólítottad fel, a társad azt mondja: „Most pitelj!” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Pitelek, de csak óvatosan.",
    "next": "downtown",
    "points": 0,
    "verdict": "bad",
    "feedback": "Óvatosan sem: a harmadik felszólítás előtt nem szabad."
   },
   {
    "id": "b",
    "text": "Még nem: PIT manőver csak a harmadik felszólítás után engedélyezett.",
    "next": "downtown",
    "points": 2,
    "verdict": "good",
    "feedback": "A PIT manőver csak a harmadik felszólítás után engedélyezett, és csak ha nincs civil a közelben."
   },
   {
    "id": "c",
    "text": "Pitelek, már kétszer szóltunk.",
    "next": "downtown",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kettő nem elég: a harmadik felszólítás után lehet."
   }
  ]
 },
 "downtown": {
  "text": "Megvolt a harmadik felszólítás. Még a belvárosban vagytok, 95 km/h-val, a járdán gyalogosok sétálnak. Szabad PIT-et alkalmazni?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: forgalmas belvárosban csak 80 km/h alatt lehet, és csak ha nincs civil a közelben.",
    "next": "highway",
    "points": 3,
    "verdict": "good",
    "feedback": "Forgalmas belvárosban csak 80 km/h alatt, és csak ha nincs civil a közelben."
   },
   {
    "id": "b",
    "text": "Igen, ha a gyalogosok a járda túlsó szélén vannak.",
    "next": "highway",
    "points": 0,
    "verdict": "bad",
    "feedback": "Civil a közelben van, és 95 km/h is sok a belvárosban."
   },
   {
    "id": "c",
    "text": "Igen, a harmadik felszólítás megvolt.",
    "next": "highway",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sebesség és a civilek miatt itt tilos."
   }
  ]
 },
 "highway": {
  "text": "A Sultan kiér az autópályára, és 165 km/h-val halad; civil autó nincs a közelben. Most?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a rangidős jóváhagyja.",
    "next": "sahp",
    "points": 0,
    "verdict": "bad",
    "feedback": "150 km/h felett senki sem hagyhatja jóvá."
   },
   {
    "id": "b",
    "text": "Nem: 150 km/h felett tilos PIT manővert végrehajtani.",
    "next": "sahp",
    "points": 2,
    "verdict": "good",
    "feedback": "150 km/h felett a PIT tilos."
   },
   {
    "id": "c",
    "text": "Igen, üres az autópálya.",
    "next": "sahp",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sebesség miatt tilos: 150 km/h felett nincs PIT."
   }
  ]
 },
 "sahp": {
  "text": "Egy SAHP Corvette ér oda, elhúz melletted, és a sofőrje rádión közli, hogy ő majd pitel. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Csak 80 alatt!”",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem a sebességen múlik: SAHP egységnek egyáltalán nem szabad."
   },
   {
    "id": "b",
    "text": "„Negatív, SAHP egységnek tilos PIT manővert alkalmazni.” A PIT-et a TSB vagy a SEB egység végezheti.",
    "next": "rural",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint SAHP egységeknek tilos a PIT manőver."
   },
   {
    "id": "c",
    "text": "„10-4, rajta!”",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "SAHP egység nem pitelhet."
   }
  ]
 },
 "rural": {
  "text": "A Sultan letér egy vidéki útra, és 60 km/h-ra lassul; a harmadik felszólítás megvolt, civil nincs a közelben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nem pitelek, inkább követem tovább.",
    "next": "force",
    "points": 1,
    "verdict": "ok",
    "feedback": "Szabad lenne, és most ez lenne a biztonságos megoldás; a követés sem hiba, de elhúzza az üldözést."
   },
   {
    "id": "b",
    "text": "A Sultan oldalát lököm meg, ahol érem.",
    "next": "force",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pitelni csak az adott kocsi hátsó részét lehet."
   },
   {
    "id": "c",
    "text": "Végrehajtom a PIT-et, a Sultan hátsó részét lökve meg: minden feltétel teljesül.",
    "next": "force",
    "points": 3,
    "verdict": "good",
    "feedback": "Harmadik felszólítás, nincs civil, 150 km/h alatt, nem belváros, nem SAHP: szabad. Pitelni csak az adott jármű hátsó részét lehet."
   }
  ]
 },
 "force": {
  "text": "Egy Trainee a rádióban azt kérdezi, a PIT mikor számít halálos erőnek. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Soha, a PIT csak az autót éri.",
    "next": "after",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az autóban ember ül: 65 km/h felett halálos erőnek számít."
   },
   {
    "id": "b",
    "text": "Csak ha a kocsi felborul.",
    "next": "after",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sebesség a mérce: 65 km/h felett halálos erő."
   },
   {
    "id": "c",
    "text": "65 km/h felett a PIT halálos erőnek számít, 65 km/h alatt kevésbé halálos erőnek.",
    "next": "after",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag erőszintjei szerint a PIT 65 km/h alatt kevésbé halálos, felette halálos erőnek számít."
   }
  ]
 },
 "after": {
  "text": "A Sultan megpördül és megáll. Mi a következő?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 12.”",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 12 téves riasztás."
   },
   {
    "id": "b",
    "text": "„Code 100”, majd fedezékből kiszólítjuk a sofőrt, és őrizetbe vesszük.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 100 jelzi, hogy elfogható; egy menekülőt fedezékből szólítunk ki."
   },
   {
    "id": "c",
    "text": "Odaszaladok az ajtóhoz, és kirántom.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fedezék nélkül, egy ismeretlen helyzetben: életveszélyes."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Mindig a szabály szerint",
   "text": "Kivártad a harmadik felszólítást, figyeltél a belvárosra, a sebességre és a SAHP tilalomra, és a hátsó részt céloztad."
  }
 }
}$json$::jsonb, 70, 430),
('Szökés a fogolyszállításból', 'A fogoly elfut a szállítás közben: rádió, vészhívó, határzár, légi keresés, arányos erő, a helyes tétel és a tanulság.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "Egy elítéltet, Shane Millst viszed a fegyházba (10-15). Egy piros lámpánál kirúgja a hátsó ajtót, és bilincsben elfut. Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal bemondom a szökést, a leírását és az irányt, erősítést kérek (Code 6-Adam), és utána eredek.",
    "next": "button",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden új fejleményt rádiózni kell; egy szökés az egész állomány ügye."
   },
   {
    "id": "b",
    "text": "Szó nélkül utána futok, hogy ne derüljön ki.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Eltitkolni bűnpártolás lenne; és rádió nélkül senki sem segít."
   },
   {
    "id": "c",
    "text": "Hagyom, bilincsben úgysem jut messzire.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Bilincsben is elrejtőzhet, és veszélyes lehet."
   }
  ]
 },
 "button": {
  "text": "Gyalogos üldözés alakul ki. Megnyomod a vészhívót?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, és bemondom a Code 20-at is.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 20 a média értesítése: itt nincs rá szükség."
   },
   {
    "id": "b",
    "text": "Igen: gyalogos üldözésnél szabad használni.",
    "next": "border",
    "points": 2,
    "verdict": "good",
    "feedback": "A vészhívó gyalogos üldözésnél, lövöldözésnél és súlyos eseteknél használható."
   },
   {
    "id": "c",
    "text": "Nem, csak lövöldözésnél szabad.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyalogos üldözés is ilyen eset."
   }
  ]
 },
 "border": {
  "text": "Shane eltűnik a sikátorokban. A rangidős a fogolyszökés tételének megjegyzésére utal. Mit kell tenni?",
  "choices": [
   {
    "id": "a",
    "text": "Nem kell, hiszen bilincsben van.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bilincs nem akadály a határon: le kell zárni."
   },
   {
    "id": "b",
    "text": "A határokat le kell zárni a hajtóvadászat végéig.",
    "next": "air",
    "points": 2,
    "verdict": "good",
    "feedback": "A fogolyszökés megjegyzése szerint a határok lezárása szükséges a hajtóvadászat végéig."
   },
   {
    "id": "c",
    "text": "Semmit; ha holnap előkerül, elfogjuk.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy szökött fogolynál a hajtóvadászat azonnal indul, határzárral."
   }
  ]
 },
 "air": {
  "text": "Egy AIR egység is csatlakozik. Mit kérsz tőle?",
  "choices": [
   {
    "id": "a",
    "text": "Szálljon le a sikátorban, és fogja el.",
    "next": "capture",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szűk helyre csak akkor szállhat le, ha az akció megköveteli; a levegőből hasznosabb."
   },
   {
    "id": "b",
    "text": "Repüljön vissza, a földiek elintézik.",
    "next": "capture",
    "points": 0,
    "verdict": "bad",
    "feedback": "A légi keresés gyorsítja a hajtóvadászatot."
   },
   {
    "id": "c",
    "text": "Keresőfénnyel és hőkamerával (FLIR) keresse a sikátorokban, és folyamatosan tájékoztassa a földi egységeket.",
    "next": "capture",
    "points": 2,
    "verdict": "good",
    "feedback": "A keresőfény és a FLIR kamera épp az ilyen keresésekhez való, sötétben is."
   }
  ]
 },
 "capture": {
  "text": "Shane-t egy kerítésen átmászva elfogják. Ellenáll, de fegyvertelen. Mi a helyes?",
  "choices": [
   {
    "id": "a",
    "text": "Lelőjük, nehogy újra megszökjön.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Halálos erő csak súlyos veszély esetén jöhet szóba."
   },
   {
    "id": "b",
    "text": "Arányos erővel (lefogás, szükség esetén sokkoló) vesszük őrizetbe; halálos erőt nem alkalmazunk.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "Fegyvertelen, de ellenálló személynél a tompa vagy energikus eszköz az arányos."
   },
   {
    "id": "c",
    "text": "Megbüntetjük, hogy legközelebb ne szökjön.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "A megtorlás nem a deputy dolga: arányos erő, aztán eljárás."
   }
  ]
 },
 "charges": {
  "text": "Milyen tétel jár a szökésért?",
  "choices": [
   {
    "id": "a",
    "text": "Rendvédelem előli menekülés (REM).",
    "next": "lesson",
    "points": 0,
    "verdict": "bad",
    "feedback": "A REM a megállítás elől menekülőé; a fogolyra az FSZ vonatkozik."
   },
   {
    "id": "b",
    "text": "Fogolyszökés (FSZ): 1 000 000 – 2 000 000 $ és 30–60 perc fegyház.",
    "next": "lesson",
    "points": 2,
    "verdict": "good",
    "feedback": "Aki már fogoly, annak a fogolyszökés tétele jár."
   },
   {
    "id": "c",
    "text": "Fogolyszöktetés (FSZT).",
    "next": "lesson",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fogolyszöktetés annak a tétele, aki a szökést elősegíti."
   }
  ]
 },
 "lesson": {
  "text": "Mit csinálsz másként a következő szállításnál?",
  "choices": [
   {
    "id": "a",
    "text": "A foglyot a hátsó ülésen biztonságosan rögzítem, és veszélyes foglyot nem szállítok egyedül: kísérőt (10-14) kérek.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-14 a konvoj, kíséret kérése; egy veszélyes fogolyhoz két ember kell."
   },
   {
    "id": "b",
    "text": "Semmit, ez csak balszerencse volt.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden szökésből tanulni kell."
   },
   {
    "id": "c",
    "text": "Legközelebb a csomagtartóban viszem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Embertelen és szabálytalan."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Hajtóvadászat lezárva",
   "text": "Rádióztál, határzárat kértél, a levegőből is kerestétek, arányosan fogtátok el, és a tanulságot is levontad."
  }
 }
}$json$::jsonb, 70, 440),
('Bankrablás: a kordon', 'Code 99 egy bankból: a Deputy Sheriff I. helye, a Trainee és a széfterem, kire lehet lőni a kordon előtt, az AIR szerepe, behatolás felkérésre, a zsákmány.', 'patrol', 3, 'start',
 $json${
 "start": {
  "text": "„Code 99, bankrablás a Downtown-i bankban!” Deputy Sheriff I. vagy (6A021), a társad Trainee. Hogyan reagálsz?",
  "choices": [
   {
    "id": "a",
    "text": "„6A021 reagál a riasztásra, Code 3!” – fényhíddal és szirénával indulunk.",
    "next": "role",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 99 vészhelyzet: minden egység reagáljon; a reagálást rádiózzuk, Code 3-mal."
   },
   {
    "id": "b",
    "text": "Code 2-vel megyek, hogy ne keltsek pánikot.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; egy bankrabláshoz sürgősen kell menni."
   },
   {
    "id": "c",
    "text": "Megvárom, amíg valaki megmondja, kell-e jönnöm.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 azt jelenti: minden egység reagáljon."
   }
  ]
 },
 "role": {
  "text": "Odaértek. A rangidős kiosztja a feladatokat. Hol a helyed Deputy Sheriff I.-ként?",
  "choices": [
   {
    "id": "a",
    "text": "A SEB-bel megyek be elsőként, mert közel vagyok.",
    "next": "trainee",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nagyobb akciónál mindig a SEB megy előre; a te helyed a kordon."
   },
   {
    "id": "b",
    "text": "A kordonnál: bankrablásnál a Deputy Sheriff I.-ek a kordont állják és védik.",
    "next": "trainee",
    "points": 3,
    "verdict": "good",
    "feedback": "A szabályzat szerint bankrablásnál a Deputy Sheriff I.-ek a kordonoknál állnak és védik azt."
   },
   {
    "id": "c",
    "text": "A széfterembe megyek a túszokért.",
    "next": "trainee",
    "points": 0,
    "verdict": "bad",
    "feedback": "A behatolás a SEB dolga; a kordont kell védened."
   }
  ]
 },
 "trainee": {
  "text": "A Trainee társad be akar menni a SEB után a széfterembe, „hogy lássa”. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "„Menj, de vigyázz magadra.”",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "Trainee nem hatolhat be a széfterembe."
   },
   {
    "id": "b",
    "text": "„Nem lehet: a széfterembe Trainee nem hatolhat be.” Velem marad a kordonnál.",
    "next": "fire",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a széfterembe a Deputy Sheriff Trainee-k NEM hatolhatnak be."
   },
   {
    "id": "c",
    "text": "„Csak ha a SEB-esek nem látják.”",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiltás nem azon múlik, ki látja."
   }
  ]
 },
 "fire": {
  "text": "A rangidős tűzparancsot adott. A kordon még nem állt össze, kint civil autók és járókelők vannak. A bankból egy maszkos férfi kirohan, és a tömegbe lő. Kire lőhetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak arra, aki kint lövöldözik (és a bent lévőkre); a civilekre a kordon lezárásáig tilos lőni.",
    "next": "air",
    "points": 3,
    "verdict": "good",
    "feedback": "Amíg nincs lent a kordon, tilos a civilekre lőni: csak a bent lévőkre, vagy azokra, akik kint lövöldöznek."
   },
   {
    "id": "b",
    "text": "Bárkire, aki a bank közelében mozog.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A civilekre a kordon lezárásáig tilos lőni."
   },
   {
    "id": "c",
    "text": "Arra is, aki gyanúsan elfut a helyszínről.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy elfutó civil nem lövöldöző: rá tilos lőni."
   }
  ]
 },
 "air": {
  "text": "Egy AIR egység köröz a bank fölött. Mi a fő feladata egy bankrablásnál?",
  "choices": [
   {
    "id": "a",
    "text": "Az ellenséges mesterlövészek felderítése (szükség esetén kiiktatása), helyzetjelentés a földieknek, a légtér ellenőrzése, és a magasabb rangú parancsainak végrehajtása.",
    "next": "entry",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Aero Bureau tananyaga szerint ezek az AIR egység feladatai bankrablásnál."
   },
   {
    "id": "b",
    "text": "A sajtó tájékoztatása a levegőből.",
    "next": "entry",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtó a Sheriff's Information Bureau dolga."
   },
   {
    "id": "c",
    "text": "A menekülő autók megállítása: leszáll eléjük az úton.",
    "next": "entry",
    "points": 0,
    "verdict": "bad",
    "feedback": "Életveszélyes; a levegőből figyel és tájékoztat."
   }
  ]
 },
 "entry": {
  "text": "Kevés a SEB, ezért a rangidős SEB Operator a kordonból választ embereket a behatoláshoz, és téged is kijelöl. Mehetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, és a Trainee társamat is viszem.",
    "next": "rifle",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Trainee nem hatolhat be a széfterembe, és őt senki sem jelölte ki."
   },
   {
    "id": "b",
    "text": "Igen: ha a rangidős SEB Operator felkér, a deputyk is behatolhatnak; enélkül nem.",
    "next": "rifle",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha kevés a SEB, a rangidős SEB Operator válogatja össze a deputyk közül a csapatot."
   },
   {
    "id": "c",
    "text": "Nem, deputy soha nem hatolhat be.",
    "next": "rifle",
    "points": 0,
    "verdict": "bad",
    "feedback": "Felkérésre igen: a rangidős SEB Operator kiválaszthat."
   }
  ]
 },
 "rifle": {
  "text": "Bent egy elesett kolléga mellett ott a nagy kaliberű fegyvere, és a tiéd mellé hirtelen neked is kellene. Felveheted?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, és megtartom a szolgálat végéig.",
    "next": "loot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amint nincs rá szükség, le kell tenni."
   },
   {
    "id": "b",
    "text": "Nem, soha, még bevetésen sem.",
    "next": "loot",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bevetés kivétel, ha hirtelen szükség van rá."
   },
   {
    "id": "c",
    "text": "Most igen: bevetésen kivételesen szabad, de amint nincs rá szükség, azonnal le kell tennem, mert a dupla nagykaliber tilos.",
    "next": "loot",
    "points": 2,
    "verdict": "good",
    "feedback": "A dupla nagykaliber tilos, kivéve a bevetést, amikor hirtelen kell egy másik; utána azonnal le kell tenni."
   }
  ]
 },
 "loot": {
  "text": "A rablókat elfogtátok, a táskáikban a bank pénze. Mi lesz vele?",
  "choices": [
   {
    "id": "a",
    "text": "Náluk hagyjuk, a bank majd behajtja.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zsákmányt el kell venni."
   },
   {
    "id": "b",
    "text": "Jutalomként szétosztjuk a kordon emberei között.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez lopás és visszaélés."
   },
   {
    "id": "c",
    "text": "Elvesszük tőlük: a rablásnál a kifosztott összeget is el kell venni, és bizonyítékként leadjuk.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A rablás tételének megjegyzése szerint a kifosztott összeget vagy tárgyakat is el kell venni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "A kordon kitartott",
   "text": "A helyeden maradtál, megvédted a Trainee-t a tiltott helytől, csak a jogos célpontra lőttél, és felkérésre hatoltál be."
  }
 }
}$json$::jsonb, 70, 450),
('Fedett munka', 'Beépülés egy bandába: álnév és ideiglenes rendszám, kapcsolattartás, amit fedett munkában sem szabad, a drog utáni teendők, kimentés és átadás.', 'mcb', 3, 'start',
 $json${
 "start": {
  "text": "Investigator III. vagy, és beépülsz egy banda törzskocsmájába. Mit állítasz be indulás előtt?",
  "choices": [
   {
    "id": "a",
    "text": "Álnevet (/alnev) és ideiglenes rendszámot (/fakeplate); az álnevet kilépés előtt mindig kikapcsolom.",
    "next": "contact",
    "points": 2,
    "verdict": "good",
    "feedback": "A nyomozói parancsok közül ez a kettő kell; az álnevet kilépés előtt kötelező kikapcsolni."
   },
   {
    "id": "b",
    "text": "Semmit, a saját nevemmel megyek.",
    "next": "contact",
    "points": 0,
    "verdict": "bad",
    "feedback": "A saját neveddel azonnal lebuksz."
   },
   {
    "id": "c",
    "text": "Álnevet, és kilépéskor bekapcsolva hagyom, hogy holnap is meglegyen.",
    "next": "contact",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kilépés előtt az álnevet kötelező kikapcsolni."
   }
  ]
 },
 "contact": {
  "text": "Hogyan tartod a kapcsolatot a csapatoddal?",
  "choices": [
   {
    "id": "a",
    "text": "Naponta a közös rádión beszámolok.",
    "next": "crime",
    "points": 0,
    "verdict": "bad",
    "feedback": "A közös rádió lebuktatna; a kapcsolattartónak kell jelenteni."
   },
   {
    "id": "b",
    "text": "Hetente jelentek a kapcsolattartómnak, nemcsak a nyomozás haladásáról, hanem a saját állapotomról is.",
    "next": "crime",
    "points": 2,
    "verdict": "good",
    "feedback": "Fedett munkában hetente jelenteni kell a kapcsolattartónak, a nyomozó saját állapotáról is."
   },
   {
    "id": "c",
    "text": "Csak az akció végén jelentkezem.",
    "next": "contact_late",
    "points": 0,
    "verdict": "bad",
    "feedback": "Hetente jelenteni kell, különben senki sem tudja, bajban vagy-e."
   }
  ]
 },
 "contact_late": {
  "text": "A kapcsolattartód két hétig nem hall felőled, ezért aggódva keresni kezd, és majdnem lebuktat. Mit teszel most?",
  "choices": [
   {
    "id": "a",
    "text": "Továbbra sem jelentkezem, majd a végén.",
    "next": "crime",
    "points": 0,
    "verdict": "bad",
    "feedback": "A heti jelentés kötelező: a saját biztonságod múlik rajta."
   },
   {
    "id": "b",
    "text": "Felveszem vele a kapcsolatot, és onnantól hetente jelentek.",
    "next": "crime",
    "points": 1,
    "verdict": "good",
    "feedback": "Későn, de helyrehoztad: a heti jelentés kötelező."
   }
  ]
 },
 "crime": {
  "text": "A banda azt kéri, bizonyításként segíts kirabolni egy boltot. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nemet mondok egy hihető kifogással: fedett munkában sem követhetek el köztörvényes bűncselekményt.",
    "next": "drugs",
    "points": 3,
    "verdict": "good",
    "feedback": "Beépülés alatt elkerülhetetlen lehet szabályok megszegése, de köztörvényes bűncselekményt semmilyen körülmények között nem követhetsz el."
   },
   {
    "id": "b",
    "text": "Segítek, de utána jelentem.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rablás köztörvényes bűncselekmény: utólagos jelentés sem teszi megengedetté."
   },
   {
    "id": "c",
    "text": "Segítek, hiszen fedett munkában minden megengedett.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "Köztörvényes bűncselekményt fedett munkában sem követhetsz el."
   }
  ]
 },
 "drugs": {
  "text": "Egy másik este a vezető ragaszkodik hozzá, hogy kipróbáld a drogjukat, különben lebuksz. Végül meg kell tenned. Mi a teendő utána?",
  "choices": [
   {
    "id": "a",
    "text": "Ezentúl szolgálatban is használhatom, ha a fedett munka része.",
    "next": "danger",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban tilos bármilyen tudatmódosító szer."
   },
   {
    "id": "b",
    "text": "Senkinek nem szólok, egyszer volt.",
    "next": "danger",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jelenteni kell: a visszatérés feltétele a vizsgálat."
   },
   {
    "id": "c",
    "text": "Az eset után jelentem; a visszatéréshez pszichiátriai vizsgálaton esek át, és fél évig kéthetente drogvizsgálatra járok, szúrópróbákkal is.",
    "next": "danger",
    "points": 3,
    "verdict": "good",
    "feedback": "Ha a beépülés során drogot kellett használni, azt jelenteni kell; utána pszichiátriai vizsgálat és fél évig kéthetente drogvizsgálat jár."
   }
  ]
 },
 "danger": {
  "text": "A banda gyanakodni kezd, egyikük fegyvert fog rád a hátsó szobában. Mit tehetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Felfedem magam, és egyedül letartóztatom mindet.",
    "next": "handover",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül egy bandával szemben: életveszélyes, és az ügy is elveszhet."
   },
   {
    "id": "b",
    "text": "Kitartok, egy nyomozó nem adja fel.",
    "next": "handover",
    "points": 0,
    "verdict": "bad",
    "feedback": "A testi épséged veszélyeztetése a megszakítás egyik oka."
   },
   {
    "id": "c",
    "text": "A beépülés bármikor megszakítható: a kapcsolattartómon keresztül kimentést kérek, mert a testi épségem veszélyben van.",
    "next": "handover",
    "points": 2,
    "verdict": "good",
    "feedback": "A beépülés megszakítható felső utasításra, saját kérésre vagy a testi épség veszélyeztetése esetén."
   }
  ]
 },
 "handover": {
  "text": "Kimentettek. Mit adsz át?",
  "choices": [
   {
    "id": "a",
    "text": "Mindent elmondok egy újságírónak, hogy lássák, milyen jól dolgozunk.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ügyről információt kiadni tilos; a sajtó a SIB dolga."
   },
   {
    "id": "b",
    "text": "Részletes jelentést írok az aktába a megfigyeléseimről; a letartóztatások parancs alapján, tervezetten történnek.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A fedett munka eredménye a dokumentált információ; a rajtaütés és a letartóztatás parancs alapján jön."
   },
   {
    "id": "c",
    "text": "Megtartom magamnak, hátha visszamegyek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az információ az ügyé: át kell adni."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Épen vissza",
   "text": "Álnév, heti jelentés, nemet mondtál a bűncselekményre, jelentetted a drogot, időben kértél kimentést, és átadtad az információt."
  }
 }
}$json$::jsonb, 70, 460),
('Túsztárgyalás a benzinkúton', 'A Crisis Negotiation Team egy túszhelyzetben: a deputyk dolga, a szerepek, az első kapcsolatfelvétel, követelések, hírszerzés, csere, a SEB és a sajtó.', 'mcb', 3, 'start',
 $json${
 "start": {
  "text": "Egy fegyveres férfi túszokat ejtett egy benzinkúton. Az első egységek kint vannak. Mit tesznek a deputyk?",
  "choices": [
   {
    "id": "a",
    "text": "Lezárják a környéket, biztosítják a kordont, és megvárják a Crisis Negotiation Teamet és a SEB-et; senki nem megy be.",
    "next": "roles",
    "points": 2,
    "verdict": "good",
    "feedback": "A behatolás a SEB-é, a tárgyalás a CNT-é; a kint lévők a terepet biztosítják."
   },
   {
    "id": "b",
    "text": "Az első egység azonnal behatol.",
    "next": "roles",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy túszhelyzetben a kapkodás életekbe kerülhet: a SEB hatol be, parancsra."
   },
   {
    "id": "c",
    "text": "Mindenki a bejárathoz áll, hogy lássák az erőt.",
    "next": "roles",
    "points": 0,
    "verdict": "bad",
    "feedback": "A túszejtőt ez csak feszültebbé teszi."
   }
  ]
 },
 "roles": {
  "text": "Megérkezik a CNT. Ki választja ki a tárgyalási pont helyét, és osztja ki a tárgyalók feladatait?",
  "choices": [
   {
    "id": "a",
    "text": "A Team Leader (csapatvezető).",
    "next": "primary",
    "points": 2,
    "verdict": "good",
    "feedback": "A Team Leader választja ki a tárgyalási központ helyét, és osztja ki a feladatokat."
   },
   {
    "id": "b",
    "text": "A Primary Negotiator.",
    "next": "primary",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő vezeti a tárgyalást, nem ő szervezi a csapatot."
   },
   {
    "id": "c",
    "text": "Az Intelligence Officer.",
    "next": "primary",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő információt gyűjt és elemez."
   }
  ]
 },
 "primary": {
  "text": "Te vagy a Primary Negotiator. Felveszed a kapcsolatot. Hogyan kezded?",
  "choices": [
   {
    "id": "a",
    "text": "Ultimátumot adok: két perc, és jön a SEB.",
    "next": "demands",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ultimátum sarokba szorítja, és a túszok kerülnek veszélybe."
   },
   {
    "id": "b",
    "text": "Megfenyegetem, hogy a SEB mindjárt bemegy, ha nem adja fel.",
    "next": "demands",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fenyegetés eszkalál; a cél a de-eszkaláció."
   },
   {
    "id": "c",
    "text": "Nyugodt hangon bemutatkozom, aktívan meghallgatom, mit akar, és empátiát mutatok: a cél a feszültség csökkentése.",
    "next": "demands",
    "points": 3,
    "verdict": "good",
    "feedback": "A CNT kommunikációs stratégiája: empátia, aktív hallgatás, nyugodt beszédstílus."
   }
  ]
 },
 "demands": {
  "text": "Azt követeli, hogy hozzatok egy autót teli tankkal, és engedjétek el. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem ígérek olyat, amit nem tarthatok be, és nem hazudok neki; tovább beszélgetek vele, és apró, teljesíthető lépésekben próbálok megegyezni (például egy túsz elengedéséről).",
    "next": "intel",
    "points": 2,
    "verdict": "good",
    "feedback": "A CNT etikai kódexe szerint el kell kerülni a megtévesztést és a manipulációt; az őszinteség és az integritás az alap."
   },
   {
    "id": "b",
    "text": "Azonnal elutasítom, és leteszem a telefont.",
    "next": "intel",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kapcsolat fenntartása a CNT első feladata."
   },
   {
    "id": "c",
    "text": "Megígérem az autót, úgysem kapja meg.",
    "next": "intel",
    "points": 0,
    "verdict": "bad",
    "feedback": "A megtévesztést a CNT etikai kódexe tiltja, és ha kiderül, a bizalom elveszik."
   }
  ]
 },
 "intel": {
  "text": "Ki gyűjt közben információt a túszejtőről és a túszokról?",
  "choices": [
   {
    "id": "a",
    "text": "A sajtó.",
    "next": "secondary",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtó nem a CNT része."
   },
   {
    "id": "b",
    "text": "Az Intelligence Officer: elemzi és megosztja a csapattal.",
    "next": "secondary",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Intelligence Officer gyűjti, elemzi és osztja meg a hírszerzési adatokat."
   },
   {
    "id": "c",
    "text": "Senki, nincs rá idő.",
    "next": "secondary",
    "points": 0,
    "verdict": "bad",
    "feedback": "A túszejtő motivációinak megértése nélkül nincs jó tárgyalási stratégia."
   }
  ]
 },
 "secondary": {
  "text": "Órák óta tárgyalsz, és elfáradtál. Mi a megoldás?",
  "choices": [
   {
    "id": "a",
    "text": "Átadom a telefont a SEB parancsnokának.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tárgyalás a CNT-é; a SEB parancsnoka a taktikát irányítja."
   },
   {
    "id": "b",
    "text": "A Secondary Negotiator átveszi: ő a fő tárgyaló támogatója, és szükség esetén a helyettese.",
    "next": "seb",
    "points": 2,
    "verdict": "good",
    "feedback": "A Secondary Negotiator támogat, közvetít, és szükség esetén helyettesíti a fő tárgyalót."
   },
   {
    "id": "c",
    "text": "Folytatom, nehogy a csere megzavarja.",
    "next": "seb",
    "points": 1,
    "verdict": "ok",
    "feedback": "Kitartó, de a fáradtság hibákhoz vezet; erre van a Secondary Negotiator."
   }
  ]
 },
 "seb": {
  "text": "A túszejtő egy túszt fenyeget. A SEB parancsnoka (SWT Commander) behatolást mérlegel. Mi a CNT szerepe?",
  "choices": [
   {
    "id": "a",
    "text": "A CNT egyedül dönti el, mikor megy be a SEB.",
    "next": "media",
    "points": 0,
    "verdict": "bad",
    "feedback": "A műveletet az akcióparancsnok irányítja, a CNT tanácsot ad."
   },
   {
    "id": "b",
    "text": "A CNT nem szólhat bele a SEB döntésébe.",
    "next": "media",
    "points": 0,
    "verdict": "bad",
    "feedback": "A két csapat folyamatos információcserében dolgozik."
   },
   {
    "id": "c",
    "text": "A Team Coordinator tanácsot ad az Incident Commandernek és a SEB parancsnokának; a két csapat folyamatosan egyeztet, és a túszok biztonsága az első.",
    "next": "media",
    "points": 2,
    "verdict": "good",
    "feedback": "A Team Coordinator az Incident Commander és a SEB parancsnokának tanácsadója; a közös cél a túszok biztonsága."
   }
  ]
 },
 "media": {
  "text": "Újságírók jelennek meg, és a kordonnál kérdezgetik a deputykat. Mit mondanak nekik?",
  "choices": [
   {
    "id": "a",
    "text": "Semmilyen részletet; a sajtót a Sheriff's Information Bureau tájékoztatja.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tájékoztatás a SIB dolga; a helyszíni részletek a túszok életét is veszélyeztethetik."
   },
   {
    "id": "b",
    "text": "Kiteszik a frakció csoportjába, hogy mindenki tudja.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Frakciócsoportokból információt kiadni tilos."
   },
   {
    "id": "c",
    "text": "Elmondják, hány túsz van, és hol vannak.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha a túszejtő hallja vagy olvassa, a túszok kerülnek veszélybe."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Mindenki életben",
   "text": "A kordon tartott, a CNT a szerepei szerint dolgozott, őszintén tárgyaltál, és a SEB-bel egyeztetve a túszok kerültek az első helyre."
  }
 }
}$json$::jsonb, 70, 470),
('Sebesült kolléga: Medic ellátás', 'SEB Medicként egy bevetésen: lőtt seb, pulzusértékek, morfium és adrenalin, szívmegállás, sebvarrás vagy kivonás, a /hp és a /me–/do helyes írása.', 'other', 3, 'start',
 $json${
 "start": {
  "text": "SEB Medic vagy egy bevetésen. Egy Operator lövést kapott a combjába, erősen vérzik. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Egy általános kötést teszek rá, az elég.",
    "next": "pulse",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erős vérzésnél a QuikClot és a nyomókötés kell; az általános kötés kevés."
   },
   {
    "id": "b",
    "text": "Morfiumot adok, hogy ne fájjon; a kötés ráér.",
    "next": "pulse",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a vérzéscsillapítás: a vérveszteség a legnagyobb veszély."
   },
   {
    "id": "c",
    "text": "Ha lehetséges, érszorítót (tourniquet) teszek fel, majd QuikClotot és nyomókötést; utána érzéstelenítek (lidokain).",
    "next": "pulse",
    "points": 3,
    "verdict": "good",
    "feedback": "Lőtt sebnél a tananyag szerint: ha lehetséges tourniquet, QuikClot, nyomókötés, érzéstelenítés."
   }
  ]
 },
 "pulse": {
  "text": "Megméred a pulzusát. A /do szerint: 128 bpm, és erős fájdalmai vannak. Mit jelent ez, és mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Szívmegállás közelében van, szívmasszázs kell.",
    "next": "low",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szívmegállásról 20 bpm alatt beszélünk."
   },
   {
    "id": "b",
    "text": "Magas érték (120 fölött). A fájdalomra morfium adható: 30–40 bpm-mel csökkenti a pulzust, magas pulzusnál ez biztonságos.",
    "next": "low",
    "points": 2,
    "verdict": "good",
    "feedback": "Értékek: 45 és alatta alacsony, 46–119 normál, 120 és fölötte magas. A morfium 30–40 bpm-mel csökkenti a pulzust."
   },
   {
    "id": "c",
    "text": "Normál érték, nincs teendő.",
    "next": "low",
    "points": 0,
    "verdict": "bad",
    "feedback": "120 fölött magas, és erős fájdalmai vannak."
   }
  ]
 },
 "low": {
  "text": "Egy másik sebesült pulzusa 42 bpm, és ő is erősen fájlalja a sebét. Mit adhatsz neki?",
  "choices": [
   {
    "id": "a",
    "text": "Morfiumot, a pulzus nem számít.",
    "next": "overdose",
    "points": 0,
    "verdict": "bad",
    "feedback": "A pulzus nagyon is számít: alacsony értéknél a morfium veszélyes."
   },
   {
    "id": "b",
    "text": "Morfiumot csak adrenalinnal együtt: utána adott adrenalinnal a pulzus a biztonságos 60–100-as tartományban marad; magában a morfium eszméletvesztést okozhat.",
    "next": "overdose",
    "points": 3,
    "verdict": "good",
    "feedback": "Alacsony pulzusnál a morfium miatt a sebesült elveszítheti az eszméletét; a morfium utáni adrenalin a 60–100-as tartományban stabilizál."
   },
   {
    "id": "c",
    "text": "Dupla adag morfiumot, hogy gyorsan hasson.",
    "next": "overdose",
    "points": 0,
    "verdict": "bad",
    "feedback": "Alacsony pulzusnál ez kómához, halálhoz vezethet."
   }
  ]
 },
 "overdose": {
  "text": "Egy kolléga azt javasolja, adj a sebesültnek három adrenalint egymás után, „hogy biztos legyen”. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: két-három egymást követő adrenalin túladagolás, a szív sokkot kaphat és megállhat.",
    "next": "arrest",
    "points": 2,
    "verdict": "good",
    "feedback": "Az adrenalinnal is lehet túladagolni: két-három egymást követő beadás szívmegálláshoz vezethet."
   },
   {
    "id": "b",
    "text": "Jó ötlet, minél több, annál jobb.",
    "next": "arrest",
    "points": 0,
    "verdict": "bad",
    "feedback": "Túladagolás: a szív megállhat."
   },
   {
    "id": "c",
    "text": "Adrenalin helyett lidokaint adok, az is emeli a pulzust.",
    "next": "arrest",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lidokain helyi érzéstelenítő, nem emeli a pulzust."
   }
  ]
 },
 "arrest": {
  "text": "Az egyik sebesült pulzusa 18 bpm-re esik. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Megvárom, hátha magától javul.",
    "next": "suture",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szívmegállásnál minden másodperc számít."
   },
   {
    "id": "b",
    "text": "Morfiumot adok.",
    "next": "suture",
    "points": 0,
    "verdict": "bad",
    "feedback": "A morfium tovább csökkentené a pulzust."
   },
   {
    "id": "c",
    "text": "Szívmegállás (20 bpm alatt): azonnal szívmasszázst kezdek, és adrenalint adok be.",
    "next": "suture",
    "points": 3,
    "verdict": "good",
    "feedback": "20 bpm alatt szívmegállás: azonnali szívmasszázs és adrenalin."
   }
  ]
 },
 "suture": {
  "text": "A combseb bekötözve, de a harc folytatódik. Mit teszel a sebbel?",
  "choices": [
   {
    "id": "a",
    "text": "Ha van rá idő, összevarrom (sebet csak szanitéc vagy mentőorvos varrhat); ha nincs, azonnali kivonást kérek, mert vérző sebbel nem lehet harcolni.",
    "next": "hp",
    "points": 2,
    "verdict": "good",
    "feedback": "A be nem varrt seb nagy eséllyel újra megnyílik; ha nincs idő varrni, azonnali kivonás kell."
   },
   {
    "id": "b",
    "text": "Visszaküldöm harcolni, a kötés kitart.",
    "next": "hp",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bekötözött, de össze nem varrt seb újra vérezhet."
   },
   {
    "id": "c",
    "text": "Egy másik Operator varrja össze, ő is tudja.",
    "next": "hp",
    "points": 0,
    "verdict": "bad",
    "feedback": "Sebet csak a szanitéc vagy a mentőorvos varrhat."
   }
  ]
 },
 "hp": {
  "text": "Egy nem Medic deputy azt kérdezi, használhatja-e a /hp parancsot, mert sietni kell. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: a /hp parancsot csak a SEB Medicek használhatják; másnak NONRP miatt szankcionálható, és kirúgással jár.",
    "next": "rp",
    "points": 2,
    "verdict": "good",
    "feedback": "A /hp a SEB Medicek (szanitéc részleg) parancsa."
   },
   {
    "id": "b",
    "text": "Igen, ha előtte /me-vel leírja.",
    "next": "rp",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RP nem teszi jogosulttá."
   },
   {
    "id": "c",
    "text": "Igen, vészhelyzetben bárki.",
    "next": "rp",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vészhelyzetben sem: csak a SEB Medic."
   }
  ]
 },
 "rp": {
  "text": "Hogyan írod le a pulzusmérést RP-ben?",
  "choices": [
   {
    "id": "a",
    "text": "Csak /do-val, a /me felesleges.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A cselekvés /me, az állapot /do."
   },
   {
    "id": "b",
    "text": "„/me Ellenőrzi a pulzusát” és „/do pulzusa magas”.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: a /me kisbetűvel, a /do nagybetűvel kezdődik, és írásjel is kell."
   },
   {
    "id": "c",
    "text": "„/me ellenőrzi a sebesült pulzusát.” kisbetűvel, a sebesült pedig: „/do Pulzusa magas.” nagybetűvel.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a /do-kat nagybetűvel, a /me-ket kisbetűvel kell kezdeni, és minden mondat végére írásjel kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Stabil állapot",
   "text": "Vérzéscsillapítás, pulzus szerinti gyógyszerelés, szívmegállás kezelése, varrás vagy kivonás, és helyes RP."
  }
 }
}$json$::jsonb, 70, 480)
) as v(title, summary, category, difficulty, start_node, nodes, pass_percent, sort_order)
where not exists (select 1 from public.practice_scenarios p where p.title = v.title);

do $do$
declare
  _row record;
  _problem text;
begin
  for _row in select id, title, nodes, start_node from public.practice_scenarios where max_score = 0 loop
    _problem := private.scenario_problem(_row.nodes, _row.start_node);
    if _problem is not null then raise exception '%: %', _row.title, _problem; end if;
  end loop;
end;
$do$;

update public.practice_scenarios set max_score = (private.scenario_analyse(nodes, start_node)).max_score where max_score = 0;
