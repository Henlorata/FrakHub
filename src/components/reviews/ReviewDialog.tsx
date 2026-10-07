import {useState} from "react";
import {toast} from "sonner";
import {CheckCircle2, ClipboardCheck, Loader2, Save, Send, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useConfirm} from "@/components/ConfirmDialog";
import {MemberAvatar} from "@/pages/finance/components/MemberAvatar";
import {formatDate} from "@/lib/datetime";
import {
  averageScore, formatPeriod, formatScore, REVIEW_CRITERIA, REVIEW_STATUS, reviewsApi, SCORE_LABELS, type Review, type ReviewDraft,
  type ReviewPerson,
} from "@/lib/reviews";
import {cn, errorMessage} from "@/lib/utils";

const toDraft = (review: Review | null): ReviewDraft => ({
  scores: {...(review?.scores ?? {})}, strengths: review?.strengths ?? "", improvements: review?.improvements ?? "", goals: review?.goals ?? "",
});

/** Score segments: 1–5 filled bars (read-only) or buttons (the editor). */
export function ScoreBar({value, onChange, label}: {value: number | undefined; onChange?: (value: number) => void; label: string}) {
  return (
    <div className="flex items-center gap-1" role={onChange ? "radiogroup" : "img"} aria-label={`${label}: ${value ? `${value}/5` : "nincs pontozva"}`}>
      {[1, 2, 3, 4, 5].map((step) => {
        const filled = !!value && step <= value;
        const look = cn("h-2.5 w-7 rounded-full transition-colors", filled ? "bg-amber-400 shadow-[0_0_8px_rgb(251_191_36/0.45)]" : "bg-white/10");
        return onChange ? (
          <button key={step} type="button" role="radio" aria-checked={value === step} aria-label={`${step} – ${SCORE_LABELS[step]}`}
                  title={`${step} – ${SCORE_LABELS[step]}`} onClick={() => onChange(step)}
                  className={cn(look, "hover:bg-amber-300/70 focus-visible:outline-2 focus-visible:outline-amber-300")}/>
        ) : <span key={step} className={look}/>;
      })}
      <span className="ml-1 w-24 text-xs text-slate-400">{value ? SCORE_LABELS[value] : "–"}</span>
    </div>
  );
}

/**
 * A performance review: the reviewer writes and shares it, the member reads and acknowledges it,
 * the staff read the shared ones. A new review needs the member and the quarter.
 */
