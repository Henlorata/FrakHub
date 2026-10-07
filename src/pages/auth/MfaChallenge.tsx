import {useState, type FormEvent} from "react";
import {AlertTriangle, Check, Loader2, LogOut, ShieldCheck, Smartphone} from "lucide-react";
import {Button} from "@/components/ui/button";
import {CodeInput} from "@/components/ui/code-input";
import {useAuth} from "@/context/AuthContext";
import {mfaErrorMessage} from "@/lib/mfa";
import {cn} from "@/lib/utils";
import {AuthShell} from "./AuthShell";

/**
 * The second step of the sign-in for members who set up an authenticator app: the app's six-digit
 * code. Shown on the login page right after the password, and by the app frame for a stored session
 * that still lacks it.
 */
export function MfaCodeCard() {
  const {verifyMfa, signOut, user} = useAuth();
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = async (value: string) => {
    if (state !== "idle") return;
    if (value.length !== 6) {
      setError("Írd be a 6 jegyű kódot.");
      setShake((count) => count + 1);
      return;
    }
    setState("loading");
    setError(null);
    try {
      await verifyMfa(value);
      setState("success");
    } catch (failure) {
      setError(mfaErrorMessage(failure, "A kód ellenőrzése nem sikerült. Próbáld újra."));
      setState("idle");
      setCode("");
      setShake((count) => count + 1);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(code);
  };

  return (
    <div key={shake} className={cn("panel glow-border relative overflow-hidden p-7 sm:p-8 animate-rise", shake > 0 && "auth-shake")}>
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-emerald-400/10 blur-3xl"/>
      {state === "loading" && <div aria-hidden className="scan-line pointer-events-none absolute inset-x-0 opacity-60"/>}

      <div className="relative flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30">
          <ShieldCheck className="size-6"/>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">Kétlépcsős azonosítás</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Hitelesítő kód</h1>
          {user?.email && <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>}
        </div>
      </div>

      {state === "success" ? (
        <div className="relative flex flex-col items-center gap-3 py-10 text-center" role="status">
          <div className="relative grid size-16 place-items-center">
            <span className="ring-burst absolute inset-0 rounded-full ring-2 ring-emerald-400/60"/>
            <span className="grid size-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
              <Check className="size-8 text-emerald-300"/>
            </span>
          </div>
          <p className="font-medium text-white">Azonosítva</p>
          <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin"/> A rendszer betöltése…</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative mt-6 space-y-5" noValidate>
          <p className="flex items-start gap-2.5 text-sm text-slate-400">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-slate-500"/>
            Nyisd meg a hitelesítő alkalmazást a telefonodon, és írd be az SFSD Intranet mostani 6 jegyű kódját.
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-500/[0.08] p-3 ring-1 ring-red-500/30 animate-fade">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300"/>
              <p className="text-xs text-red-200/90">{error}</p>
            </div>
          )}

          <CodeInput value={code} onChange={setCode} onComplete={(value) => void submit(value)} autoFocus
                     disabled={state === "loading"} invalid={!!error} label="Hitelesítő kód"/>

          <Button type="submit" disabled={state === "loading" || code.length !== 6}
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 text-[15px] font-semibold text-black shadow-[0_10px_30px_-10px_rgb(16_185_129/0.8)] hover:brightness-110">
            {state === "loading" ? <><Loader2 className="animate-spin"/> Ellenőrzés…</> : <><ShieldCheck/> Belépés</>}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Elvesztetted a telefonod? Az Executive Staff kikapcsolhatja a fiókodon.</span>
            <button type="button" onClick={() => void signOut()}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              <LogOut className="size-3"/> Kilépés
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** The app frame's version: the code card on its own. */
export function MfaChallengePage() {
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">
        <MfaCodeCard/>
      </div>
    </AuthShell>
  );
}
