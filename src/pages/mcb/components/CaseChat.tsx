import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Send, MessageSquare} from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import type {CaseNote} from "@/types/supabase";

export function CaseChat({caseId}: { caseId: string }) {
  const {supabase, user, profile} = useAuth(); // profile is kell az optimista update-hez
  const [notes, setNotes] = React.useState<CaseNote[]>([]);
  const [message, setMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Kis késleltetés, hogy a DOM frissüljön
    setTimeout(() => {
      const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 100);
  }

  // Betöltés
  React.useEffect(() => {
    const fetchNotes = async () => {
      const {data} = await supabase
        .from('case_notes')
        .select('*, profile:user_id(full_name, avatar_url)')
        .eq('case_id', caseId)
        .order('created_at', {ascending: true});

      if (data) {
        setNotes(data as any);
        scrollToBottom();
      }
    };

    fetchNotes();

    // Realtime
    const channel = supabase
      .channel(`case_chat_${caseId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'case_notes',
        filter: `case_id=eq.${caseId}`
      }, async (payload) => {
        // Ha mi küldtük, akkor az optimista update már kezelte, ne duplikáljuk (opcionális ellenőrzés)
        if (payload.new.user_id === user?.id) return;

        // Lekérjük a profilt hozzá
        const {data: newNote} = await supabase.from('case_notes').select('*, profile:user_id(full_name, avatar_url)').eq('id', payload.new.id).single();
        if (newNote) {
          setNotes(prev => [...prev, newNote as any]);
          scrollToBottom();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, supabase, user?.id]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const content = message;
    setMessage(""); // Törlés azonnal

    // 1. Optimista frissítés (hogy azonnal lásd)
    const tempNote: any = {
      id: `temp-${Date.now()}`,
      case_id: caseId,
      user_id: user!.id,
      content: content,
      created_at: new Date().toISOString(),
      profile: {
        full_name: profile?.full_name || "Én",
        avatar_url: profile?.avatar_url
      }
    };
    setNotes(prev => [...prev, tempNote]);
    scrollToBottom();

    // 2. Küldés
    const {error} = await supabase.from('case_notes').insert({
      case_id: caseId,
      user_id: user?.id,
      content: content
    });

    if (error) {
      console.error("Chat hiba:", error);
      // Hiba esetén kivehetnénk a temp note-ot, de most egyszerűsítünk
    }
  };

  return (
    <Card
      className="bg-slate-900/50 border-slate-800 backdrop-blur-sm flex flex-col h-full min-h-[400px] max-h-[600px]"> {/* Fix vagy max magasság */}
      <CardHeader className="pb-2 py-3 border-b border-slate-800/50 shrink-0">
        <CardTitle className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500"/> Üzenőfal / Jegyzetek
        </CardTitle>
      </CardHeader>

      {/* JAVÍTÁS: flex-1 és min-h-0 biztosítja, hogy ez a rész nyúljon/görögjön, de ne tolja szét a konténert */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-4">
            {notes.length === 0 && <p className="text-xs text-slate-600 text-center italic">Nincsenek üzenetek.</p>}
            {notes.map((note, index) => {
              const isMe = note.user_id === user?.id;
              return (
                <div key={note.id || index} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="w-8 h-8 border border-slate-700 shrink-0">
                    <AvatarImage src={note.profile?.avatar_url}/>
                    <AvatarFallback
                      className="text-[10px] bg-slate-800">{note.profile?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[85%] rounded-lg p-2 text-sm ${isMe ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                    <div className={`flex justify-between items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span
                        className={`text-[10px] font-bold ${isMe ? 'text-blue-300' : 'text-slate-400'}`}>{note.profile?.full_name}</span>
                      <span className="text-[9px] opacity-50">{formatDistanceToNow(new Date(note.created_at), {
                        locale: hu,
                        addSuffix: true
                      })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs break-words">{note.content}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="p-3 border-t border-slate-800/50 flex gap-2 shrink-0">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Írj egy üzenetet..."
          className="bg-slate-950 border-slate-800 h-9 text-sm focus-visible:ring-blue-500/50"
        />
        <Button size="icon" className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0" onClick={handleSend}>
          <Send className="w-4 h-4"/>
        </Button>
      </div>
    </Card>
  );
}