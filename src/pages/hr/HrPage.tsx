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
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {toast} from "sonner";
import {
  CheckCircle2, Loader2, Trash2, Search, Crown, Star, Users,
  CalendarClock, Award, ShieldCheck, Medal, PenTool, ShieldAlert, UserCog, Briefcase, Lock, Check, X, Power, UserPlus
} from "lucide-react";
import {
  FACTION_RANKS, type Profile, type DepartmentDivision, type Qualification,
  type InvestigatorRank, type OperatorRank
} from "@/types/supabase";
import {
  cn, canEditUser, getAllowedPromotionRanks, canAwardRibbon,
  isExecutive, isSupervisory, isCommand
} from "@/lib/utils";
import {differenceInDays} from "date-fns";
import {GiveAwardDialog} from "@/pages/profile/components/GiveAwardDialog";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";

// --- KONFIGURÁCIÓ (Eredeti) ---
const DIVISIONS: DepartmentDivision[] = ['TSB', 'SEB', 'MCB'];
const QUALIFICATIONS: Qualification[] = ['SAHP', 'AB', 'MU', 'GW', 'FAB', 'SIB', 'TB'];
const INVESTIGATOR_RANKS: InvestigatorRank[] = ['Investigator III.', 'Investigator II.', 'Investigator I.'];
const OPERATOR_RANKS: OperatorRank[] = ['Operator III.', 'Operator II.', 'Operator I.'];

const EXECUTIVE_RANKS = ['Commander', 'Deputy Commander'];
const COMMAND_RANKS = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_RANKS = ['Sergeant II.', 'Sergeant I.'];
const HIGH_COMMAND_RANKS = [...EXECUTIVE_RANKS, ...COMMAND_RANKS];

// --- SEGÉDKOMPONENS: TOGGLE CARD ---
// Jól látható, nagy gomb a beállításokhoz
const ToggleCard = ({title, description, active, onChange, colorClass, icon: Icon, disabled}: any) => (
  <div
    onClick={() => !disabled && onChange(!active)}
    className={cn(
      "flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer select-none group",
      disabled ? "opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/50" :
        active
          ? cn("bg-slate-900/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]", colorClass) // Aktív
          : "bg-slate-950 border-slate-700 hover:border-slate-500 hover:bg-slate-900" // Inaktív (de jól látható)
    )}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn("p-2 rounded-md transition-colors", active ? "bg-white/10 text-white" : "bg-slate-900 text-slate-500 group-hover:text-slate-300")}>
        <Icon className="w-5 h-5"/>
      </div>
      <div>
        <div
          className={cn("text-sm font-bold uppercase tracking-wide transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")}>{title}</div>
        <div className="text-[10px] text-slate-500">{description}</div>
      </div>
    </div>
    <div
      className={cn("px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
        active ? "bg-white text-black" : "bg-slate-800 text-slate-500")}>
      {active ? <><Check className="w-3 h-3"/> AKTÍV</> : <><X className="w-3 h-3"/> INAKTÍV</>}
    </div>
  </div>
);

