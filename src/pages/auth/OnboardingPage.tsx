import {lazy, Suspense, useEffect, useState, type CSSProperties} from "react";
import {
  ArrowLeft, BadgeCheck, CheckCircle2, ClipboardCheck, Compass, FlaskConical, GraduationCap, HelpCircle, KeyRound, Loader2, LogOut,
  Map as MapIcon, Radio, ShieldCheck, Sparkles, Users,
} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {FIRST_DAY_RULES} from "@/data/radio-codes";
import {cn, errorMessage} from "@/lib/utils";
import {AuthShell} from "./AuthShell";
import {IdCardPreview, type CardDivision} from "./IdCardPreview";

/** Where the code is: a sample of the result screen the exam shows at the end. */
function ResultSlip() {
  return (
    <figure className="animate-fade mt-auto pt-6">
      <div className="relative overflow-hidden rounded-xl bg-[#0a1222] p-4 ring-1 ring-white/10">
        <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-emerald-500/10 blur-2xl"/>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"><CheckCircle2 className="size-5"/></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Sikeres vizsga</p>
            <p className="truncate text-xs text-slate-500">TGF felvételi vizsga · eredményed: 86%</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Vizsgakód</span>
          <span className="rounded-md bg-amber-500/10 px-2 py-1 font-mono text-sm font-semibold tracking-[0.2em] text-amber-200 ring-1 ring-amber-400/50 motion-safe:animate-pulse">
            TR-7K2M-Q9XD
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-300"><ArrowLeft className="size-3.5"/> ezt írd be</span>
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] text-slate-500">Minta: a vizsga végén ez a lap jelenik meg; a te kódod más.</figcaption>
    </figure>
  );
}

const PracticeCorner = lazy(async () => ({default: (await import("./onboarding/PracticeCorner")).PracticeCorner}));

/** "tr abcd-efg h" -> "TR-ABCD-EFGH" (the code shown at the end of the recruitment exam). */
function formatClaimCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw.startsWith("TR")) return raw.slice(0, 12);
  const rest = raw.slice(2, 10);
  return ["TR", rest.slice(0, 4), rest.slice(4, 8)].filter(Boolean).join("-");
}

const NEXT_STEPS = [
  {icon: GraduationCap, title: "Akadémia", text: "Az oktatók napokra bontva vezetnek végig az alapokon."},
  {icon: Users, title: "Kísért szolgálat", text: "Legalább 7 napig csak tapasztalt társsal járőrözhetsz."},
  {icon: ClipboardCheck, title: "Deputy vizsga", text: "Ha a kiképződ alkalmasnak talál, ő keres fel a vizsgával."},
  {icon: BadgeCheck, title: "Deputy Sheriff I.", text: "Önálló szolgálat, saját járőrautó és teljes hozzáférés."},
];

/**
 * First stop of an accepted applicant (Deputy Sheriff Trainee): link the recruitment exam with its
 * code, read the essentials, practise radio codes, then enter the site where an interactive training
 * shows every part of it.
 */
