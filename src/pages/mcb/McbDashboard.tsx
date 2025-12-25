import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {
  FilePlus,
  Clock,
  Search,
  AlertCircle,
  FileWarning,
  FolderSearch,
  Siren,
  Archive,
  Lock,
  FolderOpen,
  LayoutList
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
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";

// --- KOMPONENSEK ---

const StatCard = ({title, value, icon: Icon, colorClass, gradient}: any) => (
  <div
    className={`relative overflow-hidden rounded-2xl border border-slate-800/60 p-6 group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${gradient}`}>
    <div
      className="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:rotate-12 duration-700">
      <Icon className={`w-32 h-32 ${colorClass}`}/>
    </div>
    <div className="relative z-10 flex flex-col h-full justify-between">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClass.replace('text-', 'bg-')}/20 border border-white/5 backdrop-blur-md shadow-inner`}>
        <Icon className={`w-6 h-6 ${colorClass}`}/>
      </div>
      <div>
        <div className="text-4xl font-black text-white tracking-tighter mb-1 font-mono">{value}</div>
        <div className="text-[11px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
          {title}
        </div>
      </div>
    </div>
  </div>
);

const PriorityBadge = ({prio}: { prio: string }) => {
  const styles: any = {
    critical: "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    low: "bg-slate-500/10 text-slate-400 border-slate-500/30"
  };
  const labels: any = {critical: "KRITIKUS", high: "MAGAS", medium: "KÖZEPES", low: "ALACSONY"};

  return <span
    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${styles[prio] || styles.low}`}>{labels[prio] || "NORMÁL"}</span>
};

const StatusBadge = ({status}: { status: string }) => {
  if (status === 'open') return <Badge variant="outline"
                                       className="border-green-500/50 text-green-400 bg-green-500/10 text-[10px] uppercase tracking-wide">Folyamatban</Badge>;
  if (status === 'closed') return <Badge variant="outline"
                                         className="border-slate-600 text-slate-400 bg-slate-800 text-[10px] uppercase tracking-wide">Lezárt</Badge>;
  if (status === 'archived') return <Badge variant="outline"
                                           className="border-red-900 text-red-700 bg-red-950/20 text-[10px] uppercase tracking-wide">Archivált</Badge>;
  return null;
}

