import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Book, Gavel, Radio, Search } from "lucide-react";

// Adatok importálása
import penalCodeData from "@/data/penalcode.json";
// A te meglévő magyar típusaidat importáljuk
import type { Kategoria, Tetel } from "@/types/penalcode";

// --- RÁDIÓ KÓDOK ADATBÁZIS (Példa) ---
const RADIO_CODES = [
  { code: "10-4", meaning: "Vettem / Értettem" },
  { code: "10-20", meaning: "Pozícióm / Helyzetem" },
  { code: "10-6", meaning: "Elfoglalt (nem elérhető)" },
  { code: "10-8", meaning: "Elérhető / Szolgálatban" },
  { code: "10-7", meaning: "Szolgálaton kívül" },
  { code: "10-15", meaning: "Gyanúsított letartóztatva / fogoly szállítás" },
  { code: "10-27", meaning: "Igazoltatás folyamatban" },
  { code: "10-32", meaning: "Erősítést kérek (Sürgős)" },
  { code: "10-38", meaning: "Igazoltatás / Megállítás (Traffic Stop)" },
  { code: "10-70", meaning: "Tűzriadó / Tűzeset" },
  { code: "10-80", meaning: "Üldözés folyamatban" },
  { code: "Code 0", meaning: "Sürgős segítségkérés (Tiszti vészhelyzet - Minden egység reagál!)" },
  { code: "Code 4", meaning: "Helyszín tiszta / Nincs szükség további egységre" },
];

