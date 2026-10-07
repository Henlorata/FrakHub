import {createElement, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ArrowDown, ArrowUp, Check, KeyRound, Layers, Loader2, Pencil, Plus, Shield, Sparkles, Star, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useConfirm} from "@/components/ConfirmDialog";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {
  bureauApi, divisionRanks, divisionTitles, TITLE_ICONS, TITLE_TONES, titleIcon, titleTone, useBureauCatalog,
  type DivisionRank, type DivisionTitle, type TitleTone,
} from "@/lib/bureaus";
import {cn, errorMessage, getDepartmentLabel} from "@/lib/utils";
import {DIVISIONS, type Profile} from "@/types/supabase";
import type {HrMember} from "../useHrData";

/** Mirror of private.can_manage_bureau(): the Bureau Manager every division, a Bureau Commander their own. */
export const canManageBureau = (viewer: Profile, division: string) =>
  !!viewer.is_bureau_manager || (!!viewer.is_bureau_commander && viewer.division === division);

const DIVISION_TONE: Record<string, string> = {
  SEB: "text-red-300 bg-red-500/10 ring-red-500/30",
  MCB: "text-sky-300 bg-sky-500/10 ring-sky-500/30",
  TSB: "text-slate-200 bg-slate-500/10 ring-slate-400/30",
};

/**
 * Each division's own ranks and titles: everyone sees them; the division's Bureau Commander and
 * the Bureau Manager edit them (rename, add, reorder, delete). Renaming a rank carries the new
 * name over to its members; deleting one moves them to another rank.
 */
export function BureausPanel({viewer, members, onChanged}: {viewer: Profile; members: HrMember[]; onChanged: () => void}) {
  const catalog = useBureauCatalog();
  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-start gap-3 p-4 text-sm text-slate-300">
        <Layers className="mt-0.5 size-5 shrink-0 text-primary"/>
        <p className="min-w-0 flex-1">
          Az osztályok saját rangjai és a mellettük viselt címek (például SEB: Medic, Marksman). A listát az osztály Bureau Commandere
          és a Bureau Manager szerkeszti; a tagokhoz a rangot és a címeket az adatlapjukon lehet rendelni.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {DIVISIONS.map((division, index) => (
          <DivisionCard key={division} index={index} division={division} viewer={viewer}
                        ranks={divisionRanks(division, catalog)} titles={divisionTitles(division, catalog)}
                        members={members.filter((member) => member.division === division)} onChanged={onChanged}/>
        ))}
      </div>
    </div>
  );
}

