import {useState, type ReactNode} from "react";
import type {LucideIcon} from "lucide-react";
import {
  ArrowRightLeft, AtSign, BadgeCheck, Check, ClipboardList, Crown, FolderOpen, Link2, LogOut, MoreHorizontal, Pencil, Plus,
  ShieldAlert, Trash2, UserPlus, Users, X,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {formatAgo, formatDate, formatDateTime} from "@/lib/datetime";
import {COLLABORATOR_ROLE, INVOLVEMENT, INVOLVEMENTS, involvementLook, type CaseDetail, type DocumentReferences} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {CaseCollaborator, CaseSuspect} from "@/types/supabase";
import {Mugshot, MemberAvatar} from "./McbBadges";

export function RailCard({title, icon: Icon, count, action, children, className, tone = "text-sky-300"}: {
  title: string;
  icon: LucideIcon;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <section className={cn("panel overflow-hidden p-0", className)}>
      <header className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <Icon className={cn("size-4", tone)}/>
        <h3 className="text-xs font-semibold tracking-wider text-slate-300 uppercase">{title}</h3>
        {count !== undefined && <span className="rounded-md bg-white/5 px-1.5 text-[11px] text-slate-400 tabular-nums">{count}</span>}
        <span className="ml-auto"/>
        {action}
      </header>
      {children}
    </section>
  );
}

// --- Summary ---------------------------------------------------------------------

export function SummaryCard({detail, canEdit, onSaveDescription}: {
  detail: CaseDetail;
  canEdit: boolean;
  onSaveDescription: (text: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const item = detail.case;

  const save = async () => {
    setBusy(true);
    const ok = await onSaveDescription(text);
    setBusy(false);
    if (ok) setEditing(false);
  };

  return (
    <RailCard title="Összefoglaló" icon={ClipboardList} action={canEdit && !editing ? (
      <button type="button" onClick={() => {
        setText(item.description ?? "");
        setEditing(true);
      }} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Összefoglaló szerkesztése">
        <Pencil className="size-3.5"/>
      </button>
    ) : undefined}>
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={text} autoFocus rows={5} maxLength={2000} onChange={(event) => setText(event.target.value)}
                      placeholder="Mi történt, mi a nyomozás célja, hol tart az ügy?"/>
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)} disabled={busy}><X className="size-3.5"/> Mégse</Button>
              <Button size="sm" className="h-7 bg-sky-600 text-white hover:bg-sky-500" onClick={() => void save()} disabled={busy}>
                <Check className="size-3.5"/> Mentés
              </Button>
            </div>
          </div>
        ) : item.description ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300 wrap-anywhere">{item.description}</p>
        ) : (
          <p className="text-xs text-slate-500 italic">Nincs összefoglaló.{canEdit && " A ceruzával írhatsz egyet."}</p>
        )}
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-white/5 pt-3 text-xs">
          <dt className="text-slate-500">Megnyitva</dt><dd className="text-right text-slate-300">{formatDate(item.created_at)}</dd>
          {item.closed_at && (<><dt className="text-slate-500">Lezárva</dt><dd className="text-right text-slate-300">{formatDate(item.closed_at)}</dd></>)}
          <dt className="text-slate-500">Utolsó mentés</dt>
          <dd className="truncate text-right text-slate-300" title={formatDateTime(item.updated_at)}>
            {formatAgo(item.updated_at)}{item.body_updated_by_name ? ` · ${item.body_updated_by_name}` : ""}
          </dd>
          <dt className="text-slate-500">Dokumentum</dt>
          <dd className="text-right text-slate-300">{item.body_version > 0 ? `${item.body_version}. mentés` : "eredeti változat"}</dd>
        </dl>
      </div>
    </RailCard>
  );
}

// --- People -----------------------------------------------------------------------

