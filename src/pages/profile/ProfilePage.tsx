import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {toast} from "sonner";
import {
  Key,
  Save,
  Loader2,
  Star,
  Briefcase,
  FileCheck,
  Car,
  Shield,
  Calendar,
  Clock,
  Crown,
  Award
} from "lucide-react";
import {getDepartmentLabel} from "@/lib/utils";
import type {Profile} from "@/types/supabase";

// RANG LISTÁK A KATEGORIZÁLÁSHOZ
const HIGH_COMMAND_RANKS = ['Commander', 'Deputy Commander', 'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_RANKS = ['Sergeant II.', 'Sergeant I.'];

export function ProfilePage() {
  const {profile, supabase} = useAuth();
  const [isUpdating, setIsUpdating] = React.useState(false);

  const [stats, setStats] = React.useState({
    closedCases: 0,
    approvedRequests: 0,
    activeSince: "",
  });

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  React.useEffect(() => {
    if (!profile) return;

    const loadStats = async () => {
      const {count: casesCount} = await supabase.from('cases').select('id', {
        count: 'exact',
        head: true
      }).eq('owner_id', profile.id).eq('status', 'closed');
      const {count: vehicleReq} = await supabase.from('vehicle_requests').select('id', {
        count: 'exact',
        head: true
      }).eq('user_id', profile.id).eq('status', 'approved');
      const {count: budgetReq} = await supabase.from('budget_requests').select('id', {
        count: 'exact',
        head: true
      }).eq('user_id', profile.id).eq('status', 'approved');

      setStats({
        closedCases: casesCount || 0,
        approvedRequests: (vehicleReq || 0) + (budgetReq || 0),
        activeSince: new Date(profile.created_at).toLocaleDateString('hu-HU')
      });
    };

    loadStats();
  }, [profile, supabase]);

  if (!profile) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("A jelszavak nem egyeznek!");
    if (newPassword.length < 6) return toast.error("A jelszó túl rövid (min 6 karakter).");

    setIsUpdating(true);
    const {error} = await supabase.auth.updateUser({password: newPassword});
    setIsUpdating(false);

    if (error) toast.error("Hiba: " + error.message);
    else {
      toast.success("Jelszó sikeresen módosítva!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // --- ÚJ GENERÁCIÓS IGAZOLVÁNY KÁRTYA ---
  const IDCard = ({rank, division, badgeNum, isSecondary = false, divisionRank = null, userProfile}: {
    rank: string,
    division: string,
    badgeNum: string,
    isSecondary?: boolean,
    divisionRank?: string | null,
    userProfile: Profile
  }) => {
    const displayRank = isSecondary && divisionRank ? divisionRank : rank;
    const themeColor = division === 'MCB' ? 'blue' : division === 'SEB' ? 'red' : 'green';

    // STAFF LEVEL LOGIKA (Rang alapján)
    let staffLevel = "Field Staff";
    if (HIGH_COMMAND_RANKS.includes(rank)) staffLevel = "Executive / Command Staff";
    else if (SUPERVISORY_RANKS.includes(rank)) staffLevel = "Supervisory Staff";

    // Ha másodlagos kártya (pl. MCB), akkor ott az Osztály nevét írjuk ki a Staff Level helyett
    const footerLabel = isSecondary ? getDepartmentLabel(division) : staffLevel;

    // Vezetői Titulusok (Ikon + Szöveg)
    const isBureauManager = userProfile.is_bureau_manager;
    // Bureau Commander csak akkor, ha nem TSB, VAGY ha TSB és ez az elsődleges kártya
    const isBureauCommander = userProfile.is_bureau_commander && (division !== 'TSB' || !isSecondary);

    // Division Commander: Csak azokat mutatjuk, ami releváns az adott kártyához (vagy mindet az elsődlegesen)
    const relevantDivCommands = userProfile.commanded_divisions || [];

    const bgGradient = division === 'MCB'
      ? 'from-slate-900 to-blue-950'
      : division === 'SEB'
        ? 'from-slate-900 to-red-950'
        : 'from-slate-900 to-green-950';

    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-slate-700 shadow-2xl bg-gradient-to-br ${bgGradient} p-6 min-h-[240px] flex flex-col justify-between group transition-transform hover:scale-[1.01] duration-300`}>

        <div
          className="absolute -right-6 -bottom-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity rotate-12">
          <Shield className="w-48 h-48 text-white" strokeWidth={1}/>
        </div>

        {/* FEJLÉC */}
        <div className="flex justify-between items-start relative z-10">
          <div className="flex items-center gap-4">
            <Avatar className={`w-16 h-16 border-2 border-${themeColor}-500 shadow-lg`}>
              <AvatarImage src={userProfile.avatar_url} className="object-cover"/>
              <AvatarFallback
                className="bg-slate-800 text-slate-400 font-bold text-xl">{userProfile.full_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold text-white leading-none tracking-tight">{userProfile.full_name}</h2>
              <p
                className={`text-${themeColor}-400 font-medium uppercase tracking-wider text-xs mt-1.5`}>{displayRank}</p>

              {/* VEZETŐI JELZÉSEK A NÉV ALATT */}
              <div className="flex flex-col gap-1 mt-2">
                {isBureauManager && (
                  <Badge
                    className="w-fit bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold">
                    <Crown className="w-3 h-3 mr-1.5 fill-yellow-400"/> Bureau Manager
                  </Badge>
                )}
                {isBureauCommander && !isSecondary && ( // Bureau Commandert csak az elsődleges kártyára vagy a relevánsra
                  <Badge
                    className="w-fit bg-blue-400/20 text-blue-300 border-blue-400/50 hover:bg-blue-400/30 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold">
                    <Award className="w-3 h-3 mr-1.5"/> Bureau Commander
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Jelvény</div>
            <div className="text-xl font-mono font-bold text-white tracking-wide">#{badgeNum}</div>
          </div>
        </div>

        {/* LÁBLÉC / ADATOK */}
        <div className="space-y-4 relative z-10 mt-4">

          {/* KVALIFIKÁCIÓK ÉS DIVÍZIÓK (Hashtag nélkül, TSB nélkül) */}
          <div className="flex flex-wrap gap-1.5">
            {/* Divízió jelvény (csak ha NEM TSB) */}
            {division !== 'TSB' && (
              <Badge variant="secondary" className="bg-black/30 border-white/10 text-white/90 hover:bg-black/40">
                {division}
              </Badge>
            )}

            {/* Division Commander Badgek */}
            {!isSecondary && relevantDivCommands.map(dc => (
              <Badge key={dc} className="bg-purple-500/20 text-purple-300 border-purple-500/50 hover:bg-purple-500/30">
                Cmdr. {dc}
              </Badge>
            ))}

            {/* Sima Kvalifikációk */}
            {(userProfile.qualifications || []).map(q => (
              <Badge key={q} variant="outline" className="border-white/10 text-white/60">
                {q}
              </Badge>
            ))}
          </div>

          <div className="flex justify-between items-end border-t border-white/10 pt-3">
            <div>
              <div
                className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">{isSecondary ? 'Osztály' : 'Besorolás'}</div>
              <div className="text-sm text-slate-200 font-semibold">{footerLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Szervezet</div>
              <div className="text-sm text-white/80 font-serif tracking-wide">San Fierro Sheriff's Dept.</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-white">Személyi Dosszié</h1><p className="text-slate-400">Szolgálati
          adatok és beállítások.</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Star className="w-3 h-3"/> Elsődleges Beosztás
            </h3>
            {/* A TSB-t átadjuk, de a komponens kezeli a megjelenítést */}
            <IDCard
              rank={profile.faction_rank}
              division={profile.division}
              badgeNum={profile.badge_number}
              userProfile={profile}
            />
          </div>

          {(profile.division === 'MCB' || profile.division === 'SEB') && (
            <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-700">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Briefcase className="w-3 h-3"/> Specializáció
              </h3>
              <IDCard
                rank={profile.faction_rank}
                division={profile.division}
                divisionRank={profile.division_rank}
                badgeNum={profile.badge_number}
                isSecondary={true}
                userProfile={profile}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Calendar className="w-5 h-5"/></div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Szolgálat kezdete</div>
                  <div className="text-sm font-medium text-white">{stats.activeSince}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Clock className="w-5 h-5"/></div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Státusz</div>
                  <div className="text-sm font-medium text-green-500">Aktív Állomány</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                <Briefcase className="w-6 h-6 text-yellow-500 mb-2 opacity-80"/>
                <div className="text-2xl font-bold text-white">{stats.closedCases}</div>
                <div className="text-[10px] uppercase text-slate-500 font-bold mt-1">Lezárt Akták</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                <Car className="w-6 h-6 text-blue-500 mb-2 opacity-80"/>
                <div className="text-2xl font-bold text-white">{stats.approvedRequests}</div>
                <div className="text-[10px] uppercase text-slate-500 font-bold mt-1">Elfogadott Igénylések</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800 col-span-2">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-green-900/20 flex items-center justify-center text-green-500 border border-green-900/30">
                    <FileCheck className="w-5 h-5"/></div>
                  <div>
                    <div className="text-sm font-bold text-white">Kvalifikációk</div>
                    <div className="text-xs text-slate-500">Megszerzett képesítések</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {profile.qualifications && profile.qualifications.length > 0 ? (
                    profile.qualifications.map(q => <Badge key={q} variant="secondary"
                                                           className="bg-slate-800 text-slate-300 border-slate-700">{q}</Badge>)
                  ) : <span className="text-xs text-slate-600 italic">Nincs rögzítve</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900 border-slate-800 shadow-lg">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Key
              className="w-5 h-5 text-slate-400"/> Biztonság</CardTitle><CardDescription>Fiók jelszavának
              módosítása.</CardDescription></CardHeader>
            <form onSubmit={handlePasswordChange}>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Új Jelszó</Label><Input type="password"
                                                                          className="bg-slate-950 border-slate-700 focus-visible:ring-yellow-600/50"
                                                                          value={newPassword}
                                                                          onChange={(e) => setNewPassword(e.target.value)}/>
                </div>
                <div className="space-y-2"><Label>Megerősítés</Label><Input type="password"
                                                                            className="bg-slate-950 border-slate-700 focus-visible:ring-yellow-600/50"
                                                                            value={confirmPassword}
                                                                            onChange={(e) => setConfirmPassword(e.target.value)}/>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-800 pt-4 bg-slate-950/30">
                <Button type="submit" disabled={isUpdating || !newPassword}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold">{isUpdating ?
                  <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2"/>} Jelszó
                  Mentése</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}