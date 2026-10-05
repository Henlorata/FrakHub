import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {DoorOpen, Loader2, Pencil, Plus, Save, Search, Trash2, UserX} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {LEAVE_TYPE_META, REHIRE_META} from "@/lib/registry";
import {cn, errorMessage} from "@/lib/utils";
import {DIVISIONS, FACTION_RANKS, type FormerMember, type LeaveType, type Profile, type RehireStatus} from "@/types/supabase";
import {daysSince, formatDate, formatSpan} from "../hr-utils";
import {todayKey} from "@/lib/datetime";

/** Former members (staff only), loaded once per visit of the tab that needs them. */
export function useFormerMembers() {
  const {supabase} = useAuth();
  const [rows, setRows] = useState<FormerMember[] | null>(null);
  const load = useCallback(async () => {
    const {data, error} = await supabase.from("former_members").select("*").order("left_on", {ascending: false});
    if (error) toast.error("A volt tagok betöltése nem sikerült.");
    setRows((data ?? []) as FormerMember[]);
  }, [supabase]);
  useEffect(() => {
    void load();
  }, [load]);
  return {rows, setRows, reload: load};
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Former member with the same badge number or name (returning applicants). */
export function findFormerMatch(rows: FormerMember[] | null, person: {full_name: string; badge_number: string}) {
  if (!rows) return null;
  const name = normalize(person.full_name);
  return rows.find((row) => (row.badge_number && row.badge_number === person.badge_number) || normalize(row.full_name) === name) ?? null;
}

export function FormerMembersPanel({viewer}: {viewer: Profile}) {
  const {supabase} = useAuth();
  const {rows, setRows} = useFormerMembers();
  const [search, setSearch] = useState("");
  const [rehire, setRehire] = useState<"all" | RehireStatus>("all");
  const [editing, setEditing] = useState<FormerMember | "new" | null>(null);
  const canDelete = viewer.system_role === "admin";

  const filtered = useMemo(() => {
    const term = normalize(search);
    return (rows ?? []).filter((row) => (rehire === "all" || row.rehire === rehire)
      && (!term || normalize(row.full_name).includes(term) || (row.badge_number ?? "").includes(term)
        || normalize(row.reason ?? "").includes(term)));
  }, [rows, search, rehire]);

  const remove = async (row: FormerMember) => {
    if (!window.confirm(`Biztosan törlöd ${row.full_name} bejegyzését?`)) return;
    const {error} = await supabase.from("former_members").delete().eq("id", row.id);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    setRows((prev) => (prev ?? []).filter((item) => item.id !== row.id));
    toast.success("Bejegyzés törölve.");
  };

  const counts = useMemo(() => ({
    all: rows?.length ?? 0,
    eligible: rows?.filter((row) => row.rehire === "eligible").length ?? 0,
    conditional: rows?.filter((row) => row.rehire === "conditional").length ?? 0,
    not_eligible: rows?.filter((row) => row.rehire === "not_eligible").length ?? 0,
  }), [rows]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center">
        <div className="relative xl:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Név, jelvény vagy indok…" className="pl-9"/>
        </div>
        <div className="inline-flex flex-wrap rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10">
          {(["all", "eligible", "conditional", "not_eligible"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setRehire(value)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                      rehire === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {value === "all" ? "Mind" : REHIRE_META[value].label} <span className="ml-1 text-slate-500 tabular-nums">{counts[value]}</span>
            </button>
          ))}
        </div>
        <Button className="xl:ml-auto" onClick={() => setEditing("new")}><Plus/> Új bejegyzés</Button>
      </div>

      {rows === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14"/>)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={DoorOpen} title={rows.length ? "Nincs a szűrésnek megfelelő bejegyzés." : "Még nincs volt tag a nyilvántartásban."}
                    description="Elbocsátáskor a rendszer automatikusan rögzíti a távozót." compact/>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3 pl-4">Név</th>
                <th className="px-3 py-2.5">Utolsó rang</th>
                <th className="px-3 py-2.5">Szolgálat</th>
                <th className="px-3 py-2.5">Távozás</th>
                <th className="px-3 py-2.5">Indok</th>
                <th className="px-3 py-2.5">Visszavétel</th>
                <th className="py-2.5 pr-4 pl-3"/>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={row.id} style={{"--i": Math.min(index, 10)} as CSSProperties}
                    className="animate-fade group border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                  <td className="py-3 pr-3 pl-4">
                    <p className="font-medium text-white">{row.full_name}</p>
                    {row.badge_number && <p className="font-mono text-xs text-slate-500">#{row.badge_number}</p>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-300">
                    {row.faction_rank ?? "–"}{row.division && <span className="text-slate-500"> · {row.division}</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">
                    {row.joined_on ? `${formatDate(row.joined_on)} – ` : ""}{formatDate(row.left_on)}
                    {row.joined_on && <span className="block text-slate-500">{formatSpan(daysSince(row.joined_on)! - daysSince(row.left_on)!)}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1", LEAVE_TYPE_META[row.leave_type].pill)}>
                      {LEAVE_TYPE_META[row.leave_type].label}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3 py-3">
                    <p className="line-clamp-2 text-xs text-slate-300 wrap-anywhere" title={row.reason ?? undefined}>{row.reason || "–"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1", REHIRE_META[row.rehire].pill)}>
                      {REHIRE_META[row.rehire].label}
                    </span>
                    {row.rehire_note && <p className="mt-1 line-clamp-2 max-w-[200px] text-[11px] text-slate-500 wrap-anywhere" title={row.rehire_note}>{row.rehire_note}</p>}
                  </td>
                  <td className="py-3 pr-4 pl-3">
                    <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <Button size="icon-sm" variant="ghost" title="Szerkesztés" onClick={() => setEditing(row)}><Pencil className="size-4"/></Button>
                      {canDelete && (
                        <Button size="icon-sm" variant="ghost" title="Törlés" className="hover:text-red-400" onClick={() => void remove(row)}>
                          <Trash2 className="size-4"/>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t px-4 py-2.5 text-xs text-slate-500">{filtered.length} / {rows?.length ?? 0} bejegyzés</div>

      <FormerMemberDialog key={editing === "new" ? "new" : editing?.id ?? "closed"} row={editing} viewer={viewer}
                          onOpenChange={(open) => !open && setEditing(null)}
                          onSaved={(saved) => setRows((prev) => [saved, ...(prev ?? []).filter((item) => item.id !== saved.id)]
                            .sort((a, b) => b.left_on.localeCompare(a.left_on)))}/>
    </div>
  );
}

interface FormerForm {
  full_name: string;
  badge_number: string;
  faction_rank: string;
  division: string;
  joined_on: string;
  left_on: string;
  leave_type: LeaveType;
  reason: string;
  rehire: RehireStatus;
  rehire_note: string;
}

const today = () => todayKey();

function FormerMemberDialog({row, viewer, onOpenChange, onSaved}: {
  row: FormerMember | "new" | null; viewer: Profile; onOpenChange: (open: boolean) => void; onSaved: (row: FormerMember) => void;
}) {
  const {supabase} = useAuth();
  const existing = row && row !== "new" ? row : null;
  const [form, setForm] = useState<FormerForm>(() => ({
    full_name: existing?.full_name ?? "",
    badge_number: existing?.badge_number ?? "",
    faction_rank: existing?.faction_rank ?? "",
    division: existing?.division ?? "TSB",
    joined_on: existing?.joined_on ?? "",
    left_on: existing?.left_on ?? today(),
    leave_type: existing?.leave_type ?? "resigned",
    reason: existing?.reason ?? "",
    rehire: existing?.rehire ?? "eligible",
    rehire_note: existing?.rehire_note ?? "",
  }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.full_name.trim().length < 2) return toast.error("Add meg a nevet.");
    if (form.joined_on && form.joined_on > form.left_on) return toast.error("A csatlakozás nem lehet a távozás után.");
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      badge_number: form.badge_number.trim() || null,
      faction_rank: form.faction_rank || null,
      division: form.division || null,
      joined_on: form.joined_on || null,
      left_on: form.left_on,
      leave_type: form.leave_type,
      reason: form.reason.trim() || null,
      rehire: form.rehire,
      rehire_note: form.rehire_note.trim() || null,
    };
    const {data, error} = existing
      ? await supabase.from("former_members").update(payload).eq("id", existing.id).select("*").single()
      : await supabase.from("former_members").insert({...payload, recorded_by: viewer.id}).select("*").single();
    setSaving(false);
    if (error) return toast.error("Hiba: " + errorMessage(error));
    toast.success(existing ? "Bejegyzés frissítve." : "Volt tag rögzítve.");
    onSaved(data as FormerMember);
    onOpenChange(false);
  };

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserX className="size-5 text-primary"/>{existing ? "Bejegyzés szerkesztése" : "Volt tag rögzítése"}</DialogTitle>
          <DialogDescription>Ki, mikor és miért távozott, és visszavehető-e.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Név</Label>
            <Input value={form.full_name} maxLength={64} onChange={(event) => setForm({...form, full_name: event.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label>Jelvényszám</Label>
            <Input value={form.badge_number} maxLength={10} className="font-mono" onChange={(event) => setForm({...form, badge_number: event.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label>Osztály</Label>
            <Select value={form.division} onValueChange={(value) => setForm({...form, division: value})}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>{DIVISIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Utolsó rendfokozat</Label>
            <Select value={form.faction_rank || "none"} onValueChange={(value) => setForm({...form, faction_rank: value === "none" ? "" : value})}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Nincs megadva</SelectItem>
                {FACTION_RANKS.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Csatlakozott</Label>
            <Input type="date" value={form.joined_on} max={form.left_on} onChange={(event) => setForm({...form, joined_on: event.target.value})}/>
          </div>
          <div className="space-y-1.5">
            <Label>Távozott</Label>
            <Input type="date" value={form.left_on} max={today()} onChange={(event) => setForm({...form, left_on: event.target.value})}/>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Távozás módja</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LEAVE_TYPE_META) as LeaveType[]).map((type) => (
                <button key={type} type="button" onClick={() => setForm({...form, leave_type: type})}
                        className={cn("h-8 rounded-lg px-3 text-xs font-medium ring-1 transition-colors",
                          form.leave_type === type ? LEAVE_TYPE_META[type].pill : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  {LEAVE_TYPE_META[type].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Indok</Label>
            <Textarea value={form.reason} maxLength={1000} rows={3} onChange={(event) => setForm({...form, reason: event.target.value})}/>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Visszatérhet?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(REHIRE_META) as RehireStatus[]).map((value) => (
                <button key={value} type="button" onClick={() => setForm({...form, rehire: value})}
                        className={cn("h-9 rounded-lg px-2 text-xs font-medium ring-1 transition-colors",
                          form.rehire === value ? REHIRE_META[value].pill : "text-slate-400 ring-white/10 hover:text-slate-200")}>
                  {REHIRE_META[value].label}
                </button>
              ))}
            </div>
          </div>
          {form.rehire !== "eligible" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Feltétel / megjegyzés</Label>
              <Input value={form.rehire_note} maxLength={500} placeholder="Pl. újra felvételi vizsga szükséges"
                     onChange={(event) => setForm({...form, rehire_note: event.target.value})}/>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
