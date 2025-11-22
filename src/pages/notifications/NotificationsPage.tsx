import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Bell, Check, Trash2, Info, AlertTriangle, CheckCircle2, Eye, EyeOff} from "lucide-react";
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


export function NotificationsPage() {
  const {supabase, user} = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    const {data} = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false});

    if (data) setNotifications(data as any);
  };

  React.useEffect(() => {
    fetchNotifications();
    const channel = supabase.channel('my_notifications_page_v2').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user?.id}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') setNotifications(prev => [payload.new as any, ...prev]);
      else if (payload.eventType === 'UPDATE') setNotifications(prev => prev.map(n => n.id === payload.new.id ? {...n, ...payload.new} : n));
      else if (payload.eventType === 'DELETE') setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // CSAK OLVASOTTNAK JELÖLÉS (Nem navigál)
  const toggleReadStatus = async (e: React.MouseEvent, note: Notification) => {
    e.stopPropagation(); // Megállítjuk a kattintást, hogy ne navigáljon

    const newStatus = !note.is_read;

    // Optimista frissítés
    setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: newStatus} : n));

    const {error} = await supabase.from('notifications').update({is_read: newStatus}).eq('id', note.id);
    if (error) {
      // Visszaállítás hiba esetén
      setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: !newStatus} : n));
    }
  };

  // NAVIGÁLÁS (És olvasottnak jelölés, ha még nem az)
  const handleCardClick = async (note: Notification) => {
    if (!note.is_read) {
      supabase.from('notifications').update({is_read: true}).eq('id', note.id);
      setNotifications(prev => prev.map(n => n.id === note.id ? {...n, is_read: true} : n));
    }
    if (note.link) {
      navigate(note.link);
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    await supabase.from('notifications').update({is_read: true}).eq('user_id', user!.id).eq('is_read', false);
    toast.success("Minden megjelölve olvasottként.");
  };

  const deleteAll = async () => {
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', user!.id);
    setIsDeleteAlertOpen(false);
    toast.success("Értesítések törölve.");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500"/>;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500"/>;
      case 'alert':
        return <Bell className="w-5 h-5 text-red-500"/>;
      default:
        return <Info className="w-5 h-5 text-blue-500"/>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-white">Értesítési Központ</h1><p
          className="text-slate-400">Rendszerüzenetek és figyelmeztetések.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead}><Check className="w-4 h-4 mr-2"/> Összes
            olvasott</Button>
          <Button variant="destructive" size="sm" onClick={() => setIsDeleteAlertOpen(true)}><Trash2
            className="w-4 h-4 mr-2"/> Törlés</Button>
        </div>
      </div>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader><AlertDialogTitle>Összes törlése</AlertDialogTitle><AlertDialogDescription
            className="text-slate-400">Biztosan törlöd az összes
            értesítést?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-white">Mégse</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-none"
                               onClick={deleteAll}>Törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-slate-900 border-slate-800 min-h-[500px]">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500"><Bell
                className="w-12 h-12 mb-4 opacity-20"/><p>Nincsenek értesítéseid.</p></div>
            ) : (
              <div className="divide-y divide-slate-800">
                {notifications.map(note => (
                  <div
                    key={note.id}
                    className={`group p-4 flex gap-4 hover:bg-slate-800/40 transition-all cursor-pointer relative ${!note.is_read ? 'bg-slate-800/20 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                    onClick={() => handleCardClick(note)}
                  >
                    <div className="mt-1 shrink-0">{getIcon(note.type)}</div>
                    <div className="flex-1 pr-10"> {/* Jobb oldali padding a gomboknak */}
                      <div className="flex justify-between items-start">
                        <h4
                          className={`font-bold text-sm ${!note.is_read ? 'text-white' : 'text-slate-400'}`}>{note.title}</h4>
                        <span
                          className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                          locale: hu
                        })}</span>
                      </div>
                      <p
                        className={`text-sm mt-1 ${!note.is_read ? 'text-slate-300' : 'text-slate-500'}`}>{note.message}</p>
                    </div>

                    {/* MŰVELETI GOMBOK (Jobb oldalon) */}
                    <div
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-slate-700 rounded-full"
                        title={note.is_read ? "Jelölés olvasatlanként" : "Jelölés olvasottként"}
                        onClick={(e) => toggleReadStatus(e, note)}
                      >
                        {note.is_read ? <EyeOff className="w-4 h-4 text-slate-500"/> :
                          <Eye className="w-4 h-4 text-blue-400"/>}
                      </Button>
                    </div>

                    {/* Kék pötty (csak ha olvasatlan és nem hoverelünk épp) */}
                    {!note.is_read && (
                      <div
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full group-hover:opacity-0 transition-opacity"/>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}