import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {useAuth} from './AuthContext';
import type {Suspect} from '@/types/supabase';
import {toast} from 'sonner';
import {SuspectDetailDialog} from '@/pages/mcb/components/SuspectDetailDialog';
import {OfficerProfileDialog} from '@/components/OfficerProfileDialog';

interface SuspectCacheContextType {
  suspects: Suspect[];
  caseMap: Record<string, string[]>;
  cases: Record<string, string>;
  creators: Record<string, string>;
  loading: boolean;
  refreshSuspects: (force?: boolean) => Promise<void>;
  deleteSuspectFromCache: (id: string) => void;
  openSuspectId: (id: string) => void;
  openOfficerId: (id: string) => void;
}

const SuspectCacheContext = createContext<SuspectCacheContextType | undefined>(undefined);

export function SuspectCacheProvider({children}: { children: React.ReactNode }) {
  const {supabase} = useAuth();
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [caseMap, setCaseMap] = useState<Record<string, string[]>>({});
  const [cases, setCases] = useState<Record<string, string>>({});
  const [creators, setCreators] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const [activeOfficerId, setActiveOfficerId] = useState<string | null>(null);
  const [activeOfficer, setActiveOfficer] = useState<any | null>(null);

  const [activeSuspectId, setActiveSuspectId] = useState<string | null>(null);
  const activeSuspect = suspects.find(s => s.id === activeSuspectId) || null;

  const refreshSuspects = useCallback(async (force = false) => {
    // 5 perc cache
    if (!force && Date.now() - lastFetch < 1000 * 60 * 5 && suspects.length > 0) {
      return;
    }

    setLoading(true);
    try {
      const {
        data: sData,
        error: sError
      } = await supabase.from('suspects').select('*').order('created_at', {ascending: false});
      if (sError) throw sError;

      const {data: cData} = await supabase.from('case_suspects').select('suspect_id, case_id, cases!inner(id, title, case_number)');

      const {data: pData} = await supabase.from('profiles').select('id, full_name');

      const newCaseMap: Record<string, string[]> = {};
      const newCases: Record<string, string> = {};
      const newCreators: Record<string, string> = {};

      cData?.forEach((link: any) => {
        if (!link.cases) return;

        if (!newCaseMap[link.suspect_id]) newCaseMap[link.suspect_id] = [];
        newCaseMap[link.suspect_id].push(link.case_id);
        newCases[link.case_id] = `#${link.cases.case_number} ${link.cases.title}`;
      });

      pData?.forEach((p: any) => {
        newCreators[p.id] = p.full_name;
      });

      setSuspects(sData || []);
      setCaseMap(newCaseMap);
      setCases(newCases);
      setCreators(newCreators);
      setLastFetch(Date.now());

    } catch (err) {
      console.error(err);
      toast.error("Adatszinkronizációs hiba.");
    } finally {
      setLoading(false);
    }
  }, [supabase, lastFetch, suspects.length]);

  const openOfficerId = async (id: string) => {
    setActiveOfficerId(id);
    const {data} = await supabase.from('profiles').select('*').eq('id', id).single();
    if (data) setActiveOfficer(data);
  };

  useEffect(() => {
    refreshSuspects();
  }, [refreshSuspects]);

  useEffect(() => {
    const handleOpenSuspect = (event: CustomEvent) => {
      if (event.detail?.id) openSuspectId(event.detail.id);
    };
    const handleOpenOfficer = (event: CustomEvent) => {
      if (event.detail?.id) openOfficerId(event.detail.id);
    };

    window.addEventListener('FRAKHUB_OPEN_SUSPECT', handleOpenSuspect as EventListener);
    window.addEventListener('FRAKHUB_OPEN_OFFICER', handleOpenOfficer as EventListener); // ÚJ LISTENER

    return () => {
      window.removeEventListener('FRAKHUB_OPEN_SUSPECT', handleOpenSuspect as EventListener);
      window.removeEventListener('FRAKHUB_OPEN_OFFICER', handleOpenOfficer as EventListener);
    }
  }, []);

  const deleteSuspectFromCache = (id: string) => {
    setSuspects(prev => prev.filter(s => s.id !== id));
  };

  const openSuspectId = (id: string) => {
    setActiveSuspectId(id);
  };

  return (
    <SuspectCacheContext.Provider
      value={{
        suspects,
        caseMap,
        cases,
        creators,
        loading,
        refreshSuspects,
        deleteSuspectFromCache,
        openSuspectId,
        openOfficerId
      }}>
      {children}

      {/* GLOBÁLIS DIALOG */}
      <SuspectDetailDialog
        open={!!activeSuspect}
        onOpenChange={(o) => !o && setActiveSuspectId(null)}
        suspect={activeSuspect}
        onUpdate={() => refreshSuspects(true)}
      />

      <OfficerProfileDialog
        open={!!activeOfficerId}
        onOpenChange={(o) => {
          if (!o) {
            setActiveOfficerId(null);
            setActiveOfficer(null);
          }
        }}
        officer={activeOfficer}
      />
    </SuspectCacheContext.Provider>
  );
}

export function useSuspects() {
  const context = useContext(SuspectCacheContext);
  if (context === undefined) throw new Error('useSuspects must be used within a SuspectCacheProvider');
  return context;
}