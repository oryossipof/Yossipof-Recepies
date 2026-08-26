import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, RemoveFormatting, Underline } from "lucide-react";

import { isBlankHtml, sanitize, textToHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";

// A deliberately small rich-text editor. The app only needs bold, italic,
// underline and lists — exactly the formatting a pasted recipe carries — so it
// leans on contenteditable and execCommand rather than pulling in an editor
// framework. execCommand is deprecated but is still the only API every browser
// implements for this, and its output is sanitised on the way out anyway.

type Command = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList";

const TOOLS: { command: Command; label: string; Icon: typeof Bold }[] = [
  { command: "bold", label: "מודגש", Icon: Bold },
  { command: "italic", label: "נטוי", Icon: Italic },
  { command: "underline", label: "קו תחתון", Icon: Underline },
  { command: "insertUnorderedList", label: "רשימה", Icon: List },
  { command: "insertOrderedList", label: "רשימה ממוספרת", Icon: ListOrdered },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "8rem",
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // What this editor last handed upwards. Comparing against it keeps an
  // incoming re-render from rewriting the DOM under the user's caret.
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = sanitize(value);
    lastEmitted.current = value;
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  }

  function exec(command: string, argument?: string) {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    emit();
  }

  /**
   * Paste keeps the source's formatting: the clipboard's HTML flavour is
   * sanitised and inserted as markup, and only a clipboard without HTML falls
   * back to plain text. This is what makes bold text stay bold all the way
   * from the source document into a saved recipe.
   */
  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const markup = html ? sanitize(html) : textToHtml(text);
    if (markup) exec("insertHTML", markup);
  }

  return (
    <div className={cn("rounded-md border border-input bg-card", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1">
        {TOOLS.map(({ command, label, Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            // Keep the selection: mousedown would otherwise blur the editor
            // and execCommand would have nothing to act on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(command)}
            className="inline-flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="size-4" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          title="נקה עיצוב"
          aria-label="נקה עיצוב"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
          className="inline-flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RemoveFormatting className="size-4" />
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        dir="rtl"
        data-placeholder={placeholder}
        data-empty={isBlankHtml(value) ? "true" : "false"}
        style={{ minHeight }}
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        className="rich-text w-full px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}
