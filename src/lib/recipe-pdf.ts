import { buildPdf, type PdfPage } from "./pdf";
import { formatGrams } from "./nutrition";
import {
  hasNutrition,
  nutritionRows,
  recipeSections,
  type NutritionRow,
  type SharedRecipe,
} from "./recipe-share";

/*
 * The recipe as a printed page.
 *
 * Each page is painted on a canvas and then wrapped in a PDF (see pdf.ts). The
 * canvas is doing the hard part: Hebrew needs the text laid out right to left,
 * with the numbers and the odd English word inside it running the other way,
 * and the browser's own text engine is the only thing here that gets that right
 * without a bidi implementation of our own.
 *
 * The page is drawn light whatever the app is set to. It is going to a printer,
 * to a mail attachment or to a Drive folder, and a recipe printed white-on-navy
 * is a recipe that empties an ink cartridge.
 */

// A4, in points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 46;
const RIGHT = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Where the text has to stop, leaving the foot of the page for the rule and the page number. */
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - 26;

/**
 * Two device pixels per point. The text is a picture by the time it reaches the
 * PDF, so this is what decides whether it stays sharp when the page is printed
 * or zoomed; more than this buys nothing visible and costs a bigger file.
 */
const SCALE = 2;

const FONT = '"Assistant", "Segoe UI", system-ui, sans-serif';

/** A line of recipe text, and the height one takes. */
const BODY = { size: 11.5, leading: 18 };

/** The nutrition table's heading row and each of its rows. */
const TABLE_HEAD = 22;
const TABLE_ROW = 25;

/*
 * The light palette, written out in hex.
 *
 * The app's own colours are oklch custom properties, which a canvas cannot read
 * and older phone browsers cannot parse. These are the same colours converted
 * once — the two text colours are the pair index.html already uses for its
 * pre-React error screen, and the blue is the theme colour from its meta tag.
 */
const INK = "#25324a";
const MUTED = "#5a6b85";
const RULE = "#dde5ee";
const BLUE = "#38bdf8";
const TINT = "#e9f6fe";

type TextStyle = {
  size: number;
  weight?: number;
  color?: string;
  /** Points to pull the line in from the right edge of the column. */
  indent?: number;
  /** Defaults to comfortable reading leading. */
  leading?: number;
};

/** The lines a string breaks into inside `maxWidth`, measured in the live font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = "";

    // A single word wider than the column — a long URL, usually — is cut by
    // characters rather than allowed to run off the edge of the paper.
    if (ctx.measureText(word).width > maxWidth) {
      let piece = "";
      for (const char of word) {
        if (piece && ctx.measureText(piece + char).width > maxWidth) {
          lines.push(piece);
          piece = "";
        }
        piece += char;
      }
      line = piece;
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

/** As much of `text` as fits, with an ellipsis when something had to go. */
function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** A rounded rectangle path, built by hand so no canvas is asked for roundRect. */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * The document being drawn: a stack of canvas pages and a cursor down the
 * current one. Everything is placed in points, top down; the canvas is scaled
 * once so that no call site has to think in device pixels.
 */
class Sheet {
  readonly pages: HTMLCanvasElement[] = [];
  private ctx: CanvasRenderingContext2D;
  private y = MARGIN;

  constructor() {
    this.ctx = this.newPage();
  }

  private newPage(): CanvasRenderingContext2D {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(PAGE_WIDTH * SCALE);
    canvas.height = Math.round(PAGE_HEIGHT * SCALE);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("יצירת קובץ ה-PDF נכשלה");

    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";

    this.pages.push(canvas);
    this.y = MARGIN;
    this.ctx = ctx;
    return ctx;
  }

  /** How much room is left on the page below the cursor. */
  private get room(): number {
    return CONTENT_BOTTOM - this.y;
  }

  /** Turns the page when `height` will not fit, and answers with the page to draw on. */
  private fit(height: number): CanvasRenderingContext2D {
    if (height > this.room && this.y > MARGIN) this.newPage();
    return this.ctx;
  }

  gap(points: number): void {
    // Never at the top of a fresh page: a page that opens with an inch of
    // nothing looks like a mistake.
    if (this.y > MARGIN) this.y = Math.min(this.y + points, CONTENT_BOTTOM);
  }

  /** Right-aligned, wrapped text. Answers with the height it took. */
  text(value: string, style: TextStyle): void {
    const { size, weight = 400, color = INK, indent = 0 } = style;
    const leading = style.leading ?? size * 1.55;
    const font = `${weight} ${size}px ${FONT}`;

    this.ctx.font = font;
    for (const line of wrap(this.ctx, value, CONTENT_WIDTH - indent)) {
      const ctx = this.fit(leading);
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.fillText(line, RIGHT - indent, this.y + size);
      this.y += leading;
    }
  }

