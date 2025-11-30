import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Bell, Check, Trash2, Info, AlertTriangle, CheckCircle2, Eye, EyeOff, Radio, Inbox, Filter} from "lucide-react";
import {toast} from "sonner";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import type {Notification} from "@/types/supabase";
import {useNavigate} from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {SheriffBackground} from "@/components/SheriffBackground";
import {Badge} from "@/components/ui/badge";
import {cn} from "@/lib/utils";

// --- STÍLUSOK ---
const getTypeStyles = (type: string) => {
  switch (type) {
    case 'success':
      return {
        icon: CheckCircle2,
        color: 'text-green-500',
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        badge: 'SIKERES'
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        badge: 'FIGYELEM'
      };
    case 'alert':
      return {icon: Bell, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'RIASZTÁS'};
    default:
      return {icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30', badge: 'INFÓ'};
  }
};

export function NotificationsPage() {
  const {supabase, user} = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    if (!user) return;
    const {data} = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', {ascending: false});
    if (data) setNotifications(data as any);
  };

  React.useEffect(() => {
    fetchNotifications();
    const channel = supabase.channel('notif_page_realtime').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') setNotifications(prev => [payload.new as any, ...prev]);
        else if (payload.eventType === 'UPDATE') setNotifications(prev => prev.map(n => n.id === payload.new.id ? {...n, ...payload.new} : n));
        else if (payload.eventType === 'DELETE') setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const toggleReadStatus = async (e: React.MouseEvent, note: Notification) => {
    e.stopPropagation();
    const newStatus = !note.is_read;
    setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: newStatus} : n));
    const {error} = await supabase.from('notifications').update({is_read: newStatus}).eq('id', note.id);
    if (error) setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: !newStatus} : n));
  };

  const handleCardClick = async (note: Notification) => {
    if (!note.is_read) {
      supabase.from('notifications').update({is_read: true}).eq('id', note.id);
      setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: true} : n));
    }
    if (note.link) navigate(note.link);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    await supabase.from('notifications').update({is_read: true}).eq('user_id', user!.id).eq('is_read', false);
    toast.success("Minden üzenet olvasott.");
  };

  const deleteAll = async () => {
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user!.id);
    setIsDeleteAlertOpen(false);
    toast.success("Napló törölve.");
  };

  const filteredNotifications = filter === 'all' ? notifications : notifications.filter(n => !n.is_read);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#050a14] relative overflow-hidden pb-20">
      <SheriffBackground/>

      {/* TÖRLÉS CONFIRM */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="bg-[#0b1221] border border-red-900/50 text-white">
          <AlertDialogHeader><AlertDialogTitle className="text-red-500 flex items-center gap-2"><Trash2
            className="w-5 h-5"/> ÜZENETEK TÖRLÉSE</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Biztosan
            törlöd a teljes értesítési naplót? Ez nem vonható vissza.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel
            className="bg-slate-900 border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel><AlertDialogAction
            className="bg-red-600 hover:bg-red-700 border-none text-white font-bold"
            onClick={deleteAll}>Törlés</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-5xl mx-auto px-6 py-10 relative z-10">

        {/* HEADER */}
        <div
          className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-blue-500/80 font-bold text-xs uppercase tracking-widest"><Inbox
              className="w-4 h-4"/> Communication Hub
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Bejövő Üzenetek</h1>
            <p
              className="text-sm text-slate-400 font-mono">Összesen {notifications.length} üzenet, {unreadCount} olvasatlan.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={markAllRead}
                    className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 bg-slate-950/50 uppercase font-bold tracking-wider text-xs h-9"><Check
              className="w-3.5 h-3.5 mr-2"/> Összes Olvasott</Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteAlertOpen(true)}
                    className="bg-red-900/20 border border-red-900/50 text-red-500 hover:bg-red-900/40 uppercase font-bold tracking-wider text-xs h-9"><Trash2
              className="w-3.5 h-3.5 mr-2"/> Törlés</Button>
          </div>
        </div>

        {/* FILTER TABS */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-900/50 border border-slate-800 rounded-lg w-fit">
          <button onClick={() => setFilter('all')}
                  className={cn("px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all", filter === 'all' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800")}>Minden
            Üzenet
          </button>
          <button onClick={() => setFilter('unread')}
                  className={cn("px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2", filter === 'unread' ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800")}>Olvasatlan {unreadCount > 0 &&
            <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{unreadCount}</span>}</button>
        </div>

        {/* CONTENT */}
        <Card
          className="bg-[#0b1221]/80 border border-slate-800 shadow-2xl min-h-[600px] backdrop-blur-md overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-slate-600 opacity-50">
                <Radio className="w-16 h-16 mb-4 animate-pulse"/>
                <p className="text-xs font-mono uppercase tracking-[0.2em] font-bold">NINCS MEGJELENÍTHETŐ ÜZENET</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {filteredNotifications.map((note, i) => {
                  const style = getTypeStyles(note.type);
                  const Icon = style.icon;
                  return (
                    <div key={note.id} onClick={() => handleCardClick(note)}
                         className={cn(
                           "group relative p-5 flex gap-5 transition-all cursor-pointer border-l-4 hover:bg-slate-900/60",
                           note.is_read ? "border-l-transparent bg-transparent opacity-70 hover:opacity-100" : "border-l-blue-500 bg-blue-950/10"
                         )}
                         style={{animationDelay: `${i * 50}ms`}}
                    >
                      {/* ICON BOX */}
                      <div
                        className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border", style.bg, style.border, style.color)}>
                        <Icon className="w-5 h-5"/>
                      </div>

                      {/* TEXT CONTENT */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn("text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-black/20", style.color, style.border)}>{style.badge}</span>
                            <h4
                              className={cn("text-sm font-bold uppercase tracking-tight truncate max-w-[300px] sm:max-w-none", note.is_read ? "text-slate-400" : "text-white")}>{note.title}</h4>
                          </div>
                          <span
                            className="text-[10px] text-slate-600 font-mono whitespace-nowrap ml-2">{formatDistanceToNow(new Date(note.created_at), {
                            addSuffix: true,
                            locale: hu
                          })}</span>
                        </div>
                        <p
                          className={cn("text-xs leading-relaxed pr-12 line-clamp-2", note.is_read ? "text-slate-500" : "text-slate-300")}>{note.message}</p>
                      </div>

                      {/* ACTIONS (Hover) */}
                      <div
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <Button size="icon" variant="ghost" onClick={(e) => toggleReadStatus(e, note)}
                                className="h-8 w-8 bg-slate-950 border border-slate-700 hover:bg-slate-900 hover:text-white text-slate-500">
                          {note.is_read ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </Button>
                      </div>

                      {/* Unread Dot */}
                      {!note.is_read && <div
                        className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] group-hover:opacity-0 transition-opacity"></div>}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}