export function McbDashboard() {
  const {supabase, profile, user} = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = React.useState({myOpen: 0, totalOpen: 0, critical: 0});
  const [cases, setCases] = React.useState<any[]>([]);
  const [pendingWarrants, setPendingWarrants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isNewCaseOpen, setIsNewCaseOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("open");

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return "Jó éjszakát";
    if (hour < 10) return "Jó reggelt";
    if (hour < 18) return "Jó napot";
    return "Jó estét";
  };

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Statisztikák
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

      // 2. Akták
      let query = supabase
        .from('cases')
        .select('*, owner:owner_id(full_name)')
        .order('updated_at', {ascending: false});

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }
      query = query.limit(50);

      const {data: caseData} = await query;
      setCases(caseData || []);

      // 3. Warrants
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
  }, [supabase, profile?.id, activeTab]);

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

  const filteredCases = cases.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.case_number.toString().includes(search) ||
    (c.owner?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <NewCaseDialog open={isNewCaseOpen} onOpenChange={setIsNewCaseOpen} onCaseCreated={fetchData}/>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-1">
            <span className="text-sky-500">MCB</span> DASHBOARD
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            {getGreeting()}, <span className="text-white font-bold">{profile?.full_name}</span>.
            <span className="ml-2 opacity-50"> // {new Date().toLocaleDateString('hu-HU')}</span>
          </p>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="SAJÁT NYITOTT ÜGYEK"
          value={stats.myOpen}
          icon={FolderSearch}
          colorClass="text-sky-400"
          gradient="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-900/20"
          borderClass="border-sky-500/20"
        />
        <StatCard
          title="TELJES ÜGYSZÁM"
          value={stats.totalOpen}
          icon={Clock}
          colorClass="text-blue-400"
          gradient="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900/20"
          borderClass="border-blue-500/20"
        />
        <StatCard
          title="KRITIKUS RIASZTÁS"
          value={stats.critical}
          icon={Siren}
          colorClass="text-red-500"
          gradient="bg-gradient-to-br from-slate-900 via-slate-900 to-red-900/20"
          borderClass="border-red-500/30"
        />
      </div>

      {/* WARRANTS ALERT */}
      {pendingWarrants.length > 0 && canApproveWarrant(profile) && (
        <div
          className="border border-red-500/40 bg-red-950/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.15)] relative group">
          <div className="absolute inset-0 bg-[url('/stripes.png')] opacity-10"></div>
          <div
            className="bg-red-900/20 px-4 py-3 border-b border-red-500/30 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute"></div>
                <div className="w-3 h-3 rounded-full bg-red-500 relative"></div>
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-red-400">Jóváhagyás Szükséges</span>
            </div>
            <Badge variant="destructive" className="font-mono">{pendingWarrants.length} DB</Badge>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 relative z-10">
              {pendingWarrants.map(w => (
                <div key={w.id}
                     className="bg-slate-950/80 border border-slate-800 hover:border-red-500/50 rounded-lg p-3 flex gap-4 transition-all group/item">
                  <div
                    className={`shrink-0 w-12 h-12 rounded-lg flex items-center justify-center border ${w.type === 'arrest' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
                    {w.type === 'arrest' ? <FileWarning className="w-6 h-6"/> : <AlertCircle className="w-6 h-6"/>}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-200 truncate">{w.suspect?.full_name || w.target_name}</span>
                      <span
                        className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 rounded">#{w.case?.case_number}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{w.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-80 group-hover/item:opacity-100">
                    <Button size="sm" variant="outline" onClick={() => handleWarrantAction(w.id, 'rejected')}
                            className="h-8 w-8 p-0 border-red-900/50 text-red-500 hover:bg-red-950 hover:text-red-400"><span
                      className="sr-only">X</span>X</Button>
                    <Button size="sm" onClick={() => handleWarrantAction(w.id, 'approved')}
                            className="h-8 bg-green-600 hover:bg-green-500 text-white font-bold px-3">JÓVÁHAGYÁS</Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* CASE LIST TABS */}
      <Tabs defaultValue="open" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-slate-900/80 border border-slate-800 h-11 p-1 backdrop-blur-md">
            <TabsTrigger value="open"
                         className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs uppercase font-bold px-4 h-full">
              <FolderOpen className="w-3.5 h-3.5 mr-2"/> Nyitott
            </TabsTrigger>
            <TabsTrigger value="closed"
                         className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs uppercase font-bold px-4 h-full">
              <Lock className="w-3.5 h-3.5 mr-2"/> Lezárt
            </TabsTrigger>
            <TabsTrigger value="archived"
                         className="data-[state=active]:bg-red-900/50 data-[state=active]:text-red-200 text-xs uppercase font-bold px-4 h-full">
              <Archive className="w-3.5 h-3.5 mr-2"/> Archivált
            </TabsTrigger>
            <TabsTrigger value="all"
                         className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs uppercase font-bold px-4 h-full">
              <LayoutList className="w-3.5 h-3.5 mr-2"/> Összes
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64 group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-sky-500 transition-colors"/>
              <Input
                placeholder="Keresés..."
                className="pl-9 h-11 bg-slate-950/50 border-slate-700 text-sm focus-visible:ring-sky-500/50 transition-all focus:bg-slate-900"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => setIsNewCaseOpen(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold h-11 px-6 shadow-[0_0_15px_rgba(2,132,199,0.3)] hover:shadow-[0_0_25px_rgba(2,132,199,0.5)] transition-all">
              <FilePlus className="w-4 h-4 mr-2"/> ÚJ AKTA
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm shadow-xl overflow-hidden min-h-[400px]">
          <Table>
            <TableHeader className="bg-slate-950/80">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-[80px] text-slate-500 font-mono text-[10px] uppercase font-bold">ID</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase font-bold">Megnevezés</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase font-bold">Státusz</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase font-bold">Prioritás</TableHead>
                <TableHead className="text-slate-500 font-mono text-[10px] uppercase font-bold">Nyomozó</TableHead>
                <TableHead className="text-right text-slate-500 font-mono text-[10px] uppercase font-bold">Utolsó
                  Aktivitás</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <TableRow key={i} className="border-slate-800/50">
                    <TableCell>
                      <div className="h-4 w-10 bg-slate-800 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-32 bg-slate-800 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-24 bg-slate-800 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-slate-800 rounded animate-pulse ml-auto"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center opacity-50">
                      <FolderOpen className="w-12 h-12 text-slate-600 mb-2"/>
                      <p className="text-sm font-medium text-slate-400">Nincs megjeleníthető akta ebben a nézetben.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases.map(c => (
                  <TableRow key={c.id}
                            className={`border-slate-800/50 cursor-pointer transition-all group ${
                              c.status === 'closed' ? 'opacity-60 hover:opacity-100 hover:bg-slate-800/30' :
                                c.status === 'archived' ? 'opacity-40 hover:opacity-100 hover:bg-red-950/10' :
                                  'hover:bg-sky-900/10'
                            }`}
                            onClick={() => navigate(`/mcb/case/${c.id}`)}>
                    <TableCell className="font-mono text-sky-500 font-bold group-hover:text-sky-400">
                      #{c.case_number.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-medium text-slate-200 group-hover:text-white">
                      {c.title}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status}/>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge prio={c.priority}/>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 font-medium">
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
        </Card>
      </Tabs>
    </div>
  );
}