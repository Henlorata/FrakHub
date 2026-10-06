import {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {ExternalLink, FolderOpen, Loader2, Lock} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {formatAgo, formatDate} from "@/lib/datetime";
import {mcbApi, type CaseListItem} from "@/lib/mcb";
import {CaseStatusChip, CategoryChip, MemberAvatar, PriorityChip} from "./McbBadges";

/** Preview of a case referenced with "@" (from the cached case list: no extra query). */
export function LinkedCaseDialog({caseId, onClose}: {caseId: string | null; onClose: () => void}) {
  const navigate = useNavigate();
  const [item, setItem] = useState<CaseListItem | null | undefined>(undefined);

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    setItem(undefined);
    mcbApi.list().then(async (list) => {
      const found = list.find((entry) => entry.id === caseId)
        ?? (await mcbApi.listArchived().catch(() => [] as CaseListItem[])).find((entry) => entry.id === caseId);
      if (active) setItem(found ?? null);
    }).catch(() => active && setItem(null));
    return () => {
      active = false;
    };
  }, [caseId]);

  return (
    <Dialog open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderOpen className="size-5 text-emerald-300"/> Kapcsolódó akta</DialogTitle>
          <DialogDescription>Hivatkozás a dokumentumból.</DialogDescription>
        </DialogHeader>
        {item === undefined ? (
          <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
        ) : item === null ? (
          <p className="rounded-xl bg-white/[0.03] p-4 text-sm text-slate-400 ring-1 ring-white/10">
            Az akta nem érhető el: törölték, vagy nincs hozzáférésed.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-sky-300">{item.case_number}</span>
              <CaseStatusChip status={item.status}/>
              <PriorityChip priority={item.priority}/>
              <CategoryChip category={item.category}/>
            </div>
            <h3 className="text-lg font-semibold text-white wrap-anywhere">{item.title}</h3>
            {item.description && <p className="text-sm text-slate-300 wrap-anywhere">{item.description}</p>}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MemberAvatar url={item.owner_avatar} name={item.owner_name} size={22}/>
              <span>{item.owner_name ?? "Nincs tulajdonos"}</span>
              <span>· megnyitva {formatDate(item.created_at)} · frissítve {formatAgo(item.updated_at)}</span>
            </div>
            {!item.can_open && (
              <p className="flex items-center gap-1.5 text-xs text-amber-200"><Lock className="size-3.5"/> Megnyitni a tulajdonos, a közreműködők és az MCB vezetése tudja.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Bezárás</Button>
          {item?.can_open && (
            <Button className="bg-sky-600 text-white hover:bg-sky-500" onClick={() => {
              onClose();
              navigate(`/mcb/case/${item.id}`);
            }}>
              <ExternalLink className="size-4"/> Megnyitás
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