  /**
   * A list item. The bullet sits on the right edge and the wrapped remainder
   * lines up under the words rather than under the bullet.
   */
  bullet(value: string, style: TextStyle): void {
    const { size, weight = 400, color = INK } = style;
    const leading = style.leading ?? size * 1.55;
    const font = `${weight} ${size}px ${FONT}`;
    const marker = "•";

    this.ctx.font = font;
    const indent = this.ctx.measureText(`${marker}  `).width;

    wrap(this.ctx, value, CONTENT_WIDTH - indent).forEach((line, index) => {
      const ctx = this.fit(leading);
      ctx.font = font;
      ctx.fillStyle = color;
      if (index === 0) {
        ctx.fillStyle = BLUE;
        ctx.fillText(marker, RIGHT, this.y + size);
        ctx.fillStyle = color;
      }
      ctx.fillText(line, RIGHT - indent, this.y + size);
      this.y += leading;
    });
  }

  /**
   * A section heading with its rule under it.
   *
   * A heading is never left standing alone at the foot of a page — it says
   * what is coming and then nothing comes. `follows` is how much of what it
   * heads has to fit beside it; when that does not, the whole block goes over
   * to the next page together. Asking for more than a page holds is not a
   * reason to turn one — it would leave the page empty and still not fit.
   */
  heading(text: string, follows: number): void {
    const height = 21 + 4 + 1 + 8;
    this.gap(22);
    this.fit(height + Math.min(follows, CONTENT_BOTTOM - MARGIN - height));
    this.text(text, { size: 14.5, weight: 700, leading: 21 });
    this.gap(4);
    this.rule();
    this.gap(8);
  }

  /** A hairline across the column. */
  rule(): void {
    const ctx = this.fit(1);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(MARGIN, this.y);
    ctx.lineTo(RIGHT, this.y);
    ctx.stroke();
    this.y += 1;
  }

  /** The dish, cropped to the column the way the recipe screen crops it. */
  photo(image: HTMLImageElement): void {
    const height = Math.min(230, (image.naturalHeight / image.naturalWidth) * CONTENT_WIDTH);
    const ctx = this.fit(height);

    // Cover, not fit: the picture fills the box and the overflow is trimmed off
    // its long side, so no recipe gets white bars around its photograph.
    const wanted = CONTENT_WIDTH / height;
    const actual = image.naturalWidth / image.naturalHeight;
    const sw = actual > wanted ? image.naturalHeight * wanted : image.naturalWidth;
    const sh = actual > wanted ? image.naturalHeight : image.naturalWidth / wanted;

    ctx.save();
    roundedPath(ctx, MARGIN, this.y, CONTENT_WIDTH, height, 12);
    ctx.clip();
    ctx.drawImage(
      image,
      (image.naturalWidth - sw) / 2,
      (image.naturalHeight - sh) / 2,
      sw,
      sh,
      MARGIN,
      this.y,
      CONTENT_WIDTH,
      height,
    );
    ctx.restore();

    this.y += height;
  }

  /**
   * The nutrition table, in the columns the panel on screen uses. It is drawn a
   * chunk at a time so that a recipe divided a dozen ways still gets a whole
   * table with a heading on every page it spills onto.
   */
  nutrition(rows: NutritionRow[]): void {
    let index = 0;
    while (index < rows.length) {
      if (this.room < TABLE_HEAD + TABLE_ROW) this.newPage();
      const count = Math.min(
        Math.floor((this.room - TABLE_HEAD) / TABLE_ROW),
        rows.length - index,
      );
      this.drawTable(rows.slice(index, index + count), TABLE_HEAD, TABLE_ROW);
      index += count;
    }
  }

