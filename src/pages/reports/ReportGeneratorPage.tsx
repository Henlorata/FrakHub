import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Badge} from "@/components/ui/badge";
import {toast} from "sonner";
import {
  Copy, FilePlus, FolderPlus, RefreshCcw, User, Shield, FileText, Gavel,
  Siren, Lock, CarFront, Megaphone, TriangleAlert, Receipt
} from "lucide-react";

// BŐVÍTETT SABLONOK
const TEMPLATES = {
  trafficStop: `A mai napon járőrszolgálatot teljesítettem, amikor figyelmes lettem egy [JÁRMŰ TÍPUS]-ra, amely [OK, PL. ÁTHAJTOTT A PIROSON]. A járművet fény- és hangjelzés kíséretében félreállítottam a [HELYSZÍN]-en. A sofőrt igazoltattam, az iratokat rendben találtam.`,
  ticket: `Az igazoltatás során megállapítottam, hogy a sofőr [VÉTSÉG OKA]. A vétséget közöltem vele, amit elismert. Helyszíni bírságot állítottam ki [ÖSSZEG] értékben, majd útjára engedtem.`,
  pursuit: `A felszólítás ellenére a jármű nem állt meg, menekülőre fogta. Üldözést kezdeményeztem, amelybe bekapcsolódott [EGYSÉGEK]. Az üldözés során a menekülő [VESZÉLYES MANŐVEREK]. Végül a jármű [MEGÁLLÁS OKA, PL. ÜTKÖZÖTT / MŰSZAKI HIBÁS LETT] a [HELYSZÍN]-en.`,
  accident: `Helyszínre érkezve konstatáltam, hogy egy [JÁRMŰVEK] ütköztek. A helyszínt biztosítottam, a forgalmat eltereltem. Személyi sérülés [TÖRTÉNT / NEM TÖRTÉNT]. A mentők kiérkezéséig az elsősegélynyújtást megkezdtem.`,
  arrest: `A gyanúsítottat a helyszínen földre vittem és megbilincseltem. A ruházatátvízsgálás során [TALÁLT TÁRGYAK]-t találtam. A Miranda jogait a helyszínen ismertettem, azokat megértette / nem élt velük. A kapitányságra szállítottam.`,
  interrogation: `A kihallgatóban a gyanúsított [VISELKEDÉS, PL. EGYÜTTMŰKÖDŐ VOLT / TAGADOTT]. A vádakat közöltem vele. A bírságot elfogadta, a szabadságvesztést megkezdte.`
};

