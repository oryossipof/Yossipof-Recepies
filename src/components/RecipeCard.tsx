import { Star } from "lucide-react";

import type { RecipeWithMeta } from "@/hooks/use-recipes";
import { DEFAULT_CARD_SIZE, type CardSize } from "@/lib/card-size";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

import { Avatar } from "./Avatar";

/**
 * The tile stops showing everything as it shrinks. At four across, a name in
 * the same padding and type as the big tile is a paragraph in a matchbox, so
 * the smaller sizes tighten the padding, drop the type down a step, and give
 * up the "who uploaded it" line — the photograph and the name are what a
 * person scans by.
 */
const TILE = {
  tiny: {
    body: "space-y-1 p-1.5",
    title: "line-clamp-2 text-[0.7rem] font-semibold leading-tight",
    author: false,
    star: "size-6 end-1 top-1",
    starIcon: "size-3",
  },
  small: {
    body: "space-y-1 p-2.5",
    title: "line-clamp-2 text-xs font-semibold leading-snug",
    author: false,
    star: "size-7 end-2 top-2",
    starIcon: "size-3.5",
  },
  medium: {
    body: "space-y-2 p-4",
    title: "line-clamp-2 text-[0.95rem] font-semibold leading-snug",
    author: true,
    star: "size-8 end-3 top-3",
    starIcon: "size-4",
  },
  large: {
    body: "space-y-2 p-4",
    title: "line-clamp-2 text-lg font-semibold leading-snug",
    author: true,
    star: "size-9 end-3 top-3",
    starIcon: "size-[1.1rem]",
  },
} as const satisfies Record<CardSize, unknown>;

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
  const tile = TILE[size];

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
          {tile.author && (
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
