import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent} from "@/components/ui/card";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Badge} from "@/components/ui/badge";
import {ShieldAlert, Loader2, UserCog, CheckCircle, Search} from "lucide-react";
import {toast} from "sonner";
import {Navigate} from "react-router-dom";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

// --- RANK SÚLYOZÁS A SORRENDEZÉSHEZ ---
const MCB_RANK_ORDER: Record<string, number> = {
  'Investigator III.': 3,
  'Investigator II.': 2,
  'Investigator I.': 1
};

const FACTION_RANK_ORDER: Record<string, number> = {
  'Commander': 100, 'Deputy Commander': 99,
  'Captain III.': 90, 'Captain II.': 89, 'Captain I.': 88,
  'Lieutenant II.': 80, 'Lieutenant I.': 79,
  'Sergeant II.': 70, 'Sergeant I.': 69,
  'Corporal': 60,
  'Staff Deputy Sheriff': 50, 'Senior Deputy Sheriff': 40,
  'Deputy Sheriff III+.': 35, 'Deputy Sheriff III.': 30, 'Deputy Sheriff II.': 20, 'Deputy Sheriff I.': 10,
  'Deputy Sheriff Trainee': 0
};

const SYSTEM_ROLE_ORDER: Record<string, number> = {
  'admin': 3,
  'supervisor': 2,
  'user': 1,
  'pending': 0
};

export function AdminPage() {
  const {supabase, profile} = useAuth();
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  if (profile && profile.system_role !== 'admin' && profile.system_role !== 'supervisor') {
    return <Navigate to="/mcb" replace/>;
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const {data, error} = await supabase.from('profiles').select('*').neq('system_role', 'pending');
      if (error) throw error;

      // SORRENDEZÉS LOGIKA
      const sorted = (data || []).sort((a, b) => {
        // 1. MCB RANG (Elsődleges) - division_rank vagy investigator_rank
        const rankNameA = a.division_rank || a.investigator_rank;
        const rankNameB = b.division_rank || b.investigator_rank;

        const rankA = a.division === 'MCB' ? (MCB_RANK_ORDER[rankNameA] || 0) : -1;
        const rankB = b.division === 'MCB' ? (MCB_RANK_ORDER[rankNameB] || 0) : -1;

        if (rankA !== rankB) return rankB - rankA; // Csökkenő (Magasabb rang elöl)

        // 2. FACTION RANK
        const fRankA = FACTION_RANK_ORDER[a.faction_rank] || 0;
        const fRankB = FACTION_RANK_ORDER[b.faction_rank] || 0;
        if (fRankA !== fRankB) return fRankB - fRankA;

        // 3. ACCESS LEVEL
        const roleA = SYSTEM_ROLE_ORDER[a.system_role] || 0;
        const roleB = SYSTEM_ROLE_ORDER[b.system_role] || 0;
        return roleB - roleA;
      });

      setUsers(sorted);
    } catch (error: any) {
      toast.error("Hiba a felhasználók betöltésekor.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.badge_number.includes(search)
  );

  // Helper a rang megjelenítéshez
  const getMcbRank = (user: any) => {
    if (user.division !== 'MCB') return null;
    // Először a division_rank-ot nézzük, ha nincs, akkor a régit
    const rank = user.division_rank || user.investigator_rank;
    return rank ? rank.replace('Investigator', 'INV.') : null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">

      {/* Header Panel */}
      <div
        className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 bg-red-950/30 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.15)] relative overflow-hidden group">
            <div
              className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <UserCog className="w-7 h-7 relative z-10"/>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">ACCESS CONTROL</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline"
                     className="text-[10px] border-red-500/30 text-red-400 bg-red-500/5 px-1.5 py-0.5 rounded-sm">ADMIN
                LEVEL</Badge>
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">System User Management</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <Input
              placeholder="KERESÉS..."
              className="pl-9 w-full md:w-64 bg-slate-950 border-slate-800 focus-visible:ring-red-500/50 font-mono text-xs h-10"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="text-right hidden lg:block border-l border-slate-800 pl-4 ml-2">
            <div className="text-2xl font-mono font-bold text-white leading-none">{users.length}</div>
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">ACTIVE AGENTS</div>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="flex-1 min-h-0 bg-[#0a0f1c] relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(90deg, #fff 1px, transparent 1px), linear-gradient(#fff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>

        <div className="flex-1 overflow-auto custom-scrollbar p-0">
          <Table>
            <TableHeader className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-6 h-12 w-[300px]">AGENT
                  IDENTITY</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest h-12 w-[150px]">MCB
                  CLASSIFICATION</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest h-12">FACTION
                  RANK</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest h-12">SYSTEM
                  ROLE</TableHead>
                <TableHead
                  className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest pr-6 h-12">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-600"/>
                      <span className="text-xs font-mono text-slate-600 animate-pulse">ACCESSING DATABASE...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map(user => {
                  const mcbRank = getMcbRank(user);
                  return (
                    <TableRow key={user.id}
                              className="border-slate-800/50 hover:bg-slate-900/60 transition-colors group">
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-400">
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div
                              className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{user.full_name}</div>
                            <div className="text-[10px] text-slate-600 font-mono tracking-wide flex items-center gap-1">
                              BADGE: <span className="text-yellow-600">{user.badge_number}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {mcbRank ? (
                          <Badge variant="outline"
                                 className="bg-sky-500/10 text-sky-400 border-sky-500/30 text-[10px] uppercase font-bold tracking-wider">
                            {mcbRank}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-slate-700 font-mono">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-300 font-medium">{user.faction_rank}</span>
                      </TableCell>
                      <TableCell>
                        {user.system_role === 'admin' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase text-red-500 tracking-wider">
                              <ShieldAlert className="w-3 h-3"/> ADMIN
                           </span>
                        ) : user.system_role === 'supervisor' ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-black uppercase text-purple-500 tracking-wider">
                              SUPERVISOR
                           </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">USER</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div>
                          <span
                            className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">ACTIVE</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}