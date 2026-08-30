import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  CookingPot,
  FileDown,
  Loader2,
  Pencil,
  Share2,
  ShoppingCart,
  Star,
  Trash2,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CookedDifferentlyDialog } from "@/components/CookedDifferentlyDialog";
import { SendToShoppingDialog } from "@/components/SendToShoppingDialog";
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
  const [notice, setNotice] = useState<string | null>(null);

  const recipe = recipes.find((r) => r.id === id);

  /*
   * The recipe as it leaves the app. Sharing it and printing it are the same
   * recipe read out twice, so both are given one description of it rather than
   * each reaching into the row and the category list for itself.
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
      // The link is worth carrying for the family, who have accounts and land
      // straight on this screen. Everyone else still gets the whole recipe in
      // the message above it.
      url: `${window.location.origin}${window.location.pathname}#/recipe/${recipe.id}`,
    };
  }, [recipe, categories]);

  /*
   * The finished PDF, built before anyone asks for it.
   *
   * `navigator.share` may only be called while the tap that asked for it still
   * counts as a gesture — about five seconds in Chrome — and building a page
   * with a photograph on it can take longer than that on mobile data. Waiting
   * for the build inside the tap is what makes the share fail with "permission
   * denied": by the time the file is ready, the tap no longer counts.
   *
   * So the page is drawn a moment after the recipe appears, while the reader
   * is still reading, and the share button has nothing left to wait for.
   */
  const prepared = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    prepared.current = null;
    if (!shared) return;

    // Not on the same tick as the first paint: drawing a page is real work,
    // and the recipe should appear first.
    const timer = window.setTimeout(() => {
      if (!prepared.current) prepared.current = buildPdf(shared);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [shared]);

  /**
   * Starts a build and remembers it. A build that fails is forgotten rather
   * than remembered, so pressing the button again tries afresh instead of
   * repeating the same failure.
   */
  function buildPdf(recipe: SharedRecipe): Promise<Blob> {
    const pdf = recipeToPdf(recipe);
    pdf.catch(() => {
      if (prepared.current === pdf) prepared.current = null;
    });
    return pdf;
  }

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
    setNotice(null);
    try {
      prepared.current ??= buildPdf(shared);
      saveFile(await prepared.current, recipeFileName(shared.title, "pdf"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת קובץ ה-PDF נכשלה");
    } finally {
      setDownloading(false);
    }
  }

  /*
   * The recipe as a file, handed to the phone.
   *
   * A `mailto:` or a wa.me link can carry text and nothing else — neither can
   * attach a file — so the PDF goes out through the device's own share sheet
   * instead, where WhatsApp, mail, Drive and everything else the phone knows
   * about are already listed. What arrives at the other end is the recipe as a
   * document, not a wall of text in a chat bubble.
   */
  async function sharePdf() {
    if (!shared) return;
    setSharing(true);
    setError(null);
    setNotice(null);

    try {
      prepared.current ??= buildPdf(shared);
      const name = recipeFileName(shared.title, "pdf");
      const file = new File([await prepared.current], name, { type: "application/pdf" });

      if (!navigator.canShare?.({ files: [file] })) {
        // A desktop browser without file sharing. The file itself is still
        // what was wanted, so hand it over and say where it went.
        saveFile(file, name);
        setNotice("הדפדפן הזה אינו יודע לשתף קבצים, אז המתכון ירד כקובץ — אפשר לצרף אותו להודעה.");
        return;
      }

      try {
        await navigator.share({ files: [file], title: shared.title });
      } catch (e) {
        // Closing the share sheet without choosing anything is a decision, not
        // a failure, and the phone reports it as one.
        if (e instanceof DOMException && e.name === "AbortError") return;

        // The tap stopped counting as a gesture before the sheet could open —
        // the page was still being drawn. The file exists either way, so it
        // goes to the device rather than the reader getting the browser's own
        // English refusal.
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          saveFile(file, name);
          setNotice("חלון השיתוף לא נפתח בזמן, אז המתכון ירד כקובץ — אפשר לצרף אותו להודעה.");
          return;
        }
        throw e;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שיתוף המתכון נכשל");
    } finally {
      setSharing(false);
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
            Six things can be done to a recipe from here, and on a phone six
            round buttons at the usual spacing would leave the title no room at
            all. They are tightened into one group instead — the gaps closed up
            and each button a little smaller on a narrow screen, back to full
            size as soon as there is width for it.
          */
          <div className="flex shrink-0 items-center gap-0.5 [&_button]:size-8 sm:[&_button]:size-9">
            <Button
              variant="ghost"
              size="icon"
              aria-label={recipe.isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
              aria-pressed={recipe.isFavorite}
              onClick={() => void toggleFavorite(recipe.id)}
            >
              <Star className={cn(recipe.isFavorite && "fill-star text-star")} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label="הוספה לרשימת הקניות"
              onClick={() => setShopping(true)}
            >
              <ShoppingCart />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label="שיתוף המתכון כקובץ PDF"
              disabled={sharing}
              onClick={() => void sharePdf()}
            >
              {sharing ? <Loader2 className="animate-spin" /> : <Share2 />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label="הורדת המתכון כקובץ PDF"
              disabled={downloading}
              onClick={() => void downloadPdf()}
            >
              {downloading ? <Loader2 className="animate-spin" /> : <FileDown />}
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
          </div>
        }
      />

      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-6">
        {error && <Notice kind="error">{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}

        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            /*
              The PDF has to read this photograph back off a canvas, which it
              may only do when the picture was fetched with CORS. Asking for it
              here too means both loads share one cache entry — without this
              the page is drawn from a second, full-size download of a
              photograph already on screen, which on mobile data is most of the
              wait. Storage serves these with `Access-Control-Allow-Origin`.
            */
            crossOrigin="anonymous"
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
