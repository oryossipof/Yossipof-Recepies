import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database, Nutrition } from "@/integrations/supabase/types";
import { errorMessage } from "@/lib/errors";
import { normalizeNutrition } from "@/lib/nutrition";

import { useAuth } from "./use-auth";

export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type Profile = Database["public"]["Tables"]["recipe_profiles"]["Row"];

/** A recipe plus everything the cards and the detail screen show around it. */
export type RecipeWithMeta = Recipe & {
  author: Profile | null;
  categoryIds: string[];
  isFavorite: boolean;
};

/** The editable half of a recipe — what the add/edit screen submits. */
export type RecipeInput = {
  title: string;
  ingredients_html: string;
  instructions_html: string;
  notes_html: string | null;
  image_url: string | null;
  nutrition: Nutrition | null;
  categoryIds: string[];
  source_kind?: string | null;
  source_ref?: string | null;
};

type RecipesContextValue = {
  recipes: RecipeWithMeta[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createRecipe: (input: RecipeInput) => Promise<string>;
  updateRecipe: (id: string, input: RecipeInput) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
};

const RecipesContext = createContext<RecipesContextValue | null>(null);

export function RecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [recipes, setRecipes] = useState<RecipeWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
   * Which load is allowed to write what it found.
   *
   * Several loads can be in the air at once: a screen asks for a reload while
   * one is already running, signing in starts another, and in development
   * StrictMode runs the mounting effect twice over. They are not cancelled, so
   * without a guard the slowest one wins whatever it happens to be carrying —
   * and a failure arriving after a success painted "טעינת המתכונים נכשלה" in
   * red above a shelf of recipes that had loaded perfectly well. Only the
   * newest run may touch the state; an overtaken one finishes quietly.
   */
  const latestRun = useRef(0);

  const reload = useCallback(async () => {
    const run = ++latestRun.current;
    const current = () => run === latestRun.current;

    if (!userId) {
      if (current()) {
        setRecipes([]);
        setLoading(false);
      }
      return;
    }

    setError(null);
    try {
      // Four small reads in parallel and one client-side join: recipes point at
      // auth.users rather than at the profiles table, so PostgREST cannot embed
      // the author for us.
      const [recipesRes, profilesRes, linksRes, favoritesRes] = await Promise.all([
        supabase.from("recipes").select("*").order("created_at", { ascending: false }),
        supabase.from("recipe_profiles").select("*"),
        supabase.from("recipe_category_links").select("*"),
        supabase.from("recipe_favorites").select("recipe_id"),
      ]);

      const failed =
        recipesRes.error ?? profilesRes.error ?? linksRes.error ?? favoritesRes.error;
      if (failed) throw failed;

      const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const favorites = new Set((favoritesRes.data ?? []).map((f) => f.recipe_id));
      const categoriesByRecipe = new Map<string, string[]>();
      for (const link of linksRes.data ?? []) {
        const list = categoriesByRecipe.get(link.recipe_id);
        if (list) list.push(link.category_id);
        else categoriesByRecipe.set(link.recipe_id, [link.category_id]);
      }

      if (!current()) return;

      setRecipes(
        (recipesRes.data ?? []).map((recipe) => ({
          ...recipe,
          nutrition: normalizeNutrition(recipe.nutrition),
          author: profiles.get(recipe.user_id) ?? null,
          categoryIds: categoriesByRecipe.get(recipe.id) ?? [],
          isFavorite: favorites.has(recipe.id),
        })),
      );
    } catch (e) {
      if (current()) setError(errorMessage(e, "טעינת המתכונים נכשלה"));
    } finally {
      if (current()) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  /** Replaces a recipe's category links with exactly the ids given. */
  const syncCategories = useCallback(async (recipeId: string, categoryIds: string[]) => {
    const { error: deleteError } = await supabase
      .from("recipe_category_links")
      .delete()
      .eq("recipe_id", recipeId);
    if (deleteError) throw deleteError;

    if (categoryIds.length === 0) return;

    const { error: insertError } = await supabase
      .from("recipe_category_links")
      .insert(categoryIds.map((category_id) => ({ recipe_id: recipeId, category_id })));
    if (insertError) throw insertError;
  }, []);

  const createRecipe = useCallback(
    async (input: RecipeInput) => {
      if (!userId) throw new Error("צריך להתחבר כדי להוסיף מתכון");

      const { categoryIds, ...fields } = input;
      const { data, error: insertError } = await supabase
        .from("recipes")
        .insert({
          user_id: userId,
          title: fields.title,
          ingredients_html: fields.ingredients_html,
          instructions_html: fields.instructions_html,
          notes_html: fields.notes_html,
          image_url: fields.image_url,
          nutrition: fields.nutrition,
          source_kind: fields.source_kind ?? null,
          source_ref: fields.source_ref ?? null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await syncCategories(data.id, categoryIds);
      await reload();
      return data.id;
    },
    [userId, syncCategories, reload],
  );

  const updateRecipe = useCallback(
    async (id: string, input: RecipeInput) => {
      const { categoryIds, ...fields } = input;
      const { error: updateError } = await supabase
        .from("recipes")
        .update({
          title: fields.title,
          ingredients_html: fields.ingredients_html,
          instructions_html: fields.instructions_html,
          notes_html: fields.notes_html,
          image_url: fields.image_url,
          nutrition: fields.nutrition,
        })
        .eq("id", id);
      if (updateError) throw updateError;

      await syncCategories(id, categoryIds);
      await reload();
    },
    [syncCategories, reload],
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from("recipes").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setRecipes((current) => current.filter((r) => r.id !== id));
    },
    [],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!userId) return;
      const current = recipes.find((r) => r.id === id);
      if (!current) return;

      const next = !current.isFavorite;
      // Optimistic: the star should respond instantly.
      setRecipes((list) => list.map((r) => (r.id === id ? { ...r, isFavorite: next } : r)));

      const { error: writeError } = next
        ? await supabase.from("recipe_favorites").insert({ user_id: userId, recipe_id: id })
        : await supabase
            .from("recipe_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("recipe_id", id);

      if (writeError) {
        setRecipes((list) =>
          list.map((r) => (r.id === id ? { ...r, isFavorite: !next } : r)),
        );
      }
    },
    [userId, recipes],
  );

  const value = useMemo<RecipesContextValue>(
    () => ({
      recipes,
      loading,
      error,
      reload,
      createRecipe,
      updateRecipe,
      deleteRecipe,
      toggleFavorite,
    }),
    [recipes, loading, error, reload, createRecipe, updateRecipe, deleteRecipe, toggleFavorite],
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipes(): RecipesContextValue {
  const ctx = useContext(RecipesContext);
  if (!ctx) throw new Error("useRecipes must be used inside <RecipesProvider>");
  return ctx;
}
