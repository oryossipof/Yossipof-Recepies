import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useRecipes } from "@/hooks/use-recipes";
import { errorMessage } from "@/lib/errors";
import { uploadRecipeImage } from "@/lib/images";

import { Notice } from "./Notice";

/**
 * The photograph at the head of a recipe, and the one thing on the screen that
 * anyone may change. Whoever cooked the dish and photographed how it came out
 * can put that picture here — on their own recipe or on somebody else's — while
 * the recipe itself stays its owner's to edit. The new photo replaces the old
 * one for everybody, which is the point: the family book should show the dish
 * as it is actually made, not as the first person to type it in photographed it
 * once.
 *
 * Removing a photo without putting another in its place stays with the owner,
 * in the editor. Replacing a picture is an improvement; leaving a recipe with
 * none is a loss, and not one to hand to a passer-by.
 */
export function RecipePhoto({
  recipeId,
  title,
  imageUrl,
}: {
  recipeId: string;
  title: string;
  imageUrl: string | null;
}) {
  const { user } = useAuth();
  const { setRecipeImage } = useRecipes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file || !user) return;

    setBusy(true);
    setError(null);
    try {
      // The file lands in the chooser's own folder in storage — everyone may
      // write there — and only then is the recipe pointed at it.
      await setRecipeImage(recipeId, await uploadRecipeImage(user.id, file));
    } catch (e) {
      setError(errorMessage(e, "החלפת התמונה נכשלה"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
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

        {/*
          On the picture rather than beside it: with no photo the empty frame is
          itself the invitation, and with one the button has to say that this
          picture is what it changes.
        */}
        {user && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            <button
              type="button"
              aria-label={imageUrl ? "החלפת תמונת המתכון" : "הוספת תמונה למתכון"}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-2 end-2 inline-flex items-center gap-1.5 rounded-full bg-card/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {busy ? "מעלה…" : imageUrl ? "החלפת תמונה" : "הוספת תמונה"}
            </button>
          </>
        )}
      </div>

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
