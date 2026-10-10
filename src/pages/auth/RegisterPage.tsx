import {useMemo, useState, type CSSProperties, type FormEvent, type ReactNode} from "react";
import {Link, useNavigate} from "react-router";
import {toast} from "sonner";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Check, ClipboardCheck, Crosshair, Eye, EyeOff, GraduationCap, Hash, KeyRound, Loader2, Mail,
  Search, Send, Shield, UserRound, Users,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {FACTION_RANKS} from "@shared/ranks";
import {postApi} from "@/lib/api";
import {FORUM_APPLICATIONS_URL} from "@/lib/forum";
import {cn, errorMessage} from "@/lib/utils";
import {AuthShell, type AuthTone} from "./AuthShell";
import {DIVISION_LOOK, IdCardPreview, type CardDivision} from "./IdCardPreview";

const DIVISIONS: {id: CardDivision; icon: typeof Shield; tone: AuthTone; text: string}[] = [
  {id: "TSB", icon: Shield, tone: "gold", text: "Járőrszolgálat, az állomány gerince. Innen indul mindenki."},
  {id: "SEB", icon: Crosshair, tone: "red", text: "Taktikai és különleges bevetések."},
  {id: "MCB", icon: Search, tone: "blue", text: "Nyomozás, akták, súlyos bűncselekmények."},
];

const STEPS = [
  {icon: Send, title: "Kérelem", text: "Most beküldöd az adataidat."},
  {icon: ClipboardCheck, title: "Jóváhagyás", text: "A Személyügy ellenőrzi és jóváhagyja a fiókodat."},
  {icon: GraduationCap, title: "Akadémia", text: "Trainee-ként végigjárod az öt napos alapképzést."},
  {icon: BadgeCheck, title: "Szolgálat", text: "Sikeres vizsga után teljes jogú deputy leszel."},
];

/** 0–4: length, letters and digits, mixed case, symbols. */
function passwordScore(password: string) {
  if (!password) return 0;
  let score = password.length >= 6 ? 1 : 0;
  if (password.length >= 10) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score += 1;
  return score;
}
const SCORE_LABEL = ["", "Gyenge", "Elfogadható", "Jó", "Erős"];
const SCORE_COLOR = ["bg-white/10", "bg-red-400", "bg-amber-400", "bg-lime-400", "bg-emerald-400"];

const inputClass = "h-12 w-full rounded-xl bg-white/[0.04] pr-3 pl-10 text-[15px] text-white ring-1 ring-white/10 outline-none transition placeholder:text-slate-600 focus:bg-white/[0.06] focus:ring-2 focus:ring-[var(--accent)]";

