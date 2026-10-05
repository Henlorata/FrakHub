import {useEffect, useMemo, useState} from "react";
import {ArrowRightLeft, Check, Loader2, Search, UserPlus} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/context/AuthContext";
import {useProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {COLLABORATOR_ROLE, mcbApi} from "@/lib/mcb";
import {cn, errorMessage, getRankPriority, isHighCommand, isSupervisory} from "@/lib/utils";
import {MemberAvatar} from "./McbBadges";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Members who can work in the MCB area (canViewCaseList / private.can_view_cases()). */
const canWorkOnCases = (member: DirectoryProfile) => member.system_role !== "pending"
  && (member.division === "MCB" || member.system_role === "admin" || member.system_role === "supervisor" || !!member.is_bureau_manager
    || isSupervisory(member) || isHighCommand(member));

function MemberPicker({exclude, selected, onSelect}: {exclude: string[]; selected: string | null; onSelect: (member: DirectoryProfile) => void}) {
  const {profiles, loading} = useProfileDirectory();
  const [query, setQuery] = useState("");
  const members = useMemo(() => {
    const term = fold(query.trim());
    return profiles.filter((member) => canWorkOnCases(member) && !exclude.includes(member.id)
      && (!term || fold(member.full_name).includes(term) || member.badge_number.includes(term)))
      .sort((a, b) => Number(b.division === "MCB") - Number(a.division === "MCB") || getRankPriority(a.faction_rank) - getRankPriority(b.faction_rank))
      .slice(0, 60);
  }, [exclude, profiles, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
        <Input value={query} autoFocus onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Név vagy jelvényszám…"/>
      </div>
      <ul className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
        {loading && <li className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-slate-500"/></li>}
        {members.map((member) => (
          <li key={member.id}>
            <button type="button" onClick={() => onSelect(member)}
                    className={cn("flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left ring-1 transition",
                      selected === member.id ? "bg-sky-500/10 ring-sky-500/40" : "ring-transparent hover:bg-white/[0.05]")}>
              <MemberAvatar url={member.avatar_url} name={member.full_name} size={34}/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{member.full_name}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  #{member.badge_number} · {member.faction_rank}{member.division === "MCB" && member.division_rank ? ` · ${member.division_rank}` : ""}
                </span>
              </span>
              {member.division === "MCB" && <span className="rounded-md bg-sky-500/10 px-1.5 text-[10px] font-semibold text-sky-300">MCB</span>}
              {selected === member.id && <Check className="size-4 text-sky-300"/>}
            </button>
          </li>
        ))}
        {!loading && members.length === 0 && <li className="py-6 text-center text-xs text-slate-500">Nincs találat.</li>}
      </ul>
    </div>
  );
}

export function AddCollaboratorDialog({open, onOpenChange, caseId, existingUserIds, onAdded}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  existingUserIds: string[];
  onAdded: () => void;
}) {
  const {supabase} = useAuth();
  const [member, setMember] = useState<DirectoryProfile | null>(null);
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMember(null);
    setRole("editor");
  }, [open]);

  const add = async () => {
    if (!member) return;
    setBusy(true);
    const {error} = await supabase.from("case_collaborators").insert({case_id: caseId, user_id: member.id, role});
    setBusy(false);
    if (error) return void toast.error("A hozzáadás nem sikerült.", {description: errorMessage(error)});
    toast.success(`${member.full_name} csatlakozott az aktához.`, {description: "Értesítést kapott."});
    onOpenChange(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30"><UserPlus className="size-5"/></span>
            <div>
              <DialogTitle>Közreműködő hozzáadása</DialogTitle>
              <DialogDescription>Az MCB tagjai és a felügyelő állomány vehető fel az aktára.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <MemberPicker exclude={existingUserIds} selected={member?.id ?? null} onSelect={setMember}/>
        <div className="space-y-1.5">
          <Label>Jogosultság</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["editor", "viewer"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setRole(value)}
                      className={cn("rounded-xl p-3 text-left ring-1 transition",
                        role === value ? "bg-sky-500/10 ring-sky-500/40" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                <span className="block text-sm font-semibold text-white">{COLLABORATOR_ROLE[value].label}</span>
                <span className="block text-[11px] text-slate-400">{COLLABORATOR_ROLE[value].hint}</span>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button onClick={() => void add()} disabled={busy || !member} className="bg-sky-600 text-white hover:bg-sky-500">
            {busy ? <Loader2 className="size-4 animate-spin"/> : <UserPlus className="size-4"/>} Hozzáadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransferCaseDialog({open, onOpenChange, caseId, ownerId, onTransferred}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  ownerId: string | null;
  onTransferred: () => void;
}) {
  const [member, setMember] = useState<DirectoryProfile | null>(null);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMember(null);
    setKeep(true);
  }, [open]);

  const transfer = async () => {
    if (!member) return;
    setBusy(true);
    try {
      await mcbApi.transfer(caseId, member.id, keep);
      toast.success(`Az akta új vezető nyomozója: ${member.full_name}.`);
      mcbApi.invalidateList();
      onOpenChange(false);
      onTransferred();
    } catch (error) {
      toast.error("Az átadás nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30"><ArrowRightLeft className="size-5"/></span>
            <div>
              <DialogTitle>Akta átadása</DialogTitle>
              <DialogDescription>Az új vezető nyomozó értesítést kap, és kezeli az akta státuszát és csapatát.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <MemberPicker exclude={ownerId ? [ownerId] : []} selected={member?.id ?? null} onSelect={setMember}/>
        {ownerId && (
          <label className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] p-3 text-sm text-slate-300 ring-1 ring-white/10">
            <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} className="size-4 accent-amber-500"/>
            Az eddigi vezető nyomozó szerkesztőként maradjon az aktán
          </label>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Mégse</Button>
          <Button onClick={() => void transfer()} disabled={busy || !member} className="bg-amber-500 text-black hover:bg-amber-400">
            {busy ? <Loader2 className="size-4 animate-spin"/> : <ArrowRightLeft className="size-4"/>} Átadás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
