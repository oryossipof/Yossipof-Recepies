// Light/dark switching. The dark palette has been defined in styles.css all
// along (the `.dark` block) but nothing ever added the class, so none of it
// was reachable. This turns it on.

const STORAGE_KEY = "theme";

export type Theme = "light" | "dark";

/** What the device itself prefers, when the user has not chosen. */
function systemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    // Private mode / blocked storage.
    return null;
  }
}

export function readTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembering the choice is not worth failing over.
  }
}

export function applyTheme(theme: Theme): void {
  try {
    document.documentElement.classList.toggle("dark", theme === "dark");
    // Keeps the Android status bar in step with the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0f172a" : "#38bdf8");
  } catch {
    // Ignore — the light palette still applies.
  }
}

/** Applies the saved choice. Call before first paint to avoid a flash. */
export function applySavedTheme(): void {
  applyTheme(readTheme());
}

/**
 * Follows the device while the user has not picked a theme explicitly. Once
 * they have, their choice wins and the system is ignored.
 */
export function watchSystemTheme(): () => void {
  try {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!savedTheme()) applyTheme(systemTheme());
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  } catch {
    return () => {};
  }
}
