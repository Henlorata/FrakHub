import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit, Save, Lock, CheckCircle2, Settings, ArrowRight, LayoutTemplate, Globe } from "lucide-react";
import { FACTION_RANKS, type Profile } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { AcademyEditor } from "../components/AcademyEditor";

// --- SEGÉDKOMPONENS A BEÁLLÍTÁSOKHOZ (EXAM EDITOR STÍLUS) ---
const SettingToggle = ({title, description, active, onChange, icon: Icon, activeColorClass}: any) => (
  <div onClick={() => onChange(!active)}
       className={cn("flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer select-none group hover:border-slate-600", active ? cn("bg-slate-900/80", activeColorClass || "border-blue-500/50") : "bg-slate-950 border-slate-800")}>
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-md transition-colors", active ? "bg-white/10 text-white" : "bg-slate-900 text-slate-500")}>
        <Icon className="w-5 h-5"/>
      </div>
      <div>
        <div className={cn("text-sm font-bold uppercase tracking-wide transition-colors", active ? "text-white" : "text-slate-400")}>{title}</div>
        <div className="text-[10px] text-slate-500">{description}</div>
      </div>
    </div>
    <Switch checked={active} onCheckedChange={onChange}/>
  </div>
);

interface DivisionAcademyViewProps {
  courseId: string;
  isInstructor: boolean;
  currentUser: Profile | null;
}