function Section({number, title, children, index}: {number: number; title: string; children: ReactNode; index: number}) {
  return (
    <fieldset className="animate-rise space-y-3" style={{"--i": index} as CSSProperties}>
      <legend className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span className="grid size-5 place-items-center rounded-full bg-white/[0.06] text-[10px] text-white ring-1 ring-white/15">{number}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({id, label, icon: Icon, hint, children}: {id: string; label: string; icon: typeof Shield; hint?: ReactNode; children: ReactNode}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-300">{label}</label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[var(--accent)]"/>
        {children}
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** Self-registration: the account is created as pending; HR approves it. */
export function RegisterPage() {
  const navigate = useNavigate();
  const {recruitmentOpen} = useSystemStatus();
  const [fullName, setFullName] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [division, setDivision] = useState<CardDivision>("TSB");
  const [rank, setRank] = useState<string>("Deputy Sheriff Trainee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tone = DIVISIONS.find((item) => item.id === division)?.tone ?? "gold";
  const accent = tone === "red" ? "#f87171" : tone === "blue" ? "#38bdf8" : "#fbbf24";
  const score = passwordScore(password);
  const nameWords = fullName.trim().split(/\s+/).filter(Boolean).length;
  const ready = useMemo(() => fullName.trim().length >= 3 && badgeNumber.length === 4 && email.includes("@") && password.length >= 6,
    [fullName, badgeNumber, email, password]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (badgeNumber.length !== 4) return setError("A jelvényszámnak pontosan 4 számjegyűnek kell lennie!");
    setSaving(true);
    try {
      await postApi("/api/register", {
        email: email.trim(), password, full_name: fullName.trim(), badge_number: badgeNumber, faction_rank: rank, division,
      }, {authenticated: false});
      toast.success("Kérelem beküldve", {description: "Jelentkezz be: a fiókod a Személyügy jóváhagyása után lesz aktív."});
      navigate("/login");
    } catch (failure) {
      setError(errorMessage(failure, "Hiba történt a regisztráció során."));
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <section className="hidden space-y-8 lg:block">
      <div className="animate-rise">
        <IdCardPreview name={fullName} badge={badgeNumber} rank={rank} division={division} active={fullName.length > 0}/>
      </div>
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((step, index) => (
          <li key={step.title} style={{"--i": index + 2} as CSSProperties} className="animate-rise relative">
            {index < STEPS.length - 1 && <span aria-hidden className="absolute top-5 left-[calc(50%+22px)] h-px w-[calc(100%-32px)] bg-gradient-to-r from-white/25 to-white/5"/>}
            <div className={cn("mx-auto grid size-10 place-items-center rounded-full ring-1", index === 0 ? "bg-white/10 text-white ring-white/30" : "bg-white/[0.03] text-slate-400 ring-white/10")}>
              <step.icon className="size-4"/>
            </div>
            <p className="mt-2 text-center text-xs font-medium text-white">{step.title}</p>
            <p className="mt-0.5 text-center text-[11px] leading-snug text-slate-500">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );

  return (
    <AuthShell tone={tone} aside={aside} asideLast>
      <div className="mx-auto w-full max-w-xl lg:mx-0" style={{"--accent": accent} as CSSProperties}>
        <div className="panel glow-border relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full blur-3xl transition-colors duration-700"
               style={{background: `${accent}22`}}/>
          <div className="relative flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{color: accent}}>Regisztrációs kérelem</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Regisztráció az intranetre</h1>
              <p className="mt-1 text-sm text-slate-400">Töltsd ki az IC adataiddal; a fiókod a Személyügy jóváhagyása után lesz aktív.</p>
              <p className="mt-1 text-xs text-slate-500">
                Még nem vagy a frakció tagja? Jelentkezni a{" "}
                <a href={FORUM_APPLICATIONS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-200 underline-offset-2 hover:underline">
                  fórum Jelentkezések rovatában
                </a>{" "}lehet.
              </p>
            </div>
            <Link to="/login" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white">
              <ArrowLeft className="size-3.5"/> Belépés
            </Link>
          </div>

          {!recruitmentOpen && (
            <div className="relative mt-5 flex gap-3 rounded-xl bg-red-500/[0.08] p-3 text-xs text-red-200 ring-1 ring-red-500/30">
              <AlertTriangle className="size-4 shrink-0 text-red-300"/>
              <p>A frakcióban jelenleg <strong>létszámstop</strong> van érvényben. A regisztráció leadható, de a jóváhagyás a szokásosnál jóval
                több időt vehet igénybe.</p>
            </div>
          )}

          <form onSubmit={(event) => void submit(event)} className="relative mt-6 space-y-7" noValidate>
            <Section number={1} title="Személyes adatok" index={1}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <Field id="register-name" label="Teljes név (IC)" icon={UserRound}
                       hint={fullName && nameWords < 2 ? "Vezeték- és keresztnév, ahogy a játékban szerepel." : "Ahogy a játékban szerepel."}>
                  <input id="register-name" required autoComplete="name" placeholder="John Doe" maxLength={64} value={fullName}
                         onChange={(event) => setFullName(event.target.value)} className={inputClass}/>
                </Field>
                <Field id="register-badge" label="Jelvényszám" icon={Hash} hint="4 számjegy">
                  <input id="register-badge" required inputMode="numeric" placeholder="0000" value={badgeNumber}
                         onChange={(event) => setBadgeNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
                         className={cn(inputClass, "font-mono tracking-[0.3em]")}/>
                </Field>
              </div>
            </Section>

            <Section number={2} title="Beosztás" index={2}>
              <div role="radiogroup" aria-label="Osztály" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DIVISIONS.map((item) => {
                  const look = DIVISION_LOOK[item.id];
                  const selected = division === item.id;
                  return (
                    <button key={item.id} type="button" role="radio" aria-checked={selected} onClick={() => setDivision(item.id)}
                            className={cn("lift relative flex flex-col items-start gap-2 overflow-hidden rounded-xl p-3 text-left ring-1 transition-all",
                              selected ? cn("bg-white/[0.07]", look.ring) : "bg-white/[0.02] ring-white/10 hover:bg-white/[0.05]")}>
                      {selected && <span className={cn("absolute inset-x-0 top-0 h-0.5", look.bar)}/>}
                      <span className="flex w-full items-center gap-2">
                        {look.logo ? <img src={look.logo} alt="" className="size-7 object-contain"/> : <item.icon className={cn("size-6", look.text)}/>}
                        <span className={cn("font-mono text-sm font-bold", selected ? look.text : "text-slate-200")}>{item.id}</span>
                        {selected && <Check className={cn("ml-auto size-4", look.text)}/>}
                      </span>
                      <span className="text-[11px] font-medium text-white">{look.title}</span>
                      <span className="text-[11px] leading-snug text-slate-500">{item.text}</span>
                    </button>
                  );
                })}
              </div>
              <Field id="register-rank" label="Rendfokozat" icon={Users}
                     hint="Új tagként Deputy Sheriff Trainee-ként kezdesz. Ha visszatérsz, a korábbi rangodat a Személyügy ellenőrzi.">
                <select id="register-rank" value={rank} onChange={(event) => setRank(event.target.value)} className={cn(inputClass, "appearance-none")}>
                  {FACTION_RANKS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
            </Section>

            <Section number={3} title="Belépési adatok" index={3}>
              <Field id="register-email" label="Email cím" icon={Mail} hint="Ezzel lépsz be. Más nem látja.">
                <input id="register-email" required type="email" autoComplete="email" placeholder="email@example.com" maxLength={254} value={email}
                       onChange={(event) => setEmail(event.target.value)} className={inputClass}/>
              </Field>
              <div className="space-y-1.5">
                <label htmlFor="register-password" className="text-xs font-medium text-slate-300">Jelszó</label>
                <div className="group relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[var(--accent)]"/>
                  <input id="register-password" required type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={6} maxLength={72}
                         placeholder="Legalább 6 karakter" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(inputClass, "pr-11")}/>
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
                          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200">
                    {showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((step) => (
                      <span key={step} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", score >= step ? SCORE_COLOR[score] : "bg-white/10")}/>
                    ))}
                  </div>
                  <span className="w-20 text-right text-[11px] text-slate-400">{SCORE_LABEL[score]}</span>
                </div>
              </div>
            </Section>

            {error && (
              <div role="alert" className="rounded-xl bg-red-500/[0.08] p-3 text-sm text-red-200 ring-1 ring-red-500/30 animate-fade">{error}</div>
            )}

            <Button type="submit" disabled={saving || !ready}
                    className="group relative h-12 w-full overflow-hidden rounded-xl text-[15px] font-semibold text-black transition-[filter] hover:brightness-110"
                    style={{background: `linear-gradient(90deg, ${accent}, ${accent}cc)`}}>
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
              {saving ? <><Loader2 className="animate-spin"/> Küldés…</> : <><Send/> Regisztráció küldése</>}
            </Button>
            <p className="text-center text-xs text-slate-500">
              Már van fiókod? <Link to="/login" className="font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">Belépés</Link>
            </p>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
