import {Printer, X} from "lucide-react";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {getOptimizedAvatarUrl} from "@/lib/cloudinary";
import {formatDateTime} from "@/lib/datetime";
import {PROPERTY_TYPE, WARRANT_TYPE, warrantTarget} from "@/lib/mcb";
import {cn} from "@/lib/utils";
import type {CaseWarrant} from "@/types/supabase";
import {BRAND_IMAGES} from "@/lib/brand";
import {SignatureLine} from "@/components/signature/SignatureLine";
import {useSignatures} from "@/lib/signature/api";

const STAMP: Record<string, {text: string; className: string} | undefined> = {
  approved: {text: "Jóváhagyva", className: "border-emerald-700 text-emerald-700"},
  executed: {text: "Végrehajtva", className: "border-sky-800 text-sky-800"},
  rejected: {text: "Elutasítva", className: "border-red-700 text-red-700"},
  expired: {text: "Visszavonva", className: "border-slate-600 text-slate-600"},
};

/** Prints only the open dialog (the app behind it is hidden for the print). */
export function printDialog() {
  document.body.classList.add("print-dialog");
  const done = () => {
    document.body.classList.remove("print-dialog");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/** The warrant as an official document (screenshot for the game, print, PDF). */
export function WarrantDocument({warrant, onClose}: {warrant: CaseWarrant | null; onClose: () => void}) {
  const type = warrant ? WARRANT_TYPE[warrant.type] : null;
  const stamp = warrant ? STAMP[warrant.status] : undefined;
  const number = warrant ? `P-${warrant.id.slice(0, 8).toUpperCase()}` : "";
  const signatureOf = useSignatures([warrant?.requested_by, warrant?.approved_by]);

  return (
    <Dialog open={!!warrant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[94dvh] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-[720px]">
        <DialogTitle className="sr-only">{type?.label}</DialogTitle>
        <DialogDescription className="sr-only">{number}</DialogDescription>
        {warrant && type && (
          <>
            <div className="print-hide sticky top-0 z-10 flex justify-end gap-2 pb-2">
              <Button size="sm" onClick={printDialog} className="bg-white text-slate-900 hover:bg-slate-200"><Printer className="size-4"/> Nyomtatás / PDF</Button>
              <Button size="icon" variant="ghost" onClick={onClose} aria-label="Bezárás" className="size-8 bg-black/40 text-white hover:bg-black/60">
                <X className="size-4"/>
              </Button>
            </div>
            <article className="relative overflow-hidden rounded-sm bg-[#fbf8f1] px-8 py-9 font-serif text-[#1f2937] shadow-2xl ring-1 ring-black/10 sm:px-12">
              <SheriffStar variant="watermark" className="pointer-events-none absolute top-1/2 left-1/2 w-[70%] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"/>
              <header className="relative flex items-center gap-4 border-b-2 border-[#1f2937] pb-4">
                <SheriffStar className="size-16 shrink-0"/>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.3em] text-slate-600 uppercase">San Fierro Sheriff&apos;s Department</p>
                  <p className="text-sm font-semibold tracking-wide text-slate-700">Major Crimes Bureau · Nyomozó Iroda</p>
                </div>
                <img src={BRAND_IMAGES.mcb} alt="" className="size-14 shrink-0 object-contain opacity-90"/>
              </header>

              <div className="relative mt-6 text-center">
                <h2 className="text-3xl font-bold tracking-[0.18em] uppercase">{type.label}</h2>
                <p className="mt-1 font-mono text-xs tracking-widest text-slate-600">{number} · Akta: {warrant.case?.case_number ?? "–"}</p>
              </div>

              <section className="relative mt-7 flex gap-5">
                {warrant.suspect?.mugshot_url && (
                  <img src={getOptimizedAvatarUrl(warrant.suspect.mugshot_url, 240)} alt=""
                       className="size-28 shrink-0 rounded-sm object-cover ring-1 ring-black/20 grayscale-[0.3]"/>
                )}
                <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="font-semibold text-slate-600">{warrant.type === "search" ? "Érintett személy:" : "Célszemély:"}</dt>
                  <dd className="font-bold wrap-anywhere">{warrant.suspect?.full_name ?? (warrant.type === "arrest" ? warrantTarget(warrant) : "–")}</dd>
                  {warrant.suspect?.alias && (<><dt className="font-semibold text-slate-600">Ismert álnév:</dt><dd className="wrap-anywhere">„{warrant.suspect.alias}”</dd></>)}
                  {warrant.suspect?.gang_affiliation && (<><dt className="font-semibold text-slate-600">Szervezet:</dt><dd className="wrap-anywhere">{warrant.suspect.gang_affiliation}</dd></>)}
                  {warrant.type === "search" && (
                    <>
                      <dt className="font-semibold text-slate-600">Átkutatandó cím:</dt>
                      <dd className="font-bold wrap-anywhere">
                        {warrant.property?.address ?? warrant.target_name ?? "–"}
                        {warrant.property?.property_type ? ` (${PROPERTY_TYPE[warrant.property.property_type] ?? warrant.property.property_type})` : ""}
                      </dd>
                    </>
                  )}
                  <dt className="font-semibold text-slate-600">Ügy:</dt>
                  <dd className="wrap-anywhere">{warrant.case?.title ?? "–"}</dd>
                </dl>
              </section>

              <section className="relative mt-6">
                <h3 className="text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">Indoklás</h3>
                <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap wrap-anywhere">{warrant.reason}</p>
                {warrant.description && (
                  <>
                    <h3 className="mt-4 text-xs font-bold tracking-[0.2em] text-slate-600 uppercase">Bizonyítékok, hivatkozások</h3>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{warrant.description}</p>
                  </>
                )}
              </section>

              {(warrant.decision_note || warrant.closing_note) && (
                <section className="relative mt-5 rounded-sm border border-dashed border-slate-400 p-3 text-sm">
                  {warrant.decision_note && <p className="wrap-anywhere"><span className="font-semibold">Döntés:</span> {warrant.decision_note}</p>}
                  {warrant.closing_note && <p className="wrap-anywhere"><span className="font-semibold">{warrant.status === "executed" ? "Végrehajtás:" : "Lezárás:"}</span> {warrant.closing_note}</p>}
                </section>
              )}

              <footer className="relative mt-9 grid grid-cols-2 gap-8 text-sm">
                <SignatureLine signature={signatureOf(warrant.requested_by)} name={warrant.requester?.full_name} align="left"
                               role="Kérelmező" detail={[warrant.requester?.faction_rank, warrant.requester?.badge_number ? `#${warrant.requester.badge_number}` : null].filter(Boolean).join(" · ")}
                               date={formatDateTime(warrant.created_at)}/>
                <SignatureLine signature={signatureOf(warrant.approved_by)} name={warrant.status === "pending" ? null : warrant.approver?.full_name} align="left"
                               pending={warrant.status === "pending" ? "jóváhagyásra vár" : null}
                               role={warrant.status === "rejected" ? "Elutasította" : "Jóváhagyta"}
                               detail={[warrant.approver?.faction_rank, warrant.approver?.badge_number ? `#${warrant.approver.badge_number}` : null].filter(Boolean).join(" · ")}
                               date={warrant.status === "pending" ? null : formatDateTime(warrant.decided_at ?? warrant.updated_at)}/>
              </footer>

              {stamp && (
                <span className={cn("pointer-events-none absolute right-10 bottom-24 rotate-[-12deg] rounded-md border-4 px-4 py-1 text-2xl font-black tracking-[0.25em] uppercase opacity-70 mix-blend-multiply",
                  stamp.className)}>
                  {stamp.text}
                </span>
              )}
              <p className="relative mt-8 text-center text-[10px] tracking-[0.25em] text-slate-500 uppercase">Integrity · Service · Protection</p>
            </article>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
