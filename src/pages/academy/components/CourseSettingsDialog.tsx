import {useState} from "react";
import {toast} from "sonner";
import {Loader2, Save, Settings2, Trash2} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {useAuth} from "@/context/AuthContext";
import {FACTION_RANKS} from "@shared/ranks";
import {CATEGORY_LABELS, type CourseCategory, type CourseSummary} from "@/lib/academy";
import {errorMessage} from "@/lib/utils";

const selectClass = "h-9 w-full rounded-md bg-white/[0.03] px-2 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-cyan-400/60";

/** A course's catalogue data and access rules; a new course when `course` is null. */
export function CourseSettingsDialog({course, onClose, onSaved, onDeleted}: {
  course: CourseSummary | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}) {
  const {supabase} = useAuth();
  const [title, setTitle] = useState(course?.title ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [category, setCategory] = useState<CourseCategory>(course?.category ?? "other");
  const [isOpen, setIsOpen] = useState(course?.is_open ?? false);
  const [linear, setLinear] = useState(course?.linear_progression ?? true);
  const [rank, setRank] = useState(course?.required_rank ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error("Adj címet a tananyagnak.");
    setSaving(true);
    const values = {
      title: title.trim(), description: description.trim() || null, category, is_open: isOpen, linear_progression: linear,
      required_rank: rank || null, updated_at: new Date().toISOString(),
    };
    try {
      if (course) {
        const {error} = await supabase.from("academy_courses").update(values).eq("id", course.id);
        if (error) throw error;
        toast.success("Beállítások mentve.");
        onSaved(course.id);
      } else {
        const id = `course_${crypto.randomUUID().slice(0, 8)}`;
        const {error} = await supabase.from("academy_courses").insert({id, ...values, sort_order: 200});
        if (error) throw error;
        toast.success("Új tananyag létrehozva.");
        onSaved(id);
      }
    } catch (error) {
      toast.error("A mentés nem sikerült: " + errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!course || course.pages > 0) return;
    if (!window.confirm(`Törlöd a(z) „${course.title}” tananyagot?`)) return;
    const {error} = await supabase.from("academy_courses").delete().eq("id", course.id);
    if (error) return toast.error("A törlés nem sikerült: " + errorMessage(error));
    toast.success("Tananyag törölve.");
    onDeleted?.();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="size-4 text-cyan-300"/> {course ? "Tananyag beállításai" : "Új tananyag"}</DialogTitle>
          <DialogDescription className="mt-1">Ki láthatja, és hogyan jelenjen meg a katalógusban.</DialogDescription>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-title">Cím</Label>
          <Input id="course-title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="pl. K9 egység képzés"/>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-description">Rövid leírás</Label>
          <Textarea id="course-description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} className="min-h-20"/>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Kategória</Label>
            <select className={selectClass} value={category} onChange={(event) => setCategory(event.target.value as CourseCategory)}>
              {(Object.keys(CATEGORY_LABELS) as CourseCategory[]).map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Minimum rendfokozat</Label>
            <select className={selectClass} value={rank} onChange={(event) => setRank(event.target.value)}>
              <option value="">Nincs megkötés</option>
              {FACTION_RANKS.map((item) => <option key={item} value={item}>{item} és felette</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <span>
            <span className="block text-sm text-white">Megnyitva a tagoknak</span>
            <span className="block text-xs text-slate-500">Zárva csak az oktatók látják (feltöltés alatt).</span>
          </span>
          <Switch checked={isOpen} onCheckedChange={setIsOpen}/>
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <span>
            <span className="block text-sm text-white">Sorrendben haladás</span>
            <span className="block text-xs text-slate-500">A következő oldal az előző „elolvastam” jelölése után nyílik.</span>
          </span>
          <Switch checked={linear} onCheckedChange={setLinear}/>
        </label>
        <div className="flex items-center gap-2">
          {course && course.pages === 0 && course.id.startsWith("course_") && (
            <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => void remove()}><Trash2/> Törlés</Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>Mégse</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <Save/>} Mentés</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
