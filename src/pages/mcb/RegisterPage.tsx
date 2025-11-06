import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner"; // 'sonner' import már megvolt

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (fullName.trim() === "") {
      setError("A 'Teljes név' megadása kötelező.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password,
          full_name: fullName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ismeretlen hiba történt');
      }

      // JAVÍTÁS: A toast.success egy ID-t ad vissza, amivel
      // figyelhetjük az eseményeit.
      toast.success("Sikeres regisztráció!", {
        description: "A fiókodat egy Főnyomozónak jóvá kell hagynia. Kérjük, várakozz. Átirányítunk...",
        duration: 4000, // 4 másodperc
        onAutoClose: () => {
          // Ez a függvény lefut, amikor a toast eltűnik
          navigate('/mcb/login');
        },
      });

      setFullName("");
      setEmail("");
      setPassword("");

      // A setTimeout TÖRÖLVE
      // setTimeout(() => {
      //   navigate('/mcb/login');
      // }, 3000);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* A Toaster hozzáadva, hogy a 'toast' működjön */}
      <Toaster position="top-center" richColors theme="dark" />
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700 text-white">
          <CardHeader>
            <CardTitle className="text-2xl text-center">MCB Regisztráció</CardTitle>
            <CardDescription className="text-center pt-2">
              Hozd létre a fiókodat a nyomozói rendszerhez.
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
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name">Teljes név (IC)</label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  className="text-base"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
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
                  minLength={6}
                  required
                />
              </div>
              <Button className="w-full text-base" type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Regisztráció..." : "Regisztráció"}
              </Button>
              <p className="text-center text-sm text-slate-400">
                Már van fiókod?{" "}
                <a href="/mcb/login" className="text-blue-400 hover:underline">
                  Bejelentkezés
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}