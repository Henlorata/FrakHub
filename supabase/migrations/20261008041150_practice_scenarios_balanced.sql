-- =============================================================================
-- The practice scenarios, rewritten so the right answer cannot be guessed from its looks, then
-- published (the members' reviews: the two samples could be passed without reading, by always
-- picking the longest, most detailed answer, which was also always the first).
--
-- Every step's answers now have about the same length and detail; the wrong ones differ by a
-- concrete mistake (a wrong code, order, limit, rank or penal item), and the order is shuffled.
-- Over the 41 scenarios the right answer is the longest about as often as chance.
-- The steps, points and endings stay: the 39 of 20261008031458 (still hidden, nobody had played
-- them) and the two published samples (their results stay; only the texts and the order change).
-- Publishing certifies those who already passed a hidden one (private.on_scenario_published).
-- Data only; compatible with the deployed frontend.
-- =============================================================================

update public.practice_scenarios p set
  summary = v.summary, category = v.category, difficulty = v.difficulty, start_node = v.start_node,
  nodes = v.nodes, sort_order = v.sort_order, updated_at = now()
from (values
('Minta: Közúti ellenőrzés', 'Egy szabálysértő megállításától az intézkedésig: rádió, megközelítés, arányosság.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "Járőrözés közben egy szürke Sultan áthajt előtted a piroson. Mit teszel először?",
  "choices": [
   {
    "id": "a",
    "text": "Megcélzom, szirénát kapcsolok, és elé vágok, hogy biztosan és gyorsan megálljon.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Veszélyes manőver: balesetet okozhatsz, és a sofőr is pánikba eshet."
   },
   {
    "id": "b",
    "text": "Megcélzom, szirénát kapcsolok, felszólítom a félreállásra, és mögé húzódom.",
    "next": "radio",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag sorrendje: megcélzás, sziréna, felszólítás, félrehúzódás a jármű mögé; a tilos jelzésen áthaladás (TJVÁ) valós indok."
   },
   {
    "id": "c",
    "text": "Hagyom: a piroson áthaladás csak figyelmeztetést ér, nem kell megállítani.",
    "next": "missed",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tilos jelzésen való áthaladás bírsággal sújtható szabálysértés (TJVÁ); kezelni kell."
   }
  ]
 },
 "radio": {
  "text": "A jármű lehúzódik. Mielőtt kiszállsz, mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 3” a helyszínre, majd Code 6-tal jelzem, hogy kiszállok intézkedni.",
    "next": "approach",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 3 sürgős vonulást jelent, nem intézkedést; a jármű ellenőrzése a 10-28."
   },
   {
    "id": "b",
    "text": "„10-28” a rendszámra, majd Code 6-tal jelzem, hogy kiszállok intézkedni.",
    "next": "approach",
    "points": 2,
    "verdict": "good",
    "feedback": "Előbb a jármű ellenőrzése (10-28), aztán a kiszállás jelzése (Code 6)."
   },
   {
    "id": "c",
    "text": "„10-29” a rendszámra, majd Code 4-gyel jelzem, hogy kiszállok intézkedni.",
    "next": "approach",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-29 a személyt ellenőrzi, a járművet a 10-28; a Code 4 pedig azt jelenti, nem kell erősítés."
   }
  ]
 },
 "approach": {
  "text": "A sofőr idegesen keresgél a kesztyűtartóban. Hogyan közelítesz?",
  "choices": [
   {
    "id": "a",
    "text": "Egyenesen az ablakhoz sétálok, és megvárom, amíg megtalálja, amit keres.",
    "next": "check",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha fegyvert keres, késő lesz: lásd a kezét, és ne állj a forgalomban."
   },
   {
    "id": "b",
    "text": "Fegyvert rántok, és hangosan, ordítva követelem, hogy azonnal szálljon ki.",
    "next": "check",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aránytalan: nincs közvetlen fenyegetés."
   },
   {
    "id": "c",
    "text": "A jármű hátsó sarka felől közelítek, és megkérem, hogy tegye mindkét kezét a kormányra.",
    "next": "check",
    "points": 2,
    "verdict": "good",
    "feedback": "Biztonságos: látod a kezét, és nem állsz a forgalomban."
   }
  ]
 },
 "check": {
  "text": "Igazoltatod. A 10-29 szerint a sofőr nem körözött, de nincs nála jogosítvány. Mi a helyes?",
  "choices": [
   {
    "id": "a",
    "text": "Letartóztatom és bekísérem, mert jogosítvány nélkül vezetni bűncselekménynek számít.",
    "next": "ok_end",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aránytalan: a jogosítvány hiánya bírsággal sújtható szabálysértés."
   },
   {
    "id": "b",
    "text": "Megnézem a tételt a Kalkulátorban, kiszabom a bírságot, és elmagyarázom a döntést.",
    "next": "good_end",
    "points": 3,
    "verdict": "good",
    "feedback": "Arányos és átlátható intézkedés: a jogosítvány hiánya ENV/I."
   },
   {
    "id": "c",
    "text": "Szóban figyelmeztetem, rögzítem a jelentésben, és utána elengedem, hogy vezessen tovább.",
    "next": "ok_end",
    "points": 1,
    "verdict": "ok",
    "feedback": "Mérlegelhető lenne, de jogosítvány nélkül nem vezethet tovább, és a tétel (ENV/I.) jár."
   }
  ]
 },
 "good_end": {
  "end": {
   "title": "Szép munka!",
   "text": "Biztonságos, szabályos ellenőrzés: rádió, óvatos megközelítés, arányos intézkedés."
  }
 },
 "ok_end": {
  "end": {
   "title": "Lezárva",
   "text": "Az ellenőrzés véget ért, de nézd át a visszajelzéseket."
  }
 },
 "missed": {
  "end": {
   "title": "Elszalasztott intézkedés",
   "text": "A szabálysértést nem hagyhatjuk figyelmen kívül."
  }
 }
}$json$::jsonb, 10),
('Minta: Üldözés a rádióban', 'Üldözés bejelentése, az egységek összehangolása és a helyes kódok.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "Egy jármű nem áll meg a jelzésedre, és nagy sebességgel elhajt. Mit mondasz be elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "„6A029, 10-20: Doherty, MDC jel, 10-99, C3!”, a jármű leírása és az iránya.",
    "next": "backup",
    "points": 2,
    "verdict": "good",
    "feedback": "Ezekkel a kollégák be tudnak kapcsolódni; nagy sebességű menekülésnél nem kell kivárni a harmadik felszólítást."
   },
   {
    "id": "b",
    "text": "„6A029, 10-20: Doherty, Code 99, minden egység!”, a jármű leírása és az iránya.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 vészhelyzet: minden egységet hív, egy üldözéshez túlzás."
   },
   {
    "id": "c",
    "text": "Csak követem, és amikor megáll, akkor mondom be a jármű leírását és a helyet.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rádió nélkül nem kapsz segítséget, és a kollégák sem tudják, merre jársz."
   }
  ]
 },
 "backup": {
  "text": "Egy kolléga csatlakozik, már ő is a jármű mögött van. Mit kérsz?",
  "choices": [
   {
    "id": "a",
    "text": "Jöjjön mellém, és két oldalról, egyszerre szorítsuk le a járművet az útról, mielőtt eléri a hidat.",
    "next": "stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az egymás melletti üldözés balesetveszélyes; a sorrendet tartani kell."
   },
   {
    "id": "b",
    "text": "Hívjon ide mindenkit, aki hall, mert minél több autó van mögötte, annál biztosabb az elfogás.",
    "next": "stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zsúfolt üldözés balesetveszélyes."
   },
   {
    "id": "c",
    "text": "Vegye át a második pozíciót a sorban; a többiek ne zsúfolódjanak mögöttünk, hanem zárják le a környező utakat.",
    "next": "stop",
    "points": 2,
    "verdict": "good",
    "feedback": "Rendezett üldözés: kevesebb baleset, több esély az elfogásra."
   }
  ]
 },
 "stop": {
  "text": "A gyanúsított egy zsákutcában lefullad, az egységek körbevették. Melyik kód illik ide?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 4.”",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nem kell több erősítés: még nem tartunk ott."
   },
   {
    "id": "b",
    "text": "„Code 6-Adam.”",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 6-Adam azt jelenti, kiszállsz és erősítés kell; itt az elfogás kódja a Code 100."
   },
   {
    "id": "c",
    "text": "„Code 100.”",
    "next": "custody",
    "points": 2,
    "verdict": "good",
    "feedback": "Pontosan: abban a helyzetben vagyunk, hogy elfogjuk."
   }
  ]
 },
 "custody": {
  "text": "Megbilincselted, beültetted a járművedbe. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„10-8”, és bemondom, hogy a legközelebbi kirendeltségre szállítom, és Investigatort kérek.",
    "next": "ok_end",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-8 a szolgálatba állás; a többieket a Code 4 engedi vissza a járőrhöz."
   },
   {
    "id": "b",
    "text": "„Code 4”, és bemondom, hogy a legközelebbi kirendeltségre szállítom, Investigatort kérve.",
    "next": "good_end",
    "points": 3,
    "verdict": "good",
    "feedback": "Mindenki tudja, hogy vége; a kihallgatás a kirendeltségen lesz, a fegyházba indulást (10-15) utána jelzed."
   },
   {
    "id": "c",
    "text": "„Code 4”, és bemondom, hogy a gyanúsítottat egyenesen a fegyházba szállítom (10-15).",
    "next": "ok_end",
    "points": 1,
    "verdict": "ok",
    "feedback": "A Code 4 jó, de előbb a kirendeltség: kihallgatás csak ott lehet, fegyházban nem."
   }
  ]
 },
 "good_end": {
  "end": {
   "title": "Elfogva!",
   "text": "Tiszta rádióforgalmazás az első perctől az őrizetbe vételig."
  }
 },
 "ok_end": {
  "end": {
   "title": "Elfogva",
   "text": "A gyanúsított őrizetben van, de a kódokat érdemes átismételni a Kódtárban."
  }
 }
}$json$::jsonb, 20),
('Igazoltatás ADAM egységben', 'Egy közúti igazoltatás a tananyag sorrendjében: indok, a sofőr rádiózik, az anyósülésen ülő intézkedik, iratok, kötelező felszerelés, bírság.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "ADAM egységben (6A029) járőröztök Downtownban; a társad, Deputy Reyes vezet, te az anyósülésen ülsz. Előttetek egy kék BMW X5 halad, a bal hátsó lámpája nem világít. Mit tesztek?",
  "choices": [
   {
    "id": "a",
    "text": "Megcélozzuk, szirénát kapcsolunk, felszólítjuk a félreállásra, és mögé húzódunk.",
    "next": "radio_stop",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag sorrendje: megcélzás, sziréna, felszólítás, félrehúzódás a jármű mögé. A működésképtelen izzó valós indok."
   },
   {
    "id": "b",
    "text": "Nem állítjuk meg: egy hibás lámpa a tananyag szerint nem igazoltatási ok.",
    "next": "missed",
    "points": 0,
    "verdict": "bad",
    "feedback": "Van ok: a törött, hibás jármű a tananyag szerinti indokok egyike, a működésképtelen izzó balesetveszélyes."
   },
   {
    "id": "c",
    "text": "Megcélozzuk, felszólítjuk, és elé húzódva lassítjuk le, hogy biztosan meg is álljon.",
    "next": "radio_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Elé állni veszélyes, és nem ez a sorrend: megcélzás, sziréna, felszólítás, félrehúzódás a jármű mögé."
   }
  ]
 },
 "radio_stop": {
  "text": "A BMW lehúzódik a járda mellé, mögé álltok. Ki rádiózza az igazoltatást, és mit mond be?",
  "choices": [
   {
    "id": "a",
    "text": "A sofőr: „6A029 10-20 Downtown. Igazoltatás: kék színű BMW X5, rsz.: 8KLM421, két fő. Az egység 10-6.”",
    "next": "exit",
    "points": 2,
    "verdict": "good",
    "feedback": "Az igazoltatás rádiózását a sofőr hajtja végre. A jármű leírásának sorrendje: szín, márka, típus, rendszám, a bent ülők száma."
   },
   {
    "id": "b",
    "text": "A sofőr: „6A029 10-20 Downtown. Igazoltatás: kék színű BMW X5, rsz.: 8KLM421, két fő. Az egység Code 6.”",
    "next": "exit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 6 azt jelenti, hogy kiszállsz intézkedni; az igazoltatás bejelentése a 10-6-tal (elfoglalt) zárul."
   },
   {
    "id": "c",
    "text": "Az anyósülésen ülő: „6A029 10-20 Downtown. Igazoltatás: kék BMW X5, rsz.: 8KLM421, két fő. Az egység 10-98.”",
    "next": "exit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Két hiba: igazoltatásnál a sofőr rádiózik, és közben az egység 10-6 (elfoglalt), nem 10-98."
   },
   {
    "id": "d",
    "text": "A sofőr: „6A029 10-20 Downtown. Igazoltatás: BMW X5, rsz.: 8KLM421. Az egység 10-6.”",
    "next": "exit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó irány, de hiányzik a szín és a bent ülők száma; a sorrend: szín, márka, típus, rendszám, utasok."
   }
  ]
 },
 "exit": {
  "text": "Bemondtátok. Ki száll ki, és hogyan közelít a BMW-hez?",
  "choices": [
   {
    "id": "a",
    "text": "Én az anyósülésről: egyenesen a sofőr ablakához lépek, a jármű hátulját nem érintem, hogy ne hagyjak nyomot.",
    "next": "greet",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jármű hátuljának megérintése (DNS rögzítése) a tananyag szerinti megközelítés része."
   },
   {
    "id": "b",
    "text": "A sofőr száll ki: megérinti a jármű hátulját, én az anyósülésről rádiózom tovább.",
    "next": "greet",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: ADAM egységben a sofőr rádiózik, az anyósülésen ülő száll ki."
   },
   {
    "id": "c",
    "text": "Én az anyósülésről: RP-ben megérintem a jármű hátulját, majd a sofőr ajtaja előtt megállok.",
    "next": "greet",
    "points": 2,
    "verdict": "good",
    "feedback": "ADAM egységben az anyósülésen ülő száll ki. A jármű hátuljának megérintése RP-ben a DNS rögzítése."
   }
  ]
 },
 "greet": {
  "text": "Ott állsz a sofőr ajtajánál. Hogyan kezded a beszélgetést?",
  "choices": [
   {
    "id": "a",
    "text": "„Szép napot! Deputy Morgan, Sheriff’s Department, jelvényszámom 1342. A bal hátsó lámpája nem ég. Kérem az iratait és a forgalmit.”",
    "next": "query",
    "points": 2,
    "verdict": "good",
    "feedback": "Köszönés, név, szervezet, jelvényszám, az indok, végül az iratok: ez a tananyag mintája."
   },
   {
    "id": "b",
    "text": "„Erőt, egészséget! Deputy Morgan, jelvényszámom 1342. A bal hátsó lámpája nem ég, kérem az iratait és a forgalmit.”",
    "next": "query",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az „Erőt, egészséget” ORFK-s kifejezés, a szabályzat tiltja: Amerikában vagyunk."
   },
   {
    "id": "c",
    "text": "„Szép napot! Deputy Morgan vagyok a Sheriff’s Departmenttől. Kérem a személyi igazolványát, a jogosítványát és a forgalmit.”",
    "next": "query",
    "points": 1,
    "verdict": "ok",
    "feedback": "Udvarias, de hiányzik a jelvényszám és az, hogy miért állítottátok félre."
   }
  ]
 },
 "query": {
  "text": "A sofőr, Tyler Brooks átadja az iratokat. Mit mondasz a rádióba?",
  "choices": [
   {
    "id": "a",
    "text": "„Morgan to Reyes. Kérem, nézze meg az MDC-n a rendszámot és a sofőr nevét.”",
    "next": "equipment",
    "points": 0,
    "verdict": "bad",
    "feedback": "A formátumhoz a rang is kell, és az ellenőrzést a 10-28 és a 10-29 kódokkal kérjük."
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
    "text": "„Deputy Morgan to Deputy Reyes. 10-28 8KLM421, 10-29 Tyler Brooks.”",
    "next": "equipment",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-28 a jármű, a 10-29 a személy ellenőrzése; a formátum: [rang] [vezetéknév] to [rang] [vezetéknév]."
   }
  ]
 },
 "equipment": {
  "text": "A 10-28 és a 10-29 tiszta. Mi következik?",
  "choices": [
   {
    "id": "a",
    "text": "Megkérem, hogy vegye elő és mutassa fel a háromszöget és az egészségügyi csomagot.",
    "next": "kit",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha az adatokkal minden rendben, jön a kötelező felszerelés: a célszemély veszi elő és mutatja fel."
   },
   {
    "id": "b",
    "text": "Megkérem, hogy nyissa ki a csomagtartót, és belenézek, megvan-e a háromszög és a csomag.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos a csomagtartóba belenézni: a célszemélynek kell kivennie és felmutatnia az eszközöket."
   },
   {
    "id": "c",
    "text": "Semmi: tiszta lekérdezés után a kötelező felszerelést már nem kell ellenőrizni.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Épp a tiszta lekérdezés után jön a kötelező felszerelés ellenőrzése."
   }
  ]
 },
 "kit": {
  "text": "A sofőr a csomagtartóból előveszi és megmutatja a háromszöget és az egészségügyi csomagot. Hogyan zárod az igazoltatást?",
  "choices": [
   {
    "id": "a",
    "text": "Felsorolom a pontokat, a lámpa mellé a felszerelés hiányát is beírom, átadom a csekket, és elköszönök.",
    "next": "radio_end",
    "points": 0,
    "verdict": "bad",
    "feedback": "A felszerelés megvan, fel is mutatta: azért nem jár bírság."
   },
   {
    "id": "b",
    "text": "Bírságolok a lámpáért, átadom a csekket és az iratokat, majd visszaülök a járőrautóba.",
    "next": "radio_end",
    "points": 1,
    "verdict": "ok",
    "feedback": "A bírság jó, de a büntetés pontjait fel kell sorolni, és el kell köszönni."
   },
   {
    "id": "c",
    "text": "Felsorolom a pontokat, bírságolok a lámpáért, átadom a csekket az iratokkal, és elköszönök.",
    "next": "radio_end",
    "points": 3,
    "verdict": "good",
    "feedback": "A deputy köteles felsorolni a büntetés pontjait, a csekket az iratokkal együtt adja át. A felszerelés megvan, azért nem jár bírság."
   }
  ]
 },
 "radio_end": {
  "text": "Visszaültél a járőrautóba. Mit mondtok be?",
  "choices": [
   {
    "id": "a",
    "text": "„6A029 10-20 Downtown, igazoltatás befejezve, az egység továbbra is 10-6.”",
    "next": "done_wrong",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az igazoltatás véget ért: az egység újra elérhető (10-98), nem elfoglalt (10-6)."
   },
   {
    "id": "b",
    "text": "„6A029 10-20 Downtown, járőrszolgálat teljesítése, az egység 10-98.”",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az egység lerádiózza az igazoltatás végét és a járőrszolgálat folytatását; így újra riaszthatók vagytok."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szabályos igazoltatás",
   "text": "Indok, rádió, szereposztás, udvarias bemutatkozás, ellenőrzés, felszerelés, bírság és a vége is be van mondva."
  }
 },
 "done_wrong": {
  "end": {
   "title": "Lezárva, rossz kóddal",
   "text": "Az igazoltatás rendben volt, de a végén elfoglaltnak jelentetted az egységet, pedig újra elérhetők voltatok (10-98)."
  }
 },
 "missed": {
  "end": {
   "title": "Elmaradt intézkedés",
   "text": "Egy hibás lámpa valós indok az igazoltatásra; a tananyag szerinti lépésekkel érdemes végigvinni."
  }
 }
}$json$::jsonb, 100),
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
    "text": "Megcélzom, szirénát kapcsolok, és a kereszteződésben keresztbe állok előtte.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Veszélyes és szükségtelen: a felszólítás és a mögé állás elég."
   },
   {
    "id": "c",
    "text": "Felírom a rendszámát, és a traffipax-adat alapján utólag küldjük ki a bírságot.",
    "next": "missed",
    "points": 0,
    "verdict": "bad",
    "feedback": "Utólag kiküldött bírság nem létezik: a szabálysértőt ott kell megállítani és igazoltatni."
   }
  ]
 },
 "radio": {
  "text": "A Sultan lehúzódik. Mikor és mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "Még a kocsiban: „6L118 10-20 Downtown. Igazoltatás: fekete Sultan, rsz.: 4FHR230, egy fő. Az egység 10-6.”",
    "next": "documents",
    "points": 2,
    "verdict": "good",
    "feedback": "LINCOLN egységnél a deputy csak azt követően száll ki, hogy lerádiózta az igazoltatást."
   },
   {
    "id": "b",
    "text": "A sofőr ajtajánál: „6L118 10-20 Downtown. Igazoltatás: fekete Sultan, rsz.: 4FHR230, egy fő. Az egység 10-6.”",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül előbb a rádió, utána a kiszállás: ha baj lesz, már tudják, hol vagy és kit állítottál meg."
   },
   {
    "id": "c",
    "text": "Még a kocsiban: „6L118 10-20 Downtown. Igazoltatás: fekete Sultan, rsz.: 4FHR230, egy fő. Az egység 10-98.”",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "Igazoltatás közben az egység elfoglalt: 10-6, nem 10-98."
   }
  ]
 },
 "documents": {
  "text": "Bemutatkoztál, elmondtad az indokot, és megkaptad a sofőr iratait. Mit teszel most?",
  "choices": [
   {
    "id": "a",
    "text": "Visszaülök a járőrautóba, és onnan kérdezem le a rendszámot (10-29) és a nevet (10-28).",
    "next": "measure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: a 10-28 a járművet, a 10-29 a személyt ellenőrzi."
   },
   {
    "id": "b",
    "text": "Visszaülök a járőrautóba, és onnan kérdezem le a rendszámot (10-28) és a nevet (10-29).",
    "next": "measure",
    "points": 2,
    "verdict": "good",
    "feedback": "LINCOLN egységnél az iratok átvétele után a deputy visszaül a gépjárműbe, és ott kérdezi le az adatokat."
   },
   {
    "id": "c",
    "text": "Az ablaknál állva, a sofőr mellett rádión kérdezem le a rendszámot (10-28) és a nevet (10-29).",
    "next": "measure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Társ nélkül nincs, aki lekérdezzen helyetted: visszaülsz, és a járőrautóból ellenőrzöl."
   }
  ]
 },
 "measure": {
  "text": "A lekérdezés tiszta. A traffipax 82 km/h-t mért, ahol 50 a megengedett. Melyik tétel illik ide?",
  "choices": [
   {
    "id": "a",
    "text": "GYO/I. – országút 25% (110 km/h), 350 000 – 700 000 $.",
    "next": "argue",
    "points": 0,
    "verdict": "bad",
    "feedback": "A belváros lakott terület (50 km/h), az országúti tételek itt nem használhatók."
   },
   {
    "id": "b",
    "text": "GV – gondatlan vezetés, 250 000 – 500 000 $.",
    "next": "argue",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyorshajtásnak saját tétele van; a gondatlan vezetés pl. az indexelés hiánya vagy a sávból kilógás."
   },
   {
    "id": "c",
    "text": "GYLT/I. – 25% (65 km/h), 350 000 – 700 000 $.",
    "next": "argue",
    "points": 3,
    "verdict": "good",
    "feedback": "82 km/h a 65 km/h-s határ fölött, de a 100 km/h-s alatt van, ezért a 25%-os kategória (GYLT/I.)."
   },
   {
    "id": "d",
    "text": "GYLT/II. – 100% (100 km/h), 400 000 – 800 000 $.",
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
    "text": "Nyugodtan elmondom a mért értéket, megmutatom az adatot, és jelzem, hogy a sértegetés külön tétel.",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "A deputy tisztelettel és higgadtan beszél. A rendőrrel szembeni tiszteletlenség (RSZT) valóban külön tétel."
   },
   {
    "id": "b",
    "text": "Hangosan rászólok, hogy így ne beszéljen egy deputyval, különben a bírságot is megduplázom neki.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kiabálás és fenyegetés helyett higgadtság kell; a bírság a Kalkulátor kereteiben marad, nem büntetőeszköz."
   },
   {
    "id": "c",
    "text": "Nyugodtan elmondom a mért értéket, és a sértegetésért azonnal letartóztatom, hogy tanuljon belőle.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy ingerült megjegyzés még nem ok a letartóztatásra: figyelmeztess, és ha folytatja, jöhet az RSZT."
   }
  ]
 },
 "close": {
  "text": "A sofőr lehiggad. Hogyan fejezed be?",
  "choices": [
   {
    "id": "a",
    "text": "Felsorolom a pontokat, átadom a csekket és az iratokat, elköszönök, és rádió nélkül járőrözöm tovább a belvárosban.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A rádió maradt ki: jelentsd, hogy újra elérhető vagy (10-98)."
   },
   {
    "id": "b",
    "text": "Felsorolom a pontokat, átadom a csekket és az iratokat, elköszönök, és rádión jelzem, hogy újra 10-98 vagyok.",
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
}$json$::jsonb, 110),
('Iratok, neon, szélvédő', 'Egy igazoltatás, ahol több apró hibát kell helyesen felismerni: lejárt iratok, tiltott neon, sérült szélvédő, fényszóró nappal.', 'traffic', 1, 'start',
 $json${
 "start": {
  "text": "Nappal, Doherty környékén megállítasz egy zöld Buffalót: nem ég a fényszórója, az első szélvédője repedt, és alul piros neon világít. Melyik hiba nem büntethető?",
  "choices": [
   {
    "id": "a",
    "text": "Egyik sem: mindhárom büntethető.",
    "next": "documents",
    "points": 2,
    "verdict": "good",
    "feedback": "A fényszóró nappal is kötelező (FHM), a repedt első szélvédő zavarja a kilátást (RJVK/I.), a piros neon tilos (IAA/I.)."
   },
   {
    "id": "b",
    "text": "A neon: bármilyen színű szabad.",
    "next": "documents",
    "points": 0,
    "verdict": "bad",
    "feedback": "A neon minden színben engedélyezett, kivéve a pirosat és a kéket, sem állandó, sem villogó változatban."
   },
   {
    "id": "c",
    "text": "A szélvédő: csak a hátsó számít.",
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
    "text": "ENV/I., SZIH, és HEH is, ha már a jogosítvány rossz.",
    "next": "kit",
    "points": 0,
    "verdict": "bad",
    "feedback": "A forgalmi érvényes, azért nem jár bírság. Mindig csak a valós hiányért."
   },
   {
    "id": "b",
    "text": "ENV/I.; a személyi igazolvány hiánya önmagában nem tétel.",
    "next": "kit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az ENV/I. jó, de a személyi igazolvány hiánya (SZIH) is külön tétel."
   },
   {
    "id": "c",
    "text": "ENV/I. (a lejárt jogosítvány olyan, mintha nem lenne) és SZIH.",
    "next": "kit",
    "points": 3,
    "verdict": "good",
    "feedback": "A lejárt jogosítvány egyenlő azzal, hogy nincs; a hiányzó személyi igazolvány külön tétel."
   },
   {
    "id": "d",
    "text": "Csak figyelmeztetés a jogosítványra, mert volt neki, és SZIH.",
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
    "text": "Elfogadom, és én rakom a csomagtartóba, közben belenézek.",
    "next": "neon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A csomagtartóba belenézni tilos; a célszemély maga rakja el."
   },
   {
    "id": "b",
    "text": "Elfogadom, mert nála van, és megkérem, hogy rakja a helyére.",
    "next": "neon",
    "points": 2,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint elfogadható, ha a személynél van; ilyenkor szólj, hogy rakja a helyére."
   },
   {
    "id": "c",
    "text": "KFH: a háromszög helye a csomagtartó, máshol nem fogadható el.",
    "next": "neon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha a személynél van, elfogadható: elég szólni, hogy rakja a helyére."
   }
  ]
 },
 "neon": {
  "text": "A sofőr megkérdezi, ha a piros helyett más színű neont szereltet, melyik lesz rendben. Mit válaszolsz?",
  "choices": [
   {
    "id": "a",
    "text": "„A zöld rendben van; csak a piros és a kék tilos.”",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "Az illegális alkatrészeknél (IAA/I. és II.) a piros és a kék tiltott, a többi szín megengedett."
   },
   {
    "id": "b",
    "text": "„A zöld és a kék is rendben van; csak a piros tilos.”",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kék is tilos: a megkülönböztető jelzésekkel téveszthető össze."
   },
   {
    "id": "c",
    "text": "„Semmilyen színes neon nem engedélyezett.”",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem igaz: csak a piros és a kék tilos."
   }
  ]
 },
 "close": {
  "text": "Öt tételt állapítottál meg (FHM, RJVK/I., IAA/I., ENV/I., SZIH). Hogyan zárod?",
  "choices": [
   {
    "id": "a",
    "text": "Felsorolom az öt tételt, átadom a csekket, és jogosítvány híján nem engedem tovább vezetni.",
    "next": "done",
    "points": 3,
    "verdict": "good",
    "feedback": "Minden pont elhangzik, a bírság a Kalkulátor kereteiből jön, és érvényes jogosítvány nélkül nem ülhet vissza a volán mögé."
   },
   {
    "id": "b",
    "text": "Az öt tétel helyett letartóztatom és bekísérem, mert ennyi szabálysértés együtt már bűncselekmény.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezek bírsággal sújtható szabálysértések, nem indokolnak letartóztatást."
   },
   {
    "id": "c",
    "text": "Felsorolom az öt tételt, átadom a csekket, és figyelmeztetve elengedem vezetni.",
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
}$json$::jsonb, 120),
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
    "text": "„Samantha Cole, Deputy Sheriff I., 10-10. Szép estét!”",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-10 a szolgálat leadása; a szolgálatba állás a 10-8."
   },
   {
    "id": "c",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-98. Szép estét!”",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-98 azt jelenti, az egység elérhető; a szolgálatba lépés jele a 10-8."
   }
  ]
 },
 "patrol": {
  "text": "Társaddal ADAM egységben (6A014) járőröztök a Financial környékén; te ülsz az anyósülésen. Öt perce nem szólt a rádiótok. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "A sofőr: „6A014 10-20 Financial, járőrszolgálat teljesítése, az egység 10-98.”",
    "next": "callsign",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jó üzenet, rossz személy: ADAM egységben az anyósülésen ülő rádiózik az ötperces helyzetjelentéskor."
   },
   {
    "id": "b",
    "text": "Én, az anyósülésről: „6A014 járőrszolgálatot folytat Financial térségében, Downtown felé.”",
    "next": "callsign",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó forma, de az elérhetőség (elérhető és riasztható, vagyis 10-98) kimaradt."
   },
   {
    "id": "c",
    "text": "Én, az anyósülésről: „6A014 10-20 Financial, járőrszolgálat teljesítése, az egység 10-98.”",
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
    "text": "6: Downtown Station; A: ADAM egység (két-három sheriff); 014: a jelvényszámom utolsó három számjegye.",
    "next": "repair",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szám a járőrautó rendszámának számjegyei, nem a jelvényszám."
   },
   {
    "id": "b",
    "text": "6: Downtown Station; A: ADAM egység (két-három sheriff); 014: a rendszám számjegyei.",
    "next": "repair",
    "points": 2,
    "verdict": "good",
    "feedback": "Divíziószám, egységtípus a fonetikus ábécéből, végül a járőrautó rendszámának számjegyei."
   },
   {
    "id": "c",
    "text": "6: Hubert Station; A: AIR egység (helikopter); 014: a rendszám számjegyei.",
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
    "text": "„6A014 10-20 Repair Co., szereltetés, Code 7.”",
    "next": "pause",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 7 a szünet engedélyének kérése; szereltetéskor az egység elfoglalt: 10-6."
   },
   {
    "id": "b",
    "text": "„6A014 10-20 Repair Co., szereltetés, 10-98.”",
    "next": "pause",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-98 azt jelenti, elérhetők vagytok. Szereltetés közben 10-6 (elfoglalt)."
   },
   {
    "id": "c",
    "text": "„6A014 10-20 Repair Co., szereltetés, 10-6.”",
    "next": "pause",
    "points": 2,
    "verdict": "good",
    "feedback": "A reagálást akadályozó, több perces folyamatot (szereltetés, tankolás, szünet) jelenteni kell, pozícióval és indokkal."
   }
  ]
 },
 "pause": {
  "text": "Másfél óra után szünetet tartanátok. Hogyan intézed?",
  "choices": [
   {
    "id": "a",
    "text": "Code 7-tel engedélyt kérek, majd: „6A014 a Downtown Departmenten szünetet tart, az egység 10-98.”",
    "next": "callout",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szünet alatt nem vagytok elérhetők: a 10-98 helyett azt kell jelezni, hogy az egység nem elérhető."
   },
   {
    "id": "b",
    "text": "Code 7-tel engedélyt kérek, majd: „6A014 visszatér Downtown Departmentre, szünet miatt nem elérhető.”",
    "next": "callout",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 7 a szünet engedélyezésének kérése; a szünet idejére jelezni kell, hogy nem vagytok elérhetők."
   },
   {
    "id": "c",
    "text": "Code 4-gyel jelzem, majd: „6A014 visszatér Downtown Departmentre, szünet miatt nem elérhető.”",
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
    "text": "„6A014 fogadja a hívást, és reagál rá.”",
    "next": "end_duty",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó, de a reagálási kód (itt Code 3) kimaradt."
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
    "text": "„6A014 fogadja a hívást, reagál rá, Code 37!”",
    "next": "end_duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 37 a lopott jármű kódja, nem a reagálásé; sürgős reagálásnál Code 3."
   }
  ]
 },
 "end_duty": {
  "text": "A szolgálat végén leadnád a dutyt. Mit rádiózol, és mit teszel a járművel?",
  "choices": [
   {
    "id": "a",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-10.” A kocsit így, sárosan viszem vissza a garázsba.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A rádiózás jó, de a járművet megszerelve és tisztán kell visszavinni."
   },
   {
    "id": "b",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-8.” A kocsit megszerelve és tisztán viszem vissza.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-8 a szolgálatba állás; a leadás a 10-10."
   },
   {
    "id": "c",
    "text": "„Samantha Cole, Deputy Sheriff I., 10-10.” A kocsit megszerelve és tisztán viszem vissza.",
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
}$json$::jsonb, 130),
('Határátlépés Los Santosba', 'Mikor és hogyan rádiózd a határátlépést, milyen indokot mondj, mit tehetsz Los Santosban, és mikor jár bírság az útlevél hiányáért.', 'radio', 1, 'start',
 $json${
 "start": {
  "text": "San Fierróban minden szerviz foglalt, ezért Los Santosba mentek szereltetni (6A029). Deputy Kearney vagy. Mit teszel a határnál?",
  "choices": [
   {
    "id": "a",
    "text": "A saját csatornánkon: „6A029 átlépi a határt szereltetés miatt, az egység 10-6.”",
    "next": "reason",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az LSPD-nek kell szólni, hiszen az ő területükre léptek."
   },
   {
    "id": "b",
    "text": "„SFSD to LSPD, Deputy Kearney vételen. 6A029 átlépi a határt szereltetés miatt.”",
    "next": "reason",
    "points": 2,
    "verdict": "good",
    "feedback": "Los Santosba belépéskor kötelező rádiózni az LSPD-nek; ez a tananyag mintája."
   },
   {
    "id": "c",
    "text": "Semmit: szereltetésnél a tananyag szerint nem kell rádiózni a határ átlépését az LSPD felé.",
    "next": "reason",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: rablásra vagy üldözésre reagálva nem kell; minden más határátlépést, a szereltetést is, rádiózni kell."
   }
  ]
 },
 "reason": {
  "text": "Másnap egy sérült kollégát visztek egy Los Santos-i kórházba, harmadnap egy LS-i hivatalba mentek iratokért. Milyen indokot mondasz a második esetben?",
  "choices": [
   {
    "id": "a",
    "text": "A kórháznál a kórházi ellátást, a hivatali útnál az „ügyintézés” kifejezést.",
    "next": "pursuit",
    "points": 2,
    "verdict": "good",
    "feedback": "A szereltetés, a nyomozás és a kórházi ellátás saját indok; minden más esetben az „ügyintézés”."
   },
   {
    "id": "b",
    "text": "Mindkettőnél az „ügyintézés” kifejezést, mert egyik sem szereltetés.",
    "next": "pursuit",
    "points": 1,
    "verdict": "ok",
    "feedback": "A hivatali útnál jó, de a kórházi ellátás saját indok, azt mondd."
   },
   {
    "id": "c",
    "text": "A kórháznál a kórházi ellátást, a hivatali útnál pedig az iratok pontos fajtáját.",
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
    "text": "Kell: a határnál röviden bemondjuk az LSPD-nek, aztán folytatjuk az üldözést.",
    "next": "ls_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Üldözésnél vagy rablásnál nem kell; ha a határnál bejelentenél, elveszítenéd a gyanúsítottat."
   },
   {
    "id": "b",
    "text": "Nem kell: üldözésre vagy rablásra reagálva a határátlépést nem rádiózzuk.",
    "next": "ls_stop",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez a tananyag kivétele; minden más határátlépést viszont rádiózni kell."
   },
   {
    "id": "c",
    "text": "Nem kell, mert a határnál úgyis abba kell hagyni az üldözést.",
    "next": "ls_stop",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rádiózni nem kell, de abbahagyni sem kell az üldözést a határon."
   }
  ]
 },
 "ls_stop": {
  "text": "Szereltetés után Los Santosban egy autó átmegy előttetek a piroson. Mit tehettek?",
  "choices": [
   {
    "id": "a",
    "text": "Megállítjuk és megbüntetjük, mert a Büntető Törvénykönyv Los Santosban is ugyanaz.",
    "next": "passport",
    "points": 0,
    "verdict": "bad",
    "feedback": "A törvény lehet ugyanaz, de a hatáskör nem: LS-ben az LSPD jelenléte és engedélye kell."
   },
   {
    "id": "b",
    "text": "Megállítjuk, igazoltatjuk, és utólag rádión kérünk rá engedélyt az LSPD-től is.",
    "next": "passport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az engedély előbb kell, és az LSPD jelenléte is."
   },
   {
    "id": "c",
    "text": "Nem igazoltatunk: LS-ben csak az LSPD jelenlétével és engedélyével; jelezzük nekik.",
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
    "text": "Igen, ÚH: San Fierróban annak jár, aki Los Santosból érkezik.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint az útlevél hiánya annál büntethető, aki a másik városból érkezik."
   },
   {
    "id": "b",
    "text": "Nem: útlevél csak az országhatárhoz kell, a városok között nem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A két város között is kell: az ÚH tétel épp erre szól."
   },
   {
    "id": "c",
    "text": "Igen, ÚH, de csak akkor, ha a sofőr San Fierrói lakos.",
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
}$json$::jsonb, 140),
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
    "text": "„Lieutenant Wothsmer to Sergeant Garcia.”",
    "next": "tone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: előbb a saját rangod és neved, utána a keresett félé."
   },
   {
    "id": "c",
    "text": "„Garcia to Wothsmer, kérem, jelentkezzen.”",
    "next": "tone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A formátumból a rangok hiányoznak: [rang] [vezetéknév] to [rang] [vezetéknév]."
   }
  ]
 },
 "tone": {
  "text": "A hadnagy válaszol, és azt kérdezi, mi a helyzet. Hogyan felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "„Lieutenant, a gyanúsított őrizetben van, a helyszín biztosítva. Szólj, ha van még teendő, főnök.”",
    "next": "repeat",
    "points": 0,
    "verdict": "bad",
    "feedback": "A „szólj” és a „főnök” tegeződés és laza stílus: a rádióban nincs kivétel a magázódás alól."
   },
   {
    "id": "b",
    "text": "„Lieutenant, a gyanúsított őrizetben van, a helyszín biztosítva. Kérem, jelezze, ha van további teendő.”",
    "next": "repeat",
    "points": 2,
    "verdict": "good",
    "feedback": "A rádióban minden esetben magázódni kell, nincs kivétel."
   },
   {
    "id": "c",
    "text": "„A gyanúsított őrizetben van, a helyszín biztosítva.”",
    "next": "repeat",
    "points": 1,
    "verdict": "ok",
    "feedback": "Tömör és magázódó, de a megszólítás elmaradt; választékosan, szerephez illően beszélj."
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
    "text": "„10-4”, majd bemondom a helyes rendszámot.",
    "next": "secret",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-4 annyit jelent: vettem."
   },
   {
    "id": "c",
    "text": "„10-9”, majd bemondom a helyes rendszámot.",
    "next": "secret",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-9 azt kéri a másiktól, hogy ismételje meg az előzőt; a saját hibás üzeneted visszavonása a 10-22."
   }
  ]
 },
 "secret": {
  "text": "Egy informátor nevét kellene átadnod az ügy nyomozójának. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "A rádióban jelzem, hogy 10-35, majd a közös csatornán bemondom a nevet.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-35 épp azt jelzi, hogy bizalmas: a nevet nem a közös rádión adod át."
   },
   {
    "id": "b",
    "text": "A rádióban jelzem, hogy 10-35, és a nevet személyesen adom át.",
    "next": "ooc",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-35 a bizalmas információ jele; egy informátor neve nem a közös rádióra tartozik."
   },
   {
    "id": "c",
    "text": "A rádióban jelzem, hogy Code 10, és a nevet személyesen adom át.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 10 rádiócsend a kutatás információihoz; a bizalmas információ jele a 10-35."
   }
  ]
 },
 "ooc": {
  "text": "Egy kolléga a rádióba írja: „bocs, lagg volt, újraindítom a gépet”. Mi a helyes?",
  "choices": [
   {
    "id": "a",
    "text": "Belefér, ha dupla zárójelben írja: ((lagg, újraindítok)), mert az az OOC jelölése.",
    "next": "say",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rádióban zárójelben sem: az OOC rádiózás tilos, az ilyet TS3-on kell jelezni."
   },
   {
    "id": "b",
    "text": "OOC rádiózás tilos: TS3-on szóljon; IC legfeljebb annyit, hogy az egység 10-6.",
    "next": "say",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat tiltja az OOC rádiózást; IC-ben az elérhetőség változását lehet jelezni."
   },
   {
    "id": "c",
    "text": "Visszaírom a rádióba, hogy rendben, és megvárjuk, amíg visszajön.",
    "next": "say",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel te is OOC rádiózol; a választ is TS3-on add."
   }
  ]
 },
 "say": {
  "text": "Járőrözés közben a társad (say-ben) azt mondja neked: „10-4, Code 7 után megyünk 10-19.” Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Nem szólok neki semmit, de én rendes mondatban válaszolok, hogy példát mutassak neki.",
    "next": "offduty",
    "points": 1,
    "verdict": "ok",
    "feedback": "Te helyesen beszélsz, de érdemes szólni neki, mert a szabály mindenkire vonatkozik."
   },
   {
    "id": "b",
    "text": "Szólok neki, hogy say-ben a 10-es kódok rendben vannak, csak a Code-ok tilosak.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Say-ben semmilyen rádiófónia nem használható, a 10-es kódok sem."
   },
   {
    "id": "c",
    "text": "Szólok neki, hogy say-ben tilos a rádiófóniákat használni, mondja el rendes mondatban.",
    "next": "offduty",
    "points": 2,
    "verdict": "good",
    "feedback": "Rádiófóniát csak a rádióban használunk; személyes társalgásban (say-ben) tilos."
   }
  ]
 },
 "offduty": {
  "text": "Szolgálaton kívül sétálsz a városban, és látod, hogy valakit kirabolnak. A rádió nálad van. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nem rádiózom, de odamegyek, és civilként, szolgálaton kívül fogom el a rablót.",
    "next": "punctuation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha nem vagy dutyban, ne avatkozz bele a rendőri ügyekbe; a magánakció tilos."
   },
   {
    "id": "b",
    "text": "Rádión szólok a szolgálatban lévőknek, mert sürgős, és közben figyelem a rablót.",
    "next": "punctuation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül tilos a rádiót használni: tárcsázd a 911-et."
   },
   {
    "id": "c",
    "text": "Nem rádiózom és nem avatkozom bele: a 911-et hívom, és elmondom, amit látok.",
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
    "text": "A nagybetűkre és a helyesírásra; az írásjelet akció közben elhagyhatom.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "Az írásjel is kötelező, minden mondat végére."
   },
   {
    "id": "b",
    "text": "A helyesírásra és a mondatvégi írásjelekre, akkor is, ha épp lőnek rám.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag kiemeli: a helyesírásra és az írásjelekre akkor is figyelj, ha egy akció közepén vagy, és lőnek rád."
   },
   {
    "id": "c",
    "text": "Csak a tartalomra: akció közben a helyesírás és az írásjel elmaradhat.",
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
}$json$::jsonb, 150),
('Előállítás lépésről lépésre', 'Drog egy igazoltatáson: őrizetbe vétel, jogok, motozás (nőt csak nő), szállítás a kirendeltségre, külön választás, Investigator, bírság, fegyház.', 'arrest', 1, 'start',
 $json${
 "start": {
  "text": "Igazoltatás közben a Sabre kesztyűtartójából egy zacskó fehér por csúszik ki; a sofőr, Marcus Reed idegesen visszagyűri. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nem foglalkozom vele: csak gyorshajtásért állítottam meg, azt bírságolom.",
    "next": "rights",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amit az igazoltatás közben találsz, az is eljárást von maga után: a KB bűncselekmény."
   },
   {
    "id": "b",
    "text": "Elveszem a zacskót, és mivel kis mennyiség, figyelmeztetéssel elengedem.",
    "next": "rights",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kábítószer birtoklása bűncselekmény (KB), a mennyiségtől függetlenül: eljárás jár."
   },
   {
    "id": "c",
    "text": "Kiszállítom, drogteszttel ellenőrzöm a port, és pozitív eredménynél őrizetbe veszem.",
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
    "text": "„Joga van hallgatni és ügyvédet kérni; ha nem tud fizetni, kirendelünk egyet. Joga van egy telefonhíváshoz.”",
    "next": "search",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tananyag jogai: hallgatás (és amit mond, felhasználható), orvosi ellátás, telefonhívás. Az ügyvéd nem szerepel köztük."
   },
   {
    "id": "b",
    "text": "„Joga van hallgatni, és bármi, amit mond, felhasználható ön ellen. Joga van orvosi ellátást kérni és egy telefonhíváshoz.”",
    "next": "search",
    "points": 3,
    "verdict": "good",
    "feedback": "Az őrizetbe vétel része a jogok felsorolása: hallgatás, orvosi ellátás, telefonhívás."
   },
   {
    "id": "c",
    "text": "„Joga van hallgatni, és bármi, amit mond, felhasználható ön ellen. Joga van egy telefonhíváshoz, ezt a kirendeltségen intézzük.”",
    "next": "search",
    "points": 1,
    "verdict": "ok",
    "feedback": "Kimaradt az orvosi ellátás joga."
   }
  ]
 },
 "search": {
  "text": "Átvizsgálnád a ruházatát. Hol és hogyan?",
  "choices": [
   {
    "id": "a",
    "text": "Nem motozom a helyszínen: a kirendeltségen, a kihallgatás előtt nézem át.",
    "next": "woman",
    "points": 0,
    "verdict": "bad",
    "feedback": "A motozás a helyszínen jár, az autóhoz állítva, a saját biztonságod miatt is."
   },
   {
    "id": "b",
    "text": "Még a helyszínen, az autóhoz állítva, részletes RP-vel motozom meg.",
    "next": "woman",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint a célszemélyt a helyszínen az autóhoz állítjuk, és részletes RP-vel átvizsgáljuk a ruházatát."
   },
   {
    "id": "c",
    "text": "Még a helyszínen, az autóhoz állítva, teljes átkutatást végzek, levetkőztetve.",
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
    "text": "Engedélyt kérek tőle a motozáshoz; ha nem adja meg, egy női kollégát kérek a helyszínre.",
    "next": "transport",
    "points": 2,
    "verdict": "good",
    "feedback": "Férfit csak férfi, nőt csak nő motozhat. Ha nincs elérhető női állománytag, engedély kell; ha nem adja meg, egy női tagot kérünk a helyszínre."
   },
   {
    "id": "b",
    "text": "Engedély nélkül megmotozom, de a társam jelenlétében, hogy később ne érhessen vád.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nőt csak nő motozhat; ha nincs női kolléga, engedély kell. A tanú ezt nem pótolja."
   },
   {
    "id": "c",
    "text": "Nem motozom meg, mert nő, és a csomagot sem veszem el, amíg nincs női kolléga.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kérj engedélyt, vagy hívj női kollégát; a gyanút nem hagyhatod figyelmen kívül."
   }
  ]
 },
 "transport": {
  "text": "Mindkettőjüket beülteted. Hova viszed őket, és mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "A legközelebbi kirendeltségre, bemondom a szállítást, és útközben Investigatort kérek.",
    "next": "separate",
    "points": 2,
    "verdict": "good",
    "feedback": "A célszemélyt a legközelebbi kirendeltségre visszük (Hubert Station kivételével), útközben pedig Investigatort kérünk."
   },
   {
    "id": "b",
    "text": "Egyenesen a fegyházba, bemondom a szállítást, és útközben Investigatort kérek.",
    "next": "separate",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen történhet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "Hubert Stationre, bemondom a szállítást, és útközben Investigatort kérek.",
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
    "text": "Egy közös cellába teszem őket, amíg megérkezik a kihallgató nyomozó.",
    "next": "investigator",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pont az ellenkezője kell: külön kell választani őket."
   },
   {
    "id": "b",
    "text": "Együtt hallgatom ki őket, így egymás előtt azonnal kiderülnek az ellentmondások.",
    "next": "investigator",
    "points": 0,
    "verdict": "bad",
    "feedback": "Együtt összehangolhatják a történetüket: külön kell választani őket."
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
    "text": "Én, mert én fogtam el őt; az Investigator csak akkor veszi át, ha én külön kérem.",
    "next": "fine",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabályzat szerint ilyenkor át kell adnod az Investigatornak."
   },
   {
    "id": "b",
    "text": "Az Investigator: ha van elérhető, csak ő hallgathat ki, és át kell adnom neki.",
    "next": "fine",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha van elérhető Investigator, csak ők hallgathatják ki a gyanúsítottakat; a Field Staff csak akkor, ha nincs."
   },
   {
    "id": "c",
    "text": "Együtt hallgatjuk ki, de én kérdezek, ő pedig jegyzetel a diktafon mellett.",
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
    "text": "Bírság (KB: 1 500 000 – 3 000 000 $), és ha kifizeti, a drogot visszaadjuk neki.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt kábítószer nem jár vissza, és a KB fegyházzal is jár."
   },
   {
    "id": "b",
    "text": "Fegyház az indulást rádiózva; a bírságot (KB: 1 500 000 – 3 000 000 $) ott osztják ki.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bírságot a kihallgatás után osztjuk ki, a beszállítás előtt."
   },
   {
    "id": "c",
    "text": "Bírság (KB: 1 500 000 – 3 000 000 $, 30–60 perc), majd fegyház, az indulást rádiózva.",
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
}$json$::jsonb, 160),
('Első szolgálat Trainee-ként', 'Az első nap: egyenruha, 10-8, a duty itemek, miért nem járőrözhet két Trainee, ki vezet, rádió az anyósülésről, TS3 és a Trainee-hét.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Ma van az első napod Deputy Sheriff Trainee-ként. James Carter vagy, a locker roomban állsz. Milyen egyenruhát (skint) választasz?",
  "choices": [
   {
    "id": "a",
    "text": "Rövid ujjú egyenruhát, mert csak az ilyen skinek engedélyezettek.",
    "next": "duty",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint csak rövid ujjú uniformot viselő skinek engedélyezettek (/skin)."
   },
   {
    "id": "b",
    "text": "Rövid ujjú egyenruhát, rajta a saját bőrdzsekimmel, mert hűvös van.",
    "next": "duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyenruha kell, saját ruhadarab és idétlen kiegészítő nélkül."
   },
   {
    "id": "c",
    "text": "Hosszú ujjú egyenruhát, mert hidegben az is engedélyezett.",
    "next": "duty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak rövid ujjú uniform engedélyezett, időjárástól függetlenül."
   }
  ]
 },
 "duty": {
  "text": "Felvetted a dutyt (/duty). Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„James Carter, Deputy Sheriff Trainee, 10-10. Szép napot!”",
    "next": "items",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-10 a szolgálat leadása; a szolgálatba lépés a 10-8."
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
    "text": "„James Carter, Deputy Sheriff Trainee, 10-98. Szép napot!”",
    "next": "items",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-98 azt jelenti, az egység elérhető; a szolgálatba lépés a 10-8."
   }
  ]
 },
 "items": {
  "text": "A felszerelésed összeállításakor melyik dolog az, ami szolgálatban kifejezetten tilos?",
  "choices": [
   {
    "id": "a",
    "text": "A vészhívó: Trainee-ként még nem hordhatod, csak Deputy-ként.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A vészhívó a kötelező duty itemek része, Trainee-ként is."
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
    "text": "A nagy tüske: csak a SAHP egységek vihetik szolgálatba.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nagy tüske is a duty itemek között van, mindenkinek."
   }
  ]
 },
 "alone": {
  "text": "Senki sincs szolgálatban, akinek járőrautója van; egy másik Trainee, Ethan Moore viszont igen. Azt javasolja, vigyetek el egy kocsit kettesben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elvisszük a kocsit, de csak a kapitányság környékén, mert kettesben már nem vagyunk egyedül.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Két Trainee sem járőrözhet, és Trainee nem vihet el csak úgy autót."
   },
   {
    "id": "b",
    "text": "Én elmegyek egyedül gyalog járőrözni a környéken, Ethan pedig marad a tananyagnál.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Trainee semmilyen esetben nem járőrözhet egyedül."
   },
   {
    "id": "c",
    "text": "Nem megyünk: két Trainee sem járőrözhet, kell valaki, akinek van autója. Olvassuk a tananyagot.",
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
    "text": "Igen, ha Sarah megengedi, mert övé a járőrautó, és ő felel érte a szolgálatban.",
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
    "text": "Igen, mert a vizsgára gyakorolnom kell, és a Trainee-hét épp a gyakorlásról szól.",
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
    "text": "Semmi: Trainee-ként csak figyelek, a rádiót a társam kezeli vezetés közben.",
    "next": "ts3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az anyósülésen ülőé a rádió, Trainee-ként is."
   },
   {
    "id": "b",
    "text": "Csak akkor szólok a rádióba, ha valami történik, különben csendben figyelek.",
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
    "text": "Átmegyek hozzájuk beszélgetni, mert a játékon belüli rádiót úgyis látom.",
    "next": "week",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban az SFSD szobái kötelezők."
   },
   {
    "id": "b",
    "text": "Kilépek a TS3-ból, mert szolgálatban a játékbeli rádió is bőven elég.",
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
    "text": "Legalább 7 napig; ha alkalmasnak találnak, a feletteseim felkeresnek a vizsgával.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Minimum 7 nap Trainee-ként; a vizsgára a felettesek és a kiképző hívnak."
   },
   {
    "id": "b",
    "text": "Amíg nem kérem meg a vezetőséget, hogy vizsgáztassanak le és léptessenek elő.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rangokat kéregetni tilos; a vizsgára a felettesek hívnak."
   },
   {
    "id": "c",
    "text": "Pontosan 7 napig: utána a rendszer automatikusan, vizsga nélkül Deputy Sheriff I.-re léptet.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 7 nap a minimum, utána vizsga jön, ha alkalmasnak találnak."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Jó kezdés",
   "text": "Szabályos egyenruha, 10-8, tiltott tárgy nélkül, társsal, aki vezet, rádióval és TS3-mal: így indul egy Trainee hete."
  }
 }
}$json$::jsonb, 170),
('Verekedés a kocsma előtt', 'Két férfi verekszik: szétválasztás, sérült ellátása, szemtanúk, a helyes tételek, a sértegetés és az uszító a tömegben.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Éjjel egy kocsma előtt két férfi verekszik, körülöttük többen kiabálnak. Megérkezel (Code 6). Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Határozott, nyugodt hangon szétválasztom őket, a többieket hátrébb küldöm, és ha kell, erősítést kérek.",
    "next": "injury",
    "points": 2,
    "verdict": "good",
    "feedback": "A deputy nem dühből cselekszik: határozottan, de nyugodtan rendez, és ha kell, segítséget kér."
   },
   {
    "id": "b",
    "text": "Kívülről figyelem őket, megvárom, amíg elfáradnak, és utána igazoltatom mindkettőt a tanúkkal.",
    "next": "injury",
    "points": 0,
    "verdict": "bad",
    "feedback": "Közben valaki súlyosan megsérülhet: be kell avatkozni."
   },
   {
    "id": "c",
    "text": "Gumibottal közéjük lépek, és mindkettőt a földre viszem, mielőtt valaki komolyabban megsérül.",
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
    "text": "Megbilincselem, mert ő is verekedett, és a kirendeltségen ellátják a sebét.",
    "next": "witnesses",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a sérülés: a felelősséget utána tisztázzuk."
   },
   {
    "id": "b",
    "text": "Megkérdezem, kér-e orvost, és ha nem kér, folytatom vele az igazoltatást.",
    "next": "witnesses",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fejsérülésnél ne a sérült döntse el: mentőt kell hívni."
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
    "text": "Egyszerre hallgatom meg őket, hogy egymást kiegészítve pontosabb legyen.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "Együtt befolyásolják egymást: külön-külön kell."
   },
   {
    "id": "b",
    "text": "Elküldöm őket, mert a két verekedő úgyis elmondja, mi történt, és ők a lényegesek.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tanúk tudják, ki kezdte: meg kell hallgatni őket."
   },
   {
    "id": "c",
    "text": "Igazoltatom, és külön-külön meghallgatom őket, hogy kiderüljön, ki kezdte.",
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
    "text": "G/I. (garázdaság magányosan) és TS/I. (könnyű testi sértés).",
    "next": "insult",
    "points": 2,
    "verdict": "good",
    "feedback": "Egyedül, fegyver nélkül: G/I.; a könnyebb sérülés: TS/I."
   },
   {
    "id": "b",
    "text": "G/III. (garázdaság fegyveresen), mert ököllel ütött, és TS/II.",
    "next": "insult",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ököl nem fegyver, és a sérülés könnyű: G/I. és TS/I."
   },
   {
    "id": "c",
    "text": "G/II. (garázdaság csoportosan), mert sokan álltak körülöttük, és TS/I.",
    "next": "insult",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nézők nem tettestársak: Brad egyedül támadt, ezért G/I."
   }
  ]
 },
 "insult": {
  "text": "Brad a bilincselés közben sértegetni kezd. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Visszaszólok neki, hogy tanulja meg, kivel beszél, és felrovom az RSZT-t.",
    "next": "crowd",
    "points": 0,
    "verdict": "bad",
    "feedback": "A deputy tisztelettel beszél, a visszaszólás nem méltó hozzá."
   },
   {
    "id": "b",
    "text": "Szó nélkül hagyom: aki már bilincsben van, annak a sértegetésért nem jár újabb tétel.",
    "next": "crowd",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RSZT önálló tétel; figyelmeztesd higgadtan, és ha folytatja, felróható."
   },
   {
    "id": "c",
    "text": "Higgadt maradok, és figyelmeztetem, hogy a sértegetés (RSZT) külön tétel.",
    "next": "crowd",
    "points": 2,
    "verdict": "good",
    "feedback": "A tisztelet akkor is jár, ha ő nem adja meg: az RSZT-t higgadtan alkalmazzuk, ha folytatja."
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
    "text": "Rendbontás (RB), mert megzavarja a rendet.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RB egy rendezvény rendjével szembeni ellenállás; ide a HREU illik."
   },
   {
    "id": "c",
    "text": "Bűnrészesség (BR), mert segíteni akar a szökésben.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem vett részt bűncselekményben: uszít a hatóság ellen, ez a HREU."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Nyugalom helyreállítva",
   "text": "Szétválasztottad őket, ellátattad a sérültet, meghallgattad a tanúkat, és a helyes tételeket alkalmaztad."
  }
 }
}$json$::jsonb, 180),
('Közösségi járőrözés', 'Egy csendes délután: segítség a lakosságnak, egy panasz, beszélgetés a társsal, OOC provokáció és egy kérdés a deputyk viselkedéséről.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "Csendes délután járőröztök. Egy idős hölgy integet az út szélén. Mit tesztek?",
  "choices": [
   {
    "id": "a",
    "text": "Továbbmegyünk: ha baj van, hívja a 911-et, és a diszpécser onnan kiküld minket hozzá.",
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
    "text": "Lassítunk mellette, és a lehúzott ablakon át kiabálva kérdezzük meg, mit szeretne.",
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
    "text": "„Ez nem a mi dolgunk, asszonyom: a sebességet a közlekedési hatóság ellenőrzi.”",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A TSB épp ezt teszi: a közúti szabályok betartatása a mi dolgunk."
   },
   {
    "id": "b",
    "text": "Megköszönöm, és elmondom neki, hogy panaszt a kapitányságon írásban, névvel tehet.",
    "next": "partner",
    "points": 1,
    "verdict": "ok",
    "feedback": "Udvarias, de továbbhárítod; jobb, ha cselekszel: járőrözés, traffipax."
   },
   {
    "id": "c",
    "text": "Felírom az utcát, esténként arra járőrözünk, és jelzem a TSB-nek traffipaxra.",
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
    "text": "Vezetés közben a telefonunkon nézzük a híreket és a fórumot, amíg nincs riasztás.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A mobiltelefon használata vezetéskor szabálysértés, ránk is vonatkozik."
   },
   {
    "id": "c",
    "text": "Keresünk valakit, akit igazoltathatunk, hogy legyen mit beírni a jelentésbe.",
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
    "text": "Visszaírok neki, hogy megvédjem a frakció becsületét.",
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
    "text": "IC-ben büntetem meg érte, amikor legközelebb igazoltatom.",
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
    "text": "Megköszönöm; panaszt csak személyesen, a Downtown Station recepcióján tehet, névvel és személyi igazolvánnyal.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nyilvános oldal Kapcsolat menüjében is lehet panaszt tenni, névtelenül is."
   },
   {
    "id": "b",
    "text": "Megköszönöm; tisztelettel bánunk mindenkivel, és panaszt a Sheriff's Department oldalán, a Kapcsolat menüben tehet.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A lakossági panaszt a nyilvános oldalon is fogadjuk (az Internal Affairs Bureau vizsgálja); a tisztelet a bizalom alapja."
   },
   {
    "id": "c",
    "text": "Közlöm, hogy a deputyk viselkedése nem tartozik rá, és ha tovább kérdez, megbüntetem RSZT-vel.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy kérdés nem tiszteletlenség, és a lakosság véleménye a mi dolgunk is."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Bizalom építve",
   "text": "Segítettél, komolyan vetted a panaszt, nem ugrottál be a provokációnak, és megmutattad, hová fordulhatnak a lakosok."
  }
 }
}$json$::jsonb, 190),
('CCTV-riasztás', 'Ki mehet ki egy CCTV-riasztásra, mikor csatlakozhatnak a rendes egységek, miért nem megyünk illegális frakciók HQ-jára, és mi a helyzet szolgálaton kívül.', 'patrol', 1, 'start',
 $json${
 "start": {
  "text": "CCTV-riasztás érkezik egy San Fierro-i raktárnál. TSB egység vagy, és pont a közelben jársz. Kimehetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a társam is velem jön: CCTV-riasztásra csak két fős, ADAM egység mehet ki.",
    "next": "request",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem a létszámon múlik: csak a SEB és a METRO megy, mások csak erősítéskérésre."
   },
   {
    "id": "b",
    "text": "Nem: CCTV-re csak a SEB és a PD-n belüli METRO megy; erősítéskérésre mehetnek mások is.",
    "next": "request",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint csak a SEB és a PD-n belüli METRO alosztály megy ki a CCTV-kre; erősítéskéréskor csatlakozhatnak mások."
   },
   {
    "id": "c",
    "text": "Igen: a legközelebbi egység vagyok, és a CCTV-riasztásra bárki reagálhat, aki a közelben van.",
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
    "text": "„6A029 reagál a SEB erősítéskérésére, Code 3!”, és a SEB rangidősét követem.",
    "next": "hq",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha erősítést kérnek, mehetnek a rendes egységek is; a helyszínen a SEB irányít."
   },
   {
    "id": "b",
    "text": "„6A029 reagál a kérésre, Code 3!”, és odaérve elsőként hatolok be a raktárba.",
    "next": "hq",
    "points": 0,
    "verdict": "bad",
    "feedback": "A behatolás a SEB-é; a deputyk csak felkérésre."
   },
   {
    "id": "c",
    "text": "Nem megyek: a CCTV a SEB dolga, erősítéskérés esetén sem mehet rendes egység.",
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
    "text": "Mert a HQ-k környéke az LSPD hatásköre, oda csak ők mehetnek.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem hatásköri kérdés: a CCTV miatti kivonulás tilos oda."
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
    "text": "Mert ott a kamera mindig téves riasztást ad, ezért Code 12.",
    "next": "offduty",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem ezért: a szabályzat tiltja a kivonulást."
   }
  ]
 },
 "offduty": {
  "text": "Szolgálaton kívül, civilben látod, hogy a raktárnál újra mozgás van. MCB-tag vagy. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Felveszem a detektív dutyt, hogy legyen nálam fegyver, és megnézem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A detektív duty hivatalos szolgálat, nem veheted fel csak azért, hogy önvédelmi fegyvered legyen (azonnali hibapont)."
   },
   {
    "id": "b",
    "text": "Odamegyek civilben, és szétnézek, de nem lépek közbe, csak figyelek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Dutyn kívül ne avatkozz bele; ez is magánakció lenne."
   },
   {
    "id": "c",
    "text": "Nem avatkozom bele, és a 911-et hívom: dutyn kívül ez a dolgom.",
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
}$json$::jsonb, 200),
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
    "text": "Elviszem, mert szolgálaton kívül magánemberként, a saját felelősségemre dönthetek.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiltás épp a szolgálaton kívüli időre szól."
   },
   {
    "id": "c",
    "text": "Elviszem, de nem szállok ki, így nem veszek részt a vásárlásban.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fuvar is részvétel: bűnrészesség lehet."
   }
  ]
 },
 "drugs": {
  "text": "Megkínálnak valamivel, amitől „jobban érzed magad”. Holnap reggel szolgálatba lépsz. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Elfogadom, mert csak a szolgálat közbeni használat tilos, és holnapig kimegy.",
    "next": "detective",
    "points": 0,
    "verdict": "bad",
    "feedback": "Illegális szolgálaton kívül is, és a hatása a szolgálatodba is átnyúlhat."
   },
   {
    "id": "b",
    "text": "Elfogadom egyszer, de nem mondom el senkinek a frakcióból.",
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
    "text": "Igen, mert MCB-tagként a detektív duty bármikor felvehető, ha veszélyt érzek.",
    "next": "interfere",
    "points": 0,
    "verdict": "bad",
    "feedback": "Azonnali hibapont: a detektív duty hivatalos szolgálat, nem önvédelem."
   },
   {
    "id": "b",
    "text": "Igen, ha a hazaút alatt nyomozói feladatot is ellátok, például megfigyelek valamit.",
    "next": "interfere",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ürügyként sem: a detektív dutyt nem veheted fel azért, hogy fegyvered legyen."
   },
   {
    "id": "c",
    "text": "Nem: a detektív duty hivatalos szolgálat, önvédelmi fegyverért tilos (azonnali hibapont).",
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
    "text": "Megbírságolom, mert a jelvényem nálam van, és a szabálysértés tiszta.",
    "next": "info",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül nem intézkedsz, jelvénnyel sem."
   },
   {
    "id": "b",
    "text": "Nem intézkedem, mert nem vagyok dutyban; ha veszélyt látok, a 911-et hívom.",
    "next": "info",
    "points": 2,
    "verdict": "good",
    "feedback": "Dutyn kívül ne avatkozz bele a rendőri ügyekbe; vészhelyzetben a 911-et kell hívni."
   },
   {
    "id": "c",
    "text": "Rádión szólok egy szolgálatban lévő kollégának, hogy jöjjön ki.",
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
    "text": "Semmit: az ügyekről és a frakció csoportjaiból információt kiadni tilos.",
    "next": "alt",
    "points": 2,
    "verdict": "good",
    "feedback": "Frakciócsoportokból információt kiadni tilos."
   },
   {
    "id": "b",
    "text": "Csak annyit, amennyi a hírekben is benne volt, mert az már nyilvános.",
    "next": "alt",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amit a SIB közölt, azt ő is elolvashatja; te ne adj hozzá semmit."
   },
   {
    "id": "c",
    "text": "Elmondom neki négyszemközt, mert megbízom benne, és nem adja tovább.",
    "next": "alt",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy kiszivárgott részlet egy egész nyomozást tönkretehet."
   }
  ]
 },
 "alt": {
  "text": "Egy ismerős azt javasolja, hogy a „kis karaktereddel” csatlakozz egy illegális csoporthoz, mert az „nem a sheriff”. Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csatlakozom, mert a kis karakter egy másik ember, és a két frakció nem tud egymásról.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabály épp a kis karakterekre vonatkozik."
   },
   {
    "id": "b",
    "text": "Csatlakozom, csak bankot és ATM-et nem rabolok vele, mert az a szabály.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Már a csatlakozás is tilos engedély nélkül; a bank- és ATM-rablás pedig kis karakterrel is tilos."
   },
   {
    "id": "c",
    "text": "Nemet: SD-tagként kis karakterrel sem lehetek más frakcióban; illegális csoporthoz csak fő-leader engedéllyel.",
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
}$json$::jsonb, 210),
('Sajtó a helyszínen', 'Egy riporter a kordonnál: mit mondhat egy deputy, a Code 20, a Public Information Officer, a sajtótájékoztató, a kiszivárgó képek és a kordon átlépése.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Egy lövöldözés helyszínén a kordonnál állsz. Egy riporter odalép: „Mi történt? Hány halott van?” Mit felelsz?",
  "choices": [
   {
    "id": "a",
    "text": "Elküldöm, és figyelmeztetem, hogy ha még egyszer kérdez, letartóztatom.",
    "next": "code20",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtóval is tisztelettel beszélünk; a kérdezés nem bűncselekmény."
   },
   {
    "id": "b",
    "text": "Elmondom, amit biztosan tudok, mert a nyilvánosságnak joga van a hírekhez.",
    "next": "code20",
    "points": 0,
    "verdict": "bad",
    "feedback": "A hiteles tájékoztatás a SIB dolga; egy félinformáció kárt okozhat."
   },
   {
    "id": "c",
    "text": "Udvariasan közlöm, hogy nem adhatok információt; a sajtót a SIB tájékoztatja.",
    "next": "code20",
    "points": 2,
    "verdict": "good",
    "feedback": "A Sheriff's Information Bureau a hivatalos kommunikációs részleg, ő tájékoztatja hitelesen a médiát."
   }
  ]
 },
 "code20": {
  "text": "A rangidős azt mondja, értesítsék a médiát. Melyik kódot használja?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 10.”",
    "next": "pio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 10 rádiócsend a kutatás információinak közléséhez."
   },
   {
    "id": "b",
    "text": "„10-35.”",
    "next": "pio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-35 bizalmas információ."
   },
   {
    "id": "c",
    "text": "„Code 20.”",
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
    "text": "Egyenruhában van, lőfegyvert és kényszerítő eszközt nem visel.",
    "next": "conference",
    "points": 2,
    "verdict": "good",
    "feedback": "A SIB anyaga szerint a PIO egyenruhában, fegyver és kényszerítő eszköz nélkül dolgozik."
   },
   {
    "id": "b",
    "text": "Civil ruhában van, hogy a sajtó ne a rendőrt lássa benne.",
    "next": "conference",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálati egyenruhában végzi a munkáját."
   },
   {
    "id": "c",
    "text": "Egyenruhában van, fegyvert visel, és a kordonnál is segít.",
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
    "text": "Csak a frakció tagjai és a vezetőség.",
    "next": "leak",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtótájékoztató a sajtónak szól."
   },
   {
    "id": "b",
    "text": "Bárki, aki a helyszínre odaér.",
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
    "text": "Ne tegye: frakciócsoportokból információt kiadni tilos, a közlés a SIB dolga.",
    "next": "cordon",
    "points": 2,
    "verdict": "good",
    "feedback": "Frakciócsoportokból információt kiadni tilos; a közösségi oldalakat a SIB üzemelteti."
   },
   {
    "id": "b",
    "text": "Csak a jó képeket tegye ki, amelyeken a deputyk profin dolgoznak.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Semmilyen képet nem: a közlés a SIB dolga."
   },
   {
    "id": "c",
    "text": "Tegye ki, de a sérültek arcát takarja ki, és jelölje meg forrásként a frakciót.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kitakarás sem segít: a kiszivárgott kép egy nyomozást is veszélyeztethet."
   }
  ]
 },
 "cordon": {
  "text": "A riporter átlép a kordonon, hogy közelebbről fotózzon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Hagyom, mert a sajtó munkáját a kordon sem korlátozhatja.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kordon a helyszín és a riporter biztonságát is védi."
   },
   {
    "id": "b",
    "text": "Felszólítom, hogy menjen vissza; ha nem teszi, HEM miatt intézkedem.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A kordon mindenkire vonatkozik; aki megzavarja az eljárást, felelősségre vonható (hatósági eljárás megzavarása)."
   },
   {
    "id": "c",
    "text": "Elveszem a fényképezőgépét, és a memóriakártyát lefoglalom.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a felszólítás; a lefoglalás itt aránytalan és visszaélés."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Hiteles tájékoztatás",
   "text": "A deputy nem nyilatkozik, a SIB és a PIO tájékoztat, a képek nem szivárognak ki, és a kordon tart."
  }
 }
}$json$::jsonb, 220),
('Havi kötelezettségek', 'Jelentések és duty idő, AI-tilalom, helyesírás és sablon, naplózás, meeting, inaktivitás és a rangkéregetés.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Hónap közepe van. Hány jelentés és mennyi duty idő kötelező havonta?",
  "choices": [
   {
    "id": "a",
    "text": "Havi 8 jelentés és legalább 40 óra duty.",
    "next": "ai",
    "points": 0,
    "verdict": "bad",
    "feedback": "A duty minimuma havi 30 óra."
   },
   {
    "id": "b",
    "text": "Havi 8 jelentés és legalább 30 óra duty.",
    "next": "ai",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint havi 8 jelentés kötelező, és havi 30 óra minimum duty idő elvárt; ez alatt nem jár alapfizetés és rangfelvétel."
   },
   {
    "id": "c",
    "text": "Havi 5 jelentés és legalább 20 óra duty.",
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
    "text": "Nem: AI tilos, és ha észlelik, arra a jelentésre nem jár fizetés.",
    "next": "spelling",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a saját fogalmazásotokra kíváncsiak; AI esetén a jelentésre nem jár fizetés."
   },
   {
    "id": "b",
    "text": "Igen, ha csak a helyesírást javíttatom vele, a tartalmat nem.",
    "next": "spelling",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szabály bármilyen szöveg megírására vonatkozik: AI nélkül."
   },
   {
    "id": "c",
    "text": "Igen, ha utána a saját szavaimmal átírom a nagyobb részét.",
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
    "text": "Helyesírás, mondatvégi írásjelek, a fórum kötelező sablonja, saját fogalmazás.",
    "next": "log",
    "points": 2,
    "verdict": "good",
    "feedback": "A helyesírásra és az írásjelekre kiemelten figyelünk; a fórum sablonjai kötelezők."
   },
   {
    "id": "b",
    "text": "A rövidség: minél rövidebb, annál jobb, írásjel nélkül is.",
    "next": "log",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden mondat végére írásjel kell."
   },
   {
    "id": "c",
    "text": "A tartalom és a sablon; a helyesírás a fórumon nem számít.",
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
    "text": "Kétszer naplózom, mert hosszú volt, így duplán számít.",
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
    "text": "Naplózom a Jelentések oldalon a fórum linkjével.",
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
    "text": "Utólag, a következő héten jelzem a Discordon, miért nem voltam.",
    "next": "inactive",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előtte kell jelezni."
   },
   {
    "id": "b",
    "text": "Előre jelzem a Discord szerveren, hogy nem tudok ott lenni.",
    "next": "inactive",
    "points": 2,
    "verdict": "good",
    "feedback": "A meetingeken és kiképzéseken kötelező megjelenni; ha nem tudsz, a Discord szerveren kell jelezned."
   },
   {
    "id": "c",
    "text": "Nem kell jelezni: a meeting csak a vezetőségnek kötelező.",
    "next": "inactive",
    "points": 0,
    "verdict": "bad",
    "feedback": "A meeting mindenkinek kötelező, a távolmaradást jelezni kell."
   }
  ]
 },
 "inactive": {
  "text": "Két hónapra elutazol. Hogyan kérsz inaktivitást?",
  "choices": [
   {
    "id": "a",
    "text": "Egyszerre kérem a két hónapot, mert előre tudom, meddig leszek távol.",
    "next": "rank",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy hónapnál hosszabbat nem lehet kérni."
   },
   {
    "id": "b",
    "text": "Nem szólok: két hónap után visszajövök, és jelzem a meetingen.",
    "next": "rank",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az inaktivitást a Discordon jelezni kell."
   },
   {
    "id": "c",
    "text": "Egyszerre legfeljebb egy hónapot kérhetek, és havonta jelzem.",
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
    "text": "Írok a vezetőnek, mert a régiség miatt jár nekem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez rangkéregetés, tilos."
   },
   {
    "id": "b",
    "text": "Megkérem a barátaimat, hogy ők szóljanak értem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez is rangkéregetés, csak közvetve."
   },
   {
    "id": "c",
    "text": "Nem kérek: rangokat kéregetni tilos.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat tiltja a rangok kéregetését; az előléptetésről a vezetőség dönt a munkád alapján."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Minden pipa a helyén",
   "text": "Megvan a 8 jelentés és a 30 óra, saját szavaiddal, naplózva, jelezted a távolmaradást, és nem kérted a rangot."
  }
 }
}$json$::jsonb, 230),
('Vadászok ellenőrzése', 'Game Wardenként a vadászterületen: ellenőrzés indok nélkül, láthatósági és lövedékálló mellény, orvvadászat és a bejelentetlen puska.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Game Warden vagy, Ford Raptorral járőrözöl a vadászterületen. Két vadászt látsz; semmi gyanúsat nem csinálnak. Ellenőrizheted őket?",
  "choices": [
   {
    "id": "a",
    "text": "Csak ha lövést hallok, vagy elejtett vadat látok a kocsijukban.",
    "next": "vest",
    "points": 0,
    "verdict": "bad",
    "feedback": "Indok nélkül is ellenőrizheted őket."
   },
   {
    "id": "b",
    "text": "Nem: igazoltatni a vadászokat is csak indokkal lehet, mint bárkit.",
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
    "text": "LMVE: 500 000 – 1 000 000 $.",
    "next": "armor",
    "points": 2,
    "verdict": "good",
    "feedback": "Vadászat közben kötelező a láthatósági mellény; ennek elmulasztása az LMVE."
   },
   {
    "id": "b",
    "text": "Semmi: a mellény csak ajánlott.",
    "next": "armor",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vadászat közben kötelező."
   },
   {
    "id": "c",
    "text": "KFH: 250 000 – 500 000 $.",
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
    "text": "Igen, LMVK: vadászni csak láthatósági mellényben szabad.",
    "next": "license",
    "points": 0,
    "verdict": "bad",
    "feedback": "A láthatósági mellény más tétel (LMVE); a lövedékálló vadászterületen szabad."
   },
   {
    "id": "b",
    "text": "Nem: vadászterületen lövedékálló mellényt szabad hordani.",
    "next": "license",
    "points": 2,
    "verdict": "good",
    "feedback": "Az LMVK megjegyzése szerint vadászterületen szabad."
   },
   {
    "id": "c",
    "text": "Igen, LMVK: lövedékálló mellényt csak a rendvédelem hordhat.",
    "next": "license",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rendvédelem kivétel, de a vadászterület, a lőtér és a magánterület is."
   }
  ]
 },
 "license": {
  "text": "Kiderül, hogy a második vadásznak nincs vadászengedélye, és egy elejtett szarvas van a kocsijában. Melyik tétel?",
  "choices": [
   {
    "id": "a",
    "text": "L (lopás): 500 000 – 1 000 000 $ és 15–30 perc.",
    "next": "weapon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A vad engedély nélküli elejtésének saját tétele van: OV."
   },
   {
    "id": "b",
    "text": "OV: 2 500 000 – 5 000 000 $ és 30–60 perc.",
    "next": "weapon",
    "points": 2,
    "verdict": "good",
    "feedback": "Engedély nélkül vad elejtése vadászterületen: orvvadászat."
   },
   {
    "id": "c",
    "text": "Figyelmeztetés: egy szarvas még nem orvvadászat.",
    "next": "weapon",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az orvvadászat fegyházzal járó bűncselekmény, egy vadnál is."
   }
  ]
 },
 "weapon": {
  "text": "A puskája engedélyes, de az LSPD-nél nincs bejelentve. Mit állapítasz meg?",
  "choices": [
   {
    "id": "a",
    "text": "IFB: engedéllyel is illegális, ha nincs bejelentve az LSPD felé.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az IFB megjegyzése: engedély mellett is illegális a bejelentetlen fegyver."
   },
   {
    "id": "b",
    "text": "IFK: illegális fegyverkereskedelem, mert nincs bejelentve.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kereskedelemről nincs szó; a birtoklás tétele az IFB."
   },
   {
    "id": "c",
    "text": "Rendben van: vadászpuskához elég a vadászengedély.",
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
}$json$::jsonb, 240),
('Jármű, felszerelés, megjelenés', 'Kinek a kocsija, milyen kiegészítő fér bele, a pénztartó táska, a dupla nagykaliber, a köszönés és a jármű visszavitele.', 'other', 1, 'start',
 $json${
 "start": {
  "text": "Szolgálatba lépnél, de a saját járőrautód szervizben van. A kollégád autója szabad a garázsban. Elviheted?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a szolgálat végén visszahozom.",
    "next": "accessories",
    "points": 0,
    "verdict": "bad",
    "feedback": "Másét akkor sem."
   },
   {
    "id": "b",
    "text": "Igen, ha a kollégám szabadságon van.",
    "next": "accessories",
    "points": 0,
    "verdict": "bad",
    "feedback": "Másét semmiképp."
   },
   {
    "id": "c",
    "text": "Nem: csak a saját kocsimat vihetem el.",
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
    "text": "Legfeljebb egy egyszerű darabot, például egy karórát.",
    "next": "moneybag",
    "points": 2,
    "verdict": "good",
    "feedback": "Az idétlen kiegészítőket mellőzzük, és egyszerre ne legyen rajtad több; egy karóra belefér."
   },
   {
    "id": "b",
    "text": "Egy napszemüveget és egy láncot, mert az még csak két darab.",
    "next": "moneybag",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyszerre több kiegészítő sem lehet rajtad."
   },
   {
    "id": "c",
    "text": "Bármennyit, ha egyik sem takarja el az egyenruhát.",
    "next": "moneybag",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyszerre több kiegészítő nem lehet rajtad."
   }
  ]
 },
 "moneybag": {
  "text": "Szolgálat közben pénztartó táskát kaptál egy achievementért. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Megtartom a szolgálat végéig, ha zárva van.",
    "next": "calibre",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálatban tilos hordani: minél hamarabb az ATM."
   },
   {
    "id": "b",
    "text": "Amint tudok, elmegyek egy ATM-hez.",
    "next": "calibre",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint pénztartó táskát szolgálatban tilos hordani; achievement esetén minél hamarabb menj egy ATM-hez."
   },
   {
    "id": "c",
    "text": "Leadom a kapitányság raktárában megőrzésre.",
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
    "text": "Igen, ha az egyik a csomagtartóban van, nem rajtam.",
    "next": "greeting",
    "points": 0,
    "verdict": "bad",
    "feedback": "A járőrözés nem bevetés: egy nagykaliber elég."
   },
   {
    "id": "b",
    "text": "Nem: dupla nagykaliber tilos; kivétel a bevetés, utána azonnal le kell tenni.",
    "next": "greeting",
    "points": 2,
    "verdict": "good",
    "feedback": "A dupla nagykaliber használata tilos, a bevetés a kivétel."
   },
   {
    "id": "c",
    "text": "Igen, ha mindkettő szolgálati, és be van jegyezve a nevemre.",
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
    "text": "„Jó napot, polgártárs!”, mert ez a hivatalos forma.",
    "next": "return",
    "points": 0,
    "verdict": "bad",
    "feedback": "A „polgártárs” sem amerikai forma; egy egyszerű köszönés elég."
   },
   {
    "id": "b",
    "text": "„Erőt, egészséget!”, mert így tisztelem meg.",
    "next": "return",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos: Amerikában vagyunk."
   },
   {
    "id": "c",
    "text": "„Szép napot!”, mert az ORFK-s kifejezések tilosak.",
    "next": "return",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat kifejezetten tiltja az ORFK-s kifejezéseket: Amerikában vagyunk."
   }
  ]
 },
 "return": {
  "text": "A szolgálat végén a kocsid sáros és horpadt. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Így parkolom le, a szerelők reggel úgyis rendbe teszik.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tiéd a feladat: megszerelve és tisztán."
   },
   {
    "id": "b",
    "text": "Lecserélem egy másik, tiszta kocsira a garázsban.",
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
}$json$::jsonb, 250),
('Traffipax-ellenőrzés: melyik tétel?', 'Mért sebességek lakott területen, országúton és autópályán, egy telefonáló sofőr, nyári gumi decemberben és egy menekülő autó.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Decemberi délelőtt van. A TSB egységeként traffipaxszal mérsz az autópálya-felhajtónál (megengedett 120 km/h). Egy szürke Comet 245 km/h-val száguld el. Melyik tételt alkalmazod, ha megállítod?",
  "choices": [
   {
    "id": "a",
    "text": "GYO/IV. – országút 200% (270 km/h felett), 500 000 – 1 000 000 $.",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autópályán az autópályás tételek érvényesek (alap 120 km/h)."
   },
   {
    "id": "b",
    "text": "GYA/IV. – 150% (300 km/h felett), 500 000 – 1 000 000 $, bevonás is lehetséges.",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "A GYA/IV. 300 km/h-tól jár; 245 km/h a 100%-os kategória."
   },
   {
    "id": "c",
    "text": "GYA/III. – 100% (240 km/h felett), 450 000 – 900 000 $, eltiltás is mérlegelhető.",
    "next": "rural",
    "points": 3,
    "verdict": "good",
    "feedback": "245 km/h a 240 km/h-s határ fölött, de a 300 km/h-s alatt: GYA/III. Ennél a szintnél legfeljebb 30 napos eltiltás is lehet."
   },
   {
    "id": "d",
    "text": "GYA/II. – 50% (180 km/h felett), 400 000 – 800 000 $, eltiltás nem jár.",
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
    "text": "GYO/I. – 25% (110 km/h felett), 350 000 – 700 000 $.",
    "next": "town",
    "points": 0,
    "verdict": "bad",
    "feedback": "135 km/h fölött már az 50%-os kategória jár."
   },
   {
    "id": "b",
    "text": "GYO/II. – 50% (135 km/h felett), 400 000 – 800 000 $.",
    "next": "town",
    "points": 2,
    "verdict": "good",
    "feedback": "140 km/h a 135 km/h-s határ fölött, a 180 km/h-s alatt: GYO/II."
   },
   {
    "id": "c",
    "text": "GYO/III. – 100% (180 km/h felett), 450 000 – 900 000 $.",
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
    "text": "Azonnal MDC üldözés jelet rakok és rádiózom, mert egyértelműen menekül.",
    "next": "phone",
    "points": 3,
    "verdict": "good",
    "feedback": "Az üldözési jel főszabály szerint a harmadik felszólítás után jár, kivétel, ha a célszemély egyértelműen le akarja rázni a járőrautót."
   },
   {
    "id": "b",
    "text": "Háromszor felszólítom, és csak a harmadik után rakok MDC üldözés jelet.",
    "next": "phone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kivétel pont erre szól: ha egyértelműen menekül nagy sebességgel, nem kell kivárni a harmadikat."
   },
   {
    "id": "c",
    "text": "Nem üldözöm: a rendszámot rögzítem, és BOLO-t adok ki a járműre, hogy más állítsa meg.",
    "next": "phone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy 210 km/h-val száguldó autó a belvárosban életveszélyes: jelezd az üldözést, hogy a többi egység is bekapcsolódhasson."
   }
  ]
 },
 "phone": {
  "text": "Az Elegy sofőrjét elfogják. Közben egy lassan haladó autó sofőrje szemből nézve telefont tart a füléhez, egy másikat csak hátulról láttál. Kit büntethetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Mindkettőt MHV-vel, mert a hátulról látott is a fülét fogta.",
    "next": "tyres",
    "points": 0,
    "verdict": "bad",
    "feedback": "Hátulról nem látod, mit csinál a sofőr: feltételezés alapján nincs bírság."
   },
   {
    "id": "b",
    "text": "Egyiket sem: a telefonálásra nincs külön tétel a Kalkulátorban.",
    "next": "tyres",
    "points": 0,
    "verdict": "bad",
    "feedback": "Van rá tétel: mobiltelefon használata vezetéskor (MHV)."
   },
   {
    "id": "c",
    "text": "Csak a szemből látottat: MHV, mert IC láttam, hogy telefonál.",
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
    "text": "HJH: november 1. és április 30. között téli vagy négyévszakos gumi kell.",
    "next": "ban",
    "points": 2,
    "verdict": "good",
    "feedback": "A HJH november 1. és április 30. között vonatkozik a nem téli (és nem négyévszakos) abroncsra."
   },
   {
    "id": "b",
    "text": "Semmit: a téli gumi csak havas vagy jeges úton kötelező, a naptári dátum nem számít.",
    "next": "ban",
    "points": 0,
    "verdict": "bad",
    "feedback": "A dátum számít: november 1. és április 30. között téli (vagy négyévszakos) abroncs kötelező."
   },
   {
    "id": "c",
    "text": "HJH: december 1. és március 31. között csak téli gumi fogadható el.",
    "next": "ban",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tétel november 1. és április 30. között szól, és a négyévszakos abroncs is mindig elfogadott."
   }
  ]
 },
 "ban": {
  "text": "Visszagondolsz az Elegyre: 210 km/h egy 50-es zónában. Mi jár ezért?",
  "choices": [
   {
    "id": "a",
    "text": "GYLT/IV., 500 000 – 1 000 000 $; bevonás nincs, csak a bírság.",
    "next": "done",
    "points": 1,
    "verdict": "ok",
    "feedback": "A tétel jó, de a megjegyzés szerint a jogosítvány és a forgalmi is bevonható."
   },
   {
    "id": "b",
    "text": "GYLT/III., 450 000 – 900 000 $; legfeljebb 30 napos eltiltás jár.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "200 km/h fölött már a GYLT/IV. jár, és a bevonás is lehetséges."
   },
   {
    "id": "c",
    "text": "GYLT/IV., 500 000 – 1 000 000 $; a jogosítvány és a forgalmi is bevonható.",
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
}$json$::jsonb, 260),
('Ittas sofőr az éjszakában', 'Kígyózó autó éjjel: igazoltatás, alkoholszonda, őrizetbe vétel, jogok, motozás, kihallgatás és fegyház.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Éjjel kettő van. Egy ezüst Premier kígyózva halad a Gant híd felé, kétszer is átlóg a szemközti sávba. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Gondatlan vezetés miatt igazoltatom: megcélzás, sziréna, felszólítás, mögé húzódás, rádió.",
    "next": "smell",
    "points": 2,
    "verdict": "good",
    "feedback": "A gondatlan vezetés valós indok. A szokásos sorrend és a rádió itt is kötelező."
   },
   {
    "id": "b",
    "text": "Mögötte maradok, megvárom, amíg magától leáll, és közben bemondom a rendszámot.",
    "next": "smell",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aki ittasan vezet, minden méterrel veszélyesebb: állítsd meg."
   },
   {
    "id": "c",
    "text": "Mellé húzódom, és az ablakon át kiabálva szólítom fel, hogy álljon meg.",
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
    "text": "Alkoholszondába fújatom, és az eredményt rádión is bemondom.",
    "next": "result",
    "points": 2,
    "verdict": "good",
    "feedback": "A gyanút bizonyítani kell: az alkoholszonda a duty itemek között van, és a rádió IC lenyomatot ad."
   },
   {
    "id": "b",
    "text": "A szag és a vörös szem elég bizonyíték: szonda nélkül bilincselem.",
    "next": "result",
    "points": 0,
    "verdict": "bad",
    "feedback": "A szag gyanú, nem bizonyíték. Előbb az alkoholszonda."
   },
   {
    "id": "c",
    "text": "Elveszem a kulcsát, és hazaküldöm gyalog, hogy ne vezessen.",
    "next": "result",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ittas vezetés bűncselekmény (JIÁ): nem elég hazaküldeni."
   }
  ]
 },
 "result": {
  "text": "A szonda pozitív. Melyik tétel ez, és mi jár érte?",
  "choices": [
   {
    "id": "a",
    "text": "GV (gondatlan vezetés): 250 000 – 500 000 $, fegyház nélkül.",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kígyózás ok volt a megállításra, de az ittas vezetésnek saját tétele van, fegyházzal."
   },
   {
    "id": "b",
    "text": "KV: 250 000 – 500 000 $, fegyház nélkül.",
    "next": "custody",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ittas vezetésnek saját tétele van (JIÁ), fegyházzal."
   },
   {
    "id": "c",
    "text": "JIÁ: 250 000 – 500 000 $ és 15–30 perc fegyház.",
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
    "text": "Bilincs, a jogai (hallgatás, orvosi ellátás, telefonhívás), majd az autónál részletes RP-vel motozás.",
    "next": "passenger",
    "points": 3,
    "verdict": "good",
    "feedback": "A tananyag szerint: bilincs, jogok, majd a helyszínen az autóhoz állítva motozás, részletes RP-vel."
   },
   {
    "id": "b",
    "text": "Bilincs, motozás az autónál, beültetés; a jogait csak a kirendeltségen, a kihallgatás legelején mondom el.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A jogait az őrizetbe vételkor, a bilincs után kell felsorolni."
   },
   {
    "id": "c",
    "text": "Bilincs, a jogai (hallgatás, ügyvéd, telefonhívás), majd az autónál részletes RP-vel motozás.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A tananyag jogai: hallgatás (és amit mond, felhasználható), orvosi ellátás, telefonhívás."
   }
  ]
 },
 "passenger": {
  "text": "Az anyósülésen egy nő ül, ő is ittas, de nem vezetett. Mi a teendő vele?",
  "choices": [
   {
    "id": "a",
    "text": "Őt is JIÁ-val büntetem, mert ittasan ült egy járó motorú autóban, és bármikor vezethetett volna.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem vezetett, ezért ittas vezetés nem róható fel neki."
   },
   {
    "id": "b",
    "text": "Nem vezetett, ezért odaadom neki a kulcsot, hogy vigye haza az autót.",
    "next": "transport",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő is ittas: ha vezetne, ugyanazt a bűncselekményt követné el."
   },
   {
    "id": "c",
    "text": "Nem vezetett, ezért JIÁ nem jár neki; megkérem, hogy ittasan ne üljön a volán mögé.",
    "next": "transport",
    "points": 2,
    "verdict": "good",
    "feedback": "A JIÁ a vezetőre vonatkozik. Az utas sem vezetheti el a járművet ittasan."
   }
  ]
 },
 "transport": {
  "text": "Beülteted Kevint. Hova viszed, és mi történik útközben?",
  "choices": [
   {
    "id": "a",
    "text": "Hubert Stationre, és útközben Investigatort kérek a kihallgatáshoz.",
    "next": "interrogation",
    "points": 0,
    "verdict": "bad",
    "feedback": "A legközelebbi kirendeltségre kell vinni, Hubert Station kivételével."
   },
   {
    "id": "b",
    "text": "Egyenesen a fegyházba, és ott kérek Investigatort a kihallgatáshoz.",
    "next": "interrogation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen történhet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "A legközelebbi kirendeltségre, és útközben Investigatort kérek a kihallgatáshoz.",
    "next": "interrogation",
    "points": 2,
    "verdict": "good",
    "feedback": "A célszemélyt a legközelebbi kirendeltségre visszük, és útközben kérünk Investigatort; ha nincs, mi hallgatjuk ki."
   }
  ]
 },
 "interrogation": {
  "text": "Nincs szabad Investigator, te hallgatod ki. Hogyan?",
  "choices": [
   {
    "id": "a",
    "text": "Bilincs le, leültetem, RP-ben egyik kezét a fémrúdhoz csatolom, a maszkját leveszem, diktafont használok.",
    "next": "jail",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez a tananyag kihallgatási rendje: a bilincs RP-ben a rúdon marad, maszk nincs, diktafon használható."
   },
   {
    "id": "b",
    "text": "A cellában, bilincsben kérdezem ki, hogy ne kelljen mozgatni, és a vallomását utólag, emlékezetből írom le.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kihallgatás a széken, a rúdhoz csatolva zajlik, és diktafonnal rögzíthető."
   },
   {
    "id": "c",
    "text": "Bilincs le, leültetem, RP-ben egyik kezét a fémrúdhoz csatolom, a maszkja maradhat, diktafont használok.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatáskor a maszkot le kell venni a célszemélyről."
   }
  ]
 },
 "jail": {
  "text": "A kihallgatás végére értél. Mi a sorrend?",
  "choices": [
   {
    "id": "a",
    "text": "Kiosztom a bírságot, majd fegyházba szállítom, az indulást rádión jelezve (10-15).",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatás után a pénzbírság, majd a beszállítás; az indulást rádión jelezni kell."
   },
   {
    "id": "b",
    "text": "Fegyházba szállítom (10-15), a bírságot pedig ott, a fegyházban osztják ki.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bírságot a kihallgatás után te osztod ki, még a beszállítás előtt."
   },
   {
    "id": "c",
    "text": "Kiosztom a bírságot, és fegyházba szállítom; a késői óra miatt nem rádiózom.",
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
}$json$::jsonb, 270),
('Megvesztegetési kísérlet', 'Az igazoltatott sofőr pénzt ajánl, hogy „felejtsd el” a bírságot. Mit tesz egy deputy, és mit, ha a társa is kísértésbe esik?', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "Gyorshajtásért igazoltatsz egy drága Cheetah-t. A sofőr, Victor Hale halkan megszólal: „Deputy, itt van ötszázezer, és felejtsük el az egészet, rendben?” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Visszautasítom, és a megvesztegetési kísérlet miatt őrizetbe veszem.",
    "next": "radio",
    "points": 3,
    "verdict": "good",
    "feedback": "A hivatali személy megvesztegetése (HSZM) súlyos tétel: 3 000 000 – 6 000 000 $ és 30–60 perc fegyház. Nincs alku."
   },
   {
    "id": "b",
    "text": "Elfogadom, és a gyorshajtást figyelmeztetéssel zárom le; senki nem látta.",
    "next": "accepted",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez korrupció (73 §), a legsúlyosabb tételek egyike: 3 000 000 – 6 000 000 $ és 60–90 perc fegyház, és kirúgás jár érte."
   },
   {
    "id": "c",
    "text": "Visszautasítom, és csak a gyorshajtásért bírságolok, a pénzt nem említem.",
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
  "text": "Victor tiltakozik, hogy csak viccelt. Mit teszel a rádióval?",
  "choices": [
   {
    "id": "a",
    "text": "Nem rádiózom, mert csak kettőnk között történt; a jelentésbe utólag, minden részletével beírom.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rádiózás IC lenyomat; nélküle később nincs mire hivatkozni."
   },
   {
    "id": "b",
    "text": "Bemondom, hogy „10-22”, mert a sofőr szerint vicc volt, és a pénzt visszaadom.",
    "next": "partner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-22 egy rádióüzenetet von vissza; a megvesztegetési kísérletet nem lehet visszavonni."
   },
   {
    "id": "c",
    "text": "Bemondom a helyzetet, erősítést kérek a szállításhoz, és a pénzt bizonyítékként rögzítem.",
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
    "text": "Nemet mondok, és jelentem a felettesemnek; a belső ügyeket az IAB vizsgálja.",
    "next": "charges",
    "points": 3,
    "verdict": "good",
    "feedback": "A társ fedezése bűnpártolás lenne. A belső ügyeket az Internal Affairs Bureau vizsgálja."
   },
   {
    "id": "b",
    "text": "Nemet mondok neki, de nem jelentem: egyszer mindenki hibázhat, megbeszéltük.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "A hallgatással fedezed a társadat, ez bűnpártolás. Jelentsd a felettesednek."
   },
   {
    "id": "c",
    "text": "Elfogadom a felét, és a sofőrt a gyorshajtásért sem bírságolom meg.",
    "next": "accepted",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez korrupció: a frakcióból kirúgással jár."
   }
  ]
 },
 "charges": {
  "text": "Victort őrizetbe vetted. Milyen tételeket sorolsz fel?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorshajtás és korrupció (K): 3 000 000 – 6 000 000 $ és 60–90 perc.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A korrupció a hivatalos személyt terheli, aki elfogad. A kínálónak a HSZM jár."
   },
   {
    "id": "b",
    "text": "Csak gyorshajtás: a pénz visszaadásával a kísérlet rendezve van.",
    "next": "jail",
    "points": 0,
    "verdict": "bad",
    "feedback": "A megvesztegetési kísérlet önálló bűncselekmény."
   },
   {
    "id": "c",
    "text": "Gyorshajtás és HSZM: utóbbi 3 000 000 – 6 000 000 $ és 30–60 perc.",
    "next": "jail",
    "points": 2,
    "verdict": "good",
    "feedback": "Mindkét cselekmény külön tétel; a megvesztegetőnek a HSZM jár, fegyházzal."
   }
  ]
 },
 "jail": {
  "text": "A fegyházidő 60 perc lesz. Hol töltheti le?",
  "choices": [
   {
    "id": "a",
    "text": "Fegyházban: a Department celláiban legfeljebb 59 perc adható.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A Department celláiban legfeljebb 59 perces jail adható, 60 perc már a fegyházé."
   },
   {
    "id": "b",
    "text": "Sehol: ha a bírságot kifizeti, a fegyházidő elmarad.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A HSZM fegyházzal jár, a bírság nem váltja ki."
   },
   {
    "id": "c",
    "text": "A Department cellájában: a kirendeltségi cellákban legfeljebb 90 perc adható.",
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
}$json$::jsonb, 280),
('Gázolás és cserbenhagyás', 'Egy autó elüt egy gyalogost, és elhajt. Helyszínbiztosítás, segítségnyújtás, a menekülő jármű leírása és a felelősök.', 'traffic', 2, 'start',
 $json${
 "start": {
  "text": "„Gázolás a Market Streeten, a jármű elhajtott” – hallod a rádióban. Két sarokra vagy. Hogyan reagálsz?",
  "choices": [
   {
    "id": "a",
    "text": "„6A029 10-4” – és megvárom, hogy egy közelebbi egység reagáljon.",
    "next": "scene",
    "points": 0,
    "verdict": "bad",
    "feedback": "Te vagy két sarokra; a 10-4 csak annyi, hogy vetted. Reagálj, és mondd be."
   },
   {
    "id": "b",
    "text": "„6A029 fogadja a hívást, reagál rá, Code 3!” – fényhíddal és szirénával.",
    "next": "scene",
    "points": 2,
    "verdict": "good",
    "feedback": "Sürgős hívásra Code 3-mal reagálunk, fényhíddal és szirénával."
   },
   {
    "id": "c",
    "text": "„6A029 fogadja a hívást, reagál rá, Code 2!” – a forgalom miatt sziréna nélkül.",
    "next": "scene",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; egy sérült gyalogoshoz sürgősen kell menni (Code 3)."
   }
  ]
 },
 "scene": {
  "text": "Odaérsz: a gyalogos a földön fekszik, vérzik, de lélegzik. Körülötte néhányan telefonnal videóznak. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom az érkezést (10-97), biztosítom a helyszínt, mentőt kérek, és elsősegélyt nyújtok.",
    "next": "witness",
    "points": 3,
    "verdict": "good",
    "feedback": "Az élet az első: a helyszín biztosítása, mentő és elsősegély. Az érkezést rádiózni kell."
   },
   {
    "id": "b",
    "text": "Bemondom az érkezést (10-97), és a sérültet a többiekre hagyva a menekülő autó után indulok.",
    "next": "witness",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sérült ellátása és a helyszín biztosítása az első; a jármű leírását rádión bárki megkaphatja."
   },
   {
    "id": "c",
    "text": "Bemondom az érkezést (10-97), és először a videózók adatait veszem fel a mulasztásért.",
    "next": "witness",
    "points": 0,
    "verdict": "bad",
    "feedback": "A segítségnyújtás elmulasztása valóban tétel, de előbb a sérült és a helyszín."
   }
  ]
 },
 "witness": {
  "text": "Egy szemtanú elmondja: egy fekete Washington volt, a rendszámból 3-KFT-et látta, egy férfi vezette, észak felé hajtott. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "„Cserbenhagyás: fekete Washington, rsz. részlet 3KFT, egy fő, észak felé.” És BOLO-t rögzítek.",
    "next": "found",
    "points": 2,
    "verdict": "good",
    "feedback": "A leírás sorrendje: szín, márka, típus, rendszám, a bent ülők száma, és az irány. A BOLO-t minden egység látja."
   },
   {
    "id": "b",
    "text": "„Cserbenhagyás: fekete autó, egy fő, észak felé.” És BOLO-t rögzítek az eligazításon.",
    "next": "found",
    "points": 1,
    "verdict": "ok",
    "feedback": "A BOLO jó, de a márka és a rendszám részlete is kell a leírásba."
   },
   {
    "id": "c",
    "text": "„Cserbenhagyás: Washington, rsz. részlet 3KFT, egy fő.” A BOLO ráér, ha előkerül.",
    "next": "found",
    "points": 0,
    "verdict": "bad",
    "feedback": "Hiányzik a szín és az irány, és a BOLO épp azért kell, hogy előkerüljön."
   }
  ]
 },
 "found": {
  "text": "Egy egység tíz perc múlva megtalálja az autót egy garázsban, a vezetője beismeri a gázolást. Melyik tétel?",
  "choices": [
   {
    "id": "a",
    "text": "GV – gondatlan vezetés, mert nem szándékosan tette: 250 000 – 500 000 $.",
    "next": "bystander",
    "points": 0,
    "verdict": "bad",
    "feedback": "A cserbenhagyásos gázolásnak saját tétele van fegyházzal (KBO/I.)."
   },
   {
    "id": "b",
    "text": "KBO/I. – cserbenhagyásos gázolás: 750 000 – 1 500 000 $, 15–30 perc.",
    "next": "bystander",
    "points": 2,
    "verdict": "good",
    "feedback": "Elütött valakit, és nem állt meg segíteni vagy mentőt hívni: ez a KBO/I."
   },
   {
    "id": "c",
    "text": "KBO/III. – halálesetkor: 1 250 000 – 2 500 000 $, 30–45 perc.",
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
    "text": "BR – bűnrészesség, mert végig ott volt a helyszínen.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bűnrészesség a bűncselekményben való részvétel; ő nem vett részt, csak nem segített."
   },
   {
    "id": "b",
    "text": "SNYE: akkor is vétség, ha nem ő okozta a balesetet.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A segítségnyújtás elmulasztása a tétel megjegyzése szerint akkor is vétség, ha nem ő okozta a balesetet."
   },
   {
    "id": "c",
    "text": "Semmit: aki nem okozta a balesetet, annak nem kötelező segíteni.",
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
}$json$::jsonb, 290),
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
    "text": "Azonnal, már az első felszólítás után, hiszen nem állt meg.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "Főszabály a harmadik felszólítás; ő nem menekül nagy sebességgel, ezért ki kell várni."
   },
   {
    "id": "c",
    "text": "Ha a második felszólításra sem áll meg; a harmadikat már nem kell kivárni.",
    "next": "radio",
    "points": 0,
    "verdict": "bad",
    "feedback": "A harmadik felszólítás után; kivétel, ha egyértelműen le akar rázni nagy sebességgel, de ő most nem ezt teszi."
   }
  ]
 },
 "radio": {
  "text": "A harmadik felszólításra sem áll meg, és most gyorsít. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„6A029, 10-20: Doherty, Code 99! Piros Banshee, rsz.: 2BNS518, egy fő, kelet felé, minden egység!”",
    "next": "order",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 vészhelyzet: minden egység reagáljon. Egy üldözéshez MDC jel és pontos adatok kellenek, nem a teljes állomány."
   },
   {
    "id": "b",
    "text": "„6A029, 10-20: Doherty, MDC jel, 10-99, C3! Piros Banshee üldözése kelet felé.”",
    "next": "order",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó, de hiányzik a rendszám és a bent ülők száma."
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
    "text": "SAHP elöl, mögötte a ROBERT, utána én (TSB), leghátul a Bearcat; teret adok nekik.",
    "next": "passenger",
    "points": 2,
    "verdict": "good",
    "feedback": "Az üldözési sorrend: SAHP ← ROBERT ← TSB ← BEARCAT. Mindig tartani kell, hogy ne hozzátok hátrányba egymást."
   },
   {
    "id": "b",
    "text": "ROBERT elöl, mögötte a SAHP, utána én (TSB), leghátul a Bearcat; teret adok nekik.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sorrend: SAHP ← ROBERT ← TSB ← BEARCAT; a SAHP van elöl."
   },
   {
    "id": "c",
    "text": "Én maradok elöl (TSB), mögöttem a SAHP és a ROBERT, leghátul a Bearcat.",
    "next": "passenger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sorrend nem az érkezésen múlik: a SAHP és a SEB egységek mennek előre."
   }
  ]
 },
 "passenger": {
  "text": "A társad az anyósülésen ül. Mi a dolga?",
  "choices": [
   {
    "id": "a",
    "text": "Kihajol az ablakon, és lövésre készen tartja a fegyverét, ha megállnak.",
    "next": "dropout",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amíg ránk nem lőnek, mi sem lövünk, autóra pedig csak tűzparancsra."
   },
   {
    "id": "b",
    "text": "Mihamarabb bemondja a közös rádióba, amit az üldözött autóról megtud.",
    "next": "dropout",
    "points": 2,
    "verdict": "good",
    "feedback": "Az anyósülésen ülő kötelessége az üldözött járműről szerzett információt mihamarabb közölni a közös rádión."
   },
   {
    "id": "c",
    "text": "Az MDC-n figyeli a térképet, és az üldözés végén foglalja össze a látottakat.",
    "next": "dropout",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az információ most kell a többi egységnek, nem a végén."
   }
  ]
 },
 "dropout": {
  "text": "Egy kanyarban megcsúszol, és kiesel az üldözésből. A többiek már két sarokkal előrébb járnak. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Csak akkor csatlakozom vissza, ha nem akadályozok más egységet; addig követem a rádiót.",
    "next": "shots",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha kiestél, csak akkor térhetsz vissza, ha nem akadályozol más egységet."
   },
   {
    "id": "b",
    "text": "Visszamegyek járőrözni, és szó nélkül átadom a helyem a többieknek.",
    "next": "shots",
    "points": 1,
    "verdict": "ok",
    "feedback": "Biztonságos, de mondd be, hogy kiestél, hogy a többiek tudjanak róla."
   },
   {
    "id": "c",
    "text": "Visszaküzdöm magam a korábbi helyemre a sorban, hiszen az üldözési sorrendben ott volt a helyem.",
    "next": "shots",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sorrendbe csak úgy térhetsz vissza, ha nem akadályozol más egységet."
   }
  ]
 },
 "shots": {
  "text": "A Banshee-ből rálőnek a SAHP egységre. Szabad-e most visszalőni a járműre?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal lőhetek a járműre, mert ránk lőttek; ilyenkor nem kell tűzparancs.",
    "next": "cornered",
    "points": 0,
    "verdict": "bad",
    "feedback": "Autóra éles fegyverrel csak tűzparancs esetén lehet lőni, tűzparancsot pedig csak a rangidős adhat ki."
   },
   {
    "id": "b",
    "text": "Csak a rangidős tűzparancsára lőhetek a járműre; addig bemondom a lövéseket.",
    "next": "cornered",
    "points": 3,
    "verdict": "good",
    "feedback": "Amíg nem lőnek ránk, mi sem lövünk; és ha lőnek, akkor is a rangidős tűzparancsa kell az autóra leadott lövésekhez."
   },
   {
    "id": "c",
    "text": "A sokkolóval célzom meg a járművet, mert az nem halálos erő.",
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
    "text": "„Code 100.”",
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
    "text": "„Code 4”, és bemondom, hogy a legközelebbi kirendeltségre szállítom, Investigatort kérve.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "A kihallgatás csak kirendeltségen lehet; a fegyházba indulást (10-15) a kihallgatás után jelzed."
   },
   {
    "id": "b",
    "text": "„10-8”, és bemondom, hogy a legközelebbi kirendeltségre szállítom, és Investigatort kérek.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 10-8 a szolgálatba állás; a többieket a Code 4 engedi vissza a járőrhöz."
   },
   {
    "id": "c",
    "text": "„Code 4”, és bemondom, hogy a gyanúsítottat egyenesen a fegyházba szállítom (10-15).",
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
    "text": "GV: 250 000 – 500 000 $, mert azért akartam megállítani; a lövés is ide tartozik.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A menekülés és a lövések önálló bűncselekmények."
   },
   {
    "id": "b",
    "text": "RUM: 1 000 000 – 2 000 000 $ és 15–30 perc; a lövésekért külön tételek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A RUM a rendvédelmi utasítás megszegése; a menekülés tétele a REM."
   },
   {
    "id": "c",
    "text": "REM: 1 000 000 – 2 000 000 $ és 15–30 perc; a lövésekért külön tételek.",
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
}$json$::jsonb, 300),
('Betörésjelzés: Code 30 vagy Code 30-Silent', 'Hangos és halk riasztás, Code 6, téves riasztás, egyedül egy betörés helyszínén, egy gyanús hívás és a Code 4.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "A rádióban: „Code 30, a Juniper Hill-i ékszerüzletben megszólalt a riasztó.” Hogyan vonulsz?",
  "choices": [
   {
    "id": "a",
    "text": "Fényhíddal és szirénával, mert hangos riasztásról van szó.",
    "next": "arrive",
    "points": 2,
    "verdict": "good",
    "feedback": "Code 30: betörés folyamatban, megszólalt a riasztó, használjanak szirénát és fényhidat."
   },
   {
    "id": "b",
    "text": "Code 2-vel, a közlekedési szabályokat betartva, fényhíd nélkül.",
    "next": "arrive",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; egy folyamatban lévő betörés sürgős."
   },
   {
    "id": "c",
    "text": "Fényhíd és sziréna nélkül, hogy a betörők ne halljanak meg.",
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
    "text": "„Code 6.”",
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
    "text": "„Code 4-Adam”: téves riasztás; a többi egység visszatérhet.",
    "next": "silent",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4-Adam az erősítésről szól; a téves riasztás kódja a Code 12."
   },
   {
    "id": "b",
    "text": "„Code 12”: téves riasztás; a többi egység visszatérhet.",
    "next": "silent",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 12 a hamis riasztás, téves hívás kódja."
   },
   {
    "id": "c",
    "text": "„Code 77”: téves riasztás; a többi egység visszatérhet.",
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
    "text": "Fényhíd és sziréna nélkül, mert halk riasztásról van szó.",
    "next": "alone",
    "points": 2,
    "verdict": "good",
    "feedback": "Code 30-Silent: betörés folyamatban, halk riasztás, ne használjanak szirénát és fényhidat."
   },
   {
    "id": "b",
    "text": "Fényhíddal, de sziréna nélkül (Code 2-High), hogy gyorsan odaérjek.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "Halk riasztásnál a fényhíd is elárul: se sziréna, se fényhíd."
   },
   {
    "id": "c",
    "text": "Code 3-mal, fényhíddal és szirénával, mint minden betörésnél.",
    "next": "alone",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 3 szirénával jár; halk riasztásnál épp ez a hiba."
   }
  ]
 },
 "alone": {
  "text": "Odaérsz: egy ablak betörve, bent mozgás. Egyedül vagy. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 6”, és bemegyek egyedül, mielőtt a betörők a hátsó kijáraton elmenekülnek.",
    "next": "secure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Életveszélyes, és a behatolás nem a te dolgod, hacsak a rangidős fel nem kér rá."
   },
   {
    "id": "b",
    "text": "„Code 4”, és fedezékből figyelem a kijáratokat, amíg megjön az erősítés.",
    "next": "secure",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nincs szükség erősítésre, pedig épp most van."
   },
   {
    "id": "c",
    "text": "„Code 6-Adam”, és fedezékből figyelem a kijáratokat, amíg megjön az erősítés.",
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
    "text": "„Code 4-Adam”: nincs szükség további erősítésre, az egységek úton vannak.",
    "next": "trap",
    "points": 1,
    "verdict": "ok",
    "feedback": "A Code 4-Adam azt jelzi, hogy az úton lévők jönnek tovább; itt nincs rájuk szükség, ezért a Code 4."
   },
   {
    "id": "b",
    "text": "„Code 4”: nincs szükség további erősítésre, térjenek vissza a járőrhöz.",
    "next": "trap",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha minden kéz megvan, a Code 4 felszabadítja a még úton lévőket."
   },
   {
    "id": "c",
    "text": "„Code 99”: mindenki jöjjön, amíg a betörőt átadjuk a szállításnak.",
    "next": "trap",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 vészhelyzet, minden egység jöjjön: épp az ellenkezője kell."
   }
  ]
 },
 "trap": {
  "text": "Hazafelé egy hívás: valaki egy elhagyatott dokk végére hív, mert „rablást látott”. A nevét nem mondja meg, és többször is kéri, hogy egyetlen egység menjen, csendben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 77”, és csak több egységgel, óvatosan megyünk ki a dokkhoz.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 77 jelzi, hogy csapdába akarhatnak csalni; ilyenkor senki ne menjen egyedül."
   },
   {
    "id": "b",
    "text": "„Code 77”, és egyedül megyek ki, de a fegyveremet készenlétben tartom.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 77 jó, de épp ezért ne menj egyedül."
   },
   {
    "id": "c",
    "text": "„Code 30-Silent”, és egyedül, csendben megyek ki, ahogy kérte.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pont ezt akarja egy csapda; a gyanút a Code 77 jelzi."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Mindig a jó kóddal",
   "text": "Code 30 és 30-Silent, Code 6 és 6-Adam, Code 12, Code 4 és Code 77: a helyzethez illő kódokat használtad."
  }
 }
}$json$::jsonb, 310),
('Légi támogatás: az AIR egység', 'Az Aero Bureau pilótája egy üldözésben: ki repülhet, mit rádiózol, mi a dolgod a levegőben, Los Santos légtere, vízbe ugró gyanúsított, leszállás.', 'radio', 2, 'start',
 $json${
 "start": {
  "text": "Byerly J Skylor vagy, Sergeant I., AB képesítéssel. Járőrrepülésre indulnál, amikor egy kolléga, aki még nem tette le az AB vizsgát, elkérné a helikoptert. Mit mondasz?",
  "choices": [
   {
    "id": "a",
    "text": "„Elviheted, ha én ülök melletted, és szükség esetén átveszem.”",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vizsga nélkül akkor sem: a feltétel a letett vizsga."
   },
   {
    "id": "b",
    "text": "„A helikoptert csak a megfelelő vizsga letételével viheted el.” Én viszem.",
    "next": "patrol",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a helikoptert csak a megfelelő vizsga letételével lehet elvinni."
   },
   {
    "id": "c",
    "text": "„Elviheted, ha egy Sergeant vagy magasabb rangú engedélyt ad rá, és óvatosan repülsz.”",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erre nincs engedély: a feltétel a letett vizsga."
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
    "text": "„6-AIR-001, 10-20: San Fierro, az egység járőrszolgálatot lát el, 10-6.”",
    "next": "pursuit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Járőrözés közben riasztható vagy: 10-98, nem 10-6."
   },
   {
    "id": "c",
    "text": "„6-AIR-001 felszállt, járőrszolgálatot lát el San Fierro felett.”",
    "next": "pursuit",
    "points": 1,
    "verdict": "ok",
    "feedback": "Jó, de a 10-20 és a 10-98 (riasztható) kimaradt."
   }
  ]
 },
 "pursuit": {
  "text": "Egy földi üldözés indul Doherty felett. Csatlakozol. Mit mondasz be?",
  "choices": [
   {
    "id": "a",
    "text": "„6-AIR-001, 10-20: MDC jel, Code 2!”, és a gyanúsított fölé repülök.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; üldözésnél a C3 jelzi a sürgősséget."
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
    "text": "„6-AIR-001, 10-20: MDC jel, Code 99!”, és a gyanúsított fölé repülök.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy üldözéshez nem kell minden egység; a Code 99 vészhelyzet."
   }
  ]
 },
 "role": {
  "text": "Mi a legfontosabb dolgod az üldözés alatt?",
  "choices": [
   {
    "id": "a",
    "text": "Követem, és ha lassít, leszállok előtte az úton, hogy a helikopterrel zárjam el az útját.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "Életveszélyes; leszállni kijelölt vagy széles, tisztás helyen lehet."
   },
   {
    "id": "b",
    "text": "Követem és megfigyelem, és tájékoztatom a földieket az irányáról és a veszélyekről.",
    "next": "border",
    "points": 3,
    "verdict": "good",
    "feedback": "Ezek az AIR egység szerepei egy üldözésben: követés, megfigyelés, tájékoztatás, a veszélyforrások jelzése, a légtér ellenőrzése."
   },
   {
    "id": "c",
    "text": "Követem, és ha kell, a helikopterből lövök a kocsira, hogy megálljon.",
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
    "text": "Nem szólok: üldözésnél a határátlépést nem kell rádiózni, így a légtérbe lépést sem.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez a földi egységek szabálya; az AB tananyaga szerint a légtérbe lépést jelezni kell az LSPD-nek."
   },
   {
    "id": "b",
    "text": "Megfordulok a határon: Los Santos légterébe SFSD-helikopter nem repülhet be.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "Repülhetsz, csak jelezd az LSPD-nek."
   },
   {
    "id": "c",
    "text": "/rsp „SFSD to LSPD! A 6-AIR-001-es egység belép a Los Santos-i légtérbe üldözés céljából!”",
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
    "text": "„Itt a SFSD Aero Bureau egysége! Felszólítom, hogy maradjon a vízben, emelje fel a kezét, és ne mozduljon, amíg a hajónk oda nem ér!”",
    "next": "boat",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az AB felszólítása: ússzon ki a legközelebbi partra, és hasaljon le."
   },
   {
    "id": "b",
    "text": "„Itt a SFSD Aero Bureau egysége! Ha nem úszik ki azonnal a partra, tüzet nyitunk!”",
    "next": "boat",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy úszó, fegyvertelen emberrel szemben aránytalan fenyegetés."
   },
   {
    "id": "c",
    "text": "„Itt a SFSD Aero Bureau egysége! Felszólítom, hogy ússzon ki a legközelebbi partra, hasaljon a földre, és ne mozduljon!”",
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
    "text": "Igen: hajót akkor lehet vinni, ha az üldözött vízben menekül, és most ez a helyzet.",
    "next": "landing",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint hajót akkor vihetsz el, ha az üldözött vízben menekül."
   },
   {
    "id": "b",
    "text": "Nem: hajót csak a SEB vihet el, és csak előre tervezett, vízi bevetésen, vezetői engedéllyel.",
    "next": "landing",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nincs ilyen szabály; a feltétel az, hogy az üldözött vízben meneküljön."
   },
   {
    "id": "c",
    "text": "Igen, és utána a hajóval a kikötőt is bejárhatja járőrözésként.",
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
    "text": "Kijelölt „H” helyen vagy széles, tisztás terepen; szűkebb helyen csak, ha az akció megköveteli.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az AB tananyaga szerint csak kijelölt vagy széles, tisztás helyre lehet leszállni, kivétel, ha az akció megköveteli."
   },
   {
    "id": "b",
    "text": "Bármelyik épület tetején a part közelében, mert egy lapos tetőn mindig biztonságos és gyors a leszállás.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "„H” jelölés nélküli épülettetőre csak akkor, ha az akció megköveteli."
   },
   {
    "id": "c",
    "text": "Az úton, a parthoz legközelebb: a forgalmat a földi egységek megállítják.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Balesetveszélyes; kijelölt vagy széles, tisztás terep kell."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Szem az égen",
   "text": "Vizsgával repültél, rádióztad a csatlakozást és a légtérbe lépést, tájékoztattad a földi egységeket, és biztonságosan szálltál le."
  }
 }
}$json$::jsonb, 320),
('Gyalogos üldözés és a sokkoló', 'A gyanúsított gyalog menekül: rádió, vészhívó, mikor nem szabad sokkolót használni, eldobott fegyver, vízben menekülő, /visz.', 'arrest', 2, 'start',
 $json${
 "start": {
  "text": "Egy igazoltatásnál a gyanúsított, Jayden Cross kiugrik az autóból, és a kikötő felé fut. Egyedül vagy (LINCOLN). Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Bemondom a gyalogos üldözést, az irányt és a leírását, Code 6-Adam, és utána eredek.",
    "next": "button",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden új fejleményt rádiózni kell; a Code 6-Adam azt jelzi, hogy elhagyod a járművet, és erősítés kell."
   },
   {
    "id": "b",
    "text": "Bemondom a Code 4-et, és utána eredek, mert gyalog úgyis gyorsabb vagyok nála, nem kell segítség.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nem kell erősítés; egyedül, egy menekülő után épp kell."
   },
   {
    "id": "c",
    "text": "Utána eredek, és csak akkor rádiózom, ha már utolértem és megbilincseltem.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rádió nélkül senki sem tudja, merre jársz, ha baj lesz."
   }
  ]
 },
 "button": {
  "text": "Futás közben látod, hogy a derekán valami fémes csillan. Használhatod a vészhívót?",
  "choices": [
   {
    "id": "a",
    "text": "Nem: a vészhívó csak lövöldözéshez való, gyalogos üldözéshez a rádió elég.",
    "next": "gun",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyalogos üldözés is ilyen eset."
   },
   {
    "id": "b",
    "text": "Csak akkor, ha a gyanúsítottnál biztosan fegyvert látok, addig nem szabad.",
    "next": "gun",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyalogos üldözés már önmagában ok a vészhívóra."
   },
   {
    "id": "c",
    "text": "Igen: gyalogos üldözésnél, lövöldözésnél és súlyos eseteknél használható.",
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
    "text": "Fegyvert váltok, és fedezékből felszólítom: éles fegyverre nem lőhetek sokkolóval.",
    "next": "water",
    "points": 3,
    "verdict": "good",
    "feedback": "Sokkolóval tilos éles fegyverre lőni, kivéve, ha nincs időd átváltani, vagy IC így beszéltétek meg a társaddal a taktikát."
   },
   {
    "id": "b",
    "text": "A sokkolóval lövök rá, mert az nem halálos erő, és így élve, sérülés nélkül el tudom fogni.",
    "next": "water",
    "points": 0,
    "verdict": "bad",
    "feedback": "Éles fegyverrel szemben a sokkoló tilos, ha van időd fegyvert váltani."
   },
   {
    "id": "c",
    "text": "Kilépek a fedezékből, és nyugodt hangon rábeszélem, hogy tegye le a fegyvert.",
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
    "text": "Igen: a vízben amúgy is lelassul, és a sokkoló gyorsan, sérülés nélkül megállítja.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Vízben lévő emberre a sokkoló tilos: megfulladhat."
   },
   {
    "id": "b",
    "text": "Nem: utána ugrom, és a vízben bilincselem meg, mielőtt átúszik a túlpartra.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül a vízben veszélyes; a part, az AIR és a hajó biztonságosabb."
   },
   {
    "id": "c",
    "text": "Nem: vízben lévőre tilos; AIR egységet és hajót kérek, és a parton várom.",
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
    "text": "Lefoglalom, és a szolgálati kocsiban tartom tartaléknak, amíg a jelentést megírom.",
    "next": "shore",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt fegyvert le kell adni; magadnál tartani visszaélés."
   },
   {
    "id": "b",
    "text": "Kiürítem, és beledobom a vízbe, hogy a környéken senki más ne használhassa fel.",
    "next": "shore",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez bizonyíték: megsemmisíteni bűncselekmény (célravezető bizonyíték eltitkolása)."
   },
   {
    "id": "c",
    "text": "Lefényképezem a helyszínen, rögzítem, lefoglalom, és bizonyítékként leadom.",
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
    "text": "Bilincs, a jogai, és /visz-szel, futva viszem a kocsihoz, hogy gyorsabb legyen.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos /visz-ben futni."
   },
   {
    "id": "b",
    "text": "Bilincs, a jogai, és /visz-szel, sétálva kísérem a kocsihoz.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint tilos /visz-ben futni."
   },
   {
    "id": "c",
    "text": "A jogai, és bilincs nélkül kísérem a kocsihoz, mert elfáradt az úszásban.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Aki egyszer már megszökött, újra próbálkozhat: bilincs kell."
   }
  ]
 },
 "charges": {
  "text": "Milyen tételek jönnek szóba?",
  "choices": [
   {
    "id": "a",
    "text": "Csak REM: a fegyvert eldobta, így a birtoklás már nem róható fel.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az eldobás nem teszi meg nem történtté a birtoklást."
   },
   {
    "id": "b",
    "text": "FSZ (fogolyszökés), és IFB, ha a pisztoly nincs bejelentve az LSPD felé.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Még nem volt fogoly: a menekülés tétele a REM."
   },
   {
    "id": "c",
    "text": "REM, és IFB, ha a pisztoly nincs bejelentve az LSPD felé.",
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
}$json$::jsonb, 330),
('Fegyveres utas az igazoltatáson', 'Pisztoly egy utas derekán: higgadt utasítás, /elvesz, bejelentetlen fegyver, lefoglalás a csomagtartóból, a sofőr és az arányos erő.', 'arrest', 2, 'start',
 $json${
 "start": {
  "text": "ADAM egységben igazoltattok egy fekete Ballert. Az anyósülésen ülő férfi derékszíjában pisztoly markolata látszik. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Fegyvert rántok, és hangosan, ordítva követelem, hogy azonnal szálljon ki a kocsiból.",
    "next": "disarm",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fenyegetés nélkül aránytalan; ezzel épp kiprovokálhatod a bajt."
   },
   {
    "id": "b",
    "text": "Nyugodtan felszólítom, hogy tartsa a kezét látható helyen; a társam erősítést kér.",
    "next": "disarm",
    "points": 2,
    "verdict": "good",
    "feedback": "Higgadt, határozott utasítás és erősítés: a helyzet így kezelhető, kapkodás nélkül."
   },
   {
    "id": "c",
    "text": "Nem szólok róla, befejezem az igazoltatást, és csak a végén kérdezek rá.",
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
    "text": "Hagyom nála, amíg nem fenyeget, és figyelem a kezét.",
    "next": "permit",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres személy fegyverét el kell venni."
   },
   {
    "id": "b",
    "text": "Megkérem, hogy két ujjal adja ki az ablakon, és átveszem.",
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
    "text": "IFK: illegális fegyverkereskedelem, mert nincs bejelentve; 4 000 000 – 8 000 000 $.",
    "next": "trunk",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kereskedelemre nincs utalás; a birtoklás tétele az IFB."
   },
   {
    "id": "b",
    "text": "IFB: engedély ellenére illegális, ha nincs bejelentve az LSPD-nél; 3 000 000 – 6 000 000 $.",
    "next": "trunk",
    "points": 3,
    "verdict": "good",
    "feedback": "A tétel megjegyzése szerint a fegyver akkor is illegális, ha van engedély, de nincs bejelentve az LSPD-nél."
   },
   {
    "id": "c",
    "text": "Rendben van: az érvényes fegyverviselési engedély elég, az LSPD-s bejelentés csak ajánlott.",
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
    "text": "Lefoglalom, bizonyítékként rögzítem, és leadom.",
    "next": "driver",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint a csomagtartóból vagy széfből lefoglalt fegyvert le kell adni."
   },
   {
    "id": "b",
    "text": "Visszateszem, mert a sofőr szerint nem az övé, és nem tud róla.",
    "next": "driver",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalás nem a tulajdonoson múlik: bizonyíték, le kell adni."
   },
   {
    "id": "c",
    "text": "Lefoglalom, és a járőrautóban tartom, amíg a szolgálat tart.",
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
    "text": "Elküldöm, mert a fegyverek az utasé voltak, neki nincs köze hozzá.",
    "next": "force",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ő autójában voltak a fegyverek: ki kell hallgatni."
   },
   {
    "id": "b",
    "text": "Ellenőrzöm (10-29), és kihallgatásra viszem; hogy tudott-e róla, az ott derül ki.",
    "next": "force",
    "points": 2,
    "verdict": "good",
    "feedback": "Feltételezés helyett kihallgatás: így derül ki, mi a szerepe."
   },
   {
    "id": "c",
    "text": "Azonnal őrizetbe veszem illegális fegyverkereskedelemért, mert az autó az ő nevén van.",
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
    "text": "Halálos erővel: megtámadta a társamat, ezért a szabály szerint már lőhetek rá.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyvertelen, menekülő emberrel szemben a halálos erő aránytalan."
   },
   {
    "id": "b",
    "text": "Arányos erővel: lefogjuk, vagy sokkolóval megállítom; halálos erő nem jöhet szóba.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A halálos erő csak akkor alkalmazható, ha a személy súlyos veszélyt jelent; egy fegyvertelen menekülőnél a tompa vagy energikus eszköz az arányos."
   },
   {
    "id": "c",
    "text": "Hagyom futni, és a rádióban leírom, merre ment, hogy más fogja el.",
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
}$json$::jsonb, 340),
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
    "text": "Mindkettőt a fegyházba viszem, és ott hallgatjuk ki őket külön-külön, nyugodtan.",
    "next": "who",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kihallgatás csak kirendeltségen lehet, fegyházban nem."
   },
   {
    "id": "c",
    "text": "Együtt ültetem le őket a kihallgatóban, hogy egymás előtt mondják el a történteket.",
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
    "text": "Megvárom: ha van elérhető Investigator, csak ő hallgathatja ki őket.",
    "next": "prep",
    "points": 3,
    "verdict": "good",
    "feedback": "Ha van elérhető Investigator (aki ráér), csak ők hallgathatnak ki. Field Staff csak akkor, ha nincs."
   },
   {
    "id": "b",
    "text": "Én, mert Corporal vagyok, és a Field Staff bármikor kihallgathat, ha ő hozta be.",
    "next": "prep",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rang itt nem számít: elérhető Investigator mellett neki kell átadni."
   },
   {
    "id": "c",
    "text": "Én kezdem el, hogy ne teljen az idő, és amikor odaér, átadom neki.",
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
    "text": "A cellában hagyom bilincsben, és a rácson át kérdezem ki, a maszkja nélkül.",
    "next": "record",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kihallgatás a kihallgatóban, a széken, a rúdhoz csatolva zajlik."
   },
   {
    "id": "b",
    "text": "Bilincs le, leültetem, egyik kezét RP-ben a fémrúdhoz csatolom, a maszkját leveszem.",
    "next": "record",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatásnál a bilincs RP-vel a rúdon marad, a maszkot levesszük."
   },
   {
    "id": "c",
    "text": "Bilincs le, leültetem, egyik kezét RP-ben a fémrúdhoz csatolom, a maszkját rajta hagyom.",
    "next": "record",
    "points": 0,
    "verdict": "bad",
    "feedback": "A maszkot kihallgatáskor le kell venni."
   }
  ]
 },
 "record": {
  "text": "Mivel rögzíted a kihallgatást?",
  "choices": [
   {
    "id": "a",
    "text": "Diktafonnal, hogy a vallomás később is visszahallgatható legyen.",
    "next": "questions",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint kihallgatásnál diktafont alkalmazhatunk."
   },
   {
    "id": "b",
    "text": "Sehogy: emlékezetből írom meg a jelentést, az is elég bizonyíték.",
    "next": "questions",
    "points": 0,
    "verdict": "bad",
    "feedback": "Emlékezetből nincs mire hivatkozni; a diktafon IC bizonyíték."
   },
   {
    "id": "c",
    "text": "A telefonommal, és feltöltöm a frakció Discordjára a többieknek.",
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
    "text": "Közlöm vele, hogy ha nem beszél, a cellában majd megtanítjuk rá.",
    "next": "fine",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kényszerítés hatósági eljárásban (KHE) bűncselekmény."
   },
   {
    "id": "b",
    "text": "Higgadtan rákérdezek a tetteire, a társaira és az ellentmondásokra.",
    "next": "fine",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatáson megkérdőjelezzük a tetteiket, a társaikat; a hallgatás joga megilleti, nem fenyegetjük."
   },
   {
    "id": "c",
    "text": "Megígérem neki, hogy ha mindent elmond, aznap bírság nélkül elengedjük.",
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
    "text": "Bírság (RA), a zsákmány nála marad, majd fegyház, az indulást rádiózva.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rablás tételénél a kifosztott összeget vagy tárgyakat is el kell venni."
   },
   {
    "id": "b",
    "text": "Bírság (RA, a zsákmányt is elvesszük), majd fegyház, az indulást rádiózva.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Kihallgatás után bírság, majd beszállítás; a rablásnál a kifosztott összeget vagy tárgyakat is el kell venni."
   },
   {
    "id": "c",
    "text": "Bírság (RA, a zsákmányt is elvesszük), majd 90 perc a Department cellájában.",
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
}$json$::jsonb, 350),
('Lövések a garázsnál', 'Rád és a társadra lőnek: fedezék, vészhívó, Code 99, elsősegély /hp nélkül, a SEB megy előre, ki ad tűzparancsot, magánakció, ki nyomoz.', 'patrol', 2, 'start',
 $json${
 "start": {
  "text": "Társaddal (6A033) egy doherty-i garázs előtt igazoltattok, amikor lövések dördülnek, és a társad a lábán megsérül. Mit teszel azonnal?",
  "choices": [
   {
    "id": "a",
    "text": "Fedezékbe húzom magunkat, megnyomom a vészhívót, és bemondom: lövöldözés, sérült kolléga, Code 99.",
    "next": "aid",
    "points": 3,
    "verdict": "good",
    "feedback": "Lövöldözésnél szabad a vészhívó; a Code 99 vészhelyzet, minden egység reagáljon."
   },
   {
    "id": "b",
    "text": "Kiállok a fedezékből, és visszalövök oda, ahonnan a lövéseket hallom, hogy fedezzem a társamat.",
    "next": "aid",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb fedezék és segítség: vaktában lőni a civilekre is veszélyes."
   },
   {
    "id": "c",
    "text": "Fedezékbe húzom magunkat, és bemondom: lövöldözés, sérült kolléga, Code 4, a pozíciónk a garázs bejárata.",
    "next": "aid",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nem kell erősítés: épp most kell, Code 99."
   }
  ]
 },
 "aid": {
  "text": "Fedezékben vagytok. A társad vérzik. Te nem vagy SEB Medic. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Otthagyom a fedezékben, és előbb megkeresem a lövőt, mielőtt még egyszer ránk lőne.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sérült társad ellátása és a segítség hívása az első."
   },
   {
    "id": "b",
    "text": "A /hp paranccsal ellátom, mert vészhelyzetben bárki használhatja, és PARAMEDIC-et kérek.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A /hp csak a SEB Medicek joga, vészhelyzetben is."
   },
   {
    "id": "c",
    "text": "Nyomókötéssel ellátom, amennyit biztonságosan tudok, és PARAMEDIC egységet kérek.",
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
    "text": "Mindenki egyszerre megy be minden ajtón, hogy a lövőnek ne legyen ideje.",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kaotikus és életveszélyes: a SEB megy előre."
   },
   {
    "id": "b",
    "text": "A SEB megy előre és hatol be; mi kint biztosítjuk a terepet.",
    "next": "fire",
    "points": 2,
    "verdict": "good",
    "feedback": "Nagyobb lövöldözésnél vagy akciónál mindig a SEB megy előre; a kint lévők a terepet biztosítják."
   },
   {
    "id": "c",
    "text": "Én megyek be elsőként, mert én voltam itt előbb, és ismerem a terepet.",
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
    "text": "A SEB bármelyik tagja, mert ők mennek elöl.",
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
    "text": "Bárki, aki közvetlen veszélyt lát.",
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
    "text": "Belemegyek, ha a társam is jön, és előtte szólunk egy Sergeantnek, hogy tudjon róla.",
    "next": "investigation",
    "points": 0,
    "verdict": "bad",
    "feedback": "A létszám és a tájékoztatás sem teszi szabályossá a magánakciót."
   },
   {
    "id": "b",
    "text": "Belemegyek, de csak szolgálaton kívül, civilben, hogy ne érintse a frakciót.",
    "next": "investigation",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szolgálaton kívül is tilos az illegális tevékenység, és a magánakció is."
   },
   {
    "id": "c",
    "text": "Nemet mondok: a magánakció tilos; az ügyet a nyomozókra bízzuk.",
    "next": "investigation",
    "points": 2,
    "verdict": "good",
    "feedback": "Magánakciózni bárkinek szigorúan tilos, és szolgálaton kívül illegális tevékenységet sem végezhetünk."
   }
  ]
 },
 "investigation": {
  "text": "Melyik iroda vizsgálja azt a lövöldözést, amelyben a társad megsérült?",
  "choices": [
   {
    "id": "a",
    "text": "A Homicide Bureau: az osztály személyzetét érintő lövöldözések hozzá tartoznak.",
    "next": "report",
    "points": 2,
    "verdict": "good",
    "feedback": "A Homicide Bureau vizsgálja az osztály személyzetét érintő, sérülést vagy halált okozó lövöldözéseket."
   },
   {
    "id": "b",
    "text": "A Narcotics Bureau, mert a lövöldözés egy ismert drogbanda területén, Dohertyben történt.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "A helyszín nem dönt: a személyzetet érintő lövöldözés a Homicide Bureau-é."
   },
   {
    "id": "c",
    "text": "Az IAB: minden lövöldözést, amelyben deputy sérül, belső ügyként vizsgálnak.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az IAB a panaszokat és a belső problémákat vizsgálja; a deputyt ért támadás a Homicide Bureau-é."
   }
  ]
 },
 "report": {
  "text": "A nap végén mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "AI-jal megíratom a fórum sablonja szerint, átolvasom, és naplózom a Jelentések oldalon.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Tilos AI-t használni; észlelés esetén arról a jelentésről megvonják a fizetést."
   },
   {
    "id": "b",
    "text": "Saját szavaimmal megírom a fórum sablonja szerint, és naplózom a Jelentések oldalon.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A jelentést magad írod (AI használata tilos), és a naplózással számít a fizetésnél."
   },
   {
    "id": "c",
    "text": "Nem írok jelentést: a lövöldözésről a nyomozók úgyis megírják a sajátjukat.",
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
}$json$::jsonb, 360),
('Banda a parkban: FI-kártya és SanGang', 'Operation Safe Streets járőr: Field Interview, mi kell a SanGang adatbázishoz, Code 6-Gang, metagaming, graffiti és az információ továbbítása.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Az Operation Safe Streets (Gang Enforcement Team) egyenruhás járőreként a Jefferson Parkban vagy. Egy fiatal férfi kék bandanában ül egy padon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Őrizetbe veszem, mert a kék bandana egyértelmű bandajel a parkban.",
    "next": "fi",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem lehet random letartóztatni valakit azért, mert „bandásan néz ki”; a profilalkotás tilos."
   },
   {
    "id": "b",
    "text": "Lefotózom messziről, de nem szólítom meg, mert a ruhája miatt nem lehet.",
    "next": "fi",
    "points": 0,
    "verdict": "bad",
    "feedback": "Megszólítani lehet: az FI nem letartóztatás, hanem adatgyűjtés."
   },
   {
    "id": "c",
    "text": "Udvariasan igazoltatom, és Field Interview (FI) kártyát töltök ki róla.",
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
    "text": "Név, becenév, lakcím, telefon, banda, a gyanúm indoka, és egy fotó a közösségi oldaláról.",
    "next": "sangang",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az FI tényeket rögzít (azonosító jegyek, hely, idő, intézkedő), nem vélekedést."
   },
   {
    "id": "b",
    "text": "Név, becenév, születési idő, lakcím, telefon, banda (ha van), azonosító jegyek, hely, idő, az intézkedő neve és jelvényszáma.",
    "next": "sangang",
    "points": 2,
    "verdict": "good",
    "feedback": "Ez az OSS FI-kártyájának mintája."
   },
   {
    "id": "c",
    "text": "Csak a név és a banda; a többi adatot a SanGang adatbázis magától kitölti, ha bekerül.",
    "next": "sangang",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az adatbázishoz az azonosító jegyek, a hely és az idő is kell, és ezeket te rögzíted."
   }
  ]
 },
 "sangang": {
  "text": "A férfi nyakán tetoválás van, és kék a ruhája. Felvehető a SanGang adatbázisba bandatagként?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a kollégám is bandatagnak látja, mert két tanú elég.",
    "next": "gang6",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem vélemény kell, hanem három azonosító jegy."
   },
   {
    "id": "b",
    "text": "Még nem: legalább három azonosító jegy kell; itt kettő van.",
    "next": "gang6",
    "points": 3,
    "verdict": "good",
    "feedback": "Bandatag csak akkor kerülhet be a SanGang rendszerbe, ha legalább három azonosító jegy van."
   },
   {
    "id": "c",
    "text": "Igen: a tetoválás és a ruházat együtt már elég a felvételhez.",
    "next": "gang6",
    "points": 0,
    "verdict": "bad",
    "feedback": "Legalább három azonosító jegy kell (például tetoválás, ruházat, szimbólum)."
   }
  ]
 },
 "gang6": {
  "text": "Később a park sarkán öt hasonló öltözetű férfi gyűlik össze, kézjeleket mutogatnak, kettőnél kés. Mit rádiózol?",
  "choices": [
   {
    "id": "a",
    "text": "„Code 6-Adam”, a pozíció, és a csoportot egyedül oszlatom fel.",
    "next": "mg",
    "points": 0,
    "verdict": "bad",
    "feedback": "A csoportos bandatevékenység kódja a Code 6-Gang, és egy késes csoportot egyedül ne oszlass fel."
   },
   {
    "id": "b",
    "text": "„Code 6-Charles”, a pozíció, és erősítést kérek.",
    "next": "mg",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 6-Charles körözött bűnözőt jelez a helyszínen."
   },
   {
    "id": "c",
    "text": "„Code 6-Gang”, a pozíció, és erősítést kérek.",
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
    "text": "„Ne írd be, csak mondd el a rádióban, hogy mindenki tudjon róla.”",
    "next": "graffiti",
    "points": 0,
    "verdict": "bad",
    "feedback": "OOC tudást IC csatornán terjeszteni szintén metagaming."
   },
   {
    "id": "b",
    "text": "„Ne metagamelj: amit OOC tudsz, azt IC-ben kell bizonyítani.”",
    "next": "graffiti",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS tananyaga szerint ha OOC tudod, hogy ki bandatag, IC-ben bizonyíték kell; minden történésnek IC lenyomata kell."
   },
   {
    "id": "c",
    "text": "„Írd be az aktába, de jelöld meg, hogy OOC forrásból tudjuk.”",
    "next": "graffiti",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az OOC forrás megjelölése sem segít: IC bizonyíték nélkül nem kerülhet az aktába."
   }
  ]
 },
 "graffiti": {
  "text": "Két fiatalt tetten érsz, ahogy banda-graffitit festenek egy falra. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Igazoltatom őket, FI-t töltök ki, fotón dokumentálom a graffitit, és a rongálásért felelősségre vonom őket.",
    "next": "report",
    "points": 2,
    "verdict": "good",
    "feedback": "Graffitinél FI-kártya és fotódokumentáció készül; maga a festés rongálás."
   },
   {
    "id": "b",
    "text": "Igazoltatom őket, és lefestetem velük a falat, így nincs szükség FI-re és dokumentációra.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez nem eljárás: FI és dokumentáció kell, a rongálás pedig tétel."
   },
   {
    "id": "c",
    "text": "Igazoltatom őket, fotón dokumentálom a graffitit, és a rongálásért felelősségre vonom őket, FI nélkül.",
    "next": "report",
    "points": 1,
    "verdict": "ok",
    "feedback": "A fotó és az eljárás jó, de FI-kártya is kell róluk."
   }
  ]
 },
 "report": {
  "text": "Mit kezdesz a nap végén az összegyűjtött információkkal?",
  "choices": [
   {
    "id": "a",
    "text": "Jelentést írok, és közzéteszem a frakció nyilvános oldalán, hogy a lakosság is lássa.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Frakcióinformációt kiadni tilos; a nyilvánosság a SIB dolga, az információ az MCB-é."
   },
   {
    "id": "b",
    "text": "Megtartom a jegyzeteimben, amíg egy saját akciót össze nem tudok rakni belőle.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az információ a nyomozásé, át kell adni; a magánakció tilos."
   },
   {
    "id": "c",
    "text": "Jelentést írok, és átadom a Major Crimes Bureau-nak.",
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
}$json$::jsonb, 370),
('Megfigyelés Code 5 alatt', 'Egy díler napi rutinjának feltérképezése: akta, civil autó, Code 5, jegyzetek, gyalogos követés, parancs kérése és a rajtaütés.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Investigator II. vagy. Egy feltételezett díler, Carlos Vega napi rutinját kell feltérképezned. Hogyan kezded?",
  "choices": [
   {
    "id": "a",
    "text": "Aktát nyitok, és civil autóból, feltűnés nélkül figyelem és jegyzetelek.",
    "next": "code5",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden ügy megkezdésekor kötelező aktát nyitni; a megfigyelés civil autóból, jegyzeteléssel zajlik."
   },
   {
    "id": "b",
    "text": "Aktát nyitok, odamegyek hozzá, és megkérdezem, mivel foglalkozik mostanában.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel figyelmeztetnéd: a megfigyelés titkos."
   },
   {
    "id": "c",
    "text": "Aktát nyitok, és jelölt járőrautóból figyelem a háza előtt, hogy lássa: figyeljük.",
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
    "text": "„Code 5”: megfigyelés folyik, a jelölt egységek kerüljék a körzetet.",
    "next": "notes",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 5 jelzi, hogy megfigyelés folyik, és a jelölt egységek kerüljék a helyszínt."
   },
   {
    "id": "b",
    "text": "Semmit: minél kevesebben tudnak a megfigyelésről, annál biztosabb a siker.",
    "next": "notes",
    "points": 0,
    "verdict": "bad",
    "feedback": "Code 5 nélkül egy arra járó jelölt egység lebuktathat."
   },
   {
    "id": "c",
    "text": "„Code 10”: rádiócsendet kérek, amíg a megfigyelés folyik a körzetben.",
    "next": "notes",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 10 rádiócsend a kutatás információinak közléséhez; a megfigyelés kódja a Code 5."
   }
  ]
 },
 "notes": {
  "text": "Három estén át figyeled. Mit rögzítesz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak a bűncselekményeket, amiket látok; a napi rutin nem bizonyíték.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rutin a lényeg: a találkozók és időpontok vezetnek a bizonyítékhoz."
   },
   {
    "id": "b",
    "text": "Semmit írásban, hogy a jegyzet ne kerülhessen illetéktelen kézbe.",
    "next": "patrol",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jegyzet nélkül nincs jelentés és nincs parancs."
   },
   {
    "id": "c",
    "text": "Időpontokat, helyeket, kivel és milyen járművel találkozik, és fényképeket.",
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
    "text": "Kiszállok, és odasétálok hozzájuk, hogy elmondjam nekik: megfigyelés van.",
    "next": "foot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ezzel te bukod le a megfigyelést."
   },
   {
    "id": "b",
    "text": "Rádión diszkréten emlékeztetem, hogy Code 5 van érvényben a körzetben.",
    "next": "foot",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 5-öt mindenkinek tartania kell; egy rövid emlékeztető megmentheti a megfigyelést."
   },
   {
    "id": "c",
    "text": "Semmit: nem akarom, hogy a rádióban kiderüljön, hol vagyok, majd utána folytatom.",
    "next": "foot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Lehet, hogy nem lesz utána: szólj nekik a rádióban."
   }
  ]
 },
 "foot": {
  "text": "Carlos gyalog indul a belvárosba. Hogyan követed?",
  "choices": [
   {
    "id": "a",
    "text": "Autóval, lassan mellette gurulva, hogy gyorsan reagálhassak.",
    "next": "deal",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez a legfeltűnőbb módszer."
   },
   {
    "id": "b",
    "text": "Kettesben, gyalog, rádióval tartjuk a kapcsolatot, és fényképezünk.",
    "next": "deal",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS lábmegfigyelési mintája: két deputy gyalog követ, rádión tartják a kapcsolatot, és fotóznak."
   },
   {
    "id": "c",
    "text": "Egyedül, néhány lépésre mögötte, hogy biztosan ne veszítsem szem elől.",
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
    "text": "Dokumentálom, és házkutatási parancsot kérek az aktában: rajtaütés csak parancs alapján.",
    "next": "warrant",
    "points": 3,
    "verdict": "good",
    "feedback": "Minden rajtaütés és házkutatás parancs alapján történik."
   },
   {
    "id": "b",
    "text": "Dokumentálom, és egyedül azonnal letartóztatom mindkettőt, mielőtt eltűnnek.",
    "next": "warrant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül veszélyes, és a nagyobb fogás (a raktár, a forrás) elúszik."
   },
   {
    "id": "c",
    "text": "Dokumentálom, és egy járőrrel később igazoltattatom a vevőt valami kifogással.",
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
    "text": "Egy jóváhagyásra jogosult nyomozó vagy vezető, de soha nem én, aki kértem.",
    "next": "raid",
    "points": 2,
    "verdict": "good",
    "feedback": "Az aktában a parancsot a jogosultak hagyják jóvá; a saját kérését senki sem hagyhatja jóvá."
   },
   {
    "id": "b",
    "text": "Én magam, mert én nyitottam az aktát, és én vezetem a nyomozást.",
    "next": "raid",
    "points": 0,
    "verdict": "bad",
    "feedback": "A saját kérésedet nem hagyhatod jóvá."
   },
   {
    "id": "c",
    "text": "Bármelyik Investigator, aki látja az aktát, akár a saját kérésemet is.",
    "next": "raid",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak a jóváhagyásra jogosultak, és a saját kérését senki."
   }
  ]
 },
 "raid": {
  "text": "A parancs megvan. Hogyan zajlik a rajtaütés?",
  "choices": [
   {
    "id": "a",
    "text": "Bármikor és bárhogyan: a parancs után minden szabad, a SEB csak opció.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A parancs nem mindenre felhatalmazás: a terv és a SEB kell."
   },
   {
    "id": "b",
    "text": "Hajnalban, a SEB-bel: ők hatolnak be, mi biztosítunk és dokumentálunk.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "Az OSS mintája a hajnali, SEB-bel közös rajtaütés; behatolni a SEB hatol be."
   },
   {
    "id": "c",
    "text": "Délben, kettesben becsengetünk, és a parancsot felmutatva bemegyünk.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy dílerhez nem megyünk kettesben, és a behatolás a SEB dolga."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Türelem és parancs",
   "text": "Akta, Code 5, jegyzetek, kettesben követés, parancs a jogosulttól, és SEB-es rajtaütés."
  }
 }
}$json$::jsonb, 380),
('Egy betörés helyszínelése', 'Akta és helyszínbiztosítás, ujjlenyomat a tananyag lépéseivel, DNS-minta, az OOC bizonyíték szabálya, telefonbemérés, járműtulajdonos, lefoglalt tárgyak.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Betörést jelentenek egy garcia-i lakásba; a tulajdonos szerint ékszereket vittek el. Investigator I. vagy. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Megvárom, amíg a tulajdonos rendet rak, és utána nyitok aktát.",
    "next": "prints",
    "points": 0,
    "verdict": "bad",
    "feedback": "A rendrakás eltünteti a nyomokat."
   },
   {
    "id": "b",
    "text": "Aktát nyitok, és biztosítom a helyszínt, hogy senki ne nyúljon semmihez.",
    "next": "prints",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden ügy megkezdésekor kötelező aktát nyitni; a helyszín érintetlensége a bizonyítékok miatt kell."
   },
   {
    "id": "c",
    "text": "Aktát nyitok, és körbejárom, mindent megfogok, hogy lássam, mi hiányzik.",
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
    "text": "UV lámpával megkeresem, és a telefonommal fotózom le, a por és a szalag felesleges.",
    "next": "dna",
    "points": 0,
    "verdict": "bad",
    "feedback": "A por és a szalag kell, hogy a minta tisztán kirajzolódjon és megőrizhető legyen."
   },
   {
    "id": "b",
    "text": "UV lámpa, por, ecset, a felesleg le, átlátszó szalag, majd papírra ragasztom.",
    "next": "dna",
    "points": 3,
    "verdict": "good",
    "feedback": "Ez a tananyag lépése: por és ecset, a felesleg eltávolítása, szalag, papír; utána fotózható, elemezhető."
   },
   {
    "id": "c",
    "text": "UV lámpa, por, ecset, majd a lenyomatot nedves ruhával tisztítom, hogy jól látsszon.",
    "next": "dna",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nedves ruha letörli a lenyomatot; a felesleges port ecsettel kell eltávolítani."
   }
  ]
 },
 "dna": {
  "text": "Egy vércseppet találsz egy üvegszilánkon. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Vattás fültisztító pálcikával vagy vattaecsettel mintát veszek.",
    "next": "ooc",
    "points": 2,
    "verdict": "good",
    "feedback": "DNS-minta nyerhető testnedvből, hajszálból; a mintavétel vattás pálcikával vagy ecsettel történik."
   },
   {
    "id": "b",
    "text": "Hagyom, mert a vér csak a Coroner jelentésében lehet bizonyíték.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "A helyszíni vérből is nyerhető DNS-minta."
   },
   {
    "id": "c",
    "text": "Papírzsebkendővel feltörlöm, és a zsebkendőt egy borítékba teszem.",
    "next": "ooc",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szennyezett, használhatatlan minta lesz belőle."
   }
  ]
 },
 "ooc": {
  "text": "Az ujjlenyomat alapján egy gyanúsítottra gondolsz. Mit kell OOC is igazolni?",
  "choices": [
   {
    "id": "a",
    "text": "Hogy a személy ott járt és látható volt: OOC bizonyíték kötelező.",
    "next": "trace",
    "points": 2,
    "verdict": "good",
    "feedback": "A tananyag szerint az ujjlenyomatnál OOC bizonyíték kötelező arról, hogy az a személy látható volt."
   },
   {
    "id": "b",
    "text": "Semmit: az IC ujjlenyomat önmagában mindent bizonyít a bíróságon.",
    "next": "trace",
    "points": 0,
    "verdict": "bad",
    "feedback": "OOC bizonyíték nélkül nem lehet rá építeni."
   },
   {
    "id": "c",
    "text": "Hogy a tulajdonos is megnevezte: az ő vallomása elég az ujjlenyomat mellé.",
    "next": "trace",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy megnevezés nem bizonyítja, hogy ott járt: OOC bizonyíték kell."
   }
  ]
 },
 "trace": {
  "text": "Megvan a gyanúsított telefonszáma. Bemérheted a helyzetét?",
  "choices": [
   {
    "id": "a",
    "text": "Bármikor, egy /lenyomoz paranccsal; az RP és a /try csak ajánlott.",
    "next": "vehicle",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak nagyon indokolt esetben, és az RP és a /try kötelező."
   },
   {
    "id": "b",
    "text": "Csak házkutatási paranccsal, amit a vezetőség hagy jóvá, RP nélkül.",
    "next": "vehicle",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem parancs kell hozzá, hanem nagyon indokolt eset, 10 soros RP és /try."
   },
   {
    "id": "c",
    "text": "Csak nagyon indokolt esetben, 10 soros előzetes RP-vel, és a /try kötelező.",
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
    "text": "Bemondom 10-28-ra, és az eredményt az aktához csatolom.",
    "next": "evidence",
    "points": 1,
    "verdict": "ok",
    "feedback": "Azt mutatja meg, körözik-e; a tulajdonost a /getvehowner adja."
   },
   {
    "id": "b",
    "text": "Körbekérdezem a környéken, ki ismeri a rendszámot, és felírom.",
    "next": "evidence",
    "points": 0,
    "verdict": "bad",
    "feedback": "Lassú és bizonytalan, amikor egy lekérdezés megmondja."
   },
   {
    "id": "c",
    "text": "/getvehowner paranccsal lekérdezem, és az aktához csatolom.",
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
    "text": "Hazaviszem a szekrényembe, amíg az ügy le nem zárul.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez visszaélés: a lefoglalt tárgy útja rögzített."
   },
   {
    "id": "b",
    "text": "Lefoglalom, lefoglalt tárgyként rögzítem az aktában, és a végén visszaadjuk.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A lefoglalt tárgyak útját az aktában rögzítjük: így bizonyíték marad."
   },
   {
    "id": "c",
    "text": "Azonnal visszaadom a tulajdonosnak, és a jelentésben megemlítem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rögzítés nélkül az ügyben nincs bizonyíték."
   }
  ]
 },
 "done": {
  "end": {
   "title": "Helyszínelés tankönyv szerint",
   "text": "Akta, érintetlen helyszín, szabályos ujjlenyomat és DNS, OOC bizonyíték, indokolt bemérés és rögzített lefoglalás."
  }
 }
}$json$::jsonb, 390),
('Fegyverüzlet nyomában', 'Egy deputy fülébe jut egy fegyverüzlet: ki buktathat, az informátor, a szerep egy akcióban, Code 5, a kordon szabálya, a lefoglalás és a tétel.', 'mcb', 2, 'start',
 $json${
 "start": {
  "text": "Deputy Sheriff III. vagy, nem vagy MCB-tag. Egy ismerős a kikötőben elmondja, hogy este nyolckor fegyverüzlet lesz a 3-as raktárnál. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Este a társammal odamegyünk, és lebuktatjuk őket, mert az információt én szereztem meg.",
    "next": "informant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Sima sheriffeknek tilos buktatni; ez magánakció lenne."
   },
   {
    "id": "b",
    "text": "Szólok a barátaimnak, hogy ma este kerüljék a kikötőt, aztán jelentem az MCB-nek.",
    "next": "informant",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ügyről információt kiadni tilos; így az egész akció kiszivároghat."
   },
   {
    "id": "c",
    "text": "Jelentem az MCB-nek: fegyverüzlet buktatásába csak Investigator vagy leader kezdhet bele.",
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
    "text": "Bizalmasan (10-35) elmondom neki, és jelzem: informátort csak engedéllyel lehet kezelni.",
    "next": "plan",
    "points": 2,
    "verdict": "good",
    "feedback": "Informátort csak engedéllyel lehet használni, és a neve bizalmas információ."
   },
   {
    "id": "b",
    "text": "Nem mondom el: az én informátorom, és a neve csak nálam lehet biztonságban.",
    "next": "plan",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az informátorokat az MCB kezeli engedéllyel; neked a továbbítás a dolgod."
   },
   {
    "id": "c",
    "text": "Bemondom a közös rádióba a nevét, hogy mindenki tudja, kitől jön az információ.",
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
    "text": "Beépülök vevőnek a raktárba, mert ismerem a környéket, és engem nem ismernek fel.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fedett munka az MCB nyomozóinak feladata, szabályokkal."
   },
   {
    "id": "b",
    "text": "Én vezetem a buktatást, hiszen én hoztam az információt az MCB-nek.",
    "next": "code5",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az akciót Investigator vagy leader vezeti."
   },
   {
    "id": "c",
    "text": "Amit a terv rám bíz, például a kordont vagy egy kijáratot, a rangidős szerint.",
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
    "text": "Code 20-at, hogy a média is ott legyen, amikor lecsapunk.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A média értesítése lebuktatná az akciót."
   },
   {
    "id": "b",
    "text": "Code 30-at: betörés van folyamatban a kikötőben, mindenki figyeljen.",
    "next": "cordon",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 30 betörés, megszólalt riasztó; a megfigyelés kódja a Code 5."
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
    "text": "Nem: a kordon lezárásáig civilre tilos lőni; csak bent lévőre vagy kint lövöldözőre.",
    "next": "seized",
    "points": 2,
    "verdict": "good",
    "feedback": "Bevetéseknél a kordon lezárásáig tilos a civilekre lőni; a tűzparancsot a rangidős adja."
   },
   {
    "id": "b",
    "text": "Igen, ha a SEB kéri, mert akkor a kiadott tűzparancs a gyanús autókra is vonatkozik.",
    "next": "seized",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kordon szabálya mindenkire vonatkozik, a tűzparancsot pedig a rangidős adja."
   },
   {
    "id": "c",
    "text": "Igen, ha gyorsan halad, mert a kordon közelében minden gyanús autó célpont.",
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
    "text": "A legjobbat megtartom a kocsimban, a többit leadjuk.",
    "next": "charge",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lefoglalt fegyvert le kell adni, a dupla nagykaliber pedig tilos."
   },
   {
    "id": "b",
    "text": "Dokumentálják, lefoglalják, az aktához rögzítik és leadják.",
    "next": "charge",
    "points": 2,
    "verdict": "good",
    "feedback": "A lefoglalt fegyvert le kell adni, és az aktában rögzíteni."
   },
   {
    "id": "c",
    "text": "Szétosztják a SEB-esek között, mert ők vitték a kockázatot.",
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
    "text": "IFB: 3 000 000 – 6 000 000 $ és 30–60 perc; az engedélyét meghagyják.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az eladó nemcsak birtokolt, hanem kereskedett is: IFK."
   },
   {
    "id": "b",
    "text": "L (lopás): 500 000 – 1 000 000 $ és 15–30 perc, a fegyverek miatt.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez fegyverkereskedelem, nem lopás."
   },
   {
    "id": "c",
    "text": "IFK: 4 000 000 – 8 000 000 $ és 30–60 perc; ha van engedélye, bevonják.",
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
}$json$::jsonb, 400),
('FAB: a lejárt bérletű autószerviz', 'Financial Administration Bureau ügynökként: /entlist, bizonyíték, tájékoztatás, nincs halasztás, pecsét és /closecarshop, távollévő tulajdonos, jelentés, hibás parancs.', 'other', 2, 'start',
 $json${
 "start": {
  "text": "Field Agent vagy a Financial Administration Bureau-nál. Honnan tudod, mely vállalkozások működnek lejárt bérlettel?",
  "choices": [
   {
    "id": "a",
    "text": "Az /entlist alapján, és képernyőképet mentek róla.",
    "next": "prepare",
    "points": 2,
    "verdict": "good",
    "feedback": "Az FAB ügynökei a bérleti határidőket az /entlist alapján figyelik, a bizonyíték képernyőkép."
   },
   {
    "id": "b",
    "text": "Végigjárom az üzleteket, és a tulajdonosoktól kérem el a bérleti szerződést.",
    "next": "prepare",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az /entlist pontosan megmutatja, hol jár le a bérlet."
   },
   {
    "id": "c",
    "text": "A /closecarshop listája alapján, és képernyőképet mentek róla.",
    "next": "prepare",
    "points": 0,
    "verdict": "bad",
    "feedback": "A /closecarshop a bezárás parancsa; a bérleteket az /entlist mutatja."
   }
  ]
 },
 "prepare": {
  "text": "Az ID12-es CarShop bérlete öt napja lejárt. Mit teszel, mielőtt odamész?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal kivonulok, a bizonyítékot a helyszínen a tulajdonostól kérem el.",
    "next": "owner",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bizonyíték az /entlist képernyőképe, és még indulás előtt kell."
   },
   {
    "id": "b",
    "text": "Discordon üzenek a tulajdonosnak, hogy zárjon be, mert lejárt a bérlete.",
    "next": "owner",
    "points": 0,
    "verdict": "bad",
    "feedback": "Discordon csak előzetes IC kapcsolatfelvétel után lehet egyeztetni, és a zárás az ügynök dolga."
   },
   {
    "id": "c",
    "text": "Képernyőkép az /entlistről, majd FAB azonosítással vonulok a helyszínre.",
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
    "text": "Felajánlom, hogy egy kis díjért cserébe elnézem a lejárt bérletet.",
    "next": "delay",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ügynök nem élhet vissza a pozíciójával: ez korrupció."
   },
   {
    "id": "b",
    "text": "Szó nélkül lezárom, mert a lejárt bérlet miatt tájékoztatás nem jár.",
    "next": "delay",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ha jelen van, tájékoztatni kell."
   },
   {
    "id": "c",
    "text": "IC bemutatkozom, tájékoztatom a lejárt bérletről, és teret adok az RP-nek.",
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
    "text": "Nem lehet: a zárás nem halasztható, azonnali intézkedés.",
    "next": "close",
    "points": 2,
    "verdict": "good",
    "feedback": "A FAB GYIK-je szerint a zárás nem halasztható."
   },
   {
    "id": "b",
    "text": "Ha a Lead Officer jóváhagyja, egy hétig halaszthatom.",
    "next": "close",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zárást senki jóváhagyásával nem lehet halasztani."
   },
   {
    "id": "c",
    "text": "Rendben, egy napot adok, ha holnapig rendezi a bérletet.",
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
    "text": "/closecarshop, a pecsét RP felesleges, képernyőkép.",
    "next": "absent",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RP pecsét is része az eljárásnak."
   },
   {
    "id": "b",
    "text": "A tulajdonossal záratom be, és képernyőképet mentek.",
    "next": "absent",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zárás az ügynök feladata."
   },
   {
    "id": "c",
    "text": "RP pecsét, /closecarshop, képernyőkép.",
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
    "text": "Csak ha a Bureau Director személyesen is jelen van a zárásnál.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ehhez nem kell a Director."
   },
   {
    "id": "b",
    "text": "Nem: csak a tulajdonos jelenlétében, tájékoztatás után zárhatok.",
    "next": "report",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jogos zárásnál a jelenléte nem feltétel."
   },
   {
    "id": "c",
    "text": "Igen: jogos zárásnál a tulajdonos jelenléte nem feltétel.",
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
    "text": "A parancs és az időpont; a megállapítás és a képek csak hibás zárásnál kellenek.",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sablon minden pontja kell, a mellékletekkel, minden zárásnál."
   },
   {
    "id": "b",
    "text": "A FAB sablon: azonosító, dátum, ügynök, partnerek, vállalkozás, megállapítás, RP, parancs, képernyőképek.",
    "next": "mistake",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden zárásról jelentés készül a sablon szerint, a képernyőképeket csatolni kell."
   },
   {
    "id": "c",
    "text": "Elég egy rövid szóbeli beszámoló a vezetőnek, a képernyőképeket megtartom.",
    "next": "mistake",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden zárásról írásos jelentés kell, a képernyőképekkel."
   }
  ]
 },
 "mistake": {
  "text": "Rájössz, hogy rossz ID-t adtál meg, és egy rendben lévő üzletet zártál le. Mi a teendő?",
  "choices": [
   {
    "id": "a",
    "text": "Gyorsan lezárok egy másik lejárt üzletet is, hogy kiegyenlítsem a hibát.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez újabb visszaélés lenne."
   },
   {
    "id": "b",
    "text": "Hallgatok, és ha a tulajdonos szól, akkor egy újranyitással rendezem.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Eltitkolni súlyosabb, mint hibázni."
   },
   {
    "id": "c",
    "text": "Azonnal jelzem a vezetőségnek; a képernyőképeket és a logot megőrzöm a belső kivizsgáláshoz.",
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
}$json$::jsonb, 410),
('Felony stop: a körözött jármű', 'Körözött jármű a forgalomban: rádió menet közben, megbizonyosodás, fedezék, erősítés helye, a felszólítások sorrendje, ellenállás, utasok.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "Járőrözés közben a 10-28 egy szürke Sentinelre jelez: két napja fegyveres rablás miatt körözik, a BOLO szerint a sofőr kopasz, szakállas férfi. A volán mögött épp ilyen férfi ül, mellette valaki. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal szirénázom, megállítom, és a vezetőoldali ablakhoz sétálok, hogy igazoltassam.",
    "next": "sure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres rablás gyanúsítottjánál előbb a rádió és az erősítés; az ablakhoz pedig nem sétálunk oda."
   },
   {
    "id": "b",
    "text": "Követem feltűnés nélkül, és csak akkor szólok a rádióba, ha megáll valahol.",
    "next": "sure",
    "points": 0,
    "verdict": "bad",
    "feedback": "Már menet közben riasztani kell az egységeket, hogy időben odaérjenek."
   },
   {
    "id": "c",
    "text": "Még menet közben riasztom az egységeket: pozíció, a körözött jármű, és erősítést kérek.",
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
    "text": "Felony stop csak akkor jár, ha megbizonyosodtunk, hogy a körözött ül benne; itt a sofőr is egyezik.",
    "next": "pull",
    "points": 2,
    "verdict": "good",
    "feedback": "A felony stopot csak akkor alkalmazzuk, ha tényleg megbizonyosodtunk arról, hogy a körözött személy ül a járműben."
   },
   {
    "id": "b",
    "text": "Nem fontos: a körözött rendszám önmagában elég a felony stophoz, bárki is vezeti a járművet.",
    "next": "pull",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy körözött autót más is vezethet: a személyről kell megbizonyosodni."
   },
   {
    "id": "c",
    "text": "Nem fontos: felony stopot bármelyik gyanúsan viselkedő autónál alkalmazhatunk, ha erősítés van.",
    "next": "pull",
    "points": 0,
    "verdict": "bad",
    "feedback": "Csak akkor, ha megbizonyosodtunk róla, hogy a körözött személy ül benne."
   }
  ]
 },
 "pull": {
  "text": "Felszólítod a félreállásra, a Sentinel lehúzódik. Hova állsz, és mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Mellé állok, hogy jól lássam a sofőrt, és az ablakon át szólítom fel a bent ülőket.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "Mellette nincs fedezéked, és a tűzvonalba kerülsz."
   },
   {
    "id": "b",
    "text": "Mögé állok, kinyitom az ajtómat, és fedezékként használva szólítom fel a bent ülőket.",
    "next": "backup",
    "points": 2,
    "verdict": "good",
    "feedback": "A jármű mögé állunk, mint egy igazoltatásnál, az ajtót kinyitjuk, és fedezékként használjuk."
   },
   {
    "id": "c",
    "text": "Mögé állok, kiszállok, és a vezetőoldali ablakhoz sétálva szólítom fel a bent ülőket.",
    "next": "backup",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy fegyveres gyanúsítotthoz nem sétálunk oda: fedezékből, a nyitott ajtó mögül szólítjuk ki."
   }
  ]
 },
 "backup": {
  "text": "Megérkezik az erősítés. Hova álljon?",
  "choices": [
   {
    "id": "a",
    "text": "A Sentinel elé, keresztben, hogy elzárja az útját.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A gyanúsított elé állva tűzvonalba kerül, és fedezéke sincs."
   },
   {
    "id": "b",
    "text": "Az első járőrautó mögé; ha nincs hely, akkor mellé.",
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
    "text": "Figyelje a gyanúsítottakat, jelezze a veszélyeket, és kövesse, ha valaki menekül.",
    "next": "cmd1",
    "points": 2,
    "verdict": "good",
    "feedback": "Felony stop során az AIR egység megfigyel, jelzi a veszélyforrásokat, kommunikál a földi egységekkel, és követi a menekülőt."
   },
   {
    "id": "b",
    "text": "Köröző pályán maradjon a közelben, de ne szóljon bele, amíg mi beszélünk.",
    "next": "cmd1",
    "points": 1,
    "verdict": "ok",
    "feedback": "A légi megfigyelés épp ilyenkor értékes: jelezze a veszélyforrásokat."
   },
   {
    "id": "c",
    "text": "Szálljon le az úton a Sentinel mellett, és a géppel zárja el a menekülés útját előre.",
    "next": "cmd1",
    "points": 0,
    "verdict": "bad",
    "feedback": "Leszállni csak kijelölt vagy széles, tisztás helyen lehet, és itt a levegőből hasznos."
   }
  ]
 },
 "cmd1": {
  "text": "Megkezditek a sofőr lekapcsolását. Mi az első felszólítás?",
  "choices": [
   {
    "id": "a",
    "text": "„SOFŐR! Felszólítom, hogy a kulcsot dobja ki az ablakon, járó motorral!”",
    "next": "cmd2",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a motort kell leállítania."
   },
   {
    "id": "b",
    "text": "„SOFŐR! Felszólítom, hogy egy lassú mozdulattal állítsa le a motort!”",
    "next": "cmd2",
    "points": 2,
    "verdict": "good",
    "feedback": "Első a motor leállítása: így nem tud elhajtani."
   },
   {
    "id": "c",
    "text": "„SOFŐR! Felszólítom, hogy felemelt kézzel, lassan szálljon ki a járműből!”",
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
    "text": "„Bal kézzel húzza ki a kulcsot, tekerje le az ablakot, és dobja ki a kulcsot!”",
    "next": "cmd3",
    "points": 2,
    "verdict": "good",
    "feedback": "Kulcs bal kézzel, ablak le, kulcs ki: ez a sorrend."
   },
   {
    "id": "b",
    "text": "„Tekerje le az ablakot, mindkét kezét tegye ki rajta, és forduljon felém!”",
    "next": "cmd3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a kulcs: bal kézzel kihúzni, ablak le, kulcs ki."
   },
   {
    "id": "c",
    "text": "„Jobb kézzel húzza ki a kulcsot, nyissa ki belülről az ajtót, és tegye ki a kulcsot!”",
    "next": "cmd3",
    "points": 0,
    "verdict": "bad",
    "feedback": "Bal kézzel, és az ajtót majd kívülről nyitja ki, a lehúzott ablakon át."
   }
  ]
 },
 "cmd3": {
  "text": "A kulcs a földön. Hogyan száll ki a sofőr?",
  "choices": [
   {
    "id": "a",
    "text": "„Kívülről nyissa ki az ajtót, felemelt kézzel szálljon ki, és hátráljon felém, amíg azt nem mondom: állj!”",
    "next": "resist",
    "points": 1,
    "verdict": "ok",
    "feedback": "Kimaradt a körbefordulás és a háttal állás."
   },
   {
    "id": "b",
    "text": "„Kívülről nyissa ki az ajtót, felemelt kézzel szálljon ki, és sétáljon felém, szemben velem!”",
    "next": "resist",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szembefordulva, hozzád sétálva bármikor fegyvert ránthat: háttal, hátrálva jön."
   },
   {
    "id": "c",
    "text": "„Kívülről nyissa ki az ajtót, felemelt kézzel szálljon ki, forduljon háttal, és hátráljon az »állj«-ig!”",
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
    "text": "Fedezékből ismétlem a felszólítást, és megkérem az AIR egységet, hogy szálljon le a gyanúsított mögé.",
    "next": "passengers",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ellenállásnál a szabály egy Supervisory Staff tag hívása; a helikopter a levegőben segít."
   },
   {
    "id": "b",
    "text": "Kilépek a fedezékből, odafutok, és a földre viszem, mielőtt visszaér a kocsihoz.",
    "next": "passengers",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kilépnél a fedezékből egy fegyveres gyanúsított elé."
   },
   {
    "id": "c",
    "text": "Fedezékből ismétlem a felszólítást, és legalább egy Supervisory Staff tagot kérek a helyszínre.",
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
    "text": "A sofőr után bemegyek az autóba, és kiveszem az utast, amíg a többiek fedeznek.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az utasnál is ugyanaz az eljárás jár, fedezékből, felszólításokkal."
   },
   {
    "id": "b",
    "text": "A sofőrt ellenőrizzük és őrizetbe vesszük, majd ugyanezt elvégezzük az utassal is.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A vezető után az esetleges utasokkal is elvégezzük ugyanazt."
   },
   {
    "id": "c",
    "text": "A sofőr után az utast ellenőrzés nélkül elengedjük, mert a BOLO szerint ő nem körözött.",
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
}$json$::jsonb, 420),
('PIT vagy nem PIT?', 'Egy üldözés több szakaszán: mikor szabad PIT manővert alkalmazni (felszólítás, belváros, sebesség, SAHP), és hogyan.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "TSB egységként (Dodge Charger) üldözöl egy kék Sultant Downtownban. Kétszer szólítottad fel, a társad azt mondja: „Most pitelj!” Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Pitelek óvatosan, alacsony sebességnél, mert a társam jóváhagyta.",
    "next": "downtown",
    "points": 0,
    "verdict": "bad",
    "feedback": "A társ jóváhagyása nem pótolja a harmadik felszólítást."
   },
   {
    "id": "b",
    "text": "Még nem: PIT csak a harmadik felszólítás után engedélyezett.",
    "next": "downtown",
    "points": 2,
    "verdict": "good",
    "feedback": "A PIT manőver csak a harmadik felszólítás után engedélyezett, és csak ha nincs civil a közelben."
   },
   {
    "id": "c",
    "text": "Pitelek: két felszólítás után már szabad, ha nincs civil a közelben.",
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
    "text": "Nem: forgalmas belvárosban csak 80 km/h alatt, és csak ha nincs civil a közelben.",
    "next": "highway",
    "points": 3,
    "verdict": "good",
    "feedback": "Forgalmas belvárosban csak 80 km/h alatt, és csak ha nincs civil a közelben."
   },
   {
    "id": "b",
    "text": "Igen, ha a gyalogosok a járda túlsó szélén vannak, és a társam figyeli őket.",
    "next": "highway",
    "points": 0,
    "verdict": "bad",
    "feedback": "Civil a közelben van, és 95 km/h is sok a belvárosban."
   },
   {
    "id": "c",
    "text": "Igen: a harmadik felszólítás megvolt, és 150 km/h alatt vagyunk, ez a határ.",
    "next": "highway",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 150 km/h a felső határ, de forgalmas belvárosban 80 km/h alatt kell lenni, és civil sem lehet a közelben."
   }
  ]
 },
 "highway": {
  "text": "A Sultan kiér az autópályára, és 165 km/h-val halad; civil autó nincs a közelben. Most?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, ha a rangidős a rádióban jóváhagyja a manővert.",
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
    "text": "Igen: üres az autópálya, és a harmadik felszólítás is megvolt.",
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
    "text": "„10-4, rajta, a harmadik felszólítás már megvolt, civil nincs!”",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "SAHP egység semmilyen feltétel mellett nem pitelhet."
   },
   {
    "id": "b",
    "text": "„Negatív, SAHP egységnek tilos PIT manővert alkalmazni.”",
    "next": "rural",
    "points": 2,
    "verdict": "good",
    "feedback": "A szabályzat szerint SAHP egységeknek tilos a PIT manőver; a PIT-et a TSB vagy a SEB egység végezheti."
   },
   {
    "id": "c",
    "text": "„10-4, de csak 80 km/h alatt, és csak a hátsó részét!”",
    "next": "rural",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nem a sebességen múlik: SAHP egységnek egyáltalán nem szabad."
   }
  ]
 },
 "rural": {
  "text": "A Sultan letér egy vidéki útra, és 60 km/h-ra lassul; a harmadik felszólítás megvolt, civil nincs a közelben. Mit teszel?",
  "choices": [
   {
    "id": "a",
    "text": "Nem pitelek: biztonságos távolságból követem tovább, amíg magától megáll.",
    "next": "force",
    "points": 1,
    "verdict": "ok",
    "feedback": "Szabad lenne, és most ez a gyors, biztonságos megoldás; a követés sem hiba, de elhúzza az üldözést."
   },
   {
    "id": "b",
    "text": "Végrehajtom a PIT-et a Sultan oldalára, mert ott biztosabban megpördül.",
    "next": "force",
    "points": 0,
    "verdict": "bad",
    "feedback": "Pitelni csak az adott kocsi hátsó részét lehet."
   },
   {
    "id": "c",
    "text": "Végrehajtom a PIT-et a Sultan hátsó részére: minden feltétel teljesül.",
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
    "text": "150 km/h felett halálos erőnek, alatta kevésbé halálos erőnek számít.",
    "next": "after",
    "points": 0,
    "verdict": "bad",
    "feedback": "A 150 km/h a PIT tilalmának határa; halálos erőnek már 65 km/h felett számít."
   },
   {
    "id": "b",
    "text": "Soha nem számít halálos erőnek, mert a manőver csak a járművet éri, nem az embert.",
    "next": "after",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az autóban ember ül: 65 km/h felett halálos erőnek számít."
   },
   {
    "id": "c",
    "text": "65 km/h felett halálos erőnek, alatta kevésbé halálos erőnek számít.",
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
    "text": "„Code 12”, majd fedezékből kiszólítjuk a sofőrt, és őrizetbe vesszük.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 12 téves riasztás; itt a Code 100 a helyes."
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
    "text": "„Code 100”, majd odaszaladok az ajtóhoz, és kirántom a sofőrt, mielőtt magához tér.",
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
}$json$::jsonb, 430),
('Szökés a fogolyszállításból', 'A fogoly elfut a szállítás közben: rádió, vészhívó, határzár, légi keresés, arányos erő, a helyes tétel és a tanulság.', 'arrest', 3, 'start',
 $json${
 "start": {
  "text": "Egy elítéltet, Shane Millst viszed a fegyházba (10-15). Egy piros lámpánál kirúgja a hátsó ajtót, és bilincsben elfut. Mit teszel elsőként?",
  "choices": [
   {
    "id": "a",
    "text": "Azonnal bemondom a szökést, a leírását és az irányt, Code 6-Adam, és utána eredek.",
    "next": "button",
    "points": 2,
    "verdict": "good",
    "feedback": "Minden új fejleményt rádiózni kell; egy szökés az egész állomány ügye."
   },
   {
    "id": "b",
    "text": "Utána eredek szó nélkül, és ha elkaptam, utólag, részletesen beírom a jelentésbe.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "Rádió nélkül senki sem segít, és az eltitkolás bűnpártolás lenne."
   },
   {
    "id": "c",
    "text": "Bemondom a Code 4-et, mert bilincsben úgysem jut messzire, és utána megyek.",
    "next": "button",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 4 azt jelenti, nem kell erősítés: egy szökésnél épp kell."
   }
  ]
 },
 "button": {
  "text": "Gyalogos üldözés alakul ki. Megnyomod a vészhívót?",
  "choices": [
   {
    "id": "a",
    "text": "Igen, és mellé a Code 20-at is bemondom, hogy szóljanak a médiának.",
    "next": "border",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 20 a média értesítése: itt nincs rá szükség."
   },
   {
    "id": "b",
    "text": "Igen: gyalogos üldözésnél szabad a vészhívót használni.",
    "next": "border",
    "points": 2,
    "verdict": "good",
    "feedback": "A vészhívó gyalogos üldözésnél, lövöldözésnél és súlyos eseteknél használható."
   },
   {
    "id": "c",
    "text": "Nem: a vészhívó csak lövöldözéshez való, ide a rádió is elég.",
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
    "text": "Nem kell határzár, mert bilincsben van, és gyalog nem jut ki a városból.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bilincs nem akadály: a határokat le kell zárni."
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
    "text": "A határokat csak akkor zárjuk le, ha egy órán belül nem kerül elő.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A határzár a hajtóvadászat elejétől a végéig tart, nem utólag."
   }
  ]
 },
 "air": {
  "text": "Egy AIR egység is csatlakozik. Mit kérsz tőle?",
  "choices": [
   {
    "id": "a",
    "text": "Szálljon le a sikátor végén, és a pilóta gyalog, a földiekkel együtt keresse tovább.",
    "next": "capture",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szűk helyre csak akkor szállhat le, ha az akció megköveteli; a levegőből hasznosabb."
   },
   {
    "id": "b",
    "text": "Térjen vissza a bázisra, mert éjjel a levegőből úgysem lát semmit.",
    "next": "capture",
    "points": 0,
    "verdict": "bad",
    "feedback": "A FLIR hőkamera épp sötétben lát; a légi keresés gyorsítja a hajtóvadászatot."
   },
   {
    "id": "c",
    "text": "Keresőfénnyel és FLIR hőkamerával keresse, és tájékoztassa a földi egységeket.",
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
    "text": "Halálos erővel, mert már egyszer megszökött, és újra megpróbálhatja.",
    "next": "charges",
    "points": 0,
    "verdict": "bad",
    "feedback": "Halálos erő csak súlyos veszély esetén jöhet szóba."
   },
   {
    "id": "b",
    "text": "Arányos erővel vesszük őrizetbe: lefogás, szükség esetén sokkoló.",
    "next": "charges",
    "points": 2,
    "verdict": "good",
    "feedback": "Fegyvertelen, de ellenálló személynél a tompa vagy energikus eszköz az arányos."
   },
   {
    "id": "c",
    "text": "Arányos erővel, de előbb megleckéztetjük, hogy legközelebb ne szökjön.",
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
    "text": "REM: 1 000 000 – 2 000 000 $ és 15–30 perc.",
    "next": "lesson",
    "points": 0,
    "verdict": "bad",
    "feedback": "A REM a megállítás elől menekülőé; a fogolyra az FSZ vonatkozik."
   },
   {
    "id": "b",
    "text": "FSZ: 1 000 000 – 2 000 000 $ és 30–60 perc.",
    "next": "lesson",
    "points": 2,
    "verdict": "good",
    "feedback": "Aki már fogoly, annak a fogolyszökés tétele jár."
   },
   {
    "id": "c",
    "text": "FSZT: 2 000 000 – 4 000 000 $ és 30–60 perc.",
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
    "text": "Veszélyes foglyot nem szállítok egyedül: kísérőt kérek (10-14), és biztonságosan ültetem be.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A 10-14 a konvoj, kíséret kérése; egy veszélyes fogolyhoz két ember kell."
   },
   {
    "id": "b",
    "text": "Semmit: egy ilyen szökés balszerencse, a következő szállítás ugyanígy mehet.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Minden szökésből tanulni kell."
   },
   {
    "id": "c",
    "text": "Veszélyes foglyot ezentúl a csomagtartóban szállítok, ahonnan nem tud kirúgni semmilyen ajtót.",
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
}$json$::jsonb, 440),
('Bankrablás: a kordon', 'Code 99 egy bankból: a Deputy Sheriff I. helye, a Trainee és a széfterem, kire lehet lőni a kordon előtt, az AIR szerepe, behatolás felkérésre, a zsákmány.', 'patrol', 3, 'start',
 $json${
 "start": {
  "text": "„Code 99, bankrablás a Downtown-i bankban!” Deputy Sheriff I. vagy (6A021), a társad Trainee. Hogyan reagálsz?",
  "choices": [
   {
    "id": "a",
    "text": "„6A021 reagál a riasztásra, Code 3!” – fényhíddal és szirénával.",
    "next": "role",
    "points": 2,
    "verdict": "good",
    "feedback": "A Code 99 vészhelyzet: minden egység reagáljon; a reagálást rádiózzuk, Code 3-mal."
   },
   {
    "id": "b",
    "text": "„6A021 reagál a riasztásra, Code 2!” – hogy ne keltsünk pánikot.",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 2 rutinhívás; egy bankrabláshoz sürgősen kell menni."
   },
   {
    "id": "c",
    "text": "„6A021 vette, és a kapitányságon várja a rangidős utasítását, mielőtt elindul.”",
    "next": "role",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Code 99 azt jelenti: minden egység reagáljon, azonnal."
   }
  ]
 },
 "role": {
  "text": "Odaértek. A rangidős kiosztja a feladatokat. Hol a helyed Deputy Sheriff I.-ként?",
  "choices": [
   {
    "id": "a",
    "text": "A SEB mögött, a második hullámban megyek be, mert közel vagyok a bejárathoz.",
    "next": "trainee",
    "points": 0,
    "verdict": "bad",
    "feedback": "Nagyobb akciónál a SEB megy előre; a te helyed a kordon."
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
    "text": "A széfteremnél, a túszok kimentésénél segítek, mert ott kell a legtöbb ember.",
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
    "text": "„Mehetsz, de csak a SEB után, és a széfterem ajtajában maradj, ne menj beljebb.”",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "Trainee nem hatolhat be a széfterembe, az ajtóig sem."
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
    "text": "„Csak akkor mehetsz, ha a rangidős SEB Operator engedélyt ad rá.”",
    "next": "fire",
    "points": 0,
    "verdict": "bad",
    "feedback": "Trainee a széfterembe engedéllyel sem hatolhat be."
   }
  ]
 },
 "fire": {
  "text": "A rangidős tűzparancsot adott. A kordon még nem állt össze, kint civil autók és járókelők vannak. A bankból egy maszkos férfi kirohan, és a tömegbe lő. Kire lőhetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Csak arra, aki kint lövöldözik (és a bent lévőkre); a civilekre a kordon lezárásáig tilos.",
    "next": "air",
    "points": 3,
    "verdict": "good",
    "feedback": "Amíg nincs lent a kordon, tilos a civilekre lőni: csak a bent lévőkre, vagy azokra, akik kint lövöldöznek."
   },
   {
    "id": "b",
    "text": "Bárkire, aki a bank közelében fegyverrel mozog, mert a kiadott tűzparancs mindenkire szól.",
    "next": "air",
    "points": 0,
    "verdict": "bad",
    "feedback": "A civilekre a kordon lezárásáig tilos lőni; a tűzparancs nem teszi őket célponttá."
   },
   {
    "id": "c",
    "text": "Arra is, aki a helyszínről gyanúsan elfut, mert a kordon még nem állt össze, és megszökhet.",
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
    "text": "Mesterlövészek felderítése, helyzetjelentés a földieknek, légtérellenőrzés, a rangidős parancsai.",
    "next": "entry",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Aero Bureau tananyaga szerint ezek az AIR egység feladatai bankrablásnál."
   },
   {
    "id": "b",
    "text": "A sajtó élő tájékoztatása a levegőből, és a túszok családjainak értesítése a helyszínről.",
    "next": "entry",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtó a Sheriff's Information Bureau dolga."
   },
   {
    "id": "c",
    "text": "A menekülő autók megállítása: leszáll eléjük az úton, és a géppel zárja el az útjukat a híd felé.",
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
    "text": "Igen, és a Trainee társamat is viszem, mert két ember jobban fedezi egymást.",
    "next": "rifle",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Trainee nem hatolhat be a széfterembe, és őt senki sem jelölte ki."
   },
   {
    "id": "b",
    "text": "Igen: ha a rangidős SEB Operator felkér, a deputyk is behatolhatnak.",
    "next": "rifle",
    "points": 2,
    "verdict": "good",
    "feedback": "Ha kevés a SEB, a rangidős SEB Operator válogatja össze a deputyk közül a csapatot."
   },
   {
    "id": "c",
    "text": "Nem: deputy soha nem hatolhat be, csak a SEB tagjai, felkéréstől függetlenül.",
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
    "text": "Igen, és megtartom a szolgálat végéig, hiszen egy bevetésen kaptam, jól jöhet még.",
    "next": "loot",
    "points": 0,
    "verdict": "bad",
    "feedback": "Amint nincs rá szükség, le kell tenni."
   },
   {
    "id": "b",
    "text": "Nem, soha: a dupla nagykaliber bevetésen is tilos, a szabályban nincs semmilyen kivétel.",
    "next": "loot",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bevetés kivétel, ha hirtelen szükség van rá."
   },
   {
    "id": "c",
    "text": "Most igen, bevetésen szabad, de amint nincs rá szükség, azonnal leteszem.",
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
    "text": "Náluk hagyjuk a fegyházban is: a bank majd polgári úton, a bíróságon hajtja be tőlük.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A zsákmányt el kell venni."
   },
   {
    "id": "b",
    "text": "Elvesszük tőlük, és a meeting után jutalomként szétosztjuk a kordon emberei között.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ez lopás és visszaélés: a pénz bizonyíték."
   },
   {
    "id": "c",
    "text": "Elvesszük tőlük: a kifosztott összeget is el kell venni, és bizonyítékként leadjuk.",
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
}$json$::jsonb, 450),
('Fedett munka', 'Beépülés egy bandába: álnév és ideiglenes rendszám, kapcsolattartás, amit fedett munkában sem szabad, a drog utáni teendők, kimentés és átadás.', 'mcb', 3, 'start',
 $json${
 "start": {
  "text": "Investigator III. vagy, és beépülsz egy banda törzskocsmájába. Mit állítasz be indulás előtt?",
  "choices": [
   {
    "id": "a",
    "text": "/alnev és /fakeplate; az álnevet kilépés előtt mindig kikapcsolom.",
    "next": "contact",
    "points": 2,
    "verdict": "good",
    "feedback": "A nyomozói parancsok közül ez a kettő kell; az álnevet kilépés előtt kötelező kikapcsolni."
   },
   {
    "id": "b",
    "text": "/alnev és /fakeplate; az álnevet bekapcsolva hagyom, hogy holnap is meglegyen.",
    "next": "contact",
    "points": 0,
    "verdict": "bad",
    "feedback": "Kilépés előtt az álnevet kötelező kikapcsolni."
   },
   {
    "id": "c",
    "text": "Semmit: a saját nevemmel hitelesebb, a /fakeplate pedig csak üldözéshez kell.",
    "next": "contact",
    "points": 0,
    "verdict": "bad",
    "feedback": "A saját neveddel azonnal lebuksz; az ideiglenes rendszám is a fedést szolgálja."
   }
  ]
 },
 "contact": {
  "text": "Hogyan tartod a kapcsolatot a csapatoddal?",
  "choices": [
   {
    "id": "a",
    "text": "Naponta beszámolok a közös rádión, hogy a csapatból mindenki naprakész legyen.",
    "next": "crime",
    "points": 0,
    "verdict": "bad",
    "feedback": "A közös rádió lebuktatna; a kapcsolattartónak kell jelenteni."
   },
   {
    "id": "b",
    "text": "Hetente jelentek a kapcsolattartómnak, a nyomozásról és a saját állapotomról.",
    "next": "crime",
    "points": 2,
    "verdict": "good",
    "feedback": "Fedett munkában hetente jelenteni kell a kapcsolattartónak, a nyomozó saját állapotáról is."
   },
   {
    "id": "c",
    "text": "Csak az akció végén jelentkezem, hogy ne bukjak le egy üzenet miatt.",
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
    "text": "Továbbra sem jelentkezem, majd a végén mindent elmondok.",
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
    "text": "Hihető kifogással nemet mondok: köztörvényes bűncselekményt nem követhetek el.",
    "next": "drugs",
    "points": 3,
    "verdict": "good",
    "feedback": "Beépülés alatt elkerülhetetlen lehet szabályok megszegése, de köztörvényes bűncselekményt semmilyen körülmények között nem követhetsz el."
   },
   {
    "id": "b",
    "text": "Segítek, de előtte szólok a kapcsolattartómnak, így az akció engedélyezett lesz.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "Köztörvényes bűncselekményre senki sem adhat engedélyt."
   },
   {
    "id": "c",
    "text": "Segítek, mert fedett munkában a szabályok megszegése elkerülhetetlen.",
    "next": "drugs",
    "points": 0,
    "verdict": "bad",
    "feedback": "Szabályt igen, köztörvényes bűncselekményt soha."
   }
  ]
 },
 "drugs": {
  "text": "Egy másik este a vezető ragaszkodik hozzá, hogy kipróbáld a drogjukat, különben lebuksz. Végül meg kell tenned. Mi a teendő utána?",
  "choices": [
   {
    "id": "a",
    "text": "Nem jelentem: fedett munkában ez a feladat része, utólag nem kell.",
    "next": "danger",
    "points": 0,
    "verdict": "bad",
    "feedback": "Jelenteni kell: a visszatérés feltétele a vizsgálat."
   },
   {
    "id": "b",
    "text": "Jelentem; egy drogteszt jön, és ha negatív, másnap már visszatérhetek a szolgálatba.",
    "next": "danger",
    "points": 0,
    "verdict": "bad",
    "feedback": "A visszatéréshez pszichiátriai vizsgálat kell, és fél évig kéthetente drogvizsgálat."
   },
   {
    "id": "c",
    "text": "Jelentem; pszichiátriai vizsgálat jön, és fél évig kéthetente drogteszt.",
    "next": "danger",
    "points": 3,
    "verdict": "good",
    "feedback": "Ha a beépülés során drogot kellett használni, jelenteni kell; utána pszichiátriai vizsgálat és fél évig kéthetente drogvizsgálat jár, szúrópróbákkal is."
   }
  ]
 },
 "danger": {
  "text": "A banda gyanakodni kezd, egyikük fegyvert fog rád a hátsó szobában. Mit tehetsz?",
  "choices": [
   {
    "id": "a",
    "text": "Felfedem magam, és egyedül letartóztatom őket, mielőtt rám lőnek.",
    "next": "handover",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egyedül egy bandával szemben: életveszélyes, és az ügy is elveszhet."
   },
   {
    "id": "b",
    "text": "Kitartok, mert a beépülést csak felső, vezetői utasításra lehet megszakítani.",
    "next": "handover",
    "points": 0,
    "verdict": "bad",
    "feedback": "Saját kérésre és a testi épség veszélyeztetése esetén is megszakítható."
   },
   {
    "id": "c",
    "text": "A kapcsolattartómon keresztül kimentést kérek: a beépülés bármikor megszakítható.",
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
    "text": "Mindent elmondok egy újságírónak, hogy a lakosság lássa, milyen jól dolgozunk.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ügyről információt kiadni tilos; a sajtó a SIB dolga."
   },
   {
    "id": "b",
    "text": "Részletes jelentést írok az aktába; a letartóztatások parancs alapján jönnek.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A fedett munka eredménye a dokumentált információ; a rajtaütés és a letartóztatás parancs alapján jön."
   },
   {
    "id": "c",
    "text": "Megtartom magamnak, hátha még vissza kell mennem fedett munkára.",
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
}$json$::jsonb, 460),
('Túsztárgyalás a benzinkúton', 'A Crisis Negotiation Team egy túszhelyzetben: a deputyk dolga, a szerepek, az első kapcsolatfelvétel, követelések, hírszerzés, csere, a SEB és a sajtó.', 'mcb', 3, 'start',
 $json${
 "start": {
  "text": "Egy fegyveres férfi túszokat ejtett egy benzinkúton. Az első egységek kint vannak. Mit tesznek a deputyk?",
  "choices": [
   {
    "id": "a",
    "text": "Lezárják a környéket, tartják a kordont, és várják a CNT-t és a SEB-et.",
    "next": "roles",
    "points": 2,
    "verdict": "good",
    "feedback": "A behatolás a SEB-é, a tárgyalás a CNT-é; a kint lévők a terepet biztosítják."
   },
   {
    "id": "b",
    "text": "Lezárják a környéket, és az első egység azonnal behatol, mielőtt baj lesz.",
    "next": "roles",
    "points": 0,
    "verdict": "bad",
    "feedback": "Egy túszhelyzetben a kapkodás életekbe kerülhet: a SEB hatol be, parancsra."
   },
   {
    "id": "c",
    "text": "Mindenki a bejárathoz áll, hogy a túszejtő lássa, mekkora erő van kint.",
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
    "text": "A Team Leader.",
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
    "text": "Nyugodtan bemutatkozom, és két perc ultimátumot adok, hogy lássa, komolyan gondoljuk.",
    "next": "demands",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az ultimátum sarokba szorítja, és a túszok kerülnek veszélybe."
   },
   {
    "id": "b",
    "text": "Nyugodtan bemutatkozom, és közlöm, hogy a SEB mindjárt bemegy, ha nem adja fel.",
    "next": "demands",
    "points": 0,
    "verdict": "bad",
    "feedback": "A fenyegetés eszkalál; a cél a de-eszkaláció."
   },
   {
    "id": "c",
    "text": "Nyugodtan bemutatkozom, aktívan hallgatok, és empátiát mutatok.",
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
    "text": "Nem ígérek olyat, amit nem tarthatok be; apró, teljesíthető lépéseket keresek.",
    "next": "intel",
    "points": 2,
    "verdict": "good",
    "feedback": "A CNT etikai kódexe szerint el kell kerülni a megtévesztést és a manipulációt; apró lépésekben (pl. egy túsz elengedése) lehet haladni."
   },
   {
    "id": "b",
    "text": "Azonnal elutasítom, és leteszem a telefont, hogy lássa, mi diktálunk.",
    "next": "intel",
    "points": 0,
    "verdict": "bad",
    "feedback": "A kapcsolat fenntartása a CNT első feladata."
   },
   {
    "id": "c",
    "text": "Megígérem az autót, hogy időt nyerjünk; úgysem kapja meg, de megnyugszik.",
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
    "text": "A Secondary Negotiator.",
    "next": "secondary",
    "points": 0,
    "verdict": "bad",
    "feedback": "Ő a fő tárgyalót támogatja és helyettesíti."
   },
   {
    "id": "b",
    "text": "Az Intelligence Officer.",
    "next": "secondary",
    "points": 2,
    "verdict": "good",
    "feedback": "Az Intelligence Officer gyűjti, elemzi és osztja meg a hírszerzési adatokat."
   },
   {
    "id": "c",
    "text": "A helyszínen lévő sajtó.",
    "next": "secondary",
    "points": 0,
    "verdict": "bad",
    "feedback": "A sajtó nem a CNT része."
   }
  ]
 },
 "secondary": {
  "text": "Órák óta tárgyalsz, és elfáradtál. Mi a megoldás?",
  "choices": [
   {
    "id": "a",
    "text": "A Team Coordinator veszi át, mert ő irányítja a csapatot.",
    "next": "seb",
    "points": 0,
    "verdict": "bad",
    "feedback": "A Team Coordinator irányít és tanácsot ad; a helyettes tárgyaló a Secondary Negotiator."
   },
   {
    "id": "b",
    "text": "A Secondary Negotiator átveszi: ő a fő tárgyaló helyettese.",
    "next": "seb",
    "points": 2,
    "verdict": "good",
    "feedback": "A Secondary Negotiator támogat, közvetít, és szükség esetén helyettesíti a fő tárgyalót."
   },
   {
    "id": "c",
    "text": "Folytatom, mert egy tárgyalócsere megzavarhatja a túszejtőt.",
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
    "text": "A CNT dönti el egyedül, mikor mehet be a SEB, mert ő ismeri a túszejtőt.",
    "next": "media",
    "points": 0,
    "verdict": "bad",
    "feedback": "A műveletet az akcióparancsnok irányítja, a CNT tanácsot ad."
   },
   {
    "id": "b",
    "text": "A CNT kimarad a döntésből: a behatolás kizárólag a SEB parancsnokára tartozik.",
    "next": "media",
    "points": 0,
    "verdict": "bad",
    "feedback": "A két csapat folyamatos információcserében dolgozik, a CNT tanácsot ad."
   },
   {
    "id": "c",
    "text": "A Team Coordinator tanácsot ad az akcióparancsnoknak és a SEB-nek; a túszok biztonsága az első.",
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
    "text": "Semmilyen részletet: a sajtót a Sheriff's Information Bureau tájékoztatja.",
    "next": "done",
    "points": 2,
    "verdict": "good",
    "feedback": "A tájékoztatás a SIB dolga; a helyszíni részletek a túszok életét is veszélyeztethetik."
   },
   {
    "id": "b",
    "text": "Annyit, amennyit tudnak, mert a nyilvánosság nyomást gyakorol a túszejtőre.",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A nyomásgyakorlás a túszokat veszélyezteti; a tájékoztatás a SIB-é."
   },
   {
    "id": "c",
    "text": "Csak a túszok számát és a helyet, hogy a lakosság elkerülje a környéket.",
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
}$json$::jsonb, 470),
('Sebesült kolléga: Medic ellátás', 'SEB Medicként egy bevetésen: lőtt seb, pulzusértékek, morfium és adrenalin, szívmegállás, sebvarrás vagy kivonás, a /hp és a /me–/do helyes írása.', 'other', 3, 'start',
 $json${
 "start": {
  "text": "SEB Medic vagy egy bevetésen. Egy Operator lövést kapott a combjába, erősen vérzik. Mi az első?",
  "choices": [
   {
    "id": "a",
    "text": "Egy általános kötés rá, és vissza a harcba, a vérzés majd eláll magától.",
    "next": "pulse",
    "points": 0,
    "verdict": "bad",
    "feedback": "Erős vérzésnél a QuikClot és a nyomókötés kell; az általános kötés kevés."
   },
   {
    "id": "b",
    "text": "Előbb morfium a fájdalomra, utána QuikClot és nyomókötés, a tourniquet ráér.",
    "next": "pulse",
    "points": 0,
    "verdict": "bad",
    "feedback": "Előbb a vérzéscsillapítás: a vérveszteség a legnagyobb veszély."
   },
   {
    "id": "c",
    "text": "Tourniquet, ha lehet, utána QuikClot és nyomókötés, majd érzéstelenítés.",
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
    "text": "Normál (46–119 között); nincs teendő, a fájdalom magától enyhül.",
    "next": "low",
    "points": 0,
    "verdict": "bad",
    "feedback": "128 bpm már magas: 120 fölött."
   },
   {
    "id": "b",
    "text": "Magas (120 felett); morfium adható, mert 30–40-nel csökkenti a pulzust.",
    "next": "low",
    "points": 2,
    "verdict": "good",
    "feedback": "Értékek: 45 és alatta alacsony, 46–119 normál, 120 és fölötte magas. A morfium 30–40 bpm-mel csökkenti a pulzust."
   },
   {
    "id": "c",
    "text": "Magas (120 felett); adrenalin kell, hogy a szív bírja a terhelést.",
    "next": "low",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az adrenalin emeli a pulzust; magas pulzusnál a fájdalomra a morfium adható."
   }
  ]
 },
 "low": {
  "text": "Egy másik sebesült pulzusa 42 bpm, és ő is erősen fájlalja a sebét. Mit adhatsz neki?",
  "choices": [
   {
    "id": "a",
    "text": "Lidokaint adrenalinnal, mert a lidokain is csökkenti a pulzust.",
    "next": "overdose",
    "points": 0,
    "verdict": "bad",
    "feedback": "A lidokain helyi érzéstelenítő; a pulzust a morfium csökkenti."
   },
   {
    "id": "b",
    "text": "Morfiumot csak adrenalinnal együtt: így a pulzus a 60–100-as tartományban marad.",
    "next": "overdose",
    "points": 3,
    "verdict": "good",
    "feedback": "Alacsony pulzusnál a morfium miatt a sebesült elveszítheti az eszméletét; a morfium utáni adrenalin a 60–100-as tartományban stabilizál."
   },
   {
    "id": "c",
    "text": "Dupla adag morfiumot, mert alacsony pulzusnál a fájdalom erősebben hat.",
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
    "text": "Nem: két-három egymást követő adrenalin túladagolás, a szív megállhat.",
    "next": "arrest",
    "points": 2,
    "verdict": "good",
    "feedback": "Az adrenalinnal is lehet túladagolni: két-három egymást követő beadás szívmegálláshoz vezethet."
   },
   {
    "id": "b",
    "text": "Jó ötlet: az adrenalin minél több, annál stabilabb lesz a pulzus.",
    "next": "arrest",
    "points": 0,
    "verdict": "bad",
    "feedback": "Túladagolás: a szív sokkot kaphat és megállhat."
   },
   {
    "id": "c",
    "text": "Adrenalin helyett lidokaint adok háromszor, az is emeli a pulzust.",
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
    "text": "Szívmegállás (20 alatt): morfium a fájdalomra, és várok, amíg stabilizálódik.",
    "next": "suture",
    "points": 0,
    "verdict": "bad",
    "feedback": "A morfium tovább csökkentené a pulzust; szívmasszázs és adrenalin kell."
   },
   {
    "id": "b",
    "text": "Alacsony, de stabil érték: megfigyelem, és ha 10 alá esik, szívmasszázs.",
    "next": "suture",
    "points": 0,
    "verdict": "bad",
    "feedback": "20 bpm alatt már szívmegállás van: azonnal kell a szívmasszázs."
   },
   {
    "id": "c",
    "text": "Szívmegállás (20 alatt): azonnal szívmasszázs és adrenalin.",
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
    "text": "Ha van idő, összevarrom (csak szanitéc vagy mentőorvos varrhat); ha nincs, kivonást kérek.",
    "next": "hp",
    "points": 2,
    "verdict": "good",
    "feedback": "A be nem varrt seb nagy eséllyel újra megnyílik; ha nincs idő varrni, azonnali kivonás kell."
   },
   {
    "id": "b",
    "text": "Visszaküldöm harcolni: a bekötözött seb már nem nyílik fel, a varrás ráér.",
    "next": "hp",
    "points": 0,
    "verdict": "bad",
    "feedback": "A bekötözött, de össze nem varrt seb újra vérezhet."
   },
   {
    "id": "c",
    "text": "Egy másik Operator varrja össze, mert a medic táskájában neki is van tű és varrófonal.",
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
    "text": "Nem: a /hp csak a SEB Medicek parancsa; más NONRP-ért szankcionálható, kirúgással.",
    "next": "rp",
    "points": 2,
    "verdict": "good",
    "feedback": "A /hp a SEB Medicek (szanitéc részleg) parancsa."
   },
   {
    "id": "b",
    "text": "Igen, ha előtte /me-vel és /do-val részletesen leírja az ellátást.",
    "next": "rp",
    "points": 0,
    "verdict": "bad",
    "feedback": "Az RP nem teszi jogosulttá."
   },
   {
    "id": "c",
    "text": "Igen: vészhelyzetben bárki használhatja, ha utána jelenti a SEB Medicnek.",
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
    "text": "„/do Ellenőrzi a sebesült pulzusát.” és „/me pulzusa magas.”",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "A cselekvés /me (kisbetűvel), az állapot /do (nagybetűvel)."
   },
   {
    "id": "b",
    "text": "„/me Ellenőrzi a sebesült pulzusát.” és „/do pulzusa magas.”",
    "next": "done",
    "points": 0,
    "verdict": "bad",
    "feedback": "Fordítva: a /me kisbetűvel, a /do nagybetűvel kezdődik."
   },
   {
    "id": "c",
    "text": "„/me ellenőrzi a sebesült pulzusát.” és „/do Pulzusa magas.”",
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
}$json$::jsonb, 480)
) as v(title, summary, category, difficulty, start_node, nodes, sort_order)
where p.title = v.title;

do $do$
declare
  _row record;
  _problem text;
  _found integer;
begin
  select count(*) into _found from public.practice_scenarios where title in (
  'Minta: Közúti ellenőrzés',
  'Minta: Üldözés a rádióban',
  'Igazoltatás ADAM egységben',
  'LINCOLN egység: egyedül az igazoltatáson',
  'Iratok, neon, szélvédő',
  'Egy szolgálat a rádióban',
  'Határátlépés Los Santosba',
  'Rádióetikett',
  'Előállítás lépésről lépésre',
  'Első szolgálat Trainee-ként',
  'Verekedés a kocsma előtt',
  'Közösségi járőrözés',
  'CCTV-riasztás',
  'Szolgálaton kívül',
  'Sajtó a helyszínen',
  'Havi kötelezettségek',
  'Vadászok ellenőrzése',
  'Jármű, felszerelés, megjelenés',
  'Traffipax-ellenőrzés: melyik tétel?',
  'Ittas sofőr az éjszakában',
  'Megvesztegetési kísérlet',
  'Gázolás és cserbenhagyás',
  'Üldözés: a felszólítástól az MDC-jelig',
  'Betörésjelzés: Code 30 vagy Code 30-Silent',
  'Légi támogatás: az AIR egység',
  'Gyalogos üldözés és a sokkoló',
  'Fegyveres utas az igazoltatáson',
  'Kihallgatás a kirendeltségen',
  'Lövések a garázsnál',
  'Banda a parkban: FI-kártya és SanGang',
  'Megfigyelés Code 5 alatt',
  'Egy betörés helyszínelése',
  'Fegyverüzlet nyomában',
  'FAB: a lejárt bérletű autószerviz',
  'Felony stop: a körözött jármű',
  'PIT vagy nem PIT?',
  'Szökés a fogolyszállításból',
  'Bankrablás: a kordon',
  'Fedett munka',
  'Túsztárgyalás a benzinkúton',
  'Sebesült kolléga: Medic ellátás');
  if _found <> 41 then raise exception 'expected 41 scenarios, found %', _found; end if;
  for _row in select title, nodes, start_node from public.practice_scenarios where title in (
  'Minta: Közúti ellenőrzés',
  'Minta: Üldözés a rádióban',
  'Igazoltatás ADAM egységben',
  'LINCOLN egység: egyedül az igazoltatáson',
  'Iratok, neon, szélvédő',
  'Egy szolgálat a rádióban',
  'Határátlépés Los Santosba',
  'Rádióetikett',
  'Előállítás lépésről lépésre',
  'Első szolgálat Trainee-ként',
  'Verekedés a kocsma előtt',
  'Közösségi járőrözés',
  'CCTV-riasztás',
  'Szolgálaton kívül',
  'Sajtó a helyszínen',
  'Havi kötelezettségek',
  'Vadászok ellenőrzése',
  'Jármű, felszerelés, megjelenés',
  'Traffipax-ellenőrzés: melyik tétel?',
  'Ittas sofőr az éjszakában',
  'Megvesztegetési kísérlet',
  'Gázolás és cserbenhagyás',
  'Üldözés: a felszólítástól az MDC-jelig',
  'Betörésjelzés: Code 30 vagy Code 30-Silent',
  'Légi támogatás: az AIR egység',
  'Gyalogos üldözés és a sokkoló',
  'Fegyveres utas az igazoltatáson',
  'Kihallgatás a kirendeltségen',
  'Lövések a garázsnál',
  'Banda a parkban: FI-kártya és SanGang',
  'Megfigyelés Code 5 alatt',
  'Egy betörés helyszínelése',
  'Fegyverüzlet nyomában',
  'FAB: a lejárt bérletű autószerviz',
  'Felony stop: a körözött jármű',
  'PIT vagy nem PIT?',
  'Szökés a fogolyszállításból',
  'Bankrablás: a kordon',
  'Fedett munka',
  'Túsztárgyalás a benzinkúton',
  'Sebesült kolléga: Medic ellátás') loop
    _problem := private.scenario_problem(_row.nodes, _row.start_node);
    if _problem is not null then raise exception '%: %', _row.title, _problem; end if;
  end loop;
end;
$do$;

update public.practice_scenarios set max_score = (private.scenario_analyse(nodes, start_node)).max_score
where title in (
  'Minta: Közúti ellenőrzés',
  'Minta: Üldözés a rádióban',
  'Igazoltatás ADAM egységben',
  'LINCOLN egység: egyedül az igazoltatáson',
  'Iratok, neon, szélvédő',
  'Egy szolgálat a rádióban',
  'Határátlépés Los Santosba',
  'Rádióetikett',
  'Előállítás lépésről lépésre',
  'Első szolgálat Trainee-ként',
  'Verekedés a kocsma előtt',
  'Közösségi járőrözés',
  'CCTV-riasztás',
  'Szolgálaton kívül',
  'Sajtó a helyszínen',
  'Havi kötelezettségek',
  'Vadászok ellenőrzése',
  'Jármű, felszerelés, megjelenés',
  'Traffipax-ellenőrzés: melyik tétel?',
  'Ittas sofőr az éjszakában',
  'Megvesztegetési kísérlet',
  'Gázolás és cserbenhagyás',
  'Üldözés: a felszólítástól az MDC-jelig',
  'Betörésjelzés: Code 30 vagy Code 30-Silent',
  'Légi támogatás: az AIR egység',
  'Gyalogos üldözés és a sokkoló',
  'Fegyveres utas az igazoltatáson',
  'Kihallgatás a kirendeltségen',
  'Lövések a garázsnál',
  'Banda a parkban: FI-kártya és SanGang',
  'Megfigyelés Code 5 alatt',
  'Egy betörés helyszínelése',
  'Fegyverüzlet nyomában',
  'FAB: a lejárt bérletű autószerviz',
  'Felony stop: a körözött jármű',
  'PIT vagy nem PIT?',
  'Szökés a fogolyszállításból',
  'Bankrablás: a kordon',
  'Fedett munka',
  'Túsztárgyalás a benzinkúton',
  'Sebesült kolléga: Medic ellátás');

update public.practice_scenarios set published = true
where not published and title in (
  'Minta: Közúti ellenőrzés',
  'Minta: Üldözés a rádióban',
  'Igazoltatás ADAM egységben',
  'LINCOLN egység: egyedül az igazoltatáson',
  'Iratok, neon, szélvédő',
  'Egy szolgálat a rádióban',
  'Határátlépés Los Santosba',
  'Rádióetikett',
  'Előállítás lépésről lépésre',
  'Első szolgálat Trainee-ként',
  'Verekedés a kocsma előtt',
  'Közösségi járőrözés',
  'CCTV-riasztás',
  'Szolgálaton kívül',
  'Sajtó a helyszínen',
  'Havi kötelezettségek',
  'Vadászok ellenőrzése',
  'Jármű, felszerelés, megjelenés',
  'Traffipax-ellenőrzés: melyik tétel?',
  'Ittas sofőr az éjszakában',
  'Megvesztegetési kísérlet',
  'Gázolás és cserbenhagyás',
  'Üldözés: a felszólítástól az MDC-jelig',
  'Betörésjelzés: Code 30 vagy Code 30-Silent',
  'Légi támogatás: az AIR egység',
  'Gyalogos üldözés és a sokkoló',
  'Fegyveres utas az igazoltatáson',
  'Kihallgatás a kirendeltségen',
  'Lövések a garázsnál',
  'Banda a parkban: FI-kártya és SanGang',
  'Megfigyelés Code 5 alatt',
  'Egy betörés helyszínelése',
  'Fegyverüzlet nyomában',
  'FAB: a lejárt bérletű autószerviz',
  'Felony stop: a körözött jármű',
  'PIT vagy nem PIT?',
  'Szökés a fogolyszállításból',
  'Bankrablás: a kordon',
  'Fedett munka',
  'Túsztárgyalás a benzinkúton',
  'Sebesült kolléga: Medic ellátás');
