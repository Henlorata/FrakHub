import {useState, useEffect} from "react";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Checkbox} from "@/components/ui/checkbox";
import {toast} from "sonner";
import {useNavigate} from "react-router-dom";
import {CheckCircle2, Play, HelpCircle, Loader2, LogOut} from "lucide-react";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";

export function OnboardingPage() {
  const {user, profile, supabase, signOut} = useAuth();
  const navigate = useNavigate();

  const [claimCode, setClaimCode] = useState("");
  const [isExamLinked, setIsExamLinked] = useState(false);
  const [hasWatchedVideo, setHasWatchedVideo] = useState(false); // Checkbox state
  const [isLoading, setIsLoading] = useState(false);

  const checkExamStatus = async () => {
    if (!user) return;
    const {data} = await supabase.from('exam_submissions').select('id').eq('user_id', user.id).limit(1);
    if (data && data.length > 0) {
      setIsExamLinked(true);
    }
  };

  useEffect(() => {
    checkExamStatus();
    if (profile && profile.faction_rank !== 'Deputy Sheriff Trainee' && profile.onboarding_completed) {
      navigate('/');
    }
  }, [profile, user]);

  const handleClaim = async () => {
    if (!claimCode) return;
    setIsLoading(true);
    try {
      const {data, error} = await supabase.rpc('claim_exam_submission', {_token: claimCode});
      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setIsExamLinked(true);
      } else {
        toast.error(data.message);
      }
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!isExamLinked) return toast.error("Előbb csatolnod kell a vizsgádat!");
    if (!hasWatchedVideo) return toast.error("Kérlek pipáld ki, hogy megismerted az anyagot!");

    setIsLoading(true);
    try {
      const {error} = await supabase.rpc('complete_onboarding');
      if (error) throw error;

      toast.success("Kiképzés sikeres! Üdv a csapatban!");
      window.location.href = '/';
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-10 px-4">

      {/* HEADER */}
      <div className="max-w-4xl w-full text-center space-y-4 mb-8 animate-in slide-in-from-top-4">
        <img src="/mcb_logo.png" className="h-24 mx-auto drop-shadow-2xl" alt="SFSD Logo"/>
        <h1 className="text-4xl font-bold tracking-tight text-white">Üdvözöl a San Fierro Sheriff's Departmentnél!</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Gratulálunk a felvételhez, {profile?.full_name}! Mielőtt szolgálatba állnál, kérlek végezd el az alábbi
          bevezető lépéseket.
        </p>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* BAL OLDAL: INFO & VIDEÓ (2 col) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Play
                  className="w-5 h-5 text-yellow-500"/> Bevezető Videó & Tudnivalók</h2>
                {/* VIDEÓ HELYE */}
                <div
                  className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative group cursor-pointer">
                  {/* PLACEHOLDER */}
                  <iframe
                    width="100%" height="100%"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ" // IDE MAJD A VALÓDI ID-T, HA KÉSZ LESZ A VIDEÓM
                    title="SFSD Tutorial" frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>

              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  Ez a rendszer (FrakHub) lesz a mindennapi munkád alapja. Itt fogod kezelni a nyomozati aktákat (MCB),
                  itt írhatsz jelentéseket, igényelhetsz járművet a Logisztikánál, és itt találod a Btk-t (Penal Code)
                  is.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 ml-2">
                  <li><strong className="text-white">Dashboard:</strong> Hírek és gyors elérés.</li>
                  <li><strong className="text-white">MCB:</strong> Nyomozati adatbázis és akták.</li>
                  <li><strong className="text-white">Logisztika:</strong> Jármű és pénzügy.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* JOBB OLDAL */}
        <div className="space-y-6">
          <Card
            className={`border-2 transition-all shadow-xl ${isExamLinked ? 'bg-green-950/20 border-green-500/50' : 'bg-slate-900 border-yellow-600'}`}>
            <CardContent className="p-6 space-y-6">
              {isExamLinked ? (
                <div className="text-center py-6 animate-in zoom-in">
                  <div
                    className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                    <CheckCircle2 className="w-8 h-8 text-black"/>
                  </div>
                  <h3 className="text-xl font-bold text-green-400">Vizsga Csatolva!</h3>
                  <p className="text-slate-400 text-sm mt-2">A rendszer sikeresen azonosította a felvételi
                    vizsgádat.</p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-yellow-500 mb-1">Vizsga Azonosítása</h3>
                    <p className="text-slate-400 text-xs">Kérlek add meg a vizsga végén kapott kódot!</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Vizsgakód (Token)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={claimCode}
                        onChange={e => setClaimCode(e.target.value.toUpperCase())}
                        placeholder="TR-XXXX-XXXX"
                        className="bg-slate-950 border-slate-700 font-mono tracking-widest uppercase text-center"
                      />
                    </div>
                    <Button onClick={handleClaim} disabled={isLoading}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold">
                      {isLoading ? <Loader2 className="animate-spin"/> : "Csatolás"}
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-slate-800 text-center">
                    <p className="text-xs text-slate-500 mb-2">Elfelejtetted a kódot?</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full border-slate-700 text-slate-300">
                          <HelpCircle className="w-4 h-4 mr-2"/> Segítség kérése
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader><DialogTitle>Segítségkérés</DialogTitle></DialogHeader>
                        <div className="space-y-4 text-sm text-slate-300">
                          <p>Ha nem mentetted el a kódot, kérlek vedd fel a kapcsolatot egy <strong>Supervisory
                            Staff</strong> (Sergeant+) rangú felettessel (pl. Discordon vagy TS-en).</p>
                          <p>Ők képesek név alapján megkeresni a vizsgádat és kézileg hozzád rendelni a rendszerben.</p>
                          <div className="bg-slate-950 p-3 rounded border border-slate-800 text-center">
                            Jelezd nekik a karakternevedet: <br/>
                            <span className="text-yellow-500 font-bold text-lg">{profile?.full_name}</span>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* VÉGLEGESÍTÉS */}
          <div
            className={`transition-all duration-500 ${isExamLinked ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 pointer-events-none'}`}>
            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg border border-slate-800 mb-4">
              <Checkbox id="terms" checked={hasWatchedVideo} onCheckedChange={(c) => setHasWatchedVideo(c as boolean)}
                        className="mt-1 data-[state=checked]:bg-green-500 border-slate-600"/>
              <div className="space-y-1">
                <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">Megértettem</Label>
                <p className="text-xs text-slate-400">
                  Kijelentem, hogy megnéztem a videót és elolvastam a tudnivalókat.
                </p>
              </div>
            </div>

            <Button onClick={handleFinish} disabled={!isExamLinked || !hasWatchedVideo || isLoading}
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20">
              {isLoading ? <Loader2 className="animate-spin mr-2"/> : <CheckCircle2 className="w-6 h-6 mr-2"/>}
              Kiképzés Befejezése
            </Button>
          </div>

          <div className="text-center">
            <Button variant="ghost" onClick={signOut} className="text-slate-500 hover:text-red-400 text-xs">
              <LogOut className="w-3 h-3 mr-1"/> Kijelentkezés
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}