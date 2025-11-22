import * as React from "react";
import {useNavigate, Link} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import {Loader2, Shield, BadgeAlert, User, Mail, Lock, AlertTriangle} from "lucide-react";
import {FACTION_RANKS, type DepartmentDivision} from "@/types/supabase";
import {useAuth} from "@/context/AuthContext"; // Supabase eléréshez

export function RegisterPage() {
  const navigate = useNavigate();
  const {supabase} = useAuth(); // Contextből kérjük a klienst
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Létszámstop state
  const [isRecruitmentClosed, setIsRecruitmentClosed] = React.useState(false);

  // Form state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [badgeNumber, setBadgeNumber] = React.useState("");
  const [selectedRank, setSelectedRank] = React.useState<string>(FACTION_RANKS[FACTION_RANKS.length - 1]);
  const [selectedDivision, setSelectedDivision] = React.useState<DepartmentDivision>("TSB");

  // Státusz ellenőrzése betöltéskor
  React.useEffect(() => {
    const checkStatus = async () => {
      const {data} = await supabase.from('system_status').select('recruitment_open').eq('id', 'global').single();
      if (data && data.recruitment_open === false) {
        setIsRecruitmentClosed(true);
      }
    };
    checkStatus();
  }, [supabase]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (badgeNumber.length !== 4 || isNaN(Number(badgeNumber))) {
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

      toast.success("Fiók létrehozva", {
        description: "A regisztráció sikeres. A fiókod jóváhagyásra vár.",
        duration: 5000
      });
      navigate('/login');

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex">
      {/* ... (Bal oldal dekoráció változatlan maradhat) ... */}
      <div
        className="hidden lg:flex lg:w-1/2 relative bg-slate-900 items-center justify-center overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-yellow-950/20"/>
        {/* ... */}
        <div className="relative z-10 max-w-md text-center px-8">
          <Shield className="h-32 w-32 text-yellow-500 mx-auto mb-8 opacity-80"/>
          <h2 className="text-4xl font-bold text-white mb-4">San Fierro Sheriff's Dept.</h2>
          <p className="text-lg text-slate-400">"A Community Dedicated to Service, Protection, and Integrity."</p>
        </div>
      </div>

      {/* JOBB OLDAL - ŰRLAP */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold text-white tracking-tight">Fiók Létrehozása</h1>
            <p className="text-slate-400 mt-2">Add meg a szolgálati adataidat a regisztrációhoz.</p>
          </div>

          {/* LÉTSZÁMSTOP FIGYELMEZTETÉS */}
          {isRecruitmentClosed && (
            <div
              className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wide">Létszámstop érvényben</h4>
                <p className="text-xs text-red-200/70 mt-1">
                  A jelentkezéseket fogadjuk, de a feldolgozás és jóváhagyás bizonytalan ideig szünetelhet.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-400 text-sm">
              <BadgeAlert className="h-5 w-5 flex-shrink-0"/>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {/* ... (Form mezők változatlanok maradnak) ... */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">Teljes Név (IC)</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/>
                <Input required placeholder="John Doe" className="pl-9 bg-slate-900 border-slate-800" value={fullName}
                       onChange={(e) => setFullName(e.target.value)}/>
              </div>
            </div>
            {/* ... (Többi input) ... */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase">Jelvény</label>
              <Input required placeholder="1192" maxLength={4}
                     className="bg-slate-900 border-slate-800 font-mono text-center tracking-widest" value={badgeNumber}
                     onChange={(e) => setBadgeNumber(e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">Főosztály</label>
                <select
                  className="w-full h-10 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  value={selectedDivision} onChange={(e) => setSelectedDivision(e.target.value as any)}>
                  <option value="TSB">TSB (Járőr)</option>
                  <option value="SEB">SEB (Taktikai)</option>
                  <option value="MCB">MCB (Nyomozó)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">Rendfokozat</label>
                <select
                  className="w-full h-10 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  value={selectedRank} onChange={(e) => setSelectedRank(e.target.value)}>
                  {FACTION_RANKS.map((rank) => (<option key={rank} value={rank}>{rank}</option>))}
                </select>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">Email Cím</label>
                <div className="relative"><Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/><Input
                  required type="email" className="pl-9 bg-slate-900 border-slate-800" value={email}
                  onChange={(e) => setEmail(e.target.value)}/></div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase">Jelszó</label>
                <div className="relative"><Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/><Input
                  required type="password" className="pl-9 bg-slate-900 border-slate-800" value={password}
                  onChange={(e) => setPassword(e.target.value)}/></div>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit"
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold h-11 transition-all"
                      disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Regisztráció
              </Button>
              <p className="text-center mt-4 text-sm text-slate-500">
                Már rendelkezel hozzáféréssel? <Link to="/login"
                                                     className="text-yellow-500 hover:text-yellow-400 font-medium hover:underline">Belépés</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}