  private drawTable(rows: NutritionRow[], head: number, row: number): void {
    const ctx = this.ctx;
    const height = head + row * rows.length;
    const top = this.y;

    // Four columns: the division on the right, where the eye starts, and the
    // three figures beside it.
    const labelWidth = CONTENT_WIDTH * 0.4;
    const cellWidth = (CONTENT_WIDTH - labelWidth) / 3;
    const centre = (column: number) => RIGHT - labelWidth - cellWidth * (column + 0.5);

    ctx.save();
    roundedPath(ctx, MARGIN, top, CONTENT_WIDTH, height, 14);
    ctx.clip();

    // The whole-dish row is tinted, exactly as it is on screen.
    rows.forEach((entry, index) => {
      if (!entry.total) return;
      ctx.fillStyle = TINT;
      ctx.fillRect(MARGIN, top + head + row * index, CONTENT_WIDTH, row);
    });

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 0.7;
    // A line above every row, the topmost of which is what separates the
    // headings from the figures. The bottom edge belongs to the frame.
    for (let index = 0; index < rows.length; index += 1) {
      const y = top + head + row * index;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(RIGHT, y);
      ctx.stroke();
    }

    ctx.font = `500 9.5px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText("חלוקה", RIGHT - 12, top + 14.5);
    ctx.textAlign = "center";
    ["קלוריות", "חלבון (ג׳)", "שומן (ג׳)"].forEach((heading, column) => {
      ctx.fillText(heading, centre(column), top + 14.5);
    });

    rows.forEach((entry, index) => {
      const baseline = top + head + row * index + 16.5;
      const figures = [
        String(entry.values.calories),
        formatGrams(entry.values.protein),
        formatGrams(entry.values.fat),
      ];

      ctx.textAlign = "right";
      ctx.font = `${entry.total ? 700 : 400} 10.5px ${FONT}`;
      ctx.fillStyle = entry.total ? INK : MUTED;
      ctx.fillText(clip(ctx, entry.label, labelWidth - 20), RIGHT - 12, baseline);

      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      figures.forEach((figure, column) => ctx.fillText(figure, centre(column), baseline));
    });

    ctx.restore();
    ctx.textAlign = "right";

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 0.7;
    roundedPath(ctx, MARGIN, top, CONTENT_WIDTH, height, 14);
    ctx.stroke();

    this.y = top + height;
  }

  /** The rule and the page number at the foot of every page, once the count is known. */
  footer(title: string): void {
    this.pages.forEach((canvas, index) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseline = PAGE_HEIGHT - MARGIN;
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(MARGIN, baseline - 13);
      ctx.lineTo(RIGHT, baseline - 13);
      ctx.stroke();

      ctx.font = `400 8.5px ${FONT}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(clip(ctx, title, CONTENT_WIDTH * 0.6), RIGHT, baseline);
      ctx.textAlign = "left";
      ctx.fillText(`עמוד ${index + 1} מתוך ${this.pages.length}`, MARGIN, baseline);
      ctx.textAlign = "right";
    });
  }
}

/**
 * Waits for the app's own typeface before anything is measured. A canvas does
 * not wait for a web font the way the DOM does: it draws in the fallback and
 * the page comes out in the wrong face, wrapped to the wrong widths.
 */
async function readyFont(): Promise<void> {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 12px ${FONT}`),
      document.fonts.load(`700 12px ${FONT}`),
    ]);
  } catch {
    // A missing font costs the page its typeface, not its contents.
  }
}

/**
 * The recipe photo, or nothing.
 *
 * `crossOrigin` is what keeps the canvas exportable: without it a photo from
 * storage taints the canvas and the whole PDF fails at the last step. With it,
 * a photo the storage will not share simply fails to load, and the recipe is
 * printed without its picture rather than not at all.
 */
function loadPhoto(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function toJpeg(canvas: HTMLCanvasElement): Promise<PdfPage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("יצירת קובץ ה-PDF נכשלה"));
          return;
        }
        blob.arrayBuffer().then(
          (buffer) =>
            resolve({
              jpeg: new Uint8Array(buffer),
              pixelWidth: canvas.width,
              pixelHeight: canvas.height,
            }),
          reject,
        );
      },
      "image/jpeg",
      0.9,
    );
  });
}

/** Draws the recipe and answers with the finished PDF. */
export async function recipeToPdf(recipe: SharedRecipe): Promise<Blob> {
  await readyFont();
  const photo = await loadPhoto(recipe.imageUrl);

  const sheet = new Sheet();

  sheet.text(recipe.title, { size: 23, weight: 700, leading: 30 });

  const subtitle = [recipe.author && `מאת ${recipe.author}`, recipe.categories.join(" · ")]
    .filter(Boolean)
    .join("   ·   ");
  if (subtitle) sheet.text(subtitle, { size: 10, color: MUTED, leading: 15 });

  if (photo) {
    sheet.gap(16);
    sheet.photo(photo);
  }

  for (const section of recipeSections(recipe)) {
    // Three lines of the section, or the whole of a shorter one, have to fit
    // under the heading before a page may break above them.
    sheet.heading(
      `${section.emoji}  ${section.title}`,
      Math.min(section.lines.length, 3) * BODY.leading,
    );

    for (const line of section.lines) {
      const style = { ...BODY, weight: line.heading ? 700 : 400 };
      if (section.bulleted && !line.heading) sheet.bullet(line.text, style);
      else sheet.text(line.text, style);
    }
  }

  if (hasNutrition(recipe)) {
    const rows = nutritionRows(recipe.nutrition);
    // The whole table, not just its first row: four rows split over two pages
    // is a worse page than four rows moved together onto the second.
    sheet.heading("🔥  ערכים תזונתיים", TABLE_HEAD + TABLE_ROW * rows.length);
    sheet.nutrition(rows);
    sheet.gap(8);
    sheet.text("הערכה בלבד, מחושבת על ידי ה-AI לפי הרכיבים והכמויות.", {
      size: 9,
      color: MUTED,
      leading: 13,
    });
  }

  sheet.footer(recipe.title);

  const pages = await Promise.all(sheet.pages.map(toJpeg));
  return buildPdf(pages, { title: recipe.title, width: PAGE_WIDTH, height: PAGE_HEIGHT });
}
