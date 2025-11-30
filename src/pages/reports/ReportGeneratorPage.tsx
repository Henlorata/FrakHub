import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";
import {toast} from "sonner";
import {
  Copy, FilePlus, FolderPlus, RefreshCcw, User, Shield, FileText, Gavel,
  Siren, Lock, CarFront, Megaphone, TriangleAlert, Receipt, Calendar, Hash, DollarSign, Clock, Users
} from "lucide-react";
import {cn} from "@/lib/utils";
import {SheriffBackground} from "@/components/SheriffBackground";

// BŐVÍTETT SABLONOK (Eredeti szövegezés)
const TEMPLATES = {
  trafficStop: `A mai napon járőrszolgálatot teljesítettem, amikor figyelmes lettem egy [JÁRMŰ TÍPUS]-ra, amely [OK, PL. ÁTHAJTOTT A PIROSON]. A járművet fény- és hangjelzés kíséretében félreállítottam a [HELYSZÍN]-en. A sofőrt igazoltattam, az iratokat rendben találtam.`,
  ticket: `Az igazoltatás során megállapítottam, hogy a sofőr [VÉTSÉG OKA]. A vétséget közöltem vele, amit elismert. Helyszíni bírságot állítottam ki [ÖSSZEG] értékben, majd útjára engedtem.`,
  pursuit: `A felszólítás ellenére a jármű nem állt meg, menekülőre fogta. Üldözést kezdeményeztem, amelybe bekapcsolódott [EGYSÉGEK]. Az üldözés során a menekülő [VESZÉLYES MANŐVEREK]. Végül a jármű [MEGÁLLÁS OKA, PL. ÜTKÖZÖTT / MŰSZAKI HIBÁS LETT] a [HELYSZÍN]-en.`,
  accident: `Helyszínre érkezve konstatáltam, hogy egy [JÁRMŰVEK] ütköztek. A helyszínt biztosítottam, a forgalmat eltereltem. Személyi sérülés [TÖRTÉNT / NEM TÖRTÉNT]. A mentők kiérkezéséig az elsősegélynyújtást megkezdtem.`,
  arrest: `A gyanúsítottat a helyszínen földre vittem és megbilincseltem. A ruházatátvízsgálás során [TALÁLT TÁRGYAK]-t találtam. A Miranda jogait a helyszínen ismertettem, azokat megértette / nem élt velük. A kapitányságra szállítottam.`,
  interrogation: `A kihallgatóban a gyanúsított [VISELKEDÉS, PL. EGYÜTTMŰKÖDŐ VOLT / TAGADOTT]. A vádakat közöltem vele. A bírságot elfogadta, a szabadságvesztést megkezdte.`
};

