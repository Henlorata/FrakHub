import * as React from "react";
import {useAuth} from "@/context/AuthContext";
import {Card, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {Send, MessageSquare, ShieldCheck} from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import {hu} from "date-fns/locale";
import type {CaseNote} from "@/types/supabase";

export function CaseChat({caseId}: { caseId: string }) {
  const {supabase, user, profile} = useAuth();
  const [notes, setNotes] = React.useState<CaseNote[]>([]);
  const [message, setMessage] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) scrollViewport.scrollTop = scrollViewport.scrollHeight;
    }, 100);
  }

  React.useEffect(() => {
    const fetchNotes = async () => {
      const {data} = await supabase
        .from('case_notes')
        .select('*, profile:user_id(full_name, avatar_url, faction_rank)')
        .eq('case_id', caseId)
        .order('created_at', {ascending: true});
      if (data) {
        setNotes(data as any);
        scrollToBottom();
      }
    };
    fetchNotes();

    const channel = supabase.channel(`case_chat_${caseId}`)
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'case_notes', filter: `case_id=eq.${caseId}`},
        async (payload) => {
          if (payload.new.user_id === user?.id) return;
          const {data: newNote} = await supabase.from('case_notes').select('*, profile:user_id(full_name, avatar_url, faction_rank)').eq('id', payload.new.id).single();
          if (newNote) {
            setNotes(prev => [...prev, newNote as any]);
            scrollToBottom();
          }
        }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, supabase, user?.id]);

  const handleSend = async () => {
    if (!message.trim()) return;
    const content = message;
    setMessage("");

    const tempNote: any = {
      id: `temp-${Date.now()}`,
      case_id: caseId, user_id: user!.id, content: content, created_at: new Date().toISOString(),
      profile: {
        full_name: profile?.full_name || "Én",
        avatar_url: profile?.avatar_url,
        faction_rank: profile?.faction_rank
      }
    };
    setNotes(prev => [...prev, tempNote]);
    scrollToBottom();

    await supabase.from('case_notes').insert({case_id: caseId, user_id: user?.id, content: content});
  };

  return (
    <Card
      className="bg-slate-950/80 border border-sky-900/30 backdrop-blur-md flex flex-col h-full min-h-[400px] shadow-lg overflow-hidden group">
      {/* Header */}
      <CardHeader
        className="py-3 px-4 border-b border-sky-500/10 bg-sky-900/5 shrink-0 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-sky-400 font-bold flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5"/> Secure Comms
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Encrypted</span>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <div
        className="flex-1 min-h-0 relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-repeat opacity-90">
        <div className="absolute inset-0 bg-slate-950/90"></div>
        {/* Darkener */}
        <ScrollArea className="h-full w-full relative z-10">
          <div className="p-4 space-y-4">
            {notes.length === 0 && <div
              className="flex items-center justify-center h-full pt-10 opacity-30 text-[10px] font-mono uppercase tracking-widest text-slate-500">No
              records found</div>}

            {notes.map((note, index) => {
              const isMe = note.user_id === user?.id;
              return (
                <div key={note.id || index} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group/msg`}>
                  <Avatar className="w-8 h-8 border border-slate-700 shrink-0 rounded-sm">
                    <AvatarImage src={note.profile?.avatar_url}/>
                    <AvatarFallback
                      className="text-[10px] bg-slate-900 font-mono rounded-sm">{note.profile?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>

                  <div className={`max-w-[85%] relative`}>
                    {/* Név és Rang */}
                    <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse text-right' : ''}`}>
                       <span
                         className={`text-[10px] font-bold uppercase tracking-wide ${isMe ? 'text-sky-400' : 'text-slate-400'}`}>
                          {note.profile?.full_name}
                       </span>
                      <span
                        className="text-[8px] font-mono text-slate-600 uppercase">{note.profile?.faction_rank}</span>
                    </div>

                    {/* Buborék */}
                    <div className={`relative p-2.5 text-xs leading-relaxed border shadow-sm ${
                      isMe
                        ? 'bg-sky-900/20 text-sky-100 border-sky-500/30 rounded-tl-lg rounded-bl-lg rounded-br-lg'
                        : 'bg-slate-900 text-slate-300 border-slate-800 rounded-tr-lg rounded-br-lg rounded-bl-lg'
                    }`}>
                      {/* Dekoratív sarok elem */}
                      <div
                        className={`absolute top-0 w-2 h-2 border-t border-current opacity-30 ${isMe ? 'right-0 border-r rounded-tr' : 'left-0 border-l rounded-tl'}`}></div>

                      <p className="whitespace-pre-wrap break-words font-mono text-[11px]">{note.content}</p>
                    </div>

                    {/* Időbélyeg */}
                    <div className={`text-[9px] text-slate-600 mt-1 font-mono ${isMe ? 'text-right' : ''}`}>
                      {formatDistanceToNow(new Date(note.created_at), {locale: hu, addSuffix: true})}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-2 border-t border-sky-500/10 bg-slate-900/50 backdrop-blur shrink-0 flex gap-2">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Üzenet küldése..."
          className="bg-slate-950 border-slate-800 h-9 text-xs font-mono focus-visible:ring-sky-500/30 pl-3"
        />
        <Button size="icon" className="h-9 w-9 bg-sky-600 hover:bg-sky-500 shrink-0 border border-sky-400/20"
                onClick={handleSend}>
          <Send className="w-3.5 h-3.5"/>
        </Button>
      </div>
    </Card>
  );
}