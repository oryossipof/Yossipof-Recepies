import { LIST_MODE_LABELS, otherListMode, type ListMode } from "@/lib/list-mode";

import { GFolder, GGrid } from "./GradientIcon";
import { HeaderToolButton } from "./HeaderTools";

/**
 * The header switch between listing every recipe and listing the categories.
 *
 * One button rather than two: there are only two modes, so a second button
 * would spend header room saying what the first already says. The icon shows
 * the mode the press moves *to* — a folder while the flat list is up, four
 * tiles while the categories are — and both the label and the tooltip name
 * that destination, so nobody has to guess whether the picture describes now
 * or next.
 *
 * The folder is deliberately the same folder that stands on the category
 * tiles below, so the button and the thing it leads to are one object.
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
      {next === "categories" ? <GFolder /> : <GGrid />}
    </HeaderToolButton>
  );
}
