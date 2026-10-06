import {useState} from "react";
import {useNavigate} from "react-router";
import {FilePlus2, FolderPlus, Loader2} from "lucide-react";
import {toast} from "sonner";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {BLANK_TEMPLATE_ID, templateIcon, useCaseTemplates} from "@/lib/case-templates";
import {CATEGORIES, CATEGORY, PRIORITIES, PRIORITY} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseCategory, CasePriority} from "@/types/supabase";

interface NewCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function NewCaseDialog({open, onOpenChange, onCreated}: NewCaseDialogProps) {
  const {supabase, profile} = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CasePriority>("medium");
  const [category, setCategory] = useState<CaseCategory | null>(null);
  // The leadership's starting documents (loaded once per session when the dialog opens).
  const {templates} = useCaseTemplates("document", {enabled: open});
  const [template, setTemplate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The first template unless another one is picked (one deleted meanwhile falls back too).
  const picked = template === BLANK_TEMPLATE_ID || templates?.some((item) => item.id === template) ? template : null;
  const chosen = picked ?? templates?.[0]?.id ?? BLANK_TEMPLATE_ID;

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory(null);
    setTemplate(null);
  };

  const submit = async () => {
    const name = title.trim();
    if (!name) return toast.error("Add meg az akta címét.");
    if (name.length > 160) return toast.error("Az akta címe legfeljebb 160 karakter lehet.");
    setSaving(true);
    try {
      const source = templates?.find((item) => item.id === chosen);
      const blocks = source ? structuredClone(source.blocks) : [];
      const {data, error} = await supabase.from("cases").insert({
        title: name, description: description.trim() || null, priority, category, status: "open", owner_id: profile?.id, body: blocks,
      }).select("id").single();
      if (error) throw error;
      toast.success("Az akta megnyílt.", {description: "Az ügyszámot a rendszer adta ki."});
      reset();
      onOpenChange(false);
      onCreated?.();
      navigate(`/mcb/case/${data.id}`);
    } catch (error) {
      toast.error("Az akta létrehozása nem sikerült.", {description: errorMessage(error)});
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30">
              <FolderPlus className="size-5"/>
            </span>
            <div>
              <DialogTitle>Új nyomozati akta</DialogTitle>
              <DialogDescription>Az ügyszámot a rendszer adja ki; a vezető nyomozó te leszel.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="case-title">Megnevezés / fedőnév</Label>
              <Input id="case-title" value={title} maxLength={160} autoFocus onChange={(event) => setTitle(event.target.value)}
                     placeholder="pl. „Éjszakai Bagoly” művelet"/>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritás</Label>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-white/[0.03] p-1 ring-1 ring-white/10">
                {[...PRIORITIES].reverse().map((value) => (
                  <button key={value} type="button" onClick={() => setPriority(value)}
                          className={cn("flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition",
                            priority === value ? cn(PRIORITY[value].chip, "ring-1") : "text-slate-400 hover:text-white")}>
                    <span className={cn("size-1.5 rounded-full", PRIORITY[value].dot)}/>{PRIORITY[value].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="case-summary">Rövid összefoglaló</Label>
            <Textarea id="case-summary" value={description} maxLength={2000} rows={3} onChange={(event) => setDescription(event.target.value)}
                      placeholder="Mi történt, hol, mikor – a listában és a kapcsolódó akták előnézetében látszik."/>
          </div>

          <div className="space-y-1.5">
            <Label>Ügytípus</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map((value) => {
                const look = CATEGORY[value];
                const active = category === value;
                return (
                  <button key={value} type="button" onClick={() => setCategory(active ? null : value)}
                          className={cn("flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ring-1 transition",
                            active ? "bg-sky-500/15 text-sky-100 ring-sky-500/40" : "bg-white/[0.02] text-slate-300 ring-white/10 hover:bg-white/[0.05]")}>
                    <look.icon className={cn("size-4 shrink-0", active ? "text-sky-300" : "text-slate-500")}/>
                    <span className="truncate">{look.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Kiinduló dokumentum</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-tour="case-templates">
              {templates === null ? [0, 1, 2, 3].map((index) => <div key={index} className="skeleton h-[68px] rounded-xl"/>) : [
                ...templates.map((item) => ({id: item.id, label: item.label, description: item.description, Icon: templateIcon(item.icon)})),
                {id: BLANK_TEMPLATE_ID, label: "Üres akta", description: "Üres dokumentum, saját felépítéssel.", Icon: FilePlus2},
              ].map((item) => (
                <button key={item.id} type="button" onClick={() => setTemplate(item.id)} aria-pressed={chosen === item.id}
                        className={cn("flex min-w-0 items-start gap-3 rounded-xl p-3 text-left ring-1 transition",
                          chosen === item.id ? "bg-amber-500/10 ring-amber-500/40" : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                  <item.Icon className={cn("mt-0.5 size-5 shrink-0", chosen === item.id ? "text-amber-300" : "text-slate-500")}/>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white wrap-anywhere">{item.label}</span>
                    {item.description && <span className="block text-xs text-slate-400 wrap-anywhere">{item.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={saving || !title.trim()} className="bg-sky-600 text-white hover:bg-sky-500">
            {saving ? <Loader2 className="size-4 animate-spin"/> : <FolderPlus className="size-4"/>} Akta megnyitása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
