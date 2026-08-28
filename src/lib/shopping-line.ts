// Turning a line of a recipe into a line of a shopping list.
//
// The two are not the same sentence. A recipe says "2 כפות סוכר" because that
// is what goes in the bowl; a shopping list says "סוכר", because that is what
// you pick up in the shop. So the quantity and the cooking unit are lifted off
// the front of the line into their own fields, where they can be corrected —
// the shopper is the one who knows whether a kilo of flour is the right amount
// to buy — and the name is left as the product it names.
//
// Nothing here is clever about it. Everything it parses is shown to the cook in
// editable fields before a single item is sent, so a wrong guess costs a tap.

/**
 * The units the shopping app offers, in its order and its spelling.
 *
 * Copied from that app's own add-item form, which is what every item in the
 * list was written with. (Its item card lists the same seven with ASCII
 * apostrophes instead of Hebrew ones — a discrepancy in that app, not a choice
 * to follow: matching the form is what matches the data.)
 *
 * An item sent from here has to carry one of exactly these, or the shopping app
 * will show a unit its own picker cannot offer.
 */
export const SHOPPING_UNITS = ["יח׳", "ק״ג", "גרם", "ליטר", "מ״ל", "חבילה", "קופסה"] as const;

export const DEFAULT_UNIT = SHOPPING_UNITS[0];

/**
 * Cooking measures worth lifting off a line, and what each is worth in a shop.
 *
 * A weight or a volume translates: a kilo of flour is bought by the kilo. A
 * spoonful does not — sugar is sold by the bag however much of it the recipe
 * wants — so those map to nothing, and the line is shopped for as one of the
 * thing. The measure itself is not lost: it travels to the list as a note.
 *
 * A word only counts as a measure when a number came before it, so "מלח" stays
 * a product and "2 כפות" does not become one.
 */
const MEASURES: { word: string; unit: (typeof SHOPPING_UNITS)[number] | null }[] = [
  { word: "כוסות", unit: null },
  { word: "כוס", unit: null },
  { word: "כפות", unit: null },
  { word: "כף", unit: null },
  { word: "כפיות", unit: null },
  { word: "כפית", unit: null },
  { word: "קורט", unit: null },
  { word: "שיני", unit: null },
  { word: "שן", unit: null },
  { word: "פרוסות", unit: null },
  { word: "פרוסה", unit: null },
  { word: "צרורות", unit: null },
  { word: "צרור", unit: null },
  { word: "גרם", unit: "גרם" },
  { word: "ג׳", unit: "גרם" },
  { word: "ג'", unit: "גרם" },
  { word: 'ק"ג', unit: "ק״ג" },
  { word: "ק״ג", unit: "ק״ג" },
  { word: "קילוגרם", unit: "ק״ג" },
  { word: "קילו", unit: "ק״ג" },
  { word: 'מ"ל', unit: "מ״ל" },
  { word: "מ״ל", unit: "מ״ל" },
  { word: "מיליליטר", unit: "מ״ל" },
  { word: "ליטר", unit: "ליטר" },
  { word: "חבילות", unit: "חבילה" },
  { word: "חבילה", unit: "חבילה" },
  { word: "קופסאות", unit: "קופסה" },
  { word: "קופסה", unit: "קופסה" },
  { word: "שקיות", unit: "חבילה" },
  { word: "שקית", unit: "חבילה" },
  { word: "יחידות", unit: "יח׳" },
  { word: "יחידה", unit: "יח׳" },
];

export type ShoppingLine = {
  /** The product as it would be written on a shopping list. */
  name: string;
  quantity: number;
  /** Always one of SHOPPING_UNITS, so the other app can show it. */
  unit: (typeof SHOPPING_UNITS)[number];
};

/**
 * The leading quantity of a line, if it opens with one.
 *
 * "3-4 בצלים" is a range, and a shopper buying for it buys the larger number.
 * A number that is part of the product — the 3% of "חלב 3%" — never opens the
 * line, so this only ever looks at the front.
 */
function leadingQuantity(text: string): { quantity: number; rest: string } | null {
  const match = text.match(/^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s+(.*)$/);
  if (!match) return null;

  const [, first, second, rest] = match;
  const quantity = Number((second ?? first).replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return { quantity, rest };
}

/** The cooking measure at the front of what is left, if there is one. */
function leadingMeasure(
  text: string,
): { unit: (typeof SHOPPING_UNITS)[number] | null; rest: string } | null {
  for (const measure of MEASURES) {
    if (!text.startsWith(measure.word)) continue;
    const rest = text.slice(measure.word.length);
    // "כוסות" opens "כוסות סוכר" but not "כוסברה": a measure has to end the word.
    if (rest && !/^[\s.,]/.test(rest)) continue;
    return { unit: measure.unit, rest: rest.replace(/^[\s.,]+/, "") };
  }
  return null;
}

/**
 * Splits an ingredient line into what to buy, how much, and in what.
 *
 * A line that opens with no number is left whole and counted as one: "מלח
 * ופלפל" is a thing to buy, not a measure of anything.
 */
export function parseShoppingLine(line: string): ShoppingLine {
  const text = line.replace(/\s+/g, " ").trim();
  const whole: ShoppingLine = { name: text, quantity: 1, unit: DEFAULT_UNIT };

  const counted = leadingQuantity(text);
  if (!counted) return whole;

  const measured = leadingMeasure(counted.rest);
  const name = (measured?.rest ?? counted.rest).trim();

  // Nothing left once the measure is taken off — "2 כפות" on its own names no
  // product — so the line is better left as it was written.
  if (!name) return whole;

  // A measure that means nothing in a shop takes its number with it: three
  // cups of flour is one bag of flour, not three of anything. A bare count is
  // a count of the product itself and stays — three eggs are three eggs.
  if (measured && !measured.unit) return { name, quantity: 1, unit: DEFAULT_UNIT };

  return {
    name,
    quantity: counted.quantity,
    unit: measured?.unit ?? DEFAULT_UNIT,
  };
}

/**
 * Canonical form of a product name, used only for telling whether a product is
 * already in the list — never for display or storage.
 *
 * Copied from the shopping app (`src/lib/normalize-name.ts`) so that "already in
 * the list" means exactly the same thing on both sides of the two apps: קוטג׳
 * with a geresh, קוטג' with an apostrophe and קוטג are one product.
 */
export function normalizeProductName(name: string): string {
  return name
    .replace(/[׳״'"`‘’“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Digits only, the way the shopping app stores a phone number. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** Israeli mobile numbers, as the shopping app's gate accepts them. */
export function isValidPhone(input: string): boolean {
  return normalizePhone(input).length === 10;
}
