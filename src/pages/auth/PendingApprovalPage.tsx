import type {CSSProperties} from "react";
import {AlertTriangle, BadgeCheck, ClipboardCheck, Clock3, GraduationCap, LogOut, Send} from "lucide-react";
import {Button} from "@/components/ui/button";
import {SheriffStar} from "@/components/brand/SheriffStar";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {formatDate} from "@/lib/datetime";
import {cn} from "@/lib/utils";
import {AuthShell} from "./AuthShell";

const STEPS = [
  {icon: Send, title: "Kérelem beküldve", done: true},
  {icon: ClipboardCheck, title: "Személyügyi jóváhagyás", current: true},
  {icon: GraduationCap, title: "Akadémia (Trainee)"},
  {icon: BadgeCheck, title: "Szolgálat"},
];

/** What a registered but not yet approved account sees after signing in. */
export function PendingApprovalPage() {
  const {profile, signOut} = useAuth();
  const {recruitmentOpen} = useSystemStatus();

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-xl text-center">
        <div className="relative mx-auto mb-8 size-28">
          <span className="absolute inset-0 rounded-full bg-amber-400/15 blur-2xl emblem-breathe"/>
          <span className="absolute inset-[-14%] rounded-full border border-dashed border-amber-300/25 emblem-turn"/>
          <SheriffStar className="relative size-full drop-shadow-[0_0_30px_rgb(234_179_8/0.45)]"/>
          <span className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full bg-[#0b1220] ring-1 ring-amber-400/40">
            <Clock3 className="size-4 text-amber-300 animate-pulse"/>
          </span>
        </div>
        <h1 className="animate-rise text-3xl font-semibold tracking-tight text-white">Jóváhagyásra Vár</h1>
        <p className="animate-rise mt-2 text-slate-400" style={{"--i": 1} as CSSProperties}>
          Üdvözlünk, <span className="font-medium text-amber-300">{profile?.full_name}</span>! A fiókod létrejött; a Személyügy hamarosan
          ellenőrzi az adataidat.
        </p>

        <div className="panel animate-rise mt-8 p-6 text-left" style={{"--i": 2} as CSSProperties}>
          {!recruitmentOpen && (
            <div className="mb-5 flex gap-3 rounded-xl bg-red-500/[0.08] p-3 text-xs text-red-200 ring-1 ring-red-500/30">
              <AlertTriangle className="size-4 shrink-0 text-red-300"/>
              <p>A frakcióban jelenleg <strong>létszámstop</strong> van érvényben: a jelentkezésed elfogadása a szokásosnál jóval több időt vehet igénybe.</p>
            </div>
          )}
          <ol className="space-y-3">
            {STEPS.map((step) => (
              <li key={step.title} className="flex items-center gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full ring-1",
                  step.done ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                    : step.current ? "bg-amber-500/15 text-amber-300 ring-amber-400/50" : "bg-white/[0.03] text-slate-500 ring-white/10")}>
                  <step.icon className="size-4"/>
                </span>
                <span className={cn("text-sm", step.current ? "font-medium text-white" : step.done ? "text-slate-300" : "text-slate-500")}>{step.title}</span>
                {step.current && <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30">folyamatban</span>}
                {step.done && <span className="ml-auto text-[11px] text-emerald-300">kész</span>}
              </li>
            ))}
          </ol>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-xs">
            <div><p className="text-slate-500">Jelvényszám</p><p className="font-mono text-slate-200">{profile?.badge_number ?? "–"}</p></div>
            <div><p className="text-slate-500">Rendfokozat</p><p className="truncate text-slate-200">{profile?.faction_rank ?? "–"}</p></div>
            <div><p className="text-slate-500">Beküldve</p><p className="text-slate-200">{formatDate(profile?.created_at)}</p></div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">A jóváhagyás után frissítsd az oldalt, vagy lépj be újra.</p>
        <Button variant="ghost" className="mt-4 text-slate-300 hover:text-white" onClick={signOut}><LogOut/> Kijelentkezés</Button>
      </div>
    </AuthShell>
  );
}
