import { describe, expect, it } from "vitest";

import {
  htmlToLines,
  htmlToText,
  isBlankHtml,
  isHeadingLine,
  sanitize,
  textToHtml,
} from "./sanitize-html";

describe("sanitize", () => {
  it("keeps the formatting a pasted recipe carries", () => {
    expect(sanitize("<ul><li><b>לבצק:</b></li><li>1 ק\"ג קמח</li></ul>")).toBe(
      "<ul><li><b>לבצק:</b></li><li>1 ק\"ג קמח</li></ul>",
    );
  });

  it("keeps the words and drops the tag for anything else", () => {
    expect(sanitize('<a href="http://example.com">מתכון</a>')).toBe("מתכון");
    expect(sanitize("<h2>רכיבים</h2>")).toBe("רכיבים");
  });

  it("drops scripts, images and event handlers outright", () => {
    expect(sanitize("<script>alert(1)</script>")).toBe("");
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe("");
    expect(sanitize('<p onclick="alert(1)">קמח</p>')).toBe("<p>קמח</p>");
  });

  it("keeps the inline styles Word uses for bold and italic, and no others", () => {
    expect(sanitize('<span style="font-weight:700">קמח</span>')).toBe(
      '<span style="font-weight:700">קמח</span>',
    );
    expect(sanitize('<span style="position:fixed;color:red">קמח</span>')).toBe("<span>קמח</span>");
  });
});

describe("htmlToText", () => {
  it("collapses the whitespace of the markup away", () => {
    expect(htmlToText("<p>2   ביצים</p>\n<p>מלח</p>")).toBe("2 ביצים מלח");
    expect(htmlToText(null)).toBe("");
  });
});

describe("isBlankHtml", () => {
  it("sees an empty editor through whatever markup it left behind", () => {
    expect(isBlankHtml("<p><br></p>")).toBe(true);
    expect(isBlankHtml("   ")).toBe(true);
    expect(isBlankHtml("<p>קמח</p>")).toBe(false);
  });
});

describe("textToHtml", () => {
  it("makes a paragraph of each block and a line break of each newline", () => {
    expect(textToHtml("שורה\nשנייה\n\nפסקה")).toBe("<p>שורה<br>שנייה</p><p>פסקה</p>");
  });

  it("escapes markup in the plain text it is given", () => {
    expect(textToHtml("<script>")).toBe("<p>&lt;script&gt;</p>");
  });
});

describe("htmlToLines", () => {
  it("gives a line per list item, formatting kept", () => {
    expect(htmlToLines("<ul><li>2 <b>ביצים</b></li><li>מלח</li></ul>")).toEqual([
      "2 <b>ביצים</b>",
      "מלח",
    ]);
  });

  it("treats a line break inside a paragraph as a line", () => {
    expect(htmlToLines("<p>קמח<br>סוכר</p>")).toEqual(["קמח", "סוכר"]);
  });

  it("keeps a heading that sits beside a list", () => {
    expect(htmlToLines("<div>לבצק:<ul><li>קמח</li></ul></div>")).toEqual(["לבצק:", "קמח"]);
  });

  it("skips the lines with nothing on them", () => {
    expect(htmlToLines("<p><br></p><p>  </p><p>קמח</p>")).toEqual(["קמח"]);
    expect(htmlToLines("")).toEqual([]);
  });

  it("reads plain text with no markup at all as one line", () => {
    expect(htmlToLines("קמח")).toEqual(["קמח"]);
  });
});

describe("isHeadingLine", () => {
  it("takes a bold line that ends in a colon as a heading", () => {
    expect(isHeadingLine("<b>לבצק:</b>")).toBe(true);
    expect(isHeadingLine("<strong>לבשר:</strong>")).toBe(true);
    expect(isHeadingLine('<span style="font-weight:700">לרוטב:</span>')).toBe(true);
  });

  it("wants both marks, not either one", () => {
    expect(isHeadingLine("<b>לבצק</b>")).toBe(false);
    expect(isHeadingLine("לבצק:")).toBe(false);
  });

  it("leaves a step that opens by naming itself alone", () => {
    expect(isHeadingLine("<b>הכנת הבצק:</b> מערבבים את השמרים")).toBe(false);
  });

  it("is not fooled by an ingredient with a bold quantity", () => {
    expect(isHeadingLine('1 ק"ג <b>קמח</b>')).toBe(false);
    expect(isHeadingLine("<b>2</b> כפות סוכר")).toBe(false);
  });

  it("counts bold nested inside bold once", () => {
    expect(isHeadingLine('<b><span style="font-weight:700">לבצק:</span></b>')).toBe(true);
  });
});
