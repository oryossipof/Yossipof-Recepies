import { Plus, X } from "lucide-react";

import type { Nutrition } from "@/integrations/supabase/types";
import { emptyNutrition } from "@/lib/nutrition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The AI fills this in, but its figures are an estimate, so every number stays
// editable — including the suggested ways to divide the dish.

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function NutritionEditor({
  value,
  onChange,
}: {
  value: Nutrition | null;
  onChange: (next: Nutrition | null) => void;
}) {
  const nutrition = value ?? emptyNutrition();

  function patch(changes: Partial<Nutrition>) {
    onChange({ ...nutrition, ...changes });
  }

  function patchTotal(changes: Partial<Nutrition["total"]>) {
    patch({ total: { ...nutrition.total, ...changes } });
  }

  function setDivision(index: number, changes: Partial<{ label: string; count: number }>) {
    patch({
      divisions: nutrition.divisions.map((d, i) => (i === index ? { ...d, ...changes } : d)),
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-3">
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
