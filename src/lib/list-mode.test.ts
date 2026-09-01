import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_LIST_MODE,
  LIST_MODES,
  LIST_MODE_LABELS,
  otherListMode,
  parseListMode,
  readListMode,
  writeListMode,
} from "./list-mode";

describe("parseListMode", () => {
  it("keeps a mode the app knows", () => {
    for (const mode of LIST_MODES) expect(parseListMode(mode)).toBe(mode);
  });

  it("falls back to the shipped mode for anything else", () => {
    expect(parseListMode(null)).toBe(DEFAULT_LIST_MODE);
    expect(parseListMode(undefined)).toBe(DEFAULT_LIST_MODE);
    expect(parseListMode("shelves")).toBe(DEFAULT_LIST_MODE);
  });
});

describe("the mode remembered on this device", () => {
  beforeEach(() => localStorage.clear());

  it("starts on the flat list and comes back as it was left", () => {
    expect(readListMode()).toBe(DEFAULT_LIST_MODE);
    writeListMode("categories");
    expect(readListMode()).toBe("categories");
  });

  it("ignores a stored value the app no longer understands", () => {
    localStorage.setItem("recipe-list-mode", "shelves");
    expect(readListMode()).toBe(DEFAULT_LIST_MODE);
  });
});

describe("the switch", () => {
  it("moves between the two modes and back", () => {
    expect(otherListMode("recipes")).toBe("categories");
    expect(otherListMode("categories")).toBe("recipes");
  });

  it("names every mode it can be on", () => {
    for (const mode of LIST_MODES) expect(LIST_MODE_LABELS[mode]).toBeTruthy();
  });
});
