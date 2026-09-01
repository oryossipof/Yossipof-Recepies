/**
 * What the main screen lists: every recipe, or the categories they sit in.
 *
 * A household that has sorted its recipes into "מרקים", "קינוחים" and
 * "בשרי" often wants the shelf itself rather than everything on it at once,
 * so the header carries a switch between the two. In "categories" the main
 * screen draws one tile per category — the same tiles, the same sizes, the
 * same grid as the recipes — and opening a tile shows that category's
 * recipes.
 *
 * Like the tile size next to it in the header, this is a view preference and
 * lives on the device: it changes nothing about what any recipe contains, and
 * the same person may well want the flat list on a tablet and the categories
 * on a phone. Anything a recipe actually holds still belongs in the database.
 */

const STORAGE_KEY = "recipe-list-mode";

export const LIST_MODES = ["recipes", "categories"] as const;

export type ListMode = (typeof LIST_MODES)[number];

export const DEFAULT_LIST_MODE: ListMode = "recipes";

/** What the switch calls each mode, for the label and the screen reader. */
export const LIST_MODE_LABELS: Record<ListMode, string> = {
  recipes: "כל המתכונים",
  categories: "לפי קטגוריות",
};

/**
 * The tile that stands for the recipes belonging to no category at all.
 *
 * Without it, adding a category to some recipes would quietly hide the rest:
 * the categories screen would show shelves that between them do not hold
 * everything. It is a route segment as well as a key, so it is spelled as a
 * word rather than a real id — no category can collide with it, since ids are
 * UUIDs.
 */
export const UNCATEGORIZED = "none";

export function parseListMode(value: string | null | undefined): ListMode {
  return LIST_MODES.includes(value as ListMode) ? (value as ListMode) : DEFAULT_LIST_MODE;
}

/** The mode chosen on this device, or the shipped one if none was. */
export function readListMode(): ListMode {
  try {
    return parseListMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private mode / blocked storage.
    return DEFAULT_LIST_MODE;
  }
}

export function writeListMode(mode: ListMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Not remembering the choice is not worth failing over.
  }
}

/** The mode one press of the switch moves to. */
export function otherListMode(mode: ListMode): ListMode {
  return mode === "recipes" ? "categories" : "recipes";
}
