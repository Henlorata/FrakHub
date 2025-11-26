import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {Card} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {toast} from "sonner";
import {
  CheckCircle2,
  Loader2,
  UserPlus,
  UserCog,
  Trash2,
  Search,
  Crown,
  Star,
  Users,
  Lock,
  CalendarClock, Award, ShieldCheck
} from "lucide-react";
import {
  FACTION_RANKS,
  type Profile,
  type DepartmentDivision,
  type Qualification,
  type InvestigatorRank,
  type OperatorRank
} from "@/types/supabase";
import {cn} from "@/lib/utils";
import {differenceInDays} from "date-fns";

// --- KONFIGURÁCIÓ ---
const DIVISIONS: DepartmentDivision[] = ['TSB', 'SEB', 'MCB'];
const QUALIFICATIONS: Qualification[] = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB'];
const INVESTIGATOR_RANKS: InvestigatorRank[] = ['Investigator III.', 'Investigator II.', 'Investigator I.'];
const OPERATOR_RANKS: OperatorRank[] = ['Operator III.', 'Operator II.', 'Operator I.'];

const HIGH_COMMAND_RANKS = ['Commander', 'Deputy Commander', 'Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_RANKS = ['Sergeant II.', 'Sergeant I.'];
const CORPORAL_INDEX = FACTION_RANKS.indexOf('Corporal');

// --- EDIT DIALOG ---
function EditUserDialog({user, open, onOpenChange, onUpdate, viewerRank, onKickRequest}: {
  user: Profile | null,
  open: boolean,
  onOpenChange: (o: boolean) => void,
  onUpdate: () => void,
  viewerRank: 'admin' | 'supervisor',
  onKickRequest: () => void
}) {
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Profile>>({});

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        faction_rank: user.faction_rank,
        division: user.division,
        division_rank: user.division_rank,
        qualifications: user.qualifications || [],
        is_bureau_manager: user.is_bureau_manager || false,
        is_bureau_commander: user.is_bureau_commander || false,
        commanded_divisions: user.commanded_divisions || []
      });
    }
  }, [user, open]);

  const isTargetProtected = React.useMemo(() => {
    if (!user) return true;
    if (viewerRank === 'admin') return false;
    const userRankIndex = FACTION_RANKS.indexOf(user.faction_rank);
    return userRankIndex < CORPORAL_INDEX;
  }, [user, viewerRank]);

  const handleSave = async () => {
    if (!user) return;
    if (isTargetProtected && viewerRank !== 'admin') return toast.error("Nincs jogosultságod.");

    setLoading(true);
    try {
      const response = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: user.id, ...formData}),
      });
      if (!response.ok) throw new Error("API hiba");
      toast.success("Felhasználó frissítve!");
      onUpdate();
      onOpenChange(false);
    } catch {
      toast.error("Hiba a mentés során.");
    } finally {
      setLoading(false);
    }
  };

  const availableRanks = React.useMemo(() => {
    if (viewerRank === 'admin') return FACTION_RANKS;
    return FACTION_RANKS.slice(CORPORAL_INDEX);
  }, [viewerRank]);

  const toggleQual = (q: Qualification) => {
    const current = formData.qualifications || [];
    setFormData({...formData, qualifications: current.includes(q) ? current.filter(x => x !== q) : [...current, q]});
  };

  const toggleCommandedDivision = (q: Qualification) => {
    const current = formData.commanded_divisions || [];
    setFormData({
      ...formData,
      commanded_divisions: current.includes(q) ? current.filter(x => x !== q) : [...current, q]
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Adatlap
            Kezelése {isTargetProtected && viewerRank !== 'admin' &&
              <Lock className="w-4 h-4 text-red-500"/>}</DialogTitle>
          <DialogDescription>{user.full_name} [#{user.badge_number}]</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Frakció Rang</Label>
            <Select value={formData.faction_rank}
                    onValueChange={(val: any) => setFormData({...formData, faction_rank: val})}
                    disabled={isTargetProtected && viewerRank !== 'admin'}>
              <SelectTrigger
                className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue/></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">{availableRanks.map(r =>
                <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Osztály</Label>
              <Select value={formData.division} onValueChange={(val: any) => setFormData({
                ...formData,
                division: val,
                division_rank: val === 'TSB' ? null : formData.division_rank
              })} disabled={isTargetProtected && viewerRank !== 'admin'}>
                <SelectTrigger
                  className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">{DIVISIONS.map(d => <SelectItem
                  key={d} value={d}>{d === 'TSB' ? 'Field Staff' : d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={formData.division === 'TSB' ? 'opacity-50' : ''}>Alosztály Rang</Label>
              <Select value={formData.division_rank || "none"} onValueChange={(val) => setFormData({
                ...formData,
                division_rank: val === "none" ? null : val as any
              })} disabled={formData.division === 'TSB' || (isTargetProtected && viewerRank !== 'admin')}>
                <SelectTrigger className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue
                  placeholder="Nincs"/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white"><SelectItem
                  value="none">Nincs</SelectItem>{formData.division === 'MCB' && INVESTIGATOR_RANKS.map(r => <SelectItem
                  key={r} value={r}>{r}</SelectItem>)}{formData.division === 'SEB' && OPERATOR_RANKS.map(r =>
                  <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {viewerRank === 'admin' && (
            <div className="p-4 border border-yellow-600/30 rounded-lg bg-yellow-950/10 space-y-4">
              <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2"><Crown
                className="w-3 h-3"/> Vezetői Kinevezések</h4>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5"><Label className="text-base font-medium text-slate-200 cursor-pointer"
                                                    onClick={() => setFormData({
                                                      ...formData,
                                                      is_bureau_manager: !formData.is_bureau_manager
                                                    })}>Bureau Manager</Label><p
                  className="text-xs text-slate-400">Minden osztály és divízió felügyelete.</p></div>
                <Switch checked={formData.is_bureau_manager}
                        onCheckedChange={(checked) => setFormData({...formData, is_bureau_manager: checked})}/>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="space-y-0.5"><Label className="text-base font-medium text-slate-200 cursor-pointer"
                                                    onClick={() => setFormData({
                                                      ...formData,
                                                      is_bureau_commander: !formData.is_bureau_commander
                                                    })}>Bureau Commander</Label><p className="text-xs text-slate-400">A
                  jelenlegi osztály ({formData.division}) parancsnoka.</p></div>
                <Switch checked={formData.is_bureau_commander}
                        onCheckedChange={(checked) => setFormData({...formData, is_bureau_commander: checked})}/>
              </div>
              <div className="border-t border-white/5 pt-3 space-y-2">
                <Label className="text-base font-medium text-slate-200">Division Commander</Label>
                <p className="text-xs text-slate-400">Jelöld be, melyik kvalifikációkért felel.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUALIFICATIONS.map(q => (
                    <Badge key={q} variant={formData.commanded_divisions?.includes(q) ? "default" : "outline"}
                           className={cn("cursor-pointer select-none border-yellow-600/50 transition-all active:scale-95", formData.commanded_divisions?.includes(q) ? "bg-yellow-600 text-black hover:bg-yellow-700" : "text-yellow-500 hover:bg-yellow-900/20")}
                           onClick={() => toggleCommandedDivision(q)}>{q}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Képesítések</Label>
            <div
              className={`flex flex-wrap gap-2 p-3 bg-slate-950 border border-slate-700 rounded-lg ${(isTargetProtected && viewerRank !== 'admin') ? 'opacity-50 pointer-events-none' : ''}`}>
              {QUALIFICATIONS.map(q => (
                <Badge key={q} variant={formData.qualifications?.includes(q) ? "default" : "outline"}
                       className="cursor-pointer select-none hover:bg-yellow-700"
                       onClick={() => toggleQual(q)}>{q}</Badge>))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between gap-2">
          <Button type="button" variant="destructive" onClick={onKickRequest}
                  disabled={loading || (isTargetProtected && viewerRank !== 'admin')}><Trash2
            className="w-4 h-4 mr-2"/> Elbocsátás</Button>
          <Button onClick={handleSave} disabled={loading || (isTargetProtected && viewerRank !== 'admin')}
                  className="bg-yellow-600 text-black hover:bg-yellow-700"><CheckCircle2
            className="w-4 h-4 mr-2"/> Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- LISTA KOMPONENS ---
function StaffSection({title, icon: Icon, users, colorClass, onEdit}: any) {
  if (users.length === 0) return null;

  return (
    <Card className={`bg-slate-900 border border-slate-800 shadow-lg overflow-hidden mb-6 ${colorClass}`}>
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
        <h3 className="text-lg font-bold text-white flex items-center gap-3"><Icon
          className="w-5 h-5 opacity-80"/> {title}</h3>
        <Badge variant="secondary" className="bg-black/30 text-white/80">{users.length} fő</Badge>
      </div>
      <div className="p-0">
        <Table>
          <TableHeader className="bg-black/20">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-[100px] text-slate-400 font-semibold pl-4">Jelvény</TableHead>
              <TableHead className="w-[220px] text-slate-400 font-semibold">Név</TableHead>
              <TableHead className="w-[180px] text-slate-400 font-semibold">Rendfokozat</TableHead>
              <TableHead className="w-[150px] text-slate-400 font-semibold text-center">Szolgálati idő</TableHead>
              <TableHead className="w-[200px] text-slate-400 font-semibold">Osztály</TableHead>
              <TableHead className="text-slate-400 font-semibold">Kvalifikációk</TableHead>
              <TableHead className="w-[60px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => {
              const daysInRank = user.last_promotion_date ? differenceInDays(new Date(), new Date(user.last_promotion_date)) : differenceInDays(new Date(), new Date(user.created_at));

              return (
                <TableRow key={user.id} className="border-white/5 hover:bg-white/5 group transition-colors">
                  <TableCell
                    className="font-mono font-bold text-white/70 group-hover:text-white pl-4">#{user.badge_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{user.full_name}</span>

                      {/* VEZETŐI IKONOK TOOLTIP-PEL */}
                      <TooltipProvider>
                        {user.is_bureau_manager && (
                          <Tooltip><TooltipTrigger><Crown
                            className="w-4 h-4 text-yellow-500 fill-yellow-500/20"/></TooltipTrigger><TooltipContent>Bureau
                            Manager</TooltipContent></Tooltip>
                        )}
                        {user.is_bureau_commander && (
                          <Tooltip><TooltipTrigger><Award
                            className="w-4 h-4 text-blue-400 fill-blue-400/20"/></TooltipTrigger><TooltipContent>Bureau
                            Commander ({user.division})</TooltipContent></Tooltip>
                        )}
                        {(user.commanded_divisions || []).length > 0 && (
                          <Tooltip><TooltipTrigger><ShieldCheck
                            className="w-4 h-4 text-purple-400"/></TooltipTrigger><TooltipContent>Div. Commander
                            ({user.commanded_divisions.join(', ')})</TooltipContent></Tooltip>
                        )}
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{user.faction_rank}</TableCell>
                  <TableCell className="text-center">
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400"
                      title="Napok száma a jelenlegi rangon">
                      <CalendarClock className="w-3 h-3 text-yellow-600"/><span>{daysInRank} nap</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary"
                           className={cn("border border-white/10", user.division === 'MCB' ? 'bg-blue-900/20 text-blue-300' : user.division === 'SEB' ? 'bg-red-900/20 text-red-300' : 'bg-slate-800 text-slate-400')}>
                      {user.division === 'TSB' ? 'Field Staff' : user.division}
                      {user.division_rank && ` • ${user.division_rank.split(' ')[0]}`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(user.qualifications || []).map((q: any) => (<span key={q}
                                                                          className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">{q}</span>))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-yellow-500"
                            onClick={() => onEdit(user)}><UserCog className="w-4 h-4"/></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// --- FŐ OLDAL ---
export function HrPage() {
  const {supabase, profile, session} = useAuth();
  const {recruitmentOpen, toggleRecruitment} = useSystemStatus();
  const [users, setUsers] = React.useState<Profile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [editingUser, setEditingUser] = React.useState<Profile | null>(null);

  // Confirm Dialog State
  const [isKickAlertOpen, setIsKickAlertOpen] = React.useState(false);
  const [userToKick, setUserToKick] = React.useState<Profile | null>(null);

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    const {data, error} = await supabase.from('profiles').select('*');
    if (error) toast.error("Hiba az adatok betöltésekor");
    else {
      const sorted = (data || []).sort((a, b) => {
        const rankA = FACTION_RANKS.indexOf(a.faction_rank);
        const rankB = FACTION_RANKS.indexOf(b.faction_rank);
        if (rankA !== rankB) return rankA - rankB;
        return parseInt(a.badge_number) - parseInt(b.badge_number);
      });
      setUsers(sorted);
    }
    setIsLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Pending Action (Elfogadás/Elutasítás)
  const handlePendingAction = async (userId: string, action: 'approve' | 'reject') => {
    try {
      const endpoint = action === 'approve' ? '/api/admin/update-role' : '/api/admin/delete-user';
      // JAVÍTÁS: Nem küldünk system_role-t, a backend kiszámolja a rangból
      const body = action === 'approve' ? {userId} : {userId};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`},
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      toast.success(action === 'approve' ? "Jóváhagyva!" : "Elutasítva.");
      fetchUsers();
    } catch {
      toast.error("Hiba történt.");
    }
  };

  // Végleges kirúgás (Confirm után)
  const confirmKick = async () => {
    if (!userToKick) return;
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`},
        body: JSON.stringify({userId: userToKick.id}),
      });
      if (!response.ok) throw new Error();
      toast.warning(`${userToKick.full_name} elbocsátva.`);
      fetchUsers();
      setEditingUser(null);
    } catch {
      toast.error("Hiba az elbocsátás során.");
    } finally {
      setIsKickAlertOpen(false);
      setUserToKick(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.system_role !== 'pending' &&
    (u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.badge_number.includes(searchTerm))
  );

  const highCommandUsers = filteredUsers.filter(u => HIGH_COMMAND_RANKS.includes(u.faction_rank));
  const supervisoryUsers = filteredUsers.filter(u => SUPERVISORY_RANKS.includes(u.faction_rank));
  const fieldUsers = filteredUsers.filter(u => !HIGH_COMMAND_RANKS.includes(u.faction_rank) && !SUPERVISORY_RANKS.includes(u.faction_rank));
  const pendingUsers = users.filter(u => u.system_role === 'pending');

  const viewerRank = profile?.system_role === 'admin' ? 'admin' : 'supervisor';

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">

      <AlertDialog open={isKickAlertOpen} onOpenChange={setIsKickAlertOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Végleges Elbocsátás</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Biztosan el akarod bocsátani <span className="text-white font-bold">{userToKick?.full_name}</span> nevű
              tagot?
              Ez a művelet végleges, a felhasználó fiókja és minden adata törlődik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-none" onClick={confirmKick}>
              Elbocsátás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(o) => !o && setEditingUser(null)}
        onUpdate={fetchUsers}
        viewerRank={viewerRank}
        onKickRequest={() => {
          setUserToKick(editingUser);
          setIsKickAlertOpen(true);
        }}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Személyügy (HR)</h1>
          <p className="text-slate-400">Teljes állomány nyilvántartás és kezelés.</p>
        </div>
        <div className="flex items-center gap-4">
          {viewerRank === 'admin' && (
            <div className="flex items-center gap-3 bg-slate-900 p-2 px-4 rounded-full border border-slate-800">
               <span className={`text-xs font-bold uppercase ${recruitmentOpen ? 'text-green-500' : 'text-red-500'}`}>
                 {recruitmentOpen ? 'TGF Nyitva' : 'Létszámstop'}
               </span>
              <Button size="sm" variant={recruitmentOpen ? "default" : "destructive"} className="h-6 text-xs"
                      onClick={toggleRecruitment}>
                {recruitmentOpen ? 'Lezárás' : 'Megnyitás'}
              </Button>
            </div>
          )}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <Input placeholder="Keresés név vagy jelvény..."
                   className="pl-9 bg-slate-900 border-slate-700 focus-visible:ring-yellow-600/50" value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* PENDING USERS */}
      {pendingUsers.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-600/30 rounded-xl p-6 animate-pulse-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500"><UserPlus className="w-6 h-6"/></div>
            <div><h3 className="text-lg font-bold text-yellow-500">Jóváhagyásra Vár ({pendingUsers.length})</h3><p
              className="text-xs text-yellow-200/60">Új regisztrációk.</p></div>
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {pendingUsers.map(u => (
              <div key={u.id}
                   className="bg-slate-950 p-3 rounded border border-yellow-900/50 flex justify-between items-center">
                <div><p className="font-bold text-white">{u.full_name}</p><p
                  className="text-xs text-slate-400">{u.faction_rank} [#{u.badge_number}]</p></div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-green-900/50 text-green-500"
                          onClick={() => handlePendingAction(u.id, 'approve')}><CheckCircle2
                    className="w-5 h-5"/></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-900/50 text-red-500"
                          onClick={() => handlePendingAction(u.id, 'reject')}><Trash2 className="w-4 h-4"/></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2
          className="w-10 h-10 animate-spin mb-3 text-yellow-600"/><p>Állomány betöltése...</p></div>
      ) : (
        <>
          <StaffSection title="Vezérkar (High Command)" icon={Crown} users={highCommandUsers}
                        colorClass="border-yellow-600/40 shadow-yellow-900/10" onEdit={setEditingUser}
                        viewerRank={viewerRank}/>
          <StaffSection title="Vezetőség (Supervisory Staff)" icon={Star} users={supervisoryUsers}
                        colorClass="border-green-600/30 shadow-green-900/5" onEdit={setEditingUser}
                        viewerRank={viewerRank}/>
          <StaffSection title="Állomány (Field Staff)" icon={Users} users={fieldUsers} colorClass="border-slate-800"
                        onEdit={setEditingUser} viewerRank={viewerRank}/>
        </>
      )}
    </div>
  );
}