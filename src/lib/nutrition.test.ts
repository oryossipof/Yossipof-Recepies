import { describe, expect, it } from "vitest";

import {
  emptyNutrition,
  formatGrams,
  isEmptyNutrition,
  isNutritionStale,
  normalizeNutrition,
  nutritionBasis,
  perPortion,
} from "./nutrition";

describe("perPortion", () => {
  it("divides the whole quantity, to the precision each figure can carry", () => {
    expect(perPortion({ calories: 1000, protein: 50, fat: 33 }, 4)).toEqual({
      calories: 250,
      protein: 12.5,
      fat: 8.3,
    });
  });

  it("refuses to divide by nothing rather than returning Infinity", () => {
    expect(perPortion({ calories: 1000, protein: 50, fat: 33 }, 0)).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
    });
  });
});

describe("formatGrams", () => {
  it("drops a trailing .0 but keeps a real decimal", () => {
    expect(formatGrams(12)).toBe("12");
    expect(formatGrams(12.5)).toBe("12.5");
  });
});

describe("normalizeNutrition", () => {
  it("rejects anything without three numbers to show", () => {
    expect(normalizeNutrition(null)).toBeNull();
    expect(normalizeNutrition("8000 calories")).toBeNull();
    expect(normalizeNutrition({ total: { calories: 500, protein: 20 } })).toBeNull();
  });

  it("keeps the figures and drops divisions that divide into one", () => {
    const value = normalizeNutrition({
      total_label: "כל הפשטידה",
      total: { calories: 800, protein: 30, fat: 40 },
      divisions: [
        { label: "מנות", count: 8 },
        { label: "שלם", count: 1 },
        { label: "פגום" },
      ],
      basis: "קמח ביצים",
    });

    expect(value).toEqual({
      total_label: "כל הפשטידה",
      total: { calories: 800, protein: 30, fat: 40 },
      divisions: [{ label: "מנות", count: 8 }],
      basis: "קמח ביצים",
    });
  });

  it("falls back to a label rather than leaving the row nameless", () => {
    expect(normalizeNutrition({ total: { calories: 1, protein: 1, fat: 1 } })?.total_label).toBe(
      "כל הכמות",
    );
  });
});

describe("isEmptyNutrition", () => {
  it("treats all-zero figures as nothing worth showing", () => {
    expect(isEmptyNutrition(null)).toBe(true);
    expect(isEmptyNutrition(emptyNutrition())).toBe(true);
    expect(isEmptyNutrition({ ...emptyNutrition(), total: { calories: 1, protein: 0, fat: 0 } })).toBe(
      false,
    );
  });
});

describe("nutritionBasis", () => {
  it("remembers the food, not the formatting", () => {
    expect(nutritionBasis("<ul><li>2 ביצים</li></ul>")).toBe(
      nutritionBasis("<ul><li>2 <b>ביצים</b></li></ul>"),
    );
    expect(nutritionBasis("<p>2  ביצים\n</p>")).toBe("2 ביצים");
  });
});

describe("isNutritionStale", () => {
  const numbers = {
    total_label: "כל הכמות",
    total: { calories: 500, protein: 20, fat: 10 },
    divisions: [],
  };
  const ingredients = "<ul><li>2 ביצים</li><li>30 גרם גבינה</li></ul>";

  it("says nothing when there are no figures to doubt", () => {
    expect(isNutritionStale(null, ingredients)).toBe(false);
    expect(isNutritionStale(emptyNutrition(), ingredients)).toBe(false);
  });

  it("says nothing for figures saved before a basis was recorded", () => {
    expect(isNutritionStale({ ...numbers, basis: null }, ingredients)).toBe(false);
  });

  it("is quiet while the figures still describe the list on screen", () => {
    const saved = { ...numbers, basis: nutritionBasis(ingredients) };
    expect(isNutritionStale(saved, ingredients)).toBe(false);
  });

  it("is quiet when only the formatting of the list changed", () => {
    const saved = { ...numbers, basis: nutritionBasis(ingredients) };
    expect(isNutritionStale(saved, "<ul><li>2 <b>ביצים</b></li><li>30 גרם גבינה</li></ul>")).toBe(
      false,
    );
  });

  it("speaks up when an ingredient changed — down to a single letter", () => {
    const saved = { ...numbers, basis: nutritionBasis(ingredients) };
    expect(isNutritionStale(saved, "<ul><li>4 ביצים</li><li>30 גרם גבינה</li></ul>")).toBe(true);
    // The letter that went missing from "בצלים גדולים" in a real recipe.
    expect(isNutritionStale(saved, "<ul><li>2 ביצים</li><li>30 גרם גבינ</li></ul>")).toBe(true);
  });
});
