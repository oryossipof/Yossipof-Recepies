import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useRecipes, type RecipeInput } from "@/hooks/use-recipes";
import type { Nutrition } from "@/integrations/supabase/types";
import { uploadRecipeImage } from "@/lib/images";
import { isNutritionStale } from "@/lib/nutrition";
import { returnTo } from "@/lib/router";
import { cn } from "@/lib/utils";
import type { ParsedRecipe, SourceKind } from "@/lib/parse-recipe";
import { isBlankHtml } from "@/lib/sanitize-html";
import { CategoryPicker } from "@/components/CategoryPicker";
import { ImageField } from "@/components/ImageField";
import { Notice } from "@/components/Notice";
import { NutritionEditor } from "@/components/NutritionEditor";
import { RecipeImporter } from "@/components/RecipeImporter";
import { RichTextEditor } from "@/components/RichTextEditor";
import { NUTRITION_ANCHOR, StaleNutritionBanner } from "@/components/StaleNutritionBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = {
  title: string;
  ingredients_html: string;
  instructions_html: string;
  notes_html: string;
  image_url: string | null;
  nutrition: Nutrition | null;
  categoryIds: string[];
  source_kind: SourceKind | null;
  source_ref: string | null;
};

const BLANK: Draft = {
  title: "",
  ingredients_html: "",
  instructions_html: "",
  notes_html: "",
  image_url: null,
  nutrition: null,
  categoryIds: [],
  source_kind: null,
  source_ref: null,
};

/**
 * Add and edit are the same screen. Nothing is written to the database until
 * the user presses save — the AI only ever fills the form in.
 */
