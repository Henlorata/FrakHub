import {useCallback, useEffect, useMemo, useState} from "react";
import {Gavel, RefreshCw, Search} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {EmptyState} from "@/components/layout/EmptyState";
import {PageHeader} from "@/components/layout/PageHeader";
import {useAuth} from "@/context/AuthContext";
import {useSuspects} from "@/context/SuspectCacheContext";
import {WARRANT_SELECT, WARRANT_TYPE, canApproveWarrants, isMcbLead, mcbApi, warrantTarget, type CaseListItem} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseWarrant, WarrantType} from "@/types/supabase";
import {WarrantActionDialog, WarrantCard, type WarrantAction, type WarrantPermissions} from "./components/WarrantCard";
import {WarrantDocument} from "./components/WarrantDocument";

type View = "pending" | "active" | "closed" | "mine";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Every warrant the reader may see: the approvers' queue, the active ones, the history. */
export function WarrantsPage() {
  const {supabase, profile} = useAuth();
  const {openSuspectId} = useSuspects();
  const [warrants, setWarrants] = useState<CaseWarrant[] | null>(null);
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const canApprove = canApproveWarrants(profile);
  const [view, setView] = useState<View>(canApprove ? "pending" : "active");
  const [type, setType] = useState<WarrantType | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{warrant: CaseWarrant; action: WarrantAction} | null>(null);
  const [documentFor, setDocumentFor] = useState<CaseWarrant | null>(null);

  const load = useCallback(async () => {
    const [{data, error}, list] = await Promise.all([
      supabase.from("case_warrants").select(WARRANT_SELECT).order("created_at", {ascending: false}).limit(300),
      mcbApi.list().catch(() => [] as CaseListItem[]),
    ]);
    if (error) toast.error("A parancsok betöltése nem sikerült.", {description: errorMessage(error)});
    setWarrants((data ?? []) as unknown as CaseWarrant[]);
    setCases(list);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const roles = useMemo(() => new Map(cases.map((item) => [item.id, item])), [cases]);
  const lead = isMcbLead(profile);
  const perms: WarrantPermissions = useMemo(() => ({
    myId: profile?.id,
    canApprove,
    canEditCase: (caseId) => {
      const item = roles.get(caseId);
      return !!item && item.status === "open" && (item.my_role === "owner" || item.my_role === "editor");
    },
    canManageCase: (caseId) => lead || roles.get(caseId)?.my_role === "owner",
  }), [canApprove, lead, profile?.id, roles]);

  const groups = useMemo(() => {
    const list = warrants ?? [];
    return {
      pending: list.filter((item) => item.status === "pending"),
      active: list.filter((item) => item.status === "approved"),
      closed: list.filter((item) => item.status === "executed" || item.status === "rejected" || item.status === "expired"),
      mine: list.filter((item) => item.requested_by === profile?.id),
    };
  }, [profile?.id, warrants]);

  const shown = useMemo(() => {
    const term = fold(query.trim());
    return groups[view].filter((item) => (!type || item.type === type)
      && (!term || [warrantTarget(item), item.reason, item.case?.case_number?.toString() ?? "", item.case?.title ?? "",
        item.requester?.full_name ?? ""].some((value) => fold(value).includes(term))));
  }, [groups, query, type, view]);

  const views: {value: View; label: string; count: number}[] = [
    {value: "pending", label: "Elbírálásra vár", count: groups.pending.length},
    {value: "active", label: "Érvényes", count: groups.active.length},
    {value: "closed", label: "Lezárt", count: groups.closed.length},
    {value: "mine", label: "Saját kérelmeim", count: groups.mine.length},
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Gavel} tone="orange" eyebrow="Elfogató- és házkutatási parancsok" title="Parancsok"
                  description={canApprove ? "Elbírálás, végrehajtás és visszavonás egy helyen. Saját kérelmet nem bírálhatsz el."
                    : "Az általad látható akták parancsai. Kérelmet az akta oldalán nyújthatsz be."}
                  actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4"/> Frissítés</Button>}/>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center" data-tour="warrants-filters">
        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10 xl:w-auto">
          {views.map((item) => (
            <button key={item.value} type="button" onClick={() => setView(item.value)}
                    className={cn("flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                      view === item.value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
              {item.label}
              <span className={cn("rounded-md px-1.5 text-[11px] tabular-nums",
                item.value === "pending" && item.count > 0 ? "bg-amber-500/20 text-amber-200" : "bg-white/10")}>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-9" placeholder="Célpont, indoklás, ügyszám, kérelmező…"/>
        </div>
        <div className="flex gap-1">
          {(["arrest", "search"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setType(type === value ? null : value)}
                    className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm ring-1 transition",
                      type === value ? "bg-white/10 text-white ring-white/20" : "text-slate-400 ring-white/10 hover:text-white")}>
              {(() => {
                const Icon = WARRANT_TYPE[value].icon;
                return <Icon className={cn("size-4", WARRANT_TYPE[value].accent)}/>;
              })()}
              {WARRANT_TYPE[value].short}
            </button>
          ))}
        </div>
      </div>

      {warrants === null ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({length: 6}, (_, index) => <div key={index} className="skeleton h-40 rounded-xl"/>)}
        </div>
      ) : shown.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Gavel} title={view === "pending" ? "Nincs elbírálásra váró kérelem" : "Nincs megjeleníthető parancs"}
                      description={view === "pending" ? "Az új kérelmekről értesítést kapsz." : "Próbálj másik nézetet vagy keresést."}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3" data-tour="warrants-list">
          {shown.map((warrant) => (
            <WarrantCard key={warrant.id} warrant={warrant} perms={perms} showCase onOpenDocument={setDocumentFor}
                         onOpenPerson={openSuspectId} onAction={(entry, next) => setAction({warrant: entry, action: next})}/>
          ))}
        </div>
      )}

      <WarrantActionDialog warrant={action?.warrant ?? null} action={action?.action ?? null} onClose={() => setAction(null)}
                           onDone={(updated) => {
                             setAction(null);
                             setWarrants((list) => (list ?? []).map((entry) => (entry.id === updated.id ? updated : entry)));
                             mcbApi.invalidateList();
                           }}/>
      <WarrantDocument warrant={documentFor} onClose={() => setDocumentFor(null)}/>
    </div>
  );
}
