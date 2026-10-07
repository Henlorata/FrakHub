import {useCallback, useEffect, useState, type CSSProperties} from "react";
import {toast} from "sonner";
import {ClipboardCheck, ClipboardPen, Loader2, Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {EmptyState} from "@/components/layout/EmptyState";
import {formatDate} from "@/lib/datetime";
import {formatPeriod, formatScore, REVIEW_CRITERIA, REVIEW_STATUS, reviewsApi, type MemberReviews, type Review, type ReviewPerson} from "@/lib/reviews";
import {cn, errorMessage} from "@/lib/utils";
import {ReviewDialog, ScoreBar} from "./ReviewDialog";

/**
 * A member's reviews: their own on the profile (without `member`), anyone's for the staff on the
 * member sheet, where a new one can be started for the current quarter.
 */
export function ReviewList({member, compact = false}: {member?: ReviewPerson; compact?: boolean}) {
  const [data, setData] = useState<MemberReviews | null>(null);
  const [open, setOpen] = useState<Review | "new" | null>(null);

  const load = useCallback(() => {
    reviewsApi.list(member?.id ?? null).then(setData, (error) => {
      toast.error(errorMessage(error, "Az értékelések nem tölthetők be."));
      setData({can_write: false, current_period: "", reviews: []});
    });
  }, [member?.id]);
  useEffect(load, [load]);

  if (!data) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-slate-500"/></div>;

  const hasCurrent = data.reviews.some((review) => review.period === data.current_period);
  const waiting = data.reviews.filter((review) => review.can_acknowledge).length;

  const changed = (review: Review | null, replaced?: Review | null) => {
    setData((current) => {
      if (!current) return current;
      const others = current.reviews.filter((item) => item.id !== (review?.id ?? replaced?.id));
      return {...current, reviews: review ? [review, ...others].sort((a, b) => b.period.localeCompare(a.period)) : others};
    });
    if (review) setOpen(review);
  };

  return (
    <div className="space-y-3">
      {(member && data.can_write && !hasCurrent) || waiting > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {waiting > 0 && (
            <p className="mr-auto flex items-center gap-1.5 text-sm text-sky-200">
              <ClipboardCheck className="size-4"/> {waiting} értékelés vár a visszaigazolásodra.
            </p>
          )}
          {member && data.can_write && !hasCurrent && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen("new")}>
              <Plus className="size-4"/> Értékelés ({formatPeriod(data.current_period)})
            </Button>
          )}
        </div>
      ) : null}

      {data.reviews.length === 0 ? (
        <EmptyState compact={compact} icon={ClipboardPen} title="Még nincs értékelés"
                    description={member ? "A Supervisory Staff és felette negyedévente értékelheti a nála alacsonyabb rangúakat."
                      : "A vezetőség negyedévente értékelhet; ha megosztanak veled egyet, itt olvashatod."}/>
      ) : (
        <ul className="space-y-2">
          {data.reviews.map((review, index) => {
            const status = REVIEW_STATUS[review.status];
            return (
              <li key={review.id} style={{"--i": index} as CSSProperties}>
                <button type="button" onClick={() => setOpen(review)}
                        className={cn("panel animate-rise lift flex w-full min-w-0 flex-col gap-3 p-4 text-left sm:flex-row sm:items-center",
                          review.can_acknowledge && "ring-1 ring-sky-400/40")}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{formatPeriod(review.period)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] ring-1", status.tone)}>{status.label}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {review.reviewer ? `Értékelő: ${review.reviewer.full_name}` : ""}
                      {review.shared_at ? ` · ${formatDate(review.shared_at)}` : ""}
                    </p>
                    {!compact && (
                      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        {REVIEW_CRITERIA.map((criterion) => (
                          <div key={criterion.key} className="flex items-center justify-between gap-2 text-xs text-slate-400">
                            <span className="truncate">{criterion.label}</span>
                            <ScoreBar label={criterion.label} value={review.scores[criterion.key]}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-3xl font-semibold text-amber-200 tabular-nums">{formatScore(review.overall)}</p>
                    <p className="text-[11px] text-slate-500">átlag</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <ReviewDialog review={open === "new" ? null : open} member={member} period={data.current_period}
                      onClose={() => setOpen(null)} onChanged={(review) => changed(review, open === "new" ? null : open)}/>
      )}
    </div>
  );
}
