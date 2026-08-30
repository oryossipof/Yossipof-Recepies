import { describe, expect, it } from "vitest";

import { buildPdf } from "./pdf";
import {
  hasNutrition,
  nutritionRows,
  recipeFileName,
  recipeSections,
  type SharedRecipe,
} from "./recipe-share";

const recipe: SharedRecipe = {
  title: "עוגת שוקולד",
  ingredientsHtml:
    "<ul><li><b>לבצק:</b></li><li>2 כוסות קמח</li><li>100 גרם חמאה</li></ul>",
  instructionsHtml: "<p>מחממים תנור ל-180 מעלות.</p><p>מערבבים הכול.</p>",
  notesHtml: "",
  imageUrl: null,
  nutrition: {
    total_label: "כל הכמות",
    total: { calories: 2400, protein: 45.5, fat: 90 },
    divisions: [{ label: "פרוסות", count: 8 }],
  },
  author: "סבתא",
  categories: ["קינוחים", "אפייה"],
  url: "https://example.com/#/recipe/abc",
};

describe("recipeSections", () => {
  it("leaves out a field with nothing in it", () => {
    expect(recipeSections(recipe).map((section) => section.title)).toEqual([
      "רכיבים",
      "אופן ההכנה",
    ]);
  });

  it("marks the heading inside the ingredient list", () => {
    const ingredients = recipeSections(recipe)[0];
    expect(ingredients.lines).toEqual([
      { text: "לבצק:", heading: true },
      { text: "2 כוסות קמח", heading: false },
      { text: "100 גרם חמאה", heading: false },
    ]);
  });

  it("carries no markup through to the page", () => {
    for (const section of recipeSections(recipe)) {
      for (const line of section.lines) expect(line.text).not.toMatch(/<[a-z/]/i);
    }
  });
});

describe("nutritionRows", () => {
  it("puts the whole dish first and divides the rest", () => {
    expect(hasNutrition(recipe)).toBe(true);
    expect(nutritionRows(recipe.nutrition!)).toEqual([
      { label: "כל הכמות", values: { calories: 2400, protein: 45.5, fat: 90 }, total: true },
      {
        label: "1 מתוך 8 פרוסות",
        values: { calories: 300, protein: 5.7, fat: 11.3 },
        total: false,
      },
    ]);
  });

  it("says there is nothing to print when the figures are all zero", () => {
    const empty = {
      ...recipe,
      nutrition: { total_label: "כל הכמות", total: { calories: 0, protein: 0, fat: 0 }, divisions: [] },
    };
    expect(hasNutrition(empty)).toBe(false);
  });
});

describe("recipeFileName", () => {
  it("keeps Hebrew and drops what a file system will not take", () => {
    expect(recipeFileName('עוגה "של" סבתא/אמא', "pdf")).toBe("עוגה של סבתא אמא.pdf");
  });

  it("still answers with a name when the title is nothing but punctuation", () => {
    expect(recipeFileName("///", "pdf")).toBe("מתכון.pdf");
  });
});

describe("buildPdf", () => {
  it("writes a file a reader can open, whatever the title is written in", async () => {
    const blob = buildPdf(
      [{ jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), pixelWidth: 4, pixelHeight: 4 }],
      { title: "עוגת שוקולד", width: 595.28, height: 841.89 },
    );

    // Read as Latin-1 so the JPEG's bytes are not mangled into replacement
    // characters on the way to being checked.
    const text = new TextDecoder("latin1").decode(await blob.arrayBuffer());

    expect(blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Filter /DCTDecode");
    // The Hebrew title travels as UTF-16, which is the only encoding a PDF
    // string can carry it in.
    expect(text).toContain("/Title <FEFF05E205D505D205EA");

    // Every offset in the cross-reference table has to land on the object it
    // names, or the file opens empty.
    const startxref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...text.matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries).toHaveLength(6);
    entries.forEach((entry, index) => {
      expect(text.slice(Number(entry[1])).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });
});
