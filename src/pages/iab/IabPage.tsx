import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {Link, useNavigate} from "react-router";
import {toast} from "sonner";
import {FolderOpen, Inbox, Loader2, Mail, Plus, Scale, Search, ShieldCheck, Trash2, UserPlus} from "lucide-react";
import {PageHeader} from "@/components/layout/PageHeader";
import {EmptyState} from "@/components/layout/EmptyState";
import {StatCard} from "@/components/layout/StatCard";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatAgo} from "@/lib/datetime";
import {IAB_OUTCOMES, IAB_PRIORITY, IAB_ROLES, IAB_TITLE_ORDER, IAB_TITLES, iabApi, readsIabMail, type IabOverview, type IabTitle} from "@/lib/iab";
import {useProfileDirectory} from "@/lib/profile-directory";
import {cn, errorMessage} from "@/lib/utils";
import {CaseDialog} from "./components/CaseDialog";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * The Internal Affairs Bureau's office: investigations (open first), the bureau's staff with its own
 * titles, and the way to its mailbox. IAB members and the Bureau Manager.
 */
export function IabPage() {
  const navigate = useNavigate();
  const {profile} = useAuth();
  const [data, setData] = useState<IabOverview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => iabApi.overview().then((next) => {
    setData(next);
    setFailed(null);
  }, (error) => setFailed(errorMessage(error, "A vizsgálatok nem tölthetők be.")));

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const needle = fold(term.trim());
    return (data?.cases ?? []).filter((item) => (status === "all" || item.status === status)
      && (!needle || fold(`${item.case_number} ${item.title} ${item.people.map((person) => person.full_name).join(" ")}`).includes(needle)));
  }, [data, status, term]);

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-3xl pt-10">
        <div className="panel"><EmptyState icon={Scale} title={failed} description="Az oldalt az Internal Affairs Bureau tagjai és a Bureau Manager látják."/></div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 pb-10">
      <PageHeader icon={Scale} tone="fuchsia" eyebrow="Internal Affairs Bureau" title="Belső vizsgálatok"
                  description="Panaszok és szolgálati ügyek kivizsgálása. A vizsgált tag a saját ügyét nem látja."
                  actions={(
                    <>
                      {data && readsIabMail(data, profile) && (
                        <Button variant="outline" asChild><Link to="/mail?box=iab"><Inbox/> IAB postafiók</Link></Button>
                      )}
                      <Button className="bg-fuchsia-600 text-white hover:bg-fuchsia-500" onClick={() => setCreating(true)}><Plus/> Új vizsgálat</Button>
                    </>
                  )}/>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} icon={FolderOpen} tone="violet" label="Nyitott vizsgálat" value={data ? data.stats.open : "…"}/>
        <StatCard index={1} icon={ShieldCheck} tone="emerald" label="Lezárva (90 nap)" value={data ? data.stats.closed_90d : "…"}/>
        <StatCard index={2} icon={Mail} tone="blue" label="Olvasatlan levél az IAB-nak" value={data ? data.stats.inbox_unread : "…"}/>
        <StatCard index={3} icon={Scale} tone="gold" label="Az IAB állománya" value={data ? data.members.length : "…"}/>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4" data-tour="iab-cases">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
              <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Ügyszám, cím vagy név…" className="pl-9"/>
            </div>
            <div className="inline-flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Állapot">
              {([["open", "Nyitott"], ["closed", "Lezárt"], ["all", "Mind"]] as const).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => setStatus(value)}
                        className={cn("h-8 rounded-md px-3 text-xs font-medium transition-colors",
                          status === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>{label}</button>
              ))}
            </div>
          </div>
          {data === null ? (
            <div className="space-y-3">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-28 rounded-2xl"/>)}</div>
          ) : shown.length === 0 ? (
            <div className="panel"><EmptyState icon={Scale} title={data.cases.length ? "Nincs a szűrésnek megfelelő vizsgálat" : "Még nincs belső vizsgálat"}
                                                description="Egy panaszlevélből a Levelezésben egy kattintással vizsgálat nyitható."/></div>
          ) : (
            <ul className="space-y-3">
              {shown.map((item, index) => {
                const outcome = item.outcome ? IAB_OUTCOMES[item.outcome] : null;
                return (
                  <li key={item.id} style={{"--i": index} as CSSProperties} className="animate-rise">
                    <Link to={`/iab/case/${item.id}`} className="panel lift group relative flex min-w-0 flex-col gap-3 overflow-hidden p-5">
                      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", item.status === "open" ? "bg-fuchsia-500/70" : "bg-white/10")}/>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-fuchsia-300">{item.case_number}</span>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", IAB_PRIORITY[item.priority].chip)}>{IAB_PRIORITY[item.priority].label}</span>
                        {outcome ? (
                          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", outcome.tone)}>
                            <outcome.icon className="size-3"/> {outcome.label}
                          </span>
                        ) : <span className="rounded-md bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/30">Folyamatban</span>}
                        <span className="ml-auto text-[11px] text-slate-500">{formatAgo(item.updated_at)}</span>
                      </div>
                      <h3 className="text-base font-semibold wrap-anywhere text-white group-hover:text-fuchsia-100">{item.title}</h3>
                      {item.summary && <p className="line-clamp-2 text-sm text-slate-400">{item.summary}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {item.people.map((person) => (
                          <span key={person.user_id} className={cn("rounded-md px-1.5 py-0.5 ring-1", IAB_ROLES[person.role].chip)}>
                            {IAB_ROLES[person.role].label}: {person.full_name}
                          </span>
                        ))}
                        <span className="ml-auto text-slate-500">
                          {item.lead ? `Vezeti: ${item.lead.full_name}` : "Nincs kijelölt vezető"} · {item.entries} bejegyzés · {item.mail} levél
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <StaffPanel data={data} onChanged={() => void load()}/>
      </div>

      {creating && data && (
        <CaseDialog members={data.members} onOpenChange={setCreating} onSaved={(id) => navigate(`/iab/case/${id}`)}/>
      )}
    </div>
  );
}

function StaffPanel({data, onChanged}: {data: IabOverview | null; onChanged: () => void}) {
  const {profiles: directory} = useProfileDirectory();
  const confirm = useConfirm();
  const [user, setUser] = useState("");
  const [title, setTitle] = useState<IabTitle>("agent");
  const [busy, setBusy] = useState<string | null>(null);
  const canManage = !!data?.viewer.is_lead;
  const candidates = directory.filter((member) => !data?.members.some((item) => item.id === member.id));

  const save = async (userId: string, next: IabTitle | null) => {
    setBusy(userId);
    try {
      await iabApi.setTitle(userId, next);
      toast.success(next ? "Az IAB állománya frissült." : "Kikerült az IAB állományából.");
      setUser("");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!(await confirm({title: `${name} kikerül az IAB-ból?`, description: "A vizsgálatokat és az IAB postafiókját ezután nem látja.", confirmLabel: "Eltávolítás", destructive: true}))) return;
    await save(userId, null);
  };

  return (
    <aside className="panel space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Az IAB állománya</h2>
        <p className="text-xs text-slate-500">Az IAB levelei alatt ez a névsor szerepel.</p>
      </div>
      {data === null ? <div className="skeleton h-32 rounded-xl"/> : data.members.length === 0 ? (
        <p className="text-sm text-slate-500">Még nincs tagja. {canManage ? "Vedd fel az elsőket lent." : ""}</p>
      ) : (
        <ul className="space-y-2">
          {data.members.map((member) => (
            <li key={member.id} className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 ring-1 ring-white/10">
                <AvatarImage src={getOptimizedAvatarUrl(member.avatar_url, 72) || ""} className="object-cover"/>
                <AvatarFallback className="bg-slate-900 text-xs">{member.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{member.full_name}</p>
                <p className="truncate text-[11px] text-slate-500">{member.faction_rank}</p>
              </div>
              {canManage ? (
                <Select value={member.iab_title ?? "agent"} onValueChange={(value) => void save(member.id, value as IabTitle)} disabled={busy === member.id}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>{IAB_TITLE_ORDER.map((key) => <SelectItem key={key} value={key}>{IAB_TITLES[key]}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <span className="rounded-md bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200 ring-1 ring-fuchsia-500/25">
                  {member.iab_title ? IAB_TITLES[member.iab_title] : ""}
                </span>
              )}
              {canManage && (
                <Button size="icon-sm" variant="ghost" aria-label={`${member.full_name} eltávolítása`} onClick={() => void remove(member.id, member.full_name)}>
                  {busy === member.id ? <Loader2 className="animate-spin"/> : <Trash2/>}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <div className="space-y-2 border-t border-white/5 pt-4">
          <p className="text-xs font-medium text-slate-300">Új tag</p>
          <Select value={user} onValueChange={setUser}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Válassz tagot…"/></SelectTrigger>
            <SelectContent>{candidates.map((member) => <SelectItem key={member.id} value={member.id}><span className="truncate">{member.full_name} · {member.faction_rank}</span></SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={title} onValueChange={(value) => setTitle(value as IabTitle)}>
              <SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue/></SelectTrigger>
              <SelectContent>{IAB_TITLE_ORDER.map((key) => <SelectItem key={key} value={key}>{IAB_TITLES[key]}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!user || !!busy} onClick={() => void save(user, title)}><UserPlus/> Felvétel</Button>
          </div>
          <p className="text-[11px] text-slate-500">Az állományt az IAB Sheriffje és Assistant Sheriffje, a Bureau Manager és az Executive Staff kezeli.</p>
        </div>
      )}
    </aside>
  );
}
