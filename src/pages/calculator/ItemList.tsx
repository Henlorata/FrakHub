import {Fragment, memo, type CSSProperties, type ReactNode} from "react";
import {AlertTriangle, ChevronDown, Minus, Plus, Search, Star} from "lucide-react";
import {formatCurrency, formatJailTime} from "@/lib/penalcode-processor";
import {cn} from "@/lib/utils";
import type {PenalCodeItem} from "@/types/penalcode";
import type {ListCategory, ListGroup} from "./penal-data";

interface ItemListProps {
  categories: ListCategory[];
  search: string;
  /** Search or favourites: every match is shown unfolded. */
  filtering: boolean;
  open: Set<string>;
  onToggle: (key: string) => void;
  quantities: Map<string, number>;
  favorites: Set<string>;
  onAdd: (id: string) => void;
  onChange: (id: string, delta: number) => void;
  onFavorite: (id: string) => void;
}

export const categoryAnchor = (name: string) => `penal-category-${name.replace(/\s+/g, "-")}`;

/** The penal code by category; groups (paragraphs with sub-points) fold open. */
export function ItemList({categories, search, filtering, open, onToggle, quantities, favorites, onAdd, onChange, onFavorite}: ItemListProps) {
  if (categories.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 py-16 text-center">
        <Search className="size-10 text-slate-600"/>
        <p className="text-sm text-slate-400">Nincs találat{search ? ` erre: „${search}”` : ""}.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {categories.map((category, index) => {
        const expanded = filtering || open.has(category.kategoria_nev);
        return (
          <section key={category.kategoria_nev} id={categoryAnchor(category.kategoria_nev)}
                   className="panel animate-rise scroll-mt-36 overflow-hidden" style={{"--i": Math.min(index, 8)} as CSSProperties}>
            <button type="button" onClick={() => onToggle(category.kategoria_nev)} aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
              <span className="min-w-0 flex-1 text-base font-semibold text-white wrap-anywhere">{category.kategoria_nev}</span>
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-400 tabular-nums">
                {category.items.reduce((sum, entry) => sum + ("alpontok" in entry ? entry.alpontok.length : 1), 0)}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", expanded && "rotate-180")}/>
            </button>
            {expanded && (
              <div className="animate-fade space-y-1.5 border-t border-white/5 bg-black/10 p-2.5">
                {category.items.map((entry) => "alpontok" in entry ? (
                  <GroupBlock key={entry.id} group={entry} search={search} open={entry.matchType === "children" || open.has(entry.id)}
                              onToggle={() => onToggle(entry.id)}>
                    {entry.alpontok.map((item) => (
                      <ItemRow key={item.id} item={item} search={search} quantity={quantities.get(item.id) ?? 0} favorite={favorites.has(item.id)}
                               onAdd={onAdd} onChange={onChange} onFavorite={onFavorite} nested/>
                    ))}
                  </GroupBlock>
                ) : (
                  <ItemRow key={entry.id} item={entry} search={search} quantity={quantities.get(entry.id) ?? 0} favorite={favorites.has(entry.id)}
                           onAdd={onAdd} onChange={onChange} onFavorite={onFavorite}/>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function GroupBlock({group, search, open, onToggle, children}: {group: ListGroup; search: string; open: boolean; onToggle: () => void; children: ReactNode}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06]">
      <button type="button" onClick={onToggle} aria-expanded={open}
              className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03]">
        <span className="mt-0.5 shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-xs text-amber-300 ring-1 ring-amber-500/20">
          <Highlight text={group.paragrafus} search={search}/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100 wrap-anywhere"><Highlight text={group.megnevezes} search={search}/></span>
          {group.megjegyzes && <span className="mt-0.5 block text-xs text-slate-500 wrap-anywhere"><Highlight text={group.megjegyzes} search={search}/></span>}
        </span>
        <span className="mt-0.5 shrink-0 text-[11px] text-slate-500">{group.alpontok.length} pont</span>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}/>
      </button>
      {open && <div className="animate-fade space-y-1.5 border-t border-white/5 p-2">{children}</div>}
    </div>
  );
}

const ItemRow = memo(function ItemRow({item, search, quantity, favorite, onAdd, onChange, onFavorite, nested}: {
  item: PenalCodeItem;
  search: string;
  quantity: number;
  favorite: boolean;
  onAdd: (id: string) => void;
  onChange: (id: string, delta: number) => void;
  onFavorite: (id: string) => void;
  nested?: boolean;
}) {
  const inCart = quantity > 0;
  const hasFine = item.min_birsag !== null || item.max_birsag !== null;
  const hasJail = item.min_fegyhaz !== null || item.max_fegyhaz !== null;
  return (
    <div className={cn("group relative flex items-start gap-3 rounded-lg px-3 py-2.5 ring-1 transition-colors",
      inCart ? (item.isWarning ? "bg-amber-500/[0.07] ring-amber-500/30" : "bg-sky-500/[0.07] ring-sky-500/30") : "bg-white/[0.015] ring-white/[0.05] hover:bg-white/[0.04] hover:ring-white/10",
      nested && "bg-transparent")}>
      {inCart && <span className={cn("absolute inset-y-2 left-0 w-0.5 rounded-full", item.isWarning ? "bg-amber-400" : "bg-sky-400")}/>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-xs font-semibold text-amber-300"><Highlight text={item.paragrafus} search={search}/></span>
          <span className="text-sm font-medium text-white wrap-anywhere"><Highlight text={item.megnevezes} search={search}/></span>
          <span className="rounded bg-white/[0.06] px-1.5 font-mono text-[11px] text-slate-300"><Highlight text={item.rovidites} search={search}/></span>
          {item.isWarning && <AlertTriangle className="size-3.5 shrink-0 self-center text-amber-400" aria-label="Figyelmeztetés"/>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          {hasFine && (
            <span className="rounded-md bg-emerald-500/[0.08] px-1.5 py-0.5 font-mono text-emerald-300 ring-1 ring-emerald-500/20 tabular-nums">
              {formatCurrency(item.min_birsag)} – {formatCurrency(item.max_birsag)}
            </span>
          )}
          {hasJail && (
            <span className="rounded-md bg-red-500/[0.08] px-1.5 py-0.5 font-mono text-red-300 ring-1 ring-red-500/20 tabular-nums">
              {formatJailTime(item.min_fegyhaz)} – {formatJailTime(item.max_fegyhaz)}
            </span>
          )}
        </div>
        {item.megjegyzes && <p className="mt-1 text-xs text-slate-500 wrap-anywhere"><Highlight text={item.megjegyzes} search={search}/></p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => onFavorite(item.id)} aria-label={favorite ? "Kedvenc törlése" : "Kedvencekhez"} aria-pressed={favorite}
                className={cn("grid size-8 place-items-center rounded-md transition-colors", favorite ? "text-amber-300" : "text-slate-600 hover:bg-white/5 hover:text-amber-300")}>
          <Star className={cn("size-4", favorite && "fill-amber-300")}/>
        </button>
        {inCart ? (
          <div className="flex h-8 items-center rounded-md bg-sky-500/10 ring-1 ring-sky-500/30">
            <button type="button" onClick={() => onChange(item.id, -1)} aria-label="Kevesebb" className="grid h-full w-7 place-items-center text-sky-200 hover:bg-sky-500/20"><Minus className="size-3.5"/></button>
            <span className="w-6 text-center font-mono text-sm font-semibold text-white tabular-nums">{quantity}</span>
            <button type="button" onClick={() => onChange(item.id, 1)} aria-label="Több" className="grid h-full w-7 place-items-center text-sky-200 hover:bg-sky-500/20"><Plus className="size-3.5"/></button>
          </div>
        ) : (
          <button type="button" onClick={() => onAdd(item.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white">
            <Plus className="size-3.5"/> Hozzáad
          </button>
        )}
      </div>
    </div>
  );
});

function Highlight({text, search}: {text: string | null | undefined; search: string}) {
  if (!text) return null;
  const needle = search.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, index) => part.toLowerCase() === needle.toLowerCase()
        ? <mark key={index} className="rounded-sm bg-amber-400/30 px-0.5 text-white">{part}</mark>
        : <Fragment key={index}>{part}</Fragment>)}
    </>
  );
}
