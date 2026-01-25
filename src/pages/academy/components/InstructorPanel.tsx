import {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {Checkbox} from "@/components/ui/checkbox";
import {Textarea} from "@/components/ui/textarea";
import {CalendarDays, Plus, UserPlus, Save, History} from "lucide-react";
import {toast} from "sonner";
import type {AcademyCycle, AcademyStudent} from "@/types/academy";

interface InstructorPanelProps {
  activeCycle: AcademyCycle | null;
  onRefresh: () => void;
}

export function InstructorPanel({activeCycle: initialActiveCycle, onRefresh}: InstructorPanelProps) {
  const {supabase} = useAuth();

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initialActiveCycle?.id || null);
  const [allCycles, setAllCycles] = useState<AcademyCycle[]>([]);

  const [students, setStudents] = useState<AcademyStudent[]>([]);
  const [logUpdates, setLogUpdates] = useState<Record<string, { present: boolean, note: string }>>({});

  const [isNewCycleOpen, setIsNewCycleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("");

  const [selectedDay, setSelectedDay] = useState(1);

  // Ciklusok betöltése
  useEffect(() => {
    const fetchCycles = async () => {
      const {data} = await supabase.from('academy_cycles')
        .select('*')
        .order('start_date', {ascending: false});
      if (data) {
        setAllCycles(data);
        if (!selectedCycleId && initialActiveCycle) setSelectedCycleId(initialActiveCycle.id);
        else if (!selectedCycleId && data.length > 0) setSelectedCycleId(data[0].id);
      }
    };
    fetchCycles();
  }, [initialActiveCycle]);

  // Adatok frissítése, ha a választott ciklus vagy nap változik
  useEffect(() => {
    if (selectedCycleId) {
      fetchStudentsAndLogs();
    }
  }, [selectedCycleId, selectedDay]);

  const currentViewCycle = allCycles.find(c => c.id === selectedCycleId) || initialActiveCycle;
  const isViewingActive = currentViewCycle?.status === 'active';

  const fetchStudentsAndLogs = async () => {
    if (!selectedCycleId) return;

    // 1. Tanulók lekérése
    const {data: relData, error: relError} = await supabase
      .from('academy_students')
      .select('*')
      .eq('cycle_id', selectedCycleId);

    if (relError || !relData) return;

    // 2. Profilok lekérése
    const userIds = relData.map(r => r.user_id);
    if (userIds.length > 0) {
      const {data: profiles} = await supabase
        .from('profiles')
        .select('id, full_name, badge_number, faction_rank')
        .in('id', userIds);

      const combinedData = relData.map(rel => {
        const profile = profiles?.find(p => p.id === rel.user_id);
        return {...rel, profile};
      });
      setStudents(combinedData);
    } else {
      setStudents([]);
    }

    // 3. Naplók lekérése
    const {data: logData} = await supabase.from('academy_logs')
      .select('*')
      .eq('cycle_id', selectedCycleId)
      .eq('day_number', selectedDay);

    const updates: any = {};
    if (logData) {
      logData.forEach((log: any) => {
        updates[log.student_id] = {present: log.is_present, note: log.note || ""};
      });
    }
    setLogUpdates(updates);
  };

  const handleStartCycle = async () => {
    if (!newDate) return;
    const active = allCycles.find(c => c.status === 'active');
    if (active) {
      await supabase.from('academy_cycles').update({status: 'archived'}).eq('id', active.id);
    }
    const {error} = await supabase.from('academy_cycles').insert({
      start_date: newDate,
      status: 'active'
    });
    if (error) toast.error("Hiba az indításkor.");
    else {
      toast.success("Új akadémia elindítva!");
      setIsNewCycleOpen(false);
      onRefresh();
    }
  };

  const loadAvailableUsers = async () => {
    const {data} = await supabase.from('profiles').select('id, full_name, faction_rank')
      .or('faction_rank.ilike.%Cadet%,faction_rank.ilike.%Trainee%')
      .order('full_name');
    if (data) setAvailableUsers(data);
  };

  const handleAddStudent = async () => {
    if (!selectedUser || !selectedCycleId) return;
    const {error} = await supabase.from('academy_students').insert({
      cycle_id: selectedCycleId,
      user_id: selectedUser
    });
    if (error) toast.error("Hiba: " + error.message);
    else {
      toast.success("Tanuló hozzáadva.");
      fetchStudentsAndLogs();
      setIsAddStudentOpen(false);
    }
  };

  const handleSaveLogs = async () => {
    if (!selectedCycleId) return;

    const upserts = students.map(student => ({
      cycle_id: selectedCycleId,
      student_id: student.user_id,
      day_number: selectedDay,
      is_present: logUpdates[student.user_id]?.present || false,
      note: logUpdates[student.user_id]?.note || ""
    }));

    if (upserts.length === 0) return;

    const {error} = await supabase.from('academy_logs')
      .upsert(upserts, {onConflict: 'cycle_id, student_id, day_number'});

    if (error) toast.error("Hiba a mentéskor: " + error.message);
    else toast.success("Napló mentve erre a napra.");
  };

  // Csak azok a tanulók látszódjanak, akik NEM Deputy Sheriff II+ rangúak
  // Bár az SQL trigger törli őket, itt is szűrhetünk UI szinten a biztonság kedvéért,
  // vagy ha az archivált ciklusban még meg akarjuk tartani a logot a megtekintés erejéig (az SQL trigger azonnal töröl!)
  // Ha az SQL trigger töröl, akkor itt már nem kell szűrni, mert nem lesznek a DB-ben.
  // Tehát itt hagyjuk a listát úgy, ahogy az adatbázis visszaadja.

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/50 p-4 rounded-lg border border-slate-800 gap-4">

        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-sky-500"/>
            <h2 className="text-lg font-bold text-white">Akadémia Kezelő</h2>
          </div>

          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500"/>
            <Select value={selectedCycleId || ""} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[280px] bg-slate-950 border-slate-700 h-8 text-xs text-white">
                <SelectValue placeholder="Válassz ciklust..."/>
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                {allCycles.map(cycle => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.start_date} {cycle.status === 'active' && '(AKTÍV)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Button variant="outline" onClick={() => setIsNewCycleOpen(true)}>
            <Plus className="w-4 h-4 mr-2"/> Új Ciklus
          </Button>
          {isViewingActive && (
            <Button variant="secondary" onClick={() => {
              loadAvailableUsers();
              setIsAddStudentOpen(true);
            }}>
              <UserPlus className="w-4 h-4 mr-2"/> Tanuló Hozzáadása
            </Button>
          )}
        </div>
      </div>

      {currentViewCycle && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
            <Label className="text-white text-lg font-bold">Napló / Értékelés:</Label>
            <div className="flex bg-slate-900 rounded-md p-1 border border-slate-800">
              {[1, 2, 3, 4, 5].map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded text-sm font-bold transition-all ${selectedDay === day ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                >
                  {day}. Nap
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <Button onClick={handleSaveLogs} className="bg-green-600 hover:bg-green-500 text-white">
                <Save className="w-4 h-4 mr-2"/> Mentés ({selectedDay}. Nap)
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-900">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-300 font-bold w-[250px]">Tanuló</TableHead>
                  <TableHead className="text-slate-300 font-bold text-center w-[100px]">Jelenlét</TableHead>
                  <TableHead className="text-slate-300 font-bold">Megjegyzés (Oktatói)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Nincsenek rögzített
                    tanulók ebben a ciklusban.</TableCell></TableRow>
                ) : students.map(student => (
                  <TableRow key={student.user_id} className="border-slate-800 bg-slate-950/50 hover:bg-slate-900/50">
                    <TableCell className="font-medium text-white align-top pt-4">
                      <div className="truncate max-w-[230px]" title={student.profile?.full_name}>
                        {student.profile?.full_name || "Ismeretlen"}
                      </div>
                      <span
                        className="text-xs text-slate-500 font-mono block">{student.profile?.badge_number || "N/A"}</span>
                      <span
                        className="text-[10px] text-slate-600 uppercase block mt-1">{student.profile?.faction_rank}</span>
                    </TableCell>
                    <TableCell className="text-center bg-slate-900/30 align-top pt-4">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={logUpdates[student.user_id]?.present || false}
                          onCheckedChange={(checked) => {
                            setLogUpdates(prev => ({
                              ...prev,
                              [student.user_id]: {...(prev[student.user_id] || {}), present: !!checked}
                            }));
                          }}
                          className="border-slate-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 w-6 h-6"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Textarea
                        placeholder="Írj megjegyzést..."
                        className="bg-slate-900 border-slate-700 min-h-[80px] focus:min-h-[120px] transition-all resize-none text-xs w-full"
                        value={logUpdates[student.user_id]?.note || ""}
                        onChange={(e) => {
                          setLogUpdates(prev => ({
                            ...prev,
                            [student.user_id]: {...(prev[student.user_id] || {}), note: e.target.value}
                          }));
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={isNewCycleOpen} onOpenChange={setIsNewCycleOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white">
          <DialogHeader><DialogTitle>Új Akadémia Indítása</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Kezdő Dátum (1. Nap)</Label>
              <Input type="date" className="bg-slate-900 border-slate-700 text-white"
                     onChange={(e) => setNewDate(e.target.value)}/>
              <p className="text-xs text-slate-500">Az akadémia 5 napig tart ettől a naptól kezdve.</p>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs mt-2">
                Figyelem: Ez archiválja a jelenlegi aktív ciklust!
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsNewCycleOpen(false)}>Mégse</Button>
            <Button onClick={handleStartCycle} className="bg-sky-600 text-white">Indítás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white">
          <DialogHeader><DialogTitle>Tanuló Hozzáadása</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Válassz Kadétot</Label>
              <Select onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Válassz embert..."/>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                  {availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.faction_rank})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddStudent} className="bg-sky-600 text-white">Hozzáadás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}