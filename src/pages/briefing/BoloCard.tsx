import {useState, type CSSProperties} from "react";
import {Link} from "react-router";
import {CheckCircle2, Clock, FolderOpen, MapPin, MoreHorizontal, Pencil, RotateCcw, ShieldAlert, Timer, Trash2, Undo2, User} from "lucide-react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {getOptimizedImageUrl} from "@/lib/cloudinary";
import {formatAgo, formatDateTime, formatUntil} from "@/lib/datetime";
import {BOLO_DANGER, BOLO_KINDS, BOLO_REASONS, type Bolo} from "@/lib/patrol";
import {cn} from "@/lib/utils";

/** A plate drawn as a licence plate, readable at a glance. */
export function PlateBadge({plate, size = "md"}: {plate: string; size?: "sm" | "md" | "lg"}) {
  return (
    <span className={cn("plate-badge inline-flex items-center rounded-md font-mono font-bold tracking-[0.18em] uppercase",
      size === "lg" ? "px-3 py-1 text-xl" : size === "md" ? "px-2 py-0.5 text-sm" : "px-1.5 py-px text-[11px]")}>
      {plate}
    </span>
  );
}

interface BoloCardProps {
  bolo: Bolo;
  index?: number;
  highlighted?: boolean;
  onResolve: (bolo: Bolo) => void;
  onEdit: (bolo: Bolo) => void;
  onExtend: (bolo: Bolo, hours: number) => void;
  onCancel: (bolo: Bolo) => void;
  onReopen: (bolo: Bolo) => void;
  onDelete: (bolo: Bolo) => void;
}

/**
 * One alert on the board: the danger as a coloured edge (high ones glow), the plate or the person,
 * the last sighting, the time left and what the member can do with it.
 */
