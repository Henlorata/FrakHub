import {Component, type ErrorInfo, type ReactNode} from "react";
import {AlertTriangle, RotateCcw} from "lucide-react";
import {Button} from "@/components/ui/button";
import {reportError} from "@/lib/error-reporting";
import {sandbox} from "@/lib/sandbox/state";

interface State {
  error: Error | null;
}

/** A broken page keeps the menu and the header on screen (the app shell stays usable). */
export class PageErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page render error:", error, info.componentStack);
    reportError("crash", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const practice = sandbox.isActive();
    return (
      <div className="panel mx-auto mt-10 w-full max-w-md space-y-4 p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-amber-400"/>
        <h2 className="text-lg font-semibold text-white">{practice ? "Ez a nézet gyakorló módban nem érhető el" : "Hiba történt az oldalon"}</h2>
        <p className="text-sm text-slate-400">
          {practice ? "A bemutató adatok ezt az oldalt nem töltik ki. Lépj tovább a képzésben." : "Próbáld újra; ha a hiba megmarad, frissítsd az oldalt."}
        </p>
        {!practice && <pre className="max-h-24 overflow-auto rounded bg-black/40 p-2 text-left text-[11px] whitespace-pre-wrap text-red-300/80">{this.state.error.message}</pre>}
        <Button variant="outline" onClick={() => this.setState({error: null})}><RotateCcw/> Újra</Button>
      </div>
    );
  }
}
