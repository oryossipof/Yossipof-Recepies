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

/** The default unit of the shopping app: every item in it is counted in these. */
export const DEFAULT_UNIT = "יח׳";

/**
 * Cooking measures worth lifting off a line. A word only counts as a unit when
 * a number came before it, so "מלח" stays a product and "2 כפות" does not.
 */
const UNITS = [
  "כוסות",
  "כוס",
  "כפות",
  "כף",
  "כפיות",
  "כפית",
  "גרם",
  "ג׳",
  "ג'",
  'ק"ג',
  "ק״ג",
  "קילו",
  'מ"ל',
  "מ״ל",
  "ליטר",
  "חבילות",
  "חבילה",
  "שקיות",
  "שקית",
  "קופסאות",
  "קופסה",
  "יחידות",
  "יחידה",
  "פרוסות",
  "פרוסה",
  "שיני",
  "שן",
  "צרורות",
  "צרור",
  "קורט",
];

export type ShoppingLine = {
  /** The product as it would be written on a shopping list. */
  name: string;
  quantity: number;
  unit: string;
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

/** The cooking unit at the front of what is left, if there is one. */
function leadingUnit(text: string): { unit: string; rest: string } | null {
  for (const unit of UNITS) {
    if (!text.startsWith(unit)) continue;
    const rest = text.slice(unit.length);
    // "כוסות" opens "כוסות סוכר" but not "כוסברה": a unit has to end the word.
    if (rest && !/^[\s.,]/.test(rest)) continue;
    return { unit, rest: rest.replace(/^[\s.,]+/, "") };
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

  const measured = leadingUnit(counted.rest);
  const name = (measured?.rest ?? counted.rest).trim();

  // Nothing left once the measure is taken off — "2 כפות" on its own names no
  // product — so the line is better left as it was written.
  if (!name) return whole;

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
