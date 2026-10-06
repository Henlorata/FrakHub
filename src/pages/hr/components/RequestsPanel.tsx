import {useState} from "react";
import {toast} from "sonner";
import {CalendarOff, Check, History, Inbox, Loader2, UserPlus, X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {canManageRecords, errorMessage, getAllowedPromotionRanks, isStaff} from "@/lib/utils";
import {JOIN_TYPE_LABELS, LEAVE_TYPE_META, REHIRE_META} from "@/lib/registry";
import {cn} from "@/lib/utils";
import type {FormerMember, HrRecord, JoinType, Profile} from "@/types/supabase";
import {formatDate} from "../hr-utils";
import type {DetailsPatch, HrMember, MemberChanges} from "../useHrData";
import {findFormerMatch, useFormerMembers} from "./FormerMembersPanel";
import {todayKey} from "@/lib/datetime";

interface RequestsPanelProps {
  viewer: Profile;
  pending: HrMember[];
  members: HrMember[];
  leaveRequests: HrRecord[];
  onApprove: (memberId: string, changes: MemberChanges) => Promise<unknown>;
  onReject: (member: HrMember) => Promise<void>;
  onDecideLeave: (record: HrRecord, approve: boolean) => Promise<boolean>;
  onSaveDetails: (memberId: string, patch: DetailsPatch) => Promise<void>;
}

/** Registrations waiting for approval (returning members are recognised) and leave requests. */
export function RequestsPanel({viewer, pending, members, leaveRequests, onApprove, onReject, onDecideLeave, onSaveDetails}: RequestsPanelProps) {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const {rows: formerRows} = useFormerMembers();

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <UserPlus className="size-4 text-primary"/>
          <h3 className="text-sm font-semibold text-white">Regisztrációk</h3>
          <span className="ml-auto text-xs text-slate-500">{pending.length} várakozik</span>
        </header>
        {pending.length === 0 ? (
          <EmptyState icon={Inbox} title="Nincs jóváhagyásra váró regisztráció." compact/>
        ) : (
          <ul className="divide-y divide-white/5">
            {pending.map((member) => (
              <PendingRow key={member.id} member={member} viewer={viewer} onApprove={onApprove} onReject={onReject}
                          former={findFormerMatch(formerRows, member)} onSaveDetails={onSaveDetails}/>
            ))}
          </ul>
        )}
      </section>

      <section className="panel overflow-hidden">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <CalendarOff className="size-4 text-sky-400"/>
          <h3 className="text-sm font-semibold text-white">Szabadságkérelmek</h3>
          <span className="ml-auto text-xs text-slate-500">{leaveRequests.length} várakozik</span>
        </header>
        {leaveRequests.length === 0 ? (
          <EmptyState icon={CalendarOff} title="Nincs elbírálásra váró szabadságkérelem." compact/>
        ) : (
          <ul className="divide-y divide-white/5">
            {leaveRequests.map((record) => {
              const member = memberById.get(record.user_id);
              const allowed = !!member && canManageRecords(viewer, member);
              return (
                <LeaveRow key={record.id} record={record} member={member} allowed={allowed} onDecide={onDecideLeave}/>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PendingRow({member, viewer, onApprove, onReject, former, onSaveDetails}: {
  member: HrMember; viewer: Profile;
  onApprove: (memberId: string, changes: MemberChanges) => Promise<unknown>;
  onReject: (member: HrMember) => Promise<void>;
  former: FormerMember | null;
  onSaveDetails: (memberId: string, patch: DetailsPatch) => Promise<void>;
}) {
  const [joinType, setJoinType] = useState<JoinType>(former ? "returned" : "new");
  const [recruiter, setRecruiter] = useState(viewer.full_name);
  const allowedRanks = viewer.is_bureau_manager ? null : getAllowedPromotionRanks(viewer);
  const claimedAllowed = !allowedRanks || allowedRanks.includes(member.faction_rank);
  const [rank, setRank] = useState<string>(claimedAllowed ? member.faction_rank : allowedRanks?.at(-1) ?? member.faction_rank);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const rankOptions = allowedRanks ?? null;

  const approve = async () => {
    setBusy("approve");
    try {
      await onApprove(member.id, rank !== member.faction_rank ? {faction_rank: rank} : {});
      toast.success(`${member.full_name} jóváhagyva (${rank}).`);
      // The sheet's "joined / returned" and "recruiter" columns, filled at the moment of approval.
      onSaveDetails(member.id, {joined_on: todayKey(), join_type: joinType, recruited_by: recruiter.trim() || null})
        .catch(() => toast.warning("A csatlakozási adatokat nem sikerült menteni; a Nyilvántartás fülön pótolható."));
    } catch (error) {
      toast.error(errorMessage(error, "A jóváhagyás nem sikerült."));
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy("reject");
    try {
      await onReject(member);
      toast.success("Regisztráció elutasítva.");
    } catch (error) {
      toast.error(errorMessage(error, "Az elutasítás nem sikerült."));
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{member.full_name}</p>
        <p className="text-xs text-slate-500">
          <span className="font-mono">#{member.badge_number}</span> · {member.division} · regisztrált: {formatDate(member.created_at)}
        </p>
        <p className="mt-0.5 text-xs text-amber-300/80">Megadott rang: {member.faction_rank}</p>
        {former && (
          <div className={cn("mt-2 rounded-lg px-3 py-2 text-xs ring-1", REHIRE_META[former.rehire].pill)}>
            <p className="flex items-center gap-1.5 font-semibold"><History className="size-3.5"/> Korábbi tag: {REHIRE_META[former.rehire].label}</p>
            <p className="mt-0.5 opacity-90">
              {former.faction_rank ?? "?"} · {LEAVE_TYPE_META[former.leave_type].label.toLowerCase()} {formatDate(former.left_on)}
              {former.reason && <> · {former.reason}</>}
            </p>
            {former.rehire_note && <p className="mt-0.5 opacity-80">{former.rehire_note}</p>}
          </div>
        )}
        {isStaff(viewer) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={joinType} onValueChange={(value) => setJoinType(value as JoinType)}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                {(Object.keys(JOIN_TYPE_LABELS) as JoinType[]).map((type) => <SelectItem key={type} value={type}>{JOIN_TYPE_LABELS[type]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={recruiter} onChange={(event) => setRecruiter(event.target.value)} maxLength={80}
                   placeholder="Felvételiztető" title="Felvételiztető" className="h-8 w-[180px] text-xs"/>
          </div>
        )}
      </div>
      {isStaff(viewer) && (
        <div className="flex items-center gap-2">
          <Select value={rank} onValueChange={setRank}>
            <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue/></SelectTrigger>
            <SelectContent className="max-h-72">
              {(rankOptions ?? getAllowedPromotionRanks({...viewer, is_bureau_manager: true})).map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon-sm" title="Jóváhagyás" onClick={() => void approve()} disabled={!!busy}
                  className="bg-emerald-600 text-white hover:bg-emerald-500">
            {busy === "approve" ? <Loader2 className="size-4 animate-spin"/> : <Check className="size-4"/>}
          </Button>
          <Button size="icon-sm" variant="outline" title="Elutasítás" onClick={() => void reject()} disabled={!!busy}
                  className="text-red-300">
            {busy === "reject" ? <Loader2 className="size-4 animate-spin"/> : <X className="size-4"/>}
          </Button>
        </div>
      )}
    </li>
  );
}

function LeaveRow({record, member, allowed, onDecide}: {
  record: HrRecord; member: HrMember | undefined; allowed: boolean;
  onDecide: (record: HrRecord, approve: boolean) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    setBusy(true);
    const ok = await onDecide(record, approve);
    if (!ok) setBusy(false);
  };
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{member?.full_name ?? "Ismeretlen tag"}</p>
        <p className="text-xs text-slate-400">{formatDate(record.starts_on)} – {formatDate(record.ends_on)} · {record.title}</p>
        {record.details && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{record.details}</p>}
      </div>
      {allowed ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void decide(true)} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-500">
            <Check/> Jóváhagyás
          </Button>
          <Button size="sm" variant="outline" onClick={() => void decide(false)} disabled={busy} className="text-red-300">
            <X/> Elutasítás
          </Button>
        </div>
      ) : (
        <span className="text-xs text-slate-500">Magasabb rang dönthet róla.</span>
      )}
    </li>
  );
}
