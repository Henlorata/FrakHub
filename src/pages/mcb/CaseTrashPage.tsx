import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {ArrowLeft, FileX2, Gavel, Hourglass, Loader2, Paperclip, Trash2, Undo2, Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {useConfirm} from "@/components/ConfirmDialog";
import {postApi} from "@/lib/api";
import {formatDate, formatDateTime} from "@/lib/datetime";
import {mcbApi, PRIORITY, type TrashedCase} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

/**
 * The MCB's trash: cases put there by their owner or the MCB's leadership. They can be restored
 * for 30 days; after that the daily job deletes them with their files. Everyone sees what they may
 * restore: their own cases, the leadership every case.
 */
export function CaseTrashPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<TrashedCase[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(() => {
    mcbApi.trashList().then(setItems, (error) => {
      setItems([]);
      toast.error("A lomtár nem tölthető be.", {description: errorMessage(error)});
    });
  }, []);
  useEffect(load, [load]);

  const restore = async (item: TrashedCase) => {
    setBusy(item.id);
    try {
      await mcbApi.restore(item.id);
      mcbApi.invalidateList();
      setItems((current) => current?.filter((entry) => entry.id !== item.id) ?? null);
      toast.success(`${item.case_number} visszaállítva.`, {action: {label: "Megnyitás", onClick: () => window.location.assign(`/mcb/case/${item.id}`)}});
    } catch (error) {
      toast.error("A visszaállítás nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(null);
    }
  };

  const purge = async (item: TrashedCase) => {
    const ok = await confirm({
      title: "Végleges törlés",
      description: <>A(z) <strong>{item.case_number}</strong> minden tartalma visszavonhatatlanul törlődik: a dokumentum, {item.evidence} bizonyíték
        a fájlokkal, {item.people} személy-kapcsolat, {item.warrants} parancs, az üzenetek és a napló.</>,
      confirmLabel: "Végleges törlés",
      destructive: true,
      kind: "delete",
    });
    if (!ok) return;
    setBusy(item.id);
    const toastId = toast.loading("Az akta és a csatolt fájlok törlése…");
    try {
      await postApi("/api/case/delete", {caseId: item.id});
      setItems((current) => current?.filter((entry) => entry.id !== item.id) ?? null);
      toast.success("Az akta véglegesen törölve.", {id: toastId});
    } catch (error) {
      toast.error("A törlés nem sikerült.", {id: toastId, description: errorMessage(error)});
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/mcb"><ArrowLeft className="size-4"/> Akták</Link></Button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Trash2 className="size-5 text-red-300"/> Lomtár</h2>
          <p className="text-sm text-slate-400">
            A lomtárba helyezett akta 30 napig visszaállítható, utána a fájljaival együtt véglegesen törlődik. Addig senki sem látja és
            nem szerkesztheti, a parancsai sem jelennek meg.
          </p>
        </div>
      </div>

      {items === null ? (
        <div className="flex justify-center py-16"><Loader2 className="size-7 animate-spin text-slate-500"/></div>
      ) : items.length === 0 ? (
        <EmptyState icon={FileX2} title="A lomtár üres" description="Ide kerülnek a törölt akták 30 napig."/>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const left = Math.max(0, Math.ceil((new Date(item.purge_at).getTime() - now) / DAY));
            const priority = PRIORITY[item.priority];
            return (
              <li key={item.id} className="panel animate-rise flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  style={{"--i": index} as CSSProperties}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{item.case_number}</span>
                    {priority && <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", priority.chip)}>{priority.label}</span>}
                  </p>
                  <p className="mt-1 font-semibold wrap-anywhere text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400 wrap-anywhere">
                    Vezető nyomozó: {item.owner_name ?? "nincs"} · Lomtárba helyezte: {item.deleted_by_name ?? "ismeretlen"},{" "}
                    <span title={formatDateTime(item.deleted_at)}>{formatDate(item.deleted_at)}</span>
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5"/> {item.evidence} bizonyíték</span>
                    <span className="inline-flex items-center gap-1"><Users className="size-3.5"/> {item.people} személy</span>
                    <span className="inline-flex items-center gap-1"><Gavel className="size-3.5"/> {item.warrants} parancs</span>
                    <span className={cn("inline-flex items-center gap-1", left <= 3 ? "text-red-300" : "text-amber-200")}>
                      <Hourglass className="size-3.5"/> {left > 0 ? `${left} nap múlva törlődik` : "ma törlődik"}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy === item.id} onClick={() => void restore(item)}
                          className="bg-emerald-600 text-white hover:bg-emerald-500">
                    {busy === item.id ? <Loader2 className="size-4 animate-spin"/> : <Undo2 className="size-4"/>} Visszaállítás
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void purge(item)}
                          className="border-red-500/40 text-red-200 hover:bg-red-500/10">
                    <Trash2 className="size-4"/> Végleges törlés
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
