import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// The one warning in the app that must not be scrollable-past.
//
// Nutrition sits near the bottom of a long form, so a notice printed beside it
// is only seen by someone who has already scrolled to the numbers — and the
// person who most needs it is the one who edited an ingredient at the top and
// is heading straight for save. So it floats above everything until the figures
// and the ingredient list agree again, and it carries the way to get there.

export const NUTRITION_ANCHOR = "nutrition-section";

export function StaleNutritionBanner() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div
        role="alert"
        className="pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center"
      >
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            הרכיבים השתנו מאז שהערכים חושבו, והמספרים למטה עדיין מתארים את הרשימה הקודמת.
          </span>
        </p>

        <Button
          type="button"
          size="sm"
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
