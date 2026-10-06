import {useState} from "react";
import {ClipboardCheck, History, Save, Trash2} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {formatRelative} from "@/lib/datetime";
import {formatCurrency} from "@/lib/penalcode-processor";
import type {HistorySnapshot, Template} from "./penal-data";

export function SaveTemplateDialog({open, onOpenChange, onSave}: {open: boolean; onOpenChange: (open: boolean) => void; onSave: (name: string) => void}) {
  const [name, setName] = useState("");
  const save = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle className="flex items-center gap-2"><Save className="size-4 text-amber-300"/> Mentés sablonként</DialogTitle>
          <DialogDescription className="mt-1">A sablon a jegyzőkönyv tételeit és a beállított összegeket is megjegyzi (ebben a böngészőben).</DialogDescription>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="template-name">Sablon neve</Label>
          <Input id="template-name" autoFocus placeholder="pl. Közúti menekülés, alap" value={name} maxLength={80}
                 onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && save()}/>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={save} disabled={!name.trim()}><Save/> Mentés</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HistoryDialog({open, onOpenChange, history, onLoad}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistorySnapshot[];
  onLoad: (snapshot: HistorySnapshot) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="flex items-center gap-2"><History className="size-4 text-sky-300"/> Előzmények</DialogTitle>
          <DialogDescription className="mt-1">Az utolsó 10 kimásolt intézkedés (ebben a böngészőben).</DialogDescription>
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Még nincs előzmény: a parancsok másolásakor kerülnek ide.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {history.map((snapshot) => (
              <li key={snapshot.timestamp} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    <span className="text-emerald-300">{formatCurrency(snapshot.finalFine)}</span>
                    {snapshot.finalJail > 0 && <span className="text-red-300"> · {snapshot.finalJail} perc</span>}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-400" title={snapshot.reasons}>{snapshot.reasons || "(nincs indok)"}</p>
                  <p className="text-[11px] text-slate-500">{formatRelative(snapshot.timestamp)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onLoad(snapshot)}>Betöltés</Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesDialog({open, onOpenChange, templates, onLoad, onDelete}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  onLoad: (template: Template) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="flex items-center gap-2"><ClipboardCheck className="size-4 text-amber-300"/> Sablonok</DialogTitle>
          <DialogDescription className="mt-1">Gyakori tétel-kombinációk: a betöltés hozzáadja őket a jegyzőkönyvhöz.</DialogDescription>
        </div>
        {templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Még nincs sablonod. A jegyzőkönyvben a „Sablon” gombbal menthetsz.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{template.name}</p>
                  <p className="text-xs text-slate-400">
                    {template.cart.length} tétel{template.savedFine > 0 && <> · {formatCurrency(template.savedFine)}</>}
                    {template.savedJail > 0 && <> · {template.savedJail} perc</>}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="size-8 text-red-300 hover:bg-red-500/10" aria-label={`${template.name} törlése`}
                        onClick={() => onDelete(template.id)}><Trash2/></Button>
                <Button size="sm" variant="outline" onClick={() => onLoad(template)}>Hozzáadás</Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
