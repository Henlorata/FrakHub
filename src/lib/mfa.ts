import type {Session} from "@supabase/supabase-js";
import {supabase} from "./supabaseClient";

/**
 * Two-factor sign-in with an authenticator app (TOTP, Supabase Auth). Optional per member; once set
 * up, the API refuses sessions without the code (private.check_request, requireCaller in api/).
 */

export interface MfaSetup {
  factorId: string;
  /** The QR code as an image source. */
  qrCode: string;
  /** The same key for typing it in by hand. */
  secret: string;
}

/** The member's working authenticator, read from the session (no request). */
export function verifiedFactor(session: Session | null) {
  return session?.user.factors?.find((factor) => factor.factor_type === "totp" && factor.status === "verified") ?? null;
}

/** The secret in groups of four, easier to type in by hand. */
export const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/** Hungarian messages for the authenticator steps. */
export function mfaErrorMessage(error: unknown, fallback: string): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as {code?: unknown}).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "mfa_verification_failed" || /invalid totp|verification failed/i.test(message)) {
    return "Hibás kód. Nézd meg újra az alkalmazásban: a kód 30 másodpercenként változik.";
  }
  if (code === "mfa_challenge_expired" || /challenge.*expired/i.test(message)) return "A kód lejárt. Írd be az alkalmazásban most látható kódot.";
  if (code === "over_request_rate_limit" || /rate limit|too many/i.test(message)) return "Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.";
  if (/enroll.*(disabled|not enabled)|totp_enroll_not_enabled/i.test(`${code} ${message}`)) {
    return "A kétlépcsős azonosítás most nem kapcsolható be. Szólj a vezetőségnek.";
  }
  if (code === "insufficient_aal") return "Ehhez előbb lépj be újra a hitelesítő kóddal.";
  if (/fetch|network/i.test(message)) return "Nem sikerült kapcsolódni a szerverhez. Ellenőrizd az internetkapcsolatot.";
  return fallback;
}

export const mfaApi = {
  /** Starts a setup: removes unfinished earlier ones, then a new key. */
  async start(): Promise<MfaSetup> {
    const {data: factors, error: listError} = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    for (const factor of factors.all.filter((item) => item.status === "unverified")) {
      await supabase.auth.mfa.unenroll({factorId: factor.id});
    }
    // The name must be unique per member and is shown nowhere (the app lists "SFSD Intranet" and
    // the email address); a suffix keeps two quick setups from colliding.
    const {data, error} = await supabase.auth.mfa.enroll({
      factorType: "totp", issuer: "SFSD Intranet", friendlyName: `Hitelesítő ${Date.now().toString(36)}`,
    });
    if (error) throw error;
    // Supabase hands out the SVG as a plain-text data URI; encode it, a "#" in it would cut it short.
    const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, "");
    return {factorId: data.id, qrCode: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, secret: data.totp.secret};
  },

  /** Finishes the setup with the app's first code; the session then counts as two-step (aal2). */
  async confirm(factorId: string, code: string) {
    const {error} = await supabase.auth.mfa.challengeAndVerify({factorId, code});
    if (error) throw error;
  },

  /** Drops an unfinished setup (the dialog was closed). */
  async abandon(factorId: string) {
    await supabase.auth.mfa.unenroll({factorId});
  },

  /** Switches it off; the renewed session no longer carries the factor. */
  async disable(factorId: string) {
    const {error} = await supabase.auth.mfa.unenroll({factorId});
    if (error) throw error;
    await supabase.auth.refreshSession();
  },
};
