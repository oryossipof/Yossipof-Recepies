import { useState } from "react";

import type { Nutrition } from "@/integrations/supabase/types";
import { formatGrams, perPortion } from "@/lib/nutrition";
import { Input } from "@/components/ui/input";

// Shows the nutrition of the whole dish, then the same figures divided the
// ways the AI suggested — and any other way the reader wants to divide it.

function Row({
  label,
  values,
  emphasis = false,
}: {
  label: React.ReactNode;
  values: { calories: number; protein: number; fat: number };
  emphasis?: boolean;
}) {
  return (
    <tr className={emphasis ? "bg-secondary/40 font-semibold" : undefined}>
      <th scope="row" className="px-3 py-2 text-right font-medium">
        {label}
      </th>
      <td className="px-3 py-2 text-center tabular-nums">{values.calories}</td>
      <td className="px-3 py-2 text-center tabular-nums">{formatGrams(values.protein)}</td>
      <td className="px-3 py-2 text-center tabular-nums">{formatGrams(values.fat)}</td>
    </tr>
  );
}

export function NutritionPanel({ nutrition }: { nutrition: Nutrition }) {
  const [customCount, setCustomCount] = useState("");
  const custom = Number(customCount);
  const showCustom = Number.isFinite(custom) && custom > 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-right font-medium">
              חלוקה
            </th>
            <th scope="col" className="px-3 py-2 text-center font-medium">
              קלוריות
            </th>
            <th scope="col" className="px-3 py-2 text-center font-medium">
              חלבון (ג׳)
            </th>
            <th scope="col" className="px-3 py-2 text-center font-medium">
              שומן (ג׳)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <Row label={nutrition.total_label} values={nutrition.total} emphasis />

          {nutrition.divisions.map((division) => (
            <Row
              key={`${division.label}-${division.count}`}
              label={`${division.count} ${division.label} — ל${division.label.replace(/ים$/, "")} אחד`}
              values={perPortion(nutrition.total, division.count)}
            />
          ))}

          <tr>
            <th scope="row" className="px-3 py-2 text-right font-medium">
              <label className="flex items-center gap-2 text-muted-foreground">
                <span className="whitespace-nowrap">חלוקה אחרת ל־</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  placeholder="מס׳"
                  className="h-8 w-20"
                />
                <span>חלקים</span>
              </label>
            </th>
            {showCustom ? (
              <>
                <td className="px-3 py-2 text-center tabular-nums">
                  {perPortion(nutrition.total, custom).calories}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {formatGrams(perPortion(nutrition.total, custom).protein)}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">
                  {formatGrams(perPortion(nutrition.total, custom).fat)}
                </td>
              </>
            ) : (
              <td colSpan={3} className="px-3 py-2 text-center text-xs text-muted-foreground">
                הזינו מספר חלקים
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
