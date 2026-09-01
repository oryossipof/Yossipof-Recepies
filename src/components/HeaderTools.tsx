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
 */
export function HeaderToolButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      {...props}
      className={cn(
        "size-8 text-muted-foreground hover:bg-accent/60 hover:text-foreground [&_svg]:size-[1.05rem]",
        className,
      )}
    />
  );
}
