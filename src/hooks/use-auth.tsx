import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been read — avoids flashing the login screen. */
  loading: boolean;
  /**
   * Set when the user arrived from a "forgot password" mail. Supabase signs
   * them in with a short-lived recovery session; until they choose a new
   * password the app shows nothing else.
   */
  recovering: boolean;
  finishRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    // Subscribe first, then read the stored session, so an event that fires
    // during start-up is never missed.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });

    supabase.auth.getSession().then(({ data: { session: stored } }) => {
      setSession(stored);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const finishRecovery = useCallback(() => setRecovering(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, recovering, finishRecovery }),
    [session, loading, recovering, finishRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------

/** Where Supabase should send the user back to after a mail link. */
function redirectTo(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Supabase reports auth failures in English; these are the ones users hit. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "אימייל או סיסמה שגויים";
  if (m.includes("email not confirmed")) return "המייל עדיין לא אומת. בדקו את תיבת הדואר.";
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "כתובת המייל הזו כבר רשומה";
  }
  if (m.includes("password should be at least")) return "הסיסמה חייבת להכיל לפחות 6 תווים";
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "כתובת המייל אינה תקינה";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.";
  }
  if (m.includes("same as the old password") || m.includes("should be different")) {
    return "הסיסמה החדשה זהה לנוכחית";
  }
  return message;
}

async function run(action: Promise<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await action;
  if (error) throw new Error(translateAuthError(error.message));
}

export function signIn(email: string, password: string): Promise<void> {
  return run(supabase.auth.signInWithPassword({ email: email.trim(), password }));
}

export function signUp(email: string, password: string, displayName: string): Promise<void> {
  return run(
    supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: redirectTo(),
      },
    }),
  );
}

export function signOut(): Promise<void> {
  return run(supabase.auth.signOut());
}

export function sendPasswordReset(email: string): Promise<void> {
  return run(
    supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() }),
  );
}

export function updatePassword(password: string): Promise<void> {
  return run(supabase.auth.updateUser({ password }));
}

/**
 * Confirms the current password before letting the user change it. Supabase's
 * updateUser does not ask for the old password, and this screen should.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("הסיסמה הנוכחית שגויה");
}
