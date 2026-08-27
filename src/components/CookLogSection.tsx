import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import type { CookLogEntry } from "@/hooks/use-cook-log";
import type { Nutrition } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Difference } from "@/components/CookedDifferentlyDialog";
import { Notice } from "@/components/Notice";
import { NutritionPanel } from "@/components/NutritionPanel";

// Every time this recipe was cooked with something swapped: when it was, what
// went in instead, and what it came to. The recipe above is untouched by all of
// it — this is the record of the cooking, not a second version of the dish.

/** "27 באוגוסט 2026", built from the date parts so no timezone can shift the day. */
function hebrewDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Entry({
  entry,
  recipeNutrition,
  onDelete,
}: {
  entry: CookLogEntry;
  recipeNutrition: Nutrition | null;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{hebrewDate(entry.cooked_on)}</span>
        <Button variant="ghost" size="icon" aria-label="מחיקת הרישום" onClick={onDelete}>
          <Trash2 className="text-destructive" />
        </Button>
      </div>

      <ul className="space-y-1 text-sm">
        {entry.swaps.map((swap, i) => (
          <li key={`${i}-${swap.from}`} className="text-muted-foreground">
            <span className="line-through">{swap.from}</span>
            {" ← "}
            <span className="text-foreground">{swap.to}</span>
          </li>
        ))}
        {entry.note && <li className="text-muted-foreground">{entry.note}</li>}
      </ul>

      {recipeNutrition && (
        <Difference from={recipeNutrition.total} to={entry.nutrition.total} />
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? "הסתרת הערכים" : "הערכים התזונתיים של הפעם ההיא"}
      </button>

      {open && <NutritionPanel nutrition={entry.nutrition} />}
    </li>
  );
}

export function CookLogSection({
  entries,
  recipeNutrition,
  error,
  onDelete,
}: {
  entries: CookLogEntry[];
  recipeNutrition: Nutrition | null;
  error: string | null;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<CookLogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function remove() {
    if (!confirming) return;
    setDeleting(true);
    setFailure(null);
    try {
      await onDelete(confirming.id);
      setConfirming(null);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "מחיקת הרישום נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {error && <Notice kind="error">{error}</Notice>}
      {failure && <Notice kind="error">{failure}</Notice>}

      <ul className="space-y-3">
        {entries.map((entry) => (
          <Entry
            key={entry.id}
            entry={entry}
            recipeNutrition={recipeNutrition}
            onDelete={() => setConfirming(entry)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={confirming !== null}
        title="למחוק את הרישום?"
        description={
          confirming
            ? `הבישול מ-${hebrewDate(confirming.cooked_on)} יימחק מהיומן לצמיתות. המתכון עצמו לא ייפגע.`
            : undefined
        }
        confirmLabel="מחיקה"
        destructive
        busy={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}
