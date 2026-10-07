import {useState, type CSSProperties} from "react";
import {useNavigate} from "react-router";
import {ArrowDown, ArrowUp, LayoutGrid, Plus, RotateCcw, Settings2, User, X, type LucideIcon} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {EmptyState} from "@/components/layout/EmptyState";
import {TONE_CLASSES, type Tone} from "@/components/layout/PageHeader";
import {visibleSections} from "@/layouts/navigation";
import {QUICK_ACTIONS} from "@/layouts/quick-actions";
import {cn} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

/** A tile of the dashboard's quick access: a page of the menu or a quick action (its path is its id). */
export interface QuickTile {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  /** The menu group, or "Gyorsműveletek". */
  group: string;
}

const ACTIONS_GROUP = "Gyorsműveletek";

/** How each page and action looks as a tile; anything new in the menu gets a plain one. */
const TILE_LOOK: Record<string, {hint: string; tone: Tone; label?: string}> = {
  "/briefing": {hint: "BOLO, körözött személyek", tone: "red"},
  "/notifications": {hint: "Minden értesítésed", tone: "blue"},
  "/mail": {hint: "Levelek, csoportcímek", tone: "indigo"},
  "/events": {hint: "Gyűlések, képzések", tone: "gold"},
  "/stats": {hint: "Bírságok, letartóztatások", tone: "violet"},
  "/mcb": {hint: "Akták, körözések", tone: "blue"},
  "/logistics": {hint: "Járművek, flotta", tone: "orange"},
  "/finance": {hint: "Költségtérítés, fizetés", tone: "emerald"},
  "/academy": {hint: "Tananyagok", tone: "cyan"},
  "/exams": {hint: "Vizsgák, javítás", tone: "violet"},
  "/practice": {hint: "Kódok, Btk., szituációk", tone: "cyan"},
  "/calculator": {hint: "Büntető törvénykönyv", tone: "red", label: "Kalkulátor"},
  "/reports": {hint: "Fórum-jelentés, napló", tone: "slate"},
  "/codes": {hint: "Rádiókódok, hívójel", tone: "cyan"},
  "/policies": {hint: "Szabályok, kötelező olvasmány", tone: "emerald"},
  "/community": {hint: "Szavazás, ötletek", tone: "violet"},
  "/leaderboard": {hint: "A hónap legjobbjai", tone: "gold"},
  "/sib": {hint: "Hírek, nyilvános oldal", tone: "orange"},
  "/hr": {hint: "Állomány, duty idő", tone: "gold"},
  "/iab": {hint: "Panaszok, vizsgálatok", tone: "fuchsia"},
  "/permissions": {hint: "Jogosultságok", tone: "slate"},
  "/profile": {hint: "Adatok, képzések, szabadság", tone: "slate"},
  "/briefing?new=bolo": {hint: "Körözés kiadása", tone: "red", label: "Új BOLO"},
  "/mail?new=1": {hint: "Levél írása", tone: "indigo"},
  "/mcb?new=case": {hint: "Ügy megnyitása", tone: "blue", label: "Új akta"},
  "/logistics?new=1": {hint: "Jármű kérése", tone: "orange"},
  "/finance?new=1": {hint: "Kérelem beadása", tone: "emerald", label: "Költségtérítés"},
  "/profile?leave=1": {hint: "Távollét bejelentése", tone: "cyan"},
  "/events?new=1": {hint: "Esemény szervezése", tone: "gold"},
};

/** What the dashboard showed before it could be chosen (and still shows until the member changes it). */
export const DEFAULT_TILES = [
  "/mcb", "/logistics", "/finance", "/exams", "/academy", "/calculator", "/reports", "/events", "/codes", "/hr", "/practice",
  "/policies", "/community",
];

const tile = (id: string, label: string, icon: LucideIcon, group: string): QuickTile => {
  const look = TILE_LOOK[id];
  return {id, label: look?.label ?? label, hint: look?.hint ?? "", icon, tone: look?.tone ?? "slate", group};
};

/** Every tile the member may use: the menu's pages (by group), the profile and the quick actions. */
export function quickTiles(profile: Profile): QuickTile[] {
  const pages = visibleSections(profile).flatMap((section) => section.items
    .filter((item) => item.path !== "/dashboard")
    .map((item) => tile(item.path, item.label, item.icon, section.label)));
  const actions = QUICK_ACTIONS.filter((action) => !action.visible || action.visible(profile))
    .map((action) => tile(action.path, action.label, action.icon, ACTIONS_GROUP));
  return [...pages, tile("/profile", "Profilom", User, "Saját"), ...actions];
}

const storageKey = (userId: string) => `frakhub.dashboard.tiles.${userId}`;

