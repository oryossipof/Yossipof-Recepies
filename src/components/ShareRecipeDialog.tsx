import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Share2 } from "lucide-react";

import { recipeToPdf } from "@/lib/recipe-pdf";
import { recipeFileName, type SharedRecipe } from "@/lib/recipe-share";
import { canCarry, isDismissal, refusalDetail } from "@/lib/share";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Sends the recipe out of the app as a PDF, through the phone's own share
 * sheet — which is where WhatsApp, the mail app and the rest are chosen.
 *
 * It takes two taps, and the reason is the browser rather than the design.
 * navigator.share is only allowed inside a live gesture, worth about five
 * seconds, and drawing an A4 page — fetching the photograph, waiting on the
 * web font, painting the canvas, encoding the JPEG — outlasts that on mobile
 * data. A single tap that builds and then sends loses the race and the browser
 * refuses the sheet. So opening this dialog does the drawing, and the send
 * button is a fresh gesture with the file already in hand.
 *
 * The file lives no longer than the dialog. It is drawn because sharing was
 * asked for, never in advance, and it is dropped on the way out.
 */
export function ShareRecipeDialog({
  open,
  onClose,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  recipe: SharedRecipe;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * The dialog draws the recipe it was opened for. Held in a ref rather than
   * read as a dependency because the recipe row is rebuilt whenever anything
   * in the list changes — a favourite toggled elsewhere is enough — and a new
   * object identity behind an open dialog would throw away a finished page and
   * start drawing it again.
   */
  const drawing = useRef(recipe);
  drawing.current = recipe;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setFile(null);
    setError(null);

    recipeToPdf(drawing.current).then(
      (blob) => {
        if (cancelled) return;
        const name = recipeFileName(drawing.current.title, "pdf");
        const drawn = new File([blob], name, { type: "application/pdf" });

        /*
         * Asked here rather than on the sending tap. A browser can accept the
         * empty stand-in the button's own check uses and still refuse the real
         * document, and finding that out now costs nothing — whereas asking it
         * one instruction before navigator.share would put something between
         * the tap and the sheet, which is the one thing that must not happen.
         */
        if (!canCarry(drawn)) {
          setError("הדפדפן הזה אינו מוכן לשאת את הקובץ");
          return;
        }
        setFile(drawn);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "יצירת קובץ ה-PDF נכשלה");
      },
    );

    // Closing while the page is still being painted abandons it: the dialog is
    // gone, and so is any reason to hold what it was drawing — or to keep
    // saying what went wrong last time. Radix leaves a closed dialog in the
    // document, so an uncleared notice stays there for a screen reader to
    // find long after the dialog it belonged to has gone.
    return () => {
      cancelled = true;
      setFile(null);
      setError(null);
    };
  }, [open]);

  /*
   * navigator.share is the first thing this handler does, and that is the
   * whole design of it. The browser opens the sheet only while the tap that
   * asked for it is still live, and this phone answered "NotAllowedError:
   * Permission denied" when the call sat behind a helper function and a state
   * update — neither of which awaits anything, and both of which it minded
   * anyway. So there is no helper, no setState, and nothing but a property
   * read ahead of the call. Everything that could be asked in advance was
   * asked while the page was being drawn.
   *
   * Anything added above this line risks the sheet, however harmless it looks.
   */
  function send() {
    if (!file) return;
    navigator.share({ files: [file] }).then(onClose, (e: unknown) => {
      // Backing out of the sheet is a decision, not a failure.
      if (isDismissal(e)) {
        onClose();
        return;
      }
      // The browser's own words: the refusals are indistinguishable without
      // them, and guessing between them is what killed this feature before.
      setError(`שיתוף המתכון נכשל — ${refusalDetail(e)}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>שיתוף המתכון</DialogTitle>
          <DialogDescription>
            המתכון יישלח כקובץ PDF מצורף. אחרי הלחיצה על «שליחה» ייפתח חלון
            השיתוף של המכשיר, ובו אפשר לבחור וואטסאפ, מייל או כל אפליקציה אחרת.
          </DialogDescription>
        </DialogHeader>

        {error && <Notice kind="error">{error}</Notice>}

        <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
          {file ? (
            <>
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate" dir="auto">
                {file.name}
              </span>
            </>
          ) : (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">מכינים את המתכון…</span>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={send} disabled={!file}>
            <Share2 />
            שליחה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
