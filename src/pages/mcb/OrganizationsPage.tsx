import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate} from "react-router";
import {FolderOpen, Gavel, MapPin, Network, Plus, Search, Users} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {formatAgo} from "@/lib/datetime";
import {ORG_KINDS, ORG_STATUS, ORG_THREAT, organizationsApi, type OrganizationListItem, type OrgStatus} from "@/lib/organizations";
import {cn} from "@/lib/utils";
import {OrganizationDialog} from "./components/OrganizationDialog";
import {OrgEmblem} from "./components/OrgEmblem";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * The MCB's register of crime organisations: gangs, crews and cartels at a glance (threat, members,
 * open cases, wanted members, the latest intelligence). One call; the members, cases and warrants
 * come from the person register.
 */
export function OrganizationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OrganizationListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<OrgStatus | "all">("active");
  const [creating, setCreating] = useState(false);

  const load = () => organizationsApi.list().then((list) => {
    setItems(list ?? []);
    setFailed(false);
  }, () => setFailed(true));

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const needle = fold(term.trim());
    return (items ?? []).filter((item) => (status === "all" || item.status === status)
      && (!needle || fold(`${item.name} ${item.territory ?? ""} ${item.leaders.join(" ")}`).includes(needle)));
  }, [items, term, status]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 pb-10">
      <PageHeader icon={Network} tone="violet" eyebrow="Bandák, bűnbandák, kartellek" title="Bűnszervezetek"
                  description="Szervezetek a tagjaikkal, területükkel és a hírszerzési naplóval; az akták és a parancsok a tagokból jönnek."
                  actions={<Button className="bg-violet-600 text-white hover:bg-violet-500" onClick={() => setCreating(true)}><Plus/> Új szervezet</Button>}/>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Név, terület vagy vezető…" className="pl-9"/>
        </div>
        <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Állapot">
          {([["active", "Aktív"], ["dormant", "Szunnyadó"], ["dismantled", "Felszámolva"], ["all", "Mind"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
                    className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                      status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <div className="panel"><EmptyState icon={Network} title="A szervezetek nem tölthetők be"/></div>
      ) : items === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-52 rounded-2xl"/>)}</div>
      ) : shown.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Network} title={items.length ? "Nincs a szűrésnek megfelelő szervezet" : "Még nincs nyilvántartott szervezet"}
                      description="Vedd fel az első bandát, és rendeld hozzá a nyilvántartott személyeket."
                      action={<Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus/> Új szervezet</Button>}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((item, index) => (
            <Link key={item.id} to={`/mcb/organizations/${item.id}`} style={{"--i": index} as CSSProperties}
                  className="panel lift animate-rise group relative flex min-w-0 flex-col overflow-hidden">
              <span aria-hidden className="h-1.5 w-full" style={{background: item.color ?? "#475569"}}/>
              <div className="flex min-w-0 gap-4 p-5">
                <OrgEmblem name={item.name} color={item.color} logoUrl={item.logo_url} kind={item.kind} size={56}/>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-white group-hover:text-violet-100">{item.name}</h2>
                  <p className="text-xs text-slate-400">{ORG_KINDS[item.kind].label}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold ring-1", ORG_THREAT[item.threat].chip)}>
                      {ORG_THREAT[item.threat].label} veszély
                    </span>
                    <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold ring-1", ORG_STATUS[item.status].chip)}>
                      {ORG_STATUS[item.status].label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-white/5 text-center">
                <Count icon={Users} value={item.members} label="tag"/>
                <Count icon={FolderOpen} value={item.open_cases} label="nyitott akta"/>
                <Count icon={Gavel} value={item.wanted} label="körözött"/>
              </div>
              <div className="mt-auto space-y-1 border-t border-white/5 px-5 py-3 text-[11px] text-slate-400">
                {item.leaders.length > 0 && <p className="truncate"><span className="text-slate-500">Vezető:</span> {item.leaders.join(", ")}</p>}
                {item.territory && <p className="flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0"/><span className="truncate">{item.territory}</span></p>}
                <p className="text-slate-500">{item.last_note_at ? `Utolsó hírszerzés ${formatAgo(item.last_note_at)}` : "Még nincs hírszerzési bejegyzés"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <OrganizationDialog open={creating} editing={null} onOpenChange={setCreating} onSaved={(id) => navigate(`/mcb/organizations/${id}`)}/>
    </div>
  );
}

function Count({icon: Icon, value, label}: {icon: typeof Users; value: number; label: string}) {
  return (
    <div className="px-2 py-3">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[10px] text-slate-500"><Icon className="size-3"/>{label}</p>
    </div>
  );
}
