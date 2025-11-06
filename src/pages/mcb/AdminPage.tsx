import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import type { Profile } from "@/types/supabase";
import { Loader2, UserCheck, UserX, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ... getRoleBadge segédfüggvény (változatlan) ...
const getRoleBadge = (role: string) => {
  switch (role) {
    case "lead_detective":
      return <Badge variant="destructive" className="text-base">Főnyomozó</Badge>;
    case "detective":
      return <Badge variant="default" className="bg-blue-600 text-base">Nyomozó</Badge>;
    case "pending":
      return <Badge variant="secondary" className="text-base">Függőben</Badge>;
    default:
      return <Badge variant="outline" className="text-base">{role}</Badge>;
  }
};


export function AdminPage() {
  const { profile, supabase, session } = useAuth();
  const [users, setUsers] = React.useState<Profile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // JAVÍTÁS: Az állapotot string-tömbre cseréljük
  const [loadingActions, setLoadingActions] = React.useState<string[]>([]);

  // ... fetchUsers (változatlan) ...
  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      toast.error("Hiba a felhasználók lekérésekor", { description: error.message });
    } else {
      setUsers(data);
    }
    setIsLoading(false);
  };

  // ... useEffect (változatlan) ...
  React.useEffect(() => {
    if (profile?.role !== 'lead_detective') {
      setError("Nincs jogosultságod az oldal megtekintéséhez.");
      setIsLoading(false);
      return;
    }
    fetchUsers();
  }, [profile]);

  // ... secureFetch (változatlan) ...
  const secureFetch = async (url: string, body: object) => {
    const token = session?.access_token;
    if (!token) {
      throw new Error("Nincs hitelesítve");
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Ismeretlen hiba');
    }
    return result;
  };

  // JÓVÁHAGYÁS (JAVÍTVA)
  const handleApprove = async (userId: string) => {
    // JAVÍTÁS: Hozzáadjuk az ID-t a tömbhöz
    setLoadingActions(current => [...current, userId]);
    try {
      const result = await secureFetch('/api/admin/update-role', {
        targetUserId: userId,
        newRole: 'detective',
      });

      setUsers(currentUsers =>
        currentUsers.map(user =>
          user.id === userId ? result.updatedProfile : user
        )
      );
      toast.success("Felhasználó jóváhagyva!", { description: `${result.updatedProfile.full_name} előléptetve.` });

    } catch (err) {
      const error = err as Error;
      toast.error("Hiba a jóváhagyáskor", { description: error.message });
    } finally {
      // JAVÍTÁS: Eltávolítjuk az ID-t a tömbből
      setLoadingActions(current => current.filter(id => id !== userId));
    }
  };

  // ELUTASÍTÁS / KIRÚGÁS (JAVÍTVA)
  const handleDeny = async (userId: string, userName: string) => {
    // JAVÍTÁS: Hozzáadjuk az ID-t a tömbhöz
    setLoadingActions(current => [...current, userId]);
    try {
      const result = await secureFetch('/api/admin/delete-user', {
        targetUserId: userId,
      });

      setUsers(currentUsers =>
        currentUsers.filter(user => user.id !== result.deletedUserId)
      );
      toast.success("Felhasználó törölve!", { description: `${userName} eltávolítva a rendszerből.` });

    } catch (err) {
      const error = err as Error;
      toast.error("Hiba a törléskor", { description: error.message });
    } finally {
      // JAVÍTÁS: Eltávolítjuk az ID-t a tömbből
      setLoadingActions(current => current.filter(id => id !== userId));
    }
  };

  // ... Renderelés (töltés, hiba) (változatlan) ...
  if (isLoading && users.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-16 w-16 animate-spin" />
      </div>
    );
  }
  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <>
      <Toaster position="top-center" richColors theme="dark" />
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardHeader>
          <CardTitle>Felhasználókezelés</CardTitle>
          <CardDescription>
            Itt láthatod a regisztrált felhasználókat és kezelheted a jogosultságaikat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Név</TableHead>
                <TableHead>Rang</TableHead>
                <TableHead>Regisztráció dátuma</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Nincsenek felhasználók.
                  </TableCell>
                </TableRow>
              )}

              {/* JAVÍTÁS: A JSX-ben .includes()-t használunk */}
              {users.map((user) => (
                <TableRow key={user.id} className={loadingActions.includes(user.id) ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleString('hu-HU')}</TableCell>
                  <TableCell className="text-right space-x-2">

                    {loadingActions.includes(user.id) && (
                      <Loader2 className="w-5 h-5 inline-flex animate-spin" />
                    )}

                    {user.id !== profile?.id && !loadingActions.includes(user.id) && (
                      <>
                        {user.role === 'pending' && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <UserX className="w-4 h-4 mr-2" /> Elutasítás
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Biztosan törlöd a felhasználót?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Ez a művelet véglegesen törli {user.full_name} fiókját. A művelet nem vonható vissza.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Mégse</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeny(user.id, user.full_name)}>
                                    Igen, törlés
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(user.id)}
                            >
                              <UserCheck className="w-4 h-4 mr-2" /> Jóváhagyás
                            </Button>
                          </>
                        )}
                        {user.role === 'detective' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <UserX className="w-4 h-4 mr-2" /> Kirúgás
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Biztosan kirúgod a nyomozót?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ez a művelet véglegesen törli {user.full_name} fiókját. A művelet nem vonható vissza.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Mégse</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeny(user.id, user.full_name)}>
                                  Igen, kirúgás
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    )}

                    {user.id === profile?.id && (
                      <ShieldQuestion className="w-5 h-5 inline-flex text-slate-500" title="Ez te vagy" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}