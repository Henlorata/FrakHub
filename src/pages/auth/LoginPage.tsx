import * as React from "react";
import {useNavigate, Link} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import {
  Loader2, Shield, LogIn, Lock, Mail,
  Server, Eye, EyeOff, FileKey2, ShieldCheck, Scale, Wifi
} from "lucide-react";
// Importáljuk a hook-ot a méretezéshez
import {useMediaQuery} from "@/hooks/use-media-query";

// --- LOGIN HÁTTÉR: SECURE GATEWAY (Clean Version) ---
const SecureGatewayBackground = ({children}: { children: React.ReactNode }) => {
  // Reszponzív logikák:
  // Ha a magasság kisebb mint 800px VAGY a szélesség kisebb mint 1024px, akkor "Kompakt Mód".
  const isHeightSafe = useMediaQuery("(min-height: 800px)");
  const isWidthSafe = useMediaQuery("(min-width: 1024px)");
  const isDesktopMode = isHeightSafe && isWidthSafe;

  // Vízszintes fénycsíkok (Data Beams)
  const beams = React.useMemo(() => Array.from({length: 18}).map((_, i) => ({
    top: `${Math.random() * 100}%`,
    width: `${10 + Math.random() * 40}%`,
    animationDuration: `${2 + Math.random() * 5}s`,
    animationDelay: `${Math.random() * 5}s`,
    opacity: 0.1 + Math.random() * 0.4,
    direction: Math.random() > 0.5 ? 'beam-slide-right' : 'beam-slide-left'
  })), []);

  return (
    <div
      className="relative min-h-screen w-full bg-[#02040a] flex items-center justify-center overflow-hidden font-sans selection:bg-yellow-500/30">

      {/* 1. Alap Rétegek (Sötétkék/Fekete Gradiens + Rács) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1121] via-[#020617] to-black z-0"></div>
      <div className="floor-grid pointer-events-none z-0"></div>

      {/* 2. Adatcsíkok (Data Beams) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {beams.map((style, i) => (
          <div key={i} className="data-beam" style={{
            top: style.top,
            width: style.width,
            animationName: style.direction,
            animationDuration: style.animationDuration,
            animationDelay: style.animationDelay,
            opacity: style.opacity
          }}/>
        ))}
      </div>

      {/* 3. Vignette */}
      <div
        className="absolute inset-0 bg-radial-gradient from-transparent via-black/20 to-black/90 pointer-events-none z-0"></div>

      {/* --- WIDGETEK (Reszponzív megjelenítés) --- */}

      {/* CSAK DESKTOP MÓDBAN (Ha van elég hely) */}
      {isDesktopMode && (
        <>
          {/* TOP LEFT: Tulajdonjog */}
          <div className="absolute top-10 left-10 z-10 select-none opacity-90 animate-in fade-in duration-1000">
            <div className="border-l-4 border-yellow-600 pl-4 py-1">
              <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">Government Property</div>
              <div className="text-lg font-black text-white tracking-wide font-mono mt-0.5">SAN FIERRO SHERIFF'S DEPT
              </div>
            </div>
          </div>

          {/* BOTTOM LEFT: Protokoll */}
          <div
            className="absolute bottom-10 left-10 z-10 flex flex-col justify-end gap-2 opacity-90 pointer-events-none select-none animate-in slide-in-from-bottom-4 duration-1000">
            <div className="flex items-center gap-3 text-blue-400">
              <ShieldCheck className="w-6 h-6"/>
              <span className="text-sm font-bold tracking-wider">CONNECTION SECURED</span>
            </div>
            <div className="text-xs text-slate-400 font-mono uppercase tracking-widest pl-9">
              Protocol: TLS 1.3 | AES-256 Encryption
            </div>
          </div>

          {/* BOTTOM RIGHT: Mottó */}
          <div
            className="absolute bottom-10 right-10 z-10 flex flex-col items-end gap-3 opacity-90 select-none animate-in slide-in-from-bottom-4 duration-1000">
            <div className="flex items-center gap-3 text-yellow-500">
              <span className="text-base font-black tracking-[0.2em] uppercase">Integrity</span>
              <span className="text-slate-600">•</span>
              <span className="text-base font-black tracking-[0.2em] uppercase">Service</span>
              <span className="text-slate-600">•</span>
              <span className="text-base font-black tracking-[0.2em] uppercase">Protection</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 uppercase tracking-widest font-bold">
              <Scale className="w-4 h-4"/>
              <span>Serving the County since 1850</span>
            </div>
          </div>
        </>
      )}

      {/* CSAK KOMPAKT MÓDBAN (Mobil / Laptop) */}
      {!isDesktopMode && (
        <div
          className="absolute bottom-0 left-0 w-full z-20 bg-black/80 backdrop-blur-md border-t border-white/10 p-3 flex justify-between items-center font-mono select-none">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-wider">
            <Shield className="w-3 h-3 text-yellow-600"/>
            <span>SFSD Intranet Portal</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-blue-500 font-bold">
            <Wifi className="w-3 h-3"/>
            <span>SECURE</span>
          </div>
        </div>
      )}

      {/* TARTALOM (CARD) */}
      {/* Mobilon picit feljebb toljuk (pb-12), hogy a lenti sáv ne takarja ki */}
      <div className={`relative z-20 w-full max-w-md px-4 ${!isDesktopMode ? 'pb-12' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export function LoginPage() {
  const navigate = useNavigate();
  const {supabase, session, profile} = useAuth();

  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [systemMsg, setSystemMsg] = React.useState("WAITING FOR CREDENTIALS...");

  React.useEffect(() => {
    if (session && profile) {
      navigate('/dashboard');
    }
  }, [session, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setSystemMsg("VERIFYING IDENTITY...");

    try {
      const {error} = await supabase.auth.signInWithPassword({email, password});
      if (error) throw error;

      setSystemMsg("IDENTITY CONFIRMED. LOGGING IN...");
      toast.success("Azonosítás sikeres", {
        description: "Üdvözöljük a rendszerben, Deputy.",
        className: "bg-slate-900 border-yellow-500 text-white"
      });
    } catch (err: any) {
      toast.error("Belépés megtagadva", {
        description: "Helytelen jelvényszám vagy jelszó.",
        className: "bg-red-950 border-red-500 text-white"
      });
      setSystemMsg("ERROR: ACCESS DENIED");
      setIsLoading(false);
    }
  };

  return (
    <SecureGatewayBackground>
      {/* Login Kártya */}
      <div
        className="bg-[#0f172a]/80 backdrop-blur-xl border border-slate-700/50 shadow-[0_0_80px_rgba(0,0,0,0.6)] rounded-lg overflow-hidden relative group">

        {/* Felső dekor csík */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-yellow-600 to-transparent opacity-80"></div>

        {/* Fejléc */}
        <div className="pt-8 pb-6 px-8 text-center relative">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-80">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-green-500 font-mono tracking-wider font-bold">SYSTEM ONLINE</span>
          </div>

          <div className="flex justify-center mb-6 relative">
            <div className="absolute inset-0 bg-yellow-500/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <div
              className="relative bg-[#020617] border border-yellow-600/30 p-4 rounded-full shadow-lg group-hover:border-yellow-500/50 transition-colors duration-500">
              <Shield className="h-10 w-10 text-yellow-500"/>
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">SFSD INTRANET</h1>
          <p className="text-yellow-500/60 text-xs font-bold tracking-[0.3em] uppercase mt-1">
            Central Authentication
          </p>
        </div>

        {/* Terminál üzenet sáv */}
        <div
          className="bg-black/60 border-y border-white/5 py-2 px-4 flex items-center justify-between font-mono text-[10px] text-slate-400">
             <span className={`${systemMsg.includes('ERROR') ? 'text-red-500' : 'text-yellow-500'}`}>
                {'>'} {systemMsg} <span className="animate-pulse">_</span>
             </span>
          <div className="flex items-center gap-2">
            <Server className="w-3 h-3 text-slate-600"/>
            <span>V4.02</span>
          </div>
        </div>

        {/* Form Tartalom */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div className="space-y-2 group/input">
              <label
                className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2 group-focus-within/input:text-yellow-500 transition-colors">
                <FileKey2 className="w-3 h-3"/> Azonosító (Email)
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="badge@sfsd.com"
                  className="bg-[#020617]/50 border-slate-700 h-11 text-white focus:border-yellow-500 focus:ring-yellow-500/20 transition-all font-mono pl-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Jelszó */}
            <div className="space-y-2 group/input">
              <label
                className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2 group-focus-within/input:text-yellow-500 transition-colors">
                <Lock className="w-3 h-3"/> Jelszó
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-[#020617]/50 border-slate-700 h-11 text-white focus:border-yellow-500 focus:ring-yellow-500/20 transition-all font-mono tracking-widest pl-3 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </button>
              </div>
            </div>

            {/* Gomb */}
            <Button
              type="submit"
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold h-12 uppercase tracking-wider transition-all mt-2 relative overflow-hidden group/btn"
              disabled={isLoading}
            >
              <div
                className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
              {isLoading ? (
                <span className="flex items-center gap-2">
                             <Loader2 className="h-4 w-4 animate-spin"/> FELDOLGOZÁS...
                        </span>
              ) : (
                <span className="flex items-center gap-2 relative z-10">
                            <LogIn className="h-4 w-4"/> BELÉPÉS
                        </span>
              )}
            </Button>

            {/* Footer Link */}
            <div className="pt-4 border-t border-slate-800/50 flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500">Még nincs hozzáférésed?</span>
              <Link
                to="/register"
                className="text-xs font-bold text-yellow-600 hover:text-yellow-400 uppercase tracking-wide hover:underline transition-all"
              >
                Regisztrációs kérelem benyújtása
              </Link>
            </div>
          </form>
        </div>
      </div>
    </SecureGatewayBackground>
  );
}