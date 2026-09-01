import { CARD_SIZE_LABELS, canGrow, canShrink, stepCardSize, type CardSize } from "@/lib/card-size";

import { GZoomIn, GZoomOut } from "./GradientIcon";
import { HeaderToolButton } from "./HeaderTools";

/**
 * The two buttons in the header that make the tiles bigger or smaller.
 *
 * Just the icons: they sit in a header that already carries the search box and
 * the add button, and a word naming the current size would take room from both
 * without telling anyone anything they cannot see by looking at the grid. The
 * magnifiers say which way each button goes on their own, which matters on a
 * right-to-left screen where a plus and a minus have no agreed side. The size
 * is still named for a screen reader on each of the two buttons.
 */
export function CardSizeControl({
  value,
  onChange,
}: {
  value: CardSize;
  onChange: (size: CardSize) => void;
}) {
  return (
    <>
      <HeaderToolButton
        aria-label={`הקטנת המתכונים (כעת ${CARD_SIZE_LABELS[value]})`}
        title="הקטנה"
        disabled={!canShrink(value)}
        onClick={() => onChange(stepCardSize(value, -1))}
      >
        <GZoomOut />
      </HeaderToolButton>

      <HeaderToolButton
        aria-label={`הגדלת המתכונים (כעת ${CARD_SIZE_LABELS[value]})`}
        title="הגדלה"
        disabled={!canGrow(value)}
        onClick={() => onChange(stepCardSize(value, 1))}
      >
        <GZoomIn />
      </HeaderToolButton>
    </>
  );
}
