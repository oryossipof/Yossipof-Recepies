import { describe, expect, it } from "vitest";

import { isSearching, matchesName } from "./recipe-search";

describe("matchesName", () => {
  it("finds a name by any run of letters inside it", () => {
    expect(matchesName("צ'לפק – בן ברוך", "צ'לפק")).toBe(true);
    expect(matchesName("צ'לפק – בן ברוך", "לפק")).toBe(true);
    expect(matchesName("מאכלים בוכרים", "בוכר")).toBe(true);
  });

  it("ignores case and the spaces around what was typed", () => {
    expect(matchesName("Focaccia", "focaccia")).toBe(true);
    expect(matchesName("focaccia", "FOCACCIA")).toBe(true);
    expect(matchesName("מאפים ופשטידות", "  מאפים  ")).toBe(true);
  });

  it("finds a name spelled with a geresh from a query typed without one", () => {
    // The mark has three shapes in the wild and none of them is on a phone
    // keyboard, so all four spellings have to reach each other.
    for (const title of ["צ'לפק – בן ברוך", "צ׳לפק – בן ברוך", "צ’לפק – בן ברוך"]) {
      expect(matchesName(title, "צלפק")).toBe(true);
      expect(matchesName(title, "צ'לפק")).toBe(true);
      expect(matchesName(title, "צ׳לפק")).toBe(true);
    }

    expect(matchesName("ג'חנון", "גחנון")).toBe(true);
    expect(matchesName("מרק ק״ג", "מרק קג")).toBe(true);
  });

  it("says no to a name that does not contain it", () => {
    expect(matchesName("קוגל", "צ'לפק")).toBe(false);
    expect(matchesName("קוגל", "צלפק")).toBe(false);
  });

  it("matches nothing at all on an empty query", () => {
    expect(matchesName("קוגל", "")).toBe(false);
    expect(matchesName("קוגל", "   ")).toBe(false);
  });
});

describe("isSearching", () => {
  it("is true only once something has been typed", () => {
    expect(isSearching("")).toBe(false);
    expect(isSearching("   ")).toBe(false);
    expect(isSearching("קוגל")).toBe(true);
  });
});
