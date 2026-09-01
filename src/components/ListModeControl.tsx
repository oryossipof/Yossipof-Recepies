import { LayoutGrid, LibraryBig } from "lucide-react";

import { LIST_MODE_LABELS, otherListMode, type ListMode } from "@/lib/list-mode";

import { HeaderToolButton, TOOL_COLORS } from "./HeaderTools";

/**
 * The header switch between listing every recipe and listing the categories.
 *
 * One button rather than two: there are only two modes, so a second button
 * would spend header room saying what the first already says. The icon shows
 * the mode the press moves *to* — a stack of shelves while the flat list is
 * up, a grid of tiles while the categories are — and both the label and the
 * tooltip name that destination, so nobody has to guess whether the picture
 * describes now or next.
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
      className={TOOL_COLORS.view}
    >
      {next === "categories" ? <LibraryBig /> : <LayoutGrid />}
    </HeaderToolButton>
  );
}
