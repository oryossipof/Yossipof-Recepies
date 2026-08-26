import { useState } from "react";
import { ChefHat, Pencil, Star, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useRecipes } from "@/hooks/use-recipes";
import { isEmptyNutrition } from "@/lib/nutrition";
import { goHome, navigate } from "@/lib/router";
import { isBlankHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { NutritionPanel } from "@/components/NutritionPanel";
import { RichText } from "@/components/RichText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";

/**
 * A section of the recipe. The four field titles are bold, as specified. They
 * are set larger than the body and given room above, which is all the
 * separation a page of four sections needs.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function RecipeViewScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const { categories } = useCategories();
  const { recipes, loading, deleteRecipe, toggleFavorite } = useRecipes();

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipe = recipes.find((r) => r.id === id);

  if (loading) {
    return (
      <>
        <ScreenHeader title="מתכון" />
        <main className="mx-auto w-full max-w-3xl px-3 py-6 text-sm text-muted-foreground">
          טוען…
        </main>
      </>
    );
  }

  if (!recipe) {
    return (
      <>
        <ScreenHeader title="מתכון" />
        <main className="mx-auto w-full max-w-3xl px-3 py-6">
          <Notice kind="error">המתכון לא נמצא.</Notice>
        </main>
      </>
    );
  }

  const isOwner = recipe.user_id === user?.id;
  const author = recipe.author?.display_name ?? "משתמש";
  const recipeCategories = categories.filter((c) => recipe.categoryIds.includes(c.id));

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await deleteRecipe(id);
      goHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : "מחיקת המתכון נכשלה");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-dvh pb-12">
      <ScreenHeader
        title={recipe.title}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={recipe.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
              aria-pressed={recipe.isFavorite}
              onClick={() => void toggleFavorite(recipe.id)}
            >
              <Star className={cn(recipe.isFavorite && "fill-star text-star")} />
            </Button>

            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="עריכת המתכון"
                  onClick={() => navigate(`/edit/${recipe.id}`)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="מחיקת המתכון"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </>
            )}
          </>
        }
      />

      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        {error && <Notice kind="error">{error}</Notice>}

        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="max-h-96 w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-border bg-muted">
            <ChefHat className="size-8 text-muted-foreground/40" />
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight">{recipe.title}</h2>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar name={author} url={recipe.author?.avatar_url} size="sm" />
            <span>הועלה על ידי {author}</span>
          </div>

          {recipeCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipeCategories.map((category) => (
                <span
                  key={category.id}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {category.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <Section title="רכיבים">
          <RichText html={recipe.ingredients_html} />
        </Section>

        <Section title="אופן ההכנה">
          <RichText html={recipe.instructions_html} />
        </Section>

        {!isBlankHtml(recipe.notes_html) && (
          <Section title="הערות">
            <RichText html={recipe.notes_html} />
          </Section>
        )}

        {!isEmptyNutrition(recipe.nutrition) && recipe.nutrition && (
          <Section title="ערכים תזונתיים">
            <NutritionPanel nutrition={recipe.nutrition} />
            <p className="text-xs text-muted-foreground">
              הערכה בלבד, מחושבת על ידי ה-AI לפי הרכיבים והכמויות.
            </p>
          </Section>
        )}
      </main>

      <ConfirmDialog
        open={confirming}
        title="למחוק את המתכון?"
        description={`"${recipe.title}" יימחק לצמיתות.`}
        confirmLabel="מחיקה"
        destructive
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
