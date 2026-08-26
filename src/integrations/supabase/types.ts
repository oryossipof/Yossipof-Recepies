// Hand-maintained mirror of supabase/setup.sql. Keep the two in step: when a
// column is added there, add it here too, and the compiler will point at every
// query that needs updating.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Shape of the recipes.nutrition JSONB column. */
export type Nutrition = {
  total_label: string;
  total: { calories: number; protein: number; fat: number };
  divisions: { label: string; count: number }[];
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
  created_at: string;
  updated_at: string;
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
        Insert: Omit<ProfileRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
