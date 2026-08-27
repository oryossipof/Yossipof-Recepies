/*
 * Pictures pulled out of documents, without a parser for each format.
 *
 * Two jobs live here. A PDF stores a photograph as a JPEG stream, byte for
 * byte, so its streams can be read directly — a full PDF library is about a
 * megabyte of JavaScript, too much to load on a phone for one feature. A .doc
 * wraps its pictures in Escher drawing records that are far more trouble than
 * they are worth, but the image data inside them is still an untouched JPEG or
 * PNG, so the stream is simply scanned for the signatures.
 *
 * Both are deliberately generous: whatever is not really an image is dropped
 * later by `keepPhotos`, which decodes every candidate before offering it.
 */

/** Small enough to be a logo or a bullet rather than a photo of the food. */
const MIN_BYTES = 10_000;

function bytesOf(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

const STREAM = bytesOf("stream");
const ENDSTREAM = bytesOf("endstream");
const IEND = bytesOf("IEND");

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function indexOfBytes(haystack: Uint8Array, needle: number[], from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function matches(bytes: Uint8Array, at: number, signature: number[]): boolean {
  return signature.every((b, i) => bytes[at + i] === b);
}

/** JPEG files start FF D8 FF and end FF D9. */
function startsJpeg(bytes: Uint8Array, at: number): boolean {
  return bytes[at] === 0xff && bytes[at + 1] === 0xd8 && bytes[at + 2] === 0xff;
}

function toFile(data: Uint8Array, index: number, type: string, extension: string): File {
  // A copy in a buffer of its own, so the File does not pin the whole document.
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return new File([copy.buffer as ArrayBuffer], `image-${index}.${extension}`, { type });
}

/** The JPEG images embedded in a PDF, biggest first. */
export function extractPdfImages(buffer: ArrayBuffer): File[] {
  const bytes = new Uint8Array(buffer);
  const found: File[] = [];

  let cursor = 0;
  while (true) {
    const keyword = indexOfBytes(bytes, STREAM, cursor);
    if (keyword === -1) break;

    // The stream data begins after the keyword and its end-of-line.
    let start = keyword + STREAM.length;
    if (bytes[start] === 0x0d) start++;
    if (bytes[start] === 0x0a) start++;

    const end = indexOfBytes(bytes, ENDSTREAM, start);
    if (end === -1) break;

    if (startsJpeg(bytes, start)) {
      // Walk back to the end-of-image marker, past any padding before the
      // keyword, so the JPEG is not handed over with a tail of PDF syntax.
      let stop = end;
      while (stop > start + 2 && !(bytes[stop - 2] === 0xff && bytes[stop - 1] === 0xd9)) stop--;

      const data = bytes.slice(start, stop > start + 2 ? stop : end);
      if (data.length >= MIN_BYTES) found.push(toFile(data, found.length + 1, "image/jpeg", "jpg"));
    }

    cursor = end + ENDSTREAM.length;
  }

  return found.sort((a, b) => b.size - a.size);
}

/**
 * Every JPEG and PNG lying in a block of bytes, biggest first. Used on the
 * streams of a .doc, where the pictures are embedded whole inside Word's own
 * drawing records.
 */
export function scanForImages(bytes: Uint8Array): File[] {
  const found: File[] = [];

  for (let i = 0; i < bytes.length - 8; i++) {
    if (startsJpeg(bytes, i)) {
      const end = indexOfJpegEnd(bytes, i + 3);
      if (end === -1) continue;

      const data = bytes.slice(i, end);
      if (data.length >= MIN_BYTES) found.push(toFile(data, found.length + 1, "image/jpeg", "jpg"));
      i = end - 1;
      continue;
    }

    if (matches(bytes, i, PNG_SIGNATURE)) {
      // A PNG ends with the IEND chunk and its four bytes of checksum.
      const iend = indexOfBytes(bytes, IEND, i + 8);
      if (iend === -1) continue;

      const data = bytes.slice(i, iend + 8);
      if (data.length >= MIN_BYTES) found.push(toFile(data, found.length + 1, "image/png", "png"));
      i = iend + 7;
    }
  }

  return found.sort((a, b) => b.size - a.size);
}

/** The first end-of-image marker that is not inside a restart or scan header. */
function indexOfJpegEnd(bytes: Uint8Array, from: number): number {
  for (let i = from; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return i + 2;
  }
  return -1;
}
