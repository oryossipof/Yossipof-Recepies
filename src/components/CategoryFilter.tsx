import { useMemo, useState } from "react";
import { Check, ChevronDown, ChefHat, Search, Star, Tags, X } from "lucide-react";

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
 * The category filter on the home screen.
 *
 * A household collects categories faster than it collects recipes, so laying
 * them out as chips does not scale: twenty categories either wrap into a wall
 * above the recipes or scroll sideways into a haystack. Instead the screen
 * spends one short line on this — favourites, and a single button that says
 * how many categories are filtering — and every category lives in the dialog
 * behind it, with a search box and a recipe count each. The row is the same
 * height with three categories or with three hundred.
 *
 * Categories are chosen as many at a time as wanted, and a recipe shows if it
 * belongs to any of them.
 */

export function CategoryFilter({
  categories,
  counts,
  selected,
  onToggle,
  onClear,
  favoritesOnly,
  onToggleFavorites,
  mineOnly,
  onToggleMine,
}: {
  categories: Category[];
  counts: Map<string, number>;
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  mineOnly: boolean;
  onToggleMine: () => void;
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

  /** What the button says: nothing chosen, one name, or how many. */
  const label = useMemo(() => {
    if (selected.length === 0) return "קטגוריות";
    if (selected.length === 1) {
      return categories.find((c) => c.id === selected[0])?.name ?? "קטגוריה אחת";
    }
    return `${selected.length} קטגוריות`;
  }, [selected, categories]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter((c) => c.name.toLowerCase().includes(needle));
  }, [ranked, query]);

  return (
    <>
      <div className="mb-4 flex items-center gap-1.5">
        <Chip
          active={favoritesOnly}
          onClick={onToggleFavorites}
          icon={<Star className={cn("size-3.5", favoritesOnly ? "fill-current" : "text-star")} />}
        >
          מועדפים
        </Chip>

        <Chip active={mineOnly} onClick={onToggleMine} icon={<ChefHat className="size-3.5" />}>
          המתכונים שלי
        </Chip>

        <Chip
          active={selected.length > 0}
          onClick={() => setOpen(true)}
          icon={<Tags className="size-3.5" />}
        >
          <span className="max-w-[9rem] truncate">{label}</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </Chip>

        {selected.length > 0 && (
          <button
            type="button"
            aria-label="ניקוי הסינון"
            title="ניקוי הסינון"
            onClick={onClear}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
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
          <DialogHeader className="pe-7">
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
