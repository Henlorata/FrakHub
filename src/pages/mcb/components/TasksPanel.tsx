import {useMemo, useState, type FormEvent} from "react";
import {toast} from "sonner";
import {CalendarClock, Check, ChevronRight, ListTodo, Loader2, Pencil, Plus, Trash2, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {useConfirm} from "@/components/ConfirmDialog";
import {MemberAvatar} from "./McbBadges";
import {mcbApi, type CaseDetail, type CaseTask} from "@/lib/mcb";
import {addDaysKey, formatDate, todayKey} from "@/lib/datetime";
import {cn, errorMessage} from "@/lib/utils";

const NOBODY = "__nobody__";

/** "ma", "holnap", "3 napja lejárt" for the due chip. */
function dueLabel(due: string, today: string): {text: string; tone: string} {
  if (due < today) {
    const days = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    return {text: days === 1 ? "tegnap lejárt" : `${days} napja lejárt`, tone: "bg-red-500/15 text-red-200 ring-red-500/30"};
  }
  if (due === today) return {text: "ma", tone: "bg-amber-500/15 text-amber-200 ring-amber-500/30"};
  if (due === addDaysKey(today, 1)) return {text: "holnap", tone: "bg-sky-500/10 text-sky-200 ring-sky-500/25"};
  return {text: formatDate(due), tone: "bg-white/5 text-slate-300 ring-white/10"};
}

/**
 * The case's to-do list: a title, an assignee from the team and a due date. The editors add
 * and change tasks; the assignee may tick theirs off. Overdue tasks reach the assignee and the
 * owner in a daily digest (first day, then weekly).
 */
export function TasksPanel({detail, myId, onChanged}: {detail: CaseDetail; myId: string | undefined; onChanged: (tasks: CaseTask[]) => void}) {
  const tasks = detail.tasks ?? [];
  const canEdit = detail.viewer.can_edit;
  const open = detail.case.status === "open";
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const today = todayKey();

  // Who can be given a task: the owner and the team (the database also accepts the MCB leadership).
  const team = useMemo(() => {
    const list: {id: string; name: string; avatar: string | null}[] = [];
    if (detail.owner) list.push({id: detail.owner.id, name: detail.owner.full_name, avatar: detail.owner.avatar_url});
    for (const member of detail.collaborators) {
      if (!list.some((entry) => entry.id === member.user_id)) {
        list.push({id: member.user_id, name: member.profile?.full_name ?? "Ismeretlen", avatar: member.profile?.avatar_url ?? null});
      }
    }
    return list;
  }, [detail.owner, detail.collaborators]);

  const pending = tasks.filter((task) => !task.done_at)
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.created_at.localeCompare(b.created_at));
  const done = tasks.filter((task) => task.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const overdue = pending.filter((task) => task.due_on && task.due_on < today).length;

  const replace = (task: CaseTask) => onChanged(tasks.some((entry) => entry.id === task.id)
    ? tasks.map((entry) => (entry.id === task.id ? task : entry)) : [...tasks, task]);

  const toggle = async (task: CaseTask) => {
    setBusy(task.id);
    try {
      replace(await mcbApi.setTaskDone(task.id, !task.done_at));
    } catch (error) {
      toast.error(errorMessage(error, "Nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (task: CaseTask) => {
    if (!(await confirm({title: "Teendő törlése", description: `„${task.title}”`, confirmLabel: "Törlés", destructive: true, kind: "delete"}))) return;
    try {
      await mcbApi.deleteTask(task.id);
      onChanged(tasks.filter((entry) => entry.id !== task.id));
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour="case-tasks">
      <div className="flex items-center gap-2 pb-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">
          {tasks.length === 0 ? "Még nincs teendő." : `${pending.length} nyitott${overdue ? `, ${overdue} lejárt` : ""} · ${done.length} kész`}
        </p>
        {canEdit && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus/> Új teendő</Button>}
      </div>
      {adding && (
        <TaskForm team={team} onCancel={() => setAdding(false)} onSave={async (title, assignee, due) => {
          const task = await mcbApi.saveTask(detail.case.id, null, title, assignee, due);
          replace(task);
          setAdding(false);
        }}/>
      )}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {tasks.length === 0 && !adding && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ListTodo className="size-8 text-slate-600"/>
            <p className="max-w-60 text-xs text-slate-500">Bontsd lépésekre a nyomozást: ki mit intéz és meddig. A lejárt teendőkről naponta összesítő megy.</p>
          </div>
        )}
        {pending.map((task) => editing === task.id ? (
          <TaskForm key={task.id} team={team} initial={task} onCancel={() => setEditing(null)} onSave={async (title, assignee, due) => {
            replace(await mcbApi.saveTask(detail.case.id, task.id, title, assignee, due));
            setEditing(null);
          }}/>
        ) : (
          <TaskRow key={task.id} task={task} today={today} busy={busy === task.id}
                   canToggle={open && (canEdit || task.assignee_id === myId)} canEdit={canEdit}
                   onToggle={() => void toggle(task)} onEdit={() => setEditing(task.id)} onRemove={() => void remove(task)}/>
        ))}
        {done.length > 0 && (
          <div className="pt-2">
            <button type="button" onClick={() => setShowDone((value) => !value)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white">
              <ChevronRight className={cn("size-3.5 transition-transform", showDone && "rotate-90")}/> Kész · {done.length}
            </button>
            {showDone && (
              <div className="mt-1.5 space-y-1.5">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} today={today} busy={busy === task.id}
                           canToggle={open && (canEdit || task.assignee_id === myId)} canEdit={canEdit}
                           onToggle={() => void toggle(task)} onEdit={() => undefined} onRemove={() => void remove(task)}/>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({task, today, busy, canToggle, canEdit, onToggle, onEdit, onRemove}: {
  task: CaseTask;
  today: string;
  busy: boolean;
  canToggle: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const due = task.due_on && !task.done_at ? dueLabel(task.due_on, today) : null;
  return (
    <div className={cn("group flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]", task.done_at && "opacity-60")}>
      <button type="button" role="checkbox" aria-checked={!!task.done_at} disabled={!canToggle || busy} onClick={onToggle}
              title={task.done_at ? "Visszanyitás" : "Kész"} aria-label={`${task.title}: ${task.done_at ? "visszanyitás" : "kész"}`}
              className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 transition-colors disabled:cursor-not-allowed",
                task.done_at ? "bg-emerald-500 text-[#04120c] ring-emerald-500" : "ring-white/25 enabled:hover:bg-white/10")}>
        {busy ? <Loader2 className="size-3 animate-spin"/> : task.done_at ? <Check className="size-3.5"/> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm wrap-anywhere text-slate-100", task.done_at && "line-through decoration-slate-500")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {task.assignee ? (
            <span className="inline-flex items-center gap-1"><MemberAvatar url={task.assignee.avatar_url} name={task.assignee.full_name} size={16}/>{task.assignee.full_name}</span>
          ) : <span>Nincs felelős</span>}
          {due && <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-px ring-1", due.tone)}><CalendarClock className="size-3"/>{due.text}</span>}
          {task.done_at && <span>· kész {formatDate(task.done_at)}{task.done_by_name ? ` (${task.done_by_name})` : ""}</span>}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!task.done_at && <Button size="icon-sm" variant="ghost" title="Szerkesztés" onClick={onEdit}><Pencil/></Button>}
          <Button size="icon-sm" variant="ghost" title="Törlés" className="hover:text-red-300" onClick={onRemove}><Trash2/></Button>
        </div>
      )}
    </div>
  );
}

function TaskForm({team, initial, onSave, onCancel}: {
  team: {id: string; name: string; avatar: string | null}[];
  initial?: CaseTask;
  onSave: (title: string, assignee: string | null, due: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [assignee, setAssignee] = useState(initial?.assignee_id ?? NOBODY);
  const [due, setDue] = useState(initial?.due_on ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      await onSave(title.trim(), assignee === NOBODY ? null : assignee, due || null);
    } catch (error) {
      toast.error(errorMessage(error, "A teendő nem ment el."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="mb-2 space-y-2 rounded-xl bg-primary/[0.06] p-3 ring-1 ring-primary/25">
      <Input autoFocus value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Mi a teendő?"/>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Felelős"/></SelectTrigger>
          <SelectContent>
            <SelectItem value={NOBODY}>Nincs felelős</SelectItem>
            {team.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={due} min={initial ? undefined : todayKey()} onChange={(event) => setDue(event.target.value)} className="h-9 text-xs"
               aria-label="Határidő"/>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}><X/> Mégse</Button>
        <Button type="submit" size="sm" disabled={saving || title.trim().length < 2}>{saving ? <Loader2 className="animate-spin"/> : <Check/>} Mentés</Button>
      </div>
    </form>
  );
}
