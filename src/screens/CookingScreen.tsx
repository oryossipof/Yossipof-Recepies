import { useMemo, useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";

import { useRecipes } from "@/hooks/use-recipes";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { goBack } from "@/lib/router";
import { htmlToLines, isBlankHtml, isHeadingLine } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/Notice";
import { RichText } from "@/components/RichText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";

type Row = {
  key: string;
  html: string;
  /** A heading names the part of the dish the rows under it belong to. */
  heading: boolean;
  /** The step's number, counted past the headings, which are not steps. */
  number: number;
};

function toRows(html: string | null | undefined, prefix: string): Row[] {
  let counted = 0;

  return htmlToLines(html).map((line, index) => {
    const heading = isHeadingLine(line);
    if (!heading) counted += 1;
    return { key: `${prefix}-${index}`, html: line, heading, number: counted };
  });
}

/**
 * The recipe as it is needed at the stove, rather than as it is read on the
 * sofa: big type, the screen kept alight, and everything else — the photo, the
 * author, the categories, the nutrition table, the edit and delete buttons —
 * gone, since none of it is any use with a spoon in one hand.
 *
 * Ingredients and steps stand side by side on a screen wide enough to hold
 * both, because cooking means looking from one to the other, and each line can
 * be tapped off as it is done. Those ticks live only as long as the screen is
 * open: they say where the cook is in this pot of food, which is not a fact
 * about the recipe and has no business being saved.
 */
export function CookingScreen({ id }: { id: string }) {
  const { recipes, loading } = useRecipes();
  const awake = useWakeLock();

  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  const recipe = recipes.find((r) => r.id === id);

  const ingredients = useMemo(() => toRows(recipe?.ingredients_html, "ing"), [recipe]);
  const steps = useMemo(() => toRows(recipe?.instructions_html, "step"), [recipe]);

  function toggle(key: string) {
    setDone((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <>
        <ScreenHeader title="מצב בישול" />
        <main className="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-muted-foreground">
          טוען…
        </main>
      </>
    );
  }

  if (!recipe) {
    return (
      <>
        <ScreenHeader title="מצב בישול" />
        <main className="mx-auto w-full max-w-4xl px-4 py-6">
          <Notice kind="error">המתכון לא נמצא.</Notice>
        </main>
      </>
    );
  }

  return (
    <div className="min-h-dvh pb-16">
      {/*
        Its own header rather than the shared one: the way out has to be the
        largest thing up there, and nothing else belongs beside it.
      */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-2.5">
          <Button variant="ghost" size="icon" aria-label="יציאה ממצב בישול" onClick={goBack}>
            <X className="size-5" />
          </Button>

          <h1 className="flex-1 truncate text-lg font-bold">{recipe.title}</h1>

          {awake && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="size-4" />
              <span className="hidden sm:inline">המסך יישאר דלוק</span>
            </span>
          )}

          {done.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setDone(new Set())}>
              ניקוי הסימונים
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 md:grid md:grid-cols-[20rem_1fr] md:gap-10">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden>🧾</span>
            רכיבים
          </h2>

          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {ingredients.map((row) => (
              <Line
                key={row.key}
                row={row}
                done={done.has(row.key)}
                onToggle={() => toggle(row.key)}
              />
            ))}
          </ul>
        </section>

        <section className="mt-8 space-y-3 md:mt-0">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden>👩‍🍳</span>
            אופן ההכנה
          </h2>

          <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
            {steps.map((row) => (
              <Line
                key={row.key}
                row={row}
                numbered
                done={done.has(row.key)}
                onToggle={() => toggle(row.key)}
              />
            ))}
          </ol>
        </section>

        {!isBlankHtml(recipe.notes_html) && (
          <section className="mt-8 space-y-3 md:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden>💡</span>
              הערות
            </h2>
            <RichText html={recipe.notes_html} className="text-lg" />
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * One line of the recipe.
 *
 * A heading — "לבצק:", "לבשר:" — names the part of the dish that follows, so it
 * is printed as a heading and nothing more: there is nothing to tick off, and a
 * circle beside it would invite the cook to try.
 *
 * Everything else is tappable, and the whole row is the target: a fingertip in
 * the kitchen is neither clean nor accurate, and a small checkbox would ask for
 * precision nobody has while stirring.
 */
function Line({
  row,
  numbered = false,
  done,
  onToggle,
}: {
  row: Row;
  numbered?: boolean;
  done: boolean;
  onToggle: () => void;
}) {
  const { html, heading, number } = row;

  if (heading) {
    return (
      <li
        className="rich-text bg-muted/50 px-4 py-2.5 text-base font-bold"
        // Already sanitised: htmlToLines runs the field through sanitize()
        // before ever cutting it into lines.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-right transition-colors hover:bg-accent/40"
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {done ? <Check className="size-4" /> : numbered ? number : null}
        </span>

        <span
          className={cn(
            "rich-text min-w-0 flex-1 text-lg leading-relaxed",
            // An ingredient is struck off a list; a step is a paragraph, and a
            // rule drawn through ten lines of it is harder to read past than
            // the dimming alone.
            done && (numbered ? "text-muted-foreground" : "text-muted-foreground line-through"),
          )}
          // Already sanitised: htmlToLines runs the field through sanitize()
          // before ever cutting it into lines.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </button>
    </li>
  );
}
