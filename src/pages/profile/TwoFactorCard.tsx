import * as React from "react";
import {toast} from "sonner";
import {AlertTriangle, Copy, Loader2, ShieldCheck, ShieldOff, ShieldPlus, Smartphone} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {useConfirm} from "@/components/ConfirmDialog";
import {Button} from "@/components/ui/button";
import {CodeInput} from "@/components/ui/code-input";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {formatDate} from "@/lib/datetime";
import {groupSecret, mfaApi, mfaErrorMessage, verifiedFactor, type MfaSetup} from "@/lib/mfa";
import {sandbox} from "@/lib/sandbox/state";
import {cn, isStaff} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

/**
 * Two-factor sign-in on the account tab: switching the authenticator app on (QR code, first code)
 * and off. The state comes from the session, so the tab costs no request.
 */
export function TwoFactorCard({profile}: {profile: Profile}) {
  const {session} = useAuth();
  const confirm = useConfirm();
  const factor = verifiedFactor(session);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Practice mode answers only the database: the sign-in settings would change for real.
  const practice = sandbox.isActive();

  const disable = async () => {
    if (!factor) return;
    const ok = await confirm({
      title: "Kikapcsolod a kétlépcsős azonosítást?",
      description: "Ezután a belépéshez ismét elég lesz a jelszó. Bármikor újra bekapcsolhatod.",
      confirmLabel: "Kikapcsolás",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await mfaApi.disable(factor.id);
      toast.success("Kétlépcsős azonosítás kikapcsolva.");
    } catch (error) {
      toast.error(mfaErrorMessage(error, "A kikapcsolás nem sikerült. Próbáld újra."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("panel relative overflow-hidden p-5 lg:col-span-2", factor && "ring-1 ring-emerald-500/20")}>
      <div aria-hidden className={cn("pointer-events-none absolute -top-20 -right-16 size-48 rounded-full blur-3xl",
        factor ? "bg-emerald-400/10" : "bg-amber-400/[0.06]")}/>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl ring-1",
          factor ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-white/[0.04] text-slate-400 ring-white/10")}>
          {factor ? <ShieldCheck className="size-6"/> : <ShieldPlus className="size-6"/>}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Kétlépcsős azonosítás</h3>
            <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold ring-1",
              factor ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-white/5 text-slate-400 ring-white/10")}>
              {factor ? "Bekapcsolva" : "Kikapcsolva"}
            </span>
          </div>
          {factor ? (
            <p className="text-xs text-slate-400">
              Belépéskor a jelszó után a hitelesítő alkalmazás kódját is kérjük. Beállítva: {formatDate(factor.created_at)}
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                A jelszó mellé a telefonod hitelesítő alkalmazásának 6 jegyű kódja is kell a belépéshez (Google Authenticator,
                Microsoft Authenticator, Authy, 2FAS). Ha valaki megszerzi a jelszavad, a kód nélkül akkor sem jut be.
              </p>
              {isStaff(profile) && (
                <p className="flex items-center gap-1.5 text-xs text-amber-300/90">
                  <AlertTriangle className="size-3.5 shrink-0"/> Vezetőként erősen ajánlott: a fiókod a tagok adataihoz is hozzáfér.
                </p>
              )}
            </>
          )}
        </div>
        {factor ? (
          <Button variant="outline" disabled={busy || practice} onClick={() => void disable()} className="shrink-0">
            {busy ? <Loader2 className="animate-spin"/> : <ShieldOff/>} Kikapcsolás
          </Button>
        ) : (
          <Button disabled={practice} onClick={() => setSetupOpen(true)} title={practice ? "Gyakorló módban nem érhető el." : undefined}
                  className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-500">
            <ShieldPlus/> Bekapcsolás
          </Button>
        )}
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kétlépcsős azonosítás bekapcsolása</DialogTitle>
            <DialogDescription>Három lépés, körülbelül egy perc.</DialogDescription>
          </DialogHeader>
          {setupOpen && <SetupSteps onDone={() => setSetupOpen(false)}/>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Step({index, title, children}: {index: number; title: string; children: React.ReactNode}) {
  return (
    <li className="flex min-w-0 gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
        {index}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-white">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Mounted while the dialog is open: a new key on open, dropped again when closed unfinished. */
function SetupSteps({onDone}: {onDone: () => void}) {
  const [setup, setSetup] = React.useState<MfaSetup | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const finished = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    let started: string | null = null;
    mfaApi.start().then((next) => {
      started = next.factorId;
      if (active) setSetup(next);
      else void mfaApi.abandon(next.factorId);
    }, (failure) => {
      if (active) setFailed(mfaErrorMessage(failure, "A beállítás nem indult el. Próbáld újra később."));
    });
    return () => {
      active = false;
      // Closed before the first code: the half-made key is dropped.
      if (started && !finished.current) void mfaApi.abandon(started);
    };
  }, []);

  const verify = async (value: string) => {
    if (!setup || busy) return;
    setBusy(true);
    setError(null);
    try {
      await mfaApi.confirm(setup.factorId, value);
      finished.current = true;
      toast.success("Kétlépcsős azonosítás bekapcsolva. Belépéskor mostantól a kódot is kérjük.");
      onDone();
    } catch (failure) {
      setError(mfaErrorMessage(failure, "A kód ellenőrzése nem sikerült. Próbáld újra."));
      setCode("");
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      toast.success("A kulcs a vágólapra került.");
    } catch {
      toast.error("A másolás nem sikerült, írd be kézzel.");
    }
  };

  if (failed) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-500/[0.08] p-3 ring-1 ring-red-500/30">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300"/>
        <p className="text-sm text-red-200/90">{failed}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-5">
      <Step index={1} title="Telepíts egy hitelesítő alkalmazást">
        <p className="flex items-start gap-2 text-xs text-slate-400">
          <Smartphone className="mt-0.5 size-3.5 shrink-0"/>
          Google Authenticator, Microsoft Authenticator, Authy vagy 2FAS: mind ingyenes, és internet nélkül is működik.
        </p>
      </Step>
      <Step index={2} title="Olvasd be a QR-kódot az alkalmazással">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {setup ? (
            <img src={setup.qrCode} alt="QR-kód a hitelesítő alkalmazáshoz" width={168} height={168}
                 className="size-[168px] shrink-0 rounded-xl bg-white p-2 animate-fade"/>
          ) : (
            <div className="skeleton size-[168px] shrink-0 rounded-xl"/>
          )}
          <div className="min-w-0 flex-1 space-y-2 text-xs text-slate-400">
            <p>Nem megy a beolvasás? Add meg kézzel ezt a kulcsot (fiók: a belépési email címed):</p>
            {setup ? (
              <div className="flex min-w-0 items-start gap-2">
                <code className="min-w-0 flex-1 rounded-lg bg-white/[0.04] px-2.5 py-2 font-mono text-[13px] leading-relaxed tracking-wide text-slate-100 ring-1 ring-white/10 wrap-anywhere">
                  {groupSecret(setup.secret)}
                </code>
                <Button type="button" size="icon" variant="ghost" aria-label="Kulcs másolása" onClick={() => void copySecret()}>
                  <Copy/>
                </Button>
              </div>
            ) : (
              <div className="skeleton h-10 rounded-lg"/>
            )}
          </div>
        </div>
      </Step>
      <Step index={3} title="Írd be az alkalmazásban megjelenő kódot">
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-red-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>{error}</p>
        )}
        <CodeInput value={code} onChange={setCode} onComplete={(value) => void verify(value)} disabled={!setup || busy}
                   invalid={!!error} label="Az alkalmazás 6 jegyű kódja"/>
        <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-500" disabled={!setup || busy || code.length !== 6}
                onClick={() => void verify(code)}>
          {busy ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Bekapcsolás
        </Button>
      </Step>
    </ol>
  );
}
