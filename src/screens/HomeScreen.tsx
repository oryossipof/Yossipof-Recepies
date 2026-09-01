import { useMemo, useState } from "react";
import { Plus, Search, Tags, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useProfile } from "@/hooks/use-profile";
import { useRecipes } from "@/hooks/use-recipes";
import { CARD_SIZE_GRID, readCardSize, writeCardSize, type CardSize } from "@/lib/card-size";
import { UNCATEGORIZED, readListMode, writeListMode, type ListMode } from "@/lib/list-mode";
import { isSearching, matchesName } from "@/lib/recipe-search";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { CardSizeControl } from "@/components/CardSizeControl";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { HeaderToolButton, HeaderTools, ToolEmoji } from "@/components/HeaderTools";
import { ListModeControl } from "@/components/ListModeControl";
import { Notice } from "@/components/Notice";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The main screen: every recipe, or every category, as tiles. */
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
   * How large the tiles are drawn, and what is on them. Both are view
   * settings, so they stay on the device alongside the light/dark choice
   * rather than in the database: the screen in your hand decides how much fits
   * on it, and nothing about the recipes themselves changes with either.
   */
  const [cardSize, setCardSize] = useState<CardSize>(readCardSize);
  const [listMode, setListMode] = useState<ListMode>(readListMode);

  const chooseCardSize = (next: CardSize) => {
    setCardSize(next);
    writeCardSize(next);
  };

  const chooseListMode = (next: ListMode) => {
    setListMode(next);
    writeListMode(next);
    // What was typed is kept across the switch. Both sides search recipes by
    // name, so the word usually still means something on the other side, and
    // wiping the box would be a small theft either way.
  };

  const byCategories = listMode === "categories";
  const searching = isSearching(query);

  const visible = useMemo(() => {
    return recipes.filter((recipe) => {
      if (favoritesOnly && !recipe.isFavorite) return false;
      if (mineOnly && recipe.user_id !== user?.id) return false;

      // Several categories widen the result rather than narrow it: picking
      // "מאפים" and "בשרי" shows both, which is what a shelf of categories
      // is for. Requiring all of them at once would mostly show nothing.
      if (categoryIds.length > 0 && !recipe.categoryIds.some((id) => categoryIds.includes(id))) {
        return false;
      }

      return !searching || matchesName(recipe.title, query);
    });
  }, [recipes, query, searching, categoryIds, favoritesOnly, mineOnly, user?.id]);

  /** How many recipes each category holds — the filter row ranks by it. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const id of recipe.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [recipes]);

  /**
   * The shelves the categories view draws: one per category that holds
   * something, plus the recipes filed under nothing, so that between them the
   * tiles account for every recipe in the app. An empty category is left out —
   * it is a tile that opens onto nothing, and the categories screen is where
   * those are managed.
   */
  const shelves = useMemo(() => {
    if (!byCategories) return [];

    const named = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        recipes: recipes.filter((recipe) => recipe.categoryIds.includes(category.id)),
      }))
      .filter((shelf) => shelf.recipes.length > 0);

    const loose = recipes.filter((recipe) => recipe.categoryIds.length === 0);
    if (loose.length > 0) {
      named.push({ id: UNCATEGORIZED, name: "ללא קטגוריה", recipes: loose });
    }

    // Busiest first, as in the filter dialog: the shelf most likely to be
    // wanted is the one closest to the top.
    return named.sort(
      (a, b) => b.recipes.length - a.recipes.length || a.name.localeCompare(b.name, "he"),
    );
  }, [byCategories, categories, recipes]);

  /** The shelves whose own name matches what was typed. */
  const visibleShelves = useMemo(() => {
    if (!searching) return shelves;
    return shelves.filter((shelf) => matchesName(shelf.name, query));
  }, [shelves, query, searching]);

  /**
   * The recipes whose name matches, shown beneath the shelves while the
   * categories are up.
   *
   * A screen of shelves with a search box that only knows shelf names is a
   * trap: you type the name of a dish you know is in the app and it answers
   * that there is nothing. So the categories view searches both, and shows
   * both — the categories called that, and the recipes called that.
   *
   * The chips are not on this screen, so they are not applied here either. A
   * favourites-only filter left switched on in the other view would otherwise
   * silently shorten these results with nothing on screen to explain it.
   */
  const recipeMatches = useMemo(() => {
    if (!byCategories || !searching) return [];
    return recipes.filter((recipe) => matchesName(recipe.title, query));
  }, [byCategories, recipes, query, searching]);

  const filtering = favoritesOnly || mineOnly || categoryIds.length > 0 || searching;

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-lg px-4 py-3 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8 xl:max-w-6xl">
          <div className="flex items-center gap-1.5">
            {/*
              The pot is decoration — it says the same thing the title beside
              it does — so on the narrowest phones it steps aside rather than
              squeezing the word "מתכונים" into an ellipsis next to the
              buttons.
            */}
            <span className="text-2xl max-[360px]:hidden" aria-hidden>
              🍲
            </span>
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">מתכונים</h1>

            {/*
              Everything that changes how the screen is drawn, in one outlined
              pill — the same shape the shopping-list app frames its phone
              number in. Four loose icons between the title and the avatar read
              as clutter; one framed set reads as the view settings it is.
            */}
            <HeaderTools label="תצוגה">
              <ListModeControl value={listMode} onChange={chooseListMode} />
              <CardSizeControl value={cardSize} onChange={chooseCardSize} />
              <HeaderToolButton
                aria-label="ניהול קטגוריות"
                title="ניהול קטגוריות"
                onClick={() => navigate("/categories")}
              >
                <ToolEmoji className="text-[0.95rem]">🏷️</ToolEmoji>
              </HeaderToolButton>
            </HeaderTools>

            <button
              type="button"
              aria-label="הגדרות משתמש"
              title={profile?.display_name ?? "הגדרות משתמש"}
              onClick={() => navigate("/profile")}
              className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                placeholder={byCategories ? "חיפוש קטגוריה או מתכון" : "חיפוש מתכון"}
                aria-label={byCategories ? "חיפוש קטגוריה או מתכון" : "חיפוש מתכון"}
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
        {/*
          The chips filter recipes, so they belong to the recipe list. In the
          categories view the shelves themselves are the filter, and favourites
          and "mine" wait inside whichever one is opened.
        */}
        {!byCategories && (categories.length > 0 || favoritesOnly || mineOnly) && (
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
        ) : byCategories ? (
          visibleShelves.length === 0 && recipeMatches.length === 0 ? (
            <EmptyCategories searching={searching} hasRecipes={recipes.length > 0} />
          ) : (
            <>
              {visibleShelves.length > 0 && (
                <Section
                  // Nothing is labelled until a search splits the screen in
                  // two: with only shelves on it, a heading saying "קטגוריות"
                  // over a screen of categories is a line spent on nothing.
                  title={searching ? "קטגוריות" : null}
                  size={cardSize}
                >
                  {visibleShelves.map((shelf) => (
                    <CategoryCard
                      key={shelf.id}
                      name={shelf.name}
                      count={shelf.recipes.length}
                      size={cardSize}
                      onOpen={() => navigate(`/category/${shelf.id}`)}
                    />
                  ))}
                </Section>
              )}

              {recipeMatches.length > 0 && (
                <Section title="מתכונים" size={cardSize}>
                  {recipeMatches.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      size={cardSize}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </Section>
              )}
            </>
          )
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

/** One labelled block of tiles — what a search in the categories view splits into. */
function Section({
  title,
  size,
  children,
}: {
  title: string | null;
  size: CardSize;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      {title && (
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      )}
      <div className={cn("grid", CARD_SIZE_GRID[size])}>{children}</div>
    </section>
  );
}

function EmptyCategories({ searching, hasRecipes }: { searching: boolean; hasRecipes: boolean }) {
  return (
    <div className="space-y-3 py-16 text-center">
      <span className="block text-5xl" aria-hidden>
        {searching ? "🔍" : "🗂️"}
      </span>
      <p className="text-lg font-medium">
        {searching
          ? "אין קטגוריה או מתכון בשם הזה"
          : hasRecipes
            ? "עדיין אין קטגוריות עם מתכונים"
            : "עדיין אין מתכונים"}
      </p>
      <p className="text-sm text-muted-foreground">
        {searching
          ? "החיפוש הוא לפי שם — נסו שם אחר"
          : hasRecipes
            ? "אפשר לשייך מתכון לקטגוריה מתוך עריכת המתכון"
            : "הוסיפו את הראשון עם הכפתור למעלה"}
      </p>
      {!searching && hasRecipes && (
        <Button variant="outline" onClick={() => navigate("/categories")} className="mt-1">
          <Tags />
          ניהול קטגוריות
        </Button>
      )}
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
