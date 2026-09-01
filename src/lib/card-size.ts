/**
 * How large the recipe tiles are drawn on the main screen.
 *
 * A phone fits two tiles across at the size the app shipped with, which makes
 * every recipe a large photograph and turns a shelf of thirty into a long
 * scroll. The size is therefore a choice, not a constant: the levels below run
 * from four tiles across down to one, and the person picks the one that suits
 * the screen in their hand.
 *
 * The choice lives on the device, next to the light/dark theme, because it is
 * a view setting and not the user's data: it changes nothing about what any
 * recipe says, and the same person may well want big tiles on a tablet and
 * small ones on a phone. Anything a recipe actually contains still belongs in
 * the database.
 */

const STORAGE_KEY = "recipe-card-size";

export const CARD_SIZES = ["tiny", "small", "medium", "large"] as const;

export type CardSize = (typeof CARD_SIZES)[number];

export const DEFAULT_CARD_SIZE: CardSize = "medium";

/** What the stepper calls the size it is currently on. */
export const CARD_SIZE_LABELS: Record<CardSize, string> = {
  tiny: "זעיר",
  small: "קטן",
  medium: "בינוני",
  large: "גדול",
};

/**
 * The grid each size lays the tiles out in. Written as whole class strings on
 * purpose: Tailwind reads the source for the classes it generates, so a class
 * assembled at runtime out of pieces would never be built.
 */
export const CARD_SIZE_GRID: Record<CardSize, string> = {
  tiny: "grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 lg:gap-3",
  small: "grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4",
  medium: "grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5",
  large: "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5",
};

export function parseCardSize(value: string | null | undefined): CardSize {
  return CARD_SIZES.includes(value as CardSize) ? (value as CardSize) : DEFAULT_CARD_SIZE;
}

/** The size chosen on this device, or the shipped one if none was. */
export function readCardSize(): CardSize {
  try {
    return parseCardSize(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private mode / blocked storage.
    return DEFAULT_CARD_SIZE;
  }
}

export function writeCardSize(size: CardSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Not remembering the choice is not worth failing over.
  }
}

/**
 * One press of the stepper. `+1` grows the tiles and `-1` shrinks them; at
 * either end the size stays put, and the button that would do nothing is
 * disabled rather than silently ignored.
 */
export function stepCardSize(size: CardSize, direction: 1 | -1): CardSize {
  const next = CARD_SIZES.indexOf(size) + direction;
  return CARD_SIZES[Math.min(Math.max(next, 0), CARD_SIZES.length - 1)];
}

export function canGrow(size: CardSize): boolean {
  return size !== CARD_SIZES[CARD_SIZES.length - 1];
}

export function canShrink(size: CardSize): boolean {
  return size !== CARD_SIZES[0];
}

/**
 * How much a tile shows at each size.
 *
 * At four across, a name in the padding and type of the big tile is a
 * paragraph in a matchbox, so the smaller sizes tighten the padding, drop the
 * type down a step, and give up the second line — who uploaded a recipe, how
 * many recipes a category holds. The photograph and the name are what a person
 * scans by, and they are what survives all the way down.
 *
 * It lives here beside the grid because the recipe tiles and the category
 * tiles are the same tile: the main screen swaps what is on the shelf, not how
 * the shelf is drawn.
 */
export const CARD_TILE = {
  tiny: {
    body: "space-y-1 p-1.5",
    title: "line-clamp-2 text-[0.7rem] font-semibold leading-tight",
    meta: false,
    star: "size-6 end-1 top-1",
    starIcon: "size-3",
  },
  small: {
    body: "space-y-1 p-2.5",
    title: "line-clamp-2 text-xs font-semibold leading-snug",
    meta: false,
    star: "size-7 end-2 top-2",
    starIcon: "size-3.5",
  },
  medium: {
    body: "space-y-2 p-4",
    title: "line-clamp-2 text-[0.95rem] font-semibold leading-snug",
    meta: true,
    star: "size-8 end-3 top-3",
    starIcon: "size-4",
  },
  large: {
    body: "space-y-2 p-4",
    title: "line-clamp-2 text-lg font-semibold leading-snug",
    meta: true,
    star: "size-9 end-3 top-3",
    starIcon: "size-[1.1rem]",
  },
} as const satisfies Record<CardSize, unknown>;
