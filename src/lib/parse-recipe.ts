import { supabase } from "@/integrations/supabase/client";
import type { Nutrition } from "@/integrations/supabase/types";

import { fileToBase64 } from "./images";
import { normalizeNutrition } from "./nutrition";

// Client side of the parse-recipe Edge Function: turns whatever the user threw
// at the app into a request the function understands, and normalises what comes
// back so the editor can be filled in with it.

export type ParsedRecipe = {
  title: string;
  ingredients_html: string;
  instructions_html: string;
  notes_html: string | null;
  nutrition: Nutrition | null;
};

export type SourceKind = "text" | "file" | "url" | "drive" | "image";

type Payload =
  | { kind: "text" | "file"; text: string }
  | { kind: "url" | "drive"; url: string }
  | { kind: "image"; data: string; mimeType: string };

async function invoke(payload: Payload): Promise<ParsedRecipe> {
  const { data, error } = await supabase.functions.invoke("parse-recipe", { body: payload });

  if (error) {
    // The function reports its own failures as JSON with a Hebrew message;
    // surface that rather than the generic "non-2xx status code".
    let detail = "";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        detail = (await context.json())?.error ?? "";
      } catch {
        // Body was not JSON — fall back to the generic message.
      }
    }
    throw new Error(detail || "פירוק המתכון נכשל. נסו שוב.");
  }

  const recipe = (data as { recipe?: ParsedRecipe })?.recipe;
  if (!recipe) throw new Error("לא התקבל מתכון מהשרת");

  return { ...recipe, nutrition: normalizeNutrition(recipe.nutrition) };
}

/** Pasted text, formatting and all. */
export function parseFromText(html: string): Promise<ParsedRecipe> {
  return invoke({ kind: "text", text: html });
}

/** A link to a recipe page. */
export function parseFromUrl(url: string): Promise<ParsedRecipe> {
  return invoke({ kind: "url", url });
}

/** A Google Drive / Google Docs share link. */
export function parseFromDrive(url: string): Promise<ParsedRecipe> {
  return invoke({ kind: "drive", url });
}

/** A photo of a recipe, straight from the gallery or the camera. */
export async function parseFromImage(file: File): Promise<ParsedRecipe> {
  const { data, mimeType } = await fileToBase64(file);
  return invoke({ kind: "image", data, mimeType });
}

const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|json|html?|rtf)$/i;

/**
 * An uploaded file. Text files are read here; images and PDFs are handed to
 * the model as-is. Word documents are a zip archive and cannot be read without
 * a parser, so the user is pointed at the options that do work.
 */
export async function parseFromFile(file: File): Promise<ParsedRecipe> {
  if (file.type.startsWith("image/") || file.type === "application/pdf") {
    const { data, mimeType } = await fileToBase64(file);
    return invoke({ kind: "image", data, mimeType });
  }

  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name)) {
    const text = await file.text();
    if (!text.trim()) throw new Error("הקובץ ריק");
    return invoke({ kind: "file", text });
  }

  throw new Error(
    "סוג הקובץ אינו נתמך. אפשר להעלות קובץ טקסט, PDF או תמונה — " +
      "או פשוט להדביק את המתכון כטקסט.",
  );
}
