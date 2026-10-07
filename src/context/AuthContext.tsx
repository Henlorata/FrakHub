import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {Session, SupabaseClient, User} from "@supabase/supabase-js";
import {PROFILE_COLUMNS, type Profile} from "@/types/supabase";
import {onMfaRequired, supabase} from "@/lib/supabaseClient";
import {clearClientCaches} from "@/lib/cache";
import {clearStoredCaches, setCacheIdentity} from "@/lib/versioned-cache";
import {uniqueChannelName} from "@/lib/realtime";
import {rememberHasSignature} from "@/lib/signature/api";

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
  /** Signed in with the password, but the code of the member's authenticator app is still missing. */
  mfaRequired: boolean;
  /** The second step of the sign-in: checks the authenticator app's code (throws when wrong). */
  verifyMfa: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_FIELDS = PROFILE_COLUMNS.split(",").map((column) => column.trim());

/** The assurance level of an access token: "aal2" once the authenticator app's code was given. */
function tokenAssurance(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as {aal?: string}).aal ?? null;
  } catch {
    return null;
  }
}
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

  // Two-factor sign-in: a member with an authenticator app gives its code before the app opens (the
  // API refuses such a session anyway, see private.check_request). The API also reports it when the
  // app was set up on another device after this session began; that report holds for this session.
  const sessionKey = userId ? `${userId}:${tokenAssurance(session?.access_token) ?? "aal1"}` : null;
  const secondStepDone = tokenAssurance(session?.access_token) === "aal2";
  const hasFactor = !!session?.user.factors?.some((factor) => factor.status === "verified");
  const [mfaReportedFor, setMfaReportedFor] = useState<string | null>(null);
  const sessionKeyRef = useRef(sessionKey);
  useEffect(() => {
    sessionKeyRef.current = sessionKey;
  }, [sessionKey]);
  useEffect(() => onMfaRequired(() => setMfaReportedFor(sessionKeyRef.current)), []);
  const mfaRequired = sessionKey !== null && !secondStepDone && (hasFactor || mfaReportedFor === sessionKey);

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
        // The lists kept between visits belong to the member who signed out.
        clearStoredCaches();
        setCacheIdentity(null);
      } else if (event === "SIGNED_IN" && !profileLoadedRef.current) {
        // A fresh sign-in retries a profile load that failed before. Token refreshes and
        // tab re-focus (which also report SIGNED_IN) do not refetch a loaded profile.
        setProfileRequest((count) => count + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    // Whether the member has set a signature comes with the same read (the reminder needs no request of its own).
    const {data, error} = await supabase.from("profiles").select(`${PROFILE_COLUMNS}, signature:member_signatures(updated_at)`)
      .eq("id", id).maybeSingle();
    // The code screen takes over (the client's fetch reports it).
    if (error?.code === "MFA_REQUIRED") return;
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
    const {signature, ...row} = data as Record<string, unknown>;
    if (signature !== undefined) rememberHasSignature(id, Array.isArray(signature) ? signature.length > 0 : signature !== null);
    setProfile(row as unknown as Profile);
  }, []);

  // Profile: load once per signed-in user (after the second step, when the member uses one), then
  // keep it live through Realtime.
  useEffect(() => {
    if (!userId || mfaRequired) return;
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
  }, [userId, profileRequest, loadProfile, mfaRequired]);

  const signOut = useCallback(async () => {
    const {error} = await supabase.auth.signOut();
    // A failed network call leaves the local session in place; drop it locally anyway.
    if (error) await supabase.auth.signOut({scope: "local"});
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const verifyMfa = useCallback(async (code: string) => {
    // Read fresh: the factors stored with the session may be older than the last change.
    const {data, error} = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    const factor = data.totp.find((item) => item.status === "verified");
    if (!factor) {
      // Removed on another device in the meantime: a renewed session no longer asks for the code.
      const {error: refreshError} = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      setMfaReportedFor(null);
      return;
    }
    const {error: verifyError} = await supabase.auth.mfa.challengeAndVerify({factorId: factor.id, code});
    if (verifyError) throw verifyError;
    // The upgraded session arrives through onAuthStateChange; the profile loads after it.
  }, []);

  // The e-mail address comes from the session (profiles.email is not readable by others).
  const userEmail = session?.user.email;
  const currentProfile = useMemo(() => {
    const next = profile && profile.id === userId ? {...profile, email: userEmail ?? profile.email} : null;
    // Set while rendering (idempotent): the pages' effects run before this provider's, and their
    // first loads already need to know whose stored lists they may use.
    setCacheIdentity(next);
    return next;
  }, [profile, userId, userEmail]);
  const profileError = userId !== null && profileFailedFor === userId && !currentProfile;
  const loading = !sessionReady || (userId !== null && !mfaRequired && !currentProfile && !profileError);

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
      mfaRequired,
      verifyMfa,
    }),
    [session, currentProfile, loading, profileError, signOut, refreshProfile, mfaRequired, verifyMfa],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
