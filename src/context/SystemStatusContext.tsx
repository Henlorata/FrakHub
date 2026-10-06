import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";
import {useAuth} from "./AuthContext";
import {uniqueChannelName} from "@/lib/realtime";

export type AlertLevelId = "normal" | "traffic" | "border" | "tactical";

interface SystemStatusContextType {
  alertLevel: AlertLevelId;
  recruitmentOpen: boolean;
  setAlertLevel: (level: AlertLevelId) => Promise<void>;
  toggleRecruitment: () => Promise<void>;
  isLoading: boolean;
}

interface StatusRow {
  alert_level?: string | null;
  recruitment_open?: boolean | null;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

/**
 * Faction-wide broadcast state (single `system_status` row, id = 'global'):
 * alert level and recruitment open/closed. Read once for everyone (the registration
 * page needs it too); kept live through Realtime only for signed-in users, so
 * anonymous visitors do not hold a Realtime connection.
 */
export function SystemStatusProvider({children}: {children: React.ReactNode}) {
  const {supabase, user} = useAuth();
  const userId = user?.id ?? null;
  const [alertLevel, setAlertLevelState] = useState<AlertLevelId>("normal");
  const [recruitmentOpen, setRecruitmentOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const recruitmentRef = useRef(true);

  const applyRow = useCallback((row: StatusRow, announce: boolean) => {
    if (row.alert_level) setAlertLevelState(row.alert_level as AlertLevelId);
    if (typeof row.recruitment_open === "boolean") {
      if (announce && row.recruitment_open !== recruitmentRef.current) toast.info("Létszámstop státusz frissült!");
      recruitmentRef.current = row.recruitment_open;
      setRecruitmentOpen(row.recruitment_open);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase
      .from("system_status")
      .select("alert_level, recruitment_open")
      .eq("id", "global")
      .maybeSingle()
      .then(({data}) => {
        if (active && data) applyRow(data, false);
      })
      .then(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supabase, applyRow]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName("system_status"))
      .on(
        "postgres_changes",
        {event: "UPDATE", schema: "public", table: "system_status", filter: "id=eq.global"},
        (payload) => applyRow(payload.new as StatusRow, true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, applyRow]);

  const setAlertLevel = useCallback(
    async (level: AlertLevelId) => {
      if (!userId) return;
      const {data, error} = await supabase
        .from("system_status")
        .update({alert_level: level, updated_by: userId, updated_at: new Date().toISOString()})
        .eq("id", "global")
        .select("id");
      if (error || !data?.length) toast.error("Hiba a státusz módosításakor");
      else setAlertLevelState(level);
    },
    [supabase, userId],
  );

  const toggleRecruitment = useCallback(async () => {
    if (!userId) return;
    const next = !recruitmentRef.current;
    const {data, error} = await supabase
      .from("system_status")
      .update({recruitment_open: next, updated_by: userId, updated_at: new Date().toISOString()})
      .eq("id", "global")
      .select("id");
    if (error || !data?.length) {
      console.error(error);
      toast.error("Hiba a létszámstop módosításakor.");
      return;
    }
    recruitmentRef.current = next;
    setRecruitmentOpen(next);
    toast.success(next ? "Tagfelvétel megnyitva!" : "Létszámstop aktiválva!");
  }, [supabase, userId]);

  const value = useMemo(
    () => ({alertLevel, recruitmentOpen, setAlertLevel, toggleRecruitment, isLoading}),
    [alertLevel, recruitmentOpen, setAlertLevel, toggleRecruitment, isLoading],
  );

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>;
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (context === undefined) throw new Error("useSystemStatus must be used within a SystemStatusProvider");
  return context;
}
