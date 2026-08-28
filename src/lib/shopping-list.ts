import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_UNIT, normalizeProductName } from "./shopping-line";

// Everything this app does to the household's shopping list, in one file.
//
// That list belongs to a different app — Yossipof-Shopping — which happens to
// share this Supabase project. Its tables are `saved_lists` and `grocery_items`,
// and this file only ever reads its lists and inserts items into one of them,
// in exactly the shape that app inserts them itself. Nothing here alters its
// structure, its policies, or any row it already has.
//
// That app identifies people by phone number rather than by account, so every
// call takes the phone kept on the recipe profile. See `recipe_profiles`.

export type ShoppingList = {
  id: string;
  name: string;
  createdAt: string;
  /** The list's own category set, which the classifier has to sort against. */
  categories: { key: string; label: string }[] | null;
};

export type NewShoppingItem = {
  name: string;
  quantity: number;
  unit: string;
  /** The ingredient as the recipe writes it, kept for the shopper to read. */
  note: string | null;
};

/** The lists that phone number keeps, newest first. */
export async function fetchLists(phone: string): Promise<ShoppingList[]> {
  const { data, error } = await supabase
    .from("saved_lists")
    .select("id, name, created_at, categories")
    .eq("phone_number", phone)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    categories: Array.isArray(row.categories)
      ? (row.categories as { key: string; label: string }[])
      : null,
  }));
}

/**
 * What is already on that list, in canonical form.
 *
 * Bought-and-ticked items count too: an item still on the list is on the list,
 * whatever its state — the same rule the shopping app applies to itself.
 */
export async function fetchItemNames(listId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("name")
    .eq("list_id", listId);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => normalizeProductName(row.name)));
}

/**
 * Adds items to a list and returns how many arrived.
 *
 * Categories are left for the classifier below rather than guessed here: the
 * keyword table that guesses them lives in the shopping app, and a second copy
 * of it in this one would drift out of step with the first.
 */
export async function addItems(
  phone: string,
  list: ShoppingList,
  items: NewShoppingItem[],
): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((item) => ({
    phone_number: phone,
    list_id: list.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit || DEFAULT_UNIT,
    image_url: null,
    category: null,
    checked: false,
    notes: item.note,
  }));

  const { data, error } = await supabase.from("grocery_items").insert(rows).select("id, name");
  if (error) throw new Error(error.message);

  const added = data ?? [];
  void classify(added, list);
  return added.length;
}

/**
 * Asks the shopping app's own classifier where each new item belongs, and files
 * them there.
 *
 * Best effort, and deliberately unawaited: the items are already on the list,
 * and a shopper can move an uncategorised one themselves. One request covers
 * the whole batch, which is all the household's free AI allowance can spare.
 */
async function classify(items: { id: string; name: string }[], list: ShoppingList): Promise<void> {
  if (items.length === 0 || !list.categories?.length) return;

  try {
    const { data, error } = await supabase.functions.invoke<{
      results: { name: string; category: string }[];
    }>("classify-category", {
      body: {
        items: items.map((item) => item.name),
        categories: list.categories.map((c) => ({ key: c.key, label: c.label })),
      },
    });
    if (error || !data?.results) return;

    const byName = new Map(data.results.map((result) => [result.name, result.category]));
    for (const item of items) {
      const category = byName.get(item.name);
      if (!category) continue;
      // supabase-js query builders only dispatch once their thenable is
      // consumed, so this await is required rather than tidy.
      await supabase.from("grocery_items").update({ category }).eq("id", item.id);
    }
  } catch {
    // An uncategorised item is a small blemish; a failed send would not be.
  }
}
