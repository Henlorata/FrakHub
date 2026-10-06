import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {Session, SupabaseClient, User} from "@supabase/supabase-js";
import {PROFILE_COLUMNS, type Profile} from "@/types/supabase";
import {supabase} from "@/lib/supabaseClient";
import {clearClientCaches} from "@/lib/cache";
import {uniqueChannelName} from "@/lib/realtime";

export type {Profile};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  supabase: SupabaseClient;
  /** True until the session is known and, when signed in, the profile has loaded. */
  loading: boolean;
  /** Signed in, but the profile could not be loaded (network or permission error). */
  profileError: boolean;
  signOut: () => Promise<void>;
  /** Re-reads the profile row (e.g. after an RPC changed it, or to retry after an error). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_FIELDS = PROFILE_COLUMNS.split(",").map((column) => column.trim());
const pickProfile = (row: Record<string, unknown>) =>
  Object.fromEntries(PROFILE_FIELDS.filter((field) => field in row).map((field) => [field, row[field]])) as Partial<Profile>;

export function AuthProvider({children}: {children: React.ReactNode}) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFailedFor, setProfileFailedFor] = useState<string | null>(null);
  const [profileRequest, setProfileRequest] = useState(0);
  const profileLoadedRef = useRef(false);

  const userId = session?.user.id ?? null;

  // Session: subscribe exactly once. Supabase emits INITIAL_SESSION right away with the
  // stored session, so no separate getSession() call is needed.
  useEffect(() => {
    const {data} = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Keep this callback synchronous: Supabase holds its auth lock while it runs, and
      // awaiting other Supabase calls here can deadlock. Data loading happens below.
      setSession(nextSession);
      setSessionReady(true);
      if (!nextSession) {
        profileLoadedRef.current = false;
        setProfile(null);
        clearClientCaches();
      } else if (event === "SIGNED_IN" && !profileLoadedRef.current) {
        // A fresh sign-in retries a profile load that failed before. Token refreshes and
        // tab re-focus (which also report SIGNED_IN) do not refetch a loaded profile.
        setProfileRequest((count) => count + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    const {data, error} = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
    if (error) {
      console.error("Profil betöltési hiba:", error);
      setProfileFailedFor(id);
      return;
    }
    if (!data) {
      // Auth account without a profile row (e.g. a dismissed member): sign it out.
      await supabase.auth.signOut({scope: "local"});
      return;
    }
    profileLoadedRef.current = true;
    setProfileFailedFor(null);
    setProfile(data as unknown as Profile);
  }, []);

  // Profile: load once per signed-in user, then keep it live through Realtime.
  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId);

    const channel = supabase
      .channel(uniqueChannelName(`profile:${userId}`))
      .on(
        "postgres_changes",
        {event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}`},
        // The Realtime payload carries every column: keep only the ones the client reads.
        (payload) => setProfile((current) => ({...current, ...pickProfile(payload.new)}) as Profile),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, profileRequest, loadProfile]);

  const signOut = useCallback(async () => {
    const {error} = await supabase.auth.signOut();
    // A failed network call leaves the local session in place; drop it locally anyway.
    if (error) await supabase.auth.signOut({scope: "local"});
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  // The e-mail address comes from the session (profiles.email is not readable by others).
  const userEmail = session?.user.email;
  const currentProfile = useMemo(
    () => (profile && profile.id === userId ? {...profile, email: userEmail ?? profile.email} : null),
    [profile, userId, userEmail],
  );
  const profileError = userId !== null && profileFailedFor === userId && !currentProfile;
  const loading = !sessionReady || (userId !== null && !currentProfile && !profileError);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: currentProfile,
      supabase,
      loading,
      profileError,
      signOut,
      refreshProfile,
    }),
    [session, currentProfile, loading, profileError, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