// --- EDIT DIALOG ---
function EditUserDialog({user, open, onOpenChange, onUpdate, currentUser, onKickRequest}: {
  user: Profile | null,
  open: boolean,
  onOpenChange: (o: boolean) => void,
  onUpdate: () => void,
  currentUser: Profile | null,
  onKickRequest: () => void
}) {
  const {supabase, session} = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Profile>>({});

  React.useEffect(() => {
    if (user && open) {
      setFormData({
        full_name: user.full_name, badge_number: user.badge_number, faction_rank: user.faction_rank,
        division: user.division, division_rank: user.division_rank, qualifications: user.qualifications || [],
        is_bureau_manager: user.is_bureau_manager || false, is_bureau_commander: user.is_bureau_commander || false,
        commanded_divisions: user.commanded_divisions || []
      });
    }
  }, [user, open]);

  // --- EREDETI LOGIKA VISSZAÁLLÍTVA ---
  const isFieldDisabled = (field: 'rank' | 'division' | 'div_rank' | 'qual' | 'manager') => {
    if (!currentUser || !user) return true;
    if (currentUser.is_bureau_manager) return false;

    const hasStaffRights = (isSupervisory(currentUser) || isCommand(currentUser) || isExecutive(currentUser)) && canEditUser(currentUser, user);

    switch (field) {
      case 'rank':
        return (isExecutive(currentUser) && currentUser.id === user.id) ? false : !canEditUser(currentUser, user);
      case 'division':
        if (user.is_bureau_commander && !currentUser.is_bureau_manager) return true;
        if (currentUser.is_bureau_commander && (user.division === currentUser.division || user.division === 'TSB')) return false;
        return !hasStaffRights;
      case 'div_rank':
        return !(currentUser.is_bureau_commander && user.division === currentUser.division) && !hasStaffRights;
      case 'qual':
        if (currentUser.is_bureau_commander && user.division === currentUser.division) return false;
        if (currentUser.commanded_divisions && currentUser.commanded_divisions.length > 0) return false;
        return !hasStaffRights;
      case 'manager':
        return !currentUser.is_bureau_manager;
      default:
        return true;
    }
  };

  const allowedRanks = currentUser ? getAllowedPromotionRanks(currentUser) : [];
  const allowedDivisions = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.is_bureau_manager || isSupervisory(currentUser) || isCommand(currentUser) || isExecutive(currentUser)) return DIVISIONS;
    if (currentUser.is_bureau_commander) return DIVISIONS.filter(d => d === 'TSB' || d === currentUser.division);
    return [];
  }, [currentUser]);

  const handleSave = async () => {
    if (!user || !currentUser) return;
    setLoading(true);
    try {
      const {error: rpcError} = await supabase.rpc('hr_update_user_profile_v2', {
        _target_user_id: user.id, _full_name: formData.full_name, _badge_number: formData.badge_number,
        _faction_rank: formData.faction_rank, _division: formData.division, _division_rank: formData.division_rank,
        _qualifications: formData.qualifications
      });
      if (rpcError) throw rpcError;

      if (!isFieldDisabled('manager')) {
        const updates: any = {};
        if (formData.is_bureau_manager !== user.is_bureau_manager) updates.is_bureau_manager = formData.is_bureau_manager;
        if (formData.is_bureau_commander !== user.is_bureau_commander) updates.is_bureau_commander = formData.is_bureau_commander;

        const oldCmd = JSON.stringify(user.commanded_divisions?.sort() || []);
        const newCmd = JSON.stringify(formData.commanded_divisions?.sort() || []);
        if (oldCmd !== newCmd) updates.commanded_divisions = formData.commanded_divisions;

        if (Object.keys(updates).length > 0) {
          const response = await fetch('/api/admin/update-role', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`},
            body: JSON.stringify({userId: user.id, ...updates})
          });
          if (!response.ok) throw new Error("Hiba a vezetői jogkörök mentésekor");
        }
      }
      toast.success("Sikeres mentés!");
      onUpdate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Hiba: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleQual = (q: Qualification) => {
    if (!currentUser || !user) return;
    let canToggle = false;
    if (currentUser.is_bureau_manager) canToggle = true;
    else if (currentUser.is_bureau_commander && user.division === currentUser.division) canToggle = true;
    else if (currentUser.commanded_divisions?.includes(q)) canToggle = true;
    else if ((isSupervisory(currentUser) || isCommand(currentUser) || isExecutive(currentUser)) && canEditUser(currentUser, user)) canToggle = true;

    if (user.commanded_divisions?.includes(q) && !currentUser.is_bureau_manager) canToggle = false;
    if (!canToggle) return;

    const current = formData.qualifications || [];
    setFormData({...formData, qualifications: current.includes(q) ? current.filter(x => x !== q) : [...current, q]});
  };

  const toggleCommandedDivision = (q: Qualification) => {
    if (isFieldDisabled('manager')) return;
    const currentCmd = formData.commanded_divisions || [];
    const currentQuals = formData.qualifications || [];
    if (currentCmd.includes(q)) {
      setFormData({...formData, commanded_divisions: currentCmd.filter(x => x !== q)});
    } else {
      const newQuals = currentQuals.includes(q) ? currentQuals : [...currentQuals, q];
      setFormData({...formData, commanded_divisions: [...currentCmd, q], qualifications: newQuals});
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0b1221] border border-blue-900/50 text-white sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-[0_0_60px_rgba(30,58,138,0.3)]">

        {/* Header */}
        <div className="bg-blue-950/40 border-b border-blue-900/30 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
              <UserCog className="w-6 h-6 text-blue-400"/>
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tighter text-white font-mono">ADATLAP
                KEZELÉSE</DialogTitle>
              <p className="text-[10px] text-blue-400/80 font-mono tracking-widest uppercase font-bold">ACCESS
                LEVEL: {currentUser?.faction_rank.toUpperCase()}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold">JELVÉNYSZÁM</div>
            <div
              className="text-lg font-mono font-bold text-white tracking-widest bg-slate-900 px-2 rounded border border-slate-700">{user.badge_number}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

          {/* 1. ALAP ADATOK */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Briefcase className="w-4 h-4 text-slate-400"/>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Szolgálati Adatok</h4>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5"><Label
                className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Teljes Név</Label><Input
                value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="bg-slate-950 border-slate-700 h-10 font-bold text-sm focus-visible:ring-blue-500/50"
                disabled={isFieldDisabled('rank')}/></div>
              <div className="space-y-1.5"><Label
                className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Jelvényszám</Label><Input
                value={formData.badge_number} onChange={e => setFormData({...formData, badge_number: e.target.value})}
                className="bg-slate-950 border-slate-700 h-10 font-mono text-yellow-500 font-bold tracking-wider focus-visible:ring-blue-500/50"
                disabled={isFieldDisabled('rank')}/></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Rendfokozat</Label>
              <Select value={formData.faction_rank}
                      onValueChange={(val: any) => setFormData({...formData, faction_rank: val})}
                      disabled={isFieldDisabled('rank')}>
                <SelectTrigger className="bg-slate-950 border-slate-700 h-10 font-medium"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                  {allowedRanks.map(r => <SelectItem key={r} value={r}
                                                     className="font-mono text-xs focus:bg-blue-900/30 focus:text-blue-200">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* 2. OSZTÁLY */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-slate-400"/>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Osztály Beosztás</h4>
            </div>
            <div className="grid grid-cols-2 gap-5 p-5 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Fő Osztály</Label>
                <Select value={formData.division} onValueChange={(val: any) => setFormData({
                  ...formData,
                  division: val,
                  division_rank: val === 'TSB' ? null : formData.division_rank
                })} disabled={isFieldDisabled('division')}>
                  <SelectTrigger
                    className="bg-slate-900 border-slate-700 h-10 text-sm font-bold"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">{allowedDivisions.map(d =>
                    <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  className={cn("text-[10px] uppercase font-bold text-slate-500 tracking-wider", formData.division === 'TSB' ? 'opacity-50' : '')}>Alosztály
                  Rang</Label>
                <Select value={formData.division_rank || "none"} onValueChange={(val) => setFormData({
                  ...formData,
                  division_rank: val === "none" ? null : val as any
                })} disabled={formData.division === 'TSB' || isFieldDisabled('div_rank')}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 h-10 text-sm"><SelectValue
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
          </section>

          {/* 3. KÉPESÍTÉSEK (JÓL LÁTHATÓ GOMBOKKAL) */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Medal className="w-4 h-4 text-slate-400"/>
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Képesítések</h4>
            </div>
            <div className={cn("flex flex-wrap gap-3", isFieldDisabled('qual') && 'opacity-60 pointer-events-none')}>
              {QUALIFICATIONS.map(q => {
                const isSelected = formData.qualifications?.includes(q);
                const canToggleSpecific = !isFieldDisabled('qual') || (currentUser?.commanded_divisions?.includes(q));

                // Explicit gomb kinézet
                return (
                  <div key={q} onClick={() => canToggleSpecific && toggleQual(q)}
                       className={cn(
                         "flex items-center gap-2 px-3 py-2 rounded border-2 cursor-pointer transition-all select-none",
                         !canToggleSpecific ? "opacity-50 cursor-not-allowed bg-slate-950 border-slate-800 text-slate-600" :
                           isSelected
                             ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50" // AKTÍV
                             : "bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white" // INAKTÍV
                       )}
                  >
                    <div
                      className={cn("w-3 h-3 rounded-full border flex items-center justify-center", isSelected ? "border-white bg-white text-blue-600" : "border-slate-500 bg-transparent")}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-current"/>}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">{q}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. VEZETŐI JOGKÖRÖK (CSAK MANAGER) - NAGY KÁRTYÁKKAL */}
          {!isFieldDisabled('manager') && (
            <section className="space-y-4 pt-4">
              <div className="p-6 border border-yellow-600/30 rounded-xl bg-yellow-950/10 space-y-6 relative">
                <div className="flex items-center gap-2 border-b border-yellow-600/20 pb-3">
                  <Lock className="w-4 h-4 text-yellow-500"/>
                  <h4 className="text-xs font-black text-yellow-500 uppercase tracking-widest">VEZETŐI KINEVEZÉSEK
                    (MANAGER ONLY)</h4>
                </div>

                {/* Global Roles - CARD STYLE TOGGLES */}
                <div className="space-y-3">
                  <ToggleCard
                    title="BUREAU MANAGER"
                    description="Teljes körű rendszerhozzáférés, minden jogkör."
                    active={formData.is_bureau_manager}
                    onChange={(v: boolean) => setFormData({...formData, is_bureau_manager: v})}
                    icon={Crown}
                    colorClass="border-purple-500/50 text-purple-200"
                  />

                  <ToggleCard
                    title="BUREAU COMMANDER"
                    description={`Az osztály (${formData.division}) parancsnoka.`}
                    active={formData.is_bureau_commander}
                    onChange={(v: boolean) => setFormData({...formData, is_bureau_commander: v})}
                    icon={Award}
                    colorClass="border-blue-500/50 text-blue-200"
                    disabled={formData.division === 'TSB'}
                  />
                </div>

                {/* Division Leaders */}
                <div className="border-t border-yellow-600/20 pt-4 space-y-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-white">Képesítési Vezetők (Division Leadership)</Label>
                    <p className="text-[10px] text-yellow-200/50">Jelöld be, melyik alosztályokért felel (Lead).</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUALIFICATIONS.map(q => {
                      const isCommander = formData.commanded_divisions?.includes(q);
                      return (
                        <div key={q} onClick={() => toggleCommandedDivision(q)}
                             className={cn(
                               "relative px-4 py-2 rounded border-2 text-xs font-bold uppercase tracking-wider transition-all select-none cursor-pointer flex items-center gap-2",
                               isCommander
                                 ? "bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]" // AKTÍV
                                 : "bg-slate-900 border-slate-600 text-slate-500 hover:border-yellow-500/50 hover:text-yellow-500" // INAKTÍV
                             )}
                        >
                          {q}
                          {isCommander && <Crown className="w-3.5 h-3.5 fill-current"/>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <DialogFooter
          className="p-5 bg-slate-950 border-t border-slate-800 flex justify-between gap-2 shrink-0 relative z-20">
          <Button type="button" variant="ghost" size="sm" onClick={onKickRequest}
                  className="text-red-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/50"
                  disabled={loading || (isFieldDisabled('rank') && !(currentUser?.is_bureau_commander && currentUser?.division === user.division))}>
            <Trash2 className="w-4 h-4 mr-2"/> ELBOCSÁTÁS
          </Button>
          <div className="flex gap-3">
            <Button onClick={() => onOpenChange(false)} variant="outline" size="sm"
                    className="border-slate-700 hover:bg-slate-800 text-slate-300">MÉGSE</Button>
            <Button onClick={handleSave} disabled={loading} size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wider shadow-lg shadow-blue-900/30 px-6">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> :
                <CheckCircle2 className="w-4 h-4 mr-2"/>} MENTÉS
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StaffSection({title, icon: Icon, users, colorClass, onEdit, currentUser, onGiveAward}: any) {
  if (users.length === 0) return null;

  return (
    <Card
      className={`bg-[#0b1221] border border-slate-800 shadow-xl overflow-hidden mb-8 relative group ${colorClass}`}>
      <div
        className="px-6 py-4 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
          <div className="p-1.5 rounded bg-slate-900 border border-slate-700 shadow-sm"><Icon
            className="w-4 h-4 text-slate-400"/></div>
          {title}
        </h3>
        <Badge variant="secondary"
               className="bg-slate-900 border-slate-700 text-slate-400 font-mono text-xs px-2 py-0.5">{users.length} FŐ</Badge>
      </div>
      <div className="p-0">
        <Table>
          <TableHeader className="bg-slate-950/30">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead
                className="w-[80px] text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-6">Jelvény</TableHead>
              <TableHead className="w-[250px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Név /
                Beosztás</TableHead>
              <TableHead
                className="w-[120px] text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Szolg.
                Idő</TableHead>
              <TableHead
                className="w-[150px] text-[10px] font-bold text-slate-500 uppercase tracking-wider">Osztály</TableHead>
              <TableHead
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kvalifikációk</TableHead>
              <TableHead className="w-[100px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => {
              const daysInRank = user.last_promotion_date ? differenceInDays(new Date(), new Date(user.last_promotion_date)) : differenceInDays(new Date(), new Date(user.created_at));
              const isMe = currentUser?.id === user.id;

              let showEdit = false;
              if (currentUser) {
                if (currentUser.is_bureau_manager) showEdit = true;
                else if (isExecutive(currentUser)) showEdit = true;
                else if (currentUser.is_bureau_commander) showEdit = true;
                else if (currentUser.commanded_divisions && currentUser.commanded_divisions.length > 0) showEdit = true;
                else if (!isMe && canEditUser(currentUser, user)) showEdit = true;
              }

              const canAward = currentUser && canAwardRibbon(currentUser) && !isMe;

              return (
                <TableRow key={user.id} className="border-slate-800/50 hover:bg-slate-900/80 transition-colors group">
                  <TableCell className="pl-6">
                    <span
                      className="font-mono font-bold text-yellow-600 bg-yellow-950/10 px-1.5 py-0.5 rounded border border-yellow-900/30 text-xs">#{user.badge_number}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-700 shadow-sm">
                        <AvatarImage src={user.avatar_url}/>
                        <AvatarFallback
                          className="bg-slate-900 text-slate-500 font-bold text-[10px]">{user.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {user.full_name}
                          {user.is_bureau_manager && <Crown className="w-3 h-3 text-purple-500 fill-current"/>}
                          {user.is_bureau_commander && <Award className="w-3 h-3 text-blue-500 fill-current"/>}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{user.faction_rank}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                      <CalendarClock className="w-3 h-3 text-slate-600"/><span>{daysInRank} NAP</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.division !== 'TSB' ? (
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${user.division === 'MCB' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 'bg-red-900/20 text-red-400 border-red-900/50'}`}>
                        {user.division} {user.division_rank ? `• ${user.division_rank.split(' ')[0]}` : ''}
                      </div>
                    ) : <span className="text-slate-600 text-[10px] font-mono">TSB FIELD</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(user.qualifications || []).map((q: any) => (<span key={q}
                                                                          className="text-[9px] font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{q}</span>))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div
                      className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canAward && (
                        <Button size="icon" variant="ghost"
                                className="h-7 w-7 text-yellow-500 hover:bg-yellow-900/20 hover:text-yellow-400"
                                onClick={() => onGiveAward(user)} title="Kitüntetés"><Medal
                          className="w-3.5 h-3.5"/></Button>
                      )}
                      {showEdit && (
                        <Button size="icon" variant="ghost"
                                className="h-7 w-7 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300"
                                onClick={() => onEdit(user)} title="Szerkesztés"><PenTool
                          className="w-3.5 h-3.5"/></Button>
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

export function HrPage() {
  const {supabase, profile, session} = useAuth();
  const {recruitmentOpen, toggleRecruitment} = useSystemStatus();
  const [users, setUsers] = React.useState<Profile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [editingUser, setEditingUser] = React.useState<Profile | null>(null);
  const [awardTarget, setAwardTarget] = React.useState<{ id: string, name: string } | null>(null);
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
        body: JSON.stringify(body)
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
        body: JSON.stringify({userId: userToKick.id})
      });
      if (!response.ok) throw new Error();
      toast.warning(`${userToKick.full_name} elbocsátva.`);
      fetchUsers();
      setEditingUser(null);
    } catch {
      toast.error("Hiba történt.");
    } finally {
      setIsKickAlertOpen(false);
      setUserToKick(null);
    }
  };

  const filteredUsers = users.filter(u => u.system_role !== 'pending' && (u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.badge_number.includes(searchTerm)));
  const highCommandUsers = filteredUsers.filter(u => HIGH_COMMAND_RANKS.includes(u.faction_rank));
  const supervisoryUsers = filteredUsers.filter(u => SUPERVISORY_RANKS.includes(u.faction_rank));
  const fieldUsers = filteredUsers.filter(u => !HIGH_COMMAND_RANKS.includes(u.faction_rank) && !SUPERVISORY_RANKS.includes(u.faction_rank));
  const pendingUsers = users.filter(u => u.system_role === 'pending');
  const canManageRecruitment = profile?.system_role === 'admin';
  const canManagePending = profile?.system_role === 'admin' || profile?.system_role === 'supervisor';

  return (
    <div
      className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-10 h-[calc(100vh-6rem)] flex flex-col">
      <AlertDialog open={isKickAlertOpen} onOpenChange={setIsKickAlertOpen}>
        <AlertDialogContent className="bg-[#0b1221] border-red-900/50 border text-white">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-red-500 font-bold uppercase tracking-widest flex items-center gap-2"><ShieldAlert
              className="w-5 h-5"/> VÉGLEGES ELBOCSÁTÁS</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm">Biztosan el akarod bocsátani <span
              className="text-white font-bold">{userToKick?.full_name}</span> nevű tagot? Ez a művelet nem
              visszavonható.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">MÉGSE</AlertDialogCancel><AlertDialogAction
            className="bg-red-600 hover:bg-red-700 text-white border-none font-bold"
            onClick={confirmKick}>ELBOCSÁTÁS</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditUserDialog user={editingUser} open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}
                      onUpdate={fetchUsers} currentUser={profile} onKickRequest={() => {
        setUserToKick(editingUser);
        setIsKickAlertOpen(true);
      }}/>
      {awardTarget && <GiveAwardDialog open={!!awardTarget} onOpenChange={(o) => !o && setAwardTarget(null)}
                                       targetUserId={awardTarget.id} targetUserName={awardTarget.name}
                                       onSuccess={() => {
                                       }}/>}

      {/* --- HEADER --- */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-[#0a0f1c] border-b-2 border-yellow-600/20 p-6 relative overflow-hidden shadow-lg">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-yellow-600/5 to-transparent"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div
            className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
            <Briefcase className="w-8 h-8"/></div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase font-mono">SZEMÉLYÜGYI OSZTÁLY</h1>
            <p className="text-xs text-yellow-500/60 font-bold uppercase tracking-[0.2em]">Human Resources &
              Personnel</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          {canManageRecruitment && (
            // TGF GOMB CSERE: EGYÉRTELMŰ BUTTON
            <Button onClick={toggleRecruitment}
                    className={cn("h-10 px-4 font-bold border-2 transition-all uppercase tracking-wider text-xs",
                      recruitmentOpen ? "bg-green-600 hover:bg-green-500 border-green-400 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]")}>
              {recruitmentOpen ? <><Check className="w-4 h-4 mr-2"/> TGF: NYITVA</> : <><X
                className="w-4 h-4 mr-2"/> TGF: ZÁRVA</>}
            </Button>
          )}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <Input placeholder="KERESÉS..."
                   className="pl-9 bg-slate-950/50 border-slate-700 focus-visible:ring-yellow-500/50 h-10 font-mono text-xs"
                   value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-6">
        {canManagePending && pendingUsers.length > 0 && (
          <div className="bg-yellow-950/10 border border-yellow-600/30 rounded-lg p-6 relative overflow-hidden">
            <div
              className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-5"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <ShieldAlert className="w-5 h-5 text-yellow-500 animate-pulse"/>
              <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest">Jóváhagyásra Vár
                ({pendingUsers.length})</h3>
            </div>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 relative z-10">
              {pendingUsers.map(u => (
                <div key={u.id}
                     className="bg-slate-950 p-3 rounded border border-yellow-900/50 flex justify-between items-center group hover:border-yellow-600/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-slate-700"><AvatarFallback
                      className="bg-slate-900 text-xs font-bold text-yellow-600">?</AvatarFallback></Avatar>
                    <div>
                      <p className="font-bold text-white text-sm">{u.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">BADGE: {u.badge_number}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon"
                            className="h-7 w-7 bg-green-900/20 text-green-500 hover:bg-green-600 hover:text-white border border-green-900/50"
                            onClick={() => handlePendingAction(u.id, 'approve')}><CheckCircle2 className="w-3.5 h-3.5"/></Button>
                    <Button size="icon"
                            className="h-7 w-7 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-900/50"
                            onClick={() => handlePendingAction(u.id, 'reject')}><Trash2
                      className="w-3.5 h-3.5"/></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Loader2
            className="w-10 h-10 animate-spin mb-3 text-yellow-600"/><p
            className="text-xs font-mono uppercase tracking-widest">LOADING PERSONNEL DATA...</p></div>
        ) : (
          <>
            <StaffSection title="VEZÉRKAR (EXECUTIVE / COMMAND)" icon={Crown} users={highCommandUsers}
                          colorClass="border-yellow-600/30 shadow-yellow-900/10" onEdit={setEditingUser}
                          currentUser={profile}
                          onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}/>
            <StaffSection title="VEZETŐSÉG (SUPERVISORY STAFF)" icon={Star} users={supervisoryUsers}
                          colorClass="border-green-600/30 shadow-green-900/5" onEdit={setEditingUser}
                          currentUser={profile}
                          onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}/>
            <StaffSection title="ÁLLOMÁNY (FIELD STAFF)" icon={Users} users={fieldUsers} colorClass="border-slate-800"
                          onEdit={setEditingUser} currentUser={profile}
                          onGiveAward={(user: any) => setAwardTarget({id: user.id, name: user.full_name})}/>
          </>
        )}
      </div>
    </div>
  );
}