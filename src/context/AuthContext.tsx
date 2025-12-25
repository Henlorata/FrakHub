import React, {createContext, useContext, useEffect, useState, useRef} from 'react';
import {type Session, type User, SupabaseClient} from '@supabase/supabase-js';
import type {Database, Profile} from '../types/supabase';
import {supabase} from '../lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  supabase: SupabaseClient<Database>;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export function AuthProvider({children}: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileRef = useRef<Profile | null>(null);

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error("SignOut error:", error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      profileRef.current = null;
      setLoading(false);
      if (supabaseUrl) {
        try {
          const hostname = new URL(supabaseUrl).hostname.split('.')[0];
          localStorage.removeItem(`sb-${hostname}-auth-token`);
        } catch (e) {
          console.warn("Could not clear local storage token manually", e);
        }
      }
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') await signOut();
      } else {
        if (JSON.stringify(profileRef.current) !== JSON.stringify(data)) {
          setProfile(data);
          profileRef.current = data;
        }
      }
    } catch (error) {
      console.error('Kritikus profil hiba:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const {data: {session}} = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      }
    };

    initSession();

    const {data: {subscription}} = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      }
    });

    let profileSubscription: any = null;
    if (user?.id) {
      profileSubscription = supabase
        .channel(`public:profiles:id=eq.${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        }, (payload) => {
          setProfile(payload.new as Profile);
        })
        .subscribe();
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

  const value = {session, user, profile, supabase, loading, signOut};

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}