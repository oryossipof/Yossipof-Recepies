import { Star } from "lucide-react";

import type { RecipeWithMeta } from "@/hooks/use-recipes";
import { CARD_TILE, DEFAULT_CARD_SIZE, type CardSize } from "@/lib/card-size";
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
  size = DEFAULT_CARD_SIZE,
  onToggleFavorite,
}: {
  recipe: RecipeWithMeta;
  size?: CardSize;
  onToggleFavorite: (id: string) => void;
}) {
  const author = recipe.author?.display_name ?? "משתמש";
  const tile = CARD_TILE[size];

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
              <span className="text-4xl opacity-45" aria-hidden>
                🥘
              </span>
            </div>
          )}
        </div>

        <div className={tile.body}>
          <h3 className={tile.title}>{recipe.title}</h3>
          {tile.meta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar name={author} url={recipe.author?.avatar_url} size="sm" />
              <span className="truncate">{author}</span>
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        aria-label={recipe.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
        aria-pressed={recipe.isFavorite}
        onClick={() => onToggleFavorite(recipe.id)}
        className={cn(
          "absolute inline-flex items-center justify-center rounded-full bg-card/85 shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tile.star,
          recipe.isFavorite ? "text-star" : "text-muted-foreground hover:text-star",
        )}
      >
        <Star className={cn(tile.starIcon, recipe.isFavorite && "fill-star")} />
      </button>
    </article>
  );
}
