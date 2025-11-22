import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export function AdminPage() {
  const { supabase, profile } = useAuth();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // JAVÍTÁS: Jogosultság ellenőrzés
  // Csak Admin vagy Supervisor léphet be ide
  if (profile && profile.system_role !== 'admin' && profile.system_role !== 'supervisor') {
    return <Navigate to="/mcb" replace />;
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Mindenki, aki nem pending
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('system_role', 'pending')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("Hiba a felhasználók betöltésekor.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  // ... (A többi funkció, pl. promote/demote itt jönne, de most csak a listázást és védelmet javítottuk)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20 text-red-500">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Adminisztráció</h1>
          <p className="text-slate-400 text-sm">Felhasználók és jogosultságok kezelése.</p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle>Felhasználók</CardTitle>
          <CardDescription>Az összes aktív felhasználó listája.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-yellow-500"/></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Név</TableHead>
                  <TableHead>Jelvényszám</TableHead>
                  <TableHead>Rang</TableHead>
                  <TableHead>Jogosultság</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-white">{user.full_name}</TableCell>
                    <TableCell className="font-mono text-slate-400">{user.badge_number}</TableCell>
                    <TableCell>{user.faction_rank}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={user.system_role === 'admin' ? 'text-red-400 border-red-900' : 'text-slate-400'}>
                        {user.system_role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}