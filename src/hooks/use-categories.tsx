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
  const { user } = useAuth();
  const userId = user?.id ?? null;

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
    const { data, error: readError } = await supabase
      .from("recipe_categories")
      .select("*")
      .order("name");

    if (readError) setError(readError.message);
    else setCategories(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const addCategory = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("צריך להתחבר");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("שם הקטגוריה ריק");

      const { data, error: insertError } = await supabase
        .from("recipe_categories")
        .insert({ name: trimmed, created_by: userId })
        .select("*")
        .single();

      if (insertError) {
        throw new Error(
          insertError.code === DUPLICATE ? "קטגוריה בשם הזה כבר קיימת" : insertError.message,
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

    const { error: updateError } = await supabase
      .from("recipe_categories")
      .update({ name: trimmed })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        updateError.code === DUPLICATE ? "קטגוריה בשם הזה כבר קיימת" : updateError.message,
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
    const { error: deleteError } = await supabase
      .from("recipe_categories")
      .delete()
      .eq("id", id);
    if (deleteError) throw new Error(deleteError.message);

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
