import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {
  FilePlus,
  FolderOpen,
  Clock,
  Search,
  AlertCircle,
  FileWarning,
  Check,
  X,
  FolderSearch,
  Siren
} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {Input} from "@/components/ui/input";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {toast} from "sonner";
import {NewCaseDialog} from "./components/NewCaseDialog";
import {canApproveWarrant} from "@/lib/utils";
import {ScrollArea} from "@/components/ui/scroll-area";

// --- HELPER COMPONENTS ---
const StatCard = ({title, value, icon: Icon, colorClass, borderClass}: any) => (
  <div
    className={`relative overflow-hidden rounded-xl bg-slate-900/40 border backdrop-blur-sm p-5 group transition-all duration-300 hover:bg-slate-900/60 ${borderClass}`}>
    <div
      className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
      <Icon className={`w-20 h-20 ${colorClass}`}/>
    </div>
    <div className="relative z-10">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClass.replace('text-', 'bg-')}/10 border ${borderClass}`}>
        <Icon className={`w-5 h-5 ${colorClass}`}/>
      </div>
      <div className="text-3xl font-black text-white font-mono tracking-tighter mb-1">{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{title}</div>
    </div>
  </div>
);

const PriorityBadge = ({prio}: { prio: string }) => {
  const styles = {
    critical: "bg-red-500/10 text-red-500 border-red-500/50 animate-pulse",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    low: "bg-slate-500/10 text-slate-400 border-slate-500/30"
  };
  const labels = {critical: "KRITIKUS", high: "MAGAS", medium: "KÖZEPES", low: "ALACSONY"};

  // @ts-ignore
  return <span
    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${styles[prio] || styles.low}`}>{labels[prio] || "NORMÁL"}</span>
};

export function McbDashboard() {
  const {supabase, profile, user} = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = React.useState({myOpen: 0, totalOpen: 0, critical: 0});
  const [myCases, setMyCases] = React.useState<any[]>([]);
  const [pendingWarrants, setPendingWarrants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isNewCaseOpen, setIsNewCaseOpen] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // Statisztikák (Parallel fetch)
      const [myOpen, totalOpen, crit] = await Promise.all([
        supabase.from('cases').select('id', {
          count: 'exact',
          head: true
        }).eq('status', 'open').eq('owner_id', profile?.id),
        supabase.from('cases').select('id', {count: 'exact', head: true}).eq('status', 'open'),
        supabase.from('cases').select('id', {
          count: 'exact',
          head: true
        }).eq('status', 'open').eq('priority', 'critical')
      ]);

      setStats({
        myOpen: myOpen.count || 0,
        totalOpen: totalOpen.count || 0,
        critical: crit.count || 0
      });

      // Akták
      const {data: cases} = await supabase
        .from('cases')
        .select('*, owner:owner_id(full_name)')
        .eq('status', 'open')
        .order('updated_at', {ascending: false})
        .limit(20);

      setMyCases(cases || []);

      // Függő Parancsok
      if (canApproveWarrant(profile)) {
        const {data: wData} = await supabase
          .from('case_warrants')
          .select(`*, requester:requested_by(full_name), case:case_id(title, case_number), property:property_id(address), suspect:suspect_id(full_name)`)
          .eq('status', 'pending')
          .order('created_at', {ascending: true});
        setPendingWarrants(wData || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, profile]);

  React.useEffect(() => {
    if (profile) fetchData();
  }, [fetchData]);

  const handleWarrantAction = async (id: string, status: 'approved' | 'rejected') => {
    const {error} = await supabase.from('case_warrants').update({
      status, approved_by: user?.id, updated_at: new Date().toISOString()
    }).eq('id', id);

    if (!error) {
      toast.success(status === 'approved' ? 'Parancs jóváhagyva.' : 'Parancs elutasítva.');
      fetchData();
    } else toast.error("Hiba történt.");
  }

  const filteredCases = myCases.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.case_number.toString().includes(search) ||
    (c.owner?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <NewCaseDialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen} onCaseCreated={fetchData}/>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="SAJÁT NYITOTT ÜGYEK" value={stats.myOpen} icon={FolderSearch} colorClass="text-sky-400"
                  borderClass="border-sky-500/20"/>
        <StatCard title="AKTÍV ÁLLOMÁNY ÜGYEI" value={stats.totalOpen} icon={Clock} colorClass="text-blue-400"
                  borderClass="border-blue-500/20"/>
        <StatCard title="KRITIKUS RIASZTÁS" value={stats.critical} icon={Siren} colorClass="text-red-500"
                  borderClass="border-red-500/30"/>
      </div>

      {/* ALERT SECTION (WARRANTS) */}
      {pendingWarrants.length > 0 && canApproveWarrant(profile) && (
        <div
          className="border border-red-500/30 bg-red-950/10 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <div className="bg-red-950/30 px-4 py-2 border-b border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span
                className="text-xs font-black uppercase tracking-widest text-red-400">Parancs Jóváhagyás Szükséges</span>
            </div>
            <span className="text-xs font-mono text-red-500/70">{pendingWarrants.length} FÜGGŐ</span>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {pendingWarrants.map(w => (
                <div key={w.id}
                     className="bg-slate-950/60 border border-slate-800 rounded p-3 flex gap-3 group hover:border-red-500/30 transition-colors">
                  <div
                    className={`shrink-0 w-10 h-10 rounded flex items-center justify-center border ${w.type === 'arrest' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
                    {w.type === 'arrest' ? <FileWarning className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4
                        className="font-bold text-slate-200 text-sm truncate">{w.suspect?.full_name || w.property?.address || w.target_name}</h4>
                      <span className="text-[10px] font-mono text-slate-500">#{w.case?.case_number}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 mb-2">{w.reason}</p>
                    <div className="flex gap-2">
                      <Button size="xs" onClick={() => handleWarrantAction(w.id, 'approved')}
                              className="h-6 text-[10px] bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20">JÓVÁHAGYÁS</Button>
                      <Button size="xs" onClick={() => handleWarrantAction(w.id, 'rejected')}
                              className="h-6 text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20">ELUTASÍTÁS</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* MAIN CASE LIST */}
      <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-sky-500"/>
              AKTÍV NYOMOZÁSOK
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"/>
              <Input
                placeholder="Szűrés..."
                className="pl-9 h-9 bg-slate-950/50 border-slate-700 text-sm focus-visible:ring-sky-500/50"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setIsNewCaseOpen(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold h-9">
              <FilePlus className="w-4 h-4 mr-2"/> ÚJ AKTA
            </Button>
          </div>
        </div>

        <div className="overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-[80px] text-slate-500 font-mono text-[10px] uppercase">ID</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase">Megnevezés</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase">Prioritás</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase">Nyomozó</TableHead>
                <TableHead className="text-right text-slate-500 font-mono text-[10px] uppercase">Utolsó
                  Aktivitás</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500 text-xs">Nincs megjeleníthető
                    adat.</TableCell>
                </TableRow>
              ) : (
                filteredCases.map(c => (
                  <TableRow key={c.id}
                            className="border-slate-800/50 hover:bg-sky-500/5 cursor-pointer transition-colors group"
                            onClick={() => navigate(`/mcb/case/${c.id}`)}>
                    <TableCell className="font-mono text-sky-500 font-bold group-hover:text-sky-400">
                      #{c.case_number.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200 group-hover:text-white">
                      {c.title}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge prio={c.priority}/>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {c.owner?.full_name || "N/A"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-slate-500">
                      {formatDistanceToNow(new Date(c.updated_at), {addSuffix: true, locale: hu})}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}