export function RecipeEditScreen({ id }: { id?: string }) {
  const { user } = useAuth();
  const { recipes, loading, createRecipe, updateRecipe } = useRecipes();
  const existing = id ? recipes.find((r) => r.id === id) : undefined;

  const [draft, setDraft] = useState<Draft>(BLANK);
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoOptions, setPhotoOptions] = useState<File[]>([]);
  const [chosenPhoto, setChosenPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Thumbnails for the pictures found in the source. Object URLs are revoked
  // when the list changes, otherwise every import leaks the previous set.
  const photoThumbs = useMemo(() => photoOptions.map((f) => URL.createObjectURL(f)), [photoOptions]);
  useEffect(() => () => photoThumbs.forEach(URL.revokeObjectURL), [photoThumbs]);

  // Fill the form once the recipe being edited has arrived.
  useEffect(() => {
    if (!id || loaded || !existing) return;
    setDraft({
      title: existing.title,
      ingredients_html: existing.ingredients_html,
      instructions_html: existing.instructions_html,
      notes_html: existing.notes_html ?? "",
      image_url: existing.image_url,
      nutrition: existing.nutrition,
      categoryIds: existing.categoryIds,
      source_kind: (existing.source_kind as SourceKind | null) ?? null,
      source_ref: existing.source_ref,
    });
    setLoaded(true);
  }, [id, existing, loaded]);

  // Shown as a floating banner rather than beside the numbers: whoever edits an
  // ingredient and heads for save would never scroll far enough to see it.
  const nutritionStale = isNutritionStale(draft.nutrition, draft.ingredients_html);

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function applyParsed(
    parsed: ParsedRecipe,
    source: { kind: SourceKind; ref: string | null },
    images: File[],
  ) {
    patch({
      title: parsed.title,
      ingredients_html: parsed.ingredients_html,
      instructions_html: parsed.instructions_html,
      notes_html: parsed.notes_html ?? "",
      nutrition: parsed.nutrition,
      source_kind: source.kind,
      source_ref: source.ref,
    });
    setError(null);

    // Pictures that travelled with the source — the photos inside a Word file
    // or a PDF, or the photograph itself. The biggest is taken as the recipe's
    // photo and the rest stay on offer. The upload runs in the background: the
    // form is usable meanwhile, and a failure here costs a photo, not a recipe.
    setPhotoOptions(images);
    if (images.length > 0 && user) void adoptImage(images[0]);
  }

  async function adoptImage(image: File) {
    if (!user) return;
    setChosenPhoto(image);
    setUploadingImage(true);
    try {
      patch({ image_url: await uploadRecipeImage(user.id, image) });
    } catch {
      setError("התמונה מהמקור לא הועלתה. אפשר לבחור תמונה ידנית.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function save() {
    if (!draft.title.trim()) return setError("שם המתכון הוא שדה חובה");
    if (isBlankHtml(draft.ingredients_html)) return setError("רשימת הרכיבים היא שדה חובה");
    if (isBlankHtml(draft.instructions_html)) return setError("אופן ההכנה הוא שדה חובה");

    const input: RecipeInput = {
      title: draft.title.trim(),
      ingredients_html: draft.ingredients_html,
      instructions_html: draft.instructions_html,
      notes_html: isBlankHtml(draft.notes_html) ? null : draft.notes_html,
      image_url: draft.image_url,
      nutrition: draft.nutrition,
      categoryIds: draft.categoryIds,
      source_kind: draft.source_kind,
      source_ref: draft.source_ref,
    };

    setSaving(true);
    setError(null);
    try {
      // The editor's history entry leaves with it: "back" from the saved
      // recipe should reach the list, not a form that has already been
      // submitted, and not a second copy of the recipe left behind by the
      // last time it was edited.
      if (id) {
        await updateRecipe(id, input);
        returnTo(`/recipe/${id}`);
      } else {
        returnTo(`/recipe/${await createRecipe(input)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת המתכון נכשלה");
      setSaving(false);
    }
  }

  if (id && loading && !existing) {
    return (
      <>
        <ScreenHeader title="עריכת מתכון" />
        <main className="mx-auto w-full max-w-3xl px-3 py-6 text-sm text-muted-foreground">
          טוען…
        </main>
      </>
    );
  }

  if (id && !loading && !existing) {
    return (
      <>
        <ScreenHeader title="עריכת מתכון" />
        <main className="mx-auto w-full max-w-3xl px-3 py-6">
          <Notice kind="error">המתכון לא נמצא.</Notice>
        </main>
      </>
    );
  }

  const saveButton = (
    <Button onClick={() => void save()} disabled={saving}>
      {saving ? <Loader2 className="animate-spin" /> : <Save />}
      שמירה
    </Button>
  );

  return (
    // Extra room at the foot while the banner is up, so it never covers the
    // save button it is warning about.
    <div className={cn("min-h-dvh", nutritionStale ? "pb-40" : "pb-12")}>
      <ScreenHeader title={id ? "עריכת מתכון" : "מתכון חדש"} actions={saveButton} />

      <main className="mx-auto w-full max-w-2xl space-y-7 px-4 py-8 sm:px-6">
        {!id && <RecipeImporter onParsed={applyParsed} />}

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-base font-bold">
            שם המתכון <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="למשל: פשטידת ברוקולי"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-base font-bold">
            רכיבים <span className="text-destructive">*</span>
          </Label>
          <RichTextEditor
            value={draft.ingredients_html}
            onChange={(html) => patch({ ingredients_html: html })}
            placeholder="כל רכיב בשורה נפרדת"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-base font-bold">
            אופן ההכנה <span className="text-destructive">*</span>
          </Label>
          <RichTextEditor
            value={draft.instructions_html}
            onChange={(html) => patch({ instructions_html: html })}
            placeholder="שלבי ההכנה"
            minHeight="10rem"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-base font-bold">הערות</Label>
          <RichTextEditor
            value={draft.notes_html}
            onChange={(html) => patch({ notes_html: html })}
            placeholder="טיפים, זמני הכנה, הצעות הגשה"
            minHeight="6rem"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-base font-bold">תמונה של המתכון</Label>
          {uploadingImage ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              מעלה את התמונה מהמקור…
            </p>
          ) : (
            <ImageField value={draft.image_url} onChange={(url) => patch({ image_url: url })} />
          )}

          {/*
            More than one picture came out of the document, so the guess — the
            biggest one — is only a default, and the others are one tap away.
          */}
          {photoOptions.length > 1 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-sm text-muted-foreground">
                נמצאו {photoOptions.length} תמונות במקור. אפשר לבחור אחרת:
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {photoOptions.map((file, i) => (
                  <button
                    key={photoThumbs[i]}
                    type="button"
                    aria-label={`בחירת תמונה ${i + 1}`}
                    aria-pressed={chosenPhoto === file}
                    onClick={() => void adoptImage(file)}
                    disabled={uploadingImage}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                      chosenPhoto === file ? "border-primary" : "border-border hover:border-ring",
                    )}
                  >
                    <img src={photoThumbs[i]} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-base font-bold">קטגוריות</Label>
          <CategoryPicker
            selected={draft.categoryIds}
            onChange={(ids) => patch({ categoryIds: ids })}
          />
        </div>

        <div id={NUTRITION_ANCHOR} className="space-y-1.5 scroll-mt-24">
          <Label className="text-base font-bold">ערכים תזונתיים</Label>
          <NutritionEditor
            value={draft.nutrition}
            onChange={(nutrition) => patch({ nutrition })}
            title={draft.title}
            ingredientsHtml={draft.ingredients_html}
          />
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <div className="flex justify-end">{saveButton}</div>
      </main>

      {nutritionStale && <StaleNutritionBanner />}
    </div>
  );
}
