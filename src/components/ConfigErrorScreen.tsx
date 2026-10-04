import {Settings2} from "lucide-react";

/** Shown instead of the app when required VITE_* variables are missing from the build. */
export function ConfigErrorScreen({missing}: {missing: string[]}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-lg w-full bg-slate-900 border border-yellow-700/50 rounded-xl p-8 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <Settings2 className="w-8 h-8 text-yellow-500"/>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">Hiányzó konfiguráció</h1>
        </div>
        <p className="text-sm text-slate-400">
          Az alkalmazás nem indítható, mert az alábbi környezeti változók nincsenek beállítva. Helyi fejlesztéshez
          töltsd ki a <code className="text-yellow-400">.env</code> fájlt (minta: <code className="text-yellow-400">.env.example</code>),
          Vercelen a projekt Environment Variables beállításait, majd indítsd újra a buildet.
        </p>
        <ul className="space-y-1 font-mono text-sm text-red-300">
          {missing.map((name) => (
            <li key={name}>• {name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
