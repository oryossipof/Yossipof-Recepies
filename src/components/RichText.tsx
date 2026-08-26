import { useMemo } from "react";

import { sanitize } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

/**
 * Renders a stored recipe field. The HTML is sanitised on the way in — see
 * lib/sanitize-html.ts — so the only markup that reaches the DOM is the small
 * formatting set the editor produces.
 */
export function RichText({ html, className }: { html: string | null; className?: string }) {
  const safe = useMemo(() => sanitize(html), [html]);
  if (!safe) return null;

  return (
    <div
      className={cn("rich-text leading-relaxed", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
