// Splits a raw recipe — pasted text, an uploaded file, a Google Drive link, a
// photo from the gallery or a link to a recipe page — into the app's fields,
// and estimates the nutrition of the whole dish plus useful ways to divide it.
//
// It also answers a second, much smaller question on its own: given an
// ingredient list, what are the numbers? That is what lets the editor recompute
// nutrition after the list has been changed, and what lets a cook ask what they
// actually ate after swapping an ingredient. Both live here rather than in a
// function of their own so that there is one deployment and one API key.
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

// The same estimate on its own, without the split into fields. Asked either
// about a recipe whose ingredient list has been edited, or about what someone
// actually put in the pot when they cooked it their own way.
const NUTRITION_PROMPT = `אתה מעריך ערכים תזונתיים של מנות.

קיבלת שם של מנה ורשימת רכיבים, ולעיתים גם שינויים שנעשו בפועל בזמן הבישול.
החזר JSON בלבד:

- total.calories, total.protein, total.fat — הערכה לכל הכמות שיוצאת מהרכיבים.
  קלוריות במספר שלם, חלבון ושומן בגרמים (אפשר עשירית אחת).
- total_label — תיאור קצר של הכמות הכוללת בעברית, למשל "כל הפשטידה", "כל הסיר", "כל הכמות".
- divisions — אחת עד שלוש הצעות לחלוקה של המנה, מהמתאימה ביותר למתכון הזה.
  לכל הצעה: label (למשל "חתיכות", "מנות", "כדורים") ו-count (מספר שלם).
  אל תחשב את הערכים לחלק — האפליקציה מחלקת לבד.

אם צוינו שינויים, חשב לפי מה שבאמת שימש ולא לפי המתכון המקורי:
"במקום X השתמשתי ב-Y" מחליף את הרכיב על כל ערכיו, וההערה החופשית עשויה לשנות
כמויות (למשל "הכפלתי את הכמות" או "בלי הסוכר"). רכיב שלא צוין לגביו שינוי נשאר
בדיוק כפי שהוא ברשימה.`;

// When the cook changed something, the same call is asked for both versions of
// the dish. Two separate calls would each be an independent guess, and the
// difference between them would be mostly the model changing its mind about
// what "1 kilo of beef" contains.
const COMPARISON_PROMPT = `אתה מעריך ערכים תזונתיים של מנות.

קיבלת שם של מנה, רשימת רכיבים, ורשימת שינויים שנעשו בפועל בזמן הבישול.
החזר JSON בלבד עם שתי הערכות שחושבו באותה נשימה ובאותה שיטה:

- as_written — הערכה לכל הכמות לפי המתכון בדיוק כפי שהוא כתוב, בלי השינויים.
- as_cooked — הערכה לכל הכמות לפי מה שבאמת נכנס לסיר, כולל השינויים.

חשוב מכל: שתי ההערכות חייבות להיות עקביות זו עם זו. הנח בדיוק אותן הנחות לגבי
כל רכיב שלא השתנה (אותו סוג בשר, אותה גבינה, אותו גודל כוס), כך שההפרש בין
as_written ל-as_cooked ינבע אך ורק מהשינויים עצמם.

"במקום X השתמשתי ב-Y" מחליף את הרכיב על כל ערכיו. ההערה החופשית עשויה לשנות
כמויות (למשל "הכפלתי את הכמות" או "בלי הסוכר"). רכיב שלא צוין לגביו שינוי נשאר
בדיוק כפי שהוא ברשימה, בשתי ההערכות.

בתוך as_cooked:
- total_label — תיאור קצר של הכמות הכוללת בעברית, למשל "כל הפשטידה", "כל הסיר".
- divisions — אחת עד שלוש הצעות לחלוקה, label ו-count. אל תחשב את הערכים לחלק.

קלוריות במספר שלם, חלבון ושומן בגרמים (אפשר עשירית אחת).`;

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
const TOTALS_SCHEMA = {
  type: "OBJECT",
  properties: {
    calories: { type: "NUMBER" },
    protein: { type: "NUMBER" },
    fat: { type: "NUMBER" },
  },
  required: ["calories", "protein", "fat"],
} as const;

const NUTRITION_SCHEMA = {
  type: "OBJECT",
  properties: {
    total_label: { type: "STRING" },
    total: TOTALS_SCHEMA,
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
} as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    ingredients_html: { type: "STRING" },
    instructions_html: { type: "STRING" },
    notes_html: { type: "STRING", nullable: true },
    nutrition: { ...NUTRITION_SCHEMA, nullable: true },
  },
  required: ["title", "ingredients_html", "instructions_html", "nutrition"],
} as const;

/**
 * Both versions of the dish in one answer: the recipe as written, and the dish
 * as it was actually cooked. Asking for the pair together is the whole point —
 * two separate calls produce two independent guesses, and the gap between them
 * says more about the model than about the ingredient that was swapped.
 */
