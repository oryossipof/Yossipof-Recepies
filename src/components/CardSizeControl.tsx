import { ZoomIn, ZoomOut } from "lucide-react";

import { CARD_SIZE_LABELS, canGrow, canShrink, stepCardSize, type CardSize } from "@/lib/card-size";
import { Button } from "@/components/ui/button";

/**
 * The two buttons in the header that make the recipe tiles bigger or smaller.
 *
 * Just the icons: they sit in a header that already carries the search box and
 * the add button, and a word naming the current size would take room from both
 * without telling anyone anything they cannot see by looking at the grid. The
 * magnifiers say which way each button goes on their own, which matters on a
 * right-to-left screen where a plus and a minus have no agreed side. The size
 * is still named for a screen reader, on the group and on each button.
 */
export function CardSizeControl({
  value,
  onChange,
}: {
  value: CardSize;
  onChange: (size: CardSize) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`גודל המתכונים: ${CARD_SIZE_LABELS[value]}`}
      className="flex items-center"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={`הקטנת המתכונים (כעת ${CARD_SIZE_LABELS[value]})`}
        title="הקטנת המתכונים"
        disabled={!canShrink(value)}
        onClick={() => onChange(stepCardSize(value, -1))}
        className="text-muted-foreground"
      >
        <ZoomOut />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`הגדלת המתכונים (כעת ${CARD_SIZE_LABELS[value]})`}
        title="הגדלת המתכונים"
        disabled={!canGrow(value)}
        onClick={() => onChange(stepCardSize(value, 1))}
        className="text-muted-foreground"
      >
        <ZoomIn />
      </Button>
    </div>
  );
}
