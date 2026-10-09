import {Suspense, useEffect, useState} from "react";
import {useLocation} from "react-router";
import {PenLine} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import {useAuth} from "@/context/AuthContext";
import {useTraining} from "@/context/TrainingContext";
import {lazyComponent} from "@/lib/lazy";
import {sandbox} from "@/lib/sandbox/state";
import {knownToHaveSignature, rememberHasSignature, signatureApi, signaturePresence} from "@/lib/signature/api";
import {pageLayerOpen} from "@/lib/training/dom";

const SignatureDialog = lazyComponent(() => import("./SignatureDialog"), "default");

/** "Later" waits until the next visit (new tab or browser session). */
const LATER_KEY = "frakhub.signature.later";
/** Pages where a popup would interrupt work (same as the trainings, plus prints). */
const QUIET_ROUTES = [/^\/onboarding/, /^\/exam\//, /^\/mcb\/case\//, /^\/exams\/(editor|grading)/, /\/print$/, /^\/hr\/(record|award)\//,
  /^\/finance\/payslip\//, /^\/iab\/case\//];

/** A pen writing a line: the popup's illustration. */
function WritingPen() {
  return (
    <svg viewBox="0 0 220 70" className="h-16 w-full" aria-hidden>
      <path d="M8 46c18-22 30-30 36-22s-14 30-2 30 22-36 32-34-6 30 4 30 16-24 26-24 2 22 12 22 18-30 30-30 4 26 14 26 22-14 40-16"
            fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="pen-line"/>
      <path d="M10 60h200" stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 5"/>
    </svg>
  );
}

/**
 * Asks once per visit for a signature, when the member has none. It always comes after the
 * trainings (never before or over them), never on pages where it would interrupt, and not in
 * practice mode.
 */
export function SignaturePrompt() {
  const {profile} = useAuth();
  const {autoOfferPending} = useTraining();
  const location = useLocation();
  const [missing, setMissing] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [later, setLater] = useState(() => sessionStorage.getItem(LATER_KEY) === "1");

  const userId = profile && profile.system_role !== "pending" && profile.onboarding_completed !== false ? profile.id : null;

  // Whether a signature exists normally comes with the profile read. Only when that did not say (an
  // older cached profile shape) is the database asked, once, after the trainings and the page's own data.
  useEffect(() => {
    if (!userId || later || autoOfferPending || sandbox.isActive()) return;
    const known = signaturePresence(userId);
    if (known === true || (known === undefined && knownToHaveSignature(userId))) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (known === false) {
        setMissing(userId);
        return;
      }
      signatureApi.get(userId).then((signature) => {
        if (!active) return;
        if (signature) rememberHasSignature(userId, true);
        else setMissing(userId);
      }, () => undefined);
    }, known === false ? 0 : 2000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [userId, later, autoOfferPending]);

  const ready = !!userId && missing === userId && !later && !autoOfferPending && !visible && !editing;
  useEffect(() => {
    if (!ready) return;
    const tryShow = () => {
      if (sandbox.isActive() || QUIET_ROUTES.some((route) => route.test(window.location.pathname)) || pageLayerOpen()) return false;
      setVisible(true);
      return true;
    };
    let timer = 0;
    const first = window.setTimeout(() => {
      if (!tryShow()) timer = window.setInterval(() => tryShow() && window.clearInterval(timer), 4000);
    }, 2500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [ready, location.pathname]);

  const postpone = () => {
    sessionStorage.setItem(LATER_KEY, "1");
    setLater(true);
    setVisible(false);
  };

  return (
    <>
      <Dialog open={visible} onOpenChange={(open) => (open ? setVisible(true) : postpone())}>
        <DialogContent className="overflow-hidden sm:max-w-md">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-amber-400/15 blur-3xl"/>
          <div className="relative rounded-xl bg-[#fbf8f1] px-4 pt-3 pb-2 text-[#1f2f6b] ring-1 ring-black/10">
            <WritingPen/>
          </div>
          <div className="relative space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg"><PenLine className="size-5 text-amber-300"/> Állítsd be az aláírásodat</DialogTitle>
            <DialogDescription>
              A szolgálati lapra, az aktákra, a parancsokra és az oklevelekre a saját aláírásod kerül, nem csak a neved.
              Rajzold meg, töltsd fel egy képről, válassz egy stílust, vagy kérj egy automatikusat: egy perc az egész.
            </DialogDescription>
          </div>
          <div className="relative flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={postpone}>Később</Button>
            <Button onClick={() => {
              setVisible(false);
              setEditing(true);
            }}><PenLine/> Beállítom most</Button>
          </div>
        </DialogContent>
      </Dialog>
      {editing && (
        <Suspense fallback={null}>
          <SignatureDialog open={editing} onOpenChange={(open) => {
            setEditing(open);
            // Closed without saving: not again in this visit.
            if (!open) postpone();
          }} onSaved={() => setMissing(null)}/>
        </Suspense>
      )}
    </>
  );
}
