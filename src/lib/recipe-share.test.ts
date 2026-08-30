import { describe, expect, it } from "vitest";

import { buildPdf } from "./pdf";
import {
  mailtoLink,
  recipeAsText,
  recipeFileName,
  recipeSections,
  whatsappLink,
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
});

describe("recipeAsText", () => {
  const text = recipeAsText(recipe);

  it("bullets the ingredients but not the heading above them", () => {
    expect(text).toContain("• 2 כוסות קמח");
    expect(text).toContain("\nלבצק:\n");
    expect(text).not.toContain("• לבצק:");
  });

  it("carries no markup out of the app", () => {
    expect(text).not.toMatch(/<[a-z/]/i);
  });

  it("writes the figures out per division", () => {
    expect(text).toContain("כל הכמות: 2400 קלוריות, 45.5 ג׳ חלבון, 90 ג׳ שומן");
    expect(text).toContain("1 מתוך 8 פרוסות: 300 קלוריות");
  });

  it("ends with a way back to the recipe itself", () => {
    expect(text.trimEnd().endsWith(recipe.url)).toBe(true);
  });
});

describe("the links a message is handed to", () => {
  it("escapes the line breaks that separate the sections", () => {
    const link = whatsappLink("שורה\nשנייה");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(link).toContain("%0A");
  });

  it("puts the recipe's name in the subject", () => {
    expect(mailtoLink("עוגת שוקולד", "גוף")).toBe(
      `mailto:?subject=${encodeURIComponent("עוגת שוקולד")}&body=${encodeURIComponent("גוף")}`,
    );
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
