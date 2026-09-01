/**
 * What the search boxes match on.
 *
 * Searching is by name, and only by name — the name of a recipe, the name of a
 * category. An earlier version also read the ingredients, the instructions and
 * the uploader's name into the haystack, which meant a search for one dish
 * returned every recipe that happened to mention it in a step. A person
 * looking through a shelf of their own recipes is nearly always trying to
 * reach one they can already name, so the name is the whole of it.
 *
 * Matching is case-insensitive and ignores the spaces around what was typed.
 * Hebrew has no case to fold, but the recipes in this app carry English and
 * French words too — "Focaccia", "Crème" — and those should answer to however
 * they were typed.
 *
 * It also ignores the geresh, and that is the part worth explaining. Hebrew
 * spells the sounds it has no letter for with a mark after the letter: צ׳לפק,
 * ג׳חנון, ז׳קט. Nobody reaches for that mark on a phone keyboard — they type
 * צלפק — and worse, the mark itself has several shapes that all look alike: the
 * Hebrew geresh ׳, the ASCII apostrophe ', and the curly ’ a word processor
 * substitutes when a recipe is pasted in from Word. A recipe saved with one of
 * them would be unfindable by anyone typing another. So the mark is removed
 * from both sides before comparing, and צלפק, צ'לפק and צ׳לפק all find each
 * other.
 */

/** The marks that are dropped before comparing: geresh, gershayim, quotes. */
const IGNORED = /['"׳״’‘“”]/g;

function fold(value: string): string {
  return value.toLowerCase().replace(IGNORED, "");
}

/** True when `name` contains what was typed. An empty query matches nothing. */
export function matchesName(name: string, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return false;
  return fold(name).includes(needle);
}

/** Whether a query has anything in it worth searching for. */
export function isSearching(query: string): boolean {
  return query.trim().length > 0;
}
