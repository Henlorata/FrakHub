import React, {createContext, useContext, useEffect, useState} from 'react';
import {useAuth} from './AuthContext';
import {toast} from 'sonner';

export type AlertLevelId = 'normal' | 'traffic' | 'border' | 'tactical';

interface SystemStatusContextType {
  alertLevel: AlertLevelId;
  recruitmentOpen: boolean;
  setAlertLevel: (level: AlertLevelId) => Promise<void>;
  toggleRecruitment: () => Promise<void>;
  isLoading: boolean;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

export function SystemStatusProvider({children}: { children: React.ReactNode }) {
  const {supabase, user} = useAuth();
  const [alertLevel, setAlertLevelState] = useState<AlertLevelId>('normal');
  const [recruitmentOpen, setRecruitmentOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const {data} = await supabase
          .from('system_status')
          .select('*')
          .eq('id', 'global')
          .single();

        if (data) {
          setAlertLevelState(data.alert_level as AlertLevelId);
          setRecruitmentOpen(data.recruitment_open ?? true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    const channel = supabase
      .channel('system_status_changes')
      .on(
        'postgres_changes',
        {event: 'UPDATE', schema: 'public', table: 'system_status', filter: 'id=eq.global'},
        (payload) => {
          if (payload.new.alert_level) setAlertLevelState(payload.new.alert_level as AlertLevelId);
          if (Object.prototype.hasOwnProperty.call(payload.new, 'recruitment_open')) {
            setRecruitmentOpen(payload.new.recruitment_open);
            toast.info(`Létszámstop státusz frissült!`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const setAlertLevel = async (level: AlertLevelId) => {
    if (!user) return;
    const {error} = await supabase.from('system_status').upsert({
      id: 'global',
      alert_level: level,
      recruitment_open: recruitmentOpen,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    });
    if (error) toast.error("Hiba a státusz módosításakor");
    else setAlertLevelState(level);
  };

  const toggleRecruitment = async () => {
    if (!user) return;
    const newState = !recruitmentOpen;

    try {
      const {error} = await supabase.from('system_status').upsert({
        id: 'global',
        alert_level: alertLevel,
        recruitment_open: newState,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      setRecruitmentOpen(newState);
      toast.success(newState ? "Tagfelvétel megnyitva!" : "Létszámstop aktiválva!");
    } catch (error: any) {
      console.error(error);
      if (error.code === '42703') { // Undefined column
        toast.error("Adatbázis hiba: Hiányzik a 'recruitment_open' oszlop a system_status táblából!");
      } else {
        toast.error("Hiba a létszámstop módosításakor.");
      }
    }
  };

  return (
    <SystemStatusContext.Provider value={{alertLevel, setAlertLevel, recruitmentOpen, toggleRecruitment, isLoading}}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (context === undefined) throw new Error('useSystemStatus must be used within a SystemStatusProvider');
  return context;
}