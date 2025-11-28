import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {useSystemStatus} from "@/context/SystemStatusContext";
import {Card} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
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
  CheckCircle2, Loader2, Trash2, Search, Crown, Star, Users,
  CalendarClock, Award, ShieldCheck, Medal, PenTool, ShieldAlert
} from "lucide-react";
import {
  FACTION_RANKS, type Profile, type DepartmentDivision, type Qualification,
  type InvestigatorRank, type OperatorRank
} from "@/types/supabase";
import {
  cn, canEditUser, getAllowedPromotionRanks, canAwardRibbon,
  isExecutive
} from "@/lib/utils";
import {differenceInDays} from "date-fns";
import {GiveAwardDialog} from "@/pages/profile/components/GiveAwardDialog";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";

// --- KONFIGURÁCIÓ ---
const DIVISIONS: DepartmentDivision[] = ['TSB', 'SEB', 'MCB'];
const QUALIFICATIONS: Qualification[] = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB'];
const INVESTIGATOR_RANKS: InvestigatorRank[] = ['Investigator III.', 'Investigator II.', 'Investigator I.'];
const OPERATOR_RANKS: OperatorRank[] = ['Operator III.', 'Operator II.', 'Operator I.'];

const EXECUTIVE_RANKS = ['Commander', 'Deputy Commander'];
const COMMAND_RANKS = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_RANKS = ['Sergeant II.', 'Sergeant I.'];
const HIGH_COMMAND_RANKS = [...EXECUTIVE_RANKS, ...COMMAND_RANKS];

// --- SEGÉDFÜGGVÉNYEK ---
const getDivisionStyleAndLabel = (division: string, rank: string) => {
  if (division !== 'TSB') {
    return {
      label: division,
      className: division === 'MCB' ? 'bg-blue-900/20 text-blue-300 border-blue-700/50' :
        division === 'SEB' ? 'bg-red-900/20 text-red-300 border-red-700/50' :
          'bg-slate-800 text-slate-400'
    };
  }
  if (EXECUTIVE_RANKS.includes(rank)) return {
    label: 'Executive Staff',
    className: 'bg-red-900/20 text-red-300 border-red-700/50'
  };
  if (COMMAND_RANKS.includes(rank)) return {
    label: 'Command Staff',
    className: 'bg-yellow-900/20 text-yellow-300 border-yellow-700/50'
  };
  if (SUPERVISORY_RANKS.includes(rank)) return {
    label: 'Supervisory Staff',
    className: 'bg-green-900/20 text-green-300 border-green-700/50'
  };
  return {label: 'Field Staff', className: 'bg-slate-800 text-slate-400 border-slate-700'};
};

