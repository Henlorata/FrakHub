import {useState} from "react";
import {Link} from "react-router";
import {Check, FileSignature, Gavel, Hourglass, Loader2, MapPin, RefreshCw, Undo2, X} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {formatAgo, formatDateTime} from "@/lib/datetime";
import {PROPERTY_TYPE, WARRANT_TYPE, mcbApi, warrantTarget} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseWarrant} from "@/types/supabase";
import {Mugshot, WarrantStatusChip} from "./McbBadges";

/** decide_warrant() statuses, plus asking for and granting a renewal of the validity. */
export type WarrantAction = "approved" | "rejected" | "executed" | "expired" | "renewal" | "renew";

export interface WarrantPermissions {
  myId: string | undefined;
  canApprove: boolean;
  /** Owner/editor of the warrant's case (may record the execution). */
  canEditCase: (caseId: string) => boolean;
  /** Owner of the case or MCB leadership (may withdraw and revoke). */
  canManageCase: (caseId: string) => boolean;
}

/** What the caller may do with a warrant (same rules as decide_warrant()). */
export function warrantActions(warrant: CaseWarrant, perms: WarrantPermissions): WarrantAction[] {
  const actions: WarrantAction[] = [];
  if (warrant.status === "pending") {
    if (perms.canApprove && warrant.requested_by !== perms.myId) actions.push("approved", "rejected");
    if (warrant.requested_by === perms.myId || perms.canManageCase(warrant.case_id)) actions.push("expired");
  } else if (warrant.status === "approved") {
    if (perms.canEditCase(warrant.case_id) || perms.canApprove) actions.push("executed");
    if (perms.canApprove || perms.canManageCase(warrant.case_id)) actions.push("expired");
    if (warrant.expires_at) {
      if (perms.canEditCase(warrant.case_id) && !warrant.renewal_requested_at) actions.push("renewal");
      // Approvers renew a request of someone else, or a warrant that runs out within three days.
      if (perms.canApprove && warrant.renewal_requested_by !== perms.myId
          && (!!warrant.renewal_requested_at || Date.parse(warrant.expires_at) - Date.now() < 3 * 86_400_000)) actions.push("renew");
    }
  }
  return actions;
}

const ACTION_TEXT: Record<WarrantAction, {title: string; button: string; placeholder: string; done: string; className: string}> = {
  approved: {title: "Parancs jóváhagyása", button: "Jóváhagyás", placeholder: "Megjegyzés a jóváhagyáshoz (nem kötelező)",
    done: "Parancs jóváhagyva.", className: "bg-emerald-600 text-white hover:bg-emerald-500"},
  rejected: {title: "Kérelem elutasítása", button: "Elutasítás", placeholder: "Az elutasítás oka (a kérelmező látja)",
    done: "Kérelem elutasítva.", className: "bg-red-600 text-white hover:bg-red-500"},
  executed: {title: "Végrehajtás rögzítése", button: "Végrehajtva", placeholder: "Mikor, hol, milyen eredménnyel (pl. elfogva, lefoglalt tárgyak)",
    done: "Végrehajtás rögzítve.", className: "bg-sky-600 text-white hover:bg-sky-500"},
  expired: {title: "Parancs visszavonása", button: "Visszavonás", placeholder: "A visszavonás oka (nem kötelező)",
    done: "Parancs visszavonva.", className: "bg-slate-600 text-white hover:bg-slate-500"},
  renewal: {title: "Megújítás kérése", button: "Megújítást kérek", placeholder: "Miért kell még (pl. a gyanúsított még szökésben)",
    done: "Megújítás kérve: a jóváhagyók értesítést kaptak.", className: "bg-amber-600 text-white hover:bg-amber-500"},
  renew: {title: "Parancs megújítása", button: "Megújítás", placeholder: "Megjegyzés a megújításhoz (nem kötelező)",
    done: "Parancs megújítva.", className: "bg-emerald-600 text-white hover:bg-emerald-500"},
};

