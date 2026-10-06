import {useCallback, useEffect, useState} from "react";
import {Link, useParams} from "react-router";
import {toast} from "sonner";
import {Loader2, Lock, SearchX} from "lucide-react";
import {Button} from "@/components/ui/button";
import {AppBackdrop} from "@/components/layout/AppBackdrop";
import {useAuth} from "@/context/AuthContext";
import {
  clearActiveAttempt, examApi, forgetGuestAttempt, loadGuestAttempt, storeGuestAttempt, type GuestAttempt,
} from "@/lib/exams";
import {errorMessage} from "@/lib/utils";
import type {AttemptPayload, AttemptStateReply, ExamIntro} from "@/types/exams";
import {ExamDone} from "./runner/ExamDone";
import {ExamLobby} from "./runner/ExamLobby";
import {ExamRunner} from "./runner/ExamRunner";

/** The exam page (outside the app shell, also for guests), on the animated backdrop. */
export function PublicExamPage() {
  return (
    <>
      <AppBackdrop/>
      <ExamPageContent/>
    </>
  );
}

type Phase = "loading" | "intro" | "running" | "done" | "missing" | "login" | "error";

function ExamPageContent() {
  const {examId = ""} = useParams();
  const {user, profile, session, loading: authLoading} = useAuth();
  const userId = user?.id ?? null;
  const [phase, setPhase] = useState<Phase>("loading");
  const [intro, setIntro] = useState<ExamIntro | null>(null);
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [result, setResult] = useState<AttemptStateReply | null>(null);
  const [guest, setGuest] = useState<GuestAttempt | null>(null);
  const [starting, setStarting] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);

  const begin = useCallback(async (applicantName: string | null, stored: GuestAttempt | null) => {
    setStarting(true);
    try {
      const reply = await examApi.start(examId, applicantName, userId ? null : stored);
      if (reply.finished) {
        setResult(reply as AttemptStateReply);
        setPhase("done");
        clearActiveAttempt(examId);
        return;
      }
      const attempt = reply as AttemptPayload;
      setClockOffset(Date.parse(attempt.server_now) - Date.now());
      if (!userId && attempt.secret) {
        const created = {attemptId: attempt.attempt.id, secret: attempt.secret};
        storeGuestAttempt(examId, created);
        setGuest(created);
      }
      setPayload(attempt);
      setPhase("running");
    } catch (error) {
      toast.error(errorMessage(error, "A vizsga indítása nem sikerült."));
      setPhase("intro");
    } finally {
      setStarting(false);
    }
  }, [examId, userId]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const stored = userId ? null : loadGuestAttempt(examId);
    setGuest(stored);
    setPhase("loading");
    examApi.intro(examId, stored)
      .then((reply) => {
        if (!active) return;
        if (!reply) return setPhase("missing");
        if ("login_required" in reply) return setPhase("login");
        setIntro(reply);
        // A reload (or "continue") goes straight back into the open attempt.
        if (reply.attempt?.status === "in_progress") {
          void begin(null, stored);
        } else {
          clearActiveAttempt(examId);
          setPhase("intro");
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [authLoading, userId, examId, begin]);

  if (phase === "loading" || authLoading || (phase === "intro" && !intro)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="size-9 animate-spin text-primary"/>
        <p className="text-sm">Vizsga betöltése…</p>
      </div>
    );
  }

  if (phase === "missing" || phase === "login" || phase === "error") {
    const login = phase === "login";
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="panel animate-pop w-full max-w-md space-y-5 p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
            {login ? <Lock className="size-7 text-slate-300"/> : <SearchX className="size-7 text-slate-300"/>}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {login ? "Bejelentkezés szükséges" : phase === "error" ? "Technikai hiba" : "A vizsga nem található"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {login ? "Ezt a vizsgát csak a frakció tagjai tölthetik ki."
                : phase === "error" ? "Nem sikerült betölteni a vizsgát. Próbáld újra kicsit később."
                  : "A link hibás, vagy a vizsgát törölték."}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button asChild><Link to={login ? "/login" : userId ? "/exams" : "/login"}>{login || !userId ? "Bejelentkezés" : "Vizsgaközpont"}</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "running" && payload) {
    return (
      <ExamRunner payload={payload} clockOffset={clockOffset} secret={userId ? null : guest?.secret ?? null}
                  accessToken={session?.access_token ?? null}
                  owner={userId ?? "guest"} candidateName={profile?.full_name ?? payload.attempt.applicant_name ?? ""}
                  onFinished={(reply) => {
                    setResult(reply);
                    setPhase("done");
                  }}/>
    );
  }

  if (phase === "done" && result) {
    return (
      <ExamDone reply={result} title={payload?.exam.title ?? intro?.exam.title ?? ""}
                passingPercentage={payload?.exam.passing_percentage ?? intro?.exam.passing_percentage ?? 0}
                signedIn={!!userId} member={!!intro?.viewer.member}/>
    );
  }

  return intro ? (
    <ExamLobby
      intro={intro}
      guestFinished={!userId && intro.attempt && intro.attempt.status !== "in_progress" ? intro.attempt : null}
      starting={starting}
      onStart={(name) => void begin(name, null)}
      onNewGuestAttempt={() => {
        forgetGuestAttempt(examId);
        setGuest(null);
        setIntro({...intro, attempt: null});
      }}
    />
  ) : null;
}
