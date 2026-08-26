import { ChevronRight } from "lucide-react";

import { goBack } from "@/lib/router";
import { Button } from "@/components/ui/button";

/**
 * Sticky header for the secondary screens: back arrow, title, optional
 * actions.
 *
 * Matches the main screen: a hairline rule and a blurred background, so the
 * page beneath scrolls under it without the header becoming a coloured slab.
 */
export function ScreenHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="חזרה"
          onClick={goBack}
          className="text-primary hover:bg-primary/10 hover:text-primary"
        >
          {/* RTL: "back" points right. */}
          <ChevronRight className="size-5" />
        </Button>
        <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
        {actions}
      </div>
    </header>
  );
}
