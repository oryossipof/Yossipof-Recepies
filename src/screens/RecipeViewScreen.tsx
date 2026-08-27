import { useState } from "react";
import { ChefHat, Pencil, Star, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useCookLog } from "@/hooks/use-cook-log";
import { useRecipes } from "@/hooks/use-recipes";
import { isEmptyNutrition } from "@/lib/nutrition";
import { goHome, navigate } from "@/lib/router";
import { isBlankHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CookedDifferentlyDialog } from "@/components/CookedDifferentlyDialog";
import { CookLogSection } from "@/components/CookLogSection";
import { Notice } from "@/components/Notice";
import { NutritionPanel } from "@/components/NutritionPanel";
import { RichText } from "@/components/RichText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";

/**
 * A section of the recipe. The four field titles are bold, as specified, and
 * each is anchored by an emoji — the same trick the shopping list uses for its
 * category headings, and the fastest way to find "רכיבים" on a phone propped
 * against a mixing bowl.
 */
function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RecipeViewScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const { categories } = useCategories();
  const { recipes, loading, deleteRecipe, toggleFavorite } = useRecipes();
  const cookLog = useCookLog(id);

  const [confirming, setConfirming] = useState(false);
  const [cooking, setCooking] = useState(false);
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
            <span className="text-5xl opacity-45" aria-hidden>
              🥘
            </span>
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

        <Section emoji="🧾" title="רכיבים">
          <RichText html={recipe.ingredients_html} />
        </Section>

        <Section emoji="👩‍🍳" title="אופן ההכנה">
          <RichText html={recipe.instructions_html} />
        </Section>

        {!isBlankHtml(recipe.notes_html) && (
          <Section emoji="💡" title="הערות">
            <RichText html={recipe.notes_html} />
          </Section>
        )}

        {!isEmptyNutrition(recipe.nutrition) && recipe.nutrition && (
          <Section emoji="🔥" title="ערכים תזונתיים">
            <NutritionPanel nutrition={recipe.nutrition} />
            <p className="text-xs text-muted-foreground">
              הערכה בלבד, מחושבת על ידי ה-AI לפי הרכיבים והכמויות.
            </p>

            {/*
              The table above describes the recipe. This asks the other
              question — what was actually eaten, when the cheese that went in
              was the low-fat one.
            */}
            <Button variant="outline" size="sm" onClick={() => setCooking(true)}>
              <ChefHat />
              בישלתי עם שינויים
            </Button>
          </Section>
        )}

        {/*
          Only once there is something to show: an empty log on every recipe
          would be a heading that never says anything.
        */}
        {cookLog.entries.length > 0 && (
          <Section emoji="📖" title="יומן הבישולים שלי">
            <CookLogSection
              entries={cookLog.entries}
              recipeNutrition={recipe.nutrition}
              error={cookLog.error}
              onDelete={cookLog.removeEntry}
            />
          </Section>
        )}
      </main>

      {recipe.nutrition && (
        <CookedDifferentlyDialog
          open={cooking}
          onClose={() => setCooking(false)}
          title={recipe.title}
          ingredientsHtml={recipe.ingredients_html}
          saved={recipe.nutrition}
          onSave={cookLog.addEntry}
        />
      )}

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
