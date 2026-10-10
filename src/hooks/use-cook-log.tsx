import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Nutrition, Swap } from "@/integrations/supabase/types";
import { errorMessage } from "@/lib/errors";
import { normalizeNutrition } from "@/lib/nutrition";
import { ensureFreshSession, withFreshSession } from "@/lib/session";

import { useAuth } from "./use-auth";

// The cooking history of one recipe: every time it was made with something
// swapped, what was swapped, and what the numbers came to that day.
//
// The recipe itself is never rewritten by any of this — it goes on saying
// exactly what it said — and the log is private to whoever kept it, the same
// way favourites are.

export type CookLogEntry = Database["public"]["Tables"]["recipe_cook_log"]["Row"];

export type NewCookLogEntry = {
  cooked_on: string;
  swaps: Swap[];
  note: string | null;
  nutrition: Nutrition;
};

export function useCookLog(recipeId: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;

  const [entries, setEntries] = useState<CookLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Only the newest load writes — the same guard the recipe list uses. */
  const latestRun = useRef(0);

  const reload = useCallback(async () => {
    const run = ++latestRun.current;
    const current = () => run === latestRun.current;

    if (!userId) {
      if (current()) {
        setEntries([]);
        setLoading(false);
      }
      return;
    }

    setError(null);
    try {
      const data = await withFreshSession(async () => {
        const { data: rows, error: readError } = await supabase
          .from("recipe_cook_log")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("cooked_on", { ascending: false })
          .order("created_at", { ascending: false });
        if (readError) throw readError;
        return rows;
      });

      if (!current()) return;

      // Two entries can share a day, so the newest-written comes first within it.
      setEntries(
        (data ?? []).map((entry) => ({
          ...entry,
          nutrition: normalizeNutrition(entry.nutrition) ?? entry.nutrition,
          swaps: Array.isArray(entry.swaps) ? entry.swaps : [],
        })),
      );
    } catch (e) {
      if (current()) setError(errorMessage(e, "טעינת יומן הבישולים נכשלה"));
    } finally {
      if (current()) setLoading(false);
    }
  }, [recipeId, userId]);

  /*
   * Reading again behind a new token. Nothing here uses the token itself — the
   * client attaches it — but a token that has just been replaced is a token
   * that may have been refused a moment ago, with the screen left saying so.
   * Asking again is what turns that red line back into recipes without the
   * page having to be reloaded by hand.
   */
  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload, accessToken]);

  const addEntry = useCallback(
    async (entry: NewCookLogEntry) => {
      if (!userId) throw new Error("צריך להתחבר כדי לשמור ביומן");
      await ensureFreshSession();

      const { error: insertError } = await supabase
        .from("recipe_cook_log")
        .insert({ ...entry, recipe_id: recipeId, user_id: userId });
      if (insertError) throw insertError;

      await reload();
    },
    [recipeId, userId, reload],
  );

  const removeEntry = useCallback(async (id: string) => {
    await ensureFreshSession();

    const { error: deleteError } = await supabase
      .from("recipe_cook_log")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { entries, loading, error, addEntry, removeEntry, reload };
}
