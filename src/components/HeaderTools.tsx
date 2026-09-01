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

/**
 * The picture on a tool button, as an emoji.
 *
 * The shopping-list app labels its header buttons this way — 📱 for the phone
 * number, 📥 for import, ☀️/🌙 for the theme — and these buttons follow it, so
 * that the two apps in the house read as one family.
 *
 * The cost, chosen knowingly: an emoji is drawn by the phone, not by the app,
 * so the header is not pixel-identical on an Android and on an iPhone. It is
 * hidden from screen readers, since every button already carries a real label.
 */
export function ToolEmoji({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("leading-none", className)}>
      {children}
    </span>
  );
}
