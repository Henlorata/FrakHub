import {useEffect, useRef, useState} from "react";
import {Clock} from "lucide-react";
import {formatClock} from "@/lib/exams";
import {cn} from "@/lib/utils";

interface ExamTimerProps {
  deadline: number;
  totalMs: number;
  now: () => number;
  /** Called once when the time is up. */
  onExpire: () => void;
  /** Called once at 5 and at 1 minute left. */
  onWarning: (minutesLeft: 5 | 1) => void;
}

/** The countdown of the server's deadline. Re-renders itself only, once a second. */
export function ExamTimer({deadline, totalMs, now, onExpire, onWarning}: ExamTimerProps) {
  const [left, setLeft] = useState(() => deadline - now());
  const fired = useRef({expire: false, five: false, one: false});
  const handlers = useRef({onExpire, onWarning});

  useEffect(() => {
    handlers.current = {onExpire, onWarning};
  }, [onExpire, onWarning]);

  useEffect(() => {
    const tick = () => {
      const remaining = deadline - now();
      setLeft(remaining);
      // Warnings only on the way down (not when the exam is reopened with little time left).
      if (remaining <= 5 * 60_000 && remaining > 4 * 60_000 && !fired.current.five) {
        fired.current.five = true;
        handlers.current.onWarning(5);
      }
      if (remaining <= 60_000 && remaining > 30_000 && !fired.current.one) {
        fired.current.one = true;
        handlers.current.onWarning(1);
      }
      if (remaining <= 0 && !fired.current.expire) {
        fired.current.expire = true;
        handlers.current.onExpire();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, now]);

  const urgent = left <= 60_000;
  const low = left <= 5 * 60_000;
  const share = totalMs > 0 ? Math.max(0, Math.min(1, left / totalMs)) : 0;

  return (
    <div
      role="timer"
      aria-label="Hátralévő idő"
      className={cn("relative flex items-center gap-2 overflow-hidden rounded-full px-3.5 py-1.5 text-sm font-semibold tabular-nums ring-1 transition-colors duration-500",
        urgent ? "bg-red-500/15 text-red-200 ring-red-400/40" : low ? "bg-amber-500/10 text-amber-200 ring-amber-400/30" : "bg-white/[0.04] text-slate-100 ring-white/10")}
    >
      <Clock className={cn("size-4", urgent && "animate-pulse")}/>
      {formatClock(left)}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
        <span className={cn("block h-full origin-left transition-[transform] duration-1000 ease-linear",
          urgent ? "bg-red-400" : low ? "bg-amber-400" : "bg-primary/70")} style={{transform: `scaleX(${share})`}}/>
      </span>
    </div>
  );
}
