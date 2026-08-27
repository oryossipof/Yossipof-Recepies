import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, Star, X } from "lucide-react";

import type { Category } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/*
 * The category row on the home screen.
 *
 * A household collects categories faster than it collects recipes, and a
 * single scrolling strip of them turns into a horizontal haystack. So the row
 * shows only the few categories that actually carry the most recipes — plus
 * every category currently filtering, even a rare one — and hides the rest
 * behind "כל הקטגוריות", where they get a search box, a count each, and room
 * to breathe. With a handful of categories nothing is hidden at all and the
 * row behaves exactly as before.
 *
 * Categories are chosen as many at a time as wanted, and a recipe shows if it
 * belongs to any of them.
 */

/** How many categories stay in the row before the rest move into the dialog. */
const INLINE_LIMIT = 5;

export function CategoryFilter({
  categories,
  counts,
  selected,
  onToggle,
  onClear,
  favoritesOnly,
  onToggleFavorites,
}: {
  categories: Category[];
  counts: Map<string, number>;
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  /** Busiest first: the categories most likely to be wanted sit closest. */
  const ranked = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name, "he"),
      ),
    [categories, counts],
  );

  const inline = useMemo(() => {
    // Everything picked from the dialog has to stay visible afterwards,
    // otherwise the screen looks filtered by nothing at all.
    const picked = ranked.filter((c) => selected.includes(c.id));
    const rest = ranked.filter((c) => !selected.includes(c.id) && (counts.get(c.id) ?? 0) > 0);

    return [...picked, ...rest.slice(0, Math.max(INLINE_LIMIT - picked.length, 0))];
  }, [ranked, counts, selected]);

  const hidden = categories.length - inline.length;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter((c) => c.name.toLowerCase().includes(needle));
  }, [ranked, query]);

  return (
    <>
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip
          active={favoritesOnly}
          onClick={onToggleFavorites}
          icon={<Star className={cn("size-3.5", favoritesOnly ? "fill-current" : "text-star")} />}
        >
          מועדפים
        </Chip>

        <Chip active={selected.length === 0} onClick={onClear}>
          הכל
        </Chip>

        {inline.map((category) => (
          <Chip
            key={category.id}
            active={selected.includes(category.id)}
            onClick={() => onToggle(category.id)}
          >
            {category.name}
          </Chip>
        ))}

        {hidden > 0 && (
          <Chip
            active={false}
            onClick={() => setOpen(true)}
            icon={<ChevronDown className="size-3.5" />}
          >
            עוד {hidden}
          </Chip>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogContent className="max-h-[80dvh] gap-3 overflow-hidden sm:max-w-md">
          <DialogHeader className="pr-7 text-right sm:text-right">
            <DialogTitle>כל הקטגוריות</DialogTitle>
            <DialogDescription>
              אפשר לסמן כמה קטגוריות; יוצגו המתכונים ששייכים לאחת מהן.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש קטגוריה"
              aria-label="חיפוש קטגוריה"
              autoFocus
              className="h-10 w-full rounded-full border border-input bg-card px-10 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {query && (
              <button
                type="button"
                aria-label="ניקוי החיפוש"
                onClick={() => setQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="-mx-1 overflow-y-auto px-1">
            {matches.map((category) => (
              <Row
                key={category.id}
                active={selected.includes(category.id)}
                onClick={() => onToggle(category.id)}
                name={category.name}
                count={counts.get(category.id) ?? 0}
              />
            ))}

            {matches.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                אין קטגוריה בשם הזה
              </p>
            )}
          </div>

          {/* The list stays open while several categories are ticked off. */}
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <span className="flex-1 text-sm text-muted-foreground">
              {selected.length > 0 ? `נבחרו ${selected.length}` : "לא נבחרה קטגוריה"}
            </span>
            {selected.length > 0 && (
              <Button variant="ghost" onClick={onClear}>
                ניקוי
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>סיום</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Chip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent/30",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Row({
  active,
  onClick,
  name,
  count,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-right text-base transition-colors",
        active ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent/30",
      )}
    >
      <Check className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
      <span className="flex-1 truncate">{name}</span>
      {count !== undefined && (
        <span className="shrink-0 text-sm text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
