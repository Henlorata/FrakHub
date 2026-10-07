import {useCallback, useEffect, useState} from "react";
import {toast} from "sonner";
import {FileText, Loader2, Pencil, Plus, Save, Settings2, Trash2, Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {useConfirm} from "@/components/ConfirmDialog";
import {MAIL_TOKENS, mailApi, type MailTemplate} from "@/lib/mail";
import {errorMessage} from "@/lib/utils";

/** The composer's "Sablon" menu: shared templates first, then the member's own, and the editor. */
export function TemplatePicker({canShare, onPick}: {canShare: boolean; onPick: (template: MailTemplate) => void}) {
  const [templates, setTemplates] = useState<MailTemplate[] | null>(null);
  const [managing, setManaging] = useState(false);

  const load = useCallback(() => {
    mailApi.templates().then(setTemplates, (error) => {
      toast.error(errorMessage(error, "A sablonok nem tölthetők be."));
      setTemplates([]);
    });
  }, []);

  const shared = (templates ?? []).filter((item) => item.shared);
  const own = (templates ?? []).filter((item) => !item.shared);

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && templates === null && load()}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline"><FileText className="size-4"/> Sablon</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
          {templates === null ? (
            <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-slate-500"/></div>
          ) : (
            <>
              {shared.length > 0 && <DropdownMenuLabel className="flex items-center gap-1.5"><Users className="size-3.5"/> Közös sablonok</DropdownMenuLabel>}
              {shared.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onPick(item)}>{item.title}</DropdownMenuItem>)}
              {own.length > 0 && <DropdownMenuLabel>Saját sablonjaim</DropdownMenuLabel>}
              {own.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onPick(item)}>{item.title}</DropdownMenuItem>)}
              {templates.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">Még nincs sablon.</p>}
              <DropdownMenuSeparator/>
              <DropdownMenuItem onSelect={() => setManaging(true)}><Settings2 className="size-4"/> Sablonok kezelése</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {managing && <TemplatesDialog canShare={canShare} onClose={() => setManaging(false)} onChanged={setTemplates}/>}
    </>
  );
}

type Draft = {id: string | null; title: string; subject: string; body: string; shared: boolean};

/** Create, edit and delete templates (the own ones; shared ones for staff, the IAB and the SIB). */
function TemplatesDialog({canShare, onClose, onChanged}: {canShare: boolean; onClose: () => void; onChanged: (list: MailTemplate[]) => void}) {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<MailTemplate[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const list = await mailApi.templates();
    setTemplates(list);
    onChanged(list);
  }, [onChanged]);
  useEffect(() => {
    let active = true;
    mailApi.templates().then((list) => {
      if (!active) return;
      setTemplates(list);
      onChanged(list);
    }, (error) => toast.error(errorMessage(error, "A sablonok nem tölthetők be.")));
    return () => {
      active = false;
    };
  }, [onChanged]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await mailApi.saveTemplate(draft);
      await reload();
      setDraft(null);
      toast.success("Sablon elmentve.");
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (template: MailTemplate) => {
    if (!(await confirm({title: "Törlöd a sablont?", description: template.title, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await mailApi.deleteTemplate(template.id);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Levélsablonok</DialogTitle>
          <DialogDescription>A sablon kitölti a tárgyat és a szöveget; a jelöléseket a küldéskor cseréli ki.</DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-title">Megnevezés</Label>
              <Input id="template-title" maxLength={80} value={draft.title} onChange={(event) => setDraft({...draft, title: event.target.value})}
                     placeholder="pl. Előléptetés"/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-subject">Tárgy</Label>
              <Input id="template-subject" maxLength={200} value={draft.subject} onChange={(event) => setDraft({...draft, subject: event.target.value})}/>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-body">Szöveg</Label>
              <Textarea id="template-body" rows={10} maxLength={8000} value={draft.body} onChange={(event) => setDraft({...draft, body: event.target.value})}
                        className="font-[ui-serif,Georgia,serif] text-[15px] leading-relaxed"/>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MAIL_TOKENS.map((item) => (
                  <button key={item.token} type="button" title={item.label} onClick={() => setDraft({...draft, body: `${draft.body}${item.token}`})}
                          className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-300 ring-1 ring-white/10 hover:bg-white/10">
                    {item.token}
                  </button>
                ))}
              </div>
            </div>
            {canShare && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <Switch checked={draft.shared} onCheckedChange={(shared) => setDraft({...draft, shared})}/> Közös sablon (mindenki használhatja)
              </label>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>Vissza</Button>
              <Button onClick={() => void save()} disabled={saving || draft.title.trim().length < 2 || !draft.body.trim()}>
                {saving ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>} Mentés
              </Button>
            </DialogFooter>
          </div>
        ) : templates === null ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1.5">
              {templates.map((template) => (
                <li key={template.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">{template.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">{template.shared ? "Közös" : "Saját"} · {template.subject || "tárgy nélkül"}</span>
                  </span>
                  {template.can_edit && (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label="Szerkesztés"
                              onClick={() => setDraft({id: template.id, title: template.title, subject: template.subject, body: template.body, shared: template.shared})}>
                        <Pencil/>
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Törlés" className="text-red-300 hover:bg-red-500/10" onClick={() => void remove(template)}>
                        <Trash2/>
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Bezárás</Button>
              <Button onClick={() => setDraft({id: null, title: "", subject: "", body: "", shared: false})}><Plus className="size-4"/> Új sablon</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
