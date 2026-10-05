import {useState} from "react";
import {Link} from "react-router";
import {toast} from "sonner";
import {Check, Copy, Hourglass, LogIn, UserPlus, XCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import type {AttemptStateReply} from "@/types/exams";
import {ScoreRing} from "../grading/ScoreRing";

/** The guest's claim code, large, with a copy button. */
export function ClaimCode({code}: {code: string}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("A másolás nem sikerült; írd fel a kódot.");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-black/30 p-4 ring-1 ring-yellow-400/25">
      <code className="flex-1 font-mono text-2xl font-bold tracking-[0.2em] text-yellow-200 select-all">{code}</code>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <Check/> : <Copy/>} {copied ? "Másolva" : "Másolás"}
      </Button>
    </div>
  );
}

interface ExamDoneProps {
  reply: AttemptStateReply;
  title: string;
  passingPercentage: number;
  signedIn: boolean;
  member: boolean;
}

/** After the hand-in: what happens next (and the result of an auto-graded quiz). */
export function ExamDone({reply, title, passingPercentage, signedIn, member}: ExamDoneProps) {
  const {attempt} = reply;
  const decided = attempt.status === "passed" || attempt.status === "failed";
  const removed = attempt.status === "removed";
  const passed = attempt.status === "passed";
  const heading = removed ? "A vizsgalapot lezárták"
    : decided ? (passed ? "Sikeres vizsga!" : "Ezúttal nem sikerült")
      : attempt.finish_reason === "submitted" ? "Vizsgalap leadva" : "Lejárt az idő, a lapot leadtuk";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-12">
      <section className="panel glow-border animate-pop w-full space-y-6 p-7 text-center md:p-9">
        <div className="relative mx-auto grid size-24 place-items-center">
          {!removed && <span className={cn("ring-burst absolute inset-0 rounded-full ring-2", decided && !passed ? "ring-red-400/50" : "ring-emerald-400/50")}/>}
          {decided ? (
            <ScoreRing percent={attempt.percentage ?? 0} passing={passingPercentage} size={96}/>
          ) : removed ? (
            <span className="grid size-20 place-items-center rounded-full bg-slate-500/10 ring-1 ring-slate-400/30"><XCircle className="size-9 text-slate-300"/></span>
          ) : (
            <span className="grid size-20 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
              <svg viewBox="0 0 24 24" className="size-10 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" className="draw-check"/>
              </svg>
            </span>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yellow-400/90 wrap-anywhere">{title}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{heading}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            {removed ? "Egy oktató lezárta ezt a kitöltést. Ha szerinted tévedés, keresd meg őt."
              : decided ? (passed
                  ? `Elérted a ${passingPercentage}%-os határt. Az eredmény a profilodon is megjelenik.`
                  : `A sikeres határ ${passingPercentage}%. Nézd át az anyagot, és próbáld újra, amikor lehet.`)
                : member ? "A javítók értesítést kaptak. Amint végeztek, az eredményről értesítést kapsz."
                  : "A javítók értesítést kaptak. Az eredményt a profilodhoz kapcsolás után látod."}
          </p>
        </div>

        {attempt.claim_token && (
          <div className="space-y-2 text-left">
            <p className="text-sm font-semibold text-white">A vizsgakódod</p>
            <ClaimCode code={attempt.claim_token}/>
            <p className="text-xs text-slate-400">
              Írd fel vagy másold ki! A regisztráció és a jóváhagyás után az első belépéskor ezzel a kóddal kapcsolod a vizsgát a profilodhoz.
            </p>
          </div>
        )}

        {!decided && !removed && !attempt.claim_token && (
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500"><Hourglass className="size-3.5"/> A javítás általában pár napon belül megtörténik.</p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {member ? (
            <>
              <Button asChild><Link to="/exams">Vissza a vizsgaközponthoz</Link></Button>
              {decided && <Button asChild variant="outline"><Link to={`/exams/grading/${attempt.id}`}>Lap megtekintése</Link></Button>}
            </>
          ) : signedIn ? (
            <Button asChild><Link to="/">Tovább</Link></Button>
          ) : (
            <>
              <Button asChild><Link to="/register"><UserPlus/> Regisztráció</Link></Button>
              <Button asChild variant="outline"><Link to="/login"><LogIn/> Bejelentkezés</Link></Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
