import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function PendingApprovalPage() {
  const { logout, profile } = useAuth();

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700 text-white text-center">
        <CardHeader>
          <Hourglass className="w-16 h-16 mx-auto text-yellow-400" />
          <CardTitle className="text-2xl mt-4">Jóváhagyásra várva</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            Szia, {profile?.full_name}! A regisztrációd sikeres volt.
            Egy Főnyomozónak (Lead Detective) jóvá kell hagynia a fiókodat,
            mielőtt beléphetnél a rendszerbe.
          </CardDescription>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={logout}>
            Kijelentkezés
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}