const COMPARISON_SCHEMA = {
  type: "OBJECT",
  properties: {
    as_written: TOTALS_SCHEMA,
    as_cooked: NUTRITION_SCHEMA,
  },
  required: ["as_written", "as_cooked"],
} as const;

/**
 * How hard to try, and on which model first. The key is a free-tier one, so
 * every attempt is spent from a small daily allowance and the two jobs deserve
 * different budgets: splitting a whole recipe is worth the stronger model and
 * several tries, because failing it loses the user's document. Estimating
 * nutrition is a much smaller job — the cheap model does it well, and failing
 * it costs nothing, because whatever numbers are already on screen stay there.
 */
type Budget = { models: string[]; tries: number };

/** The models to try in order, with the duplicate dropped if they are the same. */
function inOrder(...models: string[]): string[] {
  return [...new Set(models)];
}

const PARSE_BUDGET: Budget = { models: inOrder(GEMINI_MODEL, GEMINI_FALLBACK_MODEL), tries: 3 };
const NUTRITION_BUDGET: Budget = {
  models: inOrder(GEMINI_FALLBACK_MODEL, GEMINI_MODEL),
  tries: 2,
};

type Task = {
  system: string;
  schema: unknown;
  parts: unknown[];
  budget: Budget;
  /** Left off to accept the model's default; pinned where sampling only hurts. */
  temperature?: number;
};

/**
 * Nutrition is arithmetic dressed as prose, and at the default sampling
 * temperature the same ingredient list comes back with materially different
 * numbers each time — enough that a second opinion on an unchanged recipe can
 * differ by a fifth. Pinning the temperature will not make an estimate correct,
 * but it does make it stable, which is what lets the app say "these numbers
 * still describe your ingredients" and mean it.
 */
const STEADY = 0;

async function callModel(apiKey: string, model: string, task: Task): Promise<Response> {
  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: task.system }] },
        contents: [{ role: "user", parts: task.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: task.schema,
          ...(task.temperature === undefined ? {} : { temperature: task.temperature }),
        },
      }),
    },
  );
}

/** Statuses worth another go: overload and rate limiting, not bad requests. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A 429 names the quota that ran out. A per-minute burst is worth waiting out;
 * the day's allowance is not — retrying that only spends whatever little is
 * left and delays the message telling the user to type the numbers in by hand.
 */
function isDailyQuota(detail: string): boolean {
  return /perday|per day/i.test(detail);
}

/**
 * Asks each model in the task's budget in turn, giving each a few attempts with
 * a growing pause in between. Gemini answers 503 "high demand" often enough
 * that a single attempt would make the app look broken when it is only busy;
 * a 404 means the model is not available to this account at all, so that one
 * moves straight on to the next. An exhausted daily quota also moves on rather
 * than retrying — each model counts against its own allowance, so the next one
 * may still have room, but hammering this one certainly will not.
 */
async function callGemini(apiKey: string, task: Task): Promise<string> {
  let overloaded = false;
  let exhausted = false;

  for (const model of task.budget.models) {
    for (let attempt = 0; attempt < task.budget.tries; attempt++) {
      const res = await callModel(apiKey, model, task);

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string") throw new Error("Gemini returned no content");
        return text;
      }

      const detail = `${model} ${res.status}: ${await res.text()}`;
      console.error("parse-recipe gemini attempt failed:", detail);

      if (res.status === 404) break;
      if (res.status === 429 && isDailyQuota(detail)) {
        exhausted = true;
        break;
      }
      if (!RETRYABLE.has(res.status)) throw new Error(`Gemini error ${detail}`);

      overloaded = true;
      await sleep(800 * (attempt + 1));
    }
  }

  throw new Error(
    exhausted
      ? "מכסת ה-AI היומית נוצלה. אפשר למלא את הערכים ידנית, או לנסות שוב מחר."
      : overloaded
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

type Totals = { calories: number; protein: number; fat: number };

/** The three figures, or null if any of them failed to arrive as a number. */
function shapeTotals(raw: unknown): Totals | null {
  const t = (raw ?? {}) as Record<string, unknown>;
  const calories = toNumber(t.calories);
  const protein = toNumber(t.protein);
  const fat = toNumber(t.fat);
  if (calories === null || protein === null || fat === null) return null;

  return { calories: Math.round(calories), protein: round1(protein), fat: round1(fat) };
}

/** The nutrition object, whether it arrived alone or inside a whole recipe. */
function shapeNutrition(raw: unknown): Parsed["nutrition"] {
  const n = (raw ?? null) as Record<string, unknown> | null;
  if (!n) return null;

  const total = shapeTotals(n.total);
  if (!total) return null;

  const divisions = Array.isArray(n.divisions)
    ? n.divisions
        .map((d) => {
          const item = (d ?? {}) as Record<string, unknown>;
          const count = toNumber(item.count);
          const label = typeof item.label === "string" ? item.label.trim() : "";
          return count && count > 1 && label ? { label, count: Math.round(count) } : null;
        })
        .filter((d): d is { label: string; count: number } => d !== null)
        .slice(0, 3)
    : [];

  return {
    total_label:
      typeof n.total_label === "string" && n.total_label.trim()
        ? n.total_label.trim()
        : "כל הכמות",
    total,
    divisions,
  };
}

function shape(raw: unknown): Parsed {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    title: typeof r.title === "string" ? r.title.trim() : "",
    ingredients_html: typeof r.ingredients_html === "string" ? r.ingredients_html : "",
    instructions_html: typeof r.instructions_html === "string" ? r.instructions_html : "",
    notes_html: typeof r.notes_html === "string" && r.notes_html.trim() ? r.notes_html : null,
    nutrition: shapeNutrition(r.nutrition ?? null),
  };
}