/** The member's own choice in this browser, or null for the default set. */
function readChoice(userId: string): string[] | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/** The dashboard's quick access: the member picks the tiles and their order (kept in this browser). */
export function QuickAccess() {
  const {profile} = useAuth();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<string[] | null>(() => (profile ? readChoice(profile.id) : null));
  const [editing, setEditing] = useState(false);
  if (!profile) return null;

  const tiles = quickTiles(profile);
  const byId = new Map(tiles.map((item) => [item.id, item]));
  const defaults = DEFAULT_TILES.filter((id) => byId.has(id));
  const chosen = (choice ?? defaults).filter((id) => byId.has(id));
  const shown = chosen.map((id) => byId.get(id)!);

  const save = (ids: string[]) => {
    // The default set is not stored, so it follows later changes of the default.
    if (sameList(ids, defaults)) {
      localStorage.removeItem(storageKey(profile.id));
      setChoice(null);
    } else {
      localStorage.setItem(storageKey(profile.id), JSON.stringify(ids));
      setChoice(ids);
    }
    setEditing(false);
  };

  return (
    <section data-tour="dashboard-modules" className="animate-rise" style={{"--i": 3} as CSSProperties}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold text-slate-300">Gyors elérés</h2>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto h-7 gap-1.5 px-2 text-xs text-slate-400 hover:text-white">
          <Settings2 className="size-3.5"/> Testreszabás
        </Button>
      </div>
      {shown.length === 0 ? (
        <div className="panel">
          <EmptyState icon={LayoutGrid} title="Nincs kiválasztott gyorsgomb" description="A Testreszabás gombbal választhatsz oldalakat és gyorsműveleteket."/>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {shown.map((item, index) => {
            const tone = TONE_CLASSES[item.tone];
            return (
              <button key={item.id} type="button" data-tile={item.id} onClick={() => navigate(item.id)} style={{"--i": index + 4} as CSSProperties}
                      className="panel lift animate-rise group relative flex min-w-0 flex-col items-start gap-3 overflow-hidden p-4 text-left">
                <div className={cn("pointer-events-none absolute -right-8 -bottom-8 size-24 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40", tone.gradient)}/>
                <div className={cn("relative grid size-10 place-items-center rounded-xl bg-gradient-to-br p-px transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", tone.gradient)}>
                  <div className="grid size-full place-items-center rounded-[11px] bg-[#0a1120]/85">
                    <item.icon className={cn("size-5", tone.text)}/>
                  </div>
                </div>
                <div className="relative w-full min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">{item.label}</div>
                  {item.hint && <div className="truncate text-xs text-slate-500">{item.hint}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editing && <QuickAccessDialog tiles={tiles} chosen={chosen} defaults={defaults} onSave={save} onClose={() => setEditing(false)}/>}
    </section>
  );
}

function TileIcon({item}: {item: QuickTile}) {
  const tone = TONE_CLASSES[item.tone];
  return (
    <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br p-px", tone.gradient)}>
      <div className="grid size-full place-items-center rounded-[7px] bg-[#0a1120]/85"><item.icon className={cn("size-4", tone.text)}/></div>
    </div>
  );
}

function QuickAccessDialog({tiles, chosen, defaults, onSave, onClose}: {
  tiles: QuickTile[];
  chosen: string[];
  defaults: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(chosen);
  const byId = new Map(tiles.map((item) => [item.id, item]));
  const rest = tiles.filter((item) => !draft.includes(item.id));
  const groups = [...new Set(rest.map((item) => item.group))];

  const move = (index: number, by: -1 | 1) => setDraft((current) => {
    const next = [...current];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return next;
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gyors elérés testreszabása</DialogTitle>
          <DialogDescription>Válaszd ki, mi jelenjen meg az irányítópulton, és milyen sorrendben. A beállítás ebben a böngészőben marad.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-1 gap-5 overflow-y-auto pr-1 md:grid-cols-2">
          <section aria-label="Megjelenik" className="min-w-0 space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Megjelenik ({draft.length})</h3>
            {draft.length === 0 && <p className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-500 ring-1 ring-white/5">Még nincs kiválasztva semmi.</p>}
            <ol className="space-y-1.5">
              {draft.map((id, index) => {
                const item = byId.get(id)!;
                return (
                  <li key={id} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-white/[0.04] p-2 ring-1 ring-white/10">
                    <TileIcon item={item}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{item.label}</p>
                      <p className="truncate text-[11px] text-slate-500">{item.group}</p>
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="size-7" disabled={index === 0} onClick={() => move(index, -1)}
                            aria-label={`Feljebb: ${item.label}`}><ArrowUp className="size-3.5"/></Button>
                    <Button type="button" size="icon" variant="ghost" className="size-7" disabled={index === draft.length - 1} onClick={() => move(index, 1)}
                            aria-label={`Lejjebb: ${item.label}`}><ArrowDown className="size-3.5"/></Button>
                    <Button type="button" size="icon" variant="ghost" className="size-7 text-slate-400 hover:text-red-300"
                            onClick={() => setDraft((current) => current.filter((other) => other !== id))}
                            aria-label={`Eltávolítás: ${item.label}`}><X className="size-3.5"/></Button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-label="Hozzáadható" className="min-w-0 space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Hozzáadható</h3>
            {rest.length === 0 && <p className="text-xs text-slate-500">Minden elérhető gomb kint van.</p>}
            {groups.map((group) => (
              <div key={group} className="space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">{group}</p>
                {rest.filter((item) => item.group === group).map((item) => (
                  <button key={item.id} type="button" onClick={() => setDraft((current) => [...current, item.id])}
                          aria-label={`Hozzáadás: ${item.label}`}
                          className="flex w-full min-w-0 items-center gap-2.5 rounded-lg p-2 text-left ring-1 ring-white/5 transition-colors hover:bg-white/[0.04] hover:ring-white/10">
                    <TileIcon item={item}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{item.label}</p>
                      {item.hint && <p className="truncate text-[11px] text-slate-500">{item.hint}</p>}
                    </div>
                    <Plus className="size-4 shrink-0 text-slate-500"/>
                  </button>
                ))}
              </div>
            ))}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setDraft(defaults)} disabled={sameList(draft, defaults)}>
            <RotateCcw/> Alapértelmezés
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Mégse</Button>
            <Button type="button" onClick={() => onSave(draft)}>Mentés</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
