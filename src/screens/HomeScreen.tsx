import { useMemo, useState } from "react";
import { ChefHat, ListFilter, Plus, Search, Star, Tags, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useProfile } from "@/hooks/use-profile";
import { useRecipes } from "@/hooks/use-recipes";
import { navigate } from "@/lib/router";
import { htmlToText } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Notice } from "@/components/Notice";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** The main screen: every recipe, as tiles, with search and filters above. */
export function HomeScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { categories } = useCategories();
  const { recipes, loading, error, toggleFavorite } = useRecipes();

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      if (favoritesOnly && !recipe.isFavorite) return false;
      if (categoryId && !recipe.categoryIds.includes(categoryId)) return false;
      if (!needle) return true;

      // Search the name first, then the text of the recipe itself, so
      // "בטטה" finds a recipe that only mentions it in the ingredients.
      const haystack = [
        recipe.title,
        htmlToText(recipe.ingredients_html),
        htmlToText(recipe.instructions_html),
        recipe.author?.display_name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [recipes, query, categoryId, favoritesOnly]);

  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl space-y-2 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="size-4.5" />
            </span>
            <h1 className="flex-1 text-lg font-bold">מתכונים</h1>

            <Button
              variant="ghost"
              size="icon"
              aria-label="ניהול קטגוריות"
              title="ניהול קטגוריות"
              onClick={() => navigate("/categories")}
            >
              <Tags />
            </Button>
            <button
              type="button"
              aria-label="הגדרות משתמש"
              title={profile?.display_name ?? "הגדרות משתמש"}
              onClick={() => navigate("/profile")}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                name={profile?.display_name ?? user?.email}
                url={profile?.avatar_url}
                size="md"
              />
            </button>
          </div>

          {/* Search and "add recipe" sit side by side, as asked. */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש מתכון"
                aria-label="חיפוש מתכון"
                className="h-10 pr-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="ניקוי החיפוש"
                  onClick={() => setQuery("")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <Button
              size="icon"
              aria-label="הוספת מתכון"
              title="הוספת מתכון"
              onClick={() => navigate("/new")}
              className="size-10 shrink-0"
            >
              <Plus className="size-5" />
            </Button>
          </div>

          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
            <FilterChip
              active={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
              icon={<Star className={cn("size-3.5", favoritesOnly && "fill-current")} />}
            >
              מועדפים
            </FilterChip>

            <FilterChip
              active={categoryId === null}
              onClick={() => setCategoryId(null)}
              icon={<ListFilter className="size-3.5" />}
            >
              הכל
            </FilterChip>

            {categories.map((category) => (
              <FilterChip
                key={category.id}
                active={categoryId === category.id}
                onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
              >
                {category.name}
              </FilterChip>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-4">
        {error && <Notice kind="error">{error}</Notice>}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState hasRecipes={recipes.length > 0} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EmptyState({ hasRecipes }: { hasRecipes: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <ChefHat className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {hasRecipes ? "אין מתכונים שמתאימים לחיפוש" : "עדיין אין מתכונים"}
      </p>
      {!hasRecipes && (
        <Button onClick={() => navigate("/new")}>
          <Plus />
          הוספת המתכון הראשון
        </Button>
      )}
    </div>
  );
}
