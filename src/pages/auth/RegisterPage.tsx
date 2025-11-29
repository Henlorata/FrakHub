import * as React from "react";
import {useNavigate, Link} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {toast} from "sonner";
import {
  Loader2, Shield, User, Mail, Lock, Hash,
  Building2, Fingerprint, Activity, AlertTriangle,
  ScanLine, Target, Network
} from "lucide-react";
import {FACTION_RANKS, type DepartmentDivision} from "@/types/supabase";
import {useAuth} from "@/context/AuthContext";
import {useMediaQuery} from "@/hooks/use-media-query";

// --- KONSTANSOK ---
const EXECUTIVE_STAFF = ['Commander', 'Deputy Commander'];
const COMMAND_STAFF = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_STAFF = ['Sergeant II.', 'Sergeant I.'];

const getTsbLabel = (rank: string) => {
  if (EXECUTIVE_STAFF.includes(rank)) return "Executive Staff (Command)";
  if (COMMAND_STAFF.includes(rank)) return "Command Staff (HQ)";
  if (SUPERVISORY_STAFF.includes(rank)) return "Supervisory Staff";
  return "Field Staff (Patrol)";
};

// --- HÁTTÉR KOMPONENS ---
const DynamicSheriffBackground = ({
                                    children,
                                    division
                                  }: {
  children: React.ReactNode,
  division: DepartmentDivision
}) => {
  const [time, setTime] = React.useState(new Date());

  // ENYHÍTETT MÉRETKORLÁTOK:
  // Már 1024px széles (iPad Pro / kis laptop) és 700px magas kijelzőn is bekapcsol a Desktop mód.
  const isHeightSafe = useMediaQuery("(min-height: 700px)");
  const isWidthSafe = useMediaQuery("(min-width: 1024px)");
  const isDesktopMode = isHeightSafe && isWidthSafe;

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toISOString().replace('T', ' ').split('.')[0] + 'Z';

  const getBackgroundContent = () => {
    switch (division) {
      case 'SEB':
        return (
          <>
            <div className="absolute inset-0 bg-red-950/20"></div>
            <div className="absolute inset-0 night-vision-grain"></div>
            <div className="drone-scan-line"></div>
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <Target className="w-[60vw] h-[60vw] text-red-500 animate-[spin_60s_linear_infinite]"/>
            </div>
          </>
        );
      case 'MCB':
        return (
          <>
            <div className="absolute inset-0 bg-blue-950/20"></div>
            <div className="absolute inset-[-50%] w-[200%] h-[200%] digital-network-bg opacity-30"></div>
            <div className="absolute bottom-[-10%] left-[-10%] opacity-5 pointer-events-none">
              <Network className="w-[50vw] h-[50vw] text-blue-400"/>
            </div>
          </>
        );
      default: // TSB
        return (
          <>
            <div className="absolute inset-[-50%] pointer-events-none">
              <div className="w-full h-full searchlight-beam"/>
            </div>
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div
                className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 via-transparent to-red-900/20 animate-pulse"></div>
            </div>
          </>
        );
    }
  };

  const getTextColor = () => {
    if (division === 'SEB') return 'text-red-500';
    if (division === 'MCB') return 'text-blue-400';
    return 'text-green-500';
  };
  const accentColor = getTextColor();

  return (
    <div
      className="relative min-h-screen w-full bg-[#050505] overflow-hidden font-sans selection:bg-yellow-500/30 flex items-center justify-center transition-colors duration-1000">

      {getBackgroundContent()}

      {/* --- DESKTOP WIDGETEK --- */}
      {isDesktopMode && (
        <>
          {/* 1. TOP RIGHT: BODYCAM (Marad) */}
          <div
            className="absolute top-8 right-8 z-20 flex flex-col items-end gap-1 opacity-90 pointer-events-none select-none font-mono">
            <div
              className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded border border-white/10 backdrop-blur-sm">
              <div
                className="w-3 h-3 bg-red-600 rounded-full animate-[rec-pulse_2s_infinite] shadow-[0_0_8px_red]"></div>
              <span className="text-white font-bold tracking-widest text-sm">REC</span>
            </div>
            <div className="text-white/70 text-xs font-bold tracking-wider">{formattedTime}</div>
            <div
              className={`${division === 'SEB' ? 'text-red-500/70' : division === 'MCB' ? 'text-blue-500/70' : 'text-yellow-500/70'} text-xs font-bold tracking-widest mt-1`}>
              AXON BODY 3 - X81322
            </div>
          </div>

          {/* 2. BOTTOM LEFT: MAINFRAME STATUS (Áthelyezve ide!) */}
          <div className="absolute bottom-8 right-8 z-0 select-none opacity-80">
            <div
              className={`flex flex-col gap-1 ${accentColor} font-mono text-sm font-bold tracking-wider drop-shadow-md border-l-2 border-current/30 pl-3`}>
              <p className="flex items-center gap-2"><Activity className="h-4 w-4 animate-pulse"/> SFSD_MAINFRAME_V4.2
              </p>
              <p>SECURE_CONNECTION: <span className="opacity-80">ESTABLISHED</span></p>
              <p className={`animate-pulse mt-2 text-[10px] uppercase opacity-70`}>
                /// WAITING FOR CADET DATA ///
              </p>
            </div>
          </div>
        </>
      )}

      {/* --- COMPACT MODE (MOBIL) --- */}
      {!isDesktopMode && (
        <div
          className="absolute top-0 left-0 w-full z-30 bg-black/80 backdrop-blur-md border-b border-white/10 p-2 px-4 flex justify-between items-center font-mono select-none shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-0.5 bg-red-950/30 rounded border border-red-900/50">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-[rec-pulse_1s_infinite]"></div>
              <span className="text-red-500 text-[10px] font-bold tracking-widest">REC</span>
            </div>
            <span className="text-white/60 text-xs">{formattedTime.split(' ')[1]}</span>
          </div>
          <div className={`text-[10px] font-bold tracking-wider ${accentColor}`}>
            SFSD_MAINFRAME_V4.2
          </div>
        </div>
      )}

      {/* TARTALOM (Standard középre igazítás) */}
      <div
        className={`relative z-10 w-full max-w-6xl p-4 transition-all duration-700 ${!isDesktopMode ? 'pt-20' : 'pt-4'}`}>
        {children}
      </div>
    </div>
  );
};

