import * as React from "react";
import {toast} from "sonner";
import {Loader2, LogOut, MonitorSmartphone} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useConfirm} from "@/components/ConfirmDialog";
import {useAuth} from "@/context/AuthContext";
import {sandbox} from "@/lib/sandbox/state";

/**
 * Signing out everywhere else: a lost phone or a shared computer left signed in. This device stays
 * signed in; the others lose the session when their access expires (within the hour).
 */
export function SessionsCard() {
  const {supabase} = useAuth();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  // Practice mode answers only the database: the sessions would be ended for real.
  const practice = sandbox.isActive();

  const signOutOthers = async () => {
    const ok = await confirm({
      title: "Kijelentkezel a többi eszközön?",
      description: "Ez az eszköz bejelentkezve marad. A többin legkésőbb egy órán belül megszűnik a belépés, ott újra be kell jelentkezni.",
      confirmLabel: "Kijelentkeztetés",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const {error} = await supabase.auth.signOut({scope: "others"});
      if (error) throw error;
      toast.success("A többi eszközön kijelentkeztél.");
    } catch {
      toast.error("A kijelentkeztetés nem sikerült. Próbáld újra.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel relative overflow-hidden p-5 lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/[0.04] text-slate-300 ring-1 ring-white/10">
          <MonitorSmartphone className="size-6"/>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-white">Bejelentkezések</h3>
          <p className="text-xs text-slate-400">
            Elvesztetted a telefonod, vagy közös gépen maradtál belépve? Kijelentkeztetheted a többi eszközt; ez itt bejelentkezve marad.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" disabled={busy || practice} onClick={() => void signOutOthers()}
                title={practice ? "Gyakorló módban nem érhető el." : undefined}>
          {busy ? <Loader2 className="animate-spin"/> : <LogOut/>} Kijelentkezés a többi eszközön
        </Button>
      </div>
    </section>
  );
}
