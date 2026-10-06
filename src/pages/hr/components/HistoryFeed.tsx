import {useEffect, useMemo, useState} from "react";
import {History, Loader2} from "lucide-react";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import type {MemberEvent} from "@/types/supabase";
import {formatDate} from "../hr-utils";
import {describeEvent, eventTone} from "./MemberSheet";
import type {HrMember} from "../useHrData";

const FILTERS: {value: string; label: string; kinds: MemberEvent["kind"][] | null}[] = [
  {value: "all", label: "Minden változás", kinds: null},
  {value: "rank", label: "Előléptetések, lefokozások", kinds: ["rank"]},
  {value: "joined", label: "Új tagok", kinds: ["joined"]},
  {value: "division", label: "Osztály és képesítés", kinds: ["division", "division_rank", "qualifications", "bureau_role"]},
  {value: "award", label: "Kitüntetések", kinds: ["award", "award_revoked"]},
];

/** The latest changes across the whole roster (member_events), newest first. */
export function HistoryFeed({members, onOpenMember}: {members: HrMember[]; onOpenMember: (member: HrMember) => void}) {
  const {supabase} = useAuth();
  const [events, setEvents] = useState<MemberEvent[] | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const kinds = FILTERS.find((item) => item.value === filter)?.kinds;
    let query = supabase.from("member_events").select("*").order("created_at", {ascending: false}).limit(80);
    if (kinds) query = query.in("kind", kinds);
    query.then(({data}) => {
      if (active) setEvents((data ?? []) as MemberEvent[]);
    });
    return () => {
      active = false;
    };
  }, [supabase, filter]);

  const byId = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
        <History className="size-4 text-primary"/>
        <h3 className="text-sm font-semibold text-white">Állományváltozások</h3>
        <Select value={filter} onValueChange={(value) => {
          setEvents(null);
          setFilter(value);
        }}>
          <SelectTrigger className="ml-auto h-8 w-[230px] text-xs"><SelectValue/></SelectTrigger>
          <SelectContent>
            {FILTERS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>
      {!events ? (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-primary/70"/></div>
      ) : events.length === 0 ? (
        <EmptyState icon={History} title="Nincs rögzített változás." compact/>
      ) : (
        <ul className="divide-y divide-white/5">
          {events.map((event) => {
            const member = byId.get(event.user_id);
            const actor = event.actor_id ? byId.get(event.actor_id) : null;
            const label = event.kind === "rank"
              ? (event.detail === "promotion" ? "előléptetve" : "lefokozva")
              : {
                joined: "csatlakozott", division: "osztályt váltott", division_rank: "új alosztály rang",
                qualifications: "képesítés változás", bureau_role: "vezetői kinevezés", name: "névváltozás",
                badge: "új jelvényszám", award: "kitüntetést kapott", award_revoked: "kitüntetés visszavonva", rank: "",
              }[event.kind];
            return (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", eventTone(event))}/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">
                    {member ? (
                      <button type="button" className="font-medium text-white hover:text-primary" onClick={() => onOpenMember(member)}>
                        {member.full_name}
                      </button>
                    ) : <span className="font-medium text-slate-400">Volt tag</span>}
                    {" "}<span className="text-slate-400">{label}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {describeEvent(event)}
                    {actor && actor.id !== event.user_id && ` · ${actor.full_name}`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(event.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
