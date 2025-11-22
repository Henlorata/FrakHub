import { Shield } from "lucide-react";

export function LoadingScreen({ text = "Rendszer betöltése..." }: { text?: string }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Háttér effekt */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 via-slate-950 to-slate-950" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Pulzáló pajzs */}
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-500/30 blur-xl rounded-full animate-pulse" />
          <Shield className="w-20 h-20 text-yellow-500 animate-bounce" style={{ animationDuration: '2s' }} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">SFSD Intranet</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
            <span className="text-slate-400 text-sm font-mono">{text}</span>
          </div>
        </div>
      </div>

      {/* Loading bar alul */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
        <div className="h-full bg-yellow-600 animate-progress w-full origin-left scale-x-0" style={{ animation: 'progress 2s infinite ease-in-out' }} />
      </div>

      <style>{`
        @keyframes progress {
            0% { transform: scaleX(0); transform-origin: left; }
            50% { transform: scaleX(0.5); transform-origin: left; }
            51% { transform: scaleX(0.5); transform-origin: right; }
            100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  );
}