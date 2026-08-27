import { strFromU8, unzipSync } from "fflate";

/*
 * Word documents, read in the browser.
 *
 * A .docx is a zip archive whose `word/document.xml` holds the text. Grandma's
 * recipes arrive as Word files more often than as anything else, so rather
 * than telling people to copy and paste, the file is unzipped here and turned
 * into the same simple HTML the rest of the app speaks — bold and italic
 * survive, which matters when the original marked the ingredients that way.
 *
 * Only the modern .docx format is readable. The old binary .doc is a different
 * beast entirely and is not worth a parser.
 */

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Drive reports a `mimeType`, a `File` reports a `type`; both land here. */
export function isDocx(name: string, mimeType: string): boolean {
  return mimeType === DOCX_MIME || /\.docx$/i.test(name);
}

export function isLegacyDoc(name: string, mimeType: string): boolean {
  return mimeType === "application/msword" || /\.doc$/i.test(name);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `<w:b/>` means on; `<w:b w:val="0"/>` means explicitly off. */
function isOn(properties: Element | null, tag: string): boolean {
  const el = properties?.getElementsByTagNameNS(W_NS, tag)[0];
  if (!el) return false;
  const val = el.getAttributeNS(W_NS, "val") ?? el.getAttribute("w:val");
  return val !== "0" && val !== "false";
}

/** The text of one run, with its bold/italic wrapping kept. */
function runToHtml(run: Element): string {
  const properties = run.getElementsByTagNameNS(W_NS, "rPr")[0] ?? null;

  let text = "";
  for (const node of Array.from(run.childNodes)) {
    if (node.nodeType !== 1) continue;
    const el = node as Element;

    switch (el.localName) {
      case "t":
        text += el.textContent ?? "";
        break;
      case "tab":
        text += " ";
        break;
      case "br":
        text += "<br>";
        break;
    }
  }

  if (!text) return "";

  // The break is markup, everything else is content the document typed.
  let html = text
    .split("<br>")
    .map(escapeHtml)
    .join("<br>");

  if (isOn(properties, "i")) html = `<em>${html}</em>`;
  if (isOn(properties, "b")) html = `<strong>${html}</strong>`;
  return html;
}

/**
 * Turns the bytes of a .docx into HTML: one paragraph per `<p>`, blank
 * paragraphs dropped. Table cells become paragraphs too, which is enough for
 * the ingredient tables people like to build.
 */
export function docxToHtml(buffer: ArrayBuffer): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("הקובץ אינו קובץ Word תקין");
  }

  const document = entries["word/document.xml"];
  if (!document) throw new Error("לא נמצא טקסט בקובץ ה-Word");

  const xml = new DOMParser().parseFromString(strFromU8(document), "application/xml");
  if (xml.getElementsByTagName("parsererror").length > 0) {
    throw new Error("קריאת קובץ ה-Word נכשלה");
  }

  const paragraphs: string[] = [];
  for (const p of Array.from(xml.getElementsByTagNameNS(W_NS, "p"))) {
    const html = Array.from(p.getElementsByTagNameNS(W_NS, "r"))
      .map(runToHtml)
      .join("")
      .trim();
    if (html) paragraphs.push(`<p>${html}</p>`);
  }

  if (paragraphs.length === 0) throw new Error("קובץ ה-Word ריק");
  return paragraphs.join("\n");
}
