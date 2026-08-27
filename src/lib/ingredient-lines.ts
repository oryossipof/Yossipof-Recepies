/**
 * The ingredient list as separate lines.
 *
 * The AI writes the list as <ul><li>…</li></ul> and the editor keeps that, but
 * a hand-typed list is just as likely to be paragraphs, plain divs from the
 * contenteditable, or one block broken up with <br>. All of those read as a
 * list of ingredients to a person, so all of them have to split here.
 */
export function ingredientLines(html: string | null | undefined): string[] {
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, "text/html");

  // A <br> ends a line every bit as much as a new <li> does.
  for (const br of Array.from(doc.querySelectorAll("br"))) {
    br.replaceWith(doc.createTextNode("\n"));
  }

  const items = Array.from(doc.querySelectorAll("li"));
  const blocks = items.length > 0 ? items : Array.from(doc.body.querySelectorAll("p, div"));

  // Only the innermost blocks: a <div> wrapping three <p>s would otherwise
  // contribute every ingredient a second time.
  const leaves = blocks.filter((block) => !block.querySelector("li, p, div"));

  const text =
    leaves.length > 0
      ? leaves.map((leaf) => leaf.textContent ?? "").join("\n")
      : (doc.body.textContent ?? "");

  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
