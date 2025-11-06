import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuthSession } from "@supabase/supabase-js";
import type { Profile } from "@/types/supabase";

interface AuthContextType {
  session: AuthSession | null;
  profile: Profile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  supabase: typeof supabase;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);

  // Segédfüggvény a profil lekéréséhez
  const getProfile = async (session: AuthSession): Promise<Profile | null> => {
    try {
      const { data: userProfile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error || !userProfile) {
        throw new Error(error?.message || "Profil nem található.");
      }
      return userProfile;

    } catch (error) {
      console.error("AuthContext Hiba (getProfile):", (error as Error).message);
      await supabase.auth.signOut();
      return null;
    }
  };


  React.useEffect(() => {
    setAuthLoading(true);

    // 1. LÉPÉS: Kezdeti munkamenet ellenőrzése
    const fetchInitialSession = async () => {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Hiba a kezdeti session lekérésekor:", error.message);
      }

      if (initialSession) {
        const userProfile = await getProfile(initialSession);
        setSession(initialSession);
        setProfile(userProfile);
      }
      setAuthLoading(false);
    };

    fetchInitialSession();

    // 2. LÉPÉS: Figyelő beállítása a VÁLTOZÁSOKRA
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {

        // --- A VÉGLEGES JAVÍTÁS ITT VAN ---

        // Használjuk a setSession funkcionális frissítését,
        // hogy megkapjuk a 'currentSession'-t anélkül,
        // hogy a 'session'-t a useEffect függőségeihez adnánk.
        setSession(currentSession => {

          // 1. ESET: KIJELENTKEZÉS
          // Ha nincs új session, kijelentkeztünk.
          if (!newSession) {
            setProfile(null);
            return null;
          }

          // 2. ESET: FÜL-VÁLTÁS (TAB-SWITCH)
          // Ha az új session ID-ja MEGEGYEZIK a jelenlegi session ID-jával,
          // az azt jelenti, hogy ez csak egy háttér-frissítés (pl. fül-váltás).
          // Ilyenkor csendben frissítjük a sessiont, de
          // NEM indítunk globális töltést és NEM kérjük le újra a profilt.
          if (currentSession && currentSession.user.id === newSession.user.id) {
            return newSession; // Csendes frissítés
          }

          // 3. ESET: VALÓDI ÚJ BEJELENTKEZÉS
          // Ha a session ID más (vagy eddig nem volt session),
          // akkor ez egy valódi bejelentkezés.
          // Indítjuk a globális töltést és lekérjük a profilt.
          setAuthLoading(true);
          getProfile(newSession).then((userProfile) => {
            if (userProfile) {
              setProfile(userProfile);
              setAuthLoading(false);
            } else {
              // Ha a profil lekérése hibára futott, a getProfile()
              // már kijelentkeztetett minket, így null-t kapunk.
              setProfile(null);
              setAuthLoading(false);
            }
          });

          return newSession;
        });
      }
    );

    // Takarítás
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); // Az üres dependency array itt helyes

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    session,
    profile,
    isLoading: authLoading,
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