// --- EDIT DIALOG ---
function EditUserDialog({user, open, onOpenChange, onUpdate, currentUser, onKickRequest}: {
  user: Profile | null,
  open: boolean,
  onOpenChange: (o: boolean) => void,
  onUpdate: () => void,
  currentUser: Profile | null,
  onKickRequest: () => void
}) {
  const {supabase} = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Profile>>({});

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        full_name: user.full_name,
        badge_number: user.badge_number,
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

  // JOGOSULTSÁG ELLENŐRZŐ (MEZŐNKÉNT)
  const isFieldDisabled = (field: 'rank' | 'division' | 'div_rank' | 'qual' | 'manager') => {
    if (!currentUser || !user) return true;
    if (currentUser.is_bureau_manager) return false; // Manager mindent írhat

    switch (field) {
      case 'rank': // Név, Jelvény, Főrang
        if (isExecutive(currentUser) && currentUser.id === user.id) return false;
        return !canEditUser(currentUser, user);

      case 'division': // Osztály váltása
        if (currentUser.is_bureau_commander) return false;
        return true;

      case 'div_rank': // Osztályrang
        if (currentUser.is_bureau_commander) return false;
        return true;

      case 'qual': // Képesítések
        if (currentUser.is_bureau_commander) return false;
        if (currentUser.commanded_divisions && currentUser.commanded_divisions.length > 0) return false;
        return true;

      case 'manager':
        return !currentUser.is_bureau_manager;

      default:
        return true;
    }
  };

  const allowedRanks = currentUser ? getAllowedPromotionRanks(currentUser) : [];

  const handleSave = async () => {
    if (!user || !currentUser) return;
    setLoading(true);
    try {
      const {error: rpcError} = await supabase.rpc('hr_update_user_profile_v2', {
        _target_user_id: user.id,
        _full_name: formData.full_name,
        _badge_number: formData.badge_number,
        _faction_rank: formData.faction_rank,
        _division: formData.division,
        _division_rank: formData.division_rank,
        _qualifications: formData.qualifications
      });

      if (rpcError) throw rpcError;

      if (currentUser.is_bureau_manager) {
        const updates: any = {};
        if (formData.is_bureau_manager !== user.is_bureau_manager) updates.is_bureau_manager = formData.is_bureau_manager;
        if (formData.is_bureau_commander !== user.is_bureau_commander) updates.is_bureau_commander = formData.is_bureau_commander;
        if (JSON.stringify(formData.commanded_divisions) !== JSON.stringify(user.commanded_divisions)) updates.commanded_divisions = formData.commanded_divisions;

        if (Object.keys(updates).length > 0) {
          const {error: updateError} = await supabase.from('profiles').update(updates).eq('id', user.id);
          if (updateError) throw updateError;
        }
      }

      toast.success("Felhasználó frissítve!");
      onUpdate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Hiba a mentés során: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleQual = (q: Qualification) => {
    let canToggle = false;
    if (currentUser?.is_bureau_manager) canToggle = true;
    else if (currentUser?.is_bureau_commander) canToggle = true;
    else if (currentUser?.commanded_divisions?.includes(q)) canToggle = true;

    if (!canToggle) return;

    const current = formData.qualifications || [];
    setFormData({...formData, qualifications: current.includes(q) ? current.filter(x => x !== q) : [...current, q]});
  };

  const toggleCommandedDivision = (q: Qualification) => {
    // Ezt csak Manager vagy Bureau Commander nyomkodhatja
    if (!(currentUser?.is_bureau_manager || currentUser?.is_bureau_commander)) return;

    const currentCmd = formData.commanded_divisions || [];
    const currentQuals = formData.qualifications || [];

    if (currentCmd.includes(q)) {
      setFormData({...formData, commanded_divisions: currentCmd.filter(x => x !== q)});
    } else {
      // JAVÍTÁS: Ha kinevezzük parancsnoknak, adjuk hozzá a képesítést is!
      const newQuals = currentQuals.includes(q) ? currentQuals : [...currentQuals, q];
      setFormData({
        ...formData,
        commanded_divisions: [...currentCmd, q],
        qualifications: newQuals
      });
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Adatlap Kezelése</DialogTitle>
          <DialogDescription>Módosítások végrehajtása.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. SZEMÉLYES ADATOK */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teljes Név</Label>
              <Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                     className="bg-slate-950 border-slate-700 disabled:opacity-50" disabled={isFieldDisabled('rank')}/>
            </div>
            <div className="space-y-2">
              <Label>Jelvényszám</Label>
              <Input value={formData.badge_number}
                     onChange={e => setFormData({...formData, badge_number: e.target.value})}
                     className="bg-slate-950 border-slate-700 disabled:opacity-50" disabled={isFieldDisabled('rank')}/>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Frakció Rang</Label>
            <Select value={formData.faction_rank}
                    onValueChange={(val: any) => setFormData({...formData, faction_rank: val})}
                    disabled={isFieldDisabled('rank')}>
              <SelectTrigger
                className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue/></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                {allowedRanks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-500">Csak a jogosultságodnak megfelelő rangok láthatóak.</p>
          </div>

          {/* 2. OSZTÁLY & ALOSZTÁLY RANG */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Osztály</Label>
              <Select value={formData.division} onValueChange={(val: any) => setFormData({
                ...formData,
                division: val,
                division_rank: val === 'TSB' ? null : formData.division_rank,
                is_bureau_commander: val === 'TSB' ? false : formData.is_bureau_commander
              })} disabled={isFieldDisabled('division')}>
                <SelectTrigger
                  className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className={formData.division === 'TSB' ? 'opacity-50' : ''}>Alosztály Rang</Label>
              <Select value={formData.division_rank || "none"} onValueChange={(val) => setFormData({
                ...formData,
                division_rank: val === "none" ? null : val as any
              })} disabled={formData.division === 'TSB' || isFieldDisabled('div_rank')}>
                <SelectTrigger className="bg-slate-950 border-slate-700 disabled:opacity-50"><SelectValue
                  placeholder="Nincs"/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="none">Nincs</SelectItem>
                  {formData.division === 'MCB' && INVESTIGATOR_RANKS.map(r => <SelectItem key={r}
                                                                                          value={r}>{r}</SelectItem>)}
                  {formData.division === 'SEB' && OPERATOR_RANKS.map(r => <SelectItem key={r}
                                                                                      value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 3. KÉPESÍTÉSEK */}
          <div className="space-y-2">
            <Label>Képesítések</Label>
            <div
              className={`flex flex-wrap gap-2 p-3 bg-slate-950 border border-slate-700 rounded-lg ${isFieldDisabled('qual') ? 'opacity-50 pointer-events-none' : ''}`}>
              {QUALIFICATIONS.map(q => {
                const isSelected = formData.qualifications?.includes(q);

                // Külön ellenőrzés a stílushoz (hogy lássa, melyikre nyomhat)
                const canToggle = currentUser?.is_bureau_manager ||
                  currentUser?.is_bureau_commander ||
                  currentUser?.commanded_divisions?.includes(q);

                return (
                  <Badge key={q} variant={isSelected ? "default" : "outline"}
                         className={cn("select-none", canToggle ? "cursor-pointer hover:bg-yellow-700" : "opacity-50 cursor-not-allowed")}
                         onClick={() => toggleQual(q)}>{q}</Badge>
                );
              })}
            </div>
          </div>

          {/* 4. VEZETŐI ZÓNA (Manager / Bureau Commander) */}
          {!isFieldDisabled('manager') && (
            <div
              className="p-4 border border-yellow-600/30 rounded-lg bg-yellow-950/10 space-y-4 animate-in slide-in-from-bottom-2">
              <h4 className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2"><Crown
                className="w-3 h-3"/> Vezetői Kinevezések</h4>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-slate-200 cursor-pointer"
                         onClick={() => setFormData({...formData, is_bureau_manager: !formData.is_bureau_manager})}>Bureau
                    Manager</Label>
                  <p className="text-xs text-slate-400">Minden osztály és divízió felügyelete.</p>
                </div>
                <Switch checked={formData.is_bureau_manager}
                        onCheckedChange={(checked) => setFormData({...formData, is_bureau_manager: checked})}
                        disabled={!currentUser?.is_bureau_manager} // Csak Manager adhat Managert
                />
              </div>

              <div
                className={`flex items-center justify-between border-t border-white/5 pt-3 ${formData.division === 'TSB' ? 'opacity-50 grayscale' : ''}`}>
                <div className="space-y-0.5">
                  <Label className="text-base font-medium text-slate-200 cursor-pointer"
                         onClick={() => formData.division !== 'TSB' && setFormData({
                           ...formData,
                           is_bureau_commander: !formData.is_bureau_commander
                         })}>Bureau Commander</Label>
                  <p className="text-xs text-slate-400">A jelenlegi osztály ({formData.division}) parancsnoka.</p>
                </div>
                <Switch
                  checked={formData.is_bureau_commander}
                  onCheckedChange={(checked) => setFormData({...formData, is_bureau_commander: checked})}
                  disabled={formData.division === 'TSB' || !currentUser?.is_bureau_manager} // Csak Manager adhat Commandert
                />
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
        </div>
        <DialogFooter className="flex justify-between gap-2">
          {/* ELBOCSÁTÁS GOMB: Ranghoz kötött, vagy ha Bureau Commander a saját osztályában */}
          <Button type="button" variant="destructive" onClick={onKickRequest}
                  disabled={loading || (isFieldDisabled('rank') && !(currentUser?.is_bureau_commander && currentUser?.division === user.division))}
          >
            <Trash2 className="w-4 h-4 mr-2"/> Elbocsátás
          </Button>
          <div className="w-full flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} variant="outline">Mégse</Button>
            <Button onClick={handleSave} disabled={loading}
                    className="bg-yellow-600 text-black hover:bg-yellow-700"><CheckCircle2
              className="w-4 h-4 mr-2"/> Mentés</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- LISTA KOMPONENS ---
function StaffSection({title, icon: Icon, users, colorClass, onEdit, currentUser, onGiveAward}: any) {
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
              <TableHead className="w-[100px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => {
              const daysInRank = user.last_promotion_date ? differenceInDays(new Date(), new Date(user.last_promotion_date)) : differenceInDays(new Date(), new Date(user.created_at));
              const badgeInfo = getDivisionStyleAndLabel(user.division, user.faction_rank);

              // GOMBOK LÁTHATÓSÁGA
              const isMe = currentUser?.id === user.id;
              let showEdit = false;

              if (currentUser) {
                // 1. Manager mindent lát
                if (currentUser.is_bureau_manager) showEdit = true;

                // 2. Executive Staff saját magát (és másokat)
                else if (isExecutive(currentUser)) showEdit = true;

                // 3. Bureau Commander bárkit
                else if (currentUser.is_bureau_commander) showEdit = true;

                // 4. Division Commander bárkit (hogy tudjon qualt adni)
                else if (currentUser.commanded_divisions?.length > 0) showEdit = true;

                // 5. Alap rang jog
                else if (!isMe && canEditUser(currentUser, user)) showEdit = true;
              }

              const canAward = currentUser && canAwardRibbon(currentUser) && !isMe;

              return (
                <TableRow key={user.id} className="border-white/5 hover:bg-white/5 group transition-colors">
                  <TableCell
                    className="font-mono font-bold text-white/70 group-hover:text-white pl-4">#{user.badge_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 border border-slate-700">
                        <AvatarImage src={user.avatar_url}/>
                        <AvatarFallback
                          className="bg-slate-950 text-slate-400 font-bold text-xs">{user.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-white">{user.full_name}</span>
                      <TooltipProvider>
                        {user.is_bureau_manager && <Tooltip><TooltipTrigger><Crown
                          className="w-3.5 h-3.5 text-purple-400"/></TooltipTrigger><TooltipContent>Bureau
                          Manager</TooltipContent></Tooltip>}
                        {user.is_bureau_commander && <Tooltip><TooltipTrigger><Award
                          className="w-3.5 h-3.5 text-blue-400"/></TooltipTrigger><TooltipContent>Bureau
                          Commander</TooltipContent></Tooltip>}
                        {(user.commanded_divisions || []).length > 0 && <Tooltip><TooltipTrigger><ShieldCheck
                          className="w-3.5 h-3.5 text-yellow-500"/></TooltipTrigger><TooltipContent>Division
                          Commander</TooltipContent></Tooltip>}
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{user.faction_rank}</TableCell>
                  <TableCell className="text-center">
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
                      <CalendarClock className="w-3 h-3 text-yellow-600"/><span>{daysInRank} nap</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary"
                                 className={cn("border border-white/10 cursor-help", badgeInfo.className)}>
                            {badgeInfo.label}
                          </Badge>
                        </TooltipTrigger>
                        {user.division_rank && <TooltipContent><p>Rang: {user.division_rank}</p></TooltipContent>}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(user.qualifications || []).map((q: any) => (<span key={q}
                                                                          className="text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">{q}</span>))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canAward && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-500 hover:bg-yellow-900/20"
                                onClick={() => onGiveAward(user)} title="Kitüntetés">
                          <Medal className="w-4 h-4"/>
                        </Button>
                      )}
                      {showEdit && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:bg-blue-900/20"
                                onClick={() => onEdit(user)} title="Szerkesztés">
                          <PenTool className="w-4 h-4"/>
                        </Button>
                      )}
                    </div>
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

  // Kitüntetés
  const [awardTarget, setAwardTarget] = React.useState<{ id: string, name: string } | null>(null);

  // Kick
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

  const handlePendingAction = async (userId: string, action: 'approve' | 'reject') => {
    try {
      const endpoint = action === 'approve' ? '/api/admin/update-role' : '/api/admin/delete-user';
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

  const canManageRecruitment = profile?.system_role === 'admin';
  const canManagePending = profile?.system_role === 'admin' || profile?.system_role === 'supervisor';

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
        currentUser={profile}
        onKickRequest={() => {
          setUserToKick(editingUser);
          setIsKickAlertOpen(true);
        }}
      />

      {awardTarget && <GiveAwardDialog open={!!awardTarget} onOpenChange={(o) => !o && setAwardTarget(null)}
                                       targetUserId={awardTarget.id} targetUserName={awardTarget.name}
                                       onSuccess={() => {
                                       }}/>}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Személyügy (HR)</h1>
          <p className="text-slate-400">Teljes állomány nyilvántartás és kezelés.</p>
        </div>
        <div className="flex items-center gap-4">
          {canManageRecruitment && (
            <div className="flex items-center gap-3 bg-slate-900 p-2 px-4 rounded-full border border-slate-800">
              <span
                className={`text-xs font-bold uppercase ${recruitmentOpen ? 'text-green-500' : 'text-red-500'}`}>{recruitmentOpen ? 'TGF Nyitva' : 'Létszámstop'}</span>
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

      {canManagePending && pendingUsers.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-600/30 rounded-xl p-6 animate-pulse-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-600/20 rounded-lg text-yellow-500"><ShieldAlert className="w-6 h-6"/></div>
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
          <StaffSection
            title="Vezérkar (Executive / Command Staff)"
            icon={Crown}
            users={highCommandUsers}
            colorClass="border-yellow-600/40 shadow-yellow-900/10"
            onEdit={setEditingUser}
            currentUser={profile}
            onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}
          />
          <StaffSection
            title="Vezetőség (Supervisory Staff)"
            icon={Star}
            users={supervisoryUsers}
            colorClass="border-green-600/30 shadow-green-900/5"
            onEdit={setEditingUser}
            currentUser={profile}
            onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}
          />
          <StaffSection
            title="Állomány (Field Staff)"
            icon={Users}
            users={fieldUsers}
            colorClass="border-slate-800"
            onEdit={setEditingUser}
            currentUser={profile}
            onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}
          />
        </>
      )}
    </div>
  );
}