import { useMemo, useState } from "react";
import { ChefHat, CookingPot, Loader2, Pencil } from "lucide-react";

import {
  GCart,
  GDownload,
  GPencil,
  GShare,
  GStar,
  GTrash,
} from "@/components/GradientIcon";
import { useAuth } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useCookLog } from "@/hooks/use-cook-log";
import { useRecipes } from "@/hooks/use-recipes";
import { saveFile } from "@/lib/download";
import { isEmptyNutrition, isNutritionStale } from "@/lib/nutrition";
import { recipeToPdf } from "@/lib/recipe-pdf";
import { recipeFileName, type SharedRecipe } from "@/lib/recipe-share";
import { goHome, navigate } from "@/lib/router";
import { isBlankHtml } from "@/lib/sanitize-html";
import { canShareFiles } from "@/lib/share";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CookedDifferentlyDialog } from "@/components/CookedDifferentlyDialog";
import { SendToShoppingDialog } from "@/components/SendToShoppingDialog";
import { ShareRecipeDialog } from "@/components/ShareRecipeDialog";
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
  const [shopping, setShopping] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Whether this browser will carry a file at all. Asked once: it is a fact
   * about the browser, which cannot change while the app is open, and a share
   * button on a browser that refuses documents is a button that can only
   * apologise. Where the answer is no there is simply no button.
   */
  const [canShare] = useState(canShareFiles);

  const recipe = recipes.find((r) => r.id === id);

  /*
   * The recipe as the printed page needs it: the row and the category list
   * gathered into one description, so the drawing code has nothing to look up
   * for itself.
   */
  const shared = useMemo<SharedRecipe | null>(() => {
    if (!recipe) return null;
    return {
      title: recipe.title,
      ingredientsHtml: recipe.ingredients_html,
      instructionsHtml: recipe.instructions_html,
      notesHtml: recipe.notes_html,
      imageUrl: recipe.image_url,
      nutrition: recipe.nutrition,
      author: recipe.author?.display_name ?? "משתמש",
      categories: categories
        .filter((category) => recipe.categoryIds.includes(category.id))
        .map((category) => category.name),
    };
  }, [recipe, categories]);

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
  // The same check the editor makes, made here on the saved recipe: an
  // ingredient changed and saved without the figures being recalculated
  // leaves the two describing different dishes, and only the basis stored
  // alongside the numbers can tell.
  const nutritionStale = isNutritionStale(recipe.nutrition, recipe.ingredients_html);
  const author = recipe.author?.display_name ?? "משתמש";
  const recipeCategories = categories.filter((c) => recipe.categoryIds.includes(c.id));

  /** The recipe on paper, in the device's own downloads. */
  async function downloadPdf() {
    if (!shared) return;
    setDownloading(true);
    setError(null);
    try {
      saveFile(await recipeToPdf(shared), recipeFileName(shared.title, "pdf"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת קובץ ה-PDF נכשלה");
    } finally {
      setDownloading(false);
    }
  }

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
          /*
            Up to six things can be done to a recipe from here, and on a phone
            that many round buttons at the usual spacing would leave the title
            no room at all. They are tightened into one group instead — the
            gaps closed up and each button a little smaller on a narrow screen,
            back to full size as soon as there is width for it.
          */
          <div className="flex shrink-0 items-center gap-0.5 [&_button]:size-8 sm:[&_button]:size-9">
            <Button
              variant="ghost"
              size="icon"
              aria-label={recipe.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
              aria-pressed={recipe.isFavorite}
              onClick={() => void toggleFavorite(recipe.id)}
            >
              <GStar filled={recipe.isFavorite} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label="הוספה לרשימת הקניות"
              onClick={() => setShopping(true)}
            >
              <GCart />
            </Button>

            {canShare && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="שיתוף המתכון"
                onClick={() => setSharing(true)}
              >
                <GShare />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              aria-label="הורדת המתכון כקובץ PDF"
              disabled={downloading}
              onClick={() => void downloadPdf()}
            >
              {downloading ? <Loader2 className="animate-spin" /> : <GDownload />}
            </Button>

            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="עריכת המתכון"
                  onClick={() => navigate(`/edit/${recipe.id}`)}
                >
                  <GPencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="מחיקת המתכון"
                  onClick={() => setConfirming(true)}
                >
                  <GTrash />
                </Button>
              </>
            )}
          </div>
        }
      />

      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        {error && <Notice kind="error">{error}</Notice>}
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            /*
              Deliberately no `crossOrigin` here. Asking for the photograph with
              CORS would let the PDF reuse this fetch instead of making its own,
              but a picture whose stored response cannot satisfy the CORS check
              then fails to render at all — an empty frame where the dish should
              be. A second fetch inside the PDF is the cheaper mistake.
            */
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

        {/*
          Above the recipe rather than below it: this is the button pressed
          on the way to the stove, not after reading to the end.
        */}
        {/*
          Above the recipe rather than below it: this is the button pressed
          on the way to the stove, not after reading to the end.
        */}
        <Button size="lg" className="w-full" onClick={() => navigate(`/cook/${recipe.id}`)}>
          <CookingPot />
          מצב בישול
        </Button>

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
            {/*
              Ahead of the table rather than under it: the numbers are the
              thing being doubted, so the doubt has to arrive first.
            */}
            {nutritionStale && (
              <div className="space-y-2">
                <Notice kind="error">
                  הרכיבים השתנו מאז שהערכים חושבו, והמספרים כאן עדיין מתארים את הרשימה הקודמת.
                  {isOwner && " אפשר לחשב אותם מחדש בעריכת המתכון."}
                </Notice>

                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/edit/${recipe.id}`)}
                  >
                    <Pencil />
                    עריכה וחישוב מחדש
                  </Button>
                )}
              </div>
            )}

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

      <SendToShoppingDialog
        open={shopping}
        onClose={() => setShopping(false)}
        ingredientsHtml={recipe.ingredients_html}
      />

      {shared && (
        <ShareRecipeDialog
          open={sharing}
          onClose={() => setSharing(false)}
          recipe={shared}
        />
      )}

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
