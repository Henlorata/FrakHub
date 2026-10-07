import {useEffect, useState} from "react";
import type {LucideIcon} from "lucide-react";
import {
  ArrowRightLeft, Boxes, FilePen, FilePlus2, FolderArchive, Gavel, History, Hourglass, ImageMinus, ImagePlus, ListChecks, ListTodo, ListX,
  Loader2, Lock, PackageCheck, Pencil, ShieldPlus, ShieldX, Tag, Trash2, TriangleAlert, Undo2, Unlock, UserMinus, UserPlus, Users,
} from "lucide-react";
import {EmptyState} from "@/components/layout/EmptyState";
import {formatAgo, formatDateTime} from "@/lib/datetime";
import {CATEGORY, COLLABORATOR_ROLE, PRIORITY, WARRANT_TYPE, involvementLook, mcbApi, type CaseEvent} from "@/lib/mcb";
import {cn, errorMessage} from "@/lib/utils";
import type {CaseCategory, CasePriority, WarrantType} from "@/types/supabase";
import {MemberAvatar} from "./McbBadges";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/** Icon, colour and Hungarian sentence of a log entry (the actor's name comes in front). */
export function describeCaseEvent(event: Pick<CaseEvent, "kind" | "details" | "actor_id">): {icon: LucideIcon; tone: string; text: string} {
  const d = event.details ?? {};
  const warrant = WARRANT_TYPE[str(d.type) as WarrantType]?.label.toLowerCase() ?? "parancs";
  switch (event.kind) {
    case "created":
      return {icon: FilePlus2, tone: "text-sky-300 bg-sky-500/10", text: "megnyitotta az aktát"};
    case "status": {
      const to = str(d.to);
      if (to === "closed") return {icon: Lock, tone: "text-slate-300 bg-slate-500/15", text: "lezárta az aktát"};
      if (to === "archived") return {icon: FolderArchive, tone: "text-violet-300 bg-violet-500/10", text: "archiválta az aktát"};
      return {icon: Unlock, tone: "text-emerald-300 bg-emerald-500/10",
        text: str(d.from) === "archived" ? "visszaállította az archívumból" : "újranyitotta az aktát"};
    }
    case "priority":
      return {icon: TriangleAlert, tone: "text-orange-300 bg-orange-500/10",
        text: `prioritás: ${PRIORITY[str(d.from) as CasePriority]?.label ?? str(d.from)} → ${PRIORITY[str(d.to) as CasePriority]?.label ?? str(d.to)}`};
    case "title":
      return {icon: Pencil, tone: "text-slate-300 bg-white/5", text: `átnevezte: „${str(d.from)}” → „${str(d.to)}”`};
    case "category":
      return {icon: Tag, tone: "text-slate-300 bg-white/5",
        text: `ügytípus: ${d.to ? CATEGORY[str(d.to) as CaseCategory]?.label ?? str(d.to) : "nincs megadva"}`};
    case "owner":
      return {icon: ArrowRightLeft, tone: "text-amber-300 bg-amber-500/10",
        text: `átadta az aktát: ${str(d.from_name) || "senki"} → ${str(d.to_name) || "senki"}`};
    case "document": {
      const saves = Number(d.saves ?? 1);
      return {icon: FilePen, tone: "text-sky-300 bg-sky-500/10",
        text: `szerkesztette a dokumentumot${saves > 1 ? ` (${saves} mentés)` : ""}`};
    }
    case "trashed":
      return {icon: Trash2, tone: "text-red-300 bg-red-500/10", text: "a lomtárba helyezte az aktát"};
    case "restored":
      return {icon: Undo2, tone: "text-emerald-300 bg-emerald-500/10", text: "visszaállította az aktát a lomtárból"};
    case "collaborator_added":
      return {icon: UserPlus, tone: "text-sky-300 bg-sky-500/10",
        text: `hozzáadta a csapathoz: ${str(d.name)} (${COLLABORATOR_ROLE[str(d.role) as "editor" | "viewer"]?.label.toLowerCase() ?? str(d.role)})`};
    case "collaborator_removed":
      return {icon: UserMinus, tone: "text-slate-300 bg-white/5",
        text: event.actor_id && event.actor_id === d.user_id ? "kilépett az aktából" : `eltávolította a csapatból: ${str(d.name)}`};
    case "collaborator_role":
      return {icon: Users, tone: "text-slate-300 bg-white/5",
        text: `${str(d.name)} jogosultsága: ${COLLABORATOR_ROLE[str(d.role) as "editor" | "viewer"]?.label.toLowerCase() ?? str(d.role)}`};
    case "evidence_added":
      return {icon: ImagePlus, tone: "text-amber-300 bg-amber-500/10", text: `bizonyítékot csatolt: ${str(d.name)}`};
    case "evidence_renamed":
      return {icon: Pencil, tone: "text-amber-300 bg-amber-500/10", text: `átnevezte a bizonyítékot: ${str(d.from)} → ${str(d.to)}`};
    case "evidence_removed":
      return {icon: ImageMinus, tone: "text-red-300 bg-red-500/10", text: `törölte a bizonyítékot: ${str(d.name)}`};
    case "person_linked":
      return {icon: ShieldPlus, tone: "text-orange-300 bg-orange-500/10",
        text: `csatolta az aktához: ${str(d.name)} (${involvementLook(str(d.role)).label.toLowerCase()})`};
    case "person_updated":
      return {icon: ShieldPlus, tone: "text-orange-300 bg-orange-500/10",
        text: `${str(d.name)} szerepe: ${involvementLook(str(d.from)).label.toLowerCase()} → ${involvementLook(str(d.role)).label.toLowerCase()}`};
    case "person_unlinked":
      return {icon: ShieldX, tone: "text-slate-300 bg-white/5", text: `eltávolította az aktából: ${str(d.name)}`};
    case "warrant_requested":
      return {icon: Gavel, tone: "text-amber-300 bg-amber-500/10", text: `${warrant} kérelmet nyújtott be: ${str(d.target)}`};
    case "warrant_status": {
      const verb = ({approved: "jóváhagyta", rejected: "elutasította", executed: "végrehajtottnak jelölte", expired: "visszavonta"} as Record<string, string>)[str(d.status)] ?? "módosította";
      const tone = str(d.status) === "approved" ? "text-emerald-300 bg-emerald-500/10" : str(d.status) === "rejected" ? "text-red-300 bg-red-500/10"
        : "text-sky-300 bg-sky-500/10";
      return {icon: Gavel, tone, text: `${verb} a(z) ${warrant}t: ${str(d.target)}${d.note ? ` – „${str(d.note)}”` : ""}`};
    }
    case "warrant_renewal_requested":
      return {icon: Hourglass, tone: "text-amber-300 bg-amber-500/10", text: `a(z) ${warrant} megújítását kérte: ${str(d.target)}`};
    case "warrant_renewed":
      return {icon: Hourglass, tone: "text-emerald-300 bg-emerald-500/10", text: `megújította a(z) ${warrant}t: ${str(d.target)}`};
    case "task_added":
      return {icon: ListTodo, tone: "text-sky-300 bg-sky-500/10",
        text: `teendőt vett fel: „${str(d.title)}”${d.assignee ? ` (felelős: ${str(d.assignee)})` : ""}`};
    case "task_done":
      return {icon: ListChecks, tone: "text-emerald-300 bg-emerald-500/10", text: `késznek jelölte: „${str(d.title)}”`};
    case "task_reopened":
      return {icon: ListTodo, tone: "text-slate-300 bg-white/5", text: `újranyitotta a teendőt: „${str(d.title)}”`};
    case "task_removed":
      return {icon: ListX, tone: "text-slate-300 bg-white/5", text: `törölte a teendőt: „${str(d.title)}”`};
    case "item_added":
      return {icon: PackageCheck, tone: "text-amber-300 bg-amber-500/10", text: `lefoglalt tárgyat rögzített: ${str(d.label)}`};
    case "item_custody": {
      const verb = ({moved: "áthelyezte", checked_out: "kiadta", checked_in: "visszavette", returned: "visszaadta a tulajdonosnak",
        destroyed: "megsemmisítette"} as Record<string, string>)[str(d.action)] ?? "módosította";
      return {icon: Boxes, tone: "text-amber-300 bg-amber-500/10", text: `${verb}: ${str(d.label)}`};
    }
    case "item_removed":
      return {icon: Boxes, tone: "text-red-300 bg-red-500/10", text: `törölte a tárgyat: ${str(d.label)}`};
    default:
      return {icon: History, tone: "text-slate-300 bg-white/5", text: "módosította az aktát"};
  }
}

