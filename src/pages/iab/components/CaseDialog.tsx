import {useState} from "react";
import {toast} from "sonner";
import {Loader2, Save} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {IAB_PRIORITY, IAB_TITLES, iabApi, type IabPerson, type IabPriority} from "@/lib/iab";
import {errorMessage} from "@/lib/utils";

/** Opens an investigation or edits its title, summary, urgency and lead. */
export function CaseDialog({members, editing, onOpenChange, onSaved}: {
  members: IabPerson[];
  editing?: {id: string; title: string; summary: string | null; priority: IabPriority; lead: IabPerson | null};
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [summary, setSummary] = useState(editing?.summary ?? "");
  const [priority, setPriority] = useState<IabPriority>(editing?.priority ?? "normal");
  const [lead, setLead] = useState(editing?.lead?.id ?? "none");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (title.trim().length < 3) return toast.error("Adj címet a vizsgálatnak (legalább 3 karakter).");
    setSaving(true);
    try {
      const id = await iabApi.saveCase({id: editing?.id ?? null, title: title.trim(), summary: summary.trim() || null, priority, lead: lead === "none" ? null : lead});
      toast.success(editing ? "Vizsgálat mentve." : "Vizsgálat megnyitva.");
      onSaved(id);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Vizsgálat szerkesztése" : "Új belső vizsgálat"}</DialogTitle>
          <DialogDescription>Az érintett tagokat (vizsgált, bejelentő, tanú) a vizsgálat oldalán kapcsolod hozzá.</DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="iab-title">Cím</Label>
            <Input id="iab-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="pl. Felülvizsgálati kérelem – Laura Graves"/>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iab-summary">Összefoglaló</Label>
            <Textarea id="iab-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} maxLength={4000}
                      placeholder="Mi történt, mi a panasz vagy a gyanú?"/>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sürgősség</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as IabPriority)}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>{(Object.keys(IAB_PRIORITY) as IabPriority[]).map((key) => <SelectItem key={key} value={key}>{IAB_PRIORITY[key].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vizsgálatvezető</Label>
              <Select value={lead} onValueChange={setLead}>
                <SelectTrigger className="w-full"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Később jelölöm ki</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.full_name}{member.iab_title ? ` · ${IAB_TITLES[member.iab_title]}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} {editing ? "Mentés" : "Megnyitás"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
