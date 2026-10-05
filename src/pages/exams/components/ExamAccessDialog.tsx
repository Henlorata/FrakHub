import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {Ban, Lock, Search, ShieldCheck, UserCheck, X} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {PersonAvatar} from "@/components/fleet/Holders";
import {useAuth} from "@/context/AuthContext";
import {getProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import type {Exam, ExamOverride} from "@/types/exams";

interface ExamAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: Exam | null;
  onUpdate?: () => void;
}

/**
 * Invitations and exclusions of one exam. An invitation is used up when the member starts the
 * exam (a new attempt needs a new invitation); the member is notified when invited.
 */
export function ExamAccessDialog({open, onOpenChange, exam, onUpdate}: ExamAccessDialogProps) {
  const {supabase, user} = useAuth();
  const [term, setTerm] = useState("");
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [overrides, setOverrides] = useState<ExamOverride[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const examId = exam?.id;

  const loadOverrides = useCallback(async () => {
    if (!examId) return;
    const {data, error} = await supabase.from("exam_overrides").select("id, exam_id, user_id, access_type").eq("exam_id", examId);
    if (error) {
      toast.error("A hozzáférések betöltése nem sikerült.");
      setOverrides([]);
      return;
    }
    setOverrides((data ?? []) as ExamOverride[]);
  }, [examId, supabase]);

  useEffect(() => {
    if (!open || !examId) return;
    setTerm("");
    void loadOverrides();
    getProfileDirectory().then((list) => setMembers(list.filter((member) => member.system_role !== "pending"))).catch(() => undefined);
  }, [open, examId, loadOverrides]);

  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const ruled = new Set((overrides ?? []).map((override) => override.user_id));
  const needle = term.trim().toLowerCase();
  const candidates = members
    .filter((member) => !ruled.has(member.id) && (!needle || member.full_name.toLowerCase().includes(needle) || member.badge_number.includes(needle)))
    .slice(0, 40);

  const add = async (target: DirectoryProfile, type: "allow" | "deny") => {
    if (!exam) return;
    setBusy(target.id);
    const {error} = await supabase.from("exam_overrides").insert({exam_id: exam.id, user_id: target.id, access_type: type, granted_by: user?.id});
    setBusy(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    toast.success(type === "allow" ? `${target.full_name} meghívást kapott.` : `${target.full_name} kizárva.`);
    void loadOverrides();
    onUpdate?.();
  };

  const remove = async (override: ExamOverride) => {
    setBusy(override.user_id);
    const {error} = await supabase.from("exam_overrides").delete().eq("id", override.id);
    setBusy(null);
    if (error) {
      toast.error("Hiba: " + errorMessage(error));
      return;
    }
    setOverrides((current) => current?.filter((item) => item.id !== override.id) ?? current);
    onUpdate?.();
  };

  if (!exam) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(44rem,92dvh)] flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-white/5 p-5">
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/> Hozzáférések</DialogTitle>
          <DialogDescription className="mt-1 wrap-anywhere">{exam.title}</DialogDescription>
          <p className={cn("mt-3 flex items-start gap-2 rounded-xl p-3 text-xs ring-1",
            exam.is_invitation_only ? "bg-violet-500/10 text-violet-200 ring-violet-400/25" : "bg-white/[0.03] text-slate-300 ring-white/10")}>
            <Lock className="mt-0.5 size-3.5 shrink-0"/>
            {exam.is_invitation_only
              ? "Meghívásos vizsga: csak a meghívottak indíthatják el. A meghívás az indításkor felhasználódik."
              : "A vizsga a beállított rendfokozattól és osztálytól elérhető. Itt kivételesen meghívhatsz vagy kizárhatsz valakit."}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-white/5 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="flex min-h-0 flex-col">
            <div className="p-4 pb-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
                <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név vagy jelvényszám…" className="pl-9"/>
              </div>
            </div>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
              {candidates.map((member, index) => (
                <li key={member.id} style={{"--i": Math.min(index, 10)} as CSSProperties}
                    className="animate-fade flex items-center gap-2 rounded-xl bg-white/[0.02] p-2 ring-1 ring-white/5">
                  <PersonAvatar person={member} size="md"/>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{member.full_name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{member.faction_rank} · #{member.badge_number}</span>
                  </span>
                  <Button size="icon" variant="ghost" title="Meghívás" aria-label={`${member.full_name} meghívása`} disabled={busy === member.id}
                          className="size-8 text-emerald-300 hover:bg-emerald-500/10" onClick={() => void add(member, "allow")}><UserCheck/></Button>
                  <Button size="icon" variant="ghost" title="Kizárás" aria-label={`${member.full_name} kizárása`} disabled={busy === member.id}
                          className="size-8 text-red-300 hover:bg-red-500/10" onClick={() => void add(member, "deny")}><Ban/></Button>
                </li>
              ))}
              {!candidates.length && <li className="py-8 text-center text-xs text-slate-500">Nincs találat.</li>}
            </ul>
          </div>

          <div className="flex min-h-0 flex-col">
            <p className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Szabályok ({overrides?.length ?? 0})</p>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
              {(overrides ?? []).map((override) => {
                const member = byId.get(override.user_id);
                const allow = override.access_type === "allow";
                return (
                  <li key={override.id} className="animate-fade flex items-center gap-2 rounded-xl bg-white/[0.02] p-2 ring-1 ring-white/5">
                    <PersonAvatar person={member} size="md"/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{member?.full_name ?? "Ismeretlen"}</span>
                      <span className={cn("text-[11px] font-medium", allow ? "text-emerald-300" : "text-red-300")}>{allow ? "Meghívva" : "Kizárva"}</span>
                    </span>
                    <Button size="icon" variant="ghost" aria-label="Szabály törlése" title="Szabály törlése" disabled={busy === override.user_id}
                            className="size-8 text-slate-400 hover:text-white" onClick={() => void remove(override)}><X/></Button>
                  </li>
                );
              })}
              {overrides !== null && !overrides.length && <li className="py-8 text-center text-xs text-slate-500">Nincs meghívás vagy kizárás.</li>}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
