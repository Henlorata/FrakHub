import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import {toast} from "sonner";
import {useAuth} from "./AuthContext";
import type {Suspect} from "@/types/supabase";
import {SuspectDetailDialog} from "@/pages/mcb/components/SuspectDetailDialog";
import {getProfileDirectory} from "@/lib/profile-directory";
import {supabase as client} from "@/lib/supabaseClient";
import {createVersionedLoader} from "@/lib/versioned-cache";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** List columns: the personal description is only loaded with a person's file. */
const SUSPECT_COLUMNS = "id, full_name, alias, gender, gang_affiliation, status, mugshot_url, created_by, created_at, updated_at";

interface SuspectData {
  suspects: Suspect[];
  /** suspect id -> ids of the cases the suspect appears in */
  caseMap: Record<string, string[]>;
  /** case id -> "#number title" */
  cases: Record<string, string>;
  /** creator user id -> name (only members who created suspects) */
  creators: Record<string, string>;
}

interface SuspectCacheContextType extends SuspectData {
  loading: boolean;
  refreshSuspects: (force?: boolean) => Promise<void>;
  deleteSuspectFromCache: (id: string) => void;
  /** Opens a person's file (dialog over any MCB page). */
  openSuspectId: (id: string) => void;
  /** The person whose file is open, if any. */
  activeSuspectId: string | null;
  closeSuspect: () => void;
}

interface CaseLinkRow {
  suspect_id: string;
  case_id: string;
  cases: {id: string; title: string; case_number: number | string} | null;
}

const EMPTY: SuspectData = {suspects: [], caseMap: {}, cases: {}, creators: {}};

/** The list with the case links and creators; kept between visits until a person or link changes. */
const suspectList = createVersionedLoader("suspects", ["suspects", "profiles"], async (): Promise<SuspectData> => {
  const [suspectResult, linkResult] = await Promise.all([
    client.from("suspects").select(SUSPECT_COLUMNS).order("created_at", {ascending: false}),
    client.from("case_suspects").select("suspect_id, case_id, cases!inner(id, title, case_number)"),
  ]);
  if (suspectResult.error) throw suspectResult.error;
  if (linkResult.error) throw linkResult.error;

  const suspects = ((suspectResult.data ?? []) as Omit<Suspect, "description">[]).map((row) => ({...row, description: null}));
  const caseMap: Record<string, string[]> = {};
  const cases: Record<string, string> = {};
  for (const link of (linkResult.data ?? []) as unknown as CaseLinkRow[]) {
    if (!link.cases) continue;
    (caseMap[link.suspect_id] ??= []).push(link.case_id);
    cases[link.case_id] = `${link.cases.case_number} · ${link.cases.title}`;
  }

  const creatorIds = new Set(suspects.map((suspect) => suspect.created_by).filter(Boolean));
  const creators: Record<string, string> = {};
  for (const member of await getProfileDirectory()) {
    if (creatorIds.has(member.id)) creators[member.id] = member.full_name;
  }
  return {suspects, caseMap, cases, creators};
});

const SuspectCacheContext = createContext<SuspectCacheContextType | undefined>(undefined);

/**
 * Suspect database cache for the MCB area. Mounted by McbLayout, so members who never
 * open the investigative pages never download the suspect list.
 */
export function SuspectCacheProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<SuspectData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [activeSuspectId, setActiveSuspectId] = useState<string | null>(null);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refreshSuspects = useCallback(
    async (force = false) => {
      if (!userId) return;
      if (!force && lastFetchRef.current && Date.now() - lastFetchRef.current < CACHE_TTL_MS) return;
      if (inFlightRef.current) return inFlightRef.current;

      const run = async () => {
        setLoading(true);
        try {
          setData(await suspectList.get(force));
          lastFetchRef.current = Date.now();
        } catch (error) {
          console.error(error);
          toast.error("A nyilvántartás betöltése nem sikerült.");
        } finally {
          setLoading(false);
        }
      };

      inFlightRef.current = run().finally(() => {
        inFlightRef.current = null;
      });
      return inFlightRef.current;
    },
    [userId],
  );

  useEffect(() => {
    void refreshSuspects();
  }, [refreshSuspects]);

  const deleteSuspectFromCache = useCallback((id: string) => {
    suspectList.invalidate();
    setData((prev) => ({...prev, suspects: prev.suspects.filter((suspect) => suspect.id !== id)}));
  }, []);

  const openSuspectId = useCallback((id: string) => setActiveSuspectId(id), []);
  const closeSuspect = useCallback(() => setActiveSuspectId(null), []);

  const value = useMemo(
    () => ({...data, loading, refreshSuspects, deleteSuspectFromCache, openSuspectId, activeSuspectId, closeSuspect}),
    [data, loading, refreshSuspects, deleteSuspectFromCache, openSuspectId, activeSuspectId, closeSuspect],
  );

  const onDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setActiveSuspectId(null);
  }, []);
  const onChanged = useCallback(() => void refreshSuspects(true), [refreshSuspects]);

  return (
    <SuspectCacheContext.Provider value={value}>
      {children}
      <SuspectDetailDialog suspectId={activeSuspectId} onOpenChange={onDialogOpenChange} onChanged={onChanged}
                           people={data.suspects} onOpenPerson={openSuspectId}/>
    </SuspectCacheContext.Provider>
  );
}

export function useSuspects() {
  const context = useContext(SuspectCacheContext);
  if (context === undefined) throw new Error("useSuspects must be used within a SuspectCacheProvider");
  return context;
}
