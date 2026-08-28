import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShoppingCart, UserCog } from "lucide-react";

import { useProfile } from "@/hooks/use-profile";
import { navigate } from "@/lib/router";
import { htmlToLines, htmlToText, isHeadingLine } from "@/lib/sanitize-html";
import { normalizeProductName, parseShoppingLine, SHOPPING_UNITS } from "@/lib/shopping-line";
import { addItems, fetchItemNames, fetchLists, type ShoppingList } from "@/lib/shopping-list";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "@/components/Notice";

// "What do I still need to buy for this?"
//
// The recipe's ingredients, each one a line the cook can tick, rename, and give
// a shopping quantity to before it is sent to the household's shopping list.
// Nothing is assumed: a recipe says "2 כפות סוכר" because that is what goes in
// the bowl, and only the shopper knows how much sugar to actually buy.
//
// Nothing typed here is kept. The dialog opens from the recipe as it is saved
// every time, and what leaves it goes to the shopping list, not back into the
// recipe.

type Row = {
  key: string;
  /** The ingredient exactly as the recipe writes it. */
  original: string;
  name: string;
  quantity: string;
  unit: string;
  wanted: boolean;
};

function rowsFrom(ingredientsHtml: string): Row[] {
  return htmlToLines(ingredientsHtml)
    // "לבצק:" heads a group of ingredients and is not one of them.
    .filter((line) => !isHeadingLine(line))
    .map((line, index) => {
      const text = htmlToText(line);
      const parsed = parseShoppingLine(text);
      return {
        key: `line-${index}`,
        original: text,
        name: parsed.name,
        quantity: String(parsed.quantity),
        unit: parsed.unit,
        wanted: false,
      };
    });
}

