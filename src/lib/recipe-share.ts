import type { Nutrition, NutritionValues } from "./nutrition";
import { formatGrams, isEmptyNutrition, perPortion } from "./nutrition";
import { htmlToLines, htmlToText, isBlankHtml, isHeadingLine } from "./sanitize-html";

/*
 * A recipe on its way out of the app.
 *
 * Sharing and the PDF are the same job done twice — the recipe read from top to
 * bottom, once as a message and once as a page — so both start here, from one
 * description of what a recipe is made of. What the screens hold is stored
 * HTML; what leaves the app is lines of text, and this is where that turns
 * over.
 *
 * Nothing here reaches the network or the database. A shared recipe is the
 * recipe exactly as it is saved: no copy is kept, and nothing about the sharing
 * is written back.
 */

/** A recipe flattened into the pieces the message and the PDF both need. */
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

/** True when the recipe carries figures worth printing or sending. */
export function hasNutrition(
  recipe: SharedRecipe,
): recipe is SharedRecipe & { nutrition: Nutrition } {
  return !isEmptyNutrition(recipe.nutrition);
}

function nutritionLine({ label, values }: NutritionRow): string {
  return (
    `${label}: ${values.calories} קלוריות, ` +
    `${formatGrams(values.protein)} ג׳ חלבון, ${formatGrams(values.fat)} ג׳ שומן`
  );
}

/**
 * The recipe as a message — what goes into WhatsApp or into the body of a mail.
 *
 * Plain text and nothing else: a recipe that arrives as a wall of HTML tags in
 * someone's mail client is not a recipe anyone will cook from. The emoji that
 * anchor the sections on screen come along, because they are what makes the
 * message skimmable on a phone.
 */
export function recipeAsText(recipe: SharedRecipe): string {
  const blocks: string[] = [`🍲 ${recipe.title}`];

  const subtitle = [recipe.author && `מאת ${recipe.author}`, recipe.categories.join(" · ")]
    .filter(Boolean)
    .join(" · ");
  if (subtitle) blocks.push(subtitle);

  for (const section of recipeSections(recipe)) {
    const lines = section.lines.map((line) =>
      // A heading inside a list is not one of the list's items, so it does not
      // take a bullet — the same distinction the shopping dialog draws.
      section.bulleted && !line.heading ? `• ${line.text}` : line.text,
    );
    blocks.push([`${section.emoji} ${section.title}`, ...lines].join("\n"));
  }

  if (hasNutrition(recipe)) {
    blocks.push(
      ["🔥 ערכים תזונתיים (הערכה)", ...nutritionRows(recipe.nutrition).map(nutritionLine)].join(
        "\n",
      ),
    );
  }

  blocks.push(`נשלח מאפליקציית המתכונים של המשפחה\n${recipe.url}`);

  return blocks.join("\n\n");
}

/**
 * WhatsApp with a message already written and no recipient chosen: wa.me hands
 * the text to whichever WhatsApp the device has — the app on a phone, the web
 * client on a computer — and lets the sender pick the chat there. Both the
 * Android phones and the iPhones in the family land in the same place.
 */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** A new mail with the recipe in it, in whatever the device calls its mail app. */
export function mailtoLink(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * A file name for the recipe. Everything a file system anywhere objects to is
 * dropped, and the name is kept short enough to survive a download folder on a
 * phone. Hebrew itself is fine — Android, iOS and Windows all take it.
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
