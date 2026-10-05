import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {RealtimeChannel} from "@supabase/supabase-js";
import {supabase} from "@/lib/supabaseClient";

export interface CasePeer {
  id: string;
  name: string;
  avatar: string | null;
  /** Has unsaved changes in the document. */
  editing: boolean;
}

export interface CaseNoteRow {
  id: string;
  case_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export type CaseChange = "evidence" | "people" | "team" | "meta";

interface RoomHandlers {
  /** Someone else saved the document. */
  onSaved?: (payload: {version: number; by: string}) => void;
  /** Someone else changed a list or the case data. */
  onChanged?: (what: CaseChange) => void;
  onNote?: (note: CaseNoteRow) => void;
  onWarrants?: () => void;
}

/**
 * One Realtime channel per open case: who is in the case (presence), what others saved or
 * changed (broadcast, no database traffic), new chat messages and warrant changes.
 * The topic is shared by everyone on the case, so a remount first waits for the previous
 * channel of the same topic to leave (supabase-js would hand back the leaving instance).
 */
export function useCaseRoom(caseId: string, me: Omit<CasePeer, "editing"> | null, handlers: RoomHandlers) {
  const [peers, setPeers] = useState<CasePeer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef(handlers);
  const editingRef = useRef(false);
  const meRef = useRef(me);

  useEffect(() => {
    handlersRef.current = handlers;
    meRef.current = me;
  });

  const myId = me?.id;
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const topic = `mcb-case:${caseId}`;

    (async () => {
      const stale = supabase.getChannels().find((item) => item.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;
      channel = supabase.channel(topic, {config: {presence: {key: myId}, broadcast: {self: false}}});
      const current = channel;
      current
        .on("presence", {event: "sync"}, () => {
          const state = current.presenceState<CasePeer>();
          const list = Object.values(state).map((entries) => entries[entries.length - 1])
            .filter((peer): peer is CasePeer & {presence_ref: string} => !!peer && peer.id !== myId);
          setPeers(list.map(({id, name, avatar, editing}) => ({id, name, avatar, editing})));
        })
        .on("broadcast", {event: "saved"}, ({payload}) => handlersRef.current.onSaved?.(payload as {version: number; by: string}))
        .on("broadcast", {event: "changed"}, ({payload}) => handlersRef.current.onChanged?.((payload as {what: CaseChange}).what))
        .on("postgres_changes", {event: "INSERT", schema: "public", table: "case_notes", filter: `case_id=eq.${caseId}`},
          (payload) => handlersRef.current.onNote?.(payload.new as CaseNoteRow))
        .on("postgres_changes", {event: "*", schema: "public", table: "case_warrants", filter: `case_id=eq.${caseId}`},
          () => handlersRef.current.onWarrants?.())
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && meRef.current) {
            void current.track({...meRef.current, editing: editingRef.current});
          }
        });
      channelRef.current = current;
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [caseId, myId]);

  const broadcastSaved = useCallback((version: number, by: string) => {
    void channelRef.current?.send({type: "broadcast", event: "saved", payload: {version, by}});
  }, []);

  const broadcastChange = useCallback((what: CaseChange) => {
    void channelRef.current?.send({type: "broadcast", event: "changed", payload: {what}});
  }, []);

  const setEditing = useCallback((editing: boolean) => {
    if (editingRef.current === editing) return;
    editingRef.current = editing;
    if (meRef.current) void channelRef.current?.track({...meRef.current, editing});
  }, []);

  return useMemo(() => ({peers, broadcastSaved, broadcastChange, setEditing}), [peers, broadcastSaved, broadcastChange, setEditing]);
}
