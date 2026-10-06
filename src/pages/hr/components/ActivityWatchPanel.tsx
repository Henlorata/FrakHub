import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import {BellRing, Check, ChevronDown, EyeOff, HeartPulse, Info, Loader2, Send} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {MemberAvatar} from "@/components/MemberAvatar";
import {progressionApi, type ActivityWatch, type WatchMember} from "@/lib/progression";
import {formatDuty, monthLabel} from "@/lib/registry";
import {canManageMemberDetails, cn, errorMessage} from "@/lib/utils";
import {formatDate} from "@/lib/datetime";
import type {Profile} from "@/types/supabase";
import type {HrMember} from "../useHrData";

/**
 * Members whose recorded duty time (the game's counter, entered by the staff) stayed under the
 * monthly minimum. Logging in to the site or writing reports is never counted: many members do
 * neither. Approved leave excuses a month; trainees, new members and those already marked
 * inactive are left out. Nothing is sent automatically: a superior may send one friendly
 * reminder per month, or mark the case as known.
 */
export function ActivityWatchPanel({viewer, members, onOpenMember}: {viewer: Profile; members: HrMember[]; onOpenMember: (id: string) => void}) {
  const [watch, setWatch] = useState<ActivityWatch | null>(null);
  const [open, setOpen] = useState(true);
  const [reminding, setReminding] = useState<WatchMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setWatch(await progressionApi.activityWatch());
    } catch {
      setWatch(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!watch) return null;
  const [m1, m2] = watch.months;
  const open1 = watch.members.filter((member) => !member.review);
  const reviewed = watch.members.filter((member) => member.review);
  const byId = new Map(members.map((member) => [member.id, member]));

  const dismiss = async (member: WatchMember) => {
    setBusy(member.user_id);
    try {
      await progressionApi.dismiss(member.user_id);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel mb-4 overflow-hidden p-0" data-tour="hr-activity-watch">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/25"><HeartPulse className="size-4"/></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Aktivitásfigyelő</h3>
          <p className="truncate text-xs text-slate-500">
            {!watch.recorded[0] ? `A(z) ${monthLabel(m1)} duty idejét még nem rögzítették.`
              : open1.length ? `${open1.length} tag rögzített ideje maradt ${formatDuty(watch.min_minutes)} alatt (${monthLabel(m1)})`
                : `Mindenki elérte a minimumot (${monthLabel(m1)}), vagy már foglalkoztatok vele.`}
          </p>
        </div>
        {open1.length > 0 && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200 tabular-nums ring-1 ring-rose-500/25">{open1.length}</span>}
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")}/>
      </button>
      {open && (
        <div className="border-t border-white/5">
          <p className="flex items-start gap-2 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-500"/>
            Csak a gyűlésen rögzített havi duty időt nézi (a weboldal használatát és a jelentéseket nem, mert sokaknak nincs rá szükségük).
            A jóváhagyott szabadság menti a hónapot, az újoncok és az új tagok kimaradnak. Automatikusan senki nem kap üzenetet:
            egy felettes havonta egy barátságos emlékeztetőt küldhet.
          </p>
          {watch.members.length > 0 && (
            <ul className="divide-y divide-white/5">
              {[...open1, ...reviewed].map((member) => {
                const hrMember = byId.get(member.user_id);
                const canRemind = !!hrMember && hrMember.id !== viewer.id && canManageMemberDetails(viewer, hrMember);
                const ratio = watch.min_minutes ? Math.min(1, (member.m1_minutes ?? 0) / watch.min_minutes) : 0;
                return (
                  <li key={member.user_id} className={cn("grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center",
                    member.review && "opacity-60")}>
                    <button type="button" onClick={() => onOpenMember(member.user_id)} className="flex min-w-0 items-center gap-2.5 text-left">
                      <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={32}/>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">{member.full_name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{member.faction_rank} · #{member.badge_number}</span>
                      </span>
                      {member.level === 2 && (
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-200 ring-1 ring-amber-500/25"
                              title={`${monthLabel(m2)}: ${member.m2_minutes === null ? "nincs rögzítve" : formatDuty(member.m2_minutes)}`}>
                          2. hónapja
                        </span>
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{monthLabel(m1, "short")}</span>
                        <span className="font-mono text-slate-200 tabular-nums">{member.m1_minutes === null ? "nincs adat" : formatDuty(member.m1_minutes, true)}
                          <span className="text-slate-500"> / {formatDuty(watch.min_minutes, true)}</span></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" style={{width: `${Math.max(3, ratio * 100)}%`}}/>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      {member.review ? (
                        <span className="text-[11px] text-slate-400">
                          {member.review === "reminded" ? <><BellRing className="mr-1 inline size-3"/>Emlékeztető ment</> : <><EyeOff className="mr-1 inline size-3"/>Tudtok róla</>}
                          {member.reviewed_by ? ` · ${member.reviewed_by}` : ""}{member.reviewed_at ? ` · ${formatDate(member.reviewed_at)}` : ""}
                        </span>
                      ) : (
                        <>
                          {canRemind && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReminding(member)}><Send/> Emlékeztető</Button>}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy === member.user_id} onClick={() => void dismiss(member)}
                                  title="Tudunk róla (pl. szólt, hogy most kevesebbet tud jönni)">
                            {busy === member.user_id ? <Loader2 className="animate-spin"/> : <Check/>} Rendben
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <ReminderDialog member={reminding} month={m1} minMinutes={watch.min_minutes} onOpenChange={(value) => !value && setReminding(null)}
                      onDone={() => {
                        setReminding(null);
                        void load();
                      }}/>
    </section>
  );
}

function ReminderDialog({member, month, minMinutes, onOpenChange, onDone}: {
  member: WatchMember | null;
  month: string;
  minMinutes: number;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (member) setNote("");
  }, [member]);
  const send = async () => {
    if (!member) return;
    setSaving(true);
    try {
      await progressionApi.remind(member.user_id, note);
      toast.success("Emlékeztető elküldve.");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült elküldeni."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emlékeztető: {member?.full_name}</DialogTitle>
          <DialogDescription>Egy értesítést kap a weboldalon. Havonta egyszer küldhető.</DialogDescription>
        </DialogHeader>
        <blockquote className="rounded-xl bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300 ring-1 ring-white/10">
          <p className="font-semibold text-white">Hiányzunk egymásnak</p>
          {/* The same text as send_activity_reminder() sends. */}
          {monthLabel(month)} havi rögzített duty időd {formatDuty(member?.m1_minutes ?? 0)} (a minimum {formatDuty(minMinutes)}).
          Ha most nem tudsz szolgálatot vállalni, jelezz szabadságot a profilodon; ha bármi gond van, szólj a feletteseidnek.
        </blockquote>
        <div className="space-y-1.5">
          <Label htmlFor="reminder-note">Belső megjegyzés (a tag nem látja)</Label>
          <Textarea id="reminder-note" rows={2} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)}
                    placeholder="Például: Discordon is írtam neki."/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving} onClick={() => void send()}>{saving ? <Loader2 className="animate-spin"/> : <Send/>} Küldés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