export function BoloCard({bolo, index = 0, highlighted, onResolve, onEdit, onExtend, onCancel, onReopen, onDelete}: BoloCardProps) {
  const danger = BOLO_DANGER[bolo.danger];
  const reason = BOLO_REASONS[bolo.reason];
  const Kind = BOLO_KINDS[bolo.kind].icon;
  // The time the card appeared: enough for "lapsed" and the half-hour delete window (the server decides anyway).
  const [now] = useState(() => Date.now());
  const expired = bolo.status === "active" && new Date(bolo.expires_at).getTime() <= now;
  const active = bolo.status === "active" && !expired;
  const picture = bolo.image_url ?? bolo.suspect?.mugshot_url ?? null;
  const freshDelete = bolo.can_manage && now - new Date(bolo.created_at).getTime() < 30 * 60_000;

  return (
    <article id={`bolo-${bolo.id}`} style={{"--i": index} as CSSProperties}
             className={cn("panel animate-rise group relative flex min-w-0 flex-col overflow-hidden", active && danger.glow,
               !active && "opacity-75", highlighted && "ring-2 ring-amber-400/70")}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", danger.stripe, !active && "opacity-40")}/>
      <div className="flex min-w-0 gap-3 p-4 pl-5">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10">
          {picture ? (
            <img src={getOptimizedImageUrl(picture, 240) ?? picture} alt="" loading="lazy" className="size-full object-cover"/>
          ) : (
            <div className="grid size-full place-items-center text-slate-500"><Kind className="size-8"/></div>
          )}
          <span className="absolute right-1 bottom-1 grid size-6 place-items-center rounded-md bg-black/70 text-slate-200" title={BOLO_KINDS[bolo.kind].label}>
            <Kind className="size-3.5"/>
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold ring-1", danger.chip)}>
              <ShieldAlert className="size-3"/>{danger.label}
            </span>
            <span className="inline-flex h-5 items-center gap-1 rounded-md bg-white/[0.05] px-1.5 text-[10px] font-semibold text-slate-300 ring-1 ring-white/10">
              <reason.icon className="size-3"/>{reason.label}
            </span>
            {bolo.status === "resolved" && (
              <span className="inline-flex h-5 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-3"/> Megtalálva
              </span>
            )}
            {bolo.status === "cancelled" && (
              <span className="inline-flex h-5 items-center rounded-md bg-white/5 px-1.5 text-[10px] font-semibold text-slate-400 ring-1 ring-white/10">Visszavonva</span>
            )}
            {expired && (
              <span className="inline-flex h-5 items-center rounded-md bg-white/5 px-1.5 text-[10px] font-semibold text-slate-400 ring-1 ring-white/10">Lejárt</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white wrap-anywhere">{bolo.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {bolo.plate && <PlateBadge plate={bolo.plate}/>}
            {bolo.kind === "vehicle" && (bolo.vehicle_model || bolo.vehicle_color) && (
              <span className="wrap-anywhere">{[bolo.vehicle_color, bolo.vehicle_model].filter(Boolean).join(" ")}</span>
            )}
            {bolo.kind === "person" && bolo.person_name && <span className="font-medium wrap-anywhere">{bolo.person_name}</span>}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="További műveletek" className="shrink-0 self-start"><MoreHorizontal/></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {active && <DropdownMenuItem onSelect={() => onResolve(bolo)}><CheckCircle2/> Megtaláltam</DropdownMenuItem>}
            {bolo.can_manage && active && (
              <>
                <DropdownMenuItem onSelect={() => onExtend(bolo, 24)}><Timer/> Hosszabbítás 1 nappal</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExtend(bolo, 72)}><Timer/> Hosszabbítás 3 nappal</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(bolo)}><Pencil/> Szerkesztés</DropdownMenuItem>
                <DropdownMenuSeparator/>
                <DropdownMenuItem onSelect={() => onCancel(bolo)}><Undo2/> Visszavonás</DropdownMenuItem>
              </>
            )}
            {bolo.can_manage && !active && <DropdownMenuItem onSelect={() => onReopen(bolo)}><RotateCcw/> Újranyitás 3 napra</DropdownMenuItem>}
            {freshDelete && (
              <DropdownMenuItem onSelect={() => onDelete(bolo)} className="text-red-300 focus:text-red-200"><Trash2/> Törlés (tévedés)</DropdownMenuItem>
            )}
            {!active && !bolo.can_manage && <DropdownMenuItem disabled>Lezárt BOLO</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {bolo.description && (
        <p className="border-t border-white/5 px-5 py-2.5 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap wrap-anywhere">{bolo.description}</p>
      )}

      {bolo.status === "resolved" && bolo.resolution && (
        <p className="border-t border-emerald-500/15 bg-emerald-500/[0.05] px-5 py-2 text-xs text-emerald-100 wrap-anywhere">
          <CheckCircle2 className="mr-1 inline size-3.5"/>{bolo.resolution}
          {bolo.resolved_by_name && <span className="text-emerald-300/70"> · {bolo.resolved_by_name}, {formatAgo(bolo.resolved_at)}</span>}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 px-5 py-2 text-[11px] text-slate-500">
        {bolo.last_seen_location && (
          <span className="inline-flex min-w-0 items-center gap-1 text-slate-400"><MapPin className="size-3 shrink-0"/>
            <span className="truncate">{bolo.last_seen_location}</span>{bolo.last_seen_at && <span>· {formatAgo(bolo.last_seen_at)}</span>}
          </span>
        )}
        {bolo.case && (
          <Link to={`/mcb/case/${bolo.case.id}`} className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
            <FolderOpen className="size-3"/>{bolo.case.case_number}
          </Link>
        )}
        <span className="inline-flex items-center gap-1" title={formatDateTime(bolo.created_at)}>
          <User className="size-3"/>{bolo.created_by_name ?? "Ismeretlen"} · {formatAgo(bolo.created_at)}
        </span>
        {active && (
          <span className="ml-auto inline-flex items-center gap-1 text-slate-400" title={`Lejár: ${formatDateTime(bolo.expires_at)}`}>
            <Clock className="size-3"/> lejár {formatUntil(bolo.expires_at)}
          </span>
        )}
      </footer>
    </article>
  );
}
