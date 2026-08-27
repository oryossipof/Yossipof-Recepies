import type { Nutrition } from "@/integrations/supabase/types";

import { invokeFunction } from "./edge-function";
import { normalizeNutrition, type NutritionValues } from "./nutrition";
import { htmlToText } from "./sanitize-html";

// Asks the AI what an ingredient list adds up to — either as the recipe writes
// it, or with the swaps a cook actually made at the stove.
//
// The key behind this is a free-tier one with a small daily allowance, so every
// answer is cached under the exact question that produced it. Asking the same
// thing twice costs nothing at all, and cooks do ask twice: whoever swapped 9%
// cheese for 5% this week will swap it again next week.

export type Swap = { from: string; to: string };

/**
 * The answer, and — when changes were described — the same model's figures for
 * the recipe as written, worked out in the same pass.
 *
 * The baseline is what makes a comparison honest. Estimating the original and
 * the altered dish in two separate calls produces two independent guesses, and
 * the gap between them is mostly the model changing its mind about what "a kilo
 * of beef" contains rather than the ingredient that was actually swapped.
 */
export type Estimate = { nutrition: Nutrition; baseline: NutritionValues | null };

export type NutritionRequest = {
  title: string;
  ingredientsHtml: string;
  /** What was used instead of what the recipe says. Empty for the recipe as written. */
  swaps?: Swap[];
  /** Anything that does not belong to one line — "I doubled it", "no sugar". */
  note?: string;
};

/** The request reduced to exactly what is sent, and to nothing else. */
type Question = { title: string; ingredients: string; swaps: Swap[]; note: string };

/**
 * Plain text rather than the stored HTML: it is what the model needs, it is a
 * good deal smaller, and it means an edit that only changes markup — bolding an
 * ingredient — is not mistaken for a change to the food.
 */
function ask(request: NutritionRequest): Question {
  return {
    title: request.title.trim(),
    ingredients: htmlToText(request.ingredientsHtml),
    swaps: (request.swaps ?? [])
      .map((swap) => ({ from: swap.from.trim(), to: swap.to.trim() }))
      .filter((swap) => swap.from && swap.to),
    note: (request.note ?? "").trim(),
  };
}

// ------------------------------------------------------------------
// Cache
// ------------------------------------------------------------------

// Bumped when the stored shape changes, so old entries are simply ignored.
const CACHE_KEY = "nutrition-estimates-2";

/** Enough to cover the recipes anyone cooks in a season, small enough to stay tidy. */
const CACHE_LIMIT = 30;

type Entry = { question: string; estimate: Estimate };

function readCache(): Entry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch {
    // A private window, a full disk, or something else's data under our key.
    return [];
  }
}

/** Newest first, so trimming drops what has gone longest without being asked. */
function remember(question: string, estimate: Estimate): void {
  const kept = readCache().filter((entry) => entry.question !== question);
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify([{ question, estimate }, ...kept].slice(0, CACHE_LIMIT)),
    );
  } catch {
    // Not being able to remember an answer is not worth failing the answer over.
  }
}

// ------------------------------------------------------------------

export async function estimateNutrition(request: NutritionRequest): Promise<Estimate> {
  const question = ask(request);
  if (!question.ingredients) throw new Error("אין רשימת רכיבים לחשב לפיה");

  const key = JSON.stringify(question);
  const cached = readCache().find((entry) => entry.question === key);
  if (cached) {
    const nutrition = normalizeNutrition(cached.estimate?.nutrition);
    if (nutrition) return { nutrition, baseline: cached.estimate.baseline ?? null };
  }

  const data = await invokeFunction<{ nutrition?: unknown; baseline?: NutritionValues | null }>(
    "parse-recipe",
    { kind: "nutrition", ...question },
    "חישוב הערכים התזונתיים נכשל. נסו שוב.",
  );

  const nutrition = normalizeNutrition(data?.nutrition);
  if (!nutrition) throw new Error("לא התקבלו ערכים תזונתיים מהשרת");

  const estimate: Estimate = { nutrition, baseline: data?.baseline ?? null };
  remember(key, estimate);
  return estimate;
}