export function DivisionAcademyView({ courseId, isInstructor, currentUser }: DivisionAcademyViewProps) {
  const { supabase } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [courseConfig, setCourseConfig] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [completedMaterialIds, setCompletedMaterialIds] = useState<string[]>([]);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const isQual = courseId.startsWith('qual_');
  const displayName = isQual ? `${courseId.split('_')[1]} Képesítés Tananyaga` : `${courseId.toUpperCase()} Akadémia`;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let { data: config } = await supabase.from('academy_courses').select('*').eq('id', courseId).single();

      if (!config && isInstructor) {
        const { data: newConfig } = await supabase.from('academy_courses').insert({
          id: courseId,
          is_open: false,
          linear_progression: true
        }).select().single();
        config = newConfig;
      }
      setCourseConfig(config);

      const { data: mats } = await supabase.from('academy_division_materials')
        .select('*')
        .eq('course_id', courseId)
        .order('page_order', { ascending: true });

      setMaterials(mats || []);

      if (currentUser) {
        const { data: prog } = await supabase.from('academy_progress')
          .select('material_id')
          .eq('user_id', currentUser.id);
        setCompletedMaterialIds(prog?.map(p => p.material_id) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setIsEditing(false);
    setCurrentPageIndex(0);
  }, [courseId, currentUser]);

  const handleCompletePage = async (materialId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('academy_progress').insert({
        user_id: currentUser.id,
        material_id: materialId
      });
      if (error) throw error;
      setCompletedMaterialIds(prev => [...prev, materialId]);
      toast.success("Oldal teljesítve!");

      if (currentPageIndex < materials.length - 1) {
        setCurrentPageIndex(prev => prev + 1);
      }
    } catch (e: any) {
      toast.error("Hiba a mentéskor: " + e.message);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await supabase.from('academy_courses').update({
        is_open: courseConfig.is_open,
        linear_progression: courseConfig.linear_progression,
        required_rank: courseConfig.required_rank
      }).eq('id', courseId);
      toast.success("Beállítások mentve.");
    } catch (e) {
      toast.error("Hiba a mentéskor.");
    }
  };

  const addNewPage = async () => {
    try {
      const { data, error } = await supabase.from('academy_division_materials').insert({
        course_id: courseId,
        title: "Új Tananyag Oldal",
        page_order: materials.length + 1,
        content: {},
        theme: 'default'
      }).select().single();

      if (error) throw error;
      setMaterials([...materials, data]);
      setCurrentPageIndex(materials.length);
      toast.success("Új oldal létrehozva!");
    } catch (e) {
      toast.error("Hiba az oldal létrehozásakor.");
    }
  };

  const deletePage = async (id: string) => {
    try {
      await supabase.from('academy_division_materials').delete().eq('id', id);
      setMaterials(materials.filter(m => m.id !== id));
      if (currentPageIndex > 0) setCurrentPageIndex(prev => prev - 1);
      toast.success("Oldal törölve.");
    } catch (e) {
      toast.error("Hiba a törléskor.");
    }
  };

  const hasAccess = () => {
    if (isInstructor) return true;
    if (!courseConfig) return false;
    if (!courseConfig.is_open) return false;

    if (courseConfig.required_rank && currentUser) {
      const reqIdx = FACTION_RANKS.indexOf(courseConfig.required_rank);
      const userIdx = FACTION_RANKS.indexOf(currentUser.faction_rank);
      if (userIdx > reqIdx) return false;
    }
    return true;
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-sky-500"/></div>;
  }

  if (!hasAccess()) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95">
        <div className="p-6 bg-red-950/30 rounded-full border border-red-900/50 mb-6 shadow-2xl">
          <Lock className="w-12 h-12 text-red-500"/>
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Hozzáférés Megtagadva</h2>
        <p className="text-slate-400 max-w-md">
          {!courseConfig?.is_open ? "Ez a tananyag jelenleg zártkörű vagy feltöltés alatt áll." :
            courseConfig?.required_rank ? `Ehhez a tananyaghoz minimum ${courseConfig.required_rank} rendfokozat szükséges.` :
              "Nincs jogosultságod a megtekintéshez."}
        </p>
      </div>
    );
  }

  if (materials.length === 0 && !isEditing) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
        <div className="p-6 bg-slate-900/50 rounded-full border border-slate-800 mb-6 shadow-2xl">
          <LayoutTemplate className="w-12 h-12 text-slate-500"/>
        </div>
        <h2 className="text-2xl font-black text-white uppercase mb-2">{displayName}</h2>
        <p className="text-slate-400">A tananyag feltöltése jelenleg folyamatban van.</p>

        {isInstructor && (
          <Button onClick={() => setIsEditing(true)} className="mt-8 bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-wider h-12 px-6 shadow-lg shadow-sky-900/20">
            <Edit className="w-4 h-4 mr-2"/> Szerkesztés Megkezdése
          </Button>
        )}
      </div>
    );
  }

  const currentMaterial = materials[currentPageIndex];
  const isCurrentCompleted = currentMaterial ? completedMaterialIds.includes(currentMaterial.id) : false;
  const isPageLockedByProgression = !isInstructor && !isEditing && courseConfig?.linear_progression && currentPageIndex > 0 && !completedMaterialIds.includes(materials[currentPageIndex - 1].id);

  return (
    <div className="h-full flex flex-col relative bg-[#050a14]">

      {/* HEADER */}
      <div className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between z-20 shrink-0">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">{displayName}</h2>
          {courseConfig?.linear_progression && <span className="text-[10px] uppercase font-bold text-sky-500 tracking-wider">Lineáris Haladás Aktív</span>}
        </div>

        {isInstructor && (
          <div className="flex gap-2">
            <Button variant={isEditing ? "default" : "outline"} onClick={() => setIsEditing(!isEditing)}
                    className={cn("h-10 font-bold uppercase text-xs tracking-wider transition-all", isEditing ? "bg-yellow-600 hover:bg-yellow-500 text-black shadow-lg shadow-yellow-900/20" : "border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800")}>
              {isEditing ? <><Save className="w-4 h-4 mr-2"/> Szerkesztés Kész</> : <><Edit className="w-4 h-4 mr-2"/> Szerkesztés Mód</>}
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* BAL OLDAL - TARTALOMJEGYZÉK */}
        <div className="w-64 border-r border-slate-800 bg-slate-950/40 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tartalomjegyzék</h3>
            {isEditing && (
              <Button size="icon" variant="ghost" onClick={addNewPage} className="h-7 w-7 text-green-500 hover:bg-green-950/30 border border-green-900/30">
                <Plus className="w-4 h-4"/>
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {materials.map((m, idx) => {
              const isLocked = !isInstructor && !isEditing && courseConfig?.linear_progression && idx > 0 && !completedMaterialIds.includes(materials[idx - 1].id);
              const isDone = completedMaterialIds.includes(m.id);
              const isActive = currentPageIndex === idx;

              return (
                <button
                  key={m.id}
                  disabled={isLocked && !isEditing}
                  onClick={() => setCurrentPageIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all relative overflow-hidden group border",
                    isActive ? "bg-sky-900/20 border-sky-900/50 shadow-md" : "bg-slate-900/20 hover:bg-slate-900/60 border-transparent hover:border-slate-800",
                    isLocked && !isEditing ? "opacity-40 cursor-not-allowed grayscale" : "cursor-pointer"
                  )}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500"/>}

                  <div className="shrink-0">
                    {isLocked && !isEditing ? <Lock className="w-4 h-4 text-slate-500"/> :
                      isDone ? <CheckCircle2 className="w-4 h-4 text-green-500"/> :
                        <div className="w-4 h-4 rounded-full border-2 border-slate-600"/>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-bold truncate", isActive ? "text-sky-400" : "text-slate-300")}>{m.title}</div>
                    <div className="text-[9px] text-slate-500 uppercase">{idx + 1}. Oldal</div>
                  </div>

                  {isEditing && (
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deletePage(m.id); }}
                            className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-950/30 border border-red-900/30 shrink-0 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </Button>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* JOBB OLDAL - TARTALOM VAGY BEÁLLÍTÁSOK */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 relative">

          {/* BEÁLLÍTÁSOK PANEL (Csak Szerkesztés módban) */}
          {isEditing && (
            <Card className="bg-[#0b1221] border-slate-800 mb-8 shadow-2xl">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Settings className="w-5 h-5 text-yellow-500"/>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Kurzus Beállítások</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <SettingToggle
                    title="Nyilvános"
                    description="A tananyag elérhető a jogosultaknak"
                    active={courseConfig?.is_open}
                    onChange={(v: boolean) => setCourseConfig({ ...courseConfig, is_open: v })}
                    icon={Globe}
                    activeColorClass="border-green-500/50 text-green-200"
                  />
                  <SettingToggle
                    title="Lineáris Haladás"
                    description="A tanulóknak sorrendben kell haladniuk"
                    active={courseConfig?.linear_progression}
                    onChange={(v: boolean) => setCourseConfig({ ...courseConfig, linear_progression: v })}
                    icon={ArrowRight}
                    activeColorClass="border-blue-500/50 text-blue-200"
                  />

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Minimum Rang</Label>
                    <Select value={courseConfig?.required_rank || "none"} onValueChange={(v) => setCourseConfig({ ...courseConfig, required_rank: v === "none" ? null : v })}>
                      <SelectTrigger className="bg-[#0f172a] border-slate-800 focus-visible:ring-yellow-500/30 focus-visible:border-yellow-500/50 font-mono text-sm text-white h-[72px] rounded-lg">
                        <SelectValue placeholder="Nincs megkötés"/>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="none">Nincs megkötés</SelectItem>
                        {FACTION_RANKS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                  <Button onClick={handleSaveConfig} className="bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider h-10 px-6 shadow-lg shadow-green-900/20">
                    <Save className="w-4 h-4 mr-2"/> Beállítások Mentése
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AKTÁLIS OLDAL TARTALMA */}
          {currentMaterial && !isPageLockedByProgression ? (
            <div className="max-w-5xl mx-auto animate-in fade-in duration-500">

              {isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0b1221] p-6 rounded-xl border border-slate-800 shadow-xl">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Oldal Címe</Label>
                      <Input
                        value={currentMaterial.title}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[currentPageIndex].title = e.target.value;
                          setMaterials(newMats);
                        }}
                        onBlur={async () => {
                          await supabase.from('academy_division_materials').update({ title: currentMaterial.title }).eq('id', currentMaterial.id);
                        }}
                        className="bg-[#0f172a] border-slate-800 focus-visible:ring-yellow-500/30 focus-visible:border-yellow-500/50 font-mono text-white h-12 text-lg font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Téma (Kinézet)</Label>
                      <Select
                        value={currentMaterial.theme || 'default'}
                        onValueChange={async (v) => {
                          const newMats = [...materials];
                          newMats[currentPageIndex].theme = v;
                          setMaterials(newMats);
                          await supabase.from('academy_division_materials').update({ theme: v }).eq('id', currentMaterial.id);
                        }}
                      >
                        <SelectTrigger className="bg-[#0f172a] border-slate-800 focus-visible:ring-yellow-500/30 focus-visible:border-yellow-500/50 font-mono text-sm text-white h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="default">Alapértelmezett (Sötét)</SelectItem>
                          <SelectItem value="paper">Papír (Világos, Serif)</SelectItem>
                          <SelectItem value="terminal">Terminál (Zöld-fekete)</SelectItem>
                          <SelectItem value="amber">Amber (Borostyán-fekete)</SelectItem>
                          <SelectItem value="blue">Kék (Adatbázis/Modern)</SelectItem>
                          <SelectItem value="classic">Klasszikus (Fehér, Keretes)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="min-h-[600px] rounded-xl overflow-hidden shadow-2xl">
                    <AcademyEditor
                      pageId={currentMaterial.id}
                      initialContent={currentMaterial.content}
                      readOnly={false}
                      theme={currentMaterial.theme || 'default'}
                      onSave={async (content) => {
                        const newMats = [...materials];
                        newMats[currentPageIndex].content = content;
                        setMaterials(newMats);
                        await supabase.from('academy_division_materials').update({ content }).eq('id', currentMaterial.id);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-8 pb-20">
                  <h1 className="text-4xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 mb-8">
                    {currentMaterial.title}
                  </h1>

                  <div className="min-h-[400px]">
                    <AcademyEditor
                      pageId={currentMaterial.id}
                      initialContent={currentMaterial.content}
                      readOnly={true}
                      theme={currentMaterial.theme || 'default'}
                      onSave={async () => {}} // Nem hívódik meg readonly módban
                    />
                  </div>

                  {/* PROGRESSZIÓ GOMB */}
                  <div className="pt-8 border-t border-slate-800 mt-12 flex justify-between items-center">
                    <div>
                      {isCurrentCompleted ? (
                        <div className="flex items-center gap-2 text-green-500 font-bold uppercase text-xs tracking-wider bg-green-500/10 px-4 py-3 rounded-lg border border-green-500/20">
                          <CheckCircle2 className="w-5 h-5"/> Ezt a részt már teljesítetted
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleCompletePage(currentMaterial.id)}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase tracking-wider h-12 px-8 shadow-lg shadow-sky-900/20"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2"/> Elolvastam és megértettem
                        </Button>
                      )}
                    </div>

                    {/* Következő oldal gomb */}
                    {isCurrentCompleted && currentPageIndex < materials.length - 1 && (
                      <Button onClick={() => setCurrentPageIndex(p => p + 1)} variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 h-12 px-6 font-bold uppercase tracking-wider text-xs">
                        Következő Fejezet <ArrowRight className="w-4 h-4 ml-2"/>
                      </Button>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-60">
              <div className="p-6 bg-slate-900/50 rounded-full border border-slate-800 mb-6 shadow-2xl">
                <Lock className="w-16 h-16 text-slate-500"/>
              </div>
              <p className="font-mono uppercase tracking-widest text-slate-400 text-center max-w-md font-bold text-sm">
                A lineáris haladás aktív. Először teljesítsd az előző fejezeteket a hozzáféréshez!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}