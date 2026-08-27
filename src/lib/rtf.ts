/*
 * Rich Text Format, which is what a great many ".doc" files turn out to be.
 *
 * Word has always been willing to save RTF, HTML or a zip under a .doc name,
 * so the extension says nothing about the format. RTF itself is text: control
 * words starting with a backslash, groups in braces, and the characters in
 * between. Non-ASCII arrives either as \uNNNN escapes or as \'hh bytes in
 * whatever code page the file declares — for Hebrew documents that is almost
 * always windows-1255, and getting it wrong is the difference between a recipe
 * and a screen of question marks.
 */

/** Groups whose contents are machinery rather than text. */
const SKIPPED_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "listtable",
  "listoverridetable",
  "revtbl",
  "info",
  "generator",
  "themedata",
  "colorschememapping",
  "latentstyles",
  "datastore",
  "xmlnstbl",
  "filetbl",
  "header",
  "headerl",
  "headerr",
  "headerf",
  "footer",
  "footerl",
  "footerr",
  "footerf",
]);

const CODE_PAGES: Record<number, string> = {
  1250: "windows-1250",
  1251: "windows-1251",
  1252: "windows-1252",
  1253: "windows-1253",
  1254: "windows-1254",
  1255: "windows-1255",
  1256: "windows-1256",
  1257: "windows-1257",
  1258: "windows-1258",
  862: "windows-1255",
  10005: "windows-1255",
};

export function isRtf(bytes: Uint8Array): boolean {
  // "{\rtf"
  return (
    bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 &&
    bytes[4] === 0x66
  );
}

type Group = {
  /** Characters to swallow after a \u escape, its ASCII stand-in. */
  skipAfterUnicode: number;
  ignore: boolean;
};

export type RtfContent = {
  html: string;
  images: File[];
};

export function readRtf(buffer: ArrayBuffer): RtfContent {
  const bytes = new Uint8Array(buffer);
  // The syntax is ASCII; the interesting bytes arrive as \'hh escapes.
  const source = Array.from(bytes, (b) => String.fromCharCode(b)).join("");

  let codePage = "windows-1252";
  const cpgMatch = source.match(/\\ansicpg(\d+)/);
  if (cpgMatch) codePage = CODE_PAGES[Number(cpgMatch[1])] ?? "windows-1252";
  else if (/\\fcharset177/.test(source)) codePage = "windows-1255";

  const decoder = new TextDecoder(codePage);
  const images: File[] = [];

  const stack: Group[] = [{ skipAfterUnicode: 1, ignore: false }];
  let group = stack[0];

  let text = "";
  let pending: number[] = [];
  let skip = 0;

  /** \'hh bytes collect into runs so the code page decoder sees whole words. */
  function flush() {
    if (pending.length === 0) return;
    text += decoder.decode(new Uint8Array(pending));
    pending = [];
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (char === "{") {
      flush();
      group = { ...group };
      stack.push(group);
      continue;
    }

    if (char === "}") {
      flush();
      stack.pop();
      group = stack[stack.length - 1] ?? { skipAfterUnicode: 1, ignore: false };
      continue;
    }

    if (char === "\\") {
      const next = source[i + 1];

      // \'hh — one byte in the document's code page.
      if (next === "'") {
        const hex = source.slice(i + 2, i + 4);
        i += 3;
        if (skip > 0) skip--;
        else if (!group.ignore) pending.push(parseInt(hex, 16));
        continue;
      }

      // An escaped brace or backslash is literal text.
      if (next === "\\" || next === "{" || next === "}") {
        i += 1;
        if (!group.ignore) {
          flush();
          text += next;
        }
        continue;
      }

      // \* marks a destination nothing outside Word understands.
      if (next === "*") {
        i += 1;
        group.ignore = true;
        continue;
      }

      const word = source.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (!word) continue;

      const name = word[1];
      const parameter = word[2] === undefined ? undefined : Number(word[2]);
      i += word[0].length;

      flush();

      switch (name) {
        case "par":
        case "line":
        case "sect":
        case "page":
        case "row":
          if (!group.ignore) text += "\n";
          break;
        case "cell":
        case "tab":
          if (!group.ignore) text += " ";
          break;
        case "uc":
          group.skipAfterUnicode = parameter ?? 1;
          break;
        case "u": {
          if (parameter === undefined) break;
          if (!group.ignore) {
            const code = parameter < 0 ? parameter + 65536 : parameter;
            text += String.fromCharCode(code);
          }
          skip = group.skipAfterUnicode;
          break;
        }
        case "pict": {
          const picture = readPicture(source, i, images.length + 1);
          if (picture) images.push(picture.file);
          if (picture) i = picture.end;
          group.ignore = true;
          break;
        }
        default:
          if (SKIPPED_DESTINATIONS.has(name)) group.ignore = true;
      }
      continue;
    }

    if (char === "\r" || char === "\n") continue;

    if (skip > 0) {
      skip--;
      continue;
    }

    if (!group.ignore) {
      flush();
      text += char;
    }
  }
  flush();

  return { html: toHtml(text), images };
}

/** A picture is hex, run until the group that holds it closes. */
function readPicture(
  source: string,
  from: number,
  index: number,
): { file: File; end: number } | null {
  let depth = 1;
  let end = from;
  while (end < source.length && depth > 0) {
    if (source[end] === "{") depth++;
    else if (source[end] === "}") depth--;
    if (depth > 0) end++;
  }

  const body = source.slice(from, end);
  const png = /\\pngblip/.test(body);
  const hex = body.replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[^0-9a-fA-F]/g, "");
  if (hex.length < 20_000) return null;

  const data = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < data.length; i++) data[i] = parseInt(hex.substr(i * 2, 2), 16);

  return {
    file: new File([data], `rtf-image-${index}.${png ? "png" : "jpg"}`, {
      type: png ? "image/png" : "image/jpeg",
    }),
    end,
  };
}

function toHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<p>${line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`,
    )
    .join("\n");
}