const FingerprintScanner = ({active, colorClass}: { active: boolean, colorClass: string }) => (
  <div
    className="w-full h-full bg-black/60 flex flex-col items-center justify-center relative overflow-hidden border border-white/10 rounded-sm group">
    <div
      className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px]"></div>
    <Fingerprint
      className={`w-16 h-16 ${colorClass} opacity-80 z-10 transition-all duration-500 ${active ? 'scale-110 opacity-100' : 'text-slate-600 scale-100 opacity-50'}`}/>
    <div className="scanner-beam z-20"></div>
    <div
      className="absolute bottom-2 text-[8px] uppercase tracking-widest text-slate-400 font-mono z-10 bg-black/80 px-2 rounded">
      Biometric Scan
    </div>
  </div>
);

export function RegisterPage() {
  const navigate = useNavigate();
  const {supabase} = useAuth();

  // ITT IS LAZÍTOTTUK A FELTÉTELEKET:
  const isHeightSafe = useMediaQuery("(min-height: 700px)");
  const isWidthSafe = useMediaQuery("(min-width: 1024px)");
  const isDesktopMode = isHeightSafe && isWidthSafe;

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isRecruitmentClosed, setIsRecruitmentClosed] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [badgeNumber, setBadgeNumber] = React.useState("");
  const [selectedRank, setSelectedRank] = React.useState<string>("Deputy Sheriff Trainee");
  const [selectedDivision, setSelectedDivision] = React.useState<DepartmentDivision>("TSB");

  React.useEffect(() => {
    const checkStatus = async () => {
      const {data} = await supabase.from('system_status').select('recruitment_open').eq('id', 'global').single();
      if (data && data.recruitment_open === false) setIsRecruitmentClosed(true);
    };
    checkStatus();
  }, [supabase]);

  const handleBadgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length <= 4) setBadgeNumber(numericValue);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (badgeNumber.length !== 4) {
      setError("A jelvényszámnak pontosan 4 számjegyűnek kell lennie!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email, password, full_name: fullName, badge_number: badgeNumber,
          faction_rank: selectedRank, division: selectedDivision
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Hiba történt');
      toast.success("Kérelem rögzítve", {description: "Sikeres regisztráció."});
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTheme = () => {
    const base = {
      formBorder: 'border-yellow-600/30',
      formIcon: 'text-yellow-500',
      formRing: 'focus:ring-yellow-500/20',
      formBtn: 'bg-yellow-600 hover:bg-yellow-500',
      cardScanColor: 'text-yellow-500',
      cardGlow: 'shadow-yellow-500/20',
      cardBorder: 'border-yellow-600/50',
      cardBg: 'bg-gradient-to-br from-[#1a1405] via-slate-900 to-black',
      cardAccent: 'text-yellow-500',
      logo: null,
      label: getTsbLabel(selectedRank).split(' ')[0].toUpperCase(),
      subtext: 'SAN FIERRO COUNTY',
      authColor: 'text-yellow-500',
      authGradient: 'from-yellow-500'
    };

    if (selectedDivision === 'SEB') return {
      formBorder: 'border-red-600/30',
      formIcon: 'text-red-500',
      formRing: 'focus:ring-red-500/20',
      formBtn: 'bg-red-700 hover:bg-red-600',
      cardScanColor: 'text-red-500',
      cardGlow: 'shadow-red-500/40',
      cardBorder: 'border-red-600',
      cardBg: 'bg-gradient-to-br from-[#1a0505] via-slate-900 to-black',
      cardAccent: 'text-red-500',
      logo: '/seb.png',
      label: 'OPERATOR',
      subtext: 'SPECIAL ENFORCEMENT',
      authColor: 'text-red-600',
      authGradient: 'from-red-600'
    };

    if (selectedDivision === 'MCB') return {
      formBorder: 'border-blue-500/30',
      formIcon: 'text-blue-400',
      formRing: 'focus:ring-blue-500/20',
      formBtn: 'bg-blue-700 hover:bg-blue-600',
      cardScanColor: 'text-blue-400',
      cardGlow: 'shadow-blue-500/40',
      cardBorder: 'border-blue-500',
      cardBg: 'bg-gradient-to-br from-[#050f1a] via-slate-900 to-black',
      cardAccent: 'text-blue-400',
      logo: '/mcb.png',
      label: 'INVESTIGATOR',
      subtext: 'MAJOR CRIMES',
      authColor: 'text-blue-500',
      authGradient: 'from-blue-500'
    };

    return base;
  };

  const theme = getTheme();
  const isFormActive = fullName.length > 0;

  return (
    <DynamicSheriffBackground division={selectedDivision}>
      <div className="grid lg:grid-cols-2 gap-12 items-center">

        {/* BAL OLDAL: FORM */}
        <div
          className={`bg-slate-950/70 backdrop-blur-xl border ${theme.formBorder} shadow-2xl rounded-sm overflow-hidden relative transition-all duration-500`}>
          <div
            className={`absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50 ${theme.cardAccent}`}></div>
          <div className="p-8 lg:p-10">
            {/* Form Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                <Shield className={`h-6 w-6 ${theme.formIcon}`}/>
                CSATLAKOZÁS
              </h1>
              <p className="text-slate-400 text-sm mt-1">San Fierro Sheriff's Department Intranet</p>
            </div>

            {/* Form Content */}
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Teljes
                    Név</label>
                  <div className="relative">
                    <User
                      className={`absolute left-3 top-3 h-4 w-4 text-slate-500 transition-colors group-focus-within:${theme.formIcon}`}/>
                    <Input required placeholder="John Doe"
                           className={`pl-10 bg-black/40 border-slate-700 h-11 text-white transition-all focus:border-current ${theme.formRing} ${theme.cardAccent}`}
                           value={fullName} onChange={(e) => setFullName(e.target.value)}/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <label
                      className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Jelvény</label>
                    <div className="relative">
                      <Hash
                        className={`absolute left-3 top-3 h-4 w-4 text-slate-500 transition-colors group-focus-within:${theme.formIcon}`}/>
                      <Input required placeholder="0000"
                             className={`pl-10 bg-black/40 border-slate-700 h-11 text-white font-mono tracking-widest transition-all focus:border-current ${theme.formRing} ${theme.cardAccent}`}
                             value={badgeNumber} onChange={handleBadgeChange}/>
                    </div>
                  </div>
                  <div className="relative group">
                    <label
                      className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Osztály</label>
                    <Select value={selectedDivision} onValueChange={(val: any) => setSelectedDivision(val)}>
                      <SelectTrigger className={`h-11 bg-black/40 border-slate-700 text-white ${theme.formRing}`}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500"/>
                          <SelectValue placeholder="Válassz"/>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-800 text-white">
                        <SelectItem value="TSB"
                                    className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800">{getTsbLabel(selectedRank)}</SelectItem>
                        <SelectItem value="SEB"
                                    className="cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-950/30 focus:bg-red-950/30">Special
                          Enforcement (SEB)</SelectItem>
                        <SelectItem value="MCB"
                                    className="cursor-pointer text-blue-400 focus:text-blue-400 hover:bg-blue-950/30 focus:bg-blue-950/30">Major
                          Crimes (MCB)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="relative group">
                  <label
                    className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Rendfokozat</label>
                  <Select value={selectedRank} onValueChange={setSelectedRank}>
                    <SelectTrigger className={`h-11 bg-black/40 border-slate-700 text-white ${theme.formRing}`}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-slate-500"/>
                        <SelectValue placeholder="Válassz rangot"/>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-white max-h-60">
                      {FACTION_RANKS.map((rank) => (
                        <SelectItem key={rank} value={rank}
                                    className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800">{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-slate-800/80"></div>

              <div className="space-y-4">
                <div className="relative group">
                  <label
                    className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Email</label>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3 top-3 h-4 w-4 text-slate-500 transition-colors group-focus-within:${theme.formIcon}`}/>
                    <Input required type="email" placeholder="email@example.com"
                           className={`pl-10 bg-black/40 border-slate-700 h-11 text-white transition-all focus:border-current ${theme.formRing} ${theme.cardAccent}`}
                           value={email} onChange={(e) => setEmail(e.target.value)}/>
                  </div>
                </div>
                <div className="relative group">
                  <label
                    className="text-[10px] uppercase font-bold text-slate-500 mb-1 block tracking-wider">Jelszó</label>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3 top-3 h-4 w-4 text-slate-500 transition-colors group-focus-within:${theme.formIcon}`}/>
                    <Input required type="password" placeholder="••••••••"
                           className={`pl-10 bg-black/40 border-slate-700 h-11 text-white transition-all focus:border-current ${theme.formRing} ${theme.cardAccent}`}
                           value={password} onChange={(e) => setPassword(e.target.value)}/>
                  </div>
                </div>
              </div>

              <Button type="submit"
                      className={`w-full ${theme.formBtn} text-white font-bold h-12 uppercase tracking-wider transition-all mt-4`}
                      disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "Regisztráció Küldése"}
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-xs text-slate-500 hover:text-white transition-colors">
                  Már van fiókod? <span className="underline">Belépés</span>
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* JOBB OLDAL: KÁRTYA ÉS FEJLÉC */}
        <div className="hidden lg:flex flex-col items-center justify-center perspective-1000 relative">

          {/* ÚJ FEJLÉC A KÁRTYA FELETT */}
          <div className="mb-6 text-center select-none">
            <div className={`${theme.authColor} font-bold text-2xl tracking-tighter uppercase font-mono`}>
              San Fierro Sheriff's Dept
            </div>
            <div
              className="text-slate-500 text-xs tracking-[0.4em] uppercase flex items-center justify-center gap-2 font-bold mt-1">
              <Shield className="h-3 w-3"/> Authorized Access Only
            </div>
          </div>

          {/* A KÁRTYA */}
          <div className={`
                relative w-[500px] h-[310px] rounded-xl overflow-hidden transition-all duration-700
                ${theme.cardBg} border-2 ${theme.cardBorder}
                shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] ${theme.cardGlow}
                transform hover:scale-105 hover:rotate-1 z-10
            `}>
            <div
              className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50 pointer-events-none"></div>
            <div className="absolute -right-10 -bottom-10 w-64 h-64 opacity-10 pointer-events-none grayscale">
              {theme.logo ? <img src={theme.logo} className="w-full h-full object-contain"/> :
                <Shield className="w-full h-full"/>}
            </div>

            <div className="relative z-10 h-full flex flex-col p-6">
              <div className="flex justify-between items-start pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className={`bg-gradient-to-br ${selectedDivision === 'SEB' ? 'from-red-500 to-red-900' : selectedDivision === 'MCB' ? 'from-blue-500 to-blue-900' : 'from-yellow-400 to-yellow-700'} p-2 rounded shadow-lg`}>
                    <Shield
                      className={`w-8 h-8 text-black ${selectedDivision === 'SEB' ? 'fill-red-200' : 'fill-yellow-500'}`}/>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-none tracking-tighter">SAN FIERRO</h2>
                    <p
                      className={`text-[10px] font-bold ${theme.cardAccent} tracking-[0.3em] uppercase mt-0.5`}>Sheriff's
                      Department</p>
                  </div>
                </div>
                <div className="w-16 h-16 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  {theme.logo ? (
                    <img src={theme.logo} alt="Div Logo" className="w-full h-full object-contain"/>
                  ) : (
                    <Shield className="w-full h-full text-yellow-500"/>
                  )}
                </div>
              </div>

              <div className="flex-1 flex items-center gap-6 mt-2">
                <div
                  className="w-28 h-36 shrink-0 shadow-lg border border-white/20 rounded-sm overflow-hidden bg-black/50">
                  <FingerprintScanner active={isFormActive} colorClass={theme.cardScanColor}/>
                </div>
                <div className="w-full space-y-3 min-w-0">
                  <div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Name</div>
                    <div
                      className="text-2xl font-black text-white tracking-tight font-mono border-b border-white/10 pb-1 truncate max-w-[240px]">
                      {fullName || "UNKNOWN"}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Rank</div>
                      <div className="text-xs font-bold text-white truncate">{selectedRank}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Badge</div>
                      <div className="text-sm font-bold font-mono tracking-widest text-white bg-white/10 px-2 rounded">
                        {badgeNumber || "----"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-xl font-black ${theme.cardAccent} tracking-tighter leading-none`}>
                      {theme.label}
                    </div>
                    <div className="text-[8px] text-slate-400 uppercase tracking-[0.2em]">
                      {theme.subtext}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-2 flex justify-between items-end opacity-50">
                <div className="text-[10px] font-mono text-slate-400">
                  CARD ID: {Math.random().toString(36).substring(7).toUpperCase()}
                </div>
                <ScanLine className="w-6 h-6 text-white/50"/>
              </div>
            </div>
          </div>
          <div
            className={`w-[450px] h-10 ${selectedDivision === 'SEB' ? 'bg-red-900/40' : selectedDivision === 'MCB' ? 'bg-blue-900/40' : 'bg-black/50'} blur-xl rounded-[100%] mt-[-10px] -z-10 transition-colors duration-700`}></div>
        </div>
      </div>
    </DynamicSheriffBackground>
  );
}