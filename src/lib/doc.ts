import { isCompoundFile, openCompoundFile } from "./cfb";
import { scanForImages } from "./embedded-images";

/*
 * Legacy Word documents (.doc), read in the browser.
 *
 * Word 97 does not store its text in one run. The FIB — the header at the
 * start of the WordDocument stream — points into a table stream at a "piece
 * table": a list of character ranges, each saying where in the stream its text
 * sits and whether it is packed one byte per character or stored as UTF-16.
 * Hebrew never fits in a byte, so those pieces come back UTF-16, which is what
 * makes this worth doing at all rather than guessing an encoding.
 *
 * What comes out is plain text with the paragraph marks kept, wrapped into the
 * same simple HTML the rest of the app speaks. Character formatting is not
 * recovered: it lives in a separate run-property table, and the AI reads the
 * words, not the bolding. A .docx keeps its bold; a .doc does not.
 */

const FIB_MAGIC = 0xa5ec;

/** Set when the tables live in "1Table" rather than "0Table". */
const F_WHICH_TBL_STM = 0x0200;

/** A piece's offset has this bit set when its text is packed into single bytes. */
const COMPRESSED = 0x40000000;
const FC_MASK = 0x3fffffff;

/**
 * The few single bytes that do not mean what CP1252 says they mean when Word
 * packs text. Everything else in a compressed piece is plain CP1252.
 */
const COMPRESSED_EXCEPTIONS: Record<number, string> = {
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9f: "Ÿ",
};

export function isLegacyDoc(name: string, mimeType: string): boolean {
  return mimeType === "application/msword" || /\.doc$/i.test(name);
}

export type DocContent = {
  html: string;
  images: File[];
};

/** Reads the text of a .doc, and whatever pictures were pasted into it. */
export function readDoc(buffer: ArrayBuffer): DocContent {
  if (!isCompoundFile(buffer)) {
    throw new Error("הקובץ אינו מסמך Word תקין. אם הוא נשמר כ-docx, בחרו אותו כך.");
  }

  const file = openCompoundFile(buffer);
  const document = file.read("WordDocument");
  if (!document) throw new Error("לא נמצא טקסט במסמך ה-Word");

  const view = new DataView(document.buffer, document.byteOffset, document.byteLength);
  if (view.getUint16(0, true) !== FIB_MAGIC) throw new Error("הקובץ אינו מסמך Word תקין");

  const table = file.read(view.getUint16(0x0a, true) & F_WHICH_TBL_STM ? "1Table" : "0Table");
  if (!table) throw new Error("המסמך שמור בגרסת Word ישנה מדי");

  const text = pieceTableText(document, view, table);
  const html = toHtml(text);
  if (!html) throw new Error("לא נמצא טקסט במסמך ה-Word");

  // Pictures in a .doc are wrapped in Escher records rather than stored as
  // files, so the streams are scanned for image signatures instead. Anything
  // that is not really an image is dropped later, when the candidates are
  // decoded.
  const data = file.read("Data");
  return {
    html,
    images: [...scanForImages(document), ...(data ? scanForImages(data) : [])],
  };
}

/**
 * Walks the FIB by its length fields rather than by fixed offsets, since the
 * blocks grew with every Word version, then follows the piece table it points
 * at and concatenates the text of every piece.
 */
function pieceTableText(document: Uint8Array, view: DataView, table: Uint8Array): string {
  let at = 32;
  const csw = view.getUint16(at, true);
  at += 2 + csw * 2;

  const cslw = view.getUint16(at, true);
  at += 2 + cslw * 4;

  // The pairs of file offsets and lengths. fcClx is the 34th pair, and has
  // been ever since Word 97 — later versions only append to the block.
  const pairs = at + 2;
  const fcClx = view.getUint32(pairs + 66 * 4, true);
  const lcbClx = view.getUint32(pairs + 67 * 4, true);
  if (lcbClx === 0 || fcClx + lcbClx > table.length) {
    throw new Error("לא ניתן לקרוא את מבנה מסמך ה-Word");
  }

  const clx = table.subarray(fcClx, fcClx + lcbClx);
  const clxView = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);

  // The piece table is preceded by any number of property blocks.
  let i = 0;
  while (i < clx.length && clx[i] === 0x01) i += 3 + clxView.getUint16(i + 1, true);
  if (clx[i] !== 0x02) throw new Error("לא ניתן לקרוא את מבנה מסמך ה-Word");

  const length = clxView.getUint32(i + 1, true);
  const plc = clx.subarray(i + 5, i + 5 + length);
  const plcView = new DataView(plc.buffer, plc.byteOffset, plc.byteLength);

  // Each piece costs 8 bytes, and the character positions are one longer than
  // the number of pieces.
  const pieces = Math.floor((length - 4) / 12);
  const positions = (pieces + 1) * 4;

  let text = "";
  for (let p = 0; p < pieces; p++) {
    const from = plcView.getUint32(p * 4, true);
    const to = plcView.getUint32((p + 1) * 4, true);
    const characters = to - from;
    if (characters <= 0) continue;

    const descriptor = plcView.getUint32(positions + p * 8 + 2, true);
    const compressed = (descriptor & COMPRESSED) !== 0;
    const offset = compressed ? (descriptor & FC_MASK) / 2 : descriptor & FC_MASK;

    text += compressed
      ? readCompressed(document, offset, characters)
      : readUtf16(view, offset, characters, document.length);
  }

  return text;
}

function readCompressed(document: Uint8Array, offset: number, characters: number): string {
  let text = "";
  for (let i = 0; i < characters && offset + i < document.length; i++) {
    const byte = document[offset + i];
    text += COMPRESSED_EXCEPTIONS[byte] ?? String.fromCharCode(byte);
  }
  return text;
}

function readUtf16(view: DataView, offset: number, characters: number, limit: number): string {
  let text = "";
  for (let i = 0; i < characters && offset + i * 2 + 1 < limit; i++) {
    text += String.fromCharCode(view.getUint16(offset + i * 2, true));
  }
  return text;
}

/**
 * Word's control characters, turned into paragraphs. A field — a page number,
 * a hyperlink — is stored as its instructions, then its result, then an end
 * marker; only the result is wanted.
 */
function toHtml(raw: string): string {
  let text = "";
  let inFieldInstruction = false;

  for (const character of raw) {
    const code = character.charCodeAt(0);

    if (code === 0x13) {
      inFieldInstruction = true;
      continue;
    }
    if (code === 0x14 || code === 0x15) {
      inFieldInstruction = false;
      continue;
    }
    if (inFieldInstruction) continue;

    switch (code) {
      case 0x0d: // paragraph
      case 0x07: // end of a table cell or row
        text += "\n";
        break;
      case 0x0b: // line break
      case 0x0c: // page break
        text += "\n";
        break;
      case 0x09:
        text += " ";
        break;
      default:
        // Anything below space that is left is a marker for something the app
        // does not carry over — a picture anchor, a footnote reference.
        if (code >= 0x20) text += character;
    }
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
