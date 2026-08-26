// Splits a raw recipe — pasted text, an uploaded file, a Google Drive link, a
// photo from the gallery or a link to a recipe page — into the app's fields,
// and estimates the nutrition of the whole dish plus useful ways to divide it.
//
// The three text fields come back as HTML on purpose: when the user pastes
// formatted text, the bold/italic/list markup of the source has to survive the
// split into fields, so the model is asked to carry the inline markup over
// rather than flatten it.
//
// Uses the Gemini API, the same key already used elsewhere on this account.
// Set GEMINI_API_KEY in the project's Edge Function secrets.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

/** Upper bound on how much source text is worth sending to the model. */
const MAX_SOURCE_CHARS = 40_000;

const SYSTEM_PROMPT = `אתה עוזר שמפרק מתכונים בעברית לשדות מסודרים.

קיבלת מתכון גולמי (טקסט שהודבק, תוכן של קובץ, טקסט של דף אינטרנט או תמונה של מתכון).
פרק אותו בדיוק לשדות הבאים והחזר JSON בלבד:

- title: שם המתכון. חובה. אם אין שם מפורש, תן שם קצר ומדויק לפי המנה.
- ingredients_html: רשימת הרכיבים כ-HTML. כל רכיב בשורה נפרדת בתוך <ul><li>…</li></ul>.
- instructions_html: אופן ההכנה כ-HTML. שלבים ממוספרים ב-<ol><li>…</li></ol>,
  או פסקאות <p> אם המקור אינו מחולק לשלבים.
- notes_html: הערות, טיפים, זמני הכנה, הצעות הגשה. HTML. null אם אין.
- nutrition: הערכה תזונתית.

כללי HTML — חשוב מאוד:
- שמור על העיצוב של המקור. אם קטע במקור מודגש (<b>/<strong>), הוא נשאר מודגש גם אחרי הפירוק,
  וכך גם נטוי (<i>/<em>) וקו תחתון (<u>).
- מותר להשתמש רק בתגיות: <p> <br> <ul> <ol> <li> <b> <strong> <i> <em> <u> <span>.
- אל תוסיף כותרות משנה כמו "רכיבים" או "אופן ההכנה" בתוך השדות — הן כבר קיימות באפליקציה.
- אל תמציא תוכן שאינו במקור, מלבד ההערכה התזונתית.
- שמור על שפת המקור. אם המתכון בעברית — הפלט בעברית.

הערכים התזונתיים:
- total.calories, total.protein, total.fat — הערכה לכמות הכוללת של המתכון
  (כל התבנית / כל הסיר / כל הכמות שיוצאת מהרכיבים), לפי הרכיבים והכמויות שלהם.
  קלוריות במספר שלם, חלבון ושומן בגרמים (אפשר עשירית אחת).
- total_label — תיאור קצר של הכמות הכוללת בעברית, למשל "כל הפשטידה", "כל הסיר", "כל הכמות".
- divisions — אחת עד שלוש הצעות לחלוקה של המנה, מהמתאימה ביותר למתכון הזה.
  לכל הצעה: label (למשל "חתיכות", "מנות", "כדורים") ו-count (מספר שלם).
  אל תחשב את הערכים לחלק — האפליקציה מחלקת לבד.`;

type Parsed = {
  title: string;
  ingredients_html: string;
  instructions_html: string;
  notes_html: string | null;
  nutrition: {
    total_label: string;
    total: { calories: number; protein: number; fat: number };
    divisions: { label: string; count: number }[];
  } | null;
};

// ------------------------------------------------------------------
// Source collection
// ------------------------------------------------------------------

/** Strips a fetched web page down to readable text, keeping inline emphasis. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<\/?(b|strong|i|em|u)\b[^>]*>/gi, (m) => m.toLowerCase())
    .replace(/<(?!\/?(?:b|strong|i|em|u)\b)[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rewrites a Google Drive share link into something that actually returns the
 * file body. Docs are exported as plain text; everything else is downloaded
 * directly. Only works for links shared as "anyone with the link".
 */
function driveDirectUrl(url: string): string {
  const doc = url.match(/document\/d\/([a-zA-Z0-9_-]+)/);
  if (doc) return `https://docs.google.com/document/d/${doc[1]}/export?format=txt`;

  const file = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (file) return `https://drive.google.com/uc?export=download&id=${file[1]}`;

  return url;
}

async function fetchAsText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // Some recipe sites serve a stub to unknown agents.
      "User-Agent":
        "Mozilla/5.0 (compatible; YossipofRecepies/1.0; +https://github.com/oryossipof)",
      "Accept-Language": "he,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`לא ניתן לקרוא את הכתובת (${res.status})`);

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  const text = contentType.includes("html") ? htmlToText(body) : body.trim();

  if (!text) throw new Error("לא נמצא טקסט בכתובת שנשלחה");
  return text.slice(0, MAX_SOURCE_CHARS);
}

// ------------------------------------------------------------------
// Gemini
// ------------------------------------------------------------------

