// Hand-maintained mirror of supabase/setup.sql. Keep the two in step: when a
// column is added there, add it here too, and the compiler will point at every
// query that needs updating.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Shape of the recipes.nutrition JSONB column. */
export type Nutrition = {
  total_label: string;
  total: { calories: number; protein: number; fat: number };
  divisions: { label: string; count: number }[];
  /**
   * The plain text of the ingredient list these numbers were worked out from.
   * Kept so the editor can notice that the list has been changed since — an
   * estimate of the old ingredients is worse than no estimate, because it looks
   * exactly as authoritative. Null on recipes saved before this was recorded,
   * which means "unknown", not "out of date".
   */
  basis?: string | null;
};

type RecipeRow = {
  id: string;
  user_id: string;
  title: string;
  ingredients_html: string;
  instructions_html: string;
  notes_html: string | null;
  image_url: string | null;
  nutrition: Nutrition | null;
  source_kind: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  /**
   * The phone number this person uses in the household's shopping-list app,
   * which identifies people by phone rather than by account. It is the only
   * thing joining the two apps, so it is kept here rather than on the device.
   */
  shopping_phone: string | null;
  /** The list ingredients were last sent to, so the choice is not made twice. */
  shopping_list_id: string | null;
  created_at: string;
  updated_at: string;
};

/*
 * The two tables below belong to the shopping-list app, which shares this
 * Supabase project. They are declared here only so that sending ingredients to
 * a shopping list type-checks. The recipe app reads its lists and inserts
 * items; it never alters their structure and never writes anything else.
 */

type GroceryItemRow = {
  id: string;
  phone_number: string;
  list_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  image_url: string | null;
  checked: boolean;
  category: string | null;
  notes: string | null;
  added_at: string;
};

type SavedListRow = {
  id: string;
  phone_number: string;
  name: string;
  items: Json | null;
  category_order: Json | null;
  categories: Json | null;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

type CategoryLinkRow = {
  recipe_id: string;
  category_id: string;
};

type FavoriteRow = {
  user_id: string;
  recipe_id: string;
  created_at: string;
};

/** What was used instead of what the recipe says. */
export type Swap = { from: string; to: string };

/**
 * One occasion of cooking a recipe with changes. The recipe itself is never
 * touched — this is the record of what went in the pot that day, and what it
 * came to.
 */
type CookLogRow = {
  id: string;
  recipe_id: string;
  user_id: string;
  /** ISO date, no time: what matters is the day it was cooked. */
  cooked_on: string;
  swaps: Swap[];
  note: string | null;
  nutrition: Nutrition;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      recipes: {
        Row: RecipeRow;
        Insert: Omit<RecipeRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RecipeRow>;
        Relationships: [];
      };
      recipe_profiles: {
        Row: ProfileRow;
        Insert: Omit<
          ProfileRow,
          "created_at" | "updated_at" | "shopping_phone" | "shopping_list_id"
        > & {
          created_at?: string;
          updated_at?: string;
          shopping_phone?: string | null;
          shopping_list_id?: string | null;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      recipe_categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      recipe_category_links: {
        Row: CategoryLinkRow;
        Insert: CategoryLinkRow;
        Update: Partial<CategoryLinkRow>;
        Relationships: [];
      };
      recipe_favorites: {
        Row: FavoriteRow;
        Insert: Omit<FavoriteRow, "created_at"> & { created_at?: string };
        Update: Partial<FavoriteRow>;
        Relationships: [];
      };
      recipe_cook_log: {
        Row: CookLogRow;
        Insert: Omit<CookLogRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<CookLogRow>;
        Relationships: [];
      };

      // The shopping-list app's own tables — see the note above their rows.
      grocery_items: {
        Row: GroceryItemRow;
        Insert: Omit<GroceryItemRow, "id" | "added_at" | "quantity" | "unit"> & {
          id?: string;
          added_at?: string;
          quantity?: number;
          unit?: string;
        };
        Update: Partial<GroceryItemRow>;
        Relationships: [];
      };
      saved_lists: {
        Row: SavedListRow;
        Insert: Omit<SavedListRow, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<SavedListRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
