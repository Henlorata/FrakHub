import {useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {toast} from "sonner";
import {FolderPlus, Link2, Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {iabApi, type IabCaseListItem} from "@/lib/iab";
import {errorMessage} from "@/lib/utils";

/** Attaches a letter to an open investigation, or opens a new one from it (IAB, Bureau Manager). */
export function LinkToCaseDialog({threadId, subject, onOpenChange, onLinked}: {
  threadId: string;
  subject: string;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}) {
  const navigate = useNavigate();
  const [cases, setCases] = useState<IabCaseListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    iabApi.overview().then((overview) => active && setCases(overview.cases.filter((item) => item.status === "open")),
      (error) => active && toast.error(errorMessage(error, "A vizsgálatok nem tölthetők be.")));
    return () => {
      active = false;
    };
  }, []);

  const link = async (caseId: string) => {
    setBusy(caseId);
    try {
      await iabApi.linkMail(caseId, threadId);
      toast.success("A levél a vizsgálathoz került.");
      onLinked();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "A csatolás nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const openNew = async () => {
    setBusy("new");
    try {
      const caseId = await iabApi.saveCase({id: null, title: subject.replace(/^(re:\s*)+/i, "").slice(0, 160) || "Új vizsgálat", summary: null, priority: "normal", lead: null});
      await iabApi.linkMail(caseId, threadId);
      toast.success("Vizsgálat megnyitva, a levél csatolva.");
      navigate(`/iab/case/${caseId}`);
    } catch (error) {
      toast.error(errorMessage(error, "A vizsgálat nem nyitható meg."));
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Csatolás vizsgálathoz</DialogTitle>
          <DialogDescription>A levél a vizsgálat iratai közé kerül; a vizsgálatot a levél többi olvasója nem látja.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" className="justify-start" disabled={!!busy} onClick={() => void openNew()}>
          {busy === "new" ? <Loader2 className="animate-spin"/> : <FolderPlus/>} Új vizsgálat ebből a levélből
        </Button>
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {cases === null ? <div className="skeleton h-14 rounded-lg"/> : cases.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">Nincs nyitott vizsgálat.</p>
          ) : cases.map((item) => (
            <button key={item.id} type="button" disabled={!!busy} onClick={() => void link(item.id)}
                    className="flex w-full min-w-0 items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.06]">
              <span className="font-mono text-xs text-fuchsia-300">{item.case_number}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{item.title}</span>
              {busy === item.id ? <Loader2 className="size-4 animate-spin"/> : <Link2 className="size-4 text-slate-500"/>}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