function DivisionCard({division, index, viewer, ranks, titles, members, onChanged}: {
  division: string; index: number; viewer: Profile; ranks: DivisionRank[]; titles: DivisionTitle[]; members: HrMember[];
  onChanged: () => void;
}) {
  const confirm = useConfirm();
  const editable = canManageBureau(viewer, division);
  const manager = !!viewer.is_bureau_manager;
  const commanders = members.filter((member) => member.is_bureau_commander);
  const [newRank, setNewRank] = useState("");
  const [renaming, setRenaming] = useState<{id: string; name: string} | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DivisionRank | null>(null);
  const [titleDraft, setTitleDraft] = useState<TitleDraft | null>(null);

  const holders = (rank: string) => members.filter((member) => member.division_rank === rank).length;
  const titleHolders = (id: string) => members.filter((member) => (member.division_titles ?? []).includes(id)).length;

  const run = async (key: string, work: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await work();
      if (done) toast.success(done);
      onChanged();
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addRank = async () => {
    const name = newRank.trim();
    if (name.length < 2) return toast.error("A rang neve legalább 2 karakter.");
    if (await run("add-rank", () => bureauApi.saveRank({id: null, division, name}), `Új rang: ${name}`)) setNewRank("");
  };

  const rename = async () => {
    if (!renaming) return;
    const rank = ranks.find((item) => item.id === renaming.id);
    const name = renaming.name.trim();
    if (!rank || name === rank.name) return setRenaming(null);
    if (await run(`rename-${rank.id}`, () => bureauApi.saveRank({id: rank.id, division, name}),
      holders(rank.name) ? `Átnevezve; ${holders(rank.name)} tag rangja is frissült.` : "Rang átnevezve.")) setRenaming(null);
  };

  const move = (list: {id: string}[], id: string, step: -1 | 1) => {
    const ids = list.map((item) => item.id);
    const at = ids.indexOf(id);
    const to = at + step;
    if (at < 0 || to < 0 || to >= ids.length) return null;
    [ids[at], ids[to]] = [ids[to], ids[at]];
    return ids;
  };

  const removeTitle = async (title: DivisionTitle) => {
    const count = titleHolders(title.id);
    if (!(await confirm({
      title: "Cím törlése", confirmLabel: "Törlés", destructive: true, kind: "delete",
      description: count ? `A(z) „${title.name}” címet ${count} tag viseli: tőlük is lekerül.` : `A(z) „${title.name}” cím törlődik.`,
    }))) return;
    await run(`title-${title.id}`, () => bureauApi.deleteTitle(title.id), "Cím törölve.");
  };

  return (
    <section className="panel animate-rise flex min-w-0 flex-col gap-4 p-4" style={{"--i": index} as CSSProperties} data-tour={`bureau-${division}`}>
      <header className="flex items-start gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl ring-1", DIVISION_TONE[division])}>
          {division === "TSB" ? <Shield className="size-5"/> : <Star className="size-5"/>}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">{division}</h2>
          <p className="truncate text-xs text-slate-400">{getDepartmentLabel(division)} · {members.length} tag</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            {commanders.length ? commanders.map((member) => (
              <span key={member.id} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] py-0.5 pr-2 pl-0.5 text-slate-300 ring-1 ring-white/10">
                <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={18}/>{member.full_name}
              </span>
            )) : <span>Nincs kinevezett Bureau Commander</span>}
          </div>
        </div>
        {editable && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/30">Szerkeszthető</span>}
      </header>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Rangok <span className="normal-case text-slate-600">· a legmagasabb elöl</span></h3>
        {ranks.length === 0 && <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-xs text-slate-500 ring-1 ring-white/5">Nincs osztály rang.</p>}
        <ul className="space-y-1">
          {ranks.map((rank, position) => {
            const count = holders(rank.name);
            const isRenaming = renaming?.id === rank.id;
            return (
              <li key={rank.id} className="group flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 ring-1 ring-white/5">
                <span className="w-5 shrink-0 text-center font-mono text-[11px] text-slate-600">{position + 1}.</span>
                {isRenaming ? (
                  <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(event) => { event.preventDefault(); void rename(); }}>
                    <Input autoFocus value={renaming.name} maxLength={40} className="h-7 text-sm"
                           onChange={(event) => setRenaming({id: rank.id, name: event.target.value})}
                           onKeyDown={(event) => event.key === "Escape" && setRenaming(null)}/>
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Mentés" disabled={busy === `rename-${rank.id}`}>
                      {busy === `rename-${rank.id}` ? <Loader2 className="animate-spin"/> : <Check/>}
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Mégse" onClick={() => setRenaming(null)}><X/></Button>
                  </form>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{rank.name}</span>
                    <span className="block text-[11px] text-slate-500">{count ? `${count} tag` : "senki"}</span>
                  </span>
                )}
                {rank.privileged && !isRenaming && (
                  <span title="Minden aktát lát, parancsot bírálhat el, látja az iroda vezetői áttekintését."
                        className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                    <KeyRound className="size-3"/> Vezetői jogkör
                  </span>
                )}
                {editable && !isRenaming && (
                  <span className="flex shrink-0 items-center opacity-70 transition-opacity group-hover:opacity-100">
                    {manager && division === "MCB" && (
                      <Switch checked={rank.privileged} aria-label={`${rank.name}: vezetői jogkör`} className="mr-1 scale-90"
                              disabled={busy === `priv-${rank.id}`}
                              onCheckedChange={(value) => void run(`priv-${rank.id}`, () => bureauApi.saveRank({id: rank.id, division, name: rank.name, privileged: value}),
                                value ? "A rang vezetői jogkört kapott." : "A rang vezetői jogköre megszűnt.")}/>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`${rank.name} feljebb`} disabled={position === 0 || !!busy}
                            onClick={() => { const ids = move(ranks, rank.id, -1); if (ids) void run("order", () => bureauApi.reorderRanks(division, ids)); }}><ArrowUp/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${rank.name} lejjebb`} disabled={position === ranks.length - 1 || !!busy}
                            onClick={() => { const ids = move(ranks, rank.id, 1); if (ids) void run("order", () => bureauApi.reorderRanks(division, ids)); }}><ArrowDown/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${rank.name} átnevezése`} onClick={() => setRenaming({id: rank.id, name: rank.name})}><Pencil/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${rank.name} törlése`} className="hover:text-red-300" onClick={() => setDeleting(rank)}><Trash2/></Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {editable && (
          <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void addRank(); }}>
            <Input value={newRank} maxLength={40} placeholder="Új rang, pl. Team Leader" className="h-8 text-sm"
                   onChange={(event) => setNewRank(event.target.value)}/>
            <Button type="submit" size="sm" variant="outline" disabled={busy === "add-rank" || newRank.trim().length < 2}>
              {busy === "add-rank" ? <Loader2 className="animate-spin"/> : <Plus/>} Hozzáadás
            </Button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">Címek <span className="normal-case text-slate-600">· a rang mellett</span></h3>
          {editable && (
            <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => setTitleDraft({id: null, name: "", icon: "award", tone: "amber", description: ""})}>
              <Plus className="size-3.5"/> Új cím
            </Button>
          )}
        </div>
        {titles.length === 0 && <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-xs text-slate-500 ring-1 ring-white/5">Nincs cím.</p>}
        <ul className="space-y-1">
          {titles.map((title, position) => {
            const Icon = titleIcon(title.icon);
            const count = titleHolders(title.id);
            return (
              <li key={title.id} className="group flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 ring-1 ring-white/5">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", titleTone(title.tone).chip)}><Icon className="size-4"/></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{title.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{title.description || (count ? `${count} tag` : "senki")}</span>
                </span>
                {title.description && <span className="shrink-0 text-[11px] text-slate-500">{count ? `${count} tag` : "senki"}</span>}
                {editable && (
                  <span className="flex shrink-0 items-center opacity-70 transition-opacity group-hover:opacity-100">
                    <Button size="icon-sm" variant="ghost" aria-label={`${title.name} feljebb`} disabled={position === 0 || !!busy}
                            onClick={() => { const ids = move(titles, title.id, -1); if (ids) void run("order", () => bureauApi.reorderTitles(division, ids)); }}><ArrowUp/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${title.name} lejjebb`} disabled={position === titles.length - 1 || !!busy}
                            onClick={() => { const ids = move(titles, title.id, 1); if (ids) void run("order", () => bureauApi.reorderTitles(division, ids)); }}><ArrowDown/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${title.name} szerkesztése`}
                            onClick={() => setTitleDraft({id: title.id, name: title.name, icon: title.icon, tone: title.tone, description: title.description ?? ""})}><Pencil/></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${title.name} törlése`} className="hover:text-red-300" onClick={() => void removeTitle(title)}><Trash2/></Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <DeleteRankDialog rank={deleting} ranks={ranks} holders={deleting ? holders(deleting.name) : 0} onOpenChange={(open) => !open && setDeleting(null)}
                        onConfirm={async (moveTo) => {
                          const rank = deleting;
                          if (!rank) return;
                          if (await run(`delete-${rank.id}`, () => bureauApi.deleteRank(rank.id, moveTo), "Rang törölve.")) setDeleting(null);
                        }}/>
      <TitleDialog draft={titleDraft} onOpenChange={(open) => !open && setTitleDraft(null)}
                   onSave={async (draft) => {
                     if (await run("title-save", () => bureauApi.saveTitle({...draft, division, description: draft.description.trim() || null}),
                       draft.id ? "Cím mentve." : `Új cím: ${draft.name.trim()}`)) setTitleDraft(null);
                   }}/>
    </section>
  );
}

function DeleteRankDialog({rank, ranks, holders, onOpenChange, onConfirm}: {
  rank: DivisionRank | null; ranks: DivisionRank[]; holders: number; onOpenChange: (open: boolean) => void;
  onConfirm: (moveTo: string | null) => Promise<void>;
}) {
  const [target, setTarget] = useState("none");
  const [saving, setSaving] = useState(false);
  const others = ranks.filter((item) => item.id !== rank?.id);
  return (
    <Dialog open={!!rank} onOpenChange={(open) => { if (!saving) { onOpenChange(open); setTarget("none"); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rang törlése: {rank?.name}</DialogTitle>
          <DialogDescription>
            {holders ? `${holders} tag viseli. Hová kerüljenek? A változás a tagok előzményeibe kerül, és értesítést kapnak.` : "Senki sem viseli."}
          </DialogDescription>
        </DialogHeader>
        {holders > 0 && (
          <div className="space-y-1.5">
            <Label>A tagok új rangja</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Rang nélkül</SelectItem>
                {others.map((item) => <SelectItem key={item.id} value={item.id}><span className="truncate">{item.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button className="bg-red-600 text-white hover:bg-red-500" disabled={saving} onClick={async () => {
            setSaving(true);
            try {
              await onConfirm(target === "none" ? null : target);
              setTarget("none");
            } finally {
              setSaving(false);
            }
          }}>
            {saving ? <Loader2 className="animate-spin"/> : <Trash2/>} Törlés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A title's icon by its key (a lookup, not a component made while rendering). */
function TitleGlyph({icon, className}: {icon: string | null | undefined; className?: string}) {
  return createElement(titleIcon(icon), {className});
}

interface TitleDraft {
  id: string | null;
  name: string;
  icon: string;
  tone: TitleTone;
  description: string;
}

function TitleDialog({draft, onOpenChange, onSave}: {
  draft: TitleDraft | null; onOpenChange: (open: boolean) => void; onSave: (draft: TitleDraft) => Promise<void>;
}) {
  const [form, setForm] = useState<TitleDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [lastDraft, setLastDraft] = useState(draft);
  // A newly opened draft resets the form (adjusting state while rendering, React's pattern).
  if (draft !== lastDraft) {
    setLastDraft(draft);
    setForm(draft);
  }
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Cím szerkesztése" : "Új cím"}</DialogTitle>
          <DialogDescription>A bureau rang mellett viselt cím saját ikonnal, például Medic vagy Marksman.</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5" aria-label="Előnézet">
              <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ring-1", titleTone(form.tone).chip)}>
                <TitleGlyph icon={form.icon} className="size-3.5"/>{form.name.trim() || "Cím"}
              </span>
              <span className="text-[11px] text-slate-500"><Sparkles className="mr-1 inline size-3"/>Így látszik a tagok mellett.</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title-name">Név</Label>
              <Input id="title-name" value={form.name} maxLength={30} placeholder="pl. Medic" onChange={(event) => setForm({...form, name: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title-description">Rövid leírás (nem kötelező)</Label>
              <Textarea id="title-description" value={form.description} maxLength={160} rows={2}
                        onChange={(event) => setForm({...form, description: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ikon">
                {TITLE_ICONS.map((option) => (
                  <button key={option.key} type="button" role="radio" aria-checked={form.icon === option.key} title={option.label} aria-label={option.label}
                          onClick={() => setForm({...form, icon: option.key})}
                          className={cn("grid size-9 place-items-center rounded-lg ring-1 transition-colors",
                            form.icon === option.key ? titleTone(form.tone).chip : "text-slate-400 ring-white/10 hover:bg-white/5 hover:text-slate-200")}>
                    <option.icon className="size-4"/>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Szín</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Szín">
                {(Object.keys(TITLE_TONES) as TitleTone[]).map((tone) => (
                  <button key={tone} type="button" role="radio" aria-checked={form.tone === tone} title={TITLE_TONES[tone].label} aria-label={TITLE_TONES[tone].label}
                          onClick={() => setForm({...form, tone})}
                          className={cn("size-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0b1220] transition", TITLE_TONES[tone].swatch,
                            form.tone === tone ? "ring-white/70" : "ring-transparent hover:ring-white/30")}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button disabled={saving || !form || form.name.trim().length < 2} onClick={async () => {
            if (!form) return;
            setSaving(true);
            try {
              await onSave(form);
            } finally {
              setSaving(false);
            }
          }}>
            {saving ? <Loader2 className="animate-spin"/> : <Check/>} Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