/** Gemini's dialect of JSON Schema: upper-case types, `nullable` instead of unions. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    ingredients_html: { type: "STRING" },
    instructions_html: { type: "STRING" },
    notes_html: { type: "STRING", nullable: true },
    nutrition: {
      type: "OBJECT",
      nullable: true,
      properties: {
        total_label: { type: "STRING" },
        total: {
          type: "OBJECT",
          properties: {
            calories: { type: "NUMBER" },
            protein: { type: "NUMBER" },
            fat: { type: "NUMBER" },
          },
          required: ["calories", "protein", "fat"],
        },
        divisions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { label: { type: "STRING" }, count: { type: "INTEGER" } },
            required: ["label", "count"],
          },
        },
      },
      required: ["total_label", "total", "divisions"],
    },
  },
  required: ["title", "ingredients_html", "instructions_html", "nutrition"],
} as const;

type Source = { text?: string; image?: { data: string; mimeType: string } };

async function callModel(apiKey: string, model: string, source: Source): Promise<Response> {
  const parts: unknown[] = [];
  if (source.text) parts.push({ text: `המתכון הגולמי:\n\n${source.text}` });
  if (source.image) {
    parts.push({ text: "פרק את המתכון שבקובץ המצורף." });
    parts.push({ inlineData: { mimeType: source.image.mimeType, data: source.image.data } });
  }

  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );
}

/** Statuses worth another go: overload and rate limiting, not bad requests. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const ATTEMPTS_PER_MODEL = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asks the preferred model, then the lite one, giving each a few attempts with
 * a growing pause in between. Gemini answers 503 "high demand" often enough
 * that a single attempt would make the app look broken when it is only busy;
 * a 404 means the model is not available to this account at all, so that one
 * moves straight on to the fallback.
 */
async function callGemini(apiKey: string, source: Source): Promise<string> {
  const models =
    GEMINI_MODEL === GEMINI_FALLBACK_MODEL
      ? [GEMINI_MODEL]
      : [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];

  let overloaded = false;

  for (const model of models) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      const res = await callModel(apiKey, model, source);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string") throw new Error("Gemini returned no content");
        return text;
      }

      const detail = `${model} ${res.status}: ${await res.text()}`;
      console.error("parse-recipe gemini attempt failed:", detail);

      if (res.status === 404) break;
      if (!RETRYABLE.has(res.status)) throw new Error(`Gemini error ${detail}`);

      overloaded = true;
      await sleep(800 * (attempt + 1));
    }
  }

  throw new Error(
    overloaded
      ? "שירות ה-AI עמוס כרגע. נסו שוב בעוד רגע, או מלאו את השדות ידנית."
      : "שירות ה-AI אינו זמין כרגע.",
  );
}

// ------------------------------------------------------------------
// Response shaping
// ------------------------------------------------------------------

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Rounds to one decimal, so 11.63333 grams of protein reads as 11.6. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function shape(raw: unknown): Parsed {
  const r = (raw ?? {}) as Record<string, unknown>;

  const nutritionRaw = (r.nutrition ?? null) as Record<string, unknown> | null;
  let nutrition: Parsed["nutrition"] = null;

  if (nutritionRaw) {
    const totalRaw = (nutritionRaw.total ?? {}) as Record<string, unknown>;
    const calories = toNumber(totalRaw.calories);
    const protein = toNumber(totalRaw.protein);
    const fat = toNumber(totalRaw.fat);

    if (calories !== null && protein !== null && fat !== null) {
      const divisions = Array.isArray(nutritionRaw.divisions)
        ? nutritionRaw.divisions
            .map((d) => {
              const item = (d ?? {}) as Record<string, unknown>;
              const count = toNumber(item.count);
              const label = typeof item.label === "string" ? item.label.trim() : "";
              return count && count > 1 && label ? { label, count: Math.round(count) } : null;
            })
            .filter((d): d is { label: string; count: number } => d !== null)
            .slice(0, 3)
        : [];

      nutrition = {
        total_label:
          typeof nutritionRaw.total_label === "string" && nutritionRaw.total_label.trim()
            ? nutritionRaw.total_label.trim()
            : "כל הכמות",
        total: { calories: Math.round(calories), protein: round1(protein), fat: round1(fat) },
        divisions,
      };
    }
  }

  return {
    title: typeof r.title === "string" ? r.title.trim() : "",
    ingredients_html: typeof r.ingredients_html === "string" ? r.ingredients_html : "",
    instructions_html: typeof r.instructions_html === "string" ? r.instructions_html : "",
    notes_html: typeof r.notes_html === "string" && r.notes_html.trim() ? r.notes_html : null,
    nutrition,
  };
}

// ------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const kind: string = body?.kind ?? "text";
    const source: Source = {};

    switch (kind) {
      case "text":
      case "file": {
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) throw new Error("לא נשלח טקסט מתכון");
        source.text = text.slice(0, MAX_SOURCE_CHARS);
        break;
      }
      case "url": {
        if (typeof body.url !== "string" || !body.url.trim()) {
          throw new Error("לא נשלחה כתובת");
        }
        source.text = await fetchAsText(body.url.trim());
        break;
      }
      case "drive": {
        if (typeof body.url !== "string" || !body.url.trim()) {
          throw new Error("לא נשלח קישור ל-Google Drive");
        }
        source.text = await fetchAsText(driveDirectUrl(body.url.trim()));
        break;
      }
      case "image": {
        if (typeof body.data !== "string" || !body.data) {
          throw new Error("לא נשלחה תמונה");
        }
        source.image = {
          data: body.data.replace(/^data:[^;]+;base64,/, ""),
          mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/jpeg",
        };
        break;
      }
      default:
        throw new Error(`מקור לא מוכר: ${kind}`);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const parsed = shape(JSON.parse(await callGemini(apiKey, source)));
    if (!parsed.title && !parsed.ingredients_html) {
      throw new Error("לא הצלחתי לזהות מתכון במקור שנשלח");
    }

    return new Response(JSON.stringify({ recipe: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-recipe error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
