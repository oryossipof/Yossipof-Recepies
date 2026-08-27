import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Calculator, Loader2 } from "lucide-react";

import type { Nutrition, Swap } from "@/integrations/supabase/types";
import type { NewCookLogEntry } from "@/hooks/use-cook-log";
import { ingredientLines } from "@/lib/ingredient-lines";
import { formatGrams, type NutritionValues } from "@/lib/nutrition";
import { estimateNutrition, type Estimate } from "@/lib/nutrition-estimate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "@/components/Notice";
import { NutritionPanel } from "@/components/NutritionPanel";

// "I followed the recipe, but I used the low-fat cheese." This works out what
// was actually eaten and shows it beside what the recipe says.
//
// Nothing here changes the recipe, and nothing is kept on the device: the form
// opens empty every time, so the recipe on screen is always exactly the recipe
// that was saved. What is worth keeping goes into the cooking log instead — the
// date, the swaps and the numbers — where it can be read back and deleted.

/** Today, in the format a date input speaks, in the local timezone. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Puts the estimate on the same scale as the recipe.
 *
 * The AI is asked for both versions at once — the recipe as written and the
 * dish as it was cooked — but its figure for the recipe as written will not
 * match the one saved on the recipe: an estimate is a judgement about how fatty
 * that cut of beef is, and the judgement moves between one asking and the next.
 * Showing its raw answer would report that drift as though it were the effect
 * of swapping an ingredient.
 *
 * So only the ratio between its two figures is taken — that part is trustworthy,
 * because both were worked out in the same breath from the same assumptions —
 * and applied to the numbers the recipe already carries. Halving the oil then
 * reads as a few hundred calories off what the recipe says, which is the
 * question the cook actually asked.
 */
function anchor(estimate: Estimate, saved: Nutrition): Nutrition {
  const { nutrition, baseline } = estimate;
  if (!baseline) return nutrition;

  const scale = (key: keyof NutritionValues): number => {
    // Nothing to scale from: keep the estimate as it came.
    if (!baseline[key]) return nutrition.total[key];
    const scaled = saved.total[key] * (nutrition.total[key] / baseline[key]);
    return key === "calories" ? Math.round(scaled) : Math.round(scaled * 10) / 10;
  };

  return {
    ...nutrition,
    total: { calories: scale("calories"), protein: scale("protein"), fat: scale("fat") },
  };
}

function signed(difference: number): string {
  const rounded = Math.round(difference * 10) / 10;
  if (rounded === 0) return "±0";
  return `${rounded > 0 ? "+" : "-"}${formatGrams(Math.abs(rounded))}`;
}

/** The three figures, each as a change from what the recipe says. */
export function Difference({ from, to }: { from: NutritionValues; to: NutritionValues }) {
  const parts = [
    { text: signed(to.calories - from.calories), label: "קלוריות" },
    { text: signed(to.protein - from.protein), label: "גרם חלבון" },
    { text: signed(to.fat - from.fat), label: "גרם שומן" },
  ];

  return (
    <p className="text-sm text-muted-foreground">
      לעומת המתכון:{" "}
      {parts.map((part, i) => (
        <span key={part.label}>
          {i > 0 && " · "}
          <span dir="ltr" className="font-medium tabular-nums text-foreground">
            {part.text}
          </span>{" "}
          {part.label}
        </span>
      ))}
    </p>
  );
}

export function CookedDifferentlyDialog({
  open,
  onClose,
  title,
  ingredientsHtml,
  saved,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  ingredientsHtml: string;
  saved: Nutrition;
  onSave: (entry: NewCookLogEntry) => Promise<void>;
}) {
  const lines = useMemo(() => ingredientLines(ingredientsHtml), [ingredientsHtml]);

  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [cookedOn, setCookedOn] = useState(today);
  const [result, setResult] = useState<Nutrition | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form every time it opens. Opening is not asking, either: nothing
  // reaches the AI until the button is pressed.
  useEffect(() => {
    if (!open) return;
    setSwaps({});
    setNote("");
    setCookedOn(today());
    setResult(null);
    setAnswered(null);
    setError(null);
  }, [open]);

  const changes: Swap[] = lines
    .map((line) => ({ from: line, to: (swaps[line] ?? "").trim() }))
    .filter((swap) => swap.to);

  const question = JSON.stringify({ changes, note: note.trim() });
  const nothingChanged = changes.length === 0 && !note.trim();

  async function calculate() {
    setBusy(true);
    setError(null);
    try {
      const estimate = await estimateNutrition({
        title,
        ingredientsHtml,
        swaps: changes,
        note: note.trim(),
      });
      setResult(anchor(estimate, saved));
      setAnswered(question);
    } catch (e) {
      setError(e instanceof Error ? e.message : "החישוב נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        cooked_on: cookedOn,
        swaps: changes,
        note: note.trim() || null,
        nutrition: result,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירה ביומן נכשלה");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>בישלתי עם שינויים</DialogTitle>
          <DialogDescription>
            כתבו ליד כל רכיב במה השתמשתם בפועל, ונחשב את הערכים לפי מה שבאמת נכנס לסיר.
            המתכון עצמו נשאר בדיוק כפי שהוא.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {lines.length === 0 && <Notice kind="info">לא זוהו שורות רכיבים במתכון הזה.</Notice>}

          {lines.map((line, index) => (
            <div key={`${index}-${line}`} className="grid grid-cols-2 items-center gap-2">
              <span className="text-sm">{line}</span>
              <Input
                value={swaps[line] ?? ""}
                onChange={(e) => setSwaps((current) => ({ ...current, [line]: e.target.value }))}
                placeholder="השתמשתי ב…"
                aria-label={`במקום ${line}`}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="שינוי כללי — למשל: הכפלתי את הכמות, בלי הסוכר"
          />
          <p className="text-xs text-muted-foreground">
            שדה ריק ליד רכיב פירושו שהשתמשתם בדיוק במה שכתוב במתכון.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => void calculate()}
          disabled={busy || nothingChanged || answered === question}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Calculator />}
          {busy ? "מחשב…" : answered === question ? "החישוב מוצג למטה" : "חישוב"}
        </Button>

        {error && <Notice kind="error">{error}</Notice>}

        {result && (
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-base font-bold">🍽️ הפעם</h3>
            <NutritionPanel nutrition={result} />
            <Difference from={saved.total} to={result.total} />

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="cooked-on" className="text-xs">
                  תאריך הבישול
                </Label>
                <Input
                  id="cooked-on"
                  type="date"
                  dir="ltr"
                  value={cookedOn}
                  onChange={(e) => setCookedOn(e.target.value)}
                  className="h-9 w-44"
                />
              </div>
              <Button type="button" onClick={() => void save()} disabled={saving || !cookedOn}>
                {saving ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}
                שמירה ביומן הבישולים
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              השמירה נרשמת ביומן של המתכון בלבד. הערכים במתכון עצמו לא משתנים.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
