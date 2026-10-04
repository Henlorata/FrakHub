import {useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {AlertTriangle, Plus, Trash2, Undo2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {PersonAvatar} from "@/components/fleet/Holders";
import {useAuth} from "@/context/AuthContext";
import type {DirectoryProfile} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {VehicleWarning} from "@/types/supabase";

interface BatchPerson {
  userId: string;
  active: VehicleWarning[];
  revoked: VehicleWarning[];
  converted: number;
}

interface Batch {
  id: string;
  reason: string;
  createdAt: string;
  issuedBy: string | null;
  plates: string[];
  people: BatchPerson[];
}

/** Rows of one decision together: reason, people, points, and what became a personal warning. */
export function groupWarnings(warnings: VehicleWarning[]): Batch[] {
  const batches = new Map<string, Batch>();
  for (const warning of warnings) {
    const batch = batches.get(warning.batch_id) ?? {id: warning.batch_id, reason: warning.reason, createdAt: warning.created_at,
      issuedBy: warning.issued_by, plates: [], people: []};
    if (warning.plate && !batch.plates.includes(warning.plate)) batch.plates.push(warning.plate);
    let person = batch.people.find((item) => item.userId === warning.user_id);
    if (!person) {
      person = {userId: warning.user_id, active: [], revoked: [], converted: 0};
      batch.people.push(person);
    }
    if (warning.converted_record_id) person.converted += 1;
    else if (warning.revoked_at) person.revoked.push(warning);
    else person.active.push(warning);
    batches.set(warning.batch_id, batch);
  }
  return [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function WarningsList({warnings, people, canManage, onChanged, onIssue}: {
  warnings: VehicleWarning[] | null;
  people: Map<string, DirectoryProfile>;
  canManage: boolean;
  onChanged: () => void;
  onIssue?: () => void;
}) {
  const {supabase} = useAuth();
  const [onlyActive, setOnlyActive] = useState(true);
  const batches = useMemo(() => groupWarnings(warnings ?? [])
    .filter((batch) => !onlyActive || batch.people.some((person) => person.active.length > 0)), [warnings, onlyActive]);

  const setRevoked = async (batch: Batch, person: BatchPerson, revoke: boolean) => {
    const query = supabase.from("vehicle_warnings").update({revoked_at: revoke ? new Date().toISOString() : null})
      .eq("batch_id", batch.id).eq("user_id", person.userId).is("converted_record_id", null);
    const {error} = revoke ? await query.is("revoked_at", null) : await query.not("revoked_at", "is", null);
    if (error) return toast.error(errorMessage(error, "A művelet nem sikerült."));
    toast.success(revoke ? "Hibapont visszavonva." : "Hibapont visszaállítva.");
    onChanged();
  };

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25"><AlertTriangle className="size-4 text-amber-400"/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Jármű-hibapontok</h2>
          <p className="text-xs text-slate-500">Három aktív hibapont után a tag automatikusan személyes figyelmeztetést kap.</p>
        </div>
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
          {([[true, "Aktív"], [false, "Mind"]] as const).map(([value, label]) => (
            <button key={label} type="button" onClick={() => setOnlyActive(value)}
                    className={cn("h-7 rounded-md px-3 text-xs font-medium transition-colors", onlyActive === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {label}
            </button>
          ))}
        </div>
        {canManage && onIssue && <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400" onClick={onIssue}><Plus/> Hibapont</Button>}
      </header>
      {warnings === null ? (
        <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14"/>)}</div>
      ) : batches.length === 0 ? (
        <EmptyState icon={AlertTriangle} title={onlyActive ? "Nincs aktív hibapont." : "Még nem volt hibapont."} compact/>
      ) : (
        <ul className="divide-y divide-white/5">
          {batches.map((batch, index) => {
            const issuer = batch.issuedBy ? people.get(batch.issuedBy) : null;
            return (
              <li key={batch.id} style={{"--i": Math.min(index, 10)} as CSSProperties} className="animate-fade space-y-2 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {batch.plates.map((plate) => <LicensePlate key={plate} plate={plate} size="sm"/>)}
                  <p className="min-w-0 flex-1 text-sm text-slate-200 wrap-anywhere">{batch.reason}</p>
                  <span className="text-xs text-slate-500">{formatDate(batch.createdAt)}{issuer ? ` · ${issuer.full_name}` : ""}</span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {batch.people.map((person) => {
                    const member = people.get(person.userId);
                    const points = person.active.length + person.revoked.length + person.converted;
                    return (
                      <li key={person.userId} className={cn("flex items-center gap-2 rounded-xl bg-white/[0.03] py-1 pr-1 pl-2 ring-1 ring-white/5",
                        !person.active.length && "opacity-60")}>
                        <PersonAvatar person={member}/>
                        <span className="text-xs text-slate-200">{member?.full_name ?? "Ismeretlen"}</span>
                        <span className={cn("rounded px-1.5 text-[11px] tabular-nums ring-1", points > 1 ? "bg-red-500/10 text-red-200 ring-red-500/30"
                          : "bg-amber-500/10 text-amber-200 ring-amber-500/30")}>{points} pont</span>
                        {person.converted > 0 && <span className="rounded bg-red-500/10 px-1.5 text-[11px] text-red-300 ring-1 ring-red-500/30">figyelmeztetés lett</span>}
                        {person.revoked.length > 0 && !person.active.length && <span className="text-[11px] text-slate-500">visszavonva</span>}
                        {canManage && person.active.length > 0 && (
                          <Button size="icon-sm" variant="ghost" title="Visszavonás" className="size-7 text-slate-500 hover:text-red-300"
                                  onClick={() => void setRevoked(batch, person, true)}><Trash2 className="size-3.5"/></Button>
                        )}
                        {canManage && person.revoked.length > 0 && (
                          <Button size="icon-sm" variant="ghost" title="Visszaállítás" className="size-7 text-slate-500 hover:text-emerald-300"
                                  onClick={() => void setRevoked(batch, person, false)}><Undo2 className="size-3.5"/></Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
