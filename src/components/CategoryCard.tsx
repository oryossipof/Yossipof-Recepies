import { CARD_TILE, DEFAULT_CARD_SIZE, type CardSize } from "@/lib/card-size";
import { cn } from "@/lib/utils";

/**
 * One category on the main screen, drawn as the recipes are.
 *
 * Where a recipe tile carries a photograph, a category carries a folder. It
 * says what the tile is before the name is read, and it says the same thing on
 * every screen in the house — which an emoji would not: 🗂️ is a different
 * drawing on a Samsung than on an iPhone, and both phones are in use here. So
 * the folder is drawn here, in the app's own blue, and scales with the tile
 * instead of with whatever the phone thinks a folder looks like.
 */
export function CategoryCard({
  name,
  count,
  size = DEFAULT_CARD_SIZE,
  onOpen,
}: {
  name: string;
  count: number;
  size?: CardSize;
  onOpen: () => void;
}) {
  const tile = CARD_TILE[size];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-200 hover:shadow-[0_8px_28px_-12px_rgb(0_0_0/0.18)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}, ${count} מתכונים`}
        className="block w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted">
          <Folder />
        </div>

        <div className={tile.body}>
          <h3 className={tile.title}>{name}</h3>
          {tile.meta && (
            <p className="text-xs text-muted-foreground">
              {count === 1 ? "מתכון אחד" : `${count} מתכונים`}
            </p>
          )}
        </div>
      </button>

      {/*
        At the small sizes the count line is dropped with the rest of the
        second row, so it moves onto the folder as a badge — it is the one
        thing a category tile says that a recipe tile does not, and losing it
        entirely would leave a screen of identical folders.
      */}
      {!tile.meta && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inline-flex items-center justify-center rounded-full bg-card/85 px-1.5 text-[0.65rem] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur",
            size === "tiny" ? "end-1 top-1 h-4" : "end-2 top-2 h-5",
          )}
        >
          {count}
        </span>
      )}
    </article>
  );
}

/**
 * The folder itself: the back, with its raised tab drawn as part of the same
 * outline, and the front panel over it. Two flat shapes in one colour at two
 * strengths — enough to read as a folder at four tiles across a phone, and no
 * more, because at that size any further detail turns to noise.
 *
 * Drawing the tab into the back panel's own path rather than as a rectangle
 * behind it matters: as a separate shape it reads as a bar floating above the
 * folder instead of a corner of it.
 *
 * The tab sits on the right, so the folder opens the way the page reads.
 */
function Folder() {
  return (
    <svg
      viewBox="0 0 96 72"
      className="h-[62%] w-auto text-primary transition-transform duration-500 group-hover:scale-[1.06]"
      fill="currentColor"
      aria-hidden
    >
      <path
        d="M10 26a6 6 0 0 1 6-6h30l7-8h27a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V26Z"
        opacity="0.4"
      />
      <rect x="10" y="31" width="76" height="33" rx="6" opacity="0.8" />
    </svg>
  );
}
