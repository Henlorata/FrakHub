import {useState, useEffect, useMemo} from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";
import {
  Loader2, Lock, ChevronLeft, ChevronRight, BookOpen, AlertCircle,
  Palette, Trash2, Maximize2, Minimize2
} from "lucide-react";
import {AcademyEditor} from "../components/AcademyEditor";
import {InstructorPanel} from "../components/InstructorPanel";
import {cn, isHighCommand} from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {toast} from "sonner";
import type {AcademyCycle, AcademyMaterial} from "@/types/academy";

interface BasicAcademyViewProps {
  isInstructor: boolean;
}

// Segéd: Public ID kinyerése URL-ből
const getPublicIdFromUrl = (url: string) => {
  try {
    if (!url.includes('/upload/')) return null;
    const splitUrl = url.split('/upload/');
    let path = splitUrl[1];
    path = path.replace(/^v\d+\//, '');
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex !== -1) path = path.substring(0, lastDotIndex);
    return path;
  } catch (e) {
    return null;
  }
};

// Helper a képek kinyerésére
const extractImageUrls = (content: any): string[] => {
  if (!Array.isArray(content)) return [];
  const urls: string[] = [];
  const traverse = (blocks: any[]) => {
    blocks.forEach(block => {
      if (block.type === 'image' && block.props?.url) {
        urls.push(block.props.url);
      }
      if (block.children) traverse(block.children);
    });
  };
  traverse(content);
  return urls;
};

