import type { Nutrition, NutritionValues } from "./nutrition";
import { isEmptyNutrition, perPortion } from "./nutrition";
import { htmlToLines, htmlToText, isBlankHtml, isHeadingLine } from "./sanitize-html";

/*
 * A recipe on its way out of the app.
 *
 * What leaves is always the PDF — shared to whichever app the phone offers, or
 * downloaded — so this file describes the recipe once, in the pieces the page
 * is drawn from, and recipe-pdf.ts draws it. Nothing here reaches the network
 * or the database: a shared recipe is the recipe exactly as it is saved, and
 * nothing about the sharing is written back.
 */

/** A recipe flattened into the pieces the printed page needs. */
export type SharedRecipe = {
  title: string;
  ingredientsHtml: string;
  instructionsHtml: string;
  notesHtml: string | null;
  imageUrl: string | null;
  nutrition: Nutrition | null;
  /** Whoever uploaded it, named as the recipe screen names them. */
  author: string;
  categories: string[];
  /** Deep link back into the app, for the family members who have an account. */
  url: string;
};

export type RecipeLine = {
  text: string;
  /**
   * "לבצק:" — a heading written as an ingredient. It is bold on screen and
   * stays bold on the page, because a flat list where it is not is a list with
   * one nonsense item in the middle of it.
   */
  heading: boolean;
};

export type RecipeSection = {
  emoji: string;
  title: string;
  lines: RecipeLine[];
  /** Ingredients read as a list; steps and notes read as prose. */
  bulleted: boolean;
};

/** The recipe's fields, in reading order, with the empty ones left out. */
export function recipeSections(recipe: SharedRecipe): RecipeSection[] {
  const fields: { emoji: string; title: string; html: string | null; bulleted: boolean }[] = [
    { emoji: "🧾", title: "רכיבים", html: recipe.ingredientsHtml, bulleted: true },
    { emoji: "👩‍🍳", title: "אופן ההכנה", html: recipe.instructionsHtml, bulleted: false },
    { emoji: "💡", title: "הערות", html: recipe.notesHtml, bulleted: false },
  ];

  return fields
    .filter((field) => !isBlankHtml(field.html))
    .map((field) => ({
      emoji: field.emoji,
      title: field.title,
      bulleted: field.bulleted,
      lines: htmlToLines(field.html)
        .map((line) => ({ text: htmlToText(line), heading: isHeadingLine(line) }))
        .filter((line) => line.text.length > 0),
    }));
}

export type NutritionRow = {
  label: string;
  values: NutritionValues;
  /** The whole dish, as against one portion of it. */
  total: boolean;
};

/** The nutrition table, in the rows the panel on screen shows. */
export function nutritionRows(nutrition: Nutrition): NutritionRow[] {
  return [
    { label: nutrition.total_label, values: nutrition.total, total: true },
    ...nutrition.divisions.map((division) => ({
      label: `1 מתוך ${division.count} ${division.label}`,
      values: perPortion(nutrition.total, division.count),
      total: false,
    })),
  ];
}

/** True when the recipe carries figures worth printing. */
export function hasNutrition(
  recipe: SharedRecipe,
): recipe is SharedRecipe & { nutrition: Nutrition } {
  return !isEmptyNutrition(recipe.nutrition);
}

/**
 * A file name for the recipe. Everything a file system anywhere objects to is
 * dropped, and the name is kept short enough to survive a download folder on a
 * phone. Hebrew itself is fine — Android, iOS and Windows all take it.
 *
 * This is also the name the recipient sees on the attachment, which is why it
 * is the recipe's own name and not something generated.
 */
export function recipeFileName(title: string, extension: string): string {
  const clean = title
    .replace(/[\\/:*?"<>|]+/g, " ")
    // Collapsing whitespace also disposes of any control character that found
    // its way into a title through a paste.
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${clean || "מתכון"}.${extension}`;
}
