import { LIST_MODE_LABELS, otherListMode, type ListMode } from "@/lib/list-mode";

import { HeaderToolButton, ToolEmoji } from "./HeaderTools";

/**
 * The header switch between listing every recipe and listing the categories.
 *
 * One button rather than two: there are only two modes, so a second button
 * would spend header room saying what the first already says. The picture
 * shows the mode the press moves *to* — a drawer of files while the flat list
 * is up, a dish while the categories are — and both the label and the tooltip
 * name that destination, so nobody has to guess whether the picture describes
 * now or next.
 *
 * The dish is the same 🥘 a recipe with no photograph wears on the main
 * screen, so it already means "a recipe" everywhere else in the app.
 */
export function ListModeControl({
  value,
  onChange,
}: {
  value: ListMode;
  onChange: (mode: ListMode) => void;
}) {
  const next = otherListMode(value);

  return (
    <HeaderToolButton
      aria-label={`תצוגה ${LIST_MODE_LABELS[next]} (כעת ${LIST_MODE_LABELS[value]})`}
      title={`תצוגה ${LIST_MODE_LABELS[next]}`}
      onClick={() => onChange(next)}
    >
      <ToolEmoji className="text-[0.95rem]">{next === "categories" ? "🗂️" : "🥘"}</ToolEmoji>
    </HeaderToolButton>
  );
}
