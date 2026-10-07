import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ChevronLeft, ChevronRight, ClipboardPen, Loader2, Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {EmptyState} from "@/components/layout/EmptyState";
import {ReviewDialog} from "@/components/reviews/ReviewDialog";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {
  formatPeriod, formatScore, REVIEW_STATUS, reviewsApi, shiftPeriod, type Review, type ReviewOverview, type ReviewOverviewMember,
} from "@/lib/reviews";
import {cn, errorMessage} from "@/lib/utils";

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Quarterly performance reviews (staff): every member with the chosen quarter's review and their
 * previous one. Reviews are written by staff above the member; drafts stay with their writer.
 */
export function ReviewsPanel({onOpenMember}: {onOpenMember: (id: string) => void}) {
  const [period, setPeriod] = useState<string | null>(null);
  const [data, setData] = useState<ReviewOverview | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "draft" | "shared">("all");
  const [open, setOpen] = useState<{review: Review | null; member: ReviewOverviewMember} | null>(null);

  useEffect(() => {
    let active = true;
    reviewsApi.overview(period).then((value) => active && setData(value), (error) => {
      if (!active) return;
      toast.error(errorMessage(error, "Az értékelések nem tölthetők be."));
      setData({period: period ?? "", current_period: period ?? "", members: []});
    });
    return () => {
      active = false;
    };
  }, [period]);
  // While another quarter loads, the previous one is not shown.
  const loaded = data && (period === null || data.period === period) ? data : null;

  const rows = useMemo(() => {
    const term = fold(search.trim());
    return (loaded?.members ?? []).filter((member) =>
      (!term || fold(`${member.full_name} ${member.badge_number ?? ""} ${member.faction_rank}`).includes(term))
      && (filter === "all" || (filter === "missing" ? !member.review && member.can_write
        : filter === "draft" ? member.review?.status === "draft" : !!member.review && member.review.status !== "draft")));
  }, [loaded, search, filter]);

  const counts = useMemo(() => ({
    done: (loaded?.members ?? []).filter((member) => member.review && member.review.status !== "draft").length,
    draft: (loaded?.members ?? []).filter((member) => member.review?.status === "draft").length,
    missing: (loaded?.members ?? []).filter((member) => !member.review && member.can_write).length,
  }), [loaded]);

  const replace = (userId: string, review: Review | null) => setData((current) => current && {
    ...current, members: current.members.map((member) => (member.user_id === userId ? {...member, review} : member)),
  });

  const shown = period ?? data?.period ?? "";
  const current = data?.current_period ?? shown;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
          <Button size="icon-sm" variant="ghost" aria-label="Előző negyedév" disabled={!shown} onClick={() => setPeriod(shiftPeriod(shown, -1))}>
            <ChevronLeft/>
          </Button>
          <span className="min-w-20 text-center text-sm font-semibold text-white tabular-nums">{shown ? formatPeriod(shown) : "…"}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Következő negyedév" disabled={!shown || shown >= current}
                  onClick={() => setPeriod(shiftPeriod(shown, 1))}>
            <ChevronRight/>
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {([["all", "Mind", null], ["missing", "Hiányzik", counts.missing], ["draft", "Piszkozat", counts.draft],
            ["shared", "Kész", counts.done]] as const).map(([value, label, count]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
                    className={cn("h-8 rounded-full px-3 text-xs ring-1 transition",
                      filter === value ? "bg-primary/15 text-primary ring-primary/30" : "text-slate-400 ring-white/10 hover:text-white")}>
              {label}{count !== null ? ` · ${count}` : ""}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"/>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Név vagy jelvényszám" className="pl-9"/>
        </div>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-12"><Loader2 className="size-7 animate-spin text-slate-500"/></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardPen} title="Nincs találat" description="Próbálj más szűrőt vagy negyedévet."/>
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {rows.map((member, index) => {
            const review = member.review;
            const status = review ? REVIEW_STATUS[review.status] : null;
            return (
              <li key={member.user_id} className="panel animate-rise flex min-w-0 items-center gap-3 p-3" style={{"--i": Math.min(index, 10)} as CSSProperties}>
                <button type="button" onClick={() => onOpenMember(member.user_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <MemberAvatar name={member.full_name} avatarUrl={member.avatar_url} size={36}/>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{member.full_name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {member.faction_rank}{member.last ? ` · előző: ${formatPeriod(member.last.period)} – ${formatScore(member.last.overall)}` : ""}
                    </span>
                  </span>
                </button>
                {review && status ? (
                  <button type="button" onClick={() => setOpen({review, member})}
                          className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/5">
                    <span className="text-lg font-semibold text-amber-200 tabular-nums">{formatScore(review.overall)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] ring-1", status.tone)}>{status.label}</span>
                  </button>
                ) : member.can_write ? (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen({review: null, member})}>
                    <ClipboardPen className="size-4"/> Értékelés
                  </Button>
                ) : <span className="shrink-0 text-xs text-slate-600">–</span>}
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <ReviewDialog review={open.review} period={shown}
                      member={{id: open.member.user_id, full_name: open.member.full_name, faction_rank: open.member.faction_rank,
                        badge_number: open.member.badge_number, avatar_url: open.member.avatar_url}}
                      onClose={() => setOpen(null)} onChanged={(review) => {
                        replace(open.member.user_id, review);
                        if (review) setOpen((currentOpen) => currentOpen && {...currentOpen, review});
                      }}/>
      )}
    </div>
  );
}
