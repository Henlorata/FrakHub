import {useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent} from "react";
import {Link, useNavigate} from "react-router";
import {
  AlertTriangle, ArrowRight, BookOpenCheck, Car, Check, Eye, EyeOff, FileSearch, KeyRound, Loader2, LogIn, Mail, Wallet,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useAuth} from "@/context/AuthContext";
import {cn} from "@/lib/utils";
import {AuthShell} from "./AuthShell";
import {MfaCodeCard} from "./MfaChallenge";

const EMAIL_KEY = "frakhub.login.email";

const FEATURES = [
  {icon: FileSearch, title: "Nyomozati akták", text: "Ügyek, bizonyítékok, gyanúsítottak és parancsok."},
  {icon: BookOpenCheck, title: "Akadémia és vizsgák", text: "Tananyagok, időre írt vizsgák, javítás."},
  {icon: Car, title: "Flotta", text: "Járművek, kulcsok, forgalmik és hibapontok."},
  {icon: Wallet, title: "Pénzügy", text: "Költségtérítés és havi fizetés a gyűlés után."},
];

/** Supabase auth errors in Hungarian. */
function loginError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Hibás email cím vagy jelszó.";
  if (/rate limit|too many/i.test(message)) return "Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.";
  if (/fetch|network/i.test(message)) return "Nem sikerült kapcsolódni a szerverhez. Ellenőrizd az internetkapcsolatot.";
  if (/email not confirmed/i.test(message)) return "Az email cím még nincs megerősítve.";
  return "A belépés nem sikerült. Próbáld újra.";
}

