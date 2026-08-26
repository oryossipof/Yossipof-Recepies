import { ImageOff, Star } from "lucide-react";

import type { RecipeWithMeta } from "@/hooks/use-recipes";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

import { Avatar } from "./Avatar";

/**
 * One square tile on the main screen: the photo, the name, who uploaded it and
 * a star for favourites.
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
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => navigate(`/recipe/${recipe.id}`)}
        className="block w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
        </div>

        <div className="space-y-1.5 p-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{recipe.title}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
        className="absolute left-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Star
          className={cn("size-4", recipe.isFavorite && "fill-primary text-primary")}
        />
      </button>
    </article>
  );
}