export function SendToShoppingDialog({
  open,
  onClose,
  ingredientsHtml,
}: {
  open: boolean;
  onClose: () => void;
  ingredientsHtml: string;
}) {
  const { profile, save } = useProfile();
  const phone = profile?.shopping_phone ?? null;

  const [rows, setRows] = useState<Row[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [taken, setTaken] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // The recipe as it stands, every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setRows(rowsFrom(ingredientsHtml));
    setError(null);
    setSent(null);
  }, [open, ingredientsHtml]);

  // Which lists that phone number keeps.
  useEffect(() => {
    if (!open || !phone) return;
    let cancelled = false;

    setLoading(true);
    fetchLists(phone)
      .then((found) => {
        if (cancelled) return;
        setLists(found);
        const remembered = profile?.shopping_list_id;
        const chosen = found.find((l) => l.id === remembered) ?? found[0];
        setListId(chosen?.id ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "קריאת הרשימות נכשלה");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, phone, profile?.shopping_list_id]);

  // What that list already holds, so nothing is offered twice.
  useEffect(() => {
    if (!open || !listId) return;
    let cancelled = false;

    fetchItemNames(listId)
      .then((names) => {
        if (!cancelled) setTaken(names);
      })
      .catch(() => {
        // Not knowing costs a duplicate, which the shopper can delete; it is no
        // reason to refuse to send anything at all.
        if (!cancelled) setTaken(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [open, listId]);

  const list = lists.find((l) => l.id === listId) ?? null;

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function alreadyThere(row: Row): boolean {
    return taken.has(normalizeProductName(row.name));
  }

  const selectable = useMemo(() => rows.filter((row) => !alreadyThere(row)), [rows, taken]);
  const chosen = selectable.filter((row) => row.wanted && row.name.trim());
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  function toggleAll() {
    const wanted = !allChosen;
    setRows((current) =>
      current.map((row) => (alreadyThere(row) ? row : { ...row, wanted })),
    );
  }

  async function send() {
    if (!phone || !list || chosen.length === 0) return;
    setSending(true);
    setError(null);

    try {
      const added = await addItems(
        phone,
        list,
        chosen.map((row) => ({
          name: row.name.trim(),
          quantity: Number(row.quantity) > 0 ? Number(row.quantity) : 1,
          unit: row.unit,
          note: row.original === row.name.trim() ? null : `במתכון: ${row.original}`,
        })),
      );

      // Remember the list, so the next recipe does not ask again.
      if (profile?.shopping_list_id !== list.id) {
        await save({ shopping_list_id: list.id }).catch(() => {});
      }

      setSent(`נוספו ${added} מוצרים לרשימה "${list.name}"`);
      setRows((current) => current.map((row) => ({ ...row, wanted: false })));
      setTaken((current) => {
        const next = new Set(current);
        for (const row of chosen) next.add(normalizeProductName(row.name));
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההוספה לרשימת הקניות נכשלה");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            הוספה לרשימת הקניות
          </DialogTitle>
          <DialogDescription>
            סימון הרכיבים החסרים, ותיקון השם והכמות לפי מה שקונים בחנות.
          </DialogDescription>
        </DialogHeader>

        {/*
          The phone number lives in the profile and only there — it is who this
          person is in the shopping app, not an answer to a question this dialog
          asks. Without one there is nothing to show and nowhere to send.
        */}
        {!phone ? (
          <div className="space-y-3">
            <Notice kind="error">
              כדי להוסיף לרשימת הקניות צריך להזין מספר טלפון בפרטי המשתמש.
            </Notice>
            <Button
              onClick={() => {
                onClose();
                navigate("/profile");
              }}
            >
              <UserCog />
              מעבר לפרטי המשתמש
            </Button>
          </div>
        ) : loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            טוען את הרשימות…
          </p>
        ) : lists.length === 0 ? (
          <Notice kind="error">
            לא נמצאו רשימות למספר הזה. אפשר לבדוק את המספר בפרטי המשתמש, או לפתוח רשימה
            באפליקציית הקניות.
          </Notice>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="shopping-list">הרשימה</Label>
              <select
                id="shopping-list"
                value={listId ?? ""}
                onChange={(e) => setListId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-base"
              >
                {lists.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <Label>הרכיבים החסרים</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                {allChosen ? "ניקוי הסימונים" : "סימון הכל"}
              </Button>
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((row) => {
                const there = alreadyThere(row);
                return (
                  <li key={row.key} className={cn("p-2", there && "bg-muted/40")}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={row.wanted}
                        aria-label={row.original}
                        disabled={there}
                        onClick={() => patch(row.key, { wanted: !row.wanted })}
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded border transition-colors",
                          row.wanted
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input",
                          there && "opacity-40",
                        )}
                      >
                        {row.wanted && <Check className="size-4" />}
                      </button>

                      <Input
                        value={row.name}
                        onChange={(e) => patch(row.key, { name: e.target.value })}
                        disabled={there}
                        aria-label="שם המוצר"
                        className="h-9 flex-1"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={row.quantity}
                        onChange={(e) => patch(row.key, { quantity: e.target.value })}
                        disabled={there}
                        aria-label="כמות"
                        className="h-9 w-16 text-center"
                      />
                      {/*
                        The shopping app's own seven units, and only those: a
                        unit typed freely here would reach a list whose own
                        picker cannot offer it back.
                      */}
                      <select
                        value={row.unit}
                        onChange={(e) => patch(row.key, { unit: e.target.value })}
                        disabled={there}
                        aria-label="יחידה"
                        className="h-9 w-24 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
                      >
                        {SHOPPING_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="px-8 pt-1 text-xs text-muted-foreground">
                      {there ? "כבר ברשימה" : row.original}
                    </p>
                  </li>
                );
              })}
            </ul>

            {error && <Notice kind="error">{error}</Notice>}
            {sent && <Notice kind="success">{sent}</Notice>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                סגירה
              </Button>
              <Button onClick={() => void send()} disabled={sending || chosen.length === 0}>
                {sending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
                {chosen.length > 0 ? `הוספה (${chosen.length})` : "הוספה"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
