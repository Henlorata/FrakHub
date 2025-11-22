import React from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Shield, LogOut, Clock, CheckCircle2, AlertTriangle} from "lucide-react";

export function PendingApprovalPage() {
  const {profile, signOut, supabase} = useAuth();
  const [isRecruitmentClosed, setIsRecruitmentClosed] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = async () => {
      const {data} = await supabase.from('system_status').select('recruitment_open').eq('id', 'global').single();
      if (data && data.recruitment_open === false) setIsRecruitmentClosed(true);
    };
    checkStatus();
  }, [supabase]);

  return (
    <div
      className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/10 via-slate-950 to-slate-950"/>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">

        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-75"/>
          <div
            className="relative bg-slate-900 rounded-full border-2 border-yellow-600 p-5 shadow-[0_0_30px_rgba(202,138,4,0.3)]">
            <Shield className="w-full h-full text-yellow-500"/>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-slate-900 rounded-full p-1.5 border border-slate-700">
            <Clock className="w-5 h-5 text-yellow-500 animate-pulse"/>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Jóváhagyásra Vár</h1>
          <p className="text-slate-400">Üdvözlünk, <span
            className="text-yellow-500 font-medium">{profile?.full_name}</span>!</p>
        </div>

        <div
          className="bg-slate-900/80 backdrop-blur-md border border-yellow-600/30 rounded-xl p-6 text-left shadow-2xl">

          {/* LÉTSZÁMSTOP ALERT */}
          {isRecruitmentClosed && (
            <div className="mb-4 p-3 bg-red-950/30 border border-red-500/30 rounded text-red-200 text-sm flex gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500"/>
              <p>A frakcióban jelenleg <strong>Létszámstop</strong> van érvényben. A jelentkezésed elfogadása a
                szokásosnál jóval több időt vehet igénybe.</p>
            </div>
          )}

          <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4"/> Státusz információ
          </h3>
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <p>A fiókod létrejött, de a <strong className="text-white">Vezetőség</strong> jóváhagyása szükséges a
              belépéshez.</p>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>Jelvényszám: <span className="font-mono text-slate-400">{profile?.badge_number}</span></span>
              <span>Rang: <span className="text-slate-400">{profile?.faction_rank}</span></span>
            </div>
          </div>
        </div>

        <Button variant="destructive" className="w-full border border-red-900/50 hover:bg-red-950/50 text-red-400"
                onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2"/> Kijelentkezés
        </Button>
      </div>
    </div>
  );
}