export function BasicAcademyView({isInstructor}: BasicAcademyViewProps) {
  const {supabase, profile} = useAuth();

  const [activeCycle, setActiveCycle] = useState<AcademyCycle | null>(null);
  const [materials, setMaterials] = useState<AcademyMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState(1);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<AcademyMaterial | null>(null);
  const [isWideMode, setIsWideMode] = useState(false);

  // Új oldal ID-jának tárolása (ha épp újat hozunk létre)
  const [newPageId, setNewPageId] = useState<string | null>(null);

  const canEditContent = useMemo(() => {
    if (!profile) return false;
    if (profile.faction_rank === 'Deputy Sheriff Trainee') return false;
    if (profile.is_bureau_manager) return true;
    return isHighCommand(profile);
  }, [profile]);

  const isTrainee = useMemo(() => {
    if (!profile) return true;
    return profile.faction_rank === 'Deputy Sheriff Trainee';
  }, [profile]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const {data: cycles} = await supabase.from('academy_cycles').select('*').eq('status', 'active').maybeSingle();
    if (cycles) setActiveCycle(cycles);

    const {data: mats} = await supabase.from('academy_materials').select('*').eq('category', 'basic').order('page_order', {ascending: true});
    if (mats) setMaterials(mats);
    setLoading(false);
  };

  const dayMaterials = materials.filter(m => m.day_number === selectedDay);
  const currentMaterial = dayMaterials[currentPageIndex];

  // Editor megnyitása új oldalhoz
  const handleOpenNewPageEditor = () => {
    setEditingMaterial(null);
    // Generálunk egy ID-t előre, hogy a képfeltöltés mappája már létezzen
    setNewPageId(crypto.randomUUID());
    setIsEditorOpen(true);
  };

  const isDayLocked = (day: number) => {
    if (!isTrainee) return false;
    if (!activeCycle) return true;

    const start = new Date(activeCycle.start_date);
    const today = new Date();

    const unlockDate = new Date(start);
    unlockDate.setDate(start.getDate() + (day - 1));
    unlockDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return today < unlockDate;
  };

  const handleSaveMaterial = async (content: any) => {
    if (editingMaterial) {
      // Meglévő szerkesztése
      await supabase.from('academy_materials').update({
        content,
        updated_at: new Date().toISOString()
      }).eq('id', editingMaterial.id);
    } else {
      // Új oldal létrehozása (a generált ID-t használjuk)
      const nextPageOrder = materials.filter(m => m.day_number === selectedDay).length + 1;
      await supabase.from('academy_materials').insert({
        id: newPageId, // Itt használjuk fel az előre generált ID-t
        title: `Nap ${selectedDay} - Oldal ${nextPageOrder}`,
        day_number: selectedDay,
        page_order: nextPageOrder,
        category: 'basic',
        content
      });
    }
    await fetchData();
    setIsEditorOpen(false);
    setEditingMaterial(null);
    setNewPageId(null);
  };

  const handleDeletePage = async () => {
    if (!currentMaterial) return;

    const toastId = toast.loading("Oldal törlése...");

    try {
      // 1. Képek kinyerése és törlése
      const imagesToDelete = extractImageUrls(currentMaterial.content);

      if (imagesToDelete.length > 0) {
        imagesToDelete.forEach(async (url) => {
          const publicId = getPublicIdFromUrl(url);
          if (publicId) {
            await fetch('/api/delete-image', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({publicId}) // Legacy törlés
            }).catch(console.error);
          }
        });
      }

      // 2. Adatbázis törlés
      await supabase.from('academy_materials').delete().eq('id', currentMaterial.id);

      // 3. Újraszámozás és címfrissítés
      const {data: remaining} = await supabase
        .from('academy_materials')
        .select('id')
        .eq('category', 'basic')
        .eq('day_number', selectedDay)
        .neq('id', currentMaterial.id)
        .order('page_order', {ascending: true});

      if (remaining && remaining.length > 0) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase.from('academy_materials')
            .update({
              page_order: i + 1,
              title: `Nap ${selectedDay} - Oldal ${i + 1}`
            })
            .eq('id', remaining[i].id);
        }
      }

      toast.success("Oldal törölve.", {id: toastId});
      await fetchData();
      setCurrentPageIndex(p => Math.max(0, p - 1));

    } catch (error) {
      console.error(error);
      toast.error("Hiba történt.", {id: toastId});
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    if (!currentMaterial) return;
    const updatedMaterials = materials.map(m => m.id === currentMaterial.id ? {...m, theme: newTheme} : m);
    setMaterials(updatedMaterials);
    await supabase.from('academy_materials').update({theme: newTheme}).eq('id', currentMaterial.id);
    toast.success("Téma módosítva");
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2
    className="animate-spin text-sky-500 w-8 h-8"/></div>;

  return (
    <div className="h-full flex flex-col">
      {/* TOP BAR */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5].map(day => {
            const locked = isDayLocked(day);
            return (
              <button
                key={day}
                onClick={() => {
                  if (!locked) {
                    setSelectedDay(day);
                    setCurrentPageIndex(0);
                    setIsEditorOpen(false);
                  }
                }}
                disabled={locked}
                className={cn(
                  "relative px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border",
                  selectedDay === day
                    ? "bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900/20"
                    : locked
                      ? "bg-transparent border-transparent text-slate-600 cursor-not-allowed"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600"
                )}
              >
                            <span className="flex items-center gap-2">
                                {day}. Nap
                              {locked && <Lock className="w-3 h-3"/>}
                            </span>
              </button>
            )
          })}
        </div>

        {activeCycle ? (
          <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                        CIKLUS: <span className="text-white">{activeCycle.start_date}</span>
                    </span>
            <Badge variant="outline"
                   className="border-green-500 text-green-500 bg-green-500/10 text-[10px]">LIVE</Badge>
          </div>
        ) : (
          <Badge variant="outline" className="border-slate-700 text-slate-500 bg-slate-800 text-[10px]">INAKTÍV</Badge>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Tabs defaultValue="content" className="h-full flex flex-col">
          {isInstructor && (
            <div className="absolute top-4 right-6 z-50">
              <TabsList className="bg-slate-900 border border-slate-800 shadow-xl">
                <TabsTrigger value="content" className="text-xs">Tananyag</TabsTrigger>
                <TabsTrigger value="manage" className="text-xs">Napló & Kezelés</TabsTrigger>
              </TabsList>
            </div>
          )}

          <TabsContent value="content" className="h-full m-0 p-0">
            <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8 lg:p-12 scroll-smooth">
              <div
                className={cn("mx-auto min-h-full flex flex-col transition-all duration-300", isWideMode ? "max-w-full" : "max-w-4xl")}>

                {isDayLocked(selectedDay) ? (
                  <div
                    className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                    <div
                      className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-slate-800">
                      <Lock className="w-8 h-8 text-slate-600"/>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tananyag Zárolva</h2>
                    <p className="text-slate-400 max-w-md">
                      Ez a nap még nem elérhető a jelenlegi akadémiai ciklusban.
                    </p>
                  </div>
                ) : isEditorOpen ? (
                  <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-sky-500"/>
                        {editingMaterial ? "Tananyag Szerkesztése" : "Új Oldal Létrehozása"}
                      </h2>
                      <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>Mégse</Button>
                    </div>
                    <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                      <AcademyEditor
                        initialContent={editingMaterial?.content}
                        onSave={handleSaveMaterial}
                        theme={editingMaterial?.theme || 'default'}
                        // HA szerkesztünk: a meglevő ID. HA új: a generált ID.
                        pageId={editingMaterial?.id || newPageId || ""}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {(!currentMaterial && dayMaterials.length === 0) ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <AlertCircle className="w-12 h-12 mb-4 opacity-20"/>
                        <p>Nincs feltöltött tananyag erre a napra.</p>
                        {canEditContent && (
                          <Button onClick={handleOpenNewPageEditor} className="mt-4 bg-sky-600 text-white">
                            Tartalom létrehozása
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/50 pt-2">
                          <div>
                            <Badge className="mb-2 bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20">
                              {selectedDay}. NAP / {currentPageIndex + 1}. OLDAL
                            </Badge>
                            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight line-clamp-1">
                              {currentMaterial?.title || "Cím nélküli fejezet"}
                            </h1>
                          </div>
                          <div className="flex gap-2 items-center">

                            <Button variant="ghost" size="icon" onClick={() => setIsWideMode(!isWideMode)}
                                    className="text-slate-400 hover:text-white mr-2">
                              {isWideMode ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
                            </Button>

                            {canEditContent && currentMaterial && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm"
                                          className="border-slate-800 h-9 gap-2 bg-slate-900/50 mr-2 hidden sm:flex">
                                    <Palette className="w-4 h-4"/>
                                    <span className="hidden lg:inline">Kinézet</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white w-56">
                                  <DropdownMenuItem
                                    onClick={() => handleThemeChange('default')}>Alapértelmezett</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleThemeChange('paper')}>Papír</DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleThemeChange('classic')}>Hivatalos</DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleThemeChange('terminal')}>Terminál</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleThemeChange('blue')}>Rendőrségi
                                    (Kék)</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                              <Button variant="ghost" size="icon"
                                      onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                                      disabled={currentPageIndex === 0} className="h-7 w-7">
                                <ChevronLeft className="w-4 h-4"/>
                              </Button>
                              <Button variant="ghost" size="icon"
                                      onClick={() => setCurrentPageIndex(p => Math.min(dayMaterials.length - 1, p + 1))}
                                      disabled={currentPageIndex >= dayMaterials.length - 1} className="h-7 w-7">
                                <ChevronRight className="w-4 h-4"/>
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex-1 rounded-2xl overflow-hidden shadow-2xl relative group min-h-[600px] border border-slate-800">
                          {canEditContent && (
                            <div className="absolute top-0 right-0 p-4 opacity-100 z-20 flex gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm"
                                          className="h-9 w-9 p-0 bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 hover:border-red-500 transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 className="w-4 h-4"/>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-red-950 border-red-900 text-white">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Biztosan törlöd ezt az oldalt?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-red-200">
                                      Ez a művelet nem vonható vissza. Az oldal tartalma végleg elvész.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel
                                      className="bg-transparent border-red-900 text-white hover:bg-red-900/50">Mégse</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeletePage}
                                                       className="bg-red-600 hover:bg-red-700 text-white">Törlés</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              <Button
                                className="bg-sky-600 hover:bg-sky-500 text-white shadow-lg h-9 px-4 text-xs uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditingMaterial(currentMaterial);
                                  setIsEditorOpen(true);
                                }}>
                                Szerkesztés
                              </Button>
                            </div>
                          )}

                          <AcademyEditor
                            initialContent={currentMaterial?.content}
                            onSave={async () => {
                            }}
                            readOnly={true}
                            theme={currentMaterial?.theme || 'default'}
                            pageId={currentMaterial?.id}
                          />
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-4 pb-12">
                          <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                                    disabled={currentPageIndex === 0}
                                    className="w-32 justify-between border-slate-700 bg-slate-900 hover:bg-slate-800 hover:text-white h-10">
                              <ChevronLeft className="w-4 h-4"/> Előző
                            </Button>
                            <div className="text-xs font-mono text-slate-500 flex items-center">
                              {currentPageIndex + 1} / {dayMaterials.length}
                            </div>
                            <Button variant="outline"
                                    onClick={() => setCurrentPageIndex(p => Math.min(dayMaterials.length - 1, p + 1))}
                                    disabled={currentPageIndex >= dayMaterials.length - 1}
                                    className="w-32 justify-between border-slate-700 bg-slate-900 hover:bg-slate-800 hover:text-white h-10">
                              Következő <ChevronRight className="w-4 h-4"/>
                            </Button>
                          </div>

                          {canEditContent && (
                            <Button variant="ghost"
                                    className="text-slate-500 hover:text-white text-xs border border-dashed border-slate-800 hover:border-slate-500 p-2 h-auto"
                                    onClick={handleOpenNewPageEditor}>
                              + Új oldal beszúrása a nap végére
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manage" className="h-full m-0 p-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              <InstructorPanel activeCycle={activeCycle} onRefresh={fetchData}/>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}