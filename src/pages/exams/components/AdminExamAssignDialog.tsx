import {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import {Search, UserCheck, Loader2, RefreshCw, UserPlus, Link, User} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import type {Profile} from "@/types/supabase";
import {cn} from "@/lib/utils";

interface AdminExamAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminExamAssignDialog({open, onOpenChange}: AdminExamAssignDialogProps) {
  const {supabase} = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [orphanExams, setOrphanExams] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // EREDETI LOGIKA
  const fetchData = async (query = "") => {
    setIsLoading(true);
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // 1. Vizsgák
      let examQuery = supabase.from('exam_submissions').select('id, applicant_name, start_time, status, exams(title)').is('user_id', null);
      if (query) examQuery = examQuery.ilike('applicant_name', `%${query}%`);
      else examQuery = examQuery.gte('start_time', threeDaysAgo.toISOString());

      const {data: exams} = await examQuery.order('start_time', {ascending: false}).limit(20);
      setOrphanExams(exams || []);

      // 2. Trainees
      const {data: existingSubmissions} = await supabase.from('exam_submissions').select('user_id').not('user_id', 'is', null);
      const excludedUserIds = existingSubmissions?.map(s => s.user_id) || [];

      let userQuery = supabase.from('profiles').select('id, full_name, badge_number').eq('faction_rank', 'Deputy Sheriff Trainee');
      if (excludedUserIds.length > 0) userQuery = userQuery.not('id', 'in', `(${excludedUserIds.join(',')})`);
      if (query) userQuery = userQuery.ilike('full_name', `%${query}%`);

      const {data: users} = await userQuery.order('full_name').limit(20);
      setTrainees(users || []);

    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSelectedExamId(null);
      setSelectedUserId(null);
      fetchData();
    }
  }, [open]);

  const handleAssign = async () => {
    if (!selectedExamId || !selectedUserId) return;
    setIsLoading(true);
    try {
      const {error} = await supabase.rpc('admin_assign_exam', {
        _submission_id: selectedExamId,
        _target_user_id: selectedUserId
      });
      if (error) throw error;
      toast.success("Hozzárendelve!");
      await fetchData(searchTerm);
      setSelectedExamId(null);
      setSelectedUserId(null);
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-blue-900/30 text-white sm:max-w-3xl h-[700px] flex flex-col p-0 shadow-2xl">
        <div className="bg-blue-950/20 border-b border-blue-900/30 p-5 flex items-center gap-3">
          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400"><Link
            className="w-5 h-5"/></div>
          <div>
            <DialogTitle className="text-lg font-black uppercase tracking-tight text-white">MANUÁLIS
              PÁROSÍTÁS</DialogTitle>
            <p className="text-[10px] text-blue-400/60 font-mono uppercase tracking-widest">Manual Override Protocol</p>
          </div>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <Input placeholder="Név keresése..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && fetchData(searchTerm)}
                   className="pl-10 bg-slate-900 border-slate-700 font-mono text-xs h-10"/>
          </div>
          <Button variant="outline" onClick={() => fetchData(searchTerm)}
                  className="border-slate-700 bg-slate-900"><RefreshCw
            className={cn("w-4 h-4", isLoading && "animate-spin")}/></Button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-2 gap-px bg-slate-800">
          {/* LEFT: EXAMS */}
          <div className="bg-[#050a14] flex flex-col min-h-0">
            <div
              className="p-2 bg-slate-900/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-800 sticky top-0">Gazdátlan
              Vizsgák
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {orphanExams.map(ex => (
                <div key={ex.id} onClick={() => setSelectedExamId(ex.id)}
                     className={cn("p-3 rounded border cursor-pointer transition-all", selectedExamId === ex.id ? "bg-yellow-900/20 border-yellow-500/50 shadow-[inset_0_0_10px_rgba(234,179,8,0.1)]" : "bg-slate-900/50 border-slate-800 hover:bg-slate-900 hover:border-slate-600")}>
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={cn("font-bold text-sm", selectedExamId === ex.id ? "text-yellow-500" : "text-white")}>{ex.applicant_name}</span>
                    <Badge variant="outline"
                           className="text-[9px] h-4 border-slate-700 text-slate-500">{ex.status}</Badge>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{ex.exams?.title}</div>
                  <div
                    className="text-[9px] text-slate-600 font-mono mt-1 text-right">{new Date(ex.start_time).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: TRAINEES */}
          <div className="bg-[#050a14] flex flex-col min-h-0">
            <div
              className="p-2 bg-slate-900/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-800 sticky top-0">Trainee
              Lista
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {trainees.map(u => (
                <div key={u.id} onClick={() => setSelectedUserId(u.id)}
                     className={cn("p-3 rounded border cursor-pointer transition-all flex items-center justify-between", selectedUserId === u.id ? "bg-green-900/20 border-green-500/50 shadow-[inset_0_0_10px_rgba(34,197,94,0.1)]" : "bg-slate-900/50 border-slate-800 hover:bg-slate-900 hover:border-slate-600")}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-500">
                      <User className="w-4 h-4"/></div>
                    <span
                      className={cn("font-bold text-sm", selectedUserId === u.id ? "text-green-400" : "text-white")}>{u.full_name}</span>
                  </div>
                  <span
                    className="text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded text-slate-400">{u.badge_number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <div
              className={cn("w-2 h-2 rounded-full", selectedExamId && selectedUserId ? "bg-green-500 animate-pulse" : "bg-red-500")}></div>
            {selectedExamId && selectedUserId ? "RENDSZER KÉSZ A PÁROSÍTÁSRA" : "VÁLASSZ MINDKÉT LISTÁBÓL"}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
            <Button onClick={handleAssign} disabled={!selectedExamId || !selectedUserId || isLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : "ÖSSZERENDELÉS"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}