import { supabase } from "@/integrations/supabase/client";
import type { Nutrition } from "@/integrations/supabase/types";

import { docxToHtml, isDocx, isLegacyDoc } from "./docx";
import { readDriveFile, type DrivePick } from "./google-drive";
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

/**
 * A file chosen in the Google Drive picker. The bytes are fetched in the
 * browser with the picker's own access token, so the file does not have to be
 * shared publicly and the token never reaches the server.
 */
export async function parseFromDrivePick(pick: DrivePick): Promise<ParsedRecipe> {
  const content = await readDriveFile(pick);

  return content.kind === "text"
    ? invoke({ kind: "file", text: content.text })
    : invoke({ kind: "image", data: content.data, mimeType: content.mimeType });
}

/**
 * A Google Drive / Google Docs share link. Only used as a fallback, when the
 * picker has no credentials configured; it needs a publicly shared link.
 */
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
 * An uploaded file. Word documents and text files are read here; images and
 * PDFs are handed to the model as-is.
 */
export async function parseFromFile(file: File): Promise<ParsedRecipe> {
  if (file.type.startsWith("image/") || file.type === "application/pdf") {
    const { data, mimeType } = await fileToBase64(file);
    return invoke({ kind: "image", data, mimeType });
  }

  if (isDocx(file.name, file.type)) {
    return invoke({ kind: "file", text: docxToHtml(await file.arrayBuffer()) });
  }

  if (isLegacyDoc(file.name, file.type)) {
    throw new Error(
      "הקובץ שמור בפורמט Word הישן (doc.). שמרו אותו מחדש כ-docx. " +
        "או העתיקו והדביקו את המתכון כטקסט.",
    );
  }

  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.test(file.name)) {
    const text = await file.text();
    if (!text.trim()) throw new Error("הקובץ ריק");
    return invoke({ kind: "file", text });
  }

  throw new Error(
    "סוג הקובץ אינו נתמך. אפשר להעלות מסמך Word, קובץ טקסט, PDF או תמונה — " +
      "או פשוט להדביק את המתכון כטקסט.",
  );
}