export function ReportGeneratorPage() {
  const {profile} = useAuth();

  const [folderName, setFolderName] = React.useState("");
  const [formData, setFormData] = React.useState({
    officerName: "",
    officerRank: "",
    badgeNumber: "",
    colleagues: "",
    unitId: "",
    suspectName: "",
    suspectIdCard: "",
    suspectLicense: "",
    suspectMedical: "",
    date: new Date().toLocaleDateString('hu-HU'),
    charges: "",
    fine: "",
    jailTime: "",
    confiscatedItems: "-",
    description: ""
  });

  React.useEffect(() => {
    if (profile) {
      setFolderName(profile.full_name);
      setFormData(prev => ({
        ...prev,
        officerName: profile.full_name,
        officerRank: profile.faction_rank,
        badgeNumber: profile.badge_number
      }));
    }
  }, [profile]);

  // --- FORMÁZÓ FÜGGVÉNYEK ---

  const formatFine = (val: string) => {
    // Csak számjegyek megtartása
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) return "";
    // Ezres tagolás ponttal
    return `$${Number(cleanVal).toLocaleString('hu-HU').replace(/\s/g, '.')}`;
  };

  const formatJailTime = (val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) return "";
    return `${cleanVal} hónap`;
  };

  // --- GENERÁTOROK ---
  const generateFolderCode = () => {
    return `[CENTER][IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[SIZE=5][FONT=book antiqua]San Fierro Sheriff's Department - Personnel Administration Bureau: ${folderName} jelentési mappája[/FONT][/SIZE]
[/CENTER]`;
  };

  const generateReportCode = () => {
    // Formázott értékek generálása
    const formattedFine = formData.fine ? (formData.fine.includes('$') ? formData.fine : formatFine(formData.fine)) : "";
    const formattedJail = formData.jailTime ? (formData.jailTime.includes('hónap') ? formData.jailTime : formatJailTime(formData.jailTime)) : "";

    return `[QUOTE]
[IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[FONT=book antiqua][U]San Fierro Sheriff's Department - Personnel Administration Bureau: Jelentés[/U][/FONT]

[SIZE=4][FONT=book antiqua][B]I. Rendvédelmi személyek információi:[/B][/FONT][/SIZE]

[FONT=arial][COLOR=rgb(124, 112, 107)][B]Teljes neve:[/B][/COLOR] ${formData.officerName}
[COLOR=rgb(124, 112, 107)][B]Rendfokozata:[/B][/COLOR] ${formData.officerRank}
[COLOR=rgb(124, 112, 107)][B]Jelvényszáma:[/B][/COLOR] ${formData.badgeNumber}
[COLOR=rgb(124, 112, 107)][B]Jelenlévő kollégák nevei, rendfokozataik:[/B][/COLOR] ${formData.colleagues}
[COLOR=rgb(124, 112, 107)][B]Intézkedést kezdeményező egység azonosítója:[/B][/COLOR] ${formData.unitId}[/FONT]

[SIZE=4][FONT=book antiqua][B]II. Előállított személy információi:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállított személy teljes neve:[/B][/COLOR] ${formData.suspectName}
[COLOR=rgb(124, 112, 107)][B]Személyazonosító igazolvány sorszáma:[/B][/COLOR] ${formData.suspectIdCard}
[COLOR=rgb(124, 112, 107)][B]Jogosítvány sorszáma:[/B][/COLOR] ${formData.suspectLicense}
[COLOR=rgb(124, 112, 107)][B]Egészségügyi sorszáma:[/B][/COLOR] ${formData.suspectMedical}

[SIZE=4][FONT=book antiqua][B]III. Előállítás részletei:[/B][/FONT][/SIZE]

[COLOR=rgb(124, 112, 107)][B]Előállítás pontos ideje (nap/hónap/év):[/B][/COLOR] ${formData.date}
[COLOR=rgb(124, 112, 107)][B]Vétség/bűncselekmény megnevezése:[/B][/COLOR] ${formData.charges}
[COLOR=rgb(124, 112, 107)][B]Kiszabott bírság összege:[/B][/COLOR] ${formattedFine}
[COLOR=rgb(124, 112, 107)][B]Kiszabott szabadságvesztés hossza:[/B][/COLOR] ${formattedJail}
[COLOR=rgb(124, 112, 107)][B]Lefoglalt illegális tárgyak/lőfegyverek/szúró-vágó eszközök, drogterjesztéssel kapcsolatos termékek megnevezése illetve darabszáma:[/B][/COLOR] ${formData.confiscatedItems}

[SIZE=4][FONT=book antiqua][B]IV. Esetleírás:[/B][/FONT][/SIZE]

${formData.description}

[RIGHT][FONT=arial][COLOR=rgb(124, 112, 107)][B]Aláírás:[/B] [/COLOR]${formData.officerName}, ${formData.officerRank}[/FONT][/RIGHT]
[/QUOTE]`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("BBCode másolva!");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  const insertTemplate = (text: string) => {
    setFormData(prev => ({
      ...prev,
      description: prev.description ? prev.description + "\n\n" + text : text
    }));
    toast.info("Szövegrészlet beszúrva!");
  };

  const resetForm = () => {
    if (!profile) return;
    setFormData({
      officerName: profile.full_name,
      officerRank: profile.faction_rank,
      badgeNumber: profile.badge_number,
      colleagues: "",
      unitId: "",
      suspectName: "",
      suspectIdCard: "",
      suspectLicense: "",
      suspectMedical: "",
      date: new Date().toLocaleDateString('hu-HU'),
      charges: "",
      fine: "",
      jailTime: "",
      confiscatedItems: "-",
      description: ""
    });
    toast.info("Űrlap törölve.");
  };

  return (
    <div
      className="h-[calc(100vh-6rem)] flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-500 px-4 pb-4 overflow-hidden">
      <div className="flex-none mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Jelentés Generátor</h1>
          <p className="text-slate-400">Hivatalos fórum jelentések formázása egyszerűen.</p>
        </div>
      </div>

      <Tabs defaultValue="report" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-none grid w-full max-w-md grid-cols-2 bg-slate-900 border border-slate-800 mb-4">
          <TabsTrigger value="folder"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black"><FolderPlus
            className="w-4 h-4 mr-2"/> Mappa Nyitás</TabsTrigger>
          <TabsTrigger value="report"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black"><FilePlus
            className="w-4 h-4 mr-2"/> Új Jelentés</TabsTrigger>
        </TabsList>

        <TabsContent value="folder" className="flex-1">
          <Card className="bg-slate-900 border-slate-800 max-w-2xl">
            <CardHeader><CardTitle>Havi Mappa BBCode</CardTitle><CardDescription>Hónap elején nyitandó téma
              kódja.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Név</Label><Input value={folderName}
                                                                  onChange={(e) => setFolderName(e.target.value)}
                                                                  className="bg-slate-950 border-slate-700"/></div>
              <div className="relative">
                <Textarea readOnly value={generateFolderCode()}
                          className="h-32 bg-slate-950 border-slate-800 font-mono text-xs text-slate-300 resize-none"/>
                <Button size="sm" className="absolute top-2 right-2 bg-yellow-600 hover:bg-yellow-700 text-black"
                        onClick={() => copyToClipboard(generateFolderCode())}><Copy
                  className="w-4 h-4 mr-2"/> Másolás</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="flex-1 min-h-0">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">

            <div className="xl:col-span-8 h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
              <ScrollArea className="h-full p-4">
                <div className="space-y-6 pb-10">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center gap-2 py-3">
                        <Shield className="w-4 h-4 text-blue-500"/>
                        <CardTitle className="text-sm uppercase text-slate-300 font-bold">I. Rendvédelmi
                          Adatok</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Teljes Név</Label><Input
                          value={formData.officerName} onChange={e => handleChange('officerName', e.target.value)}
                          className="bg-slate-950 border-slate-700 h-8"/></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label
                            className="text-xs text-slate-400">Rendfokozat</Label><Input value={formData.officerRank}
                                                                                         onChange={e => handleChange('officerRank', e.target.value)}
                                                                                         className="bg-slate-950 border-slate-700 h-8"/>
                          </div>
                          <div className="space-y-1.5"><Label
                            className="text-xs text-slate-400">Jelvényszám</Label><Input value={formData.badgeNumber}
                                                                                         onChange={e => handleChange('badgeNumber', e.target.value)}
                                                                                         className="bg-slate-950 border-slate-700 h-8"/>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label
                            className="text-xs text-slate-400">Egységszám</Label><Input placeholder="pl. 6-LINCOLN-005"
                                                                                        value={formData.unitId}
                                                                                        onChange={e => handleChange('unitId', e.target.value)}
                                                                                        className="bg-slate-950 border-slate-700 h-8"/>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs text-slate-400">Társak</Label><Input
                            placeholder="Név, Rang" value={formData.colleagues}
                            onChange={e => handleChange('colleagues', e.target.value)}
                            className="bg-slate-950 border-slate-700 h-8"/></div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                      <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center gap-2 py-3">
                        <User className="w-4 h-4 text-red-500"/>
                        <CardTitle className="text-sm uppercase text-slate-300 font-bold">II. Előállított
                          Személy</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Név</Label><Input
                          value={formData.suspectName} onChange={e => handleChange('suspectName', e.target.value)}
                          className="bg-slate-950 border-slate-700 h-8"/></div>
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Személyi
                          Igazolvány</Label><Input value={formData.suspectIdCard}
                                                   onChange={e => handleChange('suspectIdCard', e.target.value)}
                                                   className="bg-slate-950 border-slate-700 h-8"/></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label
                            className="text-xs text-slate-400">Jogosítvány</Label><Input value={formData.suspectLicense}
                                                                                         onChange={e => handleChange('suspectLicense', e.target.value)}
                                                                                         className="bg-slate-950 border-slate-700 h-8"/>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs text-slate-400">Eü.
                            Kártya</Label><Input value={formData.suspectMedical}
                                                 onChange={e => handleChange('suspectMedical', e.target.value)}
                                                 className="bg-slate-950 border-slate-700 h-8"/></div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-3 border-b border-slate-800/50 flex flex-row items-center gap-2 py-3">
                      <Gavel className="w-4 h-4 text-yellow-500"/>
                      <CardTitle className="text-sm uppercase text-slate-300 font-bold">III. Intézkedés</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Dátum</Label><Input
                          value={formData.date} onChange={e => handleChange('date', e.target.value)}
                          className="bg-slate-950 border-slate-700 h-8"/></div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400">Bírság ($)</Label>
                          <Input
                            placeholder="pl. 45000 (Csak szám)"
                            value={formData.fine}
                            onChange={e => handleChange('fine', e.target.value)}
                            className="bg-slate-950 border-slate-700 h-8"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5">Csak a számot írd be! (pl. 55000)</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-slate-400">Börtön (perc)</Label>
                          <Input
                            placeholder="pl. 90 (Csak szám)"
                            value={formData.jailTime}
                            onChange={e => handleChange('jailTime', e.target.value)}
                            className="bg-slate-950 border-slate-700 h-8"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5">Csak a számot írd be! (pl. 120)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Vádak</Label><Input
                          value={formData.charges} onChange={e => handleChange('charges', e.target.value)}
                          className="bg-slate-950 border-slate-700 h-8"/></div>
                        <div className="space-y-1.5"><Label className="text-xs text-slate-400">Lefoglalt Tárgyak</Label><Input
                          value={formData.confiscatedItems}
                          onChange={e => handleChange('confiscatedItems', e.target.value)}
                          className="bg-slate-950 border-slate-700 h-8"/></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader
                      className="pb-3 border-b border-slate-800/50 flex flex-row items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400"/>
                        <CardTitle className="text-sm uppercase text-slate-300 font-bold">IV. Esetleírás</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs text-slate-500 font-normal border-slate-700">Sablonok
                        használata javasolt</Badge>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-blue-900/20 border-blue-900/50 text-blue-300 hover:bg-blue-900/40"
                                onClick={() => insertTemplate(TEMPLATES.trafficStop)}><CarFront
                          className="w-3 h-3 mr-1.5"/> Igazoltatás</Button>
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-green-900/20 border-green-900/50 text-green-300 hover:bg-green-900/40"
                                onClick={() => insertTemplate(TEMPLATES.ticket)}><Receipt
                          className="w-3 h-3 mr-1.5"/> Csekk/Bírság</Button>
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-yellow-900/20 border-yellow-900/50 text-yellow-300 hover:bg-yellow-900/40"
                                onClick={() => insertTemplate(TEMPLATES.accident)}><TriangleAlert
                          className="w-3 h-3 mr-1.5"/> Baleset</Button>
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-red-900/20 border-red-900/50 text-red-300 hover:bg-red-900/40"
                                onClick={() => insertTemplate(TEMPLATES.pursuit)}><Siren
                          className="w-3 h-3 mr-1.5"/> Üldözés</Button>
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-orange-900/20 border-orange-900/50 text-orange-300 hover:bg-orange-900/40"
                                onClick={() => insertTemplate(TEMPLATES.arrest)}><Lock
                          className="w-3 h-3 mr-1.5"/> Elfogás</Button>
                        <Button size="sm" variant="outline"
                                className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                onClick={() => insertTemplate(TEMPLATES.interrogation)}><Megaphone
                          className="w-3 h-3 mr-1.5"/> Kihallgatás</Button>
                      </div>

                      <Textarea placeholder="Írd le részletesen az eseményeket, vagy használj sablont..."
                                className="bg-slate-950 border-slate-700 min-h-[200px] text-sm leading-relaxed"
                                value={formData.description}
                                onChange={e => handleChange('description', e.target.value)}/>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button variant="outline" onClick={resetForm}
                            className="border-slate-700 text-slate-400 hover:bg-slate-800"><RefreshCcw
                      className="w-4 h-4 mr-2"/> Űrlap Törlése</Button>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <div className="xl:col-span-4 h-full flex flex-col">
              <Card
                className="bg-slate-900 border-slate-800 shadow-xl border-t-4 border-t-yellow-600 flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-4 shrink-0 bg-slate-900/50 border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-lg"><Copy
                    className="w-5 h-5 text-yellow-500"/> Előnézet & Kód</CardTitle>
                  <CardDescription>A generált BBCode a fórumhoz.</CardDescription>
                </CardHeader>
                <div className="flex-1 relative min-h-0">
                  <Textarea readOnly value={generateReportCode()}
                            className="absolute inset-0 w-full h-full bg-slate-950 border-none font-mono text-[11px] leading-relaxed text-slate-300 focus:ring-0 resize-none p-4 rounded-none"/>
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                  <Button
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg shadow-yellow-900/20 h-12 text-base"
                    onClick={() => copyToClipboard(generateReportCode())}><Copy className="w-5 h-5 mr-2"/> Másolás
                    vágólapra</Button>
                </div>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}