import type { Nutrition } from "@/integrations/supabase/types";

export type { Nutrition };

export type NutritionValues = { calories: number; protein: number; fat: number };

/** One decimal is as much precision as an estimate of this kind can carry. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The nutrition of a single part when the whole dish is cut into `count`. */
export function perPortion(total: NutritionValues, count: number): NutritionValues {
  if (!count || count <= 0) return { calories: 0, protein: 0, fat: 0 };
  return {
    calories: Math.round(total.calories / count),
    protein: round1(total.protein / count),
    fat: round1(total.fat / count),
  };
}

/** Formats a gram figure without a trailing ".0". */
export function formatGrams(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const EMPTY: Nutrition = {
  total_label: "כל הכמות",
  total: { calories: 0, protein: 0, fat: 0 },
  divisions: [],
};

export function emptyNutrition(): Nutrition {
  return { ...EMPTY, total: { ...EMPTY.total }, divisions: [] };
}

/**
 * Guards against a nutrition column written by an older version of the app or
 * garbled by a model, so the view never crashes on a half-filled object.
 */
export function normalizeNutrition(value: unknown): Nutrition | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Nutrition>;
  const total = raw.total;
  if (
    !total ||
    typeof total.calories !== "number" ||
    typeof total.protein !== "number" ||
    typeof total.fat !== "number"
  ) {
    return null;
  }

  const divisions = Array.isArray(raw.divisions)
    ? raw.divisions.filter(
        (d): d is { label: string; count: number } =>
          !!d && typeof d.label === "string" && typeof d.count === "number" && d.count > 1,
      )
    : [];

  return {
    total_label: typeof raw.total_label === "string" && raw.total_label ? raw.total_label : "כל הכמות",
    total: { calories: total.calories, protein: total.protein, fat: total.fat },
    divisions,
  };
}

/** True when there is nothing worth showing in the nutrition panel. */
export function isEmptyNutrition(n: Nutrition | null): boolean {
  return !n || (n.total.calories === 0 && n.total.protein === 0 && n.total.fat === 0);
}
