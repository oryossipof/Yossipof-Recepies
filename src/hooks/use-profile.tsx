import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { useAuth } from "./use-auth";

export type Profile = Database["public"]["Tables"]["recipe_profiles"]["Row"];

type ProfileChanges = {
  display_name?: string;
  avatar_url?: string | null;
  shopping_phone?: string | null;
  shopping_list_id?: string | null;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  /**
   * The changes a person can make to their own profile: their name, their
   * picture, the phone number that links them to the shopping-list app, and
   * the list they last sent ingredients to.
   */
  save: (changes: ProfileChanges) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from("recipe_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setProfile(data);
      } else {
        // The signup trigger normally creates this row; a user created before
        // the trigger existed (or by an admin) gets one on first sign-in.
        const { data: created } = await supabase
          .from("recipe_profiles")
          .insert({
            id: userId,
            display_name: user?.email?.split("@")[0] ?? null,
            avatar_url: null,
          })
          .select("*")
          .maybeSingle();
        if (!cancelled) setProfile(created ?? null);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user?.email]);

  const save = useCallback(
    async (changes: ProfileChanges) => {
      if (!userId) throw new Error("צריך להתחבר");

      const { data, error } = await supabase
        .from("recipe_profiles")
        .update(changes)
        .eq("id", userId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      setProfile(data);
    },
    [userId],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loading, save }),
    [profile, loading, save],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}