export function ReviewDialog({review, member, period, onClose, onChanged}: {
  review: Review | null;
  /** For a new review. */
  member?: ReviewPerson;
  period?: string;
  onClose: () => void;
  onChanged: (review: Review | null) => void;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState<ReviewDraft>(() => toDraft(review));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"save" | "share" | "ack" | "delete" | null>(null);
  const editing = !review || review.can_edit;
  const person = review?.member ?? member ?? null;
  const shownPeriod = review?.period ?? period ?? "";
  const complete = REVIEW_CRITERIA.every((criterion) => !!draft.scores[criterion.key]);
  const overall = editing ? averageScore(draft.scores) : review?.overall ?? null;

  const save = async (share: boolean) => {
    setBusy(share ? "share" : "save");
    try {
      let saved = await reviewsApi.save(review?.id ?? null, review ? null : person?.id ?? null, review ? null : shownPeriod, draft);
      if (share) saved = await reviewsApi.share(saved.id);
      onChanged(saved);
      toast.success(share ? "Értékelés megosztva: a tag értesítést kapott." : "Piszkozat elmentve.");
      if (share) onClose();
    } catch (error) {
      toast.error(errorMessage(error, "A mentés nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const acknowledge = async () => {
    if (!review) return;
    setBusy("ack");
    try {
      onChanged(await reviewsApi.acknowledge(review.id, comment.trim()));
      toast.success("Köszönjük, az értékelő értesítést kapott.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "A visszaigazolás nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!review) return;
    const ok = await confirm({title: "Törlöd az értékelést?", description: "Az értékelés véglegesen törlődik.", confirmLabel: "Törlés",
      destructive: true, kind: "delete"});
    if (!ok) return;
    setBusy("delete");
    try {
      await reviewsApi.remove(review.id);
      onChanged(null);
      toast.success("Értékelés törölve.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    } finally {
      setBusy(null);
    }
  };

  const status = review ? REVIEW_STATUS[review.status] : REVIEW_STATUS.draft;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[94dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {person && <MemberAvatar name={person.full_name} avatarUrl={person.avatar_url} size={44}/>}
            <div className="min-w-0 flex-1">
              <DialogTitle className="wrap-anywhere">Teljesítményértékelés · {formatPeriod(shownPeriod)}</DialogTitle>
              <DialogDescription className="wrap-anywhere">
                {person ? `${person.faction_rank ?? ""} ${person.full_name}`.trim() : ""}
                {review?.reviewer ? ` · értékelő: ${review.reviewer.full_name}` : ""}
              </DialogDescription>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", status.tone)}>{status.label}</span>
          </div>
        </DialogHeader>

        <section className="space-y-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
          {REVIEW_CRITERIA.map((criterion) => (
            <div key={criterion.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{criterion.label}</p>
                <p className="text-[11px] text-slate-500">{criterion.hint}</p>
              </div>
              <ScoreBar label={criterion.label} value={draft.scores[criterion.key]}
                        onChange={editing ? (value) => setDraft({...draft, scores: {...draft.scores, [criterion.key]: value}}) : undefined}/>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-sm text-slate-400">Átlag</span>
            <span className="text-2xl font-semibold text-amber-200 tabular-nums">{formatScore(overall)}</span>
          </div>
        </section>

        {([["strengths", "Erősségek", "Amiben kiemelkedő volt ebben a negyedévben"],
          ["improvements", "Fejlesztendő", "Amin javítania kell, konkrét példákkal"],
          ["goals", "Célok a következő negyedévre", "Pl. vezetői képzés, több jelentés, egységvizsga"]] as const).map(([key, label, placeholder]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`review-${key}`}>{label}</Label>
            {editing ? (
              <Textarea id={`review-${key}`} rows={3} maxLength={3000} value={draft[key]} placeholder={placeholder}
                        onChange={(event) => setDraft({...draft, [key]: event.target.value})}/>
            ) : (
              <p id={`review-${key}`} className="rounded-xl bg-white/[0.02] px-3 py-2 text-sm whitespace-pre-wrap text-slate-200 ring-1 ring-white/5 wrap-anywhere">
                {review?.[key] || "–"}
              </p>
            )}
          </div>
        ))}

        {review?.status === "acknowledged" && (
          <div className="rounded-xl bg-emerald-500/[0.06] px-3 py-2 text-sm ring-1 ring-emerald-500/20">
            <p className="flex items-center gap-1.5 text-xs text-emerald-200">
              <CheckCircle2 className="size-3.5"/> Visszaigazolva: {review.acknowledged_at ? formatDate(review.acknowledged_at) : ""}
            </p>
            {review.member_comment && <p className="mt-1 whitespace-pre-wrap text-slate-200 wrap-anywhere">„{review.member_comment}”</p>}
          </div>
        )}

        {review?.can_acknowledge && (
          <div className="space-y-2 rounded-xl bg-sky-500/[0.06] p-3 ring-1 ring-sky-500/20">
            <Label htmlFor="review-comment">Válaszod (nem kötelező)</Label>
            <Textarea id="review-comment" rows={2} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)}
                      placeholder="Ha szeretnél reagálni az értékelésre"/>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {review?.can_delete ? (
            <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" disabled={!!busy} onClick={() => void remove()}>
              {busy === "delete" ? <Loader2 className="size-4 animate-spin"/> : <Trash2 className="size-4"/>} Törlés
            </Button>
          ) : <span/>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={!!busy}>Bezárás</Button>
            {editing && (
              <>
                <Button variant="outline" disabled={!!busy} onClick={() => void save(false)}>
                  {busy === "save" ? <Loader2 className="size-4 animate-spin"/> : <Save className="size-4"/>} Piszkozat mentése
                </Button>
                <Button disabled={!!busy || !complete} title={complete ? undefined : "Megosztás előtt pontozd mind a hat szempontot."}
                        onClick={() => void save(true)}>
                  {busy === "share" ? <Loader2 className="size-4 animate-spin"/> : <Send className="size-4"/>} Megosztás a taggal
                </Button>
              </>
            )}
            {review?.can_acknowledge && (
              <Button disabled={!!busy} onClick={() => void acknowledge()}>
                {busy === "ack" ? <Loader2 className="size-4 animate-spin"/> : <ClipboardCheck className="size-4"/>} Megismertem
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
