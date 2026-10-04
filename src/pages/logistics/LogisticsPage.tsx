import * as React from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, Box, Car, CheckCircle2, Clock, Hash, Loader2, Plane, Plus, Ship, Truck, Wrench, XCircle,
} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {PageHeader} from "@/components/layout/PageHeader";
import {StatCard} from "@/components/layout/StatCard";
import {EmptyState} from "@/components/layout/EmptyState";
import {LicensePlate} from "@/components/fleet/LicensePlate";
import {useDialogParam} from "@/lib/use-dialog-param";
import {cn, isHighCommand, isSupervisory} from "@/lib/utils";
import {formatDate} from "@/pages/hr/hr-utils";
import type {VehicleRequest} from "@/types/supabase";
import {NewVehicleRequestDialog} from "./components/NewVehicleRequestDialog";
import {FleetPanel} from "./components/FleetPanel";

const vehicleIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("maverick") || t.includes("helikopter")) return Plane;
  if (t.includes("predator") || t.includes("hajó")) return Ship;
  if (t.includes("vontató") || t.includes("arocs") || t.includes("teher")) return Truck;
  return Car;
};

const STATUS_META = {
  pending: {label: "Függőben", icon: Clock, pill: "bg-amber-500/10 text-amber-300 ring-amber-500/30", bar: "from-amber-300 to-orange-500"},
  approved: {label: "Elfogadva", icon: CheckCircle2, pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", bar: "from-emerald-300 to-teal-600"},
  rejected: {label: "Elutasítva", icon: XCircle, pill: "bg-red-500/10 text-red-300 ring-red-500/30", bar: "from-rose-400 to-red-700"},
} as const;

type Filter = "all" | keyof typeof STATUS_META;

export function LogisticsPage() {
  const {supabase, profile, user} = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "fleet" ? "fleet" : "requests";
  const [requests, setRequests] = React.useState<VehicleRequest[] | null>(null);
  const [isNewOpen, setIsNewOpen] = useDialogParam("new");
  const [filter, setFilter] = React.useState<Filter>("all");

  const [selectedRequest, setSelectedRequest] = React.useState<VehicleRequest | null>(null);
  const [actionType, setActionType] = React.useState<"approve" | "reject" | null>(null);
  const [adminPlate, setAdminPlate] = React.useState("");
  const [adminComment, setAdminComment] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

  const fetchRequests = React.useCallback(async () => {
    const {data, error} = await supabase.from("vehicle_requests")
      .select(`*, profiles!vehicle_requests_user_id_fkey (full_name, badge_number, faction_rank)`)
      .order("created_at", {ascending: false});
    if (error) toast.error("Hiba az adatok betöltésekor");
    setRequests((data as unknown as VehicleRequest[]) || []);
  }, [supabase]);

  React.useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const stats = React.useMemo(() => ({
    all: requests?.length ?? 0,
    pending: requests?.filter((r) => r.status === "pending").length ?? 0,
    approved: requests?.filter((r) => r.status === "approved").length ?? 0,
    rejected: requests?.filter((r) => r.status === "rejected").length ?? 0,
  }), [requests]);

  const filteredRequests = React.useMemo(
    () => (requests ?? []).filter((request) => filter === "all" || request.status === filter),
    [requests, filter],
  );

  const canManage = profile?.system_role === "admin" || isSupervisory(profile) || isHighCommand(profile);

  const setTab = (value: "requests" | "fleet") => {
    const next = new URLSearchParams(searchParams);
    if (value === "fleet") next.set("tab", "fleet"); else next.delete("tab");
    setSearchParams(next, {replace: true});
  };

  const closeAdminDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminPlate("");
    setAdminComment("");
  };

  const handleAdminAction = async () => {
    if (!selectedRequest || !actionType || !user) return;
    if (actionType === "approve" && !adminPlate.trim()) return toast.error("Rendszám megadása kötelező!");
    if (actionType === "reject" && !adminComment.trim()) return toast.error("Indoklás megadása kötelező!");
    setIsProcessing(true);
    const updates: Record<string, string> = {
      status: actionType === "approve" ? "approved" : "rejected",
      processed_by: user.id,
      updated_at: new Date().toISOString(),
      ...(actionType === "approve" ? {vehicle_plate: adminPlate.trim().toUpperCase()} : {admin_comment: adminComment.trim()}),
    };
    // The requester is notified and (on approval) the vehicle is registered by database triggers.
    const {error} = await supabase.from("vehicle_requests").update(updates).eq("id", selectedRequest.id);
    setIsProcessing(false);
    if (error) return toast.error("Hiba", {description: error.message});
    toast.success(actionType === "approve" ? "Igénylés elfogadva, a jármű bekerült a járműparkba." : "Igénylés elutasítva.");
    void fetchRequests();
    closeAdminDialog();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        tone="orange"
        eyebrow="Flotta és ellátás"
        title="Logisztika"
        description={`${stats.pending} igénylés vár elbírálásra · ${stats.approved} jármű kiadva`}
        actions={<Button onClick={() => setIsNewOpen(true)} className="bg-orange-500 text-black hover:bg-orange-400"><Plus/> Új igénylés</Button>}
      />

      <div className="flex gap-1 border-b">
        {([["requests", "Igénylések", Box, stats.pending], ["fleet", "Járműpark", Car, 0]] as const).map(([id, label, Icon, count]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
                  className={cn("relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors",
                    tab === id ? "text-white" : "text-slate-400 hover:text-slate-200")}>
            <Icon className={cn("size-4", tab === id && "text-orange-400")}/>{label}
            {count > 0 && <span className="rounded-full bg-orange-500/15 px-1.5 text-[11px] font-semibold text-orange-300 tabular-nums">{count}</span>}
            {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgb(251_146_60/0.8)]"/>}
          </button>
        ))}
      </div>

      {tab === "fleet" ? (
        <div key="fleet" className="animate-fade"><FleetPanel canManage={canManage}/></div>
      ) : (
        <div key="requests" className="animate-fade space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(["all", "pending", "approved", "rejected"] as Filter[]).map((value, index) => (
              <StatCard key={value} index={index} label={value === "all" ? "Összes igénylés" : STATUS_META[value].label}
                        value={requests === null ? "…" : stats[value]}
                        icon={value === "all" ? Box : STATUS_META[value].icon}
                        tone={value === "all" ? "orange" : value === "pending" ? "gold" : value === "approved" ? "emerald" : "red"}
                        onClick={() => setFilter(value)}
                        className={cn(filter === value && "ring-1 ring-orange-400/50")}/>
            ))}
          </div>

          {requests === null ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-52"/>)}</div>
          ) : filteredRequests.length === 0 ? (
            <div className="panel"><EmptyState icon={Box} title="Nincs megjeleníthető igénylés." compact/></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredRequests.map((request, index) => {
                const meta = STATUS_META[request.status];
                const Icon = vehicleIcon(request.vehicle_type);
                return (
                  <article key={request.id} style={{"--i": Math.min(index, 12)} as React.CSSProperties}
                           className="panel lift animate-rise relative flex flex-col overflow-hidden">
                    <span className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", meta.bar)}/>
                    <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-slate-500">REQ-{request.id.slice(0, 4).toUpperCase()} · {formatDate(request.created_at)}</p>
                        <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-white">
                          <Icon className="size-4 shrink-0 text-orange-400"/><span className="truncate" title={request.vehicle_type}>{request.vehicle_type}</span>
                        </h3>
                      </div>
                      {request.status === "approved" && request.vehicle_plate
                        ? <LicensePlate plate={request.vehicle_plate}/>
                        : <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", meta.pill,
                            request.status === "pending" && "motion-safe:animate-pulse")}><meta.icon className="size-3"/>{meta.label}</span>}
                    </div>
                    <div className="flex-1 space-y-3 px-5 py-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-100">{request.profiles?.full_name}</p>
                          <p className="truncate text-xs text-slate-500">{request.profiles?.faction_rank}</p>
                        </div>
                        <span className="flex items-center gap-1 font-mono text-sm text-orange-300"><Hash className="size-3"/>{request.profiles?.badge_number}</span>
                      </div>
                      <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-300 ring-1 ring-white/5 line-clamp-3 wrap-anywhere">
                        {request.reason}
                      </p>
                      {request.admin_comment && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-red-500/[0.06] px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20 wrap-anywhere">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0"/>{request.admin_comment}
                        </p>
                      )}
                    </div>
                    {canManage && request.status === "pending" && (
                      <div className="grid grid-cols-2 border-t">
                        <button type="button" onClick={() => { setSelectedRequest(request); setActionType("approve"); }}
                                className="flex items-center justify-center gap-2 border-r py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300">
                          <CheckCircle2 className="size-4"/> Jóváhagyás
                        </button>
                        <button type="button" onClick={() => { setSelectedRequest(request); setActionType("reject"); }}
                                className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-300">
                          <XCircle className="size-4"/> Elutasítás
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <NewVehicleRequestDialog open={isNewOpen} onOpenChange={setIsNewOpen} onSuccess={fetchRequests}/>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && closeAdminDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className={cn("size-5", actionType === "approve" ? "text-emerald-400" : "text-red-400")}/>
              {actionType === "approve" ? "Igénylés jóváhagyása" : "Igénylés elutasítása"}
            </DialogTitle>
            <DialogDescription>{selectedRequest?.profiles?.full_name} · {selectedRequest?.vehicle_type}</DialogDescription>
          </DialogHeader>
          {actionType === "approve" ? (
            <div className="space-y-2">
              <Label>Kiosztott rendszám</Label>
              <Input placeholder="Pl. SFSD-01" value={adminPlate} maxLength={16} autoFocus
                     className="h-12 text-center font-mono text-xl tracking-[0.2em] uppercase" onChange={(event) => setAdminPlate(event.target.value)}/>
              <p className="text-xs text-slate-500">A jármű automatikusan bekerül a járműparkba a kérelmező nevére.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Elutasítás indoka</Label>
              <Textarea value={adminComment} rows={3} maxLength={500} autoFocus onChange={(event) => setAdminComment(event.target.value)}/>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdminDialog}>Mégse</Button>
            <Button onClick={() => void handleAdminAction()} disabled={isProcessing}
                    className={actionType === "approve" ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-red-600 text-white hover:bg-red-500"}>
              {isProcessing && <Loader2 className="animate-spin"/>} {actionType === "approve" ? "Jóváhagyás" : "Elutasítás"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
