import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNIT,
  isValidPhone,
  normalizePhone,
  normalizeProductName,
  parseShoppingLine,
} from "./shopping-line";

describe("parseShoppingLine", () => {
  it("lifts the quantity and the cooking unit off the product", () => {
    expect(parseShoppingLine('1 ק"ג קמח')).toEqual({ name: "קמח", quantity: 1, unit: 'ק"ג' });
    expect(parseShoppingLine("2 כפות סוכר")).toEqual({ name: "סוכר", quantity: 2, unit: "כפות" });
    expect(parseShoppingLine("0.5 כפית סודה לשתייה")).toEqual({
      name: "סודה לשתייה",
      quantity: 0.5,
      unit: "כפית",
    });
  });

  it("buys the larger number when the recipe gives a range", () => {
    expect(parseShoppingLine("3-4 בצלים גדולים")).toEqual({
      name: "בצלים גדולים",
      quantity: 4,
      unit: DEFAULT_UNIT,
    });
  });

  it("counts a bare number as a count of the thing itself", () => {
    expect(parseShoppingLine("3 ביצים")).toEqual({ name: "ביצים", quantity: 3, unit: DEFAULT_UNIT });
  });

  it("leaves a line that names no quantity whole", () => {
    expect(parseShoppingLine("מלח ופלפל")).toEqual({
      name: "מלח ופלפל",
      quantity: 1,
      unit: DEFAULT_UNIT,
    });
  });

  it("keeps a number that belongs to the product", () => {
    expect(parseShoppingLine("חלב 3%")).toEqual({ name: "חלב 3%", quantity: 1, unit: DEFAULT_UNIT });
    expect(parseShoppingLine("2 חלב 3%")).toEqual({ name: "חלב 3%", quantity: 2, unit: DEFAULT_UNIT });
  });

  it("does not mistake a product for a measure it merely opens with", () => {
    // כוסברה begins with כוס, and is a herb rather than a cupful of anything.
    expect(parseShoppingLine("1 כוסברה")).toEqual({
      name: "כוסברה",
      quantity: 1,
      unit: DEFAULT_UNIT,
    });
  });

  it("keeps a measure that names nothing rather than buying air", () => {
    expect(parseShoppingLine("2 כפות")).toEqual({ name: "2 כפות", quantity: 1, unit: DEFAULT_UNIT });
  });

  it("tidies the spacing of the line it is given", () => {
    expect(parseShoppingLine("  3   כוסות   קמח  ").name).toBe("קמח");
  });
});

describe("normalizeProductName", () => {
  it("sees one product through the apostrophes Hebrew typing produces", () => {
    expect(normalizeProductName("קוטג׳")).toBe(normalizeProductName("קוטג'"));
    expect(normalizeProductName("  חלב  3%  ")).toBe(normalizeProductName("חלב 3%"));
  });

  it("keeps two different products apart", () => {
    expect(normalizeProductName("קמח")).not.toBe(normalizeProductName("קמח מלא"));
  });
});

describe("phone numbers", () => {
  it("keeps the digits and nothing else", () => {
    expect(normalizePhone("050-123-4567")).toBe("0501234567");
    expect(normalizePhone(" +972 50 1234567 ")).toBe("972501234567");
  });

  it("wants ten digits, as the shopping app's gate does", () => {
    expect(isValidPhone("050-123-4567")).toBe(true);
    expect(isValidPhone("05012345")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});