// ------------------------------------------------------------------
// Requests
// ------------------------------------------------------------------

type Source = { text?: string; image?: { data: string; mimeType: string } };

function sourceParts(source: Source): unknown[] {
  const parts: unknown[] = [];
  if (source.text) parts.push({ text: `המתכון הגולמי:\n\n${source.text}` });
  if (source.image) {
    parts.push({ text: "פרק את המתכון שבקובץ המצורף." });
    parts.push({ inlineData: { mimeType: source.image.mimeType, data: source.image.data } });
  }
  return parts;
}

function changesIn(body: Record<string, unknown>): { swaps: string[]; note: string } {
  const swaps = (Array.isArray(body.swaps) ? body.swaps : [])
    .map((s) => (s ?? {}) as Record<string, unknown>)
    .map((s) => ({
      from: typeof s.from === "string" ? s.from.trim() : "",
      to: typeof s.to === "string" ? s.to.trim() : "",
    }))
    .filter((s) => s.from && s.to)
    .map((s) => `- במקום "${s.from}" השתמשתי ב-"${s.to}"`);

  return { swaps, note: typeof body.note === "string" ? body.note.trim() : "" };
}

/** True when the cook did something other than what the recipe says. */
function hasChanges(body: Record<string, unknown>): boolean {
  const { swaps, note } = changesIn(body);
  return swaps.length > 0 || note.length > 0;
}

/**
 * The question behind a nutrition estimate, as one block of plain text: the
 * dish, the ingredients it is made of, and — when the cook did something else —
 * what actually went in instead. Plain text rather than the stored HTML keeps
 * the request small, which matters when the allowance is counted by the day.
 */
function nutritionQuestion(body: Record<string, unknown>): string {
  const ingredients = typeof body.ingredients === "string" ? body.ingredients.trim() : "";
  if (!ingredients) throw new Error("לא נשלחה רשימת רכיבים");

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const lines = [
    `שם המנה: ${title || "ללא שם"}`,
    "",
    "רכיבים:",
    ingredients.slice(0, MAX_SOURCE_CHARS),
  ];

  const { swaps, note } = changesIn(body);

  if (swaps.length > 0 || note) {
    lines.push("", "שינויים שנעשו בפועל:", ...swaps);
    if (note) lines.push(`- ${note}`);
  }

  return lines.join("\n");
}

// ------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const kind: string = body?.kind ?? "text";

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    // Nutrition on its own: there is no source to collect and nothing to split
    // into fields, only a question to ask about an ingredient list.
    if (kind === "nutrition") {
      const question = nutritionQuestion(body);

      // With changes, both versions come back from the one call so that the
      // difference between them is the swap and nothing else. Without changes
      // there is only one dish to weigh.
      const comparing = hasChanges(body);

      const answer = JSON.parse(
        await callGemini(apiKey, {
          system: comparing ? COMPARISON_PROMPT : NUTRITION_PROMPT,
          schema: comparing ? COMPARISON_SCHEMA : NUTRITION_SCHEMA,
          parts: [{ text: question }],
          budget: NUTRITION_BUDGET,
          temperature: STEADY,
        }),
      );

      const nutrition = shapeNutrition(comparing ? answer?.as_cooked : answer);
      if (!nutrition) throw new Error("לא הצלחתי להעריך ערכים תזונתיים לרכיבים האלה");

      return new Response(
        JSON.stringify({
          nutrition,
          baseline: comparing ? shapeTotals(answer?.as_written) : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const parsed = shape(
      JSON.parse(
        await callGemini(apiKey, {
          system: SYSTEM_PROMPT,
          schema: RESPONSE_SCHEMA,
          parts: sourceParts(source),
          budget: PARSE_BUDGET,
        }),
      ),
    );
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
