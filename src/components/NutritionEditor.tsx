import { useState } from "react";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";

import type { Nutrition } from "@/integrations/supabase/types";
import {
  emptyNutrition,
  formatGrams,
  isEmptyNutrition,
  isNutritionStale,
  nutritionBasis,
} from "@/lib/nutrition";
import { estimateNutrition } from "@/lib/nutrition-estimate";
import { isBlankHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/Notice";

// The AI works the three figures out; they are not fields. Nobody can know by
// looking that a pot holds 8,700 calories, and a box inviting that number to be
// typed would produce guesses indistinguishable from calculations. What a cook
// does decide stays editable: what to call the whole quantity, and the ways of
// dividing it up.
//
// The figures are only ever true of one particular ingredient list, and that
// list goes on being edited after the AI has had its say. So the editor keeps
// the list the numbers were worked out from, says plainly when the two have
// parted company, and can ask again.
//
// Asking again is a request against a small free daily allowance, so it happens
// only when the button is pressed, and the button goes quiet when the numbers
// already match the ingredients — there is nothing to be learned by asking the
// same question twice.

const FIGURES = [
  { key: "calories", label: "קלוריות" },
  { key: "protein", label: "חלבון (ג׳)" },
  { key: "fat", label: "שומן (ג׳)" },
] as const;

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function NutritionEditor({
  value,
  onChange,
  title,
  ingredientsHtml,
}: {
  value: Nutrition | null;
  onChange: (next: Nutrition | null) => void;
  title: string;
  ingredientsHtml: string;
}) {
  const nutrition = value ?? emptyNutrition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = isNutritionStale(value, ingredientsHtml);
  const noIngredients = isBlankHtml(ingredientsHtml);
  const upToDate =
    !isEmptyNutrition(value) &&
    !!nutrition.basis &&
    nutrition.basis === nutritionBasis(ingredientsHtml);

  function patch(changes: Partial<Nutrition>) {
    onChange({ ...nutrition, ...changes });
  }

  function setDivision(index: number, changes: Partial<{ label: string; count: number }>) {
    patch({
      divisions: nutrition.divisions.map((d, i) => (i === index ? { ...d, ...changes } : d)),
    });
  }

  async function recalculate() {
    setBusy(true);
    setError(null);
    try {
      const { nutrition: estimate } = await estimateNutrition({ title, ingredientsHtml });
      onChange({ ...estimate, basis: nutritionBasis(ingredientsHtml) });
    } catch (e) {
      // Whatever is on screen stays on screen: a failed estimate must never
      // cost the user numbers they already had.
      setError(e instanceof Error ? e.message : "חישוב הערכים התזונתיים נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
      {/*
        The warning itself floats above the whole screen rather than sitting
        here, where it can be scrolled past without ever being seen. What is
        left at this spot is the button turning solid, which marks *which*
        numbers the warning is about.
      */}
      <div className="space-y-1.5">
        <Button
          type="button"
          variant={stale ? "default" : "outline"}
          size="sm"
          onClick={() => void recalculate()}
          disabled={busy || noIngredients || upToDate}
        >
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {busy ? "מחשב…" : "חישוב מחדש לפי הרכיבים"}
        </Button>

        <p className="text-xs text-muted-foreground">
          {noIngredients
            ? "אפשר לחשב אחרי שתמלאו את רשימת הרכיבים."
            : upToDate
              ? "הערכים כבר מחושבים לפי הרכיבים שכתובים עכשיו."
              : "הערכה של ה-AI לכל הכמות, לפי הרכיבים והכמויות שלהם."}
        </p>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="space-y-2">
        <Label htmlFor="total-label">הכמות הכוללת</Label>
        <Input
          id="total-label"
          value={nutrition.total_label}
          onChange={(e) => patch({ total_label: e.target.value })}
          placeholder="למשל: כל הפשטידה"
        />
      </div>

      {/*
        Shown, not typed. Nobody can look at a pot of food and know it holds
        8,700 calories, so a box to enter that in would only invite a number
        that looks every bit as authoritative as a calculated one. These three
        are the result of the calculation above, and recalculating is the way
        to change them.
      */}
      <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/40 p-3 text-center">
        {FIGURES.map(({ key, label }) => (
          <div key={key} className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">
              {key === "calories"
                ? nutrition.total.calories
                : formatGrams(nutrition.total[key])}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>הצעות לחלוקה</Label>
        {nutrition.divisions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            אין הצעות חלוקה. אפשר להוסיף — למשל 12 חתיכות.
          </p>
        )}

        {nutrition.divisions.map((division, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={2}
              value={String(division.count)}
              onChange={(e) => setDivision(index, { count: numberOrZero(e.target.value) })}
              className="w-20"
              aria-label="מספר חלקים"
            />
            <Input
              value={division.label}
              onChange={(e) => setDivision(index, { label: e.target.value })}
              placeholder="חתיכות / מנות"
              aria-label="שם החלק"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="הסרת חלוקה"
              onClick={() =>
                patch({ divisions: nutrition.divisions.filter((_, i) => i !== index) })
              }
            >
              <X />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            patch({ divisions: [...nutrition.divisions, { label: "מנות", count: 4 }] })
          }
        >
          <Plus />
          הוספת חלוקה
        </Button>
      </div>
    </div>
  );
}
