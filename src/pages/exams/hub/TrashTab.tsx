import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {Eye, RotateCcw, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {formatDateTime} from "@/lib/exams";
import {errorMessage} from "@/lib/utils";
import type {ExamSubmissionView} from "@/types/exams";

const COLUMNS = "id, exam_title, user_full_name, applicant_name, start_time, deleted_at";

interface TrashTabProps {
  canPurge: boolean;
  /** Changes when a sheet was moved to the trash elsewhere. */
  reloadKey: number;
  onRestored: () => void;
}

/** Sheets moved to the trash (wrong or test attempts): restorable; executives can delete them for good. */
export function TrashTab({canPurge, reloadKey, onRestored}: TrashTabProps) {
  const {supabase} = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ExamSubmissionView[] | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<ExamSubmissionView | null>(null);

  const load = useCallback(async () => {
    const {data, error} = await supabase.from("exam_submissions_view").select(COLUMNS)
      .not("deleted_at", "is", null).order("deleted_at", {ascending: false}).limit(100);
    if (error) {
      toast.error("A lomtár betöltése nem sikerült.");
      setItems([]);
      return;
    }
    setItems((data ?? []) as unknown as ExamSubmissionView[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const run = async (id: string, rpc: "exam_submission_restore" | "exam_submission_purge", success: string) => {
    setWorkingId(id);
    const {error} = await supabase.rpc(rpc, {_submission_id: id});
    setWorkingId(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setItems((current) => current?.filter((item) => item.id !== id) ?? current);
    toast.success(success);
    if (rpc === "exam_submission_restore") onRestored();
  };

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/5 px-5 py-4">
        <p className="text-sm font-semibold text-white">Törölt vizsgalapok</p>
        <p className="text-xs text-slate-400">A hibás vagy tesztként kitöltött lapok ide kerülnek. A vizsgázó nem látja őket, és bármikor visszaállíthatók.</p>
      </div>
      {items === null ? (
        <div className="space-y-2 p-4">{Array.from({length: 3}, (_, index) => <div key={index} className="skeleton h-12"/>)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Trash2} title="A lomtár üres." compact/>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((item, index) => (
            <li key={item.id} style={{"--i": Math.min(index, 12)} as CSSProperties} className="animate-fade flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.exam_title}</p>
                <p className="text-xs text-slate-500">
                  {item.user_full_name ?? item.applicant_name ?? "Ismeretlen"} · kitöltve: {formatDateTime(item.start_time)} · törölve: {formatDateTime(item.deleted_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/exams/grading/${item.id}`)}><Eye/> Megtekintés</Button>
                <Button size="sm" variant="outline" disabled={workingId === item.id}
                        onClick={() => void run(item.id, "exam_submission_restore", "Vizsgalap visszaállítva.")}>
                  <RotateCcw/> Visszaállítás
                </Button>
                {canPurge && (
                  <Button size="icon" variant="ghost" aria-label="Végleges törlés" title="Végleges törlés" disabled={workingId === item.id}
                          className="text-slate-500 hover:text-red-300" onClick={() => setPurgeTarget(item)}>
                    <Trash2/>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Végleges törlés</AlertDialogTitle>
            <AlertDialogDescription>
              {purgeTarget?.user_full_name ?? purgeTarget?.applicant_name ?? "A kitöltő"} „{purgeTarget?.exam_title}” vizsgalapja minden válasszal
              együtt véglegesen törlődik. Ez nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" onClick={() => {
              const target = purgeTarget;
              setPurgeTarget(null);
              if (target) void run(target.id, "exam_submission_purge", "Vizsgalap véglegesen törölve.");
            }}>
              Végleges törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
