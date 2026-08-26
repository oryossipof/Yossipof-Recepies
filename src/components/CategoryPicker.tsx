import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { Notice } from "./Notice";

/**
 * Multi-select over the shared category list, with a way to create a missing
 * category without leaving the recipe being edited.
 */
export function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { categories, addCategory } = useCategories();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;

    setAdding(true);
    setError(null);
    try {
      const category = await addCategory(name);
      onChange([...selected, category.id]);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "הוספת הקטגוריה נכשלה");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-2">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const active = selected.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(category.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary font-medium text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {active && <Check className="size-3.5" />}
                {category.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="קטגוריה חדשה"
        />
        <Button type="button" variant="outline" onClick={add} disabled={adding || !newName.trim()}>
          <Plus />
          הוספה
        </Button>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  );
}