// --- TECH INPUT KOMPONENS ---
const TechInput = ({icon: Icon, className, ...props}: any) => (
  <div className="relative group">
    <div
      className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center bg-slate-900 border-r border-slate-800 rounded-l-md group-focus-within:border-blue-500/50 group-focus-within:bg-blue-900/20 transition-colors">
      <Icon className="w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors"/>
    </div>
    <Input
      className={cn("pl-12 bg-[#0b1221] border-slate-800 focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 h-10 font-mono text-sm text-slate-200 placeholder:text-slate-700", className)}
      {...props}
    />
  </div>
);

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

  // --- FORMÁZÓK ---
  const formatFine = (val: string) => {
    if (val.trim() === '-' || val.trim() === '') return "-";
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) return "";
    return `$${Number(cleanVal).toLocaleString('hu-HU').replace(/\s/g, '.')}`;
  };

  const formatJailTime = (val: string) => {
    if (val.trim() === '-' || val.trim() === '') return "-";
    const cleanVal = val.replace(/\D/g, '');
    if (!cleanVal) return "";
    return `${cleanVal} hónap`;
  };

  // --- SZIGORÚ INPUT VALIDÁCIÓ ---
  const handleNumberOrDashChange = (field: string, value: string) => {
    // Csak számok vagy egyetlen "-" jel
    if (/^$|^-?$|^\d+$/.test(value)) {
      setFormData(prev => ({...prev, [field]: value}));
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  // --- GENERÁTOROK (EREDETI) ---
  const generateFolderCode = () => {
    return `[CENTER][IMG]https://i.imgur.com/ClUbwZP.png[/IMG]
[SIZE=5][FONT=book antiqua]San Fierro Sheriff's Department - Personnel Administration Bureau: ${folderName} jelentési mappája[/FONT][/SIZE]
[/CENTER]`;
  };

  const generateReportCode = () => {
    const formattedFine = formData.fine ? (formData.fine === '-' || formData.fine.includes('$') ? formData.fine : formatFine(formData.fine)) : "";
    const formattedJail = formData.jailTime ? (formData.jailTime === '-' || formData.jailTime.includes('hónap') ? formData.jailTime : formatJailTime(formData.jailTime)) : "";

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

  const insertTemplate = (text: string) => {
    setFormData(prev => ({
      ...prev,
      description: prev.description ? prev.description + "\n\n" + text : text
    }));
    toast.info("Sablon beszúrva.");
  };

  const resetForm = () => {
    if (!profile) return;
    setFormData({
      officerName: profile.full_name,
      officerRank: profile.faction_rank,
      badgeNumber: profile.badge_number,
      colleagues: "", unitId: "", suspectName: "", suspectIdCard: "", suspectLicense: "", suspectMedical: "",
      date: new Date().toLocaleDateString('hu-HU'),
      charges: "", fine: "", jailTime: "", confiscatedItems: "-", description: ""
    });
    toast.info("Űrlap törölve.");
  };

  const TemplateButton = ({label, text, icon: Icon, colorClass}: any) => (
    <button onClick={() => insertTemplate(text)}
            className={cn("flex flex-col items-center justify-center p-3 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all group shadow-sm hover:shadow-md", colorClass)}>
      <Icon className="w-5 h-5 mb-1 opacity-70 group-hover:opacity-100 transition-opacity"/>
      <span
        className="text-[10px] font-bold uppercase tracking-wide text-slate-400 group-hover:text-white">{label}</span>
    </button>
  );

  return (
    <div
      className="h-[calc(100vh-6rem)] flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-500 px-6 pb-6 overflow-hidden relative">
      <SheriffBackground side="right"/>

      {/* HEADER */}
      <div
        className="flex-none mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 text-yellow-500/80 mb-1"><FileText className="w-4 h-4"/><span
            className="text-[10px] font-bold uppercase tracking-[0.3em]">ADMINISTRATION</span></div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-lg">Jelentés
            Generátor</h1>
        </div>
      </div>

      {/* TABS & CONTENT */}
      <Tabs defaultValue="report" className="flex-1 flex flex-col min-h-0 relative z-10">
        <TabsList
          className="flex-none w-fit bg-slate-900/80 border border-slate-700 p-1 mb-6 rounded-lg backdrop-blur-md">
          <TabsTrigger value="folder"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black text-slate-300 uppercase font-bold text-xs tracking-wider px-6 transition-all"><FolderPlus
            className="w-3.5 h-3.5 mr-2"/> Mappa Nyitás</TabsTrigger>
          <TabsTrigger value="report"
                       className="data-[state=active]:bg-yellow-600 data-[state=active]:text-black text-slate-300 uppercase font-bold text-xs tracking-wider px-6 transition-all"><FilePlus
            className="w-3.5 h-3.5 mr-2"/> Új Jelentés</TabsTrigger>
        </TabsList>

        <TabsContent value="folder" className="flex-1">
          <Card className="bg-[#0b1221] border border-slate-800 max-w-2xl shadow-2xl">
            <CardHeader className="border-b border-slate-800/50 bg-slate-950/30"><CardTitle
              className="text-white uppercase font-bold tracking-wide text-sm">Havi Mappa
              BBCode</CardTitle></CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1.5"><Label
                className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mappa Neve</Label><TechInput
                icon={User} value={folderName} onChange={(e: any) => setFolderName(e.target.value)}/></div>
              <div className="relative group">
                <div
                  className="absolute -inset-0.5 bg-gradient-to-r from-yellow-600 to-slate-600 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity blur"></div>
                <Textarea readOnly value={generateFolderCode()}
                          className="relative h-32 bg-[#050a14] border-slate-800 font-mono text-xs text-slate-300 resize-none p-4 focus:ring-0 break-all"/>
                <Button size="sm"
                        className="absolute top-3 right-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs uppercase tracking-wider"
                        onClick={() => copyToClipboard(generateFolderCode())}><Copy
                  className="w-3.5 h-3.5 mr-2"/> Másolás</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">

            {/* --- BAL OSZLOP: ŰRLAP --- */}
            <div
              className="xl:col-span-8 h-full flex flex-col bg-[#0b1221] border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
              <div
                className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center backdrop-blur-md shrink-0">
                <span
                  className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText
                  className="w-4 h-4 text-blue-500"/> ADATBEVITELI ŰRLAP</span>
                <Button variant="ghost" size="sm" onClick={resetForm}
                        className="h-7 text-[10px] uppercase font-bold text-red-400 hover:text-red-300 hover:bg-red-950/20"><RefreshCcw
                  className="w-3 h-3 mr-1.5"/> Törlés</Button>
              </div>

              {/* JAVÍTÁS: A ScrollArea szülője flex-1 és overflow-hidden, hogy működjön a görgetés */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                  <div className="p-6 space-y-8">

                    {/* I. SZEMÉLYES */}
                    <div className="space-y-4">
                      <h3
                        className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800/50 pb-2 mb-4">I.
                        Rendvédelmi Adatok</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Teljes
                            Név</Label><TechInput icon={User} value={formData.officerName}
                                                  onChange={(e: any) => handleChange('officerName', e.target.value)}/>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label
                              className="text-[10px] uppercase font-bold text-slate-500">Rendfokozat</Label><TechInput
                              icon={Shield} value={formData.officerRank}
                              onChange={(e: any) => handleChange('officerRank', e.target.value)}/></div>
                            <div className="space-y-1"><Label
                              className="text-[10px] uppercase font-bold text-slate-500">Jelvényszám</Label><TechInput
                              icon={Hash} value={formData.badgeNumber}
                              onChange={(e: any) => handleChange('badgeNumber', e.target.value)}/></div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1"><Label
                            className="text-[10px] uppercase font-bold text-slate-500">Egységszám</Label><TechInput
                            icon={CarFront} placeholder="pl. 6-L-005" value={formData.unitId}
                            onChange={(e: any) => handleChange('unitId', e.target.value)}/></div>
                          <div className="space-y-1"><Label
                            className="text-[10px] uppercase font-bold text-slate-500">Társak</Label><TechInput
                            icon={Users} placeholder="Név, Rang" value={formData.colleagues}
                            onChange={(e: any) => handleChange('colleagues', e.target.value)}/></div>
                        </div>
                      </div>
                    </div>

                    {/* II. GYANÚSÍTOTT */}
                    <div className="space-y-4">
                      <h3
                        className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800/50 pb-2 mb-4">II.
                        Előállított Személy</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1"><Label
                          className="text-[10px] uppercase font-bold text-slate-500">Név</Label><TechInput icon={User}
                                                                                                           className="border-red-900/30 focus-visible:border-red-500/50 focus-visible:ring-red-500/20"
                                                                                                           value={formData.suspectName}
                                                                                                           onChange={(e: any) => handleChange('suspectName', e.target.value)}/>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Személyi
                          Igazolvány</Label><TechInput icon={FileText} value={formData.suspectIdCard}
                                                       onChange={(e: any) => handleChange('suspectIdCard', e.target.value)}/>
                        </div>
                        <div className="space-y-1"><Label
                          className="text-[10px] uppercase font-bold text-slate-500">Jogosítvány</Label><TechInput
                          icon={FileText} value={formData.suspectLicense}
                          onChange={(e: any) => handleChange('suspectLicense', e.target.value)}/></div>
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Eü.
                          Kártya</Label><TechInput icon={FileText} value={formData.suspectMedical}
                                                   onChange={(e: any) => handleChange('suspectMedical', e.target.value)}/>
                        </div>
                      </div>
                    </div>

                    {/* III. INTÉZKEDÉS */}
                    <Card className="bg-[#0b1221] border border-slate-800">
                      <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30 py-3"><CardTitle
                        className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">III.
                        Szankciók</CardTitle></CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1"><Label
                            className="text-[10px] uppercase font-bold text-slate-500">Dátum</Label><TechInput
                            icon={Calendar} value={formData.date}
                            onChange={(e: any) => handleChange('date', e.target.value)}/></div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Bírság ($)</Label>
                            <TechInput icon={DollarSign} placeholder="Szám vagy -" value={formData.fine}
                                       onChange={(e: any) => handleNumberOrDashChange('fine', e.target.value)}
                                       className="text-green-400 font-bold"/>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-500">Börtön (perc)</Label>
                            <TechInput icon={Clock} placeholder="Szám vagy -" value={formData.jailTime}
                                       onChange={(e: any) => handleNumberOrDashChange('jailTime', e.target.value)}
                                       className="text-red-400 font-bold"/>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1"><Label
                            className="text-[10px] uppercase font-bold text-slate-500">Vádak</Label><TechInput
                            icon={Gavel} value={formData.charges}
                            onChange={(e: any) => handleChange('charges', e.target.value)}/></div>
                          <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-slate-500">Lefoglalt
                            Tárgyak</Label><TechInput icon={Lock} value={formData.confiscatedItems}
                                                      onChange={(e: any) => handleChange('confiscatedItems', e.target.value)}/>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* IV. LEÍRÁS (KÁRTYÁBAN, JÓL LÁTHATÓAN) */}
                    <Card className="bg-[#0b1221] border border-slate-800">
                      <CardHeader
                        className="pb-3 border-b border-slate-800/50 bg-slate-950/30 flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">IV.
                          Esetleírás</CardTitle>
                        <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-700 bg-slate-900/50">GYORS
                          SABLONOK</Badge>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          <TemplateButton label="IGAZOLTATÁS" text={TEMPLATES.trafficStop} icon={CarFront}
                                          colorClass="hover:border-blue-500/50 hover:text-blue-400"/>
                          <TemplateButton label="BÍRSÁG" text={TEMPLATES.ticket} icon={Receipt}
                                          colorClass="hover:border-green-500/50 hover:text-green-400"/>
                          <TemplateButton label="BALESET" text={TEMPLATES.accident} icon={TriangleAlert}
                                          colorClass="hover:border-yellow-500/50 hover:text-yellow-400"/>
                          <TemplateButton label="ÜLDÖZÉS" text={TEMPLATES.pursuit} icon={Siren}
                                          colorClass="hover:border-red-500/50 hover:text-red-400"/>
                          <TemplateButton label="ELFOGÁS" text={TEMPLATES.arrest} icon={Lock}
                                          colorClass="hover:border-orange-500/50 hover:text-orange-400"/>
                          <TemplateButton label="KIHALLGATÁS" text={TEMPLATES.interrogation} icon={Megaphone}
                                          colorClass="hover:border-slate-500 hover:text-slate-300"/>
                        </div>

                        <div className="relative group">
                          <div
                            className="absolute -inset-0.5 bg-gradient-to-b from-slate-800 to-transparent rounded-lg opacity-50 group-focus-within:opacity-100 group-focus-within:from-blue-600/50 transition-all blur-sm"></div>
                          <Textarea placeholder="Részletes leírás..."
                                    className="relative bg-[#050a14] border-slate-800 min-h-[200px] text-sm leading-relaxed break-all font-mono text-slate-300 focus-visible:ring-0 focus-visible:border-blue-500/50 p-4 resize-none break-all"
                                    value={formData.description}
                                    onChange={e => handleChange('description', e.target.value)}/>
                        </div>
                      </CardContent>
                    </Card>

                  </div>
                </div>
              </div>
            </div>

            {/* --- JOBB OSZLOP: PREVIEW --- */}
            <div className="xl:col-span-4 h-full flex flex-col">
              <Card
                className="bg-[#0b1221] border border-slate-800 shadow-xl border-t-4 border-t-yellow-600 flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-4 shrink-0 bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm">
                  <CardTitle className="flex items-center gap-2 text-lg"><Copy
                    className="w-5 h-5 text-yellow-500"/> Előnézet & Kód</CardTitle>
                  <CardDescription>A generált BBCode a fórumhoz.</CardDescription>
                </CardHeader>
                <div className="flex-1 relative min-h-0 bg-[#050a14]">
                  <Textarea readOnly value={generateReportCode()}
                            className="absolute inset-0 w-full h-full bg-transparent border-none font-mono text-[11px] leading-relaxed text-green-500/80 focus:ring-0 resize-none p-4 rounded-none custom-scrollbar break-all"/>
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
                  <Button
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold shadow-lg shadow-yellow-900/20 h-12 text-base uppercase tracking-wider"
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