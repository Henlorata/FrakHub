import {useCallback, useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {Check, CheckCircle2, Clock, Eye, ImageOff, Loader2, Receipt, Search, Wallet, X, XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {StatCard} from "@/components/layout/StatCard";
import {ImageViewerDialog} from "@/pages/mcb/components/ImageViewerDialog";
import {MemberAvatar} from "./components/MemberAvatar";
import {useAuth} from "@/context/AuthContext";
import {formatDateTime, monthKey} from "@/lib/datetime";
import {financeApi, formatMoney, proofPaths} from "@/lib/finance";
import {cn, errorMessage, isExecutive} from "@/lib/utils";
import type {ReimbursementRequest} from "@/types/finance";
import type {RequestStatus} from "@/types/supabase";

const PAGE_SIZE = 60;
const COLUMNS = "id, user_id, amount, reason, proof_image_path, status, admin_comment, processed_by, created_at, updated_at, proofs_removed_at, "
  + "requester:profiles!budget_requests_user_id_fkey(full_name, badge_number, faction_rank, avatar_url), "
  + "processor:profiles!budget_requests_processed_by_fkey(full_name)";

const STATUS_META: Record<RequestStatus, {label: string; pill: string; bar: string; icon: typeof Clock}> = {
  pending: {label: "Függőben", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30", bar: "bg-amber-400", icon: Clock},
  approved: {label: "Jóváhagyva", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", bar: "bg-emerald-400", icon: CheckCircle2},
  rejected: {label: "Elutasítva", pill: "bg-red-500/10 text-red-300 ring-red-500/30", bar: "bg-red-400", icon: XCircle},
};
const FILTERS: {value: RequestStatus | "all"; label: string}[] = [
  {value: "all", label: "Mind"}, {value: "pending", label: "Függőben"}, {value: "approved", label: "Jóváhagyva"}, {value: "rejected", label: "Elutasítva"},
];

interface ReimbursementsTabProps {
  /** The high command: sees every request and decides them. */
  canDecide: boolean;
  /** Bumped by the page after a new request was sent. */
  reloadKey: number;
  onChanged?: () => void;
}

/** Reimbursement claims: the member's own, or every claim for the high command. */
export function ReimbursementsTab({canDecide, reloadKey, onChanged}: ReimbursementsTabProps) {
  const {supabase, profile, user} = useAuth();
  const [requests, setRequests] = useState<ReimbursementRequest[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [term, setTerm] = useState("");
  const [deciding, setDeciding] = useState<{request: ReimbursementRequest; approve: boolean} | null>(null);
  const [viewer, setViewer] = useState<{url: string; name: string} | null>(null);

  // Every pending request, and the decided ones page by page (newest first).
  const load = useCallback(async () => {
    const [pending, decided] = await Promise.all([
      supabase.from("budget_requests").select(COLUMNS).eq("status", "pending").order("created_at", {ascending: false}),
      supabase.from("budget_requests").select(COLUMNS).neq("status", "pending").order("created_at", {ascending: false})
        .range(0, PAGE_SIZE - 1),
    ]);
    if (pending.error || decided.error) {
      toast.error("A kérelmek betöltése nem sikerült.");
      setRequests((current) => current ?? []);
      return;
    }
    const rows = (decided.data ?? []) as unknown as ReimbursementRequest[];
    setRequests([...(pending.data ?? []) as unknown as ReimbursementRequest[], ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  }, [supabase]);

  const loadMore = async () => {
    const offset = (requests ?? []).filter((request) => request.status !== "pending").length;
    setLoadingMore(true);
    const {data, error} = await supabase.from("budget_requests").select(COLUMNS).neq("status", "pending")
      .order("created_at", {ascending: false}).range(offset, offset + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) return toast.error("A korábbi kérelmek betöltése nem sikerült.");
    const rows = (data ?? []) as unknown as ReimbursementRequest[];
    setRequests((current) => [...(current ?? []), ...rows]);
    setHasMore(rows.length === PAGE_SIZE);
  };

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (requests ?? []).filter((request) => (filter === "all" || request.status === filter)
      && (!needle || request.reason.toLowerCase().includes(needle) || request.requester?.full_name.toLowerCase().includes(needle)
        || request.requester?.badge_number.includes(needle)));
  }, [requests, filter, term]);

  const stats = useMemo(() => {
    const list = requests ?? [];
    const month = monthKey();
    const pending = list.filter((request) => request.status === "pending");
    const approvedThisMonth = list.filter((request) => request.status === "approved" && monthKey(request.updated_at) === month);
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, request) => sum + request.amount, 0),
      monthAmount: approvedThisMonth.reduce((sum, request) => sum + request.amount, 0),
      monthCount: approvedThisMonth.length,
      approvedAmount: list.filter((request) => request.status === "approved").reduce((sum, request) => sum + request.amount, 0),
    };
  }, [requests]);

  const openProof = async (path: string, index: number) => {
    const {data} = await supabase.storage.from("finance_proofs").createSignedUrl(path, 600);
    if (data?.signedUrl) setViewer({url: data.signedUrl, name: `Bizonylat ${index + 1}`});
    else toast.error("A bizonylat nem nyitható meg.");
  };

  const counts = useMemo(() => {
    const list = requests ?? [];
    return {all: list.length, pending: stats.pendingCount, approved: list.filter((r) => r.status === "approved").length,
      rejected: list.filter((r) => r.status === "rejected").length};
  }, [requests, stats.pendingCount]);

  return (
    <div data-tour="reimbursements" className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard index={0} icon={Clock} tone="orange" label={canDecide ? "Elbírálásra vár" : "Függő kérelmeim"}
                  value={formatMoney(stats.pendingAmount)} hint={`${stats.pendingCount} kérelem`}
                  onClick={() => setFilter("pending")}/>
        <StatCard index={1} icon={Wallet} tone="emerald" label="Jóváhagyva ebben a hónapban" value={formatMoney(stats.monthAmount)}
                  hint={`${stats.monthCount} kérelem`}/>
        <StatCard index={2} icon={Receipt} tone="slate" label={canDecide ? "Jóváhagyva összesen (listában)" : "Visszakapott összeg"}
                  value={formatMoney(stats.approvedAmount)}/>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => (
              <button key={option.value} type="button" onClick={() => setFilter(option.value)}
                      className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                        filter === option.value ? "bg-white/10 text-white ring-white/20" : "text-slate-400 ring-transparent hover:bg-white/5 hover:text-slate-200")}>
                {option.label} <span className="ml-0.5 text-slate-500 tabular-nums">{counts[option.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:ml-auto lg:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={canDecide ? "Név, jelvényszám, leírás…" : "Keresés a leírásban…"}
                   className="pl-9"/>
          </div>
        </div>

        {requests === null ? (
          <div className="space-y-2 p-4">{Array.from({length: 4}, (_, index) => <div key={index} className="skeleton h-20"/>)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Receipt} title={requests.length ? "Nincs a szűrésnek megfelelő kérelem." : "Még nincs költségtérítési kérelem."}
                      description={requests.length ? undefined : "Szolgálati kiadásod volt? Az „Új kérelem” gombbal igényelheted vissza."}/>
        ) : (
          <ul className="divide-y divide-white/5">
            {visible.map((request, index) => {
              const meta = STATUS_META[request.status];
              const paths = proofPaths(request.proof_image_path);
              const own = request.user_id === user?.id;
              const mayDecide = canDecide && request.status === "pending" && (!own || isExecutive(profile) || !!profile?.is_bureau_manager);
              return (
                <li key={request.id} style={{"--i": Math.min(index, 12)} as CSSProperties}
                    className="animate-fade relative grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", meta.bar)}/>
                  <div className="flex min-w-0 gap-3">
                    {canDecide && <MemberAvatar name={request.requester?.full_name} avatarUrl={request.requester?.avatar_url} size={40}/>}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-lg font-semibold tabular-nums text-white">{formatMoney(request.amount)}</span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", meta.pill)}>
                          <meta.icon className="size-3"/> {meta.label}
                        </span>
                        {canDecide && request.requester && (
                          <span className="min-w-0 truncate text-sm text-slate-300">
                            {request.requester.full_name} <span className="text-slate-500">· {request.requester.faction_rank} · #{request.requester.badge_number}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 wrap-anywhere">{request.reason}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>Beküldve: {formatDateTime(request.created_at)}</span>
                        {request.status !== "pending" && (
                          <span>{request.status === "approved" ? "Jóváhagyta" : "Elutasította"}: {request.processor?.full_name ?? "–"} · {formatDateTime(request.updated_at)}</span>
                        )}
                      </div>
                      {request.admin_comment && (
                        <p className={cn("rounded-lg px-2.5 py-1.5 text-xs ring-1 wrap-anywhere",
                          request.status === "rejected" ? "bg-red-500/[0.07] text-red-200 ring-red-500/20" : "bg-white/[0.03] text-slate-300 ring-white/10")}>
                          {request.admin_comment}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {paths.map((path, proofIndex) => (
                          <button key={path} type="button" onClick={() => void openProof(path, proofIndex)}
                                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] hover:text-white">
                            <Eye className="size-3"/> Bizonylat {proofIndex + 1}
                          </button>
                        ))}
                        {request.proofs_removed_at && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><ImageOff className="size-3"/> A bizonylatok lejártak és törlődtek</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canDecide && request.status === "pending" && (
                    mayDecide ? (
                      <div className="flex gap-2 md:justify-end">
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                                onClick={() => setDeciding({request, approve: false})}><X/> Elutasítás</Button>
                        <Button size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400"
                                onClick={() => setDeciding({request, approve: true})}><Check/> Jóváhagyás</Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 md:text-right">Saját kérelem: más bírálja el.</p>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="border-t border-white/5 p-3 text-center">
            <Button variant="ghost" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore && <Loader2 className="animate-spin"/>} Korábbi kérelmek
            </Button>
          </div>
        )}
      </div>

      {deciding && (
        <DecideDialog request={deciding.request} approve={deciding.approve} onClose={() => setDeciding(null)}
                      onDone={() => {
                        setDeciding(null);
                        void load();
                        onChanged?.();
                      }}/>
      )}
      <ImageViewerDialog open={!!viewer} onOpenChange={(open) => !open && setViewer(null)} imageUrl={viewer?.url ?? null}
                         fileName={viewer?.name ?? "Bizonylat"}/>
    </div>
  );
}

function DecideDialog({request, approve, onClose, onDone}: {
  request: ReimbursementRequest;
  approve: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!approve && !comment.trim()) return toast.error("Az elutasításhoz indoklás kell.");
    setSaving(true);
    try {
      await financeApi.decide(request.id, approve, comment);
      toast.success(approve ? "Kérelem jóváhagyva." : "Kérelem elutasítva.");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, "A döntés mentése nem sikerült."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle className="flex items-center gap-2">
            {approve ? <CheckCircle2 className="size-4 text-emerald-400"/> : <XCircle className="size-4 text-red-400"/>}
            {approve ? "Jóváhagyás" : "Elutasítás"}
          </DialogTitle>
          <DialogDescription className="mt-1 wrap-anywhere">{request.requester?.full_name ?? "Kérelem"} · {request.reason}</DialogDescription>
        </div>
        <div className={cn("rounded-xl p-4 text-center ring-1", approve ? "bg-emerald-500/[0.07] ring-emerald-500/20" : "bg-red-500/[0.06] ring-red-500/20")}>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{approve ? "Kifizetendő" : "Igényelt összeg"}</p>
          <p className={cn("mt-1 font-mono text-3xl font-semibold tabular-nums", approve ? "text-emerald-300" : "text-slate-300 line-through decoration-red-400/60")}>
            {formatMoney(request.amount)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="decision-comment">{approve ? "Megjegyzés (nem kötelező)" : "Indoklás"}</Label>
          <Textarea id="decision-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000}
                    placeholder={approve ? "pl. Kifizetve a frakciószámláról." : "Miért nem fizethető ki?"} autoFocus/>
          <p className="text-[11px] text-slate-500">A kérelmező értesítést kap a döntésről.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Mégse</Button>
          <Button onClick={() => void submit()} disabled={saving}
                  className={approve ? "bg-emerald-500 text-black hover:bg-emerald-400" : "bg-red-500 text-white hover:bg-red-400"}>
            {saving && <Loader2 className="animate-spin"/>} {approve ? "Jóváhagyás" : "Elutasítás"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
