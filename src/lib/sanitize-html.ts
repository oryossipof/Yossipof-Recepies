// Recipe text is stored as HTML so that formatting from the source — bold
// ingredients, an underlined heading, a numbered list — survives being pasted
// in, split into fields by the AI, edited, saved and rendered again.
//
// Everything that comes back from the model, from a paste, or from the
// database goes through sanitize() before it reaches the DOM. Only the small
// set of tags below survives; scripts, links, images, event handlers and
// arbitrary styling do not.

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "DIV",
  "UL",
  "OL",
  "LI",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "SPAN",
]);

/**
 * Inline styles worth keeping. Word and Google Docs express bold and italic as
 * `style="font-weight:700"` rather than as tags, so dropping style outright
 * would silently flatten pasted formatting.
 */
const ALLOWED_STYLE_PROPS = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "text-align",
]);

/**
 * Tags whose contents go with them. Every other unknown tag is unwrapped so
 * that its words survive — but the words inside these are code, not recipe,
 * and unwrapping a <script> pasted from a web page prints its source into the
 * ingredient list.
 */
const DROPPED_WHOLE = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "TEMPLATE", "OBJECT"]);

function cleanStyle(value: string): string {
  return value
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      return prop ? ALLOWED_STYLE_PROPS.has(prop) : false;
    })
    .join("; ");
}

function scrub(node: Element): void {
  // Walk a copy of the list: unwrapping a child mutates the live collection.
  for (const child of Array.from(node.children)) scrub(child);

  if (DROPPED_WHOLE.has(node.tagName)) {
    node.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(node.tagName)) {
    // Keep the words, drop the tag.
    const parent = node.parentNode;
    if (parent) {
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    }
    return;
  }

  for (const attr of Array.from(node.attributes)) {
    if (attr.name.toLowerCase() !== "style") {
      node.removeAttribute(attr.name);
      continue;
    }
    const style = cleanStyle(attr.value);
    if (style) node.setAttribute("style", style);
    else node.removeAttribute("style");
  }
}

/** Returns HTML safe to hand to dangerouslySetInnerHTML. */
export function sanitize(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  scrub(root);
  return root.innerHTML.trim();
}

/** Plain text of an HTML fragment — used for search and for empty checks. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The block-level tags the editor produces, each of which reads as a line. */
const LINE_BLOCKS = new Set(["P", "LI", "DIV"]);

/**
 * The lines of a stored field, as HTML — one per list item, paragraph or line
 * break, with the inline formatting kept.
 *
 * Reading a recipe straight through only needs the field rendered whole. Cooking
 * from it needs the lines apart, so that an ingredient already in the bowl can be
 * ticked off and a step already done can be dimmed.
 */
export function htmlToLines(html: string | null | undefined): string[] {
  const safe = sanitize(html);
  if (!safe) return [];

  const doc = new DOMParser().parseFromString(`<div>${safe}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const lines: string[] = [];

  function take(fragment: string): void {
    // A break inside a paragraph is a line of its own: that is how a list
    // someone typed without making it a list is stored.
    for (const part of fragment.split(/<br\s*\/?>/i)) {
      const line = part.trim();
      if (htmlToText(line)) lines.push(line);
    }
  }

  function walk(node: Element): void {
    // Inline content collects until a block interrupts it, so that a stray
    // heading beside a list — "לבצק:" above the dough — keeps its own line.
    let inline = "";

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        inline += escapeHtml(child.textContent ?? "");
        continue;
      }
      if (child.nodeType !== 1) continue;

      const element = child as Element;
      const isBlock =
        LINE_BLOCKS.has(element.tagName) ||
        element.tagName === "UL" ||
        element.tagName === "OL";

      if (!isBlock) {
        inline += element.outerHTML;
        continue;
      }

      take(inline);
      inline = "";
      walk(element);
    }

    take(inline);
  }

  walk(root);
  return lines;
}

/** True when a field holds nothing a reader would see. */
export function isBlankHtml(html: string | null | undefined): boolean {
  return htmlToText(html).length === 0;
}

/** Wraps plain text (from a .txt file or a plain paste) as simple HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => escapeHtml(line.trim()))
        .filter(Boolean);
      return lines.length ? `<p>${lines.join("<br>")}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