export function PeopleCard({people, canEdit, onAdd, onOpen, onRole, onNotes, onRemove}: {
  people: CaseSuspect[];
  canEdit: boolean;
  onAdd: () => void;
  onOpen: (suspectId: string) => void;
  onRole: (link: CaseSuspect, role: string) => void;
  onNotes: (link: CaseSuspect, notes: string) => Promise<boolean>;
  onRemove: (link: CaseSuspect) => void;
}) {
  const [noteFor, setNoteFor] = useState<{id: string; text: string} | null>(null);
  const order = (value: string) => {
    const index = INVOLVEMENTS.indexOf(value);
    return index < 0 ? 99 : index;
  };
  const sorted = [...people].sort((a, b) => order(a.involvement_type) - order(b.involvement_type));

  return (
    <RailCard title="Érintett személyek" icon={ShieldAlert} tone="text-orange-300" count={people.length}
              action={canEdit ? (
                <button type="button" onClick={onAdd} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Személy csatolása">
                  <Plus className="size-4"/>
                </button>
              ) : undefined}>
      {people.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-slate-500">Még senkit nem csatoltak az aktához.</p>
          {canEdit && <Button size="sm" variant="outline" className="mt-2 h-7" onClick={onAdd}><Plus className="size-3.5"/> Személy csatolása</Button>}
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {sorted.map((link) => {
            const person = link.suspect;
            const look = involvementLook(link.involvement_type);
            return (
              <li key={link.id} className="group relative flex gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                <span className={cn("absolute inset-y-2 left-0 w-0.5 rounded-full", look.bar)}/>
                <button type="button" onClick={() => onOpen(link.suspect_id)} className="shrink-0">
                  <Mugshot url={person?.mugshot_url} name={person?.full_name ?? "?"} status={person?.status} size={38}/>
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpen(link.suspect_id)} className="block max-w-full truncate text-left text-sm font-medium text-white hover:text-orange-200">
                    {person?.full_name ?? "Törölt személy"}
                  </button>
                  <p className="truncate text-[11px] text-slate-500">
                    <span className={cn("font-semibold", look.chip.split(" ").find((value) => value.startsWith("text-")))}>{look.label}</span>
                    {person?.alias ? ` · „${person.alias}”` : ""}
                  </p>
                  {noteFor?.id === link.id ? (
                    <form className="mt-1 flex items-center gap-1" onSubmit={async (event) => {
                      event.preventDefault();
                      if (await onNotes(link, noteFor.text)) setNoteFor(null);
                    }}>
                      <input value={noteFor.text} autoFocus maxLength={300} onChange={(event) => setNoteFor({...noteFor, text: event.target.value})}
                             className="h-7 min-w-0 flex-1 rounded-md bg-white/5 px-2 text-xs text-white ring-1 ring-white/10 outline-none focus:ring-white/25"/>
                      <button type="submit" className="rounded p-1 text-emerald-300 hover:bg-white/10" aria-label="Mentés"><Check className="size-3.5"/></button>
                      <button type="button" onClick={() => setNoteFor(null)} className="rounded p-1 text-slate-400 hover:bg-white/10" aria-label="Mégse">
                        <X className="size-3.5"/>
                      </button>
                    </form>
                  ) : link.notes ? <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 italic wrap-anywhere">{link.notes}</p> : null}
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Műveletek"
                              className="self-start rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus:opacity-100 data-[state=open]:opacity-100">
                        <MoreHorizontal className="size-4"/>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Szerep az ügyben</DropdownMenuLabel>
                      {INVOLVEMENTS.map((value) => (
                        <DropdownMenuItem key={value} onSelect={() => onRole(link, value)}>
                          <span className={cn("size-2 rounded-full", INVOLVEMENT[value].bar)}/>{INVOLVEMENT[value].label}
                          {link.involvement_type === value && <Check className="ml-auto size-3.5"/>}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator/>
                      <DropdownMenuItem onSelect={() => setNoteFor({id: link.id, text: link.notes ?? ""})}><Pencil className="size-4"/> Megjegyzés</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => onRemove(link)}><Trash2 className="size-4"/> Eltávolítás az aktából</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </RailCard>
  );
}

// --- Team -------------------------------------------------------------------------

export function TeamCard({detail, myId, onAdd, onRole, onRemove, onLeave, onTransfer, onOpenMember}: {
  detail: CaseDetail;
  myId: string | undefined;
  onAdd: () => void;
  onRole: (collaborator: CaseCollaborator, role: "editor" | "viewer") => void;
  onRemove: (collaborator: CaseCollaborator) => void;
  onLeave: () => void;
  onTransfer: () => void;
  onOpenMember: (userId: string) => void;
}) {
  const {owner, collaborators, viewer} = detail;
  const manage = viewer.can_manage && detail.case.status !== "archived";
  return (
    <RailCard title="Csapat" icon={Users} count={collaborators.length + (owner ? 1 : 0)}
              action={manage ? (
                <button type="button" onClick={onAdd} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Közreműködő hozzáadása">
                  <UserPlus className="size-4"/>
                </button>
              ) : undefined}>
      <ul className="divide-y divide-white/5">
        <li className="flex items-center gap-3 px-4 py-2.5">
          <button type="button" onClick={() => owner && onOpenMember(owner.id)} className="relative shrink-0">
            <MemberAvatar url={owner?.avatar_url} name={owner?.full_name} size={34}/>
            <Crown className="absolute -top-1.5 -right-1 size-3.5 text-amber-300 drop-shadow"/>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{owner?.full_name ?? "Nincs tulajdonos"}</p>
            <p className="truncate text-[11px] text-amber-200/80">Vezető nyomozó{owner?.division_rank ? ` · ${owner.division_rank}` : ""}</p>
          </div>
          {manage && (
            <button type="button" onClick={onTransfer} title="Akta átadása" className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white">
              <ArrowRightLeft className="size-4"/>
            </button>
          )}
        </li>
        {collaborators.map((collaborator) => (
          <li key={collaborator.id} className="group flex items-center gap-3 px-4 py-2">
            <button type="button" onClick={() => onOpenMember(collaborator.user_id)} className="shrink-0">
              <MemberAvatar url={collaborator.profile?.avatar_url} name={collaborator.profile?.full_name} size={30}/>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-200">{collaborator.profile?.full_name ?? "Ismeretlen"}</p>
              <p className="truncate text-[11px] text-slate-500">{COLLABORATOR_ROLE[collaborator.role]?.label ?? collaborator.role}</p>
            </div>
            {manage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Műveletek"
                          className="rounded-md p-1 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white focus:opacity-100 data-[state=open]:opacity-100">
                    <MoreHorizontal className="size-4"/>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {(["editor", "viewer"] as const).map((role) => (
                    <DropdownMenuItem key={role} onSelect={() => onRole(collaborator, role)}>
                      {role === "editor" ? <Pencil className="size-4"/> : <BadgeCheck className="size-4"/>}{COLLABORATOR_ROLE[role].label}
                      {collaborator.role === role && <Check className="ml-auto size-3.5"/>}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem variant="destructive" onSelect={() => onRemove(collaborator)}><Trash2 className="size-4"/> Eltávolítás</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : collaborator.user_id === myId ? (
              <button type="button" onClick={onLeave} title="Kilépés az aktából" className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white">
                <LogOut className="size-4"/>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {manage && collaborators.length === 0 && (
        <div className="border-t border-white/5 px-4 py-3 text-center">
          <Button size="sm" variant="outline" className="h-7" onClick={onAdd}><UserPlus className="size-3.5"/> Közreműködő hozzáadása</Button>
        </div>
      )}
    </RailCard>
  );
}

// --- References -------------------------------------------------------------------

export function ReferencesCard({refs, linkedSuspectIds, canEdit, onOfficer, onSuspect, onLinkSuspect, onCase}: {
  refs: DocumentReferences;
  linkedSuspectIds: string[];
  canEdit: boolean;
  onOfficer: (id: string) => void;
  onSuspect: (id: string) => void;
  onLinkSuspect: (id: string) => void;
  onCase: (id: string) => void;
}) {
  const total = refs.officers.size + refs.suspects.size + refs.cases.size;
  return (
    <RailCard title="Hivatkozások" icon={AtSign} tone="text-emerald-300" count={total}>
      {total === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-500">A dokumentumban „@” jellel hivatkozhatsz tagokra, személyekre és más aktákra.</p>
      ) : (
        <div className="space-y-3 px-4 py-3">
          {refs.suspects.size > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Személyek</p>
              <div className="flex flex-wrap gap-1.5">
                {[...refs.suspects].map(([id, label]) => (
                  <span key={id} className="inline-flex items-center overflow-hidden rounded-md bg-orange-500/10 text-xs text-orange-200 ring-1 ring-orange-500/25">
                    <button type="button" onClick={() => onSuspect(id)} className="flex items-center gap-1 px-2 py-0.5 hover:bg-orange-500/15">
                      <ShieldAlert className="size-3"/>{label}
                    </button>
                    {canEdit && !linkedSuspectIds.includes(id) && (
                      <button type="button" onClick={() => onLinkSuspect(id)} title="Csatolás az aktához"
                              className="border-l border-orange-500/25 px-1.5 py-0.5 hover:bg-orange-500/20">
                        <Link2 className="size-3"/>
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {canEdit && [...refs.suspects.keys()].some((id) => !linkedSuspectIds.includes(id)) && (
                <p className="mt-1 text-[10px] text-slate-500">A lánc ikonnal csatolhatod az említett, de még nem csatolt személyeket.</p>
              )}
            </div>
          )}
          {refs.officers.size > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Állomány</p>
              <div className="flex flex-wrap gap-1.5">
                {[...refs.officers].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => onOfficer(id)}
                          className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200 ring-1 ring-sky-500/25 hover:bg-sky-500/20">
                    <BadgeCheck className="size-3"/>{label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {refs.cases.size > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Kapcsolódó akták</p>
              <div className="flex flex-wrap gap-1.5">
                {[...refs.cases].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => onCase(id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200 ring-1 ring-emerald-500/25 hover:bg-emerald-500/20">
                    <FolderOpen className="size-3"/>{label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </RailCard>
  );
}