function Hero() {
  return (
    <section className="hidden lg:block">
      <div className="relative mb-10 size-48">
        <div className="absolute inset-[-28%] rounded-full bg-amber-400/10 blur-3xl emblem-breathe"/>
        <SheriffStar variant="hologram" spin className="absolute inset-[-22%] opacity-60"/>
        <div className="absolute inset-[-10%] rounded-full border border-amber-300/20 emblem-turn" style={{borderStyle: "dashed"}}/>
        <SheriffStar detail="seal" className="relative size-full drop-shadow-[0_18px_36px_rgb(0_0_0/0.55)] animate-float-y"/>
      </div>
      <p className="animate-rise text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">San Fierro Sheriff&apos;s Department</p>
      <h2 className="animate-rise mt-3 text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl" style={{"--i": 1} as CSSProperties}>
        A megye szolgálatában.<br/>
        <span className="text-gold">Egy helyen minden.</span>
      </h2>
      <p className="animate-rise mt-4 max-w-lg text-base text-slate-400" style={{"--i": 2} as CSSProperties}>
        A frakció belső rendszere: akták, személyügy, akadémia, flotta és pénzügy. Csak a frakció tagjainak.
      </p>
      <ul className="mt-8 grid max-w-xl grid-cols-2 gap-3">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} style={{"--i": index + 3} as CSSProperties}
              className="panel animate-rise flex items-start gap-3 p-3.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25">
              <feature.icon className="size-4"/>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{feature.title}</p>
              <p className="text-xs text-slate-500">{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sign-in: email and password of the member's account (accounts are approved by HR). */
export function LoginPage() {
  const navigate = useNavigate();
  const {supabase, session, profile, profileError, mfaRequired} = useAuth();
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Signed in: the app shell takes over (it also shows the retry screen on profile errors).
    if (session && (profile || profileError)) navigate("/dashboard", {replace: true});
  }, [session, profile, profileError, navigate]);

  useEffect(() => {
    if (email) passwordRef.current?.focus();
    // Only on the first render (a remembered email jumps to the password).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "loading") return;
    if (!email.trim() || !password) {
      setError("Add meg az email címedet és a jelszavadat.");
      setShake((value) => value + 1);
      return;
    }
    setState("loading");
    setError(null);
    const {error: signInError} = await supabase.auth.signInWithPassword({email: email.trim(), password});
    if (signInError) {
      setError(loginError(signInError));
      setState("idle");
      setShake((value) => value + 1);
      passwordRef.current?.select();
      return;
    }
    try {
      localStorage.setItem(EMAIL_KEY, email.trim());
    } catch {
      // Storage disabled: nothing to remember.
    }
    setState("success");
  };

  const watchCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <AuthShell aside={<Hero/>}>
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <SheriffStar className="size-20 drop-shadow-[0_8px_18px_rgb(0_0_0/0.55)] animate-float-y"/>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">San Fierro Sheriff&apos;s Department</p>
        </div>

        {/* Password accepted, the authenticator app's code comes next. */}
        {session && mfaRequired ? <MfaCodeCard/> : (
          <div key={shake} className={cn("panel glow-border relative overflow-hidden p-7 sm:p-8 animate-rise", shake > 0 && "auth-shake")}>
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-amber-400/10 blur-3xl"/>
            {state === "loading" && <div aria-hidden className="scan-line pointer-events-none absolute inset-x-0 opacity-60"/>}

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-300">Bejelentkezés</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">SFSD Intranet</h1>
              <p className="mt-1 text-sm text-slate-400">Lépj be a szolgálati fiókoddal.</p>
            </div>

            {state === "success" && session ? (
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
              <form onSubmit={(event) => void submit(event)} className="relative mt-7 space-y-5" noValidate>
                {error && (
                  <div role="alert" className="flex items-start gap-3 rounded-xl bg-red-500/[0.08] p-3 ring-1 ring-red-500/30 animate-fade">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300"/>
                    <div>
                      <p className="text-sm font-medium text-red-200">Belépés megtagadva</p>
                      <p className="text-xs text-red-200/80">{error}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-medium text-slate-300">Email cím</label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-amber-300"/>
                    <input id="login-email" type="email" autoComplete="username" required placeholder="badge@sfsd.com" value={email}
                           onChange={(event) => setEmail(event.target.value)}
                           className="h-12 w-full rounded-xl bg-white/[0.04] pr-3 pl-10 text-[15px] text-white ring-1 ring-white/10 outline-none transition placeholder:text-slate-600 focus:bg-white/[0.06] focus:ring-2 focus:ring-amber-400/60"/>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-300">Jelszó</label>
                  <div className="group relative">
                    <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-amber-300"/>
                    <input ref={passwordRef} id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                           placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)}
                           onKeyDown={watchCaps} onKeyUp={watchCaps}
                           className="h-12 w-full rounded-xl bg-white/[0.04] pr-11 pl-10 text-[15px] tracking-wide text-white ring-1 ring-white/10 outline-none transition placeholder:tracking-widest placeholder:text-slate-600 focus:bg-white/[0.06] focus:ring-2 focus:ring-amber-400/60"/>
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
                            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200">
                      {showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                    </button>
                  </div>
                  {capsLock && <p className="flex items-center gap-1.5 text-[11px] text-amber-300"><AlertTriangle className="size-3"/> A Caps Lock be van kapcsolva.</p>}
                </div>

                <Button type="submit" disabled={state === "loading"}
                        className="group relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-[15px] font-semibold text-black shadow-[0_10px_30px_-10px_rgb(234_179_8/0.8)] hover:brightness-110">
                  <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
                  {state === "loading" ? <><Loader2 className="animate-spin"/> Azonosítás…</> : <><LogIn/> Belépés</>}
                </Button>

                <p className="text-center text-[11px] text-slate-500">Elfelejtetted a jelszavad? A Személyügy (HR) új jelszót állít be.</p>
              </form>
            )}
          </div>
        )}

        {!(session && mfaRequired) && (
          <Link to="/register"
                className="panel lift group mt-4 flex items-center gap-3 p-4 text-left animate-rise" style={{"--i": 2} as CSSProperties}>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/25">
              <SheriffStar variant="hologram" className="size-6"/>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Még nincs fiókod?</p>
              <p className="text-xs text-slate-400">Fiók igénylése az intranetre. A frakcióba a fórumon lehet jelentkezni.</p>
            </div>
            <ArrowRight className="size-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-white"/>
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
