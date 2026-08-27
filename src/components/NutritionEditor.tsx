import { useState } from "react";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";

import type { Nutrition } from "@/integrations/supabase/types";
import { emptyNutrition, isEmptyNutrition, isNutritionStale, nutritionBasis } from "@/lib/nutrition";
import { estimateNutrition } from "@/lib/nutrition-estimate";
import { isBlankHtml } from "@/lib/sanitize-html";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/Notice";

// The AI fills this in, but its figures are an estimate, so every number stays
// editable — including the suggested ways to divide the dish.
//
// The figures are also only ever true of one particular ingredient list, and
// that list goes on being edited after the AI has had its say. So the editor
// keeps the list the numbers were worked out from, says plainly when the two
// have parted company, and can ask again.
//
// Asking again is a request against a small free daily allowance, so it happens
// only when the button is pressed, and the button goes quiet when the numbers
// already match the ingredients — there is nothing to be learned by asking the
// same question twice.

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

  /**
   * A number typed by hand is a statement about the ingredients as they stand
   * now, so it settles the question the warning was asking — no reason to go on
   * nagging about a list the user has just accounted for themselves.
   */
  function patchTotal(changes: Partial<Nutrition["total"]>) {
    patch({
      total: { ...nutrition.total, ...changes },
      basis: nutritionBasis(ingredientsHtml),
    });
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
      {stale && (
        <Notice kind="error">
          הרכיבים השתנו מאז שהערכים חושבו, והמספרים למטה עדיין מתארים את הרשימה הקודמת.
        </Notice>
      )}

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
              : "הערכה של ה-AI לכל הכמות. אפשר גם לתקן כל מספר ידנית."}
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

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="calories" className="text-xs">
            קלוריות
          </Label>
          <Input
            id="calories"
            type="number"
            inputMode="numeric"
            min={0}
            value={String(nutrition.total.calories)}
            onChange={(e) => patchTotal({ calories: numberOrZero(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="protein" className="text-xs">
            חלבון (ג׳)
          </Label>
          <Input
            id="protein"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={String(nutrition.total.protein)}
            onChange={(e) => patchTotal({ protein: numberOrZero(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fat" className="text-xs">
            שומן (ג׳)
          </Label>
          <Input
            id="fat"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={String(nutrition.total.fat)}
            onChange={(e) => patchTotal({ fat: numberOrZero(e.target.value) })}
          />
        </div>
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
