import { useEffect, useState } from "react";

// A hash router in ~100 lines. The app has six screens and no need for nested
// routes or loaders, and hash URLs work on any static host without a rewrite
// rule, which keeps the Netlify and Vercel configs honest.

export type Route =
  | { name: "home" }
  | { name: "recipe"; id: string }
  | { name: "new" }
  | { name: "edit"; id: string }
  | { name: "cook"; id: string }
  | { name: "category"; id: string }
  | { name: "categories" }
  | { name: "profile" };

const HOME: Route = { name: "home" };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\/*/, "");
  const [head, tail] = path.split("/");

  switch (head) {
    case "recipe":
      return tail ? { name: "recipe", id: tail } : HOME;
    case "edit":
      return tail ? { name: "edit", id: tail } : HOME;
    case "cook":
      return tail ? { name: "cook", id: tail } : HOME;
    // One category's recipes. The id is a UUID, or the word "none" for the
    // recipes that belong to no category at all.
    case "category":
      return tail ? { name: "category", id: tail } : HOME;
    case "new":
      return { name: "new" };
    case "categories":
      return { name: "categories" };
    case "profile":
      return { name: "profile" };
    default:
      return HOME;
  }
}

/**
 * The screen above this one.
 *
 * The back arrow climbs this hierarchy rather than unwinding the browser's
 * history, so it is always one step towards the list — however many times the
 * same recipe has been opened, edited, saved and edited again.
 */
function parentOf(route: Route): string {
  switch (route.name) {
    case "edit":
    case "cook":
      return `/recipe/${route.id}`;
    case "recipe": {
      // A recipe opened from inside a category belongs, for as long as it is
      // on screen, to that category: the arrow gives it back to the shelf it
      // was taken from rather than dropping the person at the top of the
      // list. Reached any other way it still climbs to the list.
      const behind = entryBehind();
      return behind?.startsWith("#/category/") ? behind : "/";
    }
    default:
      return "/";
  }
}

/**
 * What each history entry remembers: the hash of the entry it was pushed from.
 * That is the one thing the browser will not tell us, and going up needs it to
 * know whether stepping back lands on the screen above or somewhere else
 * entirely. It rides in `history.state`, so it survives a reload too.
 */
type EntryState = { from?: string };

function currentHash(): string {
  return window.location.hash || "#/";
}

function normalise(path: string): string {
  return path.startsWith("#") ? path : `#${path}`;
}

function urlFor(hash: string): string {
  const { pathname, search } = window.location;
  return `${pathname}${search}${hash}`;
}

function entryBehind(): string | undefined {
  const state = window.history.state as EntryState | null;
  return typeof state?.from === "string" ? state.from : undefined;
}

// pushState and replaceState fire no event of their own, so the router tells
// the screens itself.
const listeners = new Set<() => void>();

/**
 * `replace` swaps the current history entry instead of adding one. Used after
 * saving a recipe: the editor should not be somewhere "back" can return to,
 * since going back into a form that has already been submitted is confusing
 * and invites a double save.
 */
export function navigate(path: string, options?: { replace?: boolean }): void {
  const next = normalise(path);
  if (currentHash() === next) return;

  if (options?.replace) {
    // Only the screen changed; whatever is behind this entry still is.
    window.history.replaceState({ from: entryBehind() }, "", urlFor(next));
  } else {
    window.history.pushState({ from: currentHash() }, "", urlFor(next));
  }

  for (const listener of listeners) listener();
}

/**
 * Leaves for `path` and takes the current history entry with it: steps back
 * when `path` is already the entry behind, and replaces the current entry
 * otherwise.
 *
 * Either way the screen being left — a form already submitted, a recipe just
 * deleted — stops existing rather than sitting in the history for a later
 * "back" to walk through. Without this, edit → save → edit → save piles up a
 * run of identical entries and the arrow appears to do nothing for several
 * presses.
 */
export function returnTo(path: string): void {
  const next = normalise(path);
  if (entryBehind() === next) window.history.back();
  else navigate(next, { replace: true });
}

export function goHome(): void {
  returnTo("/");
}

/** One step up the hierarchy — what the back arrow in every header does. */
export function goBack(): void {
  returnTo(parentOf(parse(currentHash())));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(currentHash()));

  useEffect(() => {
    // The browser's own back and forward fire popstate and hashchange both,
    // so the last hash shown keeps the screen from rendering twice.
    let shown = currentHash();
    const onChange = () => {
      const hash = currentHash();
      if (hash === shown) return;
      shown = hash;
      setRoute(parse(hash));
      window.scrollTo({ top: 0 });
    };

    listeners.add(onChange);
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);

  return route;
}
