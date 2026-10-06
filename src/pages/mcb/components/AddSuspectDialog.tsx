import {useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, Check, Link2, Loader2, Search, UserPlus} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {INVOLVEMENT, INVOLVEMENTS, SUSPECT_STATUS, SUSPECT_STATUSES} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {Suspect, SuspectStatus} from "@/types/supabase";
import {Mugshot, SuspectStatusChip} from "./McbBadges";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface AddSuspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  linkedIds: string[];
  /** Pre-selects a person (e.g. mentioned in the document but not linked yet). */
  preselectId?: string | null;
  onLinked: () => void;
}

/** Links a registered person to the case (or registers a new one on the spot). */
export function AddSuspectDialog({open, onOpenChange, caseId, linkedIds, preselectId, onLinked}: AddSuspectDialogProps) {
  const {supabase, user} = useAuth();
  const {suspects, refreshSuspects} = useSuspects();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Suspect | null>(null);
  const [creating, setCreating] = useState(false);
  const [role, setRole] = useState("suspect");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState({full_name: "", alias: "", gang_affiliation: "", status: "free" as SuspectStatus});
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);

  // Fresh form each time the dialog opens (not when the cached list refreshes meanwhile).
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening) return;
    setQuery("");
    setCreating(false);
    setRole("suspect");
    setNotes("");
    setDraft({full_name: "", alias: "", gang_affiliation: "", status: "free"});
    setSelected(preselectId ? suspects.find((item) => item.id === preselectId) ?? null : null);
  }, [open, preselectId, suspects]);

  const results = useMemo(() => {
    const term = fold(query.trim());
    const list = term ? suspects.filter((item) => [item.full_name, item.alias ?? "", item.gang_affiliation ?? ""].some((value) => fold(value).includes(term)))
      : suspects;
    return list.slice(0, 40);
  }, [query, suspects]);

  const link = async () => {
    setBusy(true);
    try {
      let person = selected;
      if (creating) {
        const name = draft.full_name.trim();
        if (!name) {
          toast.error("A név megadása kötelező.");
          return;
        }
        const {data, error} = await supabase.from("suspects").insert({
          full_name: name, alias: draft.alias.trim() || null, gang_affiliation: draft.gang_affiliation.trim() || null,
          status: draft.status, created_by: user?.id,
        }).select("*").single();
        if (error) throw error;
        person = data as Suspect;
        void refreshSuspects(true);
      }
      if (!person) return;
      const {error} = await supabase.from("case_suspects").insert({case_id: caseId, suspect_id: person.id, involvement_type: role,
        notes: notes.trim() || null});
      if (error) throw error;
      toast.success(`${person.full_name} csatolva az aktához.`);
      onOpenChange(false);
      onLinked();
    } catch (error) {
      toast.error("A csatolás nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(false);
    }
  };

  const choosing = !selected && !creating;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/30"><Link2 className="size-5"/></span>
            <div>
              <DialogTitle>Személy csatolása</DialogTitle>
              <DialogDescription>Gyanúsított, elkövető, tanú, sértett vagy informátor a nyilvántartásból.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {choosing ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={query} autoFocus onChange={(event) => setQuery(event.target.value)} className="pl-9"
                     placeholder="Név, álnév vagy szervezet…"/>
            </div>
            <ul className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
              {results.map((person) => {
                const linked = linkedIds.includes(person.id);
                return (
                  <li key={person.id}>
                    <button type="button" disabled={linked} onClick={() => setSelected(person)}
                            className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.05] disabled:opacity-40">
                      <Mugshot url={person.mugshot_url} name={person.full_name} status={person.status} size={36}/>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{person.full_name}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {[person.alias && `„${person.alias}”`, person.gang_affiliation].filter(Boolean).join(" · ") || "Nincs további adat"}
                        </span>
                      </span>
                      {linked ? <span className="text-[11px] text-slate-500">már csatolva</span> : <SuspectStatusChip status={person.status}/>}
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && <li className="py-6 text-center text-xs text-slate-500">Nincs találat a nyilvántartásban.</li>}
            </ul>
            <Button variant="outline" className="w-full" onClick={() => {
              setCreating(true);
              setDraft((value) => ({...value, full_name: query.trim()}));
            }}>
              <UserPlus className="size-4"/> Új személy felvétele{query.trim() ? `: „${query.trim()}”` : ""}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => {
              setSelected(null);
              setCreating(false);
            }} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
              <ArrowLeft className="size-3.5"/> Vissza a kereséshez
            </button>

            {selected ? (
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
                <Mugshot url={selected.mugshot_url} name={selected.full_name} status={selected.status} size={48}/>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{selected.full_name}</p>
                  <p className="truncate text-xs text-slate-400">{selected.alias ? `„${selected.alias}”` : "Nincs álnév"}</p>
                </div>
                <SuspectStatusChip status={selected.status}/>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="new-person-name">Teljes név</Label>
                  <Input id="new-person-name" value={draft.full_name} maxLength={120} autoFocus
                         onChange={(event) => setDraft({...draft, full_name: event.target.value})}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-person-alias">Álnév</Label>
                  <Input id="new-person-alias" value={draft.alias} maxLength={80} onChange={(event) => setDraft({...draft, alias: event.target.value})}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-person-gang">Szervezet / banda</Label>
                  <Input id="new-person-gang" value={draft.gang_affiliation} maxLength={80}
                         onChange={(event) => setDraft({...draft, gang_affiliation: event.target.value})}/>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Státusz</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUSPECT_STATUSES.map((value) => (
                      <button key={value} type="button" onClick={() => setDraft({...draft, status: value})}
                              className={cn("rounded-full px-2.5 py-1 text-xs ring-1 transition",
                                draft.status === value ? SUSPECT_STATUS[value].chip : "text-slate-400 ring-white/10 hover:text-white")}>
                        {SUSPECT_STATUS[value].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Szerepe az ügyben</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {INVOLVEMENTS.map((value) => (
                  <button key={value} type="button" onClick={() => setRole(value)}
                          className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 transition",
                            role === value ? INVOLVEMENT[value].chip : "bg-white/[0.02] text-slate-300 ring-white/10 hover:bg-white/[0.05]")}>
                    {INVOLVEMENT[value].label}
                    {role === value && <Check className="size-3.5"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-notes">Megjegyzés (nem kötelező)</Label>
              <Input id="link-notes" value={notes} maxLength={300} onChange={(event) => setNotes(event.target.value)}
                     placeholder="pl. a térfigyelő felvételen azonosítva"/>
            </div>
          </div>
        )}

        {!choosing && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
            <Button onClick={() => void link()} disabled={busy} className="bg-orange-500 text-black hover:bg-orange-400">
              {busy ? <Loader2 className="size-4 animate-spin"/> : <Link2 className="size-4"/>} {creating ? "Felvétel és csatolás" : "Csatolás"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
