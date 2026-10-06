import {useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent} from "react";
import {Loader2, Lock, MessageSquare, Send, Trash2} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {EmptyState} from "@/components/layout/EmptyState";
import {useAuth} from "@/context/AuthContext";
import {useProfileDirectory} from "@/lib/profile-directory";
import {formatLongDate, formatTime, todayKey} from "@/lib/datetime";
import {cn, errorMessage, isStaff} from "@/lib/utils";
import type {CaseNoteRow} from "../useCaseRoom";
import {MemberAvatar} from "./McbBadges";

/** Only the most recent messages are loaded; very old chatter is rarely needed. */
const NOTE_LIMIT = 200;

interface CaseChatProps {
  caseId: string;
  /** Members who may open the case may write while it is open. */
  canWrite: boolean;
  /** The latest message from Realtime (the page owns the channel). */
  liveNote: CaseNoteRow | null;
}

export function CaseChat({caseId, canWrite, liveNote}: CaseChatProps) {
  const {supabase, profile} = useAuth();
  const {profiles} = useProfileDirectory();
  const members = useMemo(() => new Map(profiles.map((member) => [member.id, member])), [profiles]);
  const [notes, setNotes] = useState<CaseNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const staff = isStaff(profile);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollTo({top: listRef.current.scrollHeight}));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.from("case_notes").select("id, case_id, user_id, content, created_at").eq("case_id", caseId)
      .order("created_at", {ascending: false}).limit(NOTE_LIMIT)
      .then(({data, error}) => {
        if (!active) return;
        if (error) toast.error("Az üzenetek betöltése nem sikerült.");
        setNotes(((data ?? []) as CaseNoteRow[]).reverse());
        setLoading(false);
        scrollToEnd();
      });
    return () => {
      active = false;
    };
  }, [caseId, scrollToEnd, supabase]);

  useEffect(() => {
    if (!liveNote || liveNote.case_id !== caseId) return;
    setNotes((list) => (list.some((note) => note.id === liveNote.id) ? list : [...list, liveNote]));
    scrollToEnd();
  }, [caseId, liveNote, scrollToEnd]);

  const send = async () => {
    const content = message.trim();
    if (!content || !profile || sending) return;
    if (content.length > 2000) return toast.error("Egy üzenet legfeljebb 2000 karakter lehet.");
    setSending(true);
    const temp: CaseNoteRow = {id: `temp-${Date.now()}`, case_id: caseId, user_id: profile.id, content, created_at: new Date().toISOString()};
    setNotes((list) => [...list, temp]);
    setMessage("");
    scrollToEnd();
    const {data, error} = await supabase.from("case_notes").insert({case_id: caseId, user_id: profile.id, content})
      .select("id, case_id, user_id, content, created_at").single();
    setSending(false);
    if (error) {
      setNotes((list) => list.filter((note) => note.id !== temp.id));
      setMessage(content);
      toast.error("Az üzenet elküldése nem sikerült.", {description: errorMessage(error)});
      return;
    }
    const saved = data as CaseNoteRow;
    setNotes((list) => {
      const rest = list.filter((note) => note.id !== temp.id);
      return rest.some((note) => note.id === saved.id) ? rest : [...rest, saved];
    });
  };

  const remove = async (note: CaseNoteRow) => {
    const {error} = await supabase.from("case_notes").delete().eq("id", note.id);
    if (error) return void toast.error("Az üzenet törlése nem sikerült.");
    setNotes((list) => list.filter((item) => item.id !== note.id));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const today = todayKey();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-slate-500"/></div>
        ) : notes.length === 0 ? (
          <EmptyState compact icon={MessageSquare} title="Még nincs üzenet"
                      description="Az akta csapatának belső csatornája: egyeztetés, feladatok, gyors jegyzetek."/>
        ) : (
          <ol className="space-y-1">
            {notes.map((note, index) => {
              const previous = notes[index - 1];
              const day = todayKey(note.created_at);
              const newDay = !previous || todayKey(previous.created_at) !== day;
              const grouped = !newDay && previous?.user_id === note.user_id
                && Date.parse(note.created_at) - Date.parse(previous.created_at) < 5 * 60_000;
              const mine = note.user_id === profile?.id;
              const author = members.get(note.user_id);
              const pendingSend = note.id.startsWith("temp-");
              return (
                <li key={note.id}>
                  {newDay && (
                    <div className="my-3 flex items-center gap-2 text-[10px] tracking-wider text-slate-500 uppercase">
                      <span className="h-px flex-1 bg-white/10"/>{day === today ? "Ma" : formatLongDate(note.created_at)}<span className="h-px flex-1 bg-white/10"/>
                    </div>
                  )}
                  <div className={cn("group flex gap-2", mine && "flex-row-reverse", grouped ? "mt-0.5" : "mt-2.5")}>
                    <div className="w-7 shrink-0">
                      {!grouped && <MemberAvatar url={author?.avatar_url} name={author?.full_name} size={28}/>}
                    </div>
                    <div className={cn("flex max-w-[82%] min-w-0 flex-col", mine && "items-end")}>
                      {!grouped && (
                        <p className={cn("mb-0.5 flex items-baseline gap-1.5 text-[11px]", mine && "flex-row-reverse")}>
                          <span className={cn("font-semibold", mine ? "text-sky-300" : "text-slate-200")}>{author?.full_name ?? "Ismeretlen"}</span>
                          <span className="text-slate-500">{formatTime(note.created_at)}</span>
                        </p>
                      )}
                      <div className={cn("relative rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap wrap-anywhere",
                        mine ? "rounded-tr-md bg-sky-500/15 text-sky-50 ring-1 ring-sky-500/25" : "rounded-tl-md bg-white/[0.05] text-slate-200 ring-1 ring-white/10",
                        pendingSend && "opacity-60")}>
                        {note.content}
                      </div>
                    </div>
                    {(mine || staff) && !pendingSend && (
                      <button type="button" onClick={() => void remove(note)} title="Üzenet törlése"
                              className="self-center rounded-md p-1 text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300">
                        <Trash2 className="size-3.5"/>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="shrink-0 border-t border-white/10 p-2">
        {canWrite ? (
          <div className="flex items-end gap-2">
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={onKeyDown} rows={1}
                      placeholder="Üzenet a csapatnak… (Enter: küldés, Shift+Enter: új sor)"
                      className="max-h-32 min-h-10 resize-none text-sm"/>
            <Button size="icon" onClick={() => void send()} disabled={!message.trim() || sending} aria-label="Küldés"
                    className="size-10 shrink-0 bg-sky-600 text-white hover:bg-sky-500">
              <Send className="size-4"/>
            </Button>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500"><Lock className="size-3.5"/> Az akta lezárva: a csatorna csak olvasható.</p>
        )}
      </div>
    </div>
  );
}
