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
import { errorMessage } from "@/lib/errors";
import { ensureFreshSession, withFreshSession } from "@/lib/session";

import { useAuth } from "./use-auth";

export type Category = Database["public"]["Tables"]["recipe_categories"]["Row"];

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

/** Postgres unique-violation, i.e. the name is already taken. */
const DUPLICATE = "23505";

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const rows = await withFreshSession(async () => {
        const { data, error: readError } = await supabase
          .from("recipe_categories")
          .select("*")
          .order("name");
        if (readError) throw readError;
        return data ?? [];
      });
      setCategories(rows);
    } catch (e) {
      setError(errorMessage(e, "טעינת הקטגוריות נכשלה"));
    }
    setLoading(false);
  }, [userId]);

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

  const addCategory = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("צריך להתחבר");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("שם הקטגוריה ריק");
      await ensureFreshSession();

      const { data, error: insertError } = await supabase
        .from("recipe_categories")
        .insert({ name: trimmed, created_by: userId })
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          insertError.code === DUPLICATE
            ? "קטגוריה בשם הזה כבר קיימת"
            : errorMessage(insertError, "הוספת הקטגוריה נכשלה"),
        );
      }

      setCategories((current) =>
        [...current, data].sort((a, b) => a.name.localeCompare(b.name, "he")),
      );
      return data;
    },
    [userId],
  );

  const renameCategory = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("שם הקטגוריה ריק");
    await ensureFreshSession();

    const { error: updateError } = await supabase
      .from("recipe_categories")
      .update({ name: trimmed })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        updateError.code === DUPLICATE
          ? "קטגוריה בשם הזה כבר קיימת"
          : errorMessage(updateError, "שינוי שם הקטגוריה נכשל"),
      );
    }

    setCategories((current) =>
      current
        .map((c) => (c.id === id ? { ...c, name: trimmed } : c))
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    );
  }, []);

  /** Deleting a category also removes it from every recipe (ON DELETE CASCADE). */
  const deleteCategory = useCallback(async (id: string) => {
    await ensureFreshSession();

    const { error: deleteError } = await supabase
      .from("recipe_categories")
      .delete()
      .eq("id", id);
    if (deleteError) throw new Error(errorMessage(deleteError, "מחיקת הקטגוריה נכשלה"));

    setCategories((current) => current.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<CategoriesContextValue>(
    () => ({ categories, loading, error, reload, addCategory, renameCategory, deleteCategory }),
    [categories, loading, error, reload, addCategory, renameCategory, deleteCategory],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesContextValue {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside <CategoriesProvider>");
  return ctx;
}
