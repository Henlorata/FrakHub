import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from "react";
import {useNavigate} from "react-router";
import {Car, CornerDownLeft, FolderOpen, Radar, Search, ShieldAlert, User, type LucideIcon} from "lucide-react";
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {getProfileDirectory, type DirectoryProfile} from "@/lib/profile-directory";
import {canViewCaseList, cn} from "@/lib/utils";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {looksLikePlate, patrolApi, type PlateLookup} from "@/lib/patrol";
import {QUICK_ACTIONS} from "@/layouts/quick-actions";
import {EXTRA_PAGES, visibleSections} from "@/layouts/navigation";

interface PaletteEntry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  avatar?: string | null;
  run: () => void;
}

interface CaseHit {
  id: string;
  case_number: string;
  title: string;
  status: string;
}

/** Folds Hungarian accents so "kituntetes" finds "kitüntetés". */
const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Ctrl+K / ⌘K: jump to pages and actions, find members and (for MCB viewers) cases, and look a
 * plate up (BOLO alerts, the department's vehicles, for the case area registered persons).
 * Members come from the cached directory; cases and plates are searched on demand (debounced,
 * a few rows), so the palette costs nothing until it is used.
 */
export function CommandPalette({open, onOpenChange}: {open: boolean; onOpenChange: (open: boolean) => void}) {
  const {profile, supabase} = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [cases, setCases] = useState<CaseHit[]>([]);
  const [plates, setPlates] = useState<PlateLookup | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const canSearchCases = canViewCaseList(profile);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    getProfileDirectory()
      .then((list) => setMembers(list.filter((member) => member.system_role !== "pending")))
      .catch(() => setMembers([]));
  }, [open]);

  // Case search: only with 2+ characters, 250 ms after the last keystroke.
  useEffect(() => {
    const term = query.trim();
    if (!open || !canSearchCases || term.length < 2) {
      setCases([]);
      return;
    }
    const timer = setTimeout(() => {
      const pattern = `%${term.replace(/[%_,()]/g, " ")}%`;
      supabase.from("cases").select("id, case_number, title, status")
        .or(`title.ilike.${pattern},case_number.ilike.${pattern}`)
        .order("updated_at", {ascending: false}).limit(6)
        .then(({data}) => setCases((data ?? []) as CaseHit[]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, canSearchCases, supabase]);

  // A term that looks like a plate (letters and digits): one lookup, 300 ms after the last keystroke.
  useEffect(() => {
    const term = query.trim();
    if (!open || !looksLikePlate(term)) {
      setPlates(null);
      return;
    }
    const timer = setTimeout(() => {
      patrolApi.lookupPlate(term).then(setPlates, () => setPlates(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    if (!profile) return [];
    const go = (path: string) => () => {
      onOpenChange(false);
      navigate(path);
    };
    const term = fold(query.trim());
    const matches = (...values: (string | undefined)[]) => !term || values.some((value) => value && fold(value).includes(term));

    const pages = [...visibleSections(profile).flatMap((section) => section.items), ...EXTRA_PAGES]
      .filter((item) => matches(item.label, item.keywords))
      .map<PaletteEntry>((item) => ({id: `page:${item.path}`, group: "Oldalak", label: item.label, icon: item.icon, run: go(item.path)}));

    const actions = QUICK_ACTIONS.filter((action) => !action.visible || action.visible(profile))
      .filter((action) => matches(action.label, action.keywords))
      .map<PaletteEntry>((action) => ({id: `action:${action.path}`, group: "Műveletek", label: action.label, icon: action.icon, run: go(action.path)}));

    const people = term
      ? members.filter((member) => matches(member.full_name, member.badge_number, member.faction_rank)).slice(0, 6)
        .map<PaletteEntry>((member) => ({
          id: `member:${member.id}`, group: "Állomány", label: member.full_name,
          hint: `#${member.badge_number} · ${member.faction_rank}`, avatar: member.avatar_url, icon: User,
          run: go(`/hr?member=${member.id}`),
        }))
      : [];

    const caseEntries = cases.map<PaletteEntry>((hit) => ({
      id: `case:${hit.id}`, group: "Akták", label: hit.title, hint: hit.case_number, icon: FolderOpen,
      run: go(`/mcb/case/${hit.id}`),
    }));

    const plateEntries: PaletteEntry[] = plates ? [
      ...plates.bolos.map<PaletteEntry>((hit) => ({
        id: `bolo:${hit.id}`, group: "Rendszám", label: `BOLO: ${hit.title}`, icon: Radar,
        hint: [hit.plate, hit.active ? "aktív" : "lezárt"].filter(Boolean).join(" · "), run: go(`/briefing?bolo=${hit.id}`),
      })),
      ...plates.fleet.map<PaletteEntry>((hit) => ({
        id: `fleet:${hit.id}`, group: "Rendszám", label: `${hit.plate} · ${hit.model}`, hint: "SFSD jármű", icon: Car,
        run: go(`/logistics/fleet/${hit.id}`),
      })),
      ...plates.persons.map<PaletteEntry>((hit) => ({
        id: `person:${hit.suspect_id}:${hit.plate}`, group: "Rendszám", label: hit.full_name, icon: ShieldAlert,
        hint: [hit.plate, hit.vehicle, "nyilvántartott"].filter(Boolean).join(" · "), run: go(`/mcb/suspects?person=${hit.suspect_id}`),
      })),
    ] : [];

    return [...plateEntries, ...actions, ...pages, ...people, ...caseEntries];
  }, [profile, query, members, cases, plates, navigate, onOpenChange]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block: "nearest"});
  }, [active]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      entries[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}
                     className="top-[15%] translate-y-0 gap-0 overflow-hidden rounded-2xl border bg-popover p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Gyorskereső</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-slate-500"/>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Oldalak, műveletek, tagok, akták vagy rendszám…"
            className="h-14 flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden rounded-md border bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 sm:block">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nincs találat.</p>
          ) : entries.map((entry, index) => {
            const showGroup = entry.group !== lastGroup;
            lastGroup = entry.group;
            const Icon = entry.icon;
            return (
              <div key={entry.id}>
                {showGroup && (
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{entry.group}</p>
                )}
                <button
                  type="button"
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={entry.run}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    index === active ? "bg-white/[0.06] text-white" : "text-slate-300",
                  )}
                >
                  {entry.avatar ? (
                    <img src={getOptimizedAvatarUrl(entry.avatar, 48) ?? undefined} alt="" className="size-6 rounded-full object-cover"/>
                  ) : Icon ? (
                    <Icon className="size-4 shrink-0 text-slate-400"/>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.hint && <span className="shrink-0 text-xs text-slate-500">{entry.hint}</span>}
                  {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-slate-500"/>}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
