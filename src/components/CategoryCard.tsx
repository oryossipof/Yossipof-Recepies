import { CARD_TILE, DEFAULT_CARD_SIZE, type CardSize } from "@/lib/card-size";
import { cn } from "@/lib/utils";

/**
 * One category on the main screen, drawn as the recipes are.
 *
 * A category has no photograph of its own, so it borrows the ones inside it:
 * up to four of its recipes' pictures, tiled into the same 4:3 frame a recipe
 * fills with one. That way a shelf of categories reads at a glance like the
 * shelf of recipes it stands for, instead of turning into a list of words —
 * and the tile still shrinks and grows with the same header buttons.
 */
export function CategoryCard({
  name,
  count,
  covers,
  size = DEFAULT_CARD_SIZE,
  onOpen,
}: {
  name: string;
  count: number;
  covers: string[];
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
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          <Mosaic covers={covers} />
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
        second row, so it moves onto the picture as a badge — it is the one
        thing a category tile says that a recipe tile does not, and losing it
        entirely would leave four identical squares of food.
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
 * The cover: one picture filling the frame, or two, three, four laid into it.
 * Three is the awkward one — the first picture takes the whole of one column
 * so the frame is filled rather than left with a hole in the corner.
 */
function Mosaic({ covers }: { covers: string[] }) {
  if (covers.length === 0) {
    return (
      <div className="flex size-full items-center justify-center">
        <span className="text-4xl opacity-45" aria-hidden>
          🗂️
        </span>
      </div>
    );
  }

  if (covers.length === 1) {
    return (
      <img
        src={covers[0]}
        alt=""
        loading="lazy"
        className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  return (
    <div
      className={cn(
        "grid size-full gap-px transition-transform duration-500 group-hover:scale-[1.03]",
        covers.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2",
      )}
    >
      {covers.map((url, index) => (
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          loading="lazy"
          className={cn(
            "size-full object-cover",
            covers.length === 3 && index === 0 && "row-span-2",
          )}
        />
      ))}
    </div>
  );
}
