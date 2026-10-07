import {useMemo, useState} from "react";
import {toast} from "sonner";
import {
  Archive, ArrowRightLeft, Boxes, CalendarClock, ChevronRight, Flame, Handshake, Loader2, MapPin, MoreHorizontal, PackageCheck, PackageOpen, Plus,
  StickyNote, Trash2, Undo2,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {useConfirm} from "@/components/ConfirmDialog";
import {mcbApi, type CaseDetail, type CaseItem, type CaseItemAction, type CaseItemStatus} from "@/lib/mcb";
import {formatDate, formatDateTime, todayKey} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";

const STATUS: Record<CaseItemStatus, {label: string; tone: string; icon: typeof Archive}> = {
  held: {label: "Őrizetben", tone: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25", icon: Archive},
  checked_out: {label: "Kiadva", tone: "bg-amber-500/10 text-amber-200 ring-amber-500/25", icon: PackageOpen},
  returned: {label: "Visszaadva", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25", icon: Handshake},
  destroyed: {label: "Megsemmisítve", tone: "bg-white/5 text-slate-400 ring-white/10", icon: Flame},
};

const ACTION: Record<CaseItemAction, {label: string; past: string; icon: typeof Archive}> = {
  seized: {label: "Lefoglalás", past: "Lefoglalva", icon: PackageCheck},
  moved: {label: "Áthelyezés", past: "Áthelyezve", icon: ArrowRightLeft},
  checked_out: {label: "Kiadás", past: "Kiadva", icon: PackageOpen},
  checked_in: {label: "Visszavétel", past: "Visszavéve", icon: Undo2},
  returned: {label: "Visszaadás a tulajdonosnak", past: "Visszaadva", icon: Handshake},
  destroyed: {label: "Megsemmisítés", past: "Megsemmisítve", icon: Flame},
  note: {label: "Megjegyzés", past: "Megjegyzés", icon: StickyNote},
};

type StepAction = Exclude<CaseItemAction, "seized">;
const MANUAL = "__manual__";

/**
 * Seized items with their chain of custody: where an item is, who took it out and when, until it
 * is returned or destroyed. Optional: cases that only need the evidence pictures never see it
 * beyond this tab.
 */
export function ItemsPanel({detail, myId, onChanged}: {detail: CaseDetail; myId: string | undefined; onChanged: (items: CaseItem[]) => void}) {
  const items = detail.items ?? [];
  const canEdit = detail.viewer.can_edit;
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<{item: CaseItem; action: StepAction} | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const confirm = useConfirm();
  const evidenceName = useMemo(() => new Map(detail.evidence.map((file) => [file.id, file.file_name])), [detail.evidence]);
  const team = useMemo(() => {
    const list: {id: string; name: string}[] = [];
    if (detail.owner) list.push({id: detail.owner.id, name: detail.owner.full_name});
    for (const member of detail.collaborators) {
      if (!list.some((entry) => entry.id === member.user_id)) list.push({id: member.user_id, name: member.profile?.full_name ?? "Ismeretlen"});
    }
    return list;
  }, [detail.owner, detail.collaborators]);

  const replace = (item: CaseItem) => onChanged(items.some((entry) => entry.id === item.id)
    ? items.map((entry) => (entry.id === item.id ? item : entry)) : [...items, item]);
  // The same words as the status badges: "Őrizetben" = held, "Kiadva" = checked out.
  const held = items.filter((item) => item.status === "held").length;
  const checkedOut = items.filter((item) => item.status === "checked_out").length;
  const summary = [`${items.length} tárgy`, held > 0 && `${held} őrizetben`, checkedOut > 0 && `${checkedOut} kiadva`].filter(Boolean).join(" · ");

  const remove = async (item: CaseItem) => {
    if (!(await confirm({title: "Tárgy törlése", description: `„${item.label}” és a teljes őrzési lánca törlődik.`, confirmLabel: "Törlés",
      destructive: true, kind: "delete"}))) return;
    try {
      await mcbApi.deleteItem(item.id);
      onChanged(items.filter((entry) => entry.id !== item.id));
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour="case-items">
      <div className="flex items-center gap-2 pb-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">{items.length === 0 ? "Nincs rögzített tárgy." : summary}</p>
        {canEdit && <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus/> Tárgy rögzítése</Button>}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Boxes className="size-8 text-slate-600"/>
            <p className="max-w-64 text-xs text-slate-500">
              Lefoglalt tárgyak őrzési lánca: hol van, ki vitte el és mikor, amíg vissza nem adják vagy meg nem semmisítik. Nem kötelező; a képes
              bizonyítékok enélkül is működnek.
            </p>
          </div>
        )}
        {items.map((item) => {
          const look = STATUS[item.status];
          const closed = item.status === "returned" || item.status === "destroyed";
          const open = expanded === item.id;
          const canDelete = canEdit && (item.created_by === myId || detail.viewer.can_manage);
          return (
            <article key={item.id} className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06]">
              <div className="flex items-start gap-3 p-3">
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1", look.tone)}><look.icon className="size-4"/></div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 text-sm font-medium wrap-anywhere text-white">{item.label}</p>
                    {item.quantity && <span className="text-xs text-slate-400">{item.quantity}</span>}
                    <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold ring-1", look.tone)}>{look.label}</span>
                  </div>
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    {item.status === "checked_out" && item.holder_name && <span className="wrap-anywhere">Átvevő: {item.holder_name}</span>}
                    {item.status === "held" && item.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0"/><span className="wrap-anywhere">{item.location}</span></span>}
                    {item.retain_until && !closed && (
                      <span className={cn("inline-flex items-center gap-1", item.retention_over ? "text-red-300" : "text-slate-500")}>
                        <CalendarClock className="size-3"/> megőrzés: {formatDate(item.retain_until)}{item.retention_over ? " (lejárt)" : ""}
                      </span>
                    )}
                    {item.evidence_id && evidenceName.get(item.evidence_id) && <span className="text-slate-500">· kép: {evidenceName.get(item.evidence_id)}</span>}
                  </p>
                  {item.description && <p className="mt-1 text-xs wrap-anywhere text-slate-300">{item.description}</p>}
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" title="Műveletek"><MoreHorizontal/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {!closed && item.status === "held" && (
                        <>
                          <DropdownMenuItem onSelect={() => setStep({item, action: "moved"})}><ArrowRightLeft/> Áthelyezés</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setStep({item, action: "checked_out"})}><PackageOpen/> Kiadás</DropdownMenuItem>
                        </>
                      )}
                      {item.status === "checked_out" && (
                        <DropdownMenuItem onSelect={() => setStep({item, action: "checked_in"})}><Undo2/> Visszavétel</DropdownMenuItem>
                      )}
                      {!closed && (
                        <>
                          <DropdownMenuItem onSelect={() => setStep({item, action: "returned"})}><Handshake/> Visszaadás a tulajdonosnak</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setStep({item, action: "destroyed"})}><Flame/> Megsemmisítés</DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onSelect={() => setStep({item, action: "note"})}><StickyNote/> Megjegyzés</DropdownMenuItem>
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator/>
                          <DropdownMenuItem className="text-red-300 focus:text-red-200" onSelect={() => void remove(item)}><Trash2/> Törlés</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <button type="button" onClick={() => setExpanded(open ? null : item.id)}
                      className="flex w-full items-center gap-1 border-t border-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white">
                <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")}/> Őrzési lánc · {item.events.length} lépés
              </button>
              {open && (
                <ol className="relative mx-3 mb-3 space-y-2.5 border-l border-white/10 pl-4">
                  {item.events.map((event) => {
                    const action = ACTION[event.action];
                    return (
                      <li key={event.id} className="relative text-xs">
                        <span className="absolute top-0.5 -left-[25px] grid size-4 place-items-center rounded-full bg-[#0b1324] ring-1 ring-white/15">
                          <action.icon className="size-2.5 text-slate-300"/>
                        </span>
                        <p className="text-slate-200"><b className="font-semibold">{action.past}</b>
                          {event.location && <span className="text-slate-400"> · {event.location}</span>}
                          {event.holder_name && event.action === "checked_out" && <span className="text-slate-400"> · átvevő: {event.holder_name}</span>}
                        </p>
                        {event.note && <p className="wrap-anywhere text-slate-400">{event.note}</p>}
                        <p className="text-[10px] text-slate-500">{event.actor_name ?? "Ismeretlen"} · {formatDateTime(event.created_at)}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </article>
          );
        })}
      </div>
      <NewItemDialog open={creating} onOpenChange={setCreating} detail={detail} onSaved={(item) => {
        replace(item);
        setCreating(false);
      }}/>
      <StepDialog step={step} team={team} onOpenChange={(open) => !open && setStep(null)} onSaved={(item) => {
        replace(item);
        setStep(null);
      }}/>
    </div>
  );
}

function NewItemDialog({open, onOpenChange, detail, onSaved}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CaseDetail;
  onSaved: (item: CaseItem) => void;
}) {
  const empty = {label: "", quantity: "", description: "", location: "", evidence: MANUAL, retain: "", note: ""};
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const images = detail.evidence.filter((file) => file.file_type.startsWith("image"));
  const save = async () => {
    setSaving(true);
    try {
      const item = await mcbApi.saveItem(detail.case.id, null, {
        label: form.label.trim(), quantity: form.quantity.trim() || null, description: form.description.trim() || null,
        location: form.location.trim() || null, evidence_id: form.evidence === MANUAL ? null : form.evidence, retain_until: form.retain || null,
        note: form.note.trim() || null,
      });
      toast.success("Tárgy rögzítve.");
      setForm(empty);
      onSaved(item);
    } catch (error) {
      toast.error(errorMessage(error, "A tárgy nem ment el."));
    } finally {
      setSaving(false);
    }
  };
  const set = (key: keyof typeof empty) => (value: string) => setForm((prev) => ({...prev, [key]: value}));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lefoglalt tárgy</DialogTitle>
          <DialogDescription>A lefoglalás az őrzési lánc első lépése: te leszel az első őrzője.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="space-y-1">
            <Label htmlFor="item-label">Megnevezés</Label>
            <Input id="item-label" autoFocus maxLength={120} value={form.label} onChange={(event) => set("label")(event.target.value)} placeholder="Például: Gépkarabély (AK-47)"/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-quantity">Mennyiség</Label>
            <Input id="item-quantity" maxLength={40} value={form.quantity} onChange={(event) => set("quantity")(event.target.value)} placeholder="2 db"/>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="item-description">Leírás</Label>
          <Textarea id="item-description" rows={2} maxLength={500} value={form.description} onChange={(event) => set("description")(event.target.value)}
                    placeholder="Ismertetőjegyek, sorozatszám, honnan került elő."/>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="item-location">Hová került</Label>
            <Input id="item-location" maxLength={120} value={form.location} onChange={(event) => set("location")(event.target.value)} placeholder="Downtown, bizonyítékraktár"/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-retain">Megőrzés eddig (nem kötelező)</Label>
            <Input id="item-retain" type="date" min={todayKey()} value={form.retain} onChange={(event) => set("retain")(event.target.value)}/>
          </div>
        </div>
        {images.length > 0 && (
          <div className="space-y-1">
            <Label>Kapcsolódó kép a bizonyítékok közül</Label>
            <Select value={form.evidence} onValueChange={set("evidence")}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>Nincs</SelectItem>
                {images.map((file) => <SelectItem key={file.id} value={file.id}><span className="truncate">{file.file_name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="item-note">Megjegyzés a lefoglaláshoz</Label>
          <Input id="item-note" maxLength={300} value={form.note} onChange={(event) => set("note")(event.target.value)} placeholder="Például: a helyszínen, két tanú előtt."/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button disabled={saving || form.label.trim().length < 2} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin"/> : <PackageCheck/>} Rögzítés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepDialog({step, team, onOpenChange, onSaved}: {
  step: {item: CaseItem; action: StepAction} | null;
  team: {id: string; name: string}[];
  onOpenChange: (open: boolean) => void;
  onSaved: (item: CaseItem) => void;
}) {
  const [location, setLocation] = useState("");
  const [holder, setHolder] = useState(MANUAL);
  const [holderName, setHolderName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const action = step?.action;
  const needsPlace = action === "moved";
  const needsHolder = action === "checked_out";
  const needsNote = action === "note";
  const valid = !step || ((!needsPlace || location.trim()) && (!needsHolder || holder !== MANUAL || holderName.trim()) && (!needsNote || note.trim()));

  const reset = () => {
    setLocation("");
    setHolder(MANUAL);
    setHolderName("");
    setNote("");
  };
  const save = async () => {
    if (!step) return;
    setSaving(true);
    try {
      const item = await mcbApi.recordItem(step.item.id, step.action, {
        location: location.trim() || null, holderId: needsHolder && holder !== MANUAL ? holder : null,
        holderName: needsHolder && holder === MANUAL ? holderName.trim() || null : null, note: note.trim() || null,
      });
      reset();
      onSaved(item);
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült rögzíteni."));
    } finally {
      setSaving(false);
    }
  };
  const look = action ? ACTION[action] : null;
  return (
    <Dialog open={!!step} onOpenChange={(open) => {
      if (!open) reset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{look?.label}</DialogTitle>
          <DialogDescription>{step?.item.label}</DialogDescription>
        </DialogHeader>
        {(needsPlace || action === "checked_in") && (
          <div className="space-y-1">
            <Label htmlFor="step-location">{needsPlace ? "Új hely" : "Hová került vissza (nem kötelező)"}</Label>
            <Input id="step-location" autoFocus maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Downtown, bizonyítékraktár B-12"/>
          </div>
        )}
        {needsHolder && (
          <div className="space-y-2">
            <Label>Kinek adod ki?</Label>
            <Select value={holder} onValueChange={setHolder}>
              <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>Más (név beírása)</SelectItem>
                {team.map((member) => <SelectItem key={member.id} value={member.id}><span className="truncate">{member.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
            {holder === MANUAL && (
              <Input maxLength={80} value={holderName} onChange={(event) => setHolderName(event.target.value)} placeholder="Például: Bíróság, Labor – Dr. Kovács"/>
            )}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="step-note">{needsNote ? "Megjegyzés" : "Megjegyzés (nem kötelező)"}</Label>
          <Textarea id="step-note" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)}
                    placeholder={action === "destroyed" ? "Például: bírósági végzés alapján, két tanú jelenlétében." : action === "returned" ? "Kinek, milyen igazolással." : ""}/>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button variant={action === "destroyed" ? "destructive" : "default"} disabled={saving || !valid} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin"/> : look ? <look.icon/> : null} Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
