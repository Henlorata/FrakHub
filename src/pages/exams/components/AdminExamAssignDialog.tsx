import {useCallback, useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {toast} from "sonner";
import {ArrowRight, Link2, Loader2, RefreshCw, Search} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {PersonAvatar} from "@/components/fleet/Holders";
import {useAuth} from "@/context/AuthContext";
import {formatDateTime, STATUS_META} from "@/lib/exams";
import {getProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import type {SubmissionStatus} from "@/types/exams";

interface OrphanSubmission {
  id: string;
  applicant_name: string | null;
  start_time: string;
  status: SubmissionStatus;
  exams: {title: string} | null;
}

const TRAINEE_RANK = "Deputy Sheriff Trainee";

interface AdminExamAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Attaches a guest sheet (recruitment exam without a claim code) to a trainee's profile. The
 * server also attaches the same person's other guest sheets of the last month.
 */
export function AdminExamAssignDialog({open, onOpenChange}: AdminExamAssignDialogProps) {
  const {supabase} = useAuth();
  const [term, setTerm] = useState("");
  const [sheets, setSheets] = useState<OrphanSubmission[]>([]);
  const [trainees, setTrainees] = useState<DirectoryProfile[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      // Guest sheets that are handed in (running attempts and failed ones are left out).
      let sheetQuery = supabase.from("exam_submissions").select("id, applicant_name, start_time, status, exams(title)")
        .is("user_id", null).is("deleted_at", null).in("status", ["pending", "passed"]);
      if (query) sheetQuery = sheetQuery.ilike("applicant_name", `%${query}%`);
      const {data, error} = await sheetQuery.order("start_time", {ascending: false}).limit(50);
      if (error) throw error;
      setSheets((data ?? []) as unknown as OrphanSubmission[]);

      // Trainees without a sheet yet (only their own sheets are checked, not every sheet ever).
      const needle = query.trim().toLowerCase();
      const candidates = (await getProfileDirectory())
        .filter((member) => member.faction_rank === TRAINEE_RANK && member.system_role !== "pending")
        .filter((member) => !needle || member.full_name.toLowerCase().includes(needle));
      let taken = new Set<string>();
      if (candidates.length) {
        const {data: existing, error: takenError} = await supabase.from("exam_submissions").select("user_id")
          .in("user_id", candidates.map((member) => member.id)).is("deleted_at", null);
        if (takenError) throw takenError;
        taken = new Set((existing ?? []).map((row: {user_id: string}) => row.user_id));
      }
      setTrainees(candidates.filter((member) => !taken.has(member.id)).slice(0, 50));
    } catch (error) {
      toast.error("Hiba az adatok lekérésekor: " + errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    setTerm("");
    setSheetId(null);
    setUserId(null);
    void load("");
  }, [open, load]);

  const assign = async () => {
    if (!sheetId || !userId) return;
    setLoading(true);
    const {error} = await supabase.rpc("admin_assign_exam", {_submission_id: sheetId, _target_user_id: userId});
    setLoading(false);
    if (error) {
      toast.error("A párosítás nem sikerült: " + errorMessage(error));
      return;
    }
    toast.success("A vizsgalap a profilhoz került.");
    setSheetId(null);
    setUserId(null);
    void load(term);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(44rem,92dvh)] flex-col gap-0 p-0 sm:max-w-3xl">
        <div className="border-b border-white/5 p-5">
          <DialogTitle className="flex items-center gap-2"><Link2 className="size-4 text-primary"/> Vendéglap párosítása</DialogTitle>
          <DialogDescription className="mt-1">
            Ha egy felvételiző elvesztette a vizsgakódját: válaszd ki a lapját és a profilját. Ugyanannak a névnek az elmúlt havi többi vendéglapja is a profilhoz kerül.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load(term)}
                     placeholder="Név keresése…" className="pl-9"/>
            </div>
            <Button variant="outline" size="icon" aria-label="Keresés" onClick={() => void load(term)}>
              <RefreshCw className={cn(loading && "animate-spin")}/>
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-white/5 md:grid-cols-2 md:divide-x md:divide-y-0">
          <Column title="Vendéglapok" empty="Nincs párosítatlan vendéglap.">
            {sheets.map((sheet, index) => (
              <button key={sheet.id} type="button" onClick={() => setSheetId(sheet.id)} style={{"--i": Math.min(index, 10)} as CSSProperties}
                      className={cn("animate-fade w-full rounded-xl p-3 text-left ring-1 transition-colors",
                        sheetId === sheet.id ? "bg-primary/10 ring-primary/50" : "bg-white/[0.02] ring-white/5 hover:ring-white/15")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">{sheet.applicant_name}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{STATUS_META[sheet.status]?.label}</span>
                </span>
                <span className="block truncate text-xs text-slate-400">{sheet.exams?.title}</span>
                <span className="block text-[11px] text-slate-500">{formatDateTime(sheet.start_time)}</span>
              </button>
            ))}
          </Column>
          <Column title="Trainee-k vizsgalap nélkül" empty="Nincs találat a trainee-k között.">
            {trainees.map((member, index) => (
              <button key={member.id} type="button" onClick={() => setUserId(member.id)} style={{"--i": Math.min(index, 10)} as CSSProperties}
                      className={cn("animate-fade flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors",
                        userId === member.id ? "bg-emerald-500/10 ring-emerald-400/50" : "bg-white/[0.02] ring-white/5 hover:ring-white/15")}>
                <PersonAvatar person={member} size="md"/>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{member.full_name}</span>
                <span className="shrink-0 text-[11px] text-slate-400">#{member.badge_number}</span>
              </button>
            ))}
          </Column>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-white/5 p-4 sm:justify-between">
          <span className="flex items-center gap-2 text-xs text-slate-400">
            {sheetId && userId ? <>Kész a párosításra <ArrowRight className="size-3"/></> : "Válassz egy lapot és egy profilt."}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Bezárás</Button>
            <Button disabled={!sheetId || !userId || loading} onClick={() => void assign()}>
              {loading ? <Loader2 className="animate-spin"/> : <Link2/>} Párosítás
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Column({title, empty, children}: {title: string; empty: string; children: ReactNode[]}) {
  return (
    <div className="flex min-h-0 flex-col">
      <p className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {children.length ? children : <p className="py-8 text-center text-xs text-slate-500">{empty}</p>}
      </div>
    </div>
  );
}
