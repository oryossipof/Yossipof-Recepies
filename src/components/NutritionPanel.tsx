import { useState } from "react";

import type { Nutrition } from "@/integrations/supabase/types";
import { formatGrams, perPortion } from "@/lib/nutrition";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The nutrition of the whole dish, then the same figures divided the ways the
// AI suggested — and any other way the reader wants to divide it.
//
// No colour and no fills: hairline rules and a single tinted total row are
// enough structure for four rows, and a striped, shaded table would be the
// loudest thing on an otherwise quiet page.

const COLUMNS = ["calories", "protein", "fat"] as const;

const HEADINGS: Record<(typeof COLUMNS)[number], string> = {
  calories: "קלוריות",
  protein: "חלבון",
  fat: "שומן",
};

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
    <tr className={emphasis ? "bg-primary/10" : undefined}>
      <th
        scope="row"
        className={cn(
          "px-4 py-3 text-right text-sm",
          emphasis ? "font-semibold" : "font-normal text-muted-foreground",
        )}
      >
        {label}
      </th>
      {COLUMNS.map((key) => (
        <td
          key={key}
          className={cn(
            "px-4 py-3 text-center tabular-nums",
            emphasis ? "text-base font-semibold" : "text-sm",
          )}
        >
          {key === "calories" ? values.calories : formatGrams(values[key])}
        </td>
      ))}
    </tr>
  );
}

export function NutritionPanel({ nutrition }: { nutrition: Nutrition }) {
  const [customCount, setCustomCount] = useState("");
  const custom = Number(customCount);
  const showCustom = Number.isFinite(custom) && custom > 1;
  const customValues = perPortion(nutrition.total, custom);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[22rem] border-collapse">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              חלוקה
            </th>
            {COLUMNS.map((key) => (
              <th key={key} scope="col" className="px-4 py-2.5 text-center font-medium">
                {HEADINGS[key]}
                {key !== "calories" && <span className="opacity-70"> (ג׳)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <Row label={nutrition.total_label} values={nutrition.total} emphasis />

          {/*
            "1 מתוך 8 מנות" rather than a singular form of the label: Hebrew
            plurals do not reduce by rule (מנות → מנה, חתיכות → חתיכה,
            כדורים → כדור), and the model supplies the label, so any attempt to
            singularise it mechanically produces nonsense for some recipe.
          */}
          {nutrition.divisions.map((division) => (
            <Row
              key={`${division.label}-${division.count}`}
              label={`1 מתוך ${division.count} ${division.label}`}
              values={perPortion(nutrition.total, division.count)}
            />
          ))}

          <tr>
            <th scope="row" className="px-4 py-3 text-right font-normal">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="whitespace-nowrap">חלוקה אחרת ל־</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  placeholder="מס׳"
                  className="h-8 w-16 text-center"
                />
              </label>
            </th>
            {showCustom ? (
              COLUMNS.map((key) => (
                <td key={key} className="px-4 py-3 text-center text-sm tabular-nums">
                  {key === "calories" ? customValues.calories : formatGrams(customValues[key])}
                </td>
              ))
            ) : (
              <td colSpan={3} className="px-4 py-3 text-center text-xs text-muted-foreground">
                —
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
