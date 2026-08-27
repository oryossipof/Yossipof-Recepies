/*
 * Pictures inside a PDF, without a PDF library.
 *
 * A full parser (pdf.js and its worker) is about a megabyte of JavaScript, too
 * much to load on a phone for one feature. It is also more than the job needs:
 * a photograph placed in a PDF is stored as a JPEG stream, byte for byte, so
 * the file can simply be scanned for streams that begin with the JPEG marker
 * and end with its end-of-image marker.
 *
 * That leaves out pictures compressed some other way (Flate-encoded bitmaps,
 * mostly diagrams and scans of line art), and a stream that happens to contain
 * the bytes "endstream" comes out truncated. Both are handled downstream:
 * every candidate is decoded before it is offered, and whatever fails to
 * decode is dropped.
 */

/** Small enough to be a logo or a bullet rather than a photo of the food. */
const MIN_BYTES = 10_000;

function bytesOf(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

const STREAM = bytesOf("stream");
const ENDSTREAM = bytesOf("endstream");

function indexOfBytes(haystack: Uint8Array, needle: number[], from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** JPEG files start FF D8 FF. */
function startsJpeg(bytes: Uint8Array, at: number): boolean {
  return bytes[at] === 0xff && bytes[at + 1] === 0xd8 && bytes[at + 2] === 0xff;
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
      if (data.length >= MIN_BYTES) {
        found.push(
          new File([data], `pdf-image-${found.length + 1}.jpg`, { type: "image/jpeg" }),
        );
      }
    }

    cursor = end + ENDSTREAM.length;
  }

  return found.sort((a, b) => b.size - a.size);
}
