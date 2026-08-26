import { useEffect, useState } from "react";

// A hash router in ~50 lines. The app has six screens and no need for nested
// routes or loaders, and hash URLs work on any static host without a rewrite
// rule, which keeps the Netlify and Vercel configs honest.

export type Route =
  | { name: "home" }
  | { name: "recipe"; id: string }
  | { name: "new" }
  | { name: "edit"; id: string }
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

export function navigate(path: string): void {
  const next = path.startsWith("#") ? path : `#${path}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

export function goHome(): void {
  navigate("/");
}

/** Steps back when there is app history to step back into, home otherwise. */
export function goBack(): void {
  if (window.history.length > 1) window.history.back();
  else goHome();
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
