import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { useCategories } from "@/hooks/use-categories";
import { useRecipes } from "@/hooks/use-recipes";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Add, rename and remove the categories shared by everyone. */
export function CategoriesScreen() {
  const { categories, loading, addCategory, renameCategory, deleteCategory } = useCategories();
  const { recipes, reload: reloadRecipes } = useRecipes();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = categories.find((c) => c.id === pendingDelete);
  const usageCount = pendingDelete
    ? recipes.filter((r) => r.categoryIds.includes(pendingDelete)).length
    : 0;

  async function withBusy(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh pb-12">
      <ScreenHeader title="ניהול קטגוריות" />

      <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4">
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void withBusy(async () => {
                await addCategory(newName);
                setNewName("");
              });
            }}
            placeholder="שם קטגוריה חדשה"
            className="h-10"
          />
          <Button
            disabled={busy || !newName.trim()}
            onClick={() =>
              void withBusy(async () => {
                await addCategory(newName);
                setNewName("");
              })
            }
          >
            <Plus />
            הוספה
          </Button>
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        {loading ? (
          <p className="text-sm text-muted-foreground">טוען…</p>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            עדיין אין קטגוריות. הוסיפו את הראשונה למעלה.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {categories.map((category) => {
              const count = recipes.filter((r) => r.categoryIds.includes(category.id)).length;
              const editing = editingId === category.id;

              return (
                <li key={category.id} className="flex items-center gap-2 bg-card px-3 py-2">
                  {editing ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="h-9"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="שמירת השם"
                        disabled={busy}
                        onClick={() =>
                          void withBusy(async () => {
                            await renameCategory(category.id, editingName);
                            setEditingId(null);
                          })
                        }
                      >
                        {busy ? <Loader2 className="animate-spin" /> : <Check />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="ביטול"
                        onClick={() => setEditingId(null)}
                      >
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{category.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {count === 1 ? "מתכון אחד" : `${count} מתכונים`}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`שינוי שם: ${category.name}`}
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                          setError(null);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`מחיקה: ${category.name}`}
                        onClick={() => setPendingDelete(category.id)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="למחוק את הקטגוריה?"
        description={
          usageCount > 0
            ? `"${target?.name}" משויכת ל-${usageCount} מתכונים. המתכונים יישארו, רק השיוך יימחק.`
            : `"${target?.name}" תימחק.`
        }
        confirmLabel="מחיקה"
        destructive
        busy={busy}
        onConfirm={() =>
          void withBusy(async () => {
            if (!pendingDelete) return;
            await deleteCategory(pendingDelete);
            setPendingDelete(null);
            // Recipes hold their category ids locally; refresh so the removed
            // category stops showing on their cards.
            await reloadRecipes();
          })
        }
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
