import {Component, type ErrorInfo, type ReactNode} from "react";
import {AlertTriangle, RotateCcw} from "lucide-react";

interface State {
  error: Error | null;
}

/** Last line of defence: a readable error screen instead of a blank page. */
export class AppErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-xl p-8 text-center space-y-5 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto"/>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">Váratlan hiba történt</h1>
          <p className="text-sm text-slate-400">
            Az oldal betöltése közben hiba lépett fel. Frissítsd az oldalt; ha a hiba továbbra is fennáll, jelezd a
            fejlesztőknek.
          </p>
          <pre className="text-left text-[11px] text-red-300/80 bg-black/40 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm uppercase tracking-wider"
          >
            <RotateCcw className="w-4 h-4"/> Oldal frissítése
          </button>
        </div>
      </div>
    );
  }
}
