import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// The one warning in the app that must not be scrollable-past.
//
// Nutrition sits near the bottom of a long form, so a notice printed beside it
// is only seen by someone who has already scrolled to the numbers — and the
// person who most needs it is the one who edited an ingredient at the top and
// is heading straight for save. So it floats above everything until the figures
// and the ingredient list agree again, and it carries the way to get there.

export const NUTRITION_ANCHOR = "nutrition-section";

/**
 * Where the banner can actually be seen.
 *
 * The foot of the screen is the wrong place to be while the on-screen keyboard
 * is up — which is exactly when this warning has something to say, since it
 * appears the moment an ingredient is edited. On iOS, and on the Android
 * browsers where the keyboard resizes only the visual viewport, `position:
 * fixed` stays pinned to the full layout viewport and the banner spends the
 * whole edit behind the keyboard. Where the keyboard does shrink the layout
 * instead, the banner survives but lands on the lip of the keyboard, over the
 * field being typed into.
 *
 * So while the keyboard is up it moves to the head of the visible area, and it
 * returns to the foot of the screen once the keyboard closes. Safari's own
 * bottom toolbar hides it down there too, so that much — anything shorter than
 * a keyboard — is simply lifted over.
 */
type Placement = { edge: "top" | "bottom"; offset: number };

/** Taller than any browser toolbar, shorter than any keyboard. */
const KEYBOARD_HEIGHT = 150;

/**
 * The height of the page with no keyboard over it, kept from the last moment
 * nobody was typing. Browsers that shrink the layout viewport for the keyboard
 * leave no gap between the two viewports to measure, so this is the only thing
 * left to compare against — and it lives outside the hook so that a banner
 * appearing mid-edit still has a resting height to remember.
 */
let restingHeight = document.documentElement.clientHeight;

/** True when the focus is in something a keyboard would have opened for. */
function typingOnATouchScreen(): boolean {
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function usePlacement(): Placement {
  const [placement, setPlacement] = useState<Placement>({ edge: "bottom", offset: 0 });

  useEffect(() => {
    function measure() {
      const viewport = window.visualViewport;
      const layout = document.documentElement.clientHeight;
      // The gap between the page and the part of it on screen: whatever is
      // covering the foot of the layout viewport.
      const covered = viewport ? layout - viewport.height - viewport.offsetTop : 0;
      const typing = typingOnATouchScreen();

      // Nobody is typing, so this is the page at rest — including after a
      // rotation, which changes the height without a keyboard being involved.
      if (!typing) restingHeight = layout;

      // A keyboard is up when the visible part of the page is a keyboard's
      // worth shorter than the page, or — where the keyboard shrinks the page
      // itself — when the page is that much shorter than it rests at. Focus
      // alone is never enough: it stays in the field after the keyboard is
      // dismissed, and the warning would be stranded at the top of the screen.
      const keyboardOpen =
        covered > KEYBOARD_HEIGHT || (typing && restingHeight - layout > KEYBOARD_HEIGHT);

      if (keyboardOpen) {
        // The visual viewport slides the page up to keep the caret in sight, so
        // its offset is where the top of what the user can see now is — except
        // that the screen header may be sitting there, and burying its save
        // button under the warning about saving would be a poor trade.
        const seen = Math.round(viewport?.offsetTop ?? 0);
        const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        setPlacement({ edge: "top", offset: Math.max(seen, Math.round(header)) });
        return;
      }

      // A pinch-zoom shrinks the visual viewport too; clamp so that never
      // strands the banner in the middle of the screen.
      const lift = Math.min(Math.max(0, Math.round(covered)), layout * 0.6);
      setPlacement({ edge: "bottom", offset: lift });
    }

    measure();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    // Where the keyboard resizes the page rather than the viewport there is no
    // viewport event to read, so the field being edited is watched as well.
    window.addEventListener("focusin", measure);
    window.addEventListener("focusout", measure);

    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("focusin", measure);
      window.removeEventListener("focusout", measure);
    };
  }, []);

  return placement;
}

export function StaleNutritionBanner() {
  const { edge, offset } = usePlacement();

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 px-4",
        // The safe-area inset keeps it clear of the home indicator in the
        // installed app, where there is no toolbar for the measurement above to
        // find. It reads as zero while the keyboard is up, so the two never add
        // up against each other.
        edge === "bottom" ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pt-3",
      )}
      style={edge === "bottom" ? { bottom: offset } : { top: offset }}
    >
      <div
        role="alert"
        className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/95 p-3 text-destructive-foreground shadow-lg sm:flex-row sm:items-center"
      >
        <p className="flex items-start gap-2 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            הרכיבים השתנו מאז שהערכים חושבו, והמספרים למטה עדיין מתארים את הרשימה הקודמת.
          </span>
        </p>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0 sm:mr-auto"
          onClick={() =>
            document
              .getElementById(NUTRITION_ANCHOR)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        >
          מעבר לערכים
        </Button>
      </div>
    </div>
  );
}
