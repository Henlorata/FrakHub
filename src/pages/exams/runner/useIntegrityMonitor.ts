import {useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent} from "react";
import type {IntegrityEvent} from "@/types/exams";

/** Shorter absences (a click on the browser bar, a notification) are not worth logging. */
const MIN_AWAY_MS = 1500;

interface Options {
  /** Server time of the attempt's start (ms), so the log lines up with the server clock. */
  startedAt: number;
  /** Server-corrected "now" (ms). */
  now: () => number;
  page: number;
  blockClipboard: boolean;
  /** Called after something was logged (lets the caller schedule a save). */
  onEvent?: () => void;
  /** Called when a blocked copy or paste was attempted. */
  onBlocked?: (what: "paste" | "copy") => void;
}

/**
 * Records what the grader should know about an attempt: when (and for how long) the page
 * was left, pasted text, copying and lost connection. Nothing is shown to the candidate as a
 * warning; the events are sent with the next autosave.
 */
export function useIntegrityMonitor({startedAt, now, page, blockClipboard, onEvent, onBlocked}: Options) {
  const queue = useRef<IntegrityEvent[]>([]);
  const pageRef = useRef(page);
  const awaySince = useRef<number | null>(null);
  const offlineSince = useRef<number | null>(null);
  const callbacks = useRef({onEvent, onBlocked});
  const [stats, setStats] = useState({awayCount: 0, awayMs: 0, pasteCount: 0, pasteChars: 0});

  useEffect(() => {
    callbacks.current = {onEvent, onBlocked};
  }, [onEvent, onBlocked]);

  const at = useCallback(() => Math.max(0, Math.round(now() - startedAt)), [now, startedAt]);
  const push = useCallback((event: IntegrityEvent) => {
    queue.current.push(event);
    callbacks.current.onEvent?.();
  }, []);

  useEffect(() => {
    if (pageRef.current === page) return;
    pageRef.current = page;
    push({k: "page", at: at(), p: page});
  }, [page, at, push]);

  useEffect(() => {
    const leave = () => {
      if (awaySince.current === null) awaySince.current = now();
    };
    const back = () => {
      if (awaySince.current === null || document.visibilityState === "hidden" || !document.hasFocus()) return;
      const duration = Math.round(now() - awaySince.current);
      const start = Math.max(0, Math.round(awaySince.current - startedAt));
      awaySince.current = null;
      if (duration < MIN_AWAY_MS) return;
      push({k: "away", at: start, d: duration, p: pageRef.current});
      setStats((current) => ({...current, awayCount: current.awayCount + 1, awayMs: current.awayMs + duration}));
    };
    const visibility = () => (document.visibilityState === "hidden" ? leave() : back());
    const offline = () => {
      if (offlineSince.current === null) offlineSince.current = now();
    };
    const online = () => {
      if (offlineSince.current === null) return;
      const duration = Math.round(now() - offlineSince.current);
      push({k: "offline", at: Math.max(0, Math.round(offlineSince.current - startedAt)), d: duration});
      offlineSince.current = null;
    };

    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [now, startedAt, push]);

  /** Returns the pasted characters (0 when pasting is blocked). */
  const onPaste = useCallback((event: ClipboardEvent<HTMLElement> | DragEvent<HTMLElement>, questionId: string) => {
    const text = "clipboardData" in event ? event.clipboardData?.getData("text") ?? "" : event.dataTransfer?.getData("text") ?? "";
    if (blockClipboard) {
      event.preventDefault();
      push({k: "blocked", at: at(), x: "clipboardData" in event ? "paste" : "drop", q: questionId});
      callbacks.current.onBlocked?.("paste");
      return 0;
    }
    if (!text.length) return 0;
    push({k: "paste", at: at(), n: text.length, q: questionId});
    setStats((current) => ({...current, pasteCount: current.pasteCount + 1, pasteChars: current.pasteChars + text.length}));
    return text.length;
  }, [blockClipboard, at, push]);

  const onCopy = useCallback((event: ClipboardEvent<HTMLElement>, questionId: string) => {
    // Copying from one's own answer is fine; the question text is what matters.
    if ((event.target as HTMLElement).closest("textarea")) return;
    if (blockClipboard) {
      event.preventDefault();
      push({k: "blocked", at: at(), x: "copy", q: questionId});
      callbacks.current.onBlocked?.("copy");
      return;
    }
    if (window.getSelection()?.toString().trim()) push({k: "copy", at: at(), q: questionId});
  }, [blockClipboard, at, push]);

  const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    if (blockClipboard && !(event.target as HTMLElement).closest("textarea")) event.preventDefault();
  }, [blockClipboard]);

  /** The events since the last save (the queue is emptied). */
  const take = useCallback(() => queue.current.splice(0, queue.current.length), []);
  /** Puts events back after a failed save, in front of newer ones. */
  const putBack = useCallback((events: IntegrityEvent[]) => {
    queue.current.unshift(...events);
  }, []);

  return {onPaste, onCopy, onContextMenu, take, putBack, stats};
}
