import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The frame around the view buttons in the header.
 *
 * The shopping-list app puts its phone number in a small outlined pill, and
 * the same shape is used here: it gathers the buttons that change how the
 * screen is drawn — the display switch, the two size steppers, the category
 * manager — into one object, so they read as a set of settings rather than as
 * four loose icons competing with the title and the avatar beside them.
 */
export function HeaderTools({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5"
    >
      {children}
    </div>
  );
}

/**
 * One button inside the frame. Smaller than a standalone icon button, since
 * four of them plus the frame have to share a phone's header with the title
 * and the avatar.
 *
 * Each button brings its own colour rather than inheriting one, so that four
 * grey outlines in a row become four things a person can aim at without
 * reading. The colours are borrowed from the objects the icons draw — a
 * manila tag, the glass of a magnifier — and each has a lighter value for the
 * dark palette, where a mid-tone would sink into the header.
 */
export function HeaderToolButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      {...props}
      className={cn("size-8 hover:bg-accent/60 [&_svg]:size-[1.05rem]", className)}
    />
  );
}

/**
 * What each button is coloured. Written out as whole class strings because
 * Tailwind reads the source for the classes it generates, so a class assembled
 * at runtime would never be built.
 */
export const TOOL_COLORS = {
  /** The view switch: violet, the one cool colour that is not the app's own blue. */
  view: "text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300",
  /** The two magnifiers: the blue of glass. */
  zoom: "text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300",
  /** The category manager: the amber of a paper tag. */
  tags: "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300",
} as const;
