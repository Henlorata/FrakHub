import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {FilePlus, FolderOpen, Clock, Search, AlertCircle, FileWarning, Check, X} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {Input} from "@/components/ui/input";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import {toast} from "sonner";
import {NewCaseDialog} from "./components/NewCaseDialog";
import {canApproveWarrant} from "@/lib/utils";
import {ScrollArea} from "@/components/ui/scroll-area"; // <--- IMPORT

const getPriorityBadge = (prio: string) => {
  switch (prio) {
    case 'critical':
      return <Badge variant="destructive" className="animate-pulse bg-red-600 hover:bg-red-700">KRITIKUS</Badge>;
    case 'high':
      return <Badge className="bg-orange-500 hover:bg-orange-600 border-none">Magas</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-600 hover:bg-yellow-700 border-none text-black">Közepes</Badge>;
    default:
      return <Badge variant="secondary" className="bg-slate-800 text-slate-300">Alacsony</Badge>;
  }
}

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
      // Statisztikák
      const {count: myOpenCount} = await supabase.from('cases').select('id', {
        count: 'exact',
        head: true
      }).eq('status', 'open').eq('owner_id', profile?.id);
      const {count: totalOpenCount} = await supabase.from('cases').select('id', {
        count: 'exact',
        head: true
      }).eq('status', 'open');
      const {count: critCount} = await supabase.from('cases').select('id', {
        count: 'exact',
        head: true
      }).eq('status', 'open').eq('priority', 'critical');
      setStats({myOpen: myOpenCount || 0, totalOpen: totalOpenCount || 0, critical: critCount || 0});

      // Akták
      const {data: cases, error} = await supabase
        .from('cases')
        .select('*, owner:owner_id(full_name)')
        .eq('status', 'open')
        .order('updated_at', {ascending: false})
        .limit(20);

      if (error) throw error;
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

  // Parancs kezelése
  const handleWarrantAction = async (id: string, status: 'approved' | 'rejected') => {
    const {error} = await supabase.from('case_warrants').update({
      status,
      approved_by: user?.id, // Itt a user.id a biztos, mert az auth táblában van a session
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (!error) {
      toast.success(`Parancs ${status === 'approved' ? 'jóváhagyva' : 'elutasítva'}.`);
      fetchData();
    } else {
      toast.error("Hiba történt.");
    }
  }

  const filteredCases = myCases.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.case_number.toString().includes(search) ||
    (c.owner?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">

      <NewCaseDialog
        open={isNewCaseOpen}
        onOpenChange={setIsNewCaseOpen}
        onCaseCreated={fetchData}
      />

      {/* FÜGGŐ PARANCSOK (Görgethető) */}
      {pendingWarrants.length > 0 && canApproveWarrant(profile) && (
        <Card className="bg-slate-900/80 border-slate-800 shadow-xl border-l-4 border-l-red-500 mb-6 flex flex-col">
          <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between shrink-0">
            <CardTitle className="text-red-400 flex items-center gap-2 text-lg">
              <FileWarning className="w-5 h-5"/> Jóváhagyásra váró parancsok ({pendingWarrants.length})
            </CardTitle>
          </CardHeader>

          <div className="p-0 overflow-hidden">
            <ScrollArea className="h-[320px] w-full px-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {pendingWarrants.map(w => (
                  <div key={w.id}
                       className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex flex-col shadow-sm h-full">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline"
                             className={w.type === 'arrest' ? 'text-red-400 border-red-900' : 'text-orange-400 border-orange-900'}>
                        {w.type === 'arrest' ? 'ELFOGATÓ' : 'HÁZKUTATÁSI'}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">#{w.case?.case_number}</span>
                    </div>
                    <h4 className="font-bold text-white mb-1 truncate"
                        title={w.target_name || w.suspect?.full_name || w.property?.address}>
                      {w.suspect?.full_name || w.property?.address || w.target_name || "Ismeretlen"}
                    </h4>
                    <p className="text-xs text-slate-400 mb-3 flex-1 line-clamp-2" title={w.reason}>{w.reason}</p>
                    <div className="text-[10px] text-slate-500 mb-3">
                      Igényelte: <span className="text-slate-300">{w.requester?.full_name}</span>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <Button size="sm"
                              className="flex-1 h-7 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-500 border border-green-900/50"
                              onClick={() => handleWarrantAction(w.id, 'approved')}>
                        <Check className="w-3 h-3 mr-1"/> Elfogad
                      </Button>
                      <Button size="sm"
                              className="flex-1 h-7 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-900/50"
                              onClick={() => handleWarrantAction(w.id, 'rejected')}>
                        <X className="w-3 h-3 mr-1"/> Elutasít
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </Card>
      )}

      {/* Statisztika Kártyák */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-blue-500/30 transition-all">
          <CardContent className="p-6 flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <FolderOpen className="w-7 h-7"/>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Saját ügyek</p>
              <p className="text-4xl font-bold text-white mt-1">{stats.myOpen}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-yellow-500/30 transition-all">
          <CardContent className="p-6 flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <Clock className="w-7 h-7"/>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Összes aktív</p>
              <p className="text-4xl font-bold text-white mt-1">{stats.totalOpen}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-red-500/30 transition-all">
          <CardContent className="p-6 flex items-center gap-5">
            <div
              className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <AlertCircle className="w-7 h-7 animate-pulse"/>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">Kritikus</p>
              <p className="text-4xl font-bold text-white mt-1">{stats.critical}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Akta Lista */}
      <Card className="bg-slate-900/80 border-slate-800 shadow-xl">
        <CardHeader
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/50 pb-6">
          <div>
            <CardTitle className="text-xl font-bold text-white">Aktív Nyomozások</CardTitle>
            <p className="text-slate-400 text-sm mt-1">A rendszerben lévő nyitott ügyek listája.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/>
              <Input
                placeholder="Keresés (cím, szám, nyomozó)..."
                className="pl-10 bg-slate-950 border-slate-700 focus-visible:ring-yellow-500/50"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold shadow-lg shadow-yellow-900/20"
              onClick={() => setIsNewCaseOpen(true)}>
              <FilePlus className="w-4 h-4 mr-2"/> Új Akta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent bg-slate-950/30">
                <TableHead
                  className="w-[100px] text-slate-400 font-bold uppercase text-xs tracking-wider pl-6">Szám</TableHead>
                <TableHead className="text-slate-400 font-bold uppercase text-xs tracking-wider">Megnevezés</TableHead>
                <TableHead className="text-slate-400 font-bold uppercase text-xs tracking-wider">Prioritás</TableHead>
                <TableHead className="text-slate-400 font-bold uppercase text-xs tracking-wider">Nyomozó</TableHead>
                <TableHead className="text-slate-400 font-bold uppercase text-xs tracking-wider">Frissítve</TableHead>
                <TableHead
                  className="text-right text-slate-400 font-bold uppercase text-xs tracking-wider pr-6">Művelet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-12 italic">
                    {search ? "Nincs találat a keresésre." : "Jelenleg nincsenek aktív nyomozások."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCases.map((c) => (
                  <TableRow key={c.id}
                            className="border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                            onClick={() => navigate(`/mcb/case/${c.id}`)}>
                    <TableCell
                      className="font-mono text-yellow-500/80 font-medium pl-6">#{c.case_number.toString().padStart(4, '0')}</TableCell>
                    <TableCell
                      className="font-medium text-slate-200 group-hover:text-white transition-colors">{c.title}</TableCell>
                    <TableCell>{getPriorityBadge(c.priority)}</TableCell>
                    <TableCell className="text-slate-400">{c.owner?.full_name || "Ismeretlen"}</TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">
                      {formatDistanceToNow(new Date(c.updated_at), {addSuffix: true, locale: hu})}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-700">
                        Megnyitás
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}