/** Asks for the note of a warrant decision, then calls decide_warrant(). */
export function WarrantActionDialog({warrant, action, onClose, onDone}: {warrant: CaseWarrant | null; action: WarrantAction | null;
  onClose: () => void; onDone: (updated: CaseWarrant) => void}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const text = action ? ACTION_TEXT[action] : null;
  const withdrawing = action === "expired" && warrant?.status === "pending";

  const submit = async () => {
    if (!warrant || !action) return;
    if (action === "rejected" && !note.trim()) return toast.error("Írd le röviden az elutasítás okát.");
    setBusy(true);
    try {
      const updated = action === "renewal" ? await mcbApi.requestRenewal(warrant.id, note.trim() || null)
        : action === "renew" ? await mcbApi.renewWarrant(warrant.id, note.trim() || null)
          : await mcbApi.decideWarrant(warrant.id, action, note.trim() || undefined);
      toast.success(withdrawing ? "Kérelem visszavonva." : text!.done);
      setNote("");
      onDone(updated);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!warrant && !!action} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{withdrawing ? "Kérelem visszavonása" : text?.title}</DialogTitle>
          <DialogDescription>
            {warrant && `${WARRANT_TYPE[warrant.type].label} · ${warrantTarget(warrant)} · ${warrant.case?.case_number ?? ""}`}
          </DialogDescription>
        </DialogHeader>
        {warrant && <p className="rounded-lg bg-white/[0.03] p-3 text-sm text-slate-300 ring-1 ring-white/10 wrap-anywhere">„{warrant.reason}”</p>}
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder={text?.placeholder}/>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={busy} className={text?.className}>
            {busy && <Loader2 className="size-4 animate-spin"/>}{withdrawing ? "Visszavonás" : text?.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WarrantCardProps {
  warrant: CaseWarrant;
  perms: WarrantPermissions;
  showCase?: boolean;
  onAction: (warrant: CaseWarrant, action: WarrantAction) => void;
  onOpenDocument: (warrant: CaseWarrant) => void;
  onOpenPerson?: (suspectId: string) => void;
}

export function WarrantCard({warrant, perms, showCase, onAction, onOpenDocument, onOpenPerson}: WarrantCardProps) {
  const type = WARRANT_TYPE[warrant.type];
  const actions = warrantActions(warrant, perms);
  const own = warrant.requested_by === perms.myId;
  const closed = warrant.status === "rejected" || warrant.status === "expired" || warrant.status === "executed";

  return (
    <article className={cn("relative overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/10 transition hover:ring-white/20",
      warrant.status === "pending" && "ring-amber-500/25", closed && "opacity-80")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", warrant.type === "arrest" ? "bg-red-500/70" : "bg-amber-400/70")}/>
      <div className="flex gap-3 p-3 pl-4">
        {warrant.suspect ? (
          <button type="button" onClick={() => warrant.suspect_id && onOpenPerson?.(warrant.suspect_id)} className="shrink-0">
            <Mugshot url={warrant.suspect.mugshot_url} name={warrant.suspect.full_name} status={warrant.suspect.status} size={44}/>
          </button>
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-400 ring-1 ring-white/10">
            {warrant.type === "search" ? <MapPin className="size-5"/> : <type.icon className="size-5"/>}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("text-[11px] font-semibold tracking-wide uppercase", type.accent)}>{type.label}</span>
            <WarrantStatusChip status={warrant.status}/>
          </div>
          <p className="mt-0.5 truncate text-sm font-semibold text-white" title={warrantTarget(warrant)}>{warrantTarget(warrant)}</p>
          {warrant.property && warrant.suspect && (
            <p className="truncate text-[11px] text-slate-400"><MapPin className="mr-1 inline size-3"/>{warrant.property.address}
              {warrant.property.property_type ? ` · ${PROPERTY_TYPE[warrant.property.property_type] ?? warrant.property.property_type}` : ""}</p>
          )}
          <p className="mt-1 line-clamp-2 text-xs text-slate-300 wrap-anywhere">{warrant.reason}</p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {showCase && warrant.case && (
              <Link to={`/mcb/case/${warrant.case_id}`} className="mr-1 font-mono text-sky-300 hover:underline">{warrant.case.case_number}</Link>
            )}
            Kérte: {warrant.requester?.full_name ?? "–"}{own && " (te)"} · <span title={formatDateTime(warrant.created_at)}>{formatAgo(warrant.created_at)}</span>
            {warrant.approver && warrant.status !== "pending" && warrant.status !== "expired" && <> · {warrant.status === "rejected" ? "Elutasította" : "Jóváhagyta"}: {warrant.approver.full_name}</>}
          </p>
          {warrant.status === "approved" && <Validity warrant={warrant}/>}
          {(warrant.decision_note || warrant.closing_note) && (
            <p className="mt-1 text-[11px] text-slate-400 italic wrap-anywhere">„{warrant.closing_note ?? warrant.decision_note}”</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 bg-black/10 px-3 py-2">
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-slate-300" onClick={() => onOpenDocument(warrant)}>
          <FileSignature className="size-3.5"/> Parancs
        </Button>
        <span className="ml-auto"/>
        {actions.includes("expired") && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-slate-400 hover:text-white" onClick={() => onAction(warrant, "expired")}>
            <Undo2 className="size-3.5"/> Visszavonás
          </Button>
        )}
        {actions.includes("rejected") && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-red-300 hover:bg-red-500/10" onClick={() => onAction(warrant, "rejected")}>
            <X className="size-3.5"/> Elutasítás
          </Button>
        )}
        {actions.includes("approved") && (
          <Button size="sm" className="h-7 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500" onClick={() => onAction(warrant, "approved")}>
            <Check className="size-3.5"/> Jóváhagyás
          </Button>
        )}
        {actions.includes("renewal") && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs text-amber-200 hover:bg-amber-500/10" onClick={() => onAction(warrant, "renewal")}>
            <Hourglass className="size-3.5"/> Megújítás kérése
          </Button>
        )}
        {actions.includes("renew") && (
          <Button size="sm" className="h-7 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500" onClick={() => onAction(warrant, "renew")}>
            <RefreshCw className="size-3.5"/> Megújítás
          </Button>
        )}
        {actions.includes("executed") && (
          <Button size="sm" className="h-7 gap-1.5 bg-sky-600 px-2.5 text-xs text-white hover:bg-sky-500" onClick={() => onAction(warrant, "executed")}>
            <Gavel className="size-3.5"/> Végrehajtva
          </Button>
        )}
        {warrant.status === "pending" && own && !actions.includes("approved") && (
          <span className="text-[11px] text-slate-500">Bírálatra vár</span>
        )}
      </div>
    </article>
  );
}

/** The validity of an approved warrant and an open renewal request. */
function Validity({warrant}: {warrant: CaseWarrant}) {
  if (!warrant.expires_at) return <p className="mt-1 text-[11px] text-slate-500">Visszavonásig érvényes</p>;
  const left = Date.parse(warrant.expires_at) - Date.now();
  const soon = left < 2 * 86_400_000;
  // Rounded, so a warrant approved just now for 14 days reads "még 14 nap", not 13.
  const remaining = left <= 0 ? "lejárt"
    : left >= 86_400_000 ? `még ${Math.round(left / 86_400_000)} nap`
      : left >= 3_600_000 ? `még ${Math.round(left / 3_600_000)} óra`
        : `még ${Math.max(1, Math.round(left / 60_000))} perc`;
  return (
    <div className="mt-1.5 space-y-1">
      <p className={cn("inline-flex flex-wrap items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ring-1",
        soon ? "bg-amber-500/10 text-amber-200 ring-amber-500/25" : "bg-white/[0.04] text-slate-300 ring-white/10")}>
        <Hourglass className="size-3"/> Érvényes: {formatDateTime(warrant.expires_at)}
        <span className="text-slate-400">({remaining})</span>
        {!!warrant.renewals && <span className="text-slate-500">· {warrant.renewals}× megújítva</span>}
      </p>
      {warrant.renewal_requested_at && (
        <p className="text-[11px] wrap-anywhere text-amber-200/90">
          Megújítást kért{warrant.renewal_requester_name ? `: ${warrant.renewal_requester_name}` : "ek"} · {formatAgo(warrant.renewal_requested_at)}
          {warrant.renewal_note ? ` – „${warrant.renewal_note}”` : ""}
        </p>
      )}
    </div>
  );
}
