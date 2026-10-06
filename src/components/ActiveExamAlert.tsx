import {useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router";
import {ArrowRight, Timer} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {ACTIVE_ATTEMPT_EVENT, formatDuration, readActiveAttempt} from "@/lib/exams";

/**
 * A small "your exam is still running" chip on every other page (the clock runs on the server),
 * instead of a blocking overlay. Reads the hint the exam page keeps in this browser: no requests.
 */
export function ActiveExamAlert() {
  const location = useLocation();
  const navigate = useNavigate();
  const {user} = useAuth();
  const [hint, setHint] = useState(readActiveAttempt);
  const [, setTick] = useState(0);

  useEffect(() => {
    // The old exam page kept its whole state under these keys; they are obsolete.
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith("exam_session_")) localStorage.removeItem(key);
    }
    const update = () => setHint(readActiveAttempt());
    window.addEventListener(ACTIVE_ATTEMPT_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ACTIVE_ATTEMPT_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setInterval(() => {
      if (Date.parse(hint.deadline) <= Date.now()) setHint(readActiveAttempt());
      else setTick((tick) => tick + 1);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [hint]);

  // Not on the exam itself, nor on the exam centre (its card already says "continue").
  if (!hint || hint.owner !== (user?.id ?? "guest") || location.pathname.startsWith(`/exam/public/${hint.examId}`)
      || location.pathname === "/exams") return null;
  const left = Date.parse(hint.deadline) - Date.now();

  return (
    <button type="button" onClick={() => navigate(`/exam/public/${hint.examId}`)}
            className="animate-rise fixed right-4 bottom-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl bg-[#0b1426]/95 px-4 py-3 text-left shadow-2xl ring-1 ring-sky-400/30 backdrop-blur-xl transition hover:ring-sky-300/60">
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-200">
        <Timer className="size-4"/>
        <span className="absolute -top-0.5 -right-0.5 size-2.5 animate-ping rounded-full bg-sky-400"/>
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-sky-200/80">Folyamatban lévő vizsga</span>
        <span className="block max-w-[14rem] truncate text-sm font-semibold text-white">{hint.title}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">{formatDuration(Math.max(0, left))} van hátra · Folytatás <ArrowRight className="size-3"/></span>
      </span>
    </button>
  );
}
