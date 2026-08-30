import { useMemo, useState } from "react";
import {
  ChefHat,
  CookingPot,
  FileDown,
  Loader2,
  Pencil,
  Send,
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
  /** The drawn page, held only between the tap that made it and the tap that sends it. */
  const [ready, setReady] = useState<File | null>(null);
  /** Set when the file could not be shared but a link still can be. */
  const [linkOffered, setLinkOffered] = useState(false);

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
      saveFile(await recipeToPdf(shared), recipeFileName(shared.title, "pdf"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת קובץ ה-PDF נכשלה");
    } finally {
      setDownloading(false);
    }
  }

  /*
   * The recipe as a file, handed to the phone — in two taps rather than one.
   *
   * A `mailto:` or a wa.me link can carry text and nothing else, so the PDF
   * goes out through the device's own share sheet, where WhatsApp, mail, Drive
   * and everything else the phone knows about are already listed.
   *
   * The catch is that a phone will only open that sheet while it is still
   * handling a tap, and drawing the page takes longer than a tap lasts.
   * Anything that tries to do both at once loses the race, whether the page is
   * drawn on the spot or fetched from something kept ready in advance — and a
   * page kept ready is a page held in memory after the reader has moved on.
   *
   * So the two are separated. The first tap draws the page and says it is
   * ready; the second sends it, with nothing awaited in between for the phone
   * to object to. The file is held only between those two taps.
   */
  async function preparePdf() {
    if (!shared) return;
    setSharing(true);
    setError(null);
    setNotice(null);
    setReady(null);
    setLinkOffered(false);

    try {
      const name = recipeFileName(shared.title, "pdf");
      const file = new File([await recipeToPdf(shared)], name, { type: "application/pdf" });

      if (!navigator.canShare?.({ files: [file] })) {
        /*
         * This browser will not carry a file. Not every one can: attaching
         * files is a later addition to sharing than sending a line of text,
         * and some phones and most desktops still only do the latter.
         *
         * The file is handed over anyway, since it is what was asked for and
         * it can be attached by hand. But the chooser is the other half of
         * what sharing means, so it is offered too — carrying a link rather
         * than the document, which is all this browser will take.
         */
        saveFile(file, name);
        setLinkOffered(canShareLink());
        setNotice(
          canShareLink()
            ? "הדפדפן הזה אינו יודע לשתף קבצים, אז המתכון ירד כקובץ — אפשר לצרף אותו להודעה, או לשתף קישור אליו."
            : "הדפדפן הזה אינו יודע לשתף, אז המתכון ירד כקובץ — אפשר לצרף אותו להודעה.",
        );
        return;
      }

      setReady(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת קובץ ה-PDF נכשלה");
    } finally {
      setSharing(false);
    }
  }

  /** Whether this browser will open a chooser for a plain link at all. */
  function canShareLink(): boolean {
    return typeof navigator.share === "function";
  }

  /**
   * The chooser, carrying a link instead of the document — the fallback for a
   * browser that shares but will not attach. Not `async`, like the one below,
   * because the tap has to still be in hand when the sheet opens.
   */
  function shareLink() {
    if (!shared) return;
    setLinkOffered(false);
    navigator
      .share({ title: shared.title, text: shared.title, url: shared.url })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("שיתוף הקישור נכשל");
      });
  }

  /**
   * Deliberately not `async`, and with no `await` before `share`. The tap that
   * runs this is the thing the phone checks for, and waiting on anything at all
   * here — even a promise that has already settled — is what spends it.
   */
  function sendPdf() {
    const file = ready;
    if (!file) return;
    setReady(null);

    navigator.share({ files: [file], title: file.name }).catch((e: unknown) => {
      // Closing the sheet without choosing anything is a decision, not a
      // failure, and the phone reports it as one.
      if (e instanceof DOMException && e.name === "AbortError") return;

      // Anything else and the file still exists, so it goes to the device
      // rather than the reader getting the browser's own English refusal.
      saveFile(file, file.name);
      setLinkOffered(canShareLink());
      setNotice(
        canShareLink()
          ? "השיתוף של הקובץ נדחה, אז המתכון ירד — אפשר לצרף אותו להודעה, או לשתף קישור אליו."
          : "השיתוף לא נפתח, אז המתכון ירד כקובץ — אפשר לצרף אותו להודעה.",
      );
    });
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
              aria-label={ready ? "שליחת המתכון" : "שיתוף המתכון כקובץ PDF"}
              disabled={sharing}
              onClick={ready ? sendPdf : () => void preparePdf()}
              className={cn(ready && "bg-primary/15 text-primary")}
            >
              {sharing ? <Loader2 className="animate-spin" /> : ready ? <Send /> : <Share2 />}
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
        {notice && (
          <Notice>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>{notice}</span>
              {linkOffered && (
                <Button size="sm" variant="outline" onClick={shareLink}>
                  <Share2 />
                  שיתוף קישור
                </Button>
              )}
            </span>
          </Notice>
        )}

        {/*
          The second tap. It has to be a tap of its own — the phone opens its
          share sheet only while it is handling one — so the page being ready
          is said out loud rather than assumed.
        */}
        {ready && (
          <Notice kind="success">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>המתכון מוכן לשליחה.</span>
              <Button size="sm" onClick={sendPdf}>
                <Send />
                שליחה
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReady(null)}>
                ביטול
              </Button>
            </span>
          </Notice>
        )}

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
