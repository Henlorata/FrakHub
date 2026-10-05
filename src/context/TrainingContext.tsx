import {createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router";
import {toast} from "sonner";
import {useAuth} from "@/context/AuthContext";
import {sandbox} from "@/lib/sandbox/state";
import {markPracticeToasts} from "@/lib/sandbox/toasts";
import {eligibleTrainings, trainingById, type TrainingId, type TrainingInfo} from "@/lib/training/catalog";
import {fetchProgress, readLocalProgress, saveProgress, type ProgressMap, type TrainingRecord, type TrainingStatus} from "@/lib/training/progress";
import {closeOverlays, pageLayerOpen} from "@/lib/training/dom";
import type {TourStep} from "@/lib/training/types";

const TourOverlay = lazy(() => import("@/components/training/TourOverlay"));

export type TourPhase =
  | {kind: "idle"}
  | {kind: "intro"; training: TrainingInfo; auto: boolean}
  | {kind: "loading"; training: TrainingInfo}
  | {kind: "running"; training: TrainingInfo; steps: TourStep[]; index: number}
  | {kind: "done"; training: TrainingInfo; next: TrainingInfo | null};

interface TrainingContextValue {
  /** Trainings the member may play, in playing order. */
  trainings: TrainingInfo[];
  progress: ProgressMap;
  /** Reads the progress from the database (the profile page shows the dates). */
  refreshProgress: () => Promise<void>;
  /** Opens a training's intro card (replay from the profile page). */
  start: (id: TrainingId) => void;
  /** A training is open (intro, running or finished card). */
  busy: boolean;
}

interface TourControls {
  phase: TourPhase;
  begin: () => void;
  later: () => void;
  skip: () => void;
  next: () => void;
  back: () => void;
  complete: () => void;
  startNext: () => void;
  close: () => void;
}

const TrainingContext = createContext<TrainingContextValue | undefined>(undefined);
const TourControlsContext = createContext<TourControls | undefined>(undefined);

/** "Later" holds the automatic start back until the next visit (new tab or browser session). */
const LATER_KEY = "frakhub.training.later";
/** Pages where an automatic start would interrupt work (writing, grading, onboarding, exams). */
const QUIET_ROUTES = [/^\/onboarding/, /^\/login/, /^\/register/, /^\/exam\//, /^\/mcb\/case\//, /^\/exams\/(editor|grading)/];

const isDone = (record: TrainingRecord | undefined, training: TrainingInfo) => !!record && record.version >= training.version;

/**
 * Interactive trainings. A training runs in practice mode: the app talks to an in-memory demo world
 * (src/lib/sandbox), so trainees click real pages without touching real data, and everyone's world
 * lives in their own tab. Only the result (completed / skipped) is stored, in `training_progress`.
 * New trainings (first visit, promotion, new role) start automatically; any of them can be skipped
 * and replayed from the profile page.
 */
export function TrainingProvider({children}: {children: ReactNode}) {
  const {profile, refreshProfile} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = profile?.id ?? null;

  const [phase, setPhase] = useState<TourPhase>({kind: "idle"});
  const [progressState, setProgressState] = useState<{userId: string | null; map: ProgressMap}>({userId: null, map: {}});
  const [remoteChecked, setRemoteChecked] = useState<string | null>(null);
  const [later, setLater] = useState(() => sessionStorage.getItem(LATER_KEY) === "1");
  const origin = useRef("/dashboard");
  const fetching = useRef<string | null>(null);

  // The local copy of the signed-in member's progress (read synchronously, no request).
  const progress = useMemo(
    () => (progressState.userId === userId ? progressState.map : userId ? readLocalProgress(userId) : {}),
    [progressState, userId],
  );
  const trainings = useMemo(() => eligibleTrainings(profile), [profile]);
  const pending = useMemo(() => trainings.filter((training) => !isDone(progress[training.id], training)), [trainings, progress]);

  const refreshProgress = useCallback(async () => {
    if (!userId) return;
    const map = await fetchProgress(userId);
    setProgressState({userId, map});
    setRemoteChecked(userId);
  }, [userId]);

  // Something seems unplayed locally: ask the database once (another device may have played it).
  useEffect(() => {
    if (!userId || pending.length === 0 || remoteChecked === userId || fetching.current === userId) return;
    fetching.current = userId;
    fetchProgress(userId)
      .then((map) => {
        setProgressState({userId, map});
        setRemoteChecked(userId);
      })
      .catch((error) => console.error("Képzési állapot betöltési hiba:", error));
  }, [userId, pending.length, remoteChecked]);

  // Automatic start of the first unplayed training, when the member is not in the middle of something.
  const autoCandidate = phase.kind === "idle" && !later && remoteChecked === userId ? pending[0] : undefined;
  useEffect(() => {
    if (!autoCandidate) return;
    const tryStart = () => {
      if (QUIET_ROUTES.some((route) => route.test(window.location.pathname)) || pageLayerOpen()) return false;
      setPhase({kind: "intro", training: autoCandidate, auto: true});
      return true;
    };
    let timer = 0;
    const first = window.setTimeout(() => {
      if (!tryStart()) timer = window.setInterval(() => tryStart() && window.clearInterval(timer), 4000);
    }, 1500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [autoCandidate, location.pathname]);

  const record = useCallback(async (training: TrainingInfo, status: TrainingStatus) => {
    if (!userId) return;
    try {
      const saved = await saveProgress(userId, training.id, status, training.version);
      setProgressState((current) => ({userId, map: {...(current.userId === userId ? current.map : readLocalProgress(userId)), [training.id]: saved}}));
    } catch (error) {
      console.error("Képzési állapot mentési hiba:", error);
      setProgressState({userId, map: readLocalProgress(userId)});
      toast.error("A képzés állapotát nem sikerült menteni; ezen az eszközön megjegyeztük.");
    }
  }, [userId]);

  /** Leaves practice mode and returns to the page the training started from. */
  /**
   * Leaves practice mode on the page the training started from. The navigation lands first (React
   * Router renders it as a transition) and the real data loads only there, so the last practice page
   * never fetches real data for nothing.
   */
  const exitTo = useRef<string | null>(null);
  const exitTimer = useRef(0);
  const finishExit = useCallback(() => {
    exitTo.current = null;
    window.clearTimeout(exitTimer.current);
    if (!sandbox.isActive()) return;
    sandbox.exit();
    void refreshProfile();
  }, [refreshProfile]);
  const leaveSandbox = useCallback(() => {
    closeOverlays();
    markPracticeToasts(false);
    if (!sandbox.isActive()) return;
    if (`${window.location.pathname}${window.location.search}` === origin.current) {
      finishExit();
      return;
    }
    exitTo.current = origin.current;
    navigate(origin.current, {replace: true});
    // Never stay in practice mode if the page redirects elsewhere.
    exitTimer.current = window.setTimeout(finishExit, 1500);
  }, [navigate, finishExit]);
  useEffect(() => {
    if (exitTo.current && `${location.pathname}${location.search}` === exitTo.current) finishExit();
  }, [location, finishExit]);

  // Signed out (or the account changed) while a training was open: back to the real data, card closed.
  const [phaseUser, setPhaseUser] = useState(userId);
  if (phaseUser !== userId) {
    setPhaseUser(userId);
    setPhase({kind: "idle"});
  }
  useEffect(() => {
    markPracticeToasts(false);
    if (sandbox.isActive()) sandbox.exit();
  }, [userId]);

  const start = useCallback((id: TrainingId) => {
    const training = trainingById(id);
    if (!training || !profile || !training.eligible(profile)) {
      toast.error("Ez a képzés a rangodhoz vagy beosztásodhoz még nem érhető el.");
      return;
    }
    if (phase.kind === "running" || phase.kind === "loading") return;
    setPhase({kind: "intro", training, auto: false});
  }, [profile, phase.kind]);

  const controls = useMemo<TourControls>(() => {
    const begin = async () => {
      if (phase.kind !== "intro" || !profile) return;
      const training = phase.training;
      setPhase({kind: "loading", training});
      try {
        const [{createSandbox}, {loadScript}] = await Promise.all([import("@/lib/sandbox/world"), import("@/lib/training/scripts")]);
        const script = await loadScript(training.id);
        const steps = script.steps.filter((step) => !step.when || step.when(profile));
        origin.current = `${window.location.pathname}${window.location.search}`;
        closeOverlays();
        sandbox.enter(createSandbox(profile));
        markPracticeToasts(true);
        setPhase({kind: "running", training, steps, index: 0});
      } catch (error) {
        console.error("Képzés betöltési hiba:", error);
        toast.error("A képzés betöltése nem sikerült. Próbáld újra később.");
        setPhase({kind: "idle"});
      }
    };
    const postpone = () => {
      sessionStorage.setItem(LATER_KEY, "1");
      setLater(true);
      leaveSandbox();
      setPhase({kind: "idle"});
    };
    const skip = () => {
      if (phase.kind !== "intro" && phase.kind !== "running") return;
      leaveSandbox();
      void record(phase.training, "skipped");
      setPhase({kind: "idle"});
      toast("Képzés kihagyva. A Profilom oldalon bármikor lejátszhatod.");
    };
    const move = (delta: number) => {
      if (phase.kind !== "running") return;
      const index = Math.min(Math.max(phase.index + delta, 0), phase.steps.length - 1);
      if (index !== phase.index) setPhase({...phase, index});
    };
    const complete = () => {
      if (phase.kind !== "running") return;
      const training = phase.training;
      leaveSandbox();
      void record(training, "completed");
      const next = pending.find((item) => item.id !== training.id) ?? null;
      setPhase({kind: "done", training, next});
    };
    const startNext = () => {
      if (phase.kind === "done" && phase.next) setPhase({kind: "intro", training: phase.next, auto: false});
    };
    return {
      phase,
      begin: () => void begin(),
      later: postpone,
      skip,
      next: () => move(1),
      back: () => move(-1),
      complete,
      startNext,
      close: () => setPhase({kind: "idle"}),
    };
  }, [phase, profile, pending, leaveSandbox, record]);

  // Each step opens its page (closing what the previous step opened first).
  const runningStep = phase.kind === "running" ? phase.steps[phase.index] : null;
  useEffect(() => {
    if (!runningStep) return;
    if (runningStep.closeOverlays) closeOverlays();
    if (runningStep.route && `${window.location.pathname}${window.location.search}` !== runningStep.route) navigate(runningStep.route);
  }, [runningStep, navigate]);

  const value = useMemo<TrainingContextValue>(() => ({
    trainings,
    progress,
    refreshProgress,
    start,
    busy: phase.kind !== "idle",
  }), [trainings, progress, refreshProgress, start, phase.kind]);

  return (
    <TrainingContext.Provider value={value}>
      <TourControlsContext.Provider value={controls}>
        {children}
        {phase.kind !== "idle" && (
          <Suspense fallback={null}>
            <TourOverlay/>
          </Suspense>
        )}
      </TourControlsContext.Provider>
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) throw new Error("useTraining must be used within a TrainingProvider");
  return context;
}

export function useTourControls() {
  const context = useContext(TourControlsContext);
  if (!context) throw new Error("useTourControls must be used within a TrainingProvider");
  return context;
}
