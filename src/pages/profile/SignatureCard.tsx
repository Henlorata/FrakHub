import * as React from "react";
import {useSearchParams} from "react-router";
import {toast} from "sonner";
import {Loader2, PenLine, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useConfirm} from "@/components/ConfirmDialog";
import {SIGNATURE_INK, SignatureMark} from "@/components/signature/SignatureMark";
import {formatDate} from "@/lib/datetime";
import {lazyComponent} from "@/lib/lazy";
import {signatureApi, useSignatures, type SignatureMethod} from "@/lib/signature/api";
import {errorMessage} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

const SignatureDialog = lazyComponent(() => import("@/components/signature/SignatureDialog"), "default");

const METHOD_LABEL: Record<SignatureMethod, string> = {draw: "rajzolt", upload: "képről", style: "stílus", auto: "automatikus"};

/** The member's signature on the account tab; `?signature=1` (the reminder) opens the editor. */
export function SignatureCard({profile}: {profile: Profile}) {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = React.useState(() => params.get("signature") === "1");
  const [busy, setBusy] = React.useState(false);
  const confirm = useConfirm();
  const signatureOf = useSignatures([profile.id]);
  const signature = signatureOf(profile.id);

  const close = (open: boolean) => {
    setEditing(open);
    if (!open && params.has("signature")) {
      const next = new URLSearchParams(params);
      next.delete("signature");
      setParams(next, {replace: true});
    }
  };

  const remove = async () => {
    const ok = await confirm({title: "Törlöd az aláírásodat?", description: "Az iratokon ezután csak a neved szerepel, amíg újat nem adsz meg.",
      confirmLabel: "Törlés", destructive: true, kind: "delete"});
    if (!ok) return;
    setBusy(true);
    try {
      await signatureApi.remove(profile.id);
      toast.success("Aláírás törölve.");
    } catch (error) {
      toast.error(errorMessage(error, "A törlés nem sikerült."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel relative overflow-hidden p-5 lg:col-span-2" id="signature" data-tour="signature-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex h-24 w-full shrink-0 items-end justify-center overflow-hidden rounded-xl bg-[#fbf8f1] px-4 pb-4 ring-1 ring-black/10 sm:w-72">
          <div aria-hidden className="absolute inset-x-5 bottom-4 border-t border-dashed border-[#b8b2a7]"/>
          {signature === undefined ? <span className="skeleton mb-2 h-8 w-40 rounded"/> : signature ? (
            <SignatureMark signature={signature} draw className="relative h-16 max-w-full" style={{color: SIGNATURE_INK}}/>
          ) : (
            <span className="relative mb-3 text-xs text-[#a8a29e]">Még nincs aláírásod</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><PenLine className="size-4 text-amber-300"/> Aláírás</h3>
          <p className="text-xs text-slate-400">
            {signature
              ? `A nyomtatható iratokon ez szerepel a neved fölött (${METHOD_LABEL[signature.method]}, ${formatDate(signature.updated_at)}).`
              : "A szolgálati lapon, az aktákon, a parancsokon és az okleveleken a neved fölé kerül. Rajzold meg, töltsd fel egy képről, vagy válassz egy stílust."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {signature && (
            <Button variant="ghost" size="icon" aria-label="Aláírás törlése" disabled={busy} onClick={() => void remove()}>
              {busy ? <Loader2 className="animate-spin"/> : <Trash2/>}
            </Button>
          )}
          <Button onClick={() => setEditing(true)}><PenLine/> {signature ? "Módosítás" : "Beállítás"}</Button>
        </div>
      </div>
      {editing && (
        <React.Suspense fallback={null}>
          <SignatureDialog open={editing} onOpenChange={close}/>
        </React.Suspense>
      )}
    </section>
  );
}
