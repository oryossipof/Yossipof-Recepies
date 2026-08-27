import { isCompoundFile } from "./cfb";
import { readDoc } from "./doc";
import { readDocx } from "./docx";
import { scanForImages } from "./embedded-images";
import { readRtf } from "./rtf";

/*
 * One door for "a document", whatever it really is.
 *
 * A .doc extension promises nothing. Word has always been willing to write
 * RTF, HTML or a zip under that name, and files travel between machines for
 * decades, so the only trustworthy thing is the bytes at the front of the
 * file. Every reader is picked by signature; the extension is used only to
 * decide whether to try at all.
 */

export type DocumentContent = {
  html: string;
  images: File[];
};

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const RTF = [0x7b, 0x5c, 0x72, 0x74, 0x66];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/** True for anything this module is willing to open. */
export function isDocument(name: string, mimeType: string): boolean {
  return (
    mimeType === "application/msword" ||
    mimeType === "application/rtf" ||
    mimeType === "text/rtf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.(docx?|rtf)$/i.test(name)
  );
}

export function readDocument(buffer: ArrayBuffer): DocumentContent {
  const bytes = new Uint8Array(buffer, 0, Math.min(4096, buffer.byteLength));

  // A real Word 97 binary, inside its compound-file container.
  if (isCompoundFile(buffer)) return readDoc(buffer);

  // A .docx, whatever it calls itself.
  if (startsWith(bytes, ZIP)) return readDocx(buffer);

  if (startsWith(bytes, RTF)) return readRtf(buffer);

  // "Web page" documents: Word's HTML, or an XML-flavoured Word 2003 file.
  const head = new TextDecoder("windows-1252").decode(bytes).trimStart();
  if (/^<(\?xml|!doctype|html|meta|body)/i.test(head)) return fromMarkup(buffer);

  // The signature, and only the signature: enough to identify a format that
  // should be supported, without printing someone's document to the console.
  console.warn(
    "[import] unrecognised document, first bytes:",
    Array.from(bytes.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join(" "),
  );

  // A signature that is nearly right is a Word document with damaged bytes —
  // these files are decades old and have been copied between machines for
  // most of that time. Saying so beats "unknown format", because the fix is
  // completely different: recover the file rather than convert it.
  if (looksDamaged(bytes)) {
    throw new Error(
      "נראה שהקובץ פגום — הוא מסמך Word, אבל תחילת הקובץ שגויה. " +
        "נסו לפתוח אותו ב-Word (שיציע לתקן אותו) ולשמור מחדש כ-docx.",
    );
  }

  throw new Error(
    "לא זוהה סוג הקובץ. אפשר לפתוח אותו ב-Word ולשמור מחדש כ-docx, " +
      "או להעתיק ולהדביק את המתכון כטקסט.",
  );
}

/** Close enough to the compound-file signature that the file was one, once. */
function looksDamaged(bytes: Uint8Array): boolean {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  const matching = signature.filter((b, i) => bytes[i] === b).length;
  return matching >= 6;
}

/**
 * Word's own HTML export, or a Word 2003 XML file. Both are markup around the
 * text, so the tags are dropped and the paragraph-ish ones become breaks. The
 * encoding is taken from the document's own declaration when it makes one,
 * because Hebrew saved this way is usually windows-1255 rather than UTF-8.
 */
function fromMarkup(buffer: ArrayBuffer): DocumentContent {
  const bytes = new Uint8Array(buffer);
  const ascii = new TextDecoder("windows-1252").decode(bytes.subarray(0, 4096));
  const declared = ascii.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase();

  let markup: string;
  try {
    markup = new TextDecoder(declared ?? "utf-8").decode(bytes);
  } catch {
    markup = new TextDecoder("utf-8").decode(bytes);
  }

  const document = new DOMParser().parseFromString(markup, "text/html");
  document.querySelectorAll("style, script, head").forEach((el) => el.remove());

  const html = (document.body?.innerText ?? document.body?.textContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("\n");

  if (!html) throw new Error("לא נמצא טקסט בקובץ");

  // A Word HTML export keeps its pictures in a folder beside the file, so
  // usually there is nothing to find — but a single-file .mht keeps them
  // inline, and those are worth catching.
  return { html, images: scanForImages(bytes) };
}
