/*
 * A PDF writer, cut down to the one document this app produces.
 *
 * A full PDF library is a large dependency, and almost all of its weight goes
 * on things a recipe page does not need: vector text, embedded fonts, colour
 * management, encryption. It also goes on the one thing that would actually be
 * hard here — Hebrew. Text in a PDF has to be laid out by whoever writes the
 * file, which means embedding a Hebrew font, mapping every character to a glyph
 * and reordering right-to-left runs by hand.
 *
 * The browser already does all of that, perfectly, on a canvas. So the recipe
 * is painted onto a canvas page (see recipe-pdf.ts) and this file wraps the
 * result in the smallest legal PDF that shows it: a catalog, a page tree, and
 * one full-bleed JPEG per page. A JPEG needs no compression code of our own —
 * PDF's /DCTDecode filter takes the file's bytes exactly as the canvas produced
 * them.
 *
 * The trade is that the text in the page is a picture of text rather than text
 * that can be selected. For a recipe that gets printed, filed in Drive or read
 * on a phone beside the hob, that is the right way round.
 */

const encoder = new TextEncoder();

/** One page of the document: the image that fills it, and its pixel size. */
export type PdfPage = {
  jpeg: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
};

export type PdfMeta = {
  title: string;
  /** Page size in PostScript points, 72 to the inch. */
  width: number;
  height: number;
};

/** The body of one indirect object, as a mix of markup and raw stream bytes. */
type Chunk = string | Uint8Array;

/**
 * A PDF text string carrying Hebrew. The format's default encoding has no room
 * for it, so the string is written as UTF-16BE, in hex, behind a byte-order
 * mark — which is the escape hatch the spec provides and the only one readers
 * agree on.
 */
function textString(value: string): string {
  let hex = "FEFF";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0xffff) {
      const rest = code - 0x10000;
      hex += (0xd800 + (rest >> 10)).toString(16).padStart(4, "0");
      hex += (0xdc00 + (rest & 0x3ff)).toString(16).padStart(4, "0");
    } else {
      hex += code.toString(16).padStart(4, "0");
    }
  }
  return `<${hex.toUpperCase()}>`;
}

/** The format PDF wants a date in: `D:YYYYMMDDHHmmSS+HH'mm'`. */
function pdfDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // getTimezoneOffset counts minutes behind UTC, so its sign is the opposite of
  // the one that goes in the file.
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);

  return (
    `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}'${pad(abs % 60)}'`
  );
}

/** Points, at the precision a page geometry needs and no more. */
function pt(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/** Assembles the pages into a PDF file. */
export function buildPdf(pages: PdfPage[], meta: PdfMeta): Blob {
  // The catalog and the page tree are objects 1 and 2, because everything below
  // them has to name the page tree before the page tree can name its pages.
  // Their slots are reserved here and filled in once the pages exist.
  const objects: (Chunk[] | null)[] = [null, null];
  const add = (body: Chunk[]): number => objects.push(body);

  const pageObjects: number[] = [];

  for (const page of pages) {
    const image = add([
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} ` +
        `/Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    ]);

    // The image is drawn into the unit square, so the matrix that places it is
    // simply the page's own size.
    const drawing = encoder.encode(
      `q\n${pt(meta.width)} 0 0 ${pt(meta.height)} 0 0 cm\n/Im0 Do\nQ\n`,
    );
    const contents = add([
      `<< /Length ${drawing.length} >>\nstream\n`,
      drawing,
      "\nendstream",
    ]);

    pageObjects.push(
      add([
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(meta.width)} ${pt(meta.height)}] ` +
          `/Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${contents} 0 R >>`,
      ]),
    );
  }

  const info = add([
    `<< /Title ${textString(meta.title)} /Producer ${textString("מתכונים")} ` +
      `/CreationDate (${pdfDate(new Date())}) >>`,
  ]);

  objects[0] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  objects[1] = [
    `<< /Type /Pages /Kids [${pageObjects.map((n) => `${n} 0 R`).join(" ")}] ` +
      `/Count ${pageObjects.length} >>`,
  ];

  // ------------------------------------------------------------------
  // Serialisation. The cross-reference table at the end is a list of byte
  // offsets, so everything is written once, counting as it goes.
  // ------------------------------------------------------------------

  const parts: Uint8Array[] = [];
  let length = 0;

  function write(chunk: Chunk): void {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  }

  write("%PDF-1.4\n");
  // Four high bytes in a comment, which is how a PDF declares itself binary so
  // that a transport tempted to "fix" line endings leaves it alone.
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(length);
    write(`${index + 1} 0 obj\n`);
    for (const chunk of body ?? []) write(chunk);
    write("\nendobj\n");
  });

  const startxref = length;
  write(`xref\n0 ${objects.length + 1}\n`);
  // Every entry is exactly twenty bytes wide; readers seek by multiplying.
  write("0000000000 65535 f \n");
  for (const offset of offsets) write(`${String(offset).padStart(10, "0")} 00000 n \n`);

  write(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\n` +
      `startxref\n${startxref}\n%%EOF\n`,
  );

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
