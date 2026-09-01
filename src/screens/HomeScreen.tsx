import { useMemo, useState } from "react";
import { Plus, Search, Tags, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useProfile } from "@/hooks/use-profile";
import { useRecipes } from "@/hooks/use-recipes";
import { CARD_SIZE_GRID, readCardSize, writeCardSize, type CardSize } from "@/lib/card-size";
import { navigate } from "@/lib/router";
import { htmlToText } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { CardSizeControl } from "@/components/CardSizeControl";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Notice } from "@/components/Notice";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The main screen: every recipe, as tiles, with search and filters above. */
export function HomeScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { categories } = useCategories();
  const { recipes, loading, error, toggleFavorite } = useRecipes();

  const [query, setQuery] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  /*
   * How large the tiles are drawn. This is a view setting, so it stays on the
   * device alongside the light/dark choice rather than in the database: the
   * screen in your hand decides how much fits on it, and nothing about the
   * recipes themselves changes with it.
   */
  const [cardSize, setCardSize] = useState<CardSize>(readCardSize);

  const chooseCardSize = (next: CardSize) => {
    setCardSize(next);
    writeCardSize(next);
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      if (favoritesOnly && !recipe.isFavorite) return false;
      if (mineOnly && recipe.user_id !== user?.id) return false;

      // Several categories widen the result rather than narrow it: picking
      // "מאפים" and "בשרי" shows both, which is what a shelf of categories
      // is for. Requiring all of them at once would mostly show nothing.
      if (categoryIds.length > 0 && !recipe.categoryIds.some((id) => categoryIds.includes(id))) {
        return false;
      }

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
  }, [recipes, query, categoryIds, favoritesOnly, mineOnly, user?.id]);

  /** How many recipes each category holds — the filter row ranks by it. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const id of recipe.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [recipes]);

  const filtering =
    favoritesOnly || mineOnly || categoryIds.length > 0 || query.trim().length > 0;

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-lg px-4 py-3 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
          <div className="flex items-center gap-1">
            <span className="me-2 text-2xl" aria-hidden>
              🍲
            </span>
            <h1 className="flex-1 text-xl font-bold tracking-tight">מתכונים</h1>

            <CardSizeControl value={cardSize} onChange={chooseCardSize} />

            <Button
              variant="ghost"
              size="icon"
              aria-label="ניהול קטגוריות"
              title="ניהול קטגוריות"
              onClick={() => navigate("/categories")}
              className="text-muted-foreground"
            >
              <Tags />
            </Button>
            <button
              type="button"
              aria-label="הגדרות משתמש"
              title={profile?.display_name ?? "הגדרות משתמש"}
              onClick={() => navigate("/profile")}
              className="ms-1.5 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                name={profile?.display_name ?? user?.email}
                url={profile?.avatar_url}
                size="md"
              />
            </button>
          </div>

          {/* Search and "add recipe" sit side by side, as asked. */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש מתכון"
                aria-label="חיפוש מתכון"
                className="h-12 w-full rounded-full border border-input bg-card px-11 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  aria-label="ניקוי החיפוש"
                  onClick={() => setQuery("")}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/*
              The one action the screen exists for: a bigger circle, a heavier
              plus and a shadow that lifts it off the header, so it reads as
              the only loud thing on a deliberately quiet screen.
            */}
            <button
              type="button"
              aria-label="הוספת מתכון"
              title="הוספת מתכון"
              onClick={() => navigate("/new")}
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/40 transition-[background-color,box-shadow,transform] hover:bg-primary/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="size-8" strokeWidth={3} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-4 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
        {(categories.length > 0 || favoritesOnly || mineOnly) && (
          <CategoryFilter
            categories={categories}
            counts={categoryCounts}
            selected={categoryIds}
            onToggle={(id) =>
              setCategoryIds((current) =>
                current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
              )
            }
            onClear={() => setCategoryIds([])}
            favoritesOnly={favoritesOnly}
            onToggleFavorites={() => setFavoritesOnly((v) => !v)}
            mineOnly={mineOnly}
            onToggleMine={() => setMineOnly((v) => !v)}
          />
        )}

        {error && <Notice kind="error">{error}</Notice>}

        {loading ? (
          <div className={cn("grid", CARD_SIZE_GRID[cardSize])}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filtering={filtering} />
        ) : (
          <div className={cn("grid", CARD_SIZE_GRID[cardSize])}>
            {visible.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                size={cardSize}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ filtering }: { filtering: boolean }) {
  return (
    <div className="space-y-3 py-16 text-center">
      <span className="block text-5xl" aria-hidden>
        {filtering ? "🔍" : "🍲"}
      </span>
      <p className="text-lg font-medium">
        {filtering ? "לא נמצאו מתכונים" : "עדיין אין מתכונים"}
      </p>
      <p className="text-sm text-muted-foreground">
        {filtering ? "נסו חיפוש או סינון אחר" : "הוסיפו את הראשון עם הכפתור למעלה"}
      </p>
      {!filtering && (
        <Button onClick={() => navigate("/new")} className="mt-1">
          <Plus />
          הוספת המתכון הראשון
        </Button>
      )}
    </div>
  );
}
