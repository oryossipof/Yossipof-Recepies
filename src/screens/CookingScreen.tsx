import { useMemo, useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";

import { useRecipes } from "@/hooks/use-recipes";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { goBack } from "@/lib/router";
import { htmlToLines, isBlankHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/Notice";
import { RichText } from "@/components/RichText";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";

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

  const ingredients = useMemo(() => htmlToLines(recipe?.ingredients_html), [recipe]);
  const steps = useMemo(() => htmlToLines(recipe?.instructions_html), [recipe]);

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
            {ingredients.map((line, index) => (
              <Line
                key={`ing-${index}`}
                html={line}
                done={done.has(`ing-${index}`)}
                onToggle={() => toggle(`ing-${index}`)}
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
            {steps.map((line, index) => (
              <Line
                key={`step-${index}`}
                html={line}
                number={index + 1}
                done={done.has(`step-${index}`)}
                onToggle={() => toggle(`step-${index}`)}
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
 * One tappable line. The whole row is the target — a fingertip in the kitchen
 * is neither clean nor accurate, and a small checkbox would ask for precision
 * nobody has while stirring.
 */
function Line({
  html,
  number,
  done,
  onToggle,
}: {
  html: string;
  number?: number;
  done: boolean;
  onToggle: () => void;
}) {
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
          {done ? <Check className="size-4" /> : number}
        </span>

        <span
          className={cn(
            "rich-text min-w-0 flex-1 text-lg leading-relaxed",
            // An ingredient is struck off a list; a step is a paragraph, and a
            // rule drawn through ten lines of it is harder to read past than
            // the dimming alone.
            done && (number ? "text-muted-foreground" : "text-muted-foreground line-through"),
          )}
          // Already sanitised: htmlToLines runs the field through sanitize()
          // before ever cutting it into lines.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </button>
    </li>
  );
}