export function OnboardingPage() {
  const {user, profile, supabase, signOut, refreshProfile} = useAuth();
  const userId = user?.id;
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState<boolean | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"claim" | "finish" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Already linked earlier (e.g. by a supervisor)? AppLayout leaves this page once onboarding is done.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase.from("exam_submissions").select("id").eq("user_id", userId).eq("status", "passed").not("claim_token", "is", null).limit(1)
      .then(({data, error}) => {
        if (active) setLinked(!error && !!data && data.length > 0);
      });
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  const claim = async () => {
    if (code.length < 12) return toast.error("A kód formátuma: TR-XXXX-XXXX.");
    setBusy("claim");
    try {
      const {data, error} = await supabase.rpc("claim_exam_submission", {_token: code});
      if (error) throw error;
      const result = data as {success?: boolean; message?: string} | null;
      if (result?.success) {
        toast.success(result.message ?? "A vizsgád összekapcsolva.");
        setLinked(true);
      } else {
        toast.error(result?.message ?? "A kód nem érvényes.");
      }
    } catch (error) {
      toast.error("A kód ellenőrzése nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    setBusy("finish");
    try {
      const {error} = await supabase.rpc("complete_onboarding");
      if (error) throw error;
      toast.success("Üdv a csapatban!", {description: "Egy rövid, interaktív bemutató végigvezet a felületen."});
      await refreshProfile();
    } catch (error) {
      toast.error("A belépés nem sikerült.", {description: errorMessage(error)});
    } finally {
      setBusy(null);
    }
  };

  if (!profile) return null;
  const firstName = profile.full_name.split(" ")[0];
  const division = (["TSB", "SEB", "MCB"].includes(profile.division) ? profile.division : "TSB") as CardDivision;
  const steps = [
    {label: "Vizsga összekapcsolása", done: linked === true},
    {label: "Tudnivalók", done: acknowledged},
    {label: "Szolgálatba lépés", done: false},
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <AuthShell embedded tone="gold">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="animate-rise">
            <p className="flex items-center gap-2 text-amber-300/90">
              <ShieldCheck className="size-5"/><span className="text-xs font-bold tracking-[0.3em] uppercase">Felvételt nyertél</span>
            </p>
            <h1 className="mt-3 text-4xl leading-[0.95] font-black tracking-tighter text-white uppercase md:text-5xl">
              Gratulálunk,<br/><span className="bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">{firstName}.</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-300">
              Három lépés választ el a szolgálattól. Belépés után egy rövid, interaktív bemutató végigvezet a FrakHub minden részén, a saját
              tempódban.
            </p>
            <ol className="mt-6 grid grid-cols-3 gap-2">
              {steps.map((step, index) => (
                <li key={step.label} className={cn("relative rounded-xl p-3 ring-1 transition",
                  step.done ? "bg-emerald-500/10 ring-emerald-500/30" : index === current ? "bg-amber-500/10 ring-amber-500/40" : "bg-white/[0.03] ring-white/10")}>
                  <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold",
                    step.done ? "bg-emerald-500 text-black" : index === current ? "bg-amber-400 text-black" : "bg-white/10 text-slate-400")}>
                    {step.done ? <CheckCircle2 className="size-4"/> : index + 1}
                  </span>
                  <p className={cn("mt-2 text-xs font-medium leading-tight", step.done ? "text-emerald-200" : index === current ? "text-white" : "text-slate-500")}>
                    {step.label}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="animate-rise mx-auto w-full max-w-md" style={{"--i": 1} as CSSProperties}>
            <IdCardPreview name={profile.full_name} badge={profile.badge_number} rank={profile.faction_rank} division={division} active
                           stamp={linked ? "Felvéve" : "Kiképzés"} stampTone={linked ? "emerald" : "amber"}/>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={cn("panel animate-rise relative flex flex-col overflow-hidden p-6", linked ? "ring-1 ring-emerald-500/30" : "ring-1 ring-amber-500/30")}
                   style={{"--i": 2} as CSSProperties}>
            <header className="flex items-center gap-3">
              <span className={cn("grid size-10 place-items-center rounded-xl ring-1",
                linked ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/10 text-amber-300 ring-amber-500/30")}>
                <KeyRound className="size-5"/>
              </span>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">1. lépés</p>
                <h2 className="font-semibold text-white">A felvételi vizsgád</h2>
              </div>
            </header>
            {linked === null ? (
              <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-slate-500"/></div>
            ) : linked ? (
              <div className="animate-pop mt-6 flex items-center gap-4 rounded-xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/30">
                <span className="grid size-12 place-items-center rounded-full bg-emerald-500 text-black shadow-[0_0_24px_rgb(16_185_129/0.5)]">
                  <CheckCircle2 className="size-6"/>
                </span>
                <div>
                  <p className="font-semibold text-emerald-200">Összekapcsolva</p>
                  <p className="text-sm text-slate-400">A felvételi vizsgád a fiókodhoz került.</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-slate-400">A vizsga végén kapott kóddal kapcsold a vizsgát a fiókodhoz.</p>
                <div className="flex gap-2">
                  <Input value={code} onChange={(event) => setCode(formatClaimCode(event.target.value))} placeholder="TR-XXXX-XXXX"
                         onKeyDown={(event) => event.key === "Enter" && void claim()} maxLength={12} aria-label="Vizsgakód"
                         className="h-11 text-center font-mono text-lg tracking-[0.25em] uppercase"/>
                  <Button onClick={() => void claim()} disabled={busy === "claim" || code.length < 12} className="h-11 bg-amber-500 px-5 text-black hover:bg-amber-400">
                    {busy === "claim" ? <Loader2 className="size-4 animate-spin"/> : "Csatolás"}
                  </Button>
                </div>
                <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                  <HelpCircle className="size-3.5"/> Elvesztetted a kódot?
                </button>
              </div>
            )}
            {linked === false && <ResultSlip/>}
            {linked && (
              <div className="animate-fade mt-auto pt-6">
                <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.07]">
                  <FlaskConical className="mt-0.5 size-5 shrink-0 text-emerald-300"/>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Belépés után egy <strong className="text-white">pár perces, kattintós bemutató</strong> indul bemutató adatokkal: megmutatja a menüt,
                    a kalkulátort, a jelentéseket és a járműveket. Semmit nem rontasz el benne.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="panel animate-rise p-6" style={{"--i": 3} as CSSProperties}>
            <header className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30"><Compass className="size-5"/></span>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">2. lépés</p>
                <h2 className="font-semibold text-white">Amit az első napokon tudnod kell</h2>
              </div>
            </header>
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FIRST_DAY_RULES.map((rule, index) => (
                <li key={rule.title} className="animate-rise rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10" style={{"--i": index} as CSSProperties}>
                  <p className="text-sm font-semibold text-white">{rule.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{rule.text}</p>
                </li>
              ))}
            </ul>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-white/[0.03] p-3 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05]">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="size-4 accent-amber-500"/>
              Elolvastam és megértettem.
            </label>
          </section>
        </div>

        <Suspense fallback={<div className="skeleton h-72 rounded-2xl"/>}>
          <PracticeCorner/>
        </Suspense>

        <section className="panel animate-rise grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center" style={{"--i": 5} as CSSProperties}>
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase"><MapIcon className="size-3.5"/> Az út előtted</p>
            <ol className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="relative">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/[0.04] text-amber-300 ring-1 ring-white/10"><step.icon className="size-4"/></span>
                  <p className="mt-2 text-sm font-semibold text-white">{index + 1}. {step.title}</p>
                  <p className="text-xs leading-relaxed text-slate-400">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-3 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent p-5 ring-1 ring-amber-500/25">
            <p className="flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="size-4 text-amber-300"/> 3. lépés: szolgálatba lépés</p>
            <p className="text-xs text-slate-400">
              {linked ? acknowledged ? "Minden kész. Belépés után indul az interaktív bemutató." : "Pipáld ki a tudnivalókat."
                : "Előbb kapcsold össze a felvételi vizsgádat."}
            </p>
            <Button onClick={() => void finish()} disabled={!linked || !acknowledged || busy === "finish"}
                    className="h-12 w-full bg-amber-500 text-base font-semibold text-black shadow-[0_0_30px_-8px_rgb(245_158_11/0.8)] hover:bg-amber-400">
              {busy === "finish" ? <Loader2 className="size-5 animate-spin"/> : <Radio className="size-5"/>} Szolgálatba lépek (10-8)
            </Button>
          </div>
        </section>

        <div className="flex justify-center pb-4">
          <Button variant="ghost" onClick={() => void signOut()} className="text-slate-400 hover:text-white"><LogOut className="size-4"/> Kijelentkezés</Button>
        </div>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Elveszett vizsgakód</DialogTitle>
            <DialogDescription>A Supervisory Staff (Sergeant és felette) kézzel is hozzád tudja rendelni a vizsgádat.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-300">Írj nekik Discordon vagy TeamSpeaken, és add meg a karakterneved:</p>
          <p className="rounded-xl bg-black/30 p-3 text-center text-lg font-semibold text-amber-200 ring-1 ring-white/10">{profile.full_name}</p>
        </DialogContent>
      </Dialog>
    </AuthShell>
  );
}
