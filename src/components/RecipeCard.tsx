import { ChefHat, Star } from "lucide-react";

import type { RecipeWithMeta } from "@/hooks/use-recipes";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

import { Avatar } from "./Avatar";

/**
 * One tile on the main screen: the photo, the name, and who uploaded it.
 *
 * The card is deliberately plain — a hairline border, a soft shadow that only
 * appears on hover — so that on a screen full of these, the photographs are
 * the only colour.
 */
export function RecipeCard({
  recipe,
  onToggleFavorite,
}: {
  recipe: RecipeWithMeta;
  onToggleFavorite: (id: string) => void;
}) {
  const author = recipe.author?.display_name ?? "משתמש";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-[0_8px_28px_-12px_rgb(0_0_0/0.18)]">
      <button
        type="button"
        onClick={() => navigate(`/recipe/${recipe.id}`)}
        className="block w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ChefHat className="size-7 text-muted-foreground/40" />
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar name={author} url={recipe.author?.avatar_url} size="sm" />
            <span className="truncate">{author}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        aria-label={recipe.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
        aria-pressed={recipe.isFavorite}
        onClick={() => onToggleFavorite(recipe.id)}
        className={cn(
          "absolute left-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-card/85 shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          recipe.isFavorite ? "text-star" : "text-muted-foreground hover:text-star",
        )}
      >
        <Star className={cn("size-4", recipe.isFavorite && "fill-star")} />
      </button>
    </article>
  );
}
