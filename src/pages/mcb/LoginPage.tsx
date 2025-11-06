import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const from = location.state?.from?.pathname || "/mcb";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setError(error.message);
      } else {
        // Sikeres bejelentkezés, az AuthContext észleli,
        // az McbLayout pedig átirányít
        navigate(from, { replace: true });
      }
    } catch (catchError) {
      setError((catchError as Error).message);
    } finally {
      // Ez a 'finally' blokk biztosítja, hogy a töltésjelző leálljon,
      // még akkor is, ha a Context/Layout közben visszairányít.
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl text-center">MCB Bejelentkezés</CardTitle>
          <CardDescription className="text-center pt-2">
            Lépj be a nyomozói adatbázisba.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Hiba</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="nyomozo@sfsd.gov"
                className="text-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password">Jelszó</label>
              <Input
                id="password"
                type="password"
                className="text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full text-base" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Bejelentkezés..." : "Bejelentkezés"}
            </Button>
            <p className="text-center text-sm text-slate-400">
              Nincs még fiókod?{" "}
              <a href="/mcb/register" className="text-blue-400 hover:underline">
                Regisztráció
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}