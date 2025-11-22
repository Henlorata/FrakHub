import * as React from "react";
import {useNavigate, Link} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter} from "@/components/ui/card";
import {toast} from "sonner";
import {Loader2, Shield, LogIn} from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const {supabase, session, profile} = useAuth(); // Profile is kell

  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // FIGYELŐ: Ha megérkezett a profil és a session, akkor navigálunk
  React.useEffect(() => {
    if (session && profile) {
      if (profile.system_role === 'pending') {
        // Ha pending, azt az AppLayout kezeli, de ide is tehetünk egy safety checket
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [session, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);

    try {
      const {error} = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Sikeres bejelentkezés", {description: "Az adatok betöltése folyamatban..."});
      // NEM navigálunk itt azonnal! Hagyjuk, hogy a useEffect és az AuthContext tegye a dolgát.
      // A loading state maradhat true, amíg át nem dob.

    } catch (err: any) {
      toast.error("Sikertelen bejelentkezés", {
        description: "Helytelen email cím vagy jelszó.",
      });
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/sfsd_bg.jpg')] bg-cover bg-center opacity-10 pointer-events-none"/>

      <Card
        className="w-full max-w-md bg-slate-900/90 border-slate-800 text-slate-100 backdrop-blur-sm shadow-2xl z-10">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-6">
            <div
              className="h-24 w-24 bg-yellow-600/10 rounded-full flex items-center justify-center border-2 border-yellow-600/30 shadow-[0_0_15px_rgba(202,138,4,0.3)]">
              <Shield className="h-12 w-12 text-yellow-500"/>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-yellow-500 tracking-wide">SFSD INTRANET</CardTitle>
          <CardDescription className="text-slate-400">
            San Fierro Sheriff's Department<br/>Adatbázis és Ügyviteli Rendszer
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-slate-400 tracking-wider">Email Cím</label>
              <Input
                type="email"
                placeholder="badge@sfsd.com"
                className="bg-slate-950 border-slate-800 focus:border-yellow-600/50 h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium uppercase text-slate-400 tracking-wider">Jelszó</label>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                className="bg-slate-950 border-slate-800 focus:border-yellow-600/50 h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold h-11"
                    disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogIn className="mr-2 h-4 w-4"/>}
              {isLoading ? "Hitelesítés..." : "Belépés"}
            </Button>

            <div className="relative w-full py-2">
              <div className="absolute inset-0 flex items-center"><span
                className="w-full border-t border-slate-800"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span
                className="bg-slate-900 px-2 text-slate-500">Nincs még fiókod?</span></div>
            </div>

            <Button variant="outline"
                    className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-yellow-500" asChild>
              <Link to="/register">Regisztráció</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="absolute bottom-4 text-center text-slate-600 text-xs">
        &copy; 2025 San Fierro Sheriff's Department. Restricted Access.
      </div>
    </div>
  );
}