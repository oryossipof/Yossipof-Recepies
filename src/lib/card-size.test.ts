import { beforeEach, describe, expect, it } from "vitest";

import {
  CARD_SIZES,
  CARD_SIZE_GRID,
  DEFAULT_CARD_SIZE,
  canGrow,
  canShrink,
  parseCardSize,
  readCardSize,
  stepCardSize,
  writeCardSize,
} from "./card-size";

describe("parseCardSize", () => {
  it("keeps a size the app knows", () => {
    for (const size of CARD_SIZES) expect(parseCardSize(size)).toBe(size);
  });

  it("falls back to the shipped size for anything else", () => {
    expect(parseCardSize(null)).toBe(DEFAULT_CARD_SIZE);
    expect(parseCardSize(undefined)).toBe(DEFAULT_CARD_SIZE);
    expect(parseCardSize("enormous")).toBe(DEFAULT_CARD_SIZE);
  });
});

describe("the size remembered on this device", () => {
  beforeEach(() => localStorage.clear());

  it("starts at the shipped size and comes back as it was left", () => {
    expect(readCardSize()).toBe(DEFAULT_CARD_SIZE);
    writeCardSize("tiny");
    expect(readCardSize()).toBe("tiny");
  });

  it("ignores a stored value the app no longer understands", () => {
    localStorage.setItem("recipe-card-size", "enormous");
    expect(readCardSize()).toBe(DEFAULT_CARD_SIZE);
  });
});

describe("stepCardSize", () => {
  it("walks the whole range in both directions", () => {
    expect(stepCardSize("medium", 1)).toBe("large");
    expect(stepCardSize("medium", -1)).toBe("small");
    expect(stepCardSize("small", -1)).toBe("tiny");
  });

  it("stops at the ends rather than wrapping around", () => {
    expect(stepCardSize("large", 1)).toBe("large");
    expect(stepCardSize("tiny", -1)).toBe("tiny");
  });

  it("agrees with the buttons the stepper disables", () => {
    for (const size of CARD_SIZES) {
      expect(canGrow(size)).toBe(stepCardSize(size, 1) !== size);
      expect(canShrink(size)).toBe(stepCardSize(size, -1) !== size);
    }
  });
});

describe("CARD_SIZE_GRID", () => {
  it("gives every size a layout, each one wider than the last", () => {
    const columns = CARD_SIZES.map((size) => {
      const match = CARD_SIZE_GRID[size].match(/^grid-cols-(\d+)/);
      expect(match).not.toBeNull();
      return Number(match![1]);
    });

    // Smallest tiles first, so the phone fits the most of them across.
    expect(columns).toEqual([...columns].sort((a, b) => b - a));
  });
});
