import { useMemo, useState } from "react";
import { ChefHat, ChevronRight, Search, Star, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useRecipes } from "@/hooks/use-recipes";
import { CARD_SIZE_GRID, readCardSize, writeCardSize, type CardSize } from "@/lib/card-size";
import { UNCATEGORIZED } from "@/lib/list-mode";
import { isSearching, matchesName } from "@/lib/recipe-search";
import { goBack, navigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { CardSizeControl } from "@/components/CardSizeControl";
import { Chip } from "@/components/CategoryFilter";
import { HeaderTools } from "@/components/HeaderTools";
import { Notice } from "@/components/Notice";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * One category, opened from the categories view of the main screen: its
 * recipes, in the same tiles and the same grid the flat list uses.
 *
 * The screen deliberately repeats the main screen rather than borrowing its
 * filters wholesale — a category picker inside a category is a contradiction —
 * so what is left is the search box over these recipes and the two chips that
 * still mean something here, favourites and mine.
 */
export function CategoryRecipesScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const { recipes, loading, error, toggleFavorite } = useRecipes();

  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  // The same device-wide setting the main screen uses: walking into a category
  // should not resize everything.
  const [cardSize, setCardSize] = useState<CardSize>(readCardSize);

  const chooseCardSize = (next: CardSize) => {
    setCardSize(next);
    writeCardSize(next);
  };

  const uncategorized = id === UNCATEGORIZED;
  const category = categories.find((c) => c.id === id) ?? null;
  const title = uncategorized ? "ללא קטגוריה" : (category?.name ?? "קטגוריה");

  // "חיפוש בללא קטגוריה" is not Hebrew anyone speaks: the shelf without a
  // category is named by a phrase, not by a noun, so it gets its own wording.
  const searchLabel = uncategorized ? "חיפוש במתכונים ללא קטגוריה" : `חיפוש ב${title}`;

  /** Everything on this shelf, before the search box and the chips. */
  const inCategory = useMemo(
    () =>
      recipes.filter((recipe) =>
        uncategorized ? recipe.categoryIds.length === 0 : recipe.categoryIds.includes(id),
      ),
    [recipes, id, uncategorized],
  );

  const searching = isSearching(query);

  const visible = useMemo(
    () =>
      inCategory.filter((recipe) => {
        if (favoritesOnly && !recipe.isFavorite) return false;
        if (mineOnly && recipe.user_id !== user?.id) return false;
        return !searching || matchesName(recipe.title, query);
      }),
    [inCategory, query, searching, favoritesOnly, mineOnly, user?.id],
  );

  const filtering = favoritesOnly || mineOnly || searching;

  // A category that was deleted or renamed away on another device leaves a
  // link pointing at nothing. Say so rather than showing an empty shelf under
  // the word "קטגוריה".
  const missing = !uncategorized && !category && !categoriesLoading;

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-lg px-4 py-3 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="חזרה לקטגוריות"
              onClick={goBack}
              className="-ms-2 text-primary hover:bg-primary/10 hover:text-primary"
            >
              {/* RTL: "back" points right. */}
              <ChevronRight className="size-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
              <p className="text-xs text-muted-foreground">
                {inCategory.length === 1 ? "מתכון אחד" : `${inCategory.length} מתכונים`}
              </p>
            </div>

            <HeaderTools label="תצוגה">
              <CardSizeControl value={cardSize} onChange={chooseCardSize} />
            </HeaderTools>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-4 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
        <div className="mb-4 flex items-center gap-1.5">
          <Chip
            active={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
            icon={<Star className={cn("size-3.5", favoritesOnly ? "fill-current" : "text-star")} />}
          >
            מועדפים
          </Chip>

          <Chip
            active={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
            icon={<ChefHat className="size-3.5" />}
          >
            המתכונים שלי
          </Chip>
        </div>

        {error && <Notice kind="error">{error}</Notice>}
        {missing && <Notice kind="error">הקטגוריה הזו כבר לא קיימת.</Notice>}

        {loading ? (
          <div className={cn("grid", CARD_SIZE_GRID[cardSize])}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <span className="block text-5xl" aria-hidden>
              {filtering ? "🔍" : "🗂️"}
            </span>
            <p className="text-lg font-medium">
              {filtering ? "לא נמצאו מתכונים" : "אין עדיין מתכונים בקטגוריה הזו"}
            </p>
            <Button variant="ghost" onClick={() => navigate("/")} className="mt-1">
              חזרה לכל המתכונים
            </Button>
          </div>
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
