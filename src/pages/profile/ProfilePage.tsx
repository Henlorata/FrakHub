import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Badge} from "@/components/ui/badge";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {toast} from "sonner";
import {
  Key, Save, Loader2, Star, Briefcase, Calendar, Crown, Award,
  Shield, UserCog, Medal, PlusCircle, Sparkles, Trophy
} from "lucide-react";
import {getDepartmentLabel, isExecutive} from "@/lib/utils";
import {GiveAwardDialog} from "./components/GiveAwardDialog.tsx";

// --- 3D TILT KÁRTYA (Shine effekttel) ---
const TiltCard = ({children, className}: { children: React.ReactNode, className?: string }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const shineRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !shineRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Forgatás
    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

    // Shine effekt pozíciója
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;
    shineRef.current.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.2), transparent 50%)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current || !shineRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    shineRef.current.style.background = 'transparent';
  };

  return (
    <div
      ref={cardRef}
      className={`relative transition-transform duration-200 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={shineRef}
           className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-all duration-200"/>
      {children}
    </div>
  );
};

export function ProfilePage() {
  const {profile, supabase} = useAuth();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [stats, setStats] = React.useState({serviceDays: 0, closedCases: 0});
  const [ribbons, setRibbons] = React.useState<any[]>([]);
  const [isAwardDialogOpen, setIsAwardDialogOpen] = React.useState(false);

  // Form states
  const [newName, setNewName] = React.useState(profile?.full_name || "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const loadData = React.useCallback(async () => {
    if (!profile) return;
    // 1. Szolgálati idő
    const start = new Date(profile.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 2. Lezárt akták
    const {count} = await supabase.from('cases').select('id', {
      count: 'exact',
      head: true
    }).eq('owner_id', profile.id).eq('status', 'closed');

    // 3. Ribbons
    const {data: userRibbons} = await supabase
      .from('user_ribbons')
      .select(`awarded_at, ribbons (id, name, description, color_hex, image_url)`)
      .eq('user_id', profile.id);

    setRibbons(userRibbons?.map((ur: any) => ({...ur.ribbons, awarded_at: ur.awarded_at})) || []);
    setStats({serviceDays: diffDays, closedCases: count || 0});
  }, [profile, supabase]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error("A név nem lehet üres.");
    setIsUpdating(true);
    try {
      const {error} = await supabase.rpc('change_user_name', {_new_name: newName});
      if (error) throw error;
      toast.success("Név sikeresen megváltoztatva!");
      window.location.reload();
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("A jelszavak nem egyeznek!");
    if (newPassword.length < 6) return toast.error("A jelszó túl rövid.");
    setIsUpdating(true);
    const {error} = await supabase.auth.updateUser({password: newPassword});
    setIsUpdating(false);
    if (error) toast.error("Hiba: " + error.message);
    else {
      toast.success("Jelszó módosítva!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (!profile) return null;

  const isCommandStaff = ['Captain', 'Lieutenant', 'Commander', 'Deputy'].some(r => profile.faction_rank.includes(r));
  const showAwardButton = isExecutive(profile);

  // Státusz jelzők
  const isVeteran = stats.serviceDays > 365;
  const isExperienced = stats.serviceDays > 180 && !isVeteran;

  const getGradient = () => {
    // Bureau Manager: Különleges, legmagasabb szintű gradiens
    if (profile.is_bureau_manager) return 'from-slate-900 via-purple-950 to-yellow-900/40 border-yellow-500/50 shadow-yellow-900/20';
    if (isCommandStaff) return 'from-slate-900 via-slate-900 to-yellow-900/40 border-yellow-900/30';
    if (profile.division === 'SEB') return 'from-slate-900 via-slate-900 to-red-950/50 border-red-900/30';
    if (profile.division === 'MCB') return 'from-slate-900 via-slate-900 to-blue-950/50 border-blue-900/30';
    return 'from-slate-900 via-slate-900 to-green-950/50 border-green-900/30';
  };

  const IDCard = () => (
    <TiltCard
      className={`relative overflow-hidden rounded-xl border-2 shadow-2xl bg-gradient-to-br ${getGradient()} p-6 min-h-[280px] flex flex-col justify-between group`}>
      {/* VÍZJEL */}
      <div
        className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-1/4 translate-y-1/4 rotate-12">
        <img src="/mcb_logo.png" className="w-80 h-80 grayscale contrast-150" alt="Logo"/>
      </div>

      {/* JOBB FELSŐ SAROK: KÉPESÍTÉSEK (Átdolgozva) */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-20">
        {/* Vezetői Képesítések (ARANY) */}
        {profile.commanded_divisions?.map(div => (
          <Badge key={div}
                 className="bg-yellow-500/20 backdrop-blur border-yellow-500/60 text-yellow-200 font-bold text-[10px] px-2 py-0.5 shadow-lg shadow-yellow-900/20">
            <Crown className="w-3 h-3 mr-1 text-yellow-400"/> Cmdr. {div}
          </Badge>
        ))}

        {/* Sima Képesítések */}
        {(profile.qualifications || []).filter(q => !profile.commanded_divisions?.includes(q)).map(q => (
          <Badge key={q}
                 className="bg-black/40 backdrop-blur border-white/10 text-slate-300 font-mono text-[10px] px-2 py-0.5 shadow-sm hover:bg-black/60 transition-colors">
            {q}
          </Badge>
        ))}
      </div>

      {/* BAL FELSŐ: NÉV ÉS BEOSZTÁS */}
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar
              className={`w-24 h-24 border-2 shadow-2xl ${profile.is_bureau_manager ? 'border-purple-400' : isCommandStaff ? 'border-yellow-500' : 'border-slate-600'}`}>
              <AvatarImage src={profile.avatar_url} className="object-cover"/>
              <AvatarFallback
                className="bg-slate-950 text-slate-400 font-bold text-3xl">{profile.full_name.charAt(0)}</AvatarFallback>
            </Avatar>

            {/* Veterán Csillag */}
            {isVeteran && (
              <div
                className="absolute -bottom-2 -right-2 bg-yellow-500 text-black p-1.5 rounded-full border-2 border-slate-900 shadow-lg"
                title="Veterán (1+ év)">
                <Star className="w-4 h-4 fill-black"/>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">{profile.full_name}</h2>

            {/* RANG JELVÉNYEK */}
            <div className="flex flex-wrap items-center gap-2 max-w-[300px]">
              <Badge variant="outline"
                     className={`uppercase tracking-wider text-[10px] font-bold py-1 ${isCommandStaff ? 'border-yellow-500/50 text-yellow-500 bg-yellow-900/10' : 'border-slate-500 text-slate-300'}`}>
                {profile.faction_rank}
              </Badge>

              {/* BUREAU MANAGER KIEMELÉS */}
              {profile.is_bureau_manager && (
                <Badge
                  className="bg-purple-600 text-white border-purple-400 border font-bold text-[10px] shadow-lg shadow-purple-900/50 px-2 py-0.5 animate-pulse">
                  <Crown className="w-3 h-3 mr-1 fill-white"/> Bureau Manager
                </Badge>
              )}

              {/* BUREAU COMMANDER KIEMELÉS */}
              {profile.is_bureau_commander && (
                <Badge className="bg-blue-600/80 text-white border-blue-400 border font-bold text-[10px] px-2 py-0.5">
                  <Award className="w-3 h-3 mr-1"/> Bureau Commander
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LÁBLÉC */}
      <div className="relative z-10 grid grid-cols-2 gap-8 mt-auto pt-6">
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-widest opacity-80">Osztály /
            Divízió
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white drop-shadow-md">{getDepartmentLabel(profile.division)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-widest opacity-80">Jelvény</div>
          <div className="text-3xl font-mono font-bold text-white tracking-widest drop-shadow-lg"
               style={{textShadow: '0 2px 10px rgba(0,0,0,0.5)'}}>
            #{profile.badge_number}
          </div>
        </div>
      </div>

      {/* ALSÓ SZÍNES CSÍK */}
      <div
        className={`absolute bottom-0 left-0 w-full h-3 ${profile.is_bureau_manager ? 'bg-purple-600' : isCommandStaff ? 'bg-yellow-600' : profile.division === 'SEB' ? 'bg-red-700' : profile.division === 'MCB' ? 'bg-blue-700' : 'bg-green-700'}`}/>
    </TiltCard>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <GiveAwardDialog
        open={isAwardDialogOpen}
        onOpenChange={setIsAwardDialogOpen}
        targetUserId={profile.id}
        targetUserName={profile.full_name}
        onSuccess={loadData}
      />

      {/* --- STATISZTIKA SÁV --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 md:col-span-2 relative overflow-hidden">
          {/* Veterán háttér effekt */}
          {isVeteran && <div
            className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-yellow-600/10 to-transparent pointer-events-none"/>}
          <CardContent className="p-6 flex items-center gap-4 relative z-10">
            <div
              className={`p-3 rounded-full border ${isVeteran ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-500' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
              {isVeteran ? <Trophy className="w-6 h-6"/> : <Calendar className="w-6 h-6"/>}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">Szolgálati Idő</p>
              <div className="flex items-center gap-2">
                <p
                  className={`text-2xl font-bold ${isVeteran ? 'text-yellow-500' : 'text-white'}`}>{stats.serviceDays} napja</p>
                {isVeteran &&
                  <Badge className="bg-yellow-600 text-black font-bold text-[10px] px-1.5 h-5">VETERÁN</Badge>}
                {isExperienced &&
                  <Badge className="bg-slate-700 text-white font-bold text-[10px] px-1.5 h-5">TAPASZTALT</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-slate-950 rounded-full border border-slate-800"><Briefcase
              className="w-6 h-6 text-blue-500"/></div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">Lezárt Akták</p>
              <p className="text-2xl font-bold text-white">{stats.closedCases}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-slate-950 rounded-full border border-slate-800"><Star
              className="w-6 h-6 text-yellow-500"/></div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold">Kitüntetések</p>
              <p className="text-2xl font-bold text-white">{ribbons.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* BAL OLDAL: KÁRTYA ÉS INFÓK (7 col) */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield
              className="w-5 h-5 text-slate-400"/> Szolgálati Igazolvány</h3>
            <IDCard/>
          </div>

          {/* KITÜNTETÉSEK - Most már valós adatokkal */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Medal
                className="w-5 h-5 text-yellow-500"/> Kitüntetések & Szalagsávok</h3>
              {showAwardButton && (
                <Button size="sm" variant="outline"
                        className="border-slate-700 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-900/10"
                        onClick={() => setIsAwardDialogOpen(true)}>
                  <PlusCircle className="w-4 h-4 mr-2"/> Új Kitüntetés
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ribbons.length > 0 ? ribbons.map((ribbon, idx) => (
                <div key={idx}
                     className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center gap-3 hover:border-slate-600 transition-all group cursor-default animate-in slide-in-from-bottom-2 duration-500"
                     style={{animationDelay: `${idx * 100}ms`}}>
                  {/* Szalag képe vagy színe */}
                  {ribbon.image_url ? (
                    <img src={ribbon.image_url} alt={ribbon.name} className="h-8 w-auto object-contain drop-shadow-md"/>
                  ) : (
                    <div className="w-3 h-8 rounded-sm shadow-[0_0_10px_rgba(0,0,0,0.5)] shrink-0"
                         style={{backgroundColor: ribbon.color_hex}}/>
                  )}

                  <div>
                    <div
                      className="text-sm font-bold text-white group-hover:text-yellow-500 transition-colors flex items-center gap-2">
                      {ribbon.name}
                      <Sparkles
                        className="w-3 h-3 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
                    </div>
                    <div className="text-[10px] text-slate-500">{ribbon.description}</div>
                    <div className="text-[9px] text-slate-600 mt-1 flex items-center gap-1"><Calendar
                      className="w-3 h-3"/> {new Date(ribbon.awarded_at).toLocaleDateString('hu-HU')}</div>
                  </div>
                </div>
              )) : (
                <div
                  className="col-span-full border border-dashed border-slate-800 p-6 rounded-lg flex flex-col items-center justify-center text-slate-500 text-sm">
                  <Star className="w-8 h-8 mb-2 opacity-20"/>
                  Nincs még kitüntetés.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* JOBB OLDAL: BEÁLLÍTÁSOK (5 col) */}
        <div className="lg:col-span-5">
          <Card className="bg-slate-900/50 border-slate-800 sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCog className="w-5 h-5"/> Profil Kezelés</CardTitle>
              <CardDescription>Személyes adatok és biztonság.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-950 mb-6">
                  <TabsTrigger value="general">Általános</TabsTrigger>
                  <TabsTrigger value="security">Biztonság</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                  <div className="space-y-2">
                    <Label>Teljes Név (IC)</Label>
                    <div className="flex gap-2">
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                             className="bg-slate-950 border-slate-700"/>
                      <Button onClick={handleNameChange} disabled={isUpdating || newName === profile.full_name}
                              className="bg-blue-600 hover:bg-blue-700">
                        {isUpdating ? <Loader2 className="animate-spin"/> : <Save className="w-4 h-4"/>}
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500">Figyelem: A névváltást a rendszer naplózza.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Jelvény és Rang</Label>
                    <div className="p-3 bg-slate-950 rounded border border-slate-800 text-sm text-slate-400">
                      Ezeket az adatokat csak a HR részleg módosíthatja.
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="security">
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2"><Label>Új Jelszó</Label><Input type="password" value={newPassword}
                                                                              onChange={(e) => setNewPassword(e.target.value)}
                                                                              className="bg-slate-950 border-slate-700"/>
                    </div>
                    <div className="space-y-2"><Label>Megerősítés</Label><Input type="password" value={confirmPassword}
                                                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                                                className="bg-slate-950 border-slate-700"/>
                    </div>
                    <Button type="submit" disabled={isUpdating || !newPassword}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold mt-2">
                      {isUpdating ? <Loader2 className="animate-spin mr-2"/> : <Key className="w-4 h-4 mr-2"/>} Jelszó
                      Frissítése
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}