export function CaseTimeline({caseId, refreshKey}: {caseId: string; refreshKey: number}) {
  const [events, setEvents] = useState<CaseEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    mcbApi.events(caseId).then((list) => {
      if (active) setEvents(list);
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    });
    return () => {
      active = false;
    };
  }, [caseId, refreshKey]);

  if (error) return <p className="p-4 text-sm text-red-300">A napló betöltése nem sikerült: {error}</p>;
  if (!events) return <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-slate-500"/></div>;
  if (events.length === 0) return <EmptyState compact icon={History} title="Nincs még bejegyzés" description="Az akta minden változása ide kerül."/>;

  return (
    <ol className="relative space-y-0.5 px-3 py-3">
      <span aria-hidden className="absolute top-5 bottom-5 left-[26px] w-px bg-white/10"/>
      {events.map((event) => {
        const look = describeCaseEvent(event);
        const backfilled = event.details?.backfilled === true;
        return (
          <li key={event.id} className="relative flex gap-3 rounded-lg px-1 py-1.5 hover:bg-white/[0.03]">
            <span className={cn("relative z-10 grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-[#090e1b]", look.tone)}>
              <look.icon className="size-3.5"/>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug text-slate-300 wrap-anywhere">
                {event.actor ? (
                  <span className="inline-flex items-center gap-1 align-middle font-semibold text-white">
                    <MemberAvatar url={event.actor.avatar_url} name={event.actor.full_name} size={16}/>{event.actor.full_name}
                  </span>
                ) : <span className="font-semibold text-slate-400">{backfilled ? "Korábbi adat" : "Rendszer"}</span>}{" "}
                {look.text}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500" title={formatDateTime(event.created_at)}>
                {formatAgo(event.created_at)}{backfilled && " · a régi adatokból"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