export function ResourcesPage() {
  // Penal Code State
  const [pcSearch, setPcSearch] = React.useState("");

  // Kényszerítjük a típust, mert a JSON importot a TS néha nem látja pontosan
  // A JSON maga egy tömb a gyökérben, nem pedig { categories: [...] }
  const categories: Kategoria[] = penalCodeData as unknown as Kategoria[];

  // Radio Code State
  const [radioSearch, setRadioSearch] = React.useState("");

  // Penal Code szűrés
  const filteredCategories = React.useMemo(() => {
    if (!pcSearch) return categories;
    const lowerSearch = pcSearch.toLowerCase();

    return categories.map((cat: Kategoria) => ({
      ...cat,
      // Szűrés a tételeken belül
      tetelek: cat.tetelek.filter((tetel: Tetel) =>
        tetel.megnevezes.toLowerCase().includes(lowerSearch) ||
        // Ha van alpont, abban is kereshetünk, vagy a megjegyzésben
        tetel.megjegyzes?.toLowerCase().includes(lowerSearch)
      )
    })).filter(cat => cat.tetelek.length > 0); // Csak azokat a kategóriákat mutatjuk, ahol maradt tétel
  }, [pcSearch, categories]);

  // Radio Code szűrés
  const filteredRadioCodes = React.useMemo(() => {
    if (!radioSearch) return RADIO_CODES;
    const lower = radioSearch.toLowerCase();
    return RADIO_CODES.filter(rc => rc.code.toLowerCase().includes(lower) || rc.meaning.toLowerCase().includes(lower));
  }, [radioSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Dokumentáció</h1>
          <p className="text-slate-400">Törvénykönyv, szabályzatok és segédanyagok.</p>
        </div>
      </div>

      <Tabs defaultValue="penalcode" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-900 border border-slate-800">
          <TabsTrigger value="penalcode" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">
            <Gavel className="w-4 h-4 mr-2"/> Btk. (Penal Code)
          </TabsTrigger>
          <TabsTrigger value="rules" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">
            <Book className="w-4 h-4 mr-2"/> Szabályzat
          </TabsTrigger>
          <TabsTrigger value="radio" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black">
            <Radio className="w-4 h-4 mr-2"/> Rádió Kódok
          </TabsTrigger>
        </TabsList>

        {/* --- BTK TAB --- */}
        <TabsContent value="penalcode" className="mt-6 space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Büntető Törvénykönyv</CardTitle>
              <CardDescription>Keresés a vádpontok és büntetési tételek között.</CardDescription>
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Keresés (pl. Gyilkosság, Rablás)..."
                    className="pl-9 bg-slate-950 border-slate-700"
                    value={pcSearch}
                    onChange={(e) => setPcSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {filteredCategories.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nincs találat.</p>
                ) : (
                  <div className="space-y-8">
                    {filteredCategories.map((category, idx) => (
                      <div key={idx} className="space-y-4">
                        <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 border-b border-slate-800">
                          {category.kategoria_nev}
                        </h3>
                        <div className="grid gap-4">
                          {category.tetelek.map((tetel, tetelIdx) => (
                            <div key={tetelIdx} className="bg-slate-950 p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                              <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-2 gap-2">
                                <div>
                                  <span className="text-xs font-mono text-yellow-600 mr-2">{tetel.paragrafus}</span>
                                  <h4 className="font-bold text-white inline">{tetel.megnevezes}</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {/* Fegyház megjelenítése */}
                                  {(tetel.min_fegyhaz || tetel.max_fegyhaz) && (
                                    <Badge variant="outline" className="border-red-900/50 text-red-400 bg-red-950/10">
                                      {tetel.min_fegyhaz}
                                      {tetel.min_fegyhaz !== tetel.max_fegyhaz ? ` - ${tetel.max_fegyhaz}` : ''} perc
                                    </Badge>
                                  )}
                                  {/* Bírság megjelenítése */}
                                  {(tetel.min_birsag || tetel.max_birsag) && (
                                    <Badge variant="outline" className="border-green-900/50 text-green-400 bg-green-950/10">
                                      ${(tetel.min_birsag ?? 0).toLocaleString()}
                                      {tetel.min_birsag !== tetel.max_birsag ? ` - ${(tetel.max_birsag ?? 0).toLocaleString()}` : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Megjegyzés és Alpontok */}
                              {tetel.megjegyzes && <p className="text-sm text-slate-500 mt-1 italic">{tetel.megjegyzes}</p>}

                              {tetel.alpontok && tetel.alpontok.length > 0 && (
                                <div className="mt-3 pl-4 border-l-2 border-slate-800 space-y-1">
                                  {tetel.alpontok.map((alpont, apIdx) => (
                                    <p key={apIdx} className="text-sm text-slate-400">
                                      <span className="text-yellow-700 text-xs mr-1">{alpont.paragrafus}</span>
                                      {alpont.megnevezes}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- SZABÁLYZAT TAB --- */}
        <TabsContent value="rules" className="mt-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Frakció Szabályzat</CardTitle>
              <CardDescription>Az SFSD belső működési szabályzata.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1" className="border-slate-800">
                    <AccordionTrigger className="text-white hover:text-yellow-500">1. Általános Viselkedés</AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      Minden frakciótag köteles tisztelettudóan viselkedni játékostársaival, mind OOC, mind IC.
                      A toxikus viselkedés, a szabályzat szándékos kijátszása azonnali eltávolítást vonhat maga után.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2" className="border-slate-800">
                    <AccordionTrigger className="text-white hover:text-yellow-500">2. Szolgálati Járművek</AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      A szolgálati járműveket köteles mindenki sérülésmentesen, megtankolva leadni a garázsban.
                      Sérült járművel tilos járőrszolgálatot kezdeni. Indokolatlan szirénahasználat tilos.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3" className="border-slate-800">
                    <AccordionTrigger className="text-white hover:text-yellow-500">3. Rádióforgalmazás</AccordionTrigger>
                    <AccordionContent className="text-slate-400">
                      A rádióban rövid, tömör és érthető kommunikációt várunk el. Használd a 10-es kódokat, ahol lehetséges.
                      Sürgősségi hívásnál (Code 0, 10-80) a rádiócsend kötelező.
                    </AccordionContent>
                  </AccordionItem>
                  {/* Ide jöhet még több szabály */}
                </Accordion>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- RÁDIÓ KÓDOK TAB --- */}
        <TabsContent value="radio" className="mt-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Rádió Kódok (Ten-Codes)</CardTitle>
              <CardDescription>A leggyakrabban használt 10-es és sürgősségi kódok.</CardDescription>
              <div className="pt-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Kód vagy jelentés keresése..."
                    className="pl-9 bg-slate-950 border-slate-700"
                    value={radioSearch}
                    onChange={(e) => setRadioSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-slate-800 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-3">Kód</th>
                    <th className="px-6 py-3">Jelentés</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                  {filteredRadioCodes.map((rc, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/80 transition-colors">
                      <td className="px-6 py-3 font-mono text-yellow-500 font-bold">{rc.code}</td>
                      <td className="px-6 py-3 text-slate-300">{rc.meaning}</td>
                    </tr>
                  ))}
                  {filteredRadioCodes.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-slate-500">Nincs találat.</td>
                    </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}