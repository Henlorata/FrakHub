import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuthSession, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/supabase";

interface AuthContextType {
  session: AuthSession | null;
  profile: Profile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  supabase: typeof supabase; // Hozzáadva
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchProfile = async (user: User) => {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(userProfile);
    return userProfile;
  };

  React.useEffect(() => {
    setIsLoading(true);

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        await fetchProfile(session.user);
      }
      setIsLoading(false);
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setIsLoading(true);
        if (newSession) {
          await fetchProfile(newSession.user);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    profile,
    isLoading,
    logout,
    supabase: supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth kötelezően egy AuthProvider-en belül kell legyen");
  